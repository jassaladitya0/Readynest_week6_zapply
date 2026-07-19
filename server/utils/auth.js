const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Generate access token (15 minutes)
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m', issuer: 'zapply' }
  );
};

/**
 * Generate refresh token (7 days)
 */
const generateRefreshToken = (userId) => {
  const tokenId = uuidv4();
  const token = jwt.sign(
    { userId, tokenId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d', issuer: 'zapply' }
  );
  return { token, tokenId };
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
};

/**
 * Generate OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP (mock for dev)
 */
const sendOTP = async (phone, otp) => {
  if (process.env.MOCK_OTP === 'true') {
    console.log(`\n🔐 [MOCK OTP] Phone: ${phone} | OTP: ${otp}\n`);
    return { success: true, mock: true };
  }
  // TODO: Integrate Twilio here
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({ body: `Your Zapply OTP: ${otp}`, from: process.env.TWILIO_PHONE_NUMBER, to: phone });
  return { success: true };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateOTP,
  sendOTP,
};
