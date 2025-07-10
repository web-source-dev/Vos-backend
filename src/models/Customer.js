const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  firstName: {
    type: String,
  },
  middleInitial: String,
  lastName: {
    type: String,
  },
  cellPhone: {
    type: String,
  },
  homePhone: String,
  email1: {
    type: String,
  },
  email2: String,
  email3: String,
  hearAboutVOS: String,
  source: {
    type: String,
    enum: ['contact_form', 'walk_in', 'phone', 'online', 'on_the_road', 'social_media', 'other', '']
  },
  receivedOtherQuote: {
    type: Boolean,
    default: false
  },
  otherQuoteOfferer: String,
  otherQuoteAmount: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  notes:String,
  agent: {
      type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  storeLocation: String
});

module.exports = mongoose.model('Customer', CustomerSchema); 