const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Report = require('../models/Report');
const AdminAction = require('../models/AdminAction');
const { authenticateAdmin, verifyAdminToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Strict rate limit for admin
const adminAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many admin login attempts' },
});

// POST /api/admin/login - Admin login (secret credentials)
router.post('/login', adminAuthLimiter, authenticateAdmin, (req, res) => {
  const adminToken = jwt.sign(
    {
      role: 'admin',
      username: process.env.ADMIN_USERNAME,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET + process.env.ADMIN_SECRET_KEY,
    { expiresIn: '4h', issuer: 'zapply-admin' }
  );

  res.json({
    success: true,
    adminToken,
    expiresIn: 4 * 60 * 60,
  });
});

// All routes below require admin token
router.use(verifyAdminToken);

// GET /api/admin/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, verifiedUsers, suspendedUsers, pendingReports, totalReports] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ isVerified: true, isDeleted: false }),
      User.countDocuments({ isSuspended: true, isDeleted: false }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments(),
    ]);

    res.json({
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      pendingReports,
      totalReports,
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats failed' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { userId: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { phone: search },
      ];
    }

    if (status === 'suspended') query.isSuspended = true;
    if (status === 'verified') query.isVerified = true;

    const users = await User.find(query)
      .select('userId displayName phone avatar bio isVerified isSuspended suspendedUntil reportCount createdAt lastSeen isOnline')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -phoneHash -otp -refreshTokens');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reports = await Report.find({ reportedUserId: req.params.id })
      .populate('reporterId', 'userId displayName')
      .sort({ createdAt: -1 })
      .limit(10);

    const actions = await AdminAction.find({ targetUserId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ user, reports, actions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/:id/warn - Send warning
router.post('/users/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AdminAction.create({
      adminUsername: req.adminUsername,
      targetUserId: user._id,
      targetUserHandle: user.userId,
      action: 'warn',
      reason: reason || 'Policy violation warning',
    });

    // TODO: In production, send warning notification via WebSocket
    res.json({ success: true, message: `Warning issued to @${user.userId}` });
  } catch (err) {
    res.status(500).json({ error: 'Warning failed' });
  }
});

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const { reason, hours } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const suspendedUntil = hours
      ? new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000)
      : null; // null = permanent

    await User.findByIdAndUpdate(user._id, {
      isSuspended: true,
      suspendedUntil,
      refreshTokens: [], // Force logout
    });

    await AdminAction.create({
      adminUsername: req.adminUsername,
      targetUserId: user._id,
      targetUserHandle: user.userId,
      action: 'suspend',
      reason: reason || 'Account suspended',
      suspendDuration: hours || null,
    });

    res.json({
      success: true,
      message: `@${user.userId} suspended${hours ? ` for ${hours}h` : ' permanently'}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Suspension failed' });
  }
});

// POST /api/admin/users/:id/unsuspend - Unsuspend user
router.post('/users/:id/unsuspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: false, suspendedUntil: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AdminAction.create({
      adminUsername: req.adminUsername,
      targetUserId: user._id,
      targetUserHandle: user.userId,
      action: 'unsuspend',
      reason: 'Account reinstated',
    });

    res.json({ success: true, message: `@${user.userId} unsuspended` });
  } catch (err) {
    res.status(500).json({ error: 'Unsuspend failed' });
  }
});

// DELETE /api/admin/users/:id - Delete user account
router.delete('/users/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        isSuspended: false,
        refreshTokens: [],
        displayName: '[Deleted User]',
        bio: '',
        avatar: null,
      },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AdminAction.create({
      adminUsername: req.adminUsername,
      targetUserId: user._id,
      targetUserHandle: user.userId,
      action: 'delete',
      reason: reason || 'Account deleted',
    });

    res.json({ success: true, message: `Account deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// GET /api/admin/reports - Get all reports
router.get('/reports', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;

    const reports = await Report.find({ status })
      .populate('reporterId', 'userId displayName')
      .populate('reportedUserId', 'userId displayName avatar isSuspended')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Report.countDocuments({ status });

    res.json({ reports, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /api/admin/reports/:id - Update report status
router.patch('/reports/:id', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// GET /api/admin/actions - Get admin action log
router.get('/actions', async (req, res) => {
  try {
    const actions = await AdminAction.find()
      .populate('targetUserId', 'userId displayName')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ actions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

module.exports = router;
