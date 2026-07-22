const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateOTP,
  sendOTP,
} = require('../utils/auth');

function normalizePhone(p) {
  if (!p) return p;
  let cleaned = String(p).replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  return cleaned;
}

// POST /api/auth/check-availability - Check if userId or phone is taken
router.post('/check-availability', async (req, res) => {
  try {
    const { userId, phone } = req.body;
    const result = {};

    if (userId) {
      const exists = await User.findOne({ userId: userId.toLowerCase() });
      result.userIdAvailable = !exists;
    }

    if (phone) {
      const cleanPhone = normalizePhone(phone);
      const exists = await User.findOne({ phone: cleanPhone, isVerified: true });
      result.phoneAvailable = !exists;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/send-otp - Send OTP to phone
router.post('/send-otp', async (req, res) => {
  try {
    let { phone, purpose } = req.body; // purpose: 'register' | 'login'

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    phone = normalizePhone(phone);

    // Basic digits validation (7 to 15 digits, optional +)
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (purpose === 'login') {
      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({ error: 'No account found with this phone number' });
      }
    }

    if (purpose === 'register') {
      const existing = await User.findOne({ phone });
      if (existing && existing.isVerified) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 2) * 60000);

    // Store OTP in DB temporarily
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          'otp.code': await bcrypt.hash(otp, 10),
          'otp.expiresAt': expiresAt,
          'otp.attempts': 0,
        }
      },
      { upsert: purpose === 'register', new: true, runValidators: false }
    );

    await sendOTP(phone, otp);

    const isMock = process.env.MOCK_OTP !== 'false' || !process.env.TWILIO_ACCOUNT_SID;

    res.json({
      success: true,
      otp: isMock ? otp : undefined,
      message: isMock
        ? `OTP code: ${otp}`
        : 'OTP sent to your phone number',
      expiresIn: (parseInt(process.env.OTP_EXPIRY_MINUTES) || 2) * 60,
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
  try {
    let { phone, userId, displayName, password, otp, publicKey } = req.body;

    // Validate required fields
    if (!phone || !userId || !displayName || !password || !otp || !publicKey) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    phone = normalizePhone(phone);

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/^[a-z0-9_.]{3,30}$/.test(userId.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    // Check for existing verified user
    const existingPhone = await User.findOne({ phone, isVerified: true });
    if (existingPhone) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const existingUserId = await User.findOne({ userId: userId.toLowerCase() });
    if (existingUserId) {
      return res.status(409).json({ error: 'UserID already taken' });
    }

    // Verify OTP
    let userDoc = await User.findOne({ phone });
    if (!userDoc || !userDoc.otp.code) {
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }

    if (new Date() > userDoc.otp.expiresAt) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (userDoc.otp.attempts >= 3) {
      return res.status(429).json({ error: 'Too many OTP attempts. Request a new OTP.' });
    }

    const otpValid = await bcrypt.compare(otp, userDoc.otp.code);
    if (!otpValid) {
      await User.findOneAndUpdate(
        { phone },
        { $inc: { 'otp.attempts': 1 } }
      );
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Hash phone for privacy
    const phoneHash = await bcrypt.hash(phone, 10);
    const passwordHash = await bcrypt.hash(password, 12);

    // Update or create user
    const updatedUser = await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          userId: userId.toLowerCase(),
          displayName,
          passwordHash,
          phoneHash,
          publicKey,
          isVerified: true,
          'otp.code': null,
          'otp.expiresAt': null,
          'otp.attempts': 0,
        }
      },
      { upsert: true, new: true }
    );

    // Generate tokens
    const accessToken = generateAccessToken(updatedUser._id);
    const { token: refreshToken } = generateRefreshToken(updatedUser._id);

    // Store refresh token
    updatedUser.refreshTokens = [refreshToken];
    await updatedUser.save();

    res.status(201).json({
      success: true,
      user: {
        id: updatedUser._id,
        userId: updatedUser.userId,
        displayName: updatedUser.displayName,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        publicKey: updatedUser.publicKey,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login with phone/userId + password
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, otp } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    const cleanIdentifier = normalizePhone(identifier);
    const isPhone = /^\+?\d{7,15}$/.test(cleanIdentifier);
    const user = await User.findOne(
      isPhone ? { phone: cleanIdentifier } : { userId: identifier.toLowerCase() }
    );

    if (!user || !user.isVerified) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isDeleted) {
      return res.status(403).json({ error: 'Account has been deleted' });
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If OTP provided, verify it (second step for 2FA)
    if (otp && user.otp && user.otp.code) {
      if (new Date() > user.otp.expiresAt) {
        return res.status(400).json({ error: 'OTP expired' });
      }

      if (user.otp.attempts >= 3) {
        return res.status(429).json({ error: 'Too many attempts. Request new OTP.' });
      }

      const otpValid = await bcrypt.compare(otp, user.otp.code);
      if (!otpValid) {
        await User.findByIdAndUpdate(user._id, { $inc: { 'otp.attempts': 1 } });
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      // Clear OTP
      user.otp = { code: null, expiresAt: null, attempts: 0 };
    }

    if (user.isSuspendedNow()) {
      return res.status(403).json({
        error: 'Account suspended',
        suspendedUntil: user.suspendedUntil,
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken } = generateRefreshToken(user._id);

    // Store refresh token (keep max 5)
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        userId: user.userId,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        publicKey: user.publicKey,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    const accessToken = generateAccessToken(user._id);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/logout - Logout (revoke refresh token)
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await User.findOneAndUpdate(
        { refreshTokens: refreshToken },
        { $pull: { refreshTokens: refreshToken }, isOnline: false, lastSeen: new Date() }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
