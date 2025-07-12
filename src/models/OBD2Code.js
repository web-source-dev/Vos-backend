const mongoose = require('mongoose');

const OBD2CodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    required: true
  },
  codeType: {
    type: String,
  },
  commonCauses: {
    type: String
  },
  criticality: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  estimatedRepairCost: {
    type: String, // e.g., "$75 - $400"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add text index for search capability
OBD2CodeSchema.index({ code: 'text', description: 'text' });

const OBD2Code = mongoose.model('OBD2Code', OBD2CodeSchema);

module.exports = OBD2Code; 