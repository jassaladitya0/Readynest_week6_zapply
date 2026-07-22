const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9_.]+$/,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  phoneHash: {
    type: String,
    default: '',
  },
  passwordHash: {
    type: String,
    default: '',
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 50,
    default: '',
  },
  avatar: {
    type: String, // base64 string (profile pic only)
    default: null,
  },
  bio: {
    type: String,
    maxlength: 160,
    default: '',
  },
  publicKey: {
    type: String, // E2E encryption public key (base64)
    default: '',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isSuspended: {
    type: Boolean,
    default: false,
  },
  suspendedUntil: {
    type: Date,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  privacySettings: {
    lastSeen: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    profilePhoto: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    status: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  },
  // OTP fields (temporary)
  otp: {
    code: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  refreshTokens: [{ type: String }],
  reportCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Hide sensitive fields
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.phoneHash;
    delete ret.otp;
    delete ret.refreshTokens;
    return ret;
  },
});

// Methods
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.isSuspendedNow = function () {
  if (!this.isSuspended) return false;
  if (this.suspendedUntil && this.suspendedUntil < new Date()) {
    this.isSuspended = false;
    this.suspendedUntil = null;
    this.save();
    return false;
  }
  return true;
};

module.exports = mongoose.model('User', userSchema);
