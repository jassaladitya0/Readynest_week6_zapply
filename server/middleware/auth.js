const { verifyAccessToken } = require('../utils/auth');
const User = require('../models/User');

/**
 * Middleware: Authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.userId).select('-passwordHash -phoneHash -otp -refreshTokens');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isDeleted) {
      return res.status(403).json({ error: 'Account has been deleted' });
    }

    if (user.isSuspendedNow()) {
      return res.status(403).json({
        error: 'Account suspended',
        suspendedUntil: user.suspendedUntil,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware: Authenticate admin
 */
const authenticateAdmin = (req, res, next) => {
  const { username, password, secretKey } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecretKey = process.env.ADMIN_SECRET_KEY;

  if (
    username === adminUsername &&
    password === adminPassword &&
    secretKey === adminSecretKey
  ) {
    req.isAdmin = true;
    next();
  } else {
    // Deliberate delay to prevent brute force
    setTimeout(() => {
      res.status(403).json({ error: 'Access denied' });
    }, 1000);
  }
};

/**
 * Middleware: Verify admin session token
 */
const verifyAdminToken = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET + process.env.ADMIN_SECRET_KEY);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUsername = decoded.username;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired admin token' });
  }
};

module.exports = { authenticate, authenticateAdmin, verifyAdminToken };
