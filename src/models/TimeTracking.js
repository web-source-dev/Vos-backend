const mongoose = require('mongoose');

const timeTrackingSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    unique: true
  },
  stageTimes: {
    intake: {
      startTime: Date,
      endTime: Date,
      totalTime: Number, // in milliseconds
    },
    scheduleInspection: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
    },
    inspection: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
      inspectorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      inspectorName: String,
      
    },
    quotePreparation: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
    },
    offerDecision: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
    },
    paperwork: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
    },
    completion: {
      startTime: Date,
      endTime: Date,
      totalTime: Number,
    }
  },
  totalTime: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
timeTrackingSchema.index({ caseId: 1 });

module.exports = mongoose.model('TimeTracking', timeTrackingSchema); 