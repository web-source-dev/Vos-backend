const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  inspection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  documents: {
    driverLicenseFront: {
      path: String,
      originalName: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    driverLicenseRear: {
      path: String,
      originalName: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    vehicleTitle: {
      path: String,
      originalName: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  },
  currentStage: {
    type: Number,
    min: 1,
    max: 7,
    default: 1
  },
  stageStatuses: {
    1: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'active'
    },
    2: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    },
    3: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    },
    4: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    },
    5: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    },
    6: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    },
    7: {
      type: String,
      enum: ['active', 'complete', 'pending'],
      default: 'pending'
    }
  },
  status: {
    type: String,
    enum: ['new', 'active', 'scheduled', 'quote-ready', 'negotiating', 'completed', 'cancelled'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  estimatedValue: Number,
  thankYouSent: {
    type: Boolean,
    default: false
  },
  completion: {
    thankYouSent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    leaveBehinds: {
      vehicleLeft: {
        type: Boolean,
        default: false
      },
      keysHandedOver: {
        type: Boolean,
        default: false
      },
      documentsReceived: {
        type: Boolean,
        default: false
      }
    },
    pdfGenerated: {
      type: Boolean,
      default: false
    },
    completedAt: Date
  },
  lastActivity: {
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  pdfCaseFile: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Case', CaseSchema); 