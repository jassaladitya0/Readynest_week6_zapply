const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Report = require('../models/Report');
const { authenticate } = require('../middleware/auth');

// GET /api/users/me - Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/users/me - Update profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const { displayName, bio, avatar, privacySettings } = req.body;
    const updates = {};

    if (displayName) updates.displayName = displayName.trim().substring(0, 50);
    if (bio !== undefined) updates.bio = bio.trim().substring(0, 160);
    if (avatar !== undefined) updates.avatar = avatar; // base64
    if (privacySettings) updates.privacySettings = privacySettings;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('-passwordHash -phoneHash -otp -refreshTokens');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// GET /api/users/search?q=query - Search users by userId or displayName
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await User.find({
      $or: [
        { userId: { $regex: q.toLowerCase(), $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
      ],
      isVerified: true,
      isDeleted: false,
      _id: { $ne: req.user._id },
    })
      .select('userId displayName avatar bio publicKey isOnline lastSeen privacySettings')
      .limit(20);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/users/:userId - Get user by userId handle
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({
      userId: req.params.userId.toLowerCase(),
      isVerified: true,
      isDeleted: false,
    }).select('userId displayName avatar bio publicKey isOnline lastSeen privacySettings createdAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'User lookup failed' });
  }
});

// POST /api/users/report - Report a user
router.post('/report', authenticate, async (req, res) => {
  try {
    const { reportedUserId, reason, description } = req.body;

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate report
    const existing = await Report.findOne({
      reporterId: req.user._id,
      reportedUserId,
      status: 'pending',
    });
    if (existing) {
      return res.status(409).json({ error: 'You already reported this user' });
    }

    await Report.create({
      reporterId: req.user._id,
      reportedUserId,
      reportedUserHandle: reportedUser.userId,
      reason,
      description: description?.substring(0, 500) || '',
    });

    await User.findByIdAndUpdate(reportedUserId, { $inc: { reportCount: 1 } });

    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Report failed' });
  }
});

// PUT /api/users/me/change-password - Change password
router.put('/me/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.refreshTokens = []; // Logout all sessions
    await user.save();

    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
