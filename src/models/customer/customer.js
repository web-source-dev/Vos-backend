const mongoose = require('mongoose');

const VehicleSubmissionSchema = new mongoose.Schema({
  vinOrPlate: {
    vin: { type: String, default: '' },
    make: { type: String, default: '' },
    model: { type: String, default: '' },
    year: { type: Number, default: 0 },
    licensePlate: { type: String, default: '' },
    trim: { type: String, default: '' },
    transmission: { type: String, default: '' },
    estimatedPrice: { type: Number, default: 0 }, // This is the estimated price of the vehicle from the VIN decode as estimatedValue
  },

  // STEP 2: The Basics
  basics: {
    mileage: Number,
    zipCode: String,
    color: String,
    transmission: String,
    drivetrain: String,
    engine: String,
    loanLeaseStatus: {
      type: String,
    },
    loanDetails: {
      lenderName: String,
      loanBalance: Number,
      monthlyPayment: Number,
    },
    leaseDetails: {
      leasingCompany: String,
      leasePayoff: Number,
      monthlyPayment: Number,
    },
  },

  // STEP 3: Vehicle Condition & History
  condition: {
    accidentHistory: { type: String },
    isDrivable: { type: Boolean },
    mechanicalIssues: [String], // Air Conditioning, Electrical, etc.
    engineIssues: [String],     // Check Engine Light, Vibration, etc.
    exteriorDamage: [String],   // Dings, Rust, etc.
    interiorCondition: [String], // Odors, Tears, etc.
    techIssues: [String],        // Sound, Sensors, etc.
    windshieldCondition: { type: String },
    sunroofCondition: { type: String },
    tiresReplaced: { type: Number, min: 0, max: 4 },
    hasModifications: Boolean,
    smokedIn: Boolean,
    keyCount: Number,
    overallCondition: {
      type: String,
    },
  },

  // STEP 4: Email
  contact: {
    email: { type: String },
    mobile: String,
  },

  // STEP 5: Offer
  offer: {
    amount: Number,
    expiresAt: Date,
    generated: { type: Boolean, default: false },
    generatedAt: Date,
  },

  // STEP 7: Sale Details
  saleConfirmation: {
    vehicleYear: Number,
    make: String,
    model: String,
    state: String,
    loanOrLeaseDetected: Boolean,
  },

  // STEP 8: Ownership Verification
  ownership: {
    odometerPhoto: String, // File URL or path
    photoID: String,       // File URL or path
    titleVerified: { type: Boolean, default: false },
  },

  // STEP 9: Payout
  payoutMethod: {
    type: String,
  },

  // STEP 10: Pickup or Drop-off
  appointment: {
    type: {
      type: String,
    },
    address: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  appointmentDateTime: Date,

},
    { timestamps: true }
);

module.exports = mongoose.model('VehicleSubmission', VehicleSubmissionSchema);
