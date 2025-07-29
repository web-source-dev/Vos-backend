const mongoose = require('mongoose');
const crypto = require('crypto');

const InspectionQuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['radio', 'checkbox', 'text', 'rating', 'photo', 'yesno', 'number'],
    required: true
  },
  options: [{
    value: String,
    label: String,
    points: Number
  }],
  required: {
    type: Boolean,
    default: false
  },
  answer: mongoose.Schema.Types.Mixed,
  notes: String,
  photos: [{
    path: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  subQuestions: [{
    id: String,
    question: String,
    type: {
      type: String,
      enum: ['radio', 'checkbox', 'text', 'rating', 'photo', 'yesno', 'number']
    },
    options: [{
      value: String,
      label: String,
      points: Number
    }],
    answer: mongoose.Schema.Types.Mixed,
    notes: String,
    photos: [{
      path: String,
      originalName: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }]
});

const InspectionSectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  icon: String,
  questions: [InspectionQuestionSchema],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  photos: [{
    path: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
});

const InspectionSchema = new mongoose.Schema({
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
  inspector: {
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
  scheduledDate: {
    type: Date,
  },
  scheduledTime: {
    type: String,
  },
  dueByDate: {
    type: Date,
  },
  dueByTime: {
    type: String,
  },
  notesForInspector: {
    type: String,
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  accessToken: {
    type: String,
    default: function() {
      return crypto.randomBytes(20).toString('hex');
    }
  },
  sections: [InspectionSectionSchema],
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  overallScore: {
    type: Number,
    default: 0
  },
  maxPossibleScore: {
    type: Number,
    default: 0
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  inspectionNotes: String,
  recommendations: [String],
  safetyIssues: [{
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    description: String,
    location: String,
    estimatedCost: Number
  }],
  maintenanceItems: [{
    priority: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    description: String,
    estimatedCost: Number,
    recommendedAction: String
  }],
  vinVerification: {
    vinNumber: String,
    vinMatch: {
      type: String,
      enum: ['yes', 'no', 'not_verified']
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Inspection', InspectionSchema); 