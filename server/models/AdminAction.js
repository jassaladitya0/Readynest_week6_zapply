const mongoose = require('mongoose');

const adminActionSchema = new mongoose.Schema({
  adminUsername: {
    type: String,
    required: true,
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetUserHandle: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    enum: ['warn', 'suspend', 'unsuspend', 'delete', 'restore'],
    required: true,
  },
  reason: {
    type: String,
    maxlength: 500,
    default: '',
  },
  suspendDuration: {
    type: Number, // hours
    default: null,
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AdminAction', adminActionSchema);
