const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  year: {
    type: String,
  },
  make: {
    type: String,
  },
  model: {
    type: String,
  },
  currentMileage: {
    type: String,
  },
  vin: {
    type: String
  },
  color: String,
  bodyStyle: String,
  licensePlate: String,
  licenseState: String,
  titleNumber: String,
  titleStatus: {
    type: String,
    enum: ['clean', 'salvage', 'rebuilt', 'lemon', 'flood', 'junk', 'not-sure'],
    default: 'clean'
  },
  loanStatus: {
    type: String,
    enum: ['paid-off', 'still-has-loan', 'not-sure'],
    default: 'paid-off'
  },
  loanAmount: Number,
  secondSetOfKeys: {
    type: Boolean,
    default: false
  },
  hasTitleInPossession: {
    type: Boolean,
    default: false
  },
  titleInOwnName: {
    type: Boolean,
    default: false
  },
  knownDefects: String,
  estimatedValue: {
    type: Number,
    default: null
  },
  pricingSource: {
    type: String,
    default: null
  },
  pricingLastUpdated: {
    type: Date,
    default: null
  },
  isElectric: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
},
{
  timestamps: true
}
);

module.exports = mongoose.model('Vehicle', VehicleSchema); 