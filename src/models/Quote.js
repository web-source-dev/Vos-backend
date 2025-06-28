const mongoose = require('mongoose');
const crypto = require('crypto');

const QuoteSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  inspection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection',
  },
  estimator: {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: String
  },
  offerAmount: {
    type: Number,
  },
  expiryDate: {
    type: Date,
  },
  notes: String,
  titleReminder: {
    type: Boolean,
    default: true
  },
  estimatedValue: Number,
  status: {
    type: String,
    enum: ['draft', 'ready', 'presented', 'accepted', 'negotiating', 'declined', 'expired'],
    default: 'draft'
  },
  accessToken: {
    type: String,
    default: function() {
      return crypto.randomBytes(20).toString('hex');
    }
  },
  offerDecision: {
    decision: {
      type: String,
      enum: ['accepted', 'negotiating', 'declined', 'pending'],
      default: 'pending'
    },
    counterOffer: Number,
    customerNotes: String,
    finalAmount: Number,
    decisionDate: Date,
    reason: String
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Quote', QuoteSchema); 