const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
  },
  billOfSale: {
    sellerName: {
      type: String,
    },
    sellerAddress: {
      type: String,
    },
    sellerCity: String,
    sellerState: String,
    sellerZip: String,
    sellerPhone: String,
    sellerEmail: String,
    sellerDLNumber: String,
    sellerDLState: String,
    buyerName: {
      type: String,
      default: 'VOS - Vehicle Offer Service'
    },
    buyerAddress: {
      type: String,
      default: '123 Business Ave'
    },
    buyerCity: {
      type: String,
      default: 'Business City'
    },
    buyerState: {
      type: String,
      default: 'BC'
    },
    buyerZip: {
      type: String,
      default: '12345'
    },
    buyerBusinessLicense: {
      type: String,
      default: 'VOS-12345-AB'
    },
    buyerRepName: String,
    vehicleVIN: String,
    vehicleYear: String,
    vehicleMake: String,
    vehicleModel: String,
    vehicleColor: String,
    vehicleBodyStyle: String,
    vehicleLicensePlate: String,
    vehicleLicenseState: String,
    vehicleTitleNumber: String,
    vehicleMileage: String,
    saleDate: {
      type: Date,
      default: Date.now
    },
    saleTime: String,
    salePrice: {
      type: Number,
    },
    paymentMethod: {
      type: String,
      default: 'ACH Transfer'
    },
    odometerReading: String,
    odometerAccurate: {
      type: Boolean,
      default: true
    },
    titleStatus: String,
    knownDefects: String,
    asIsAcknowledgment: {
      type: Boolean,
      default: false
    },
    notaryRequired: {
      type: Boolean,
      default: false
    },
    notaryName: String,
    notaryCommissionExpiry: Date,
    witnessName: String,
    witnessPhone: String
  },
  preferredPaymentMethod: { type: String, default: 'Wire' },
  documents: {
    idRescan: String,
    signedBillOfSale: String,
    titlePhoto: String,
    insuranceDeclaration: String,
    sellerSignature: String,
    additionalDocuments: [String]
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  pdfGenerated: {
    type: Boolean,
    default: false
  },
  pdfPath: String,
  submittedAt: Date,
  completedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema); 