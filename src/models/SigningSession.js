const mongoose = require('mongoose');
const crypto = require('crypto');

const SigningSessionSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  documentType: {
    type: String,
    enum: ['bill-of-sale', 'title-transfer', 'other'],
    required: true
  },
  recipient: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  token: {
    type: String,
    default: function() {
      return crypto.randomBytes(32).toString('hex');
    },
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'viewed', 'signed', 'expired', 'cancelled'],
    default: 'pending'
  },
  documentUrl: String,
  signedDocumentUrl: String,
  signature: {
    type: String,
    required: false,
  },
  emailSentAt: Date,
  viewedAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      const now = new Date();
      return new Date(now.setDate(now.getDate() + 7)); // 7-day expiry by default
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('SigningSession', SigningSessionSchema); 