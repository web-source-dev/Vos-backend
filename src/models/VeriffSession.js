const mongoose = require('mongoose');

const VeriffSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['created', 'started', 'submitted', 'approved', 'declined', 'expired', 'abandoned'],
    default: 'created'
  },
  url: {
    type: String,
    required: true
  },
  person: {
    givenName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    idNumber: String
  },
  document: {
    type: String,
    country: String
  },
  verificationData: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});

// Update the updatedAt field before saving
VeriffSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VeriffSession', VeriffSessionSchema); 