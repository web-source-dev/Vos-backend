const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const VERIFF_PUBLIC_KEY = process.env.VERIFF_PUBLIC_KEY;
const VERIFF_PRIVATE_KEY = process.env.VERIFF_PRIVATE_KEY;
const VERIFF_API_URL = process.env.VERIFF_API_URL || 'https://stationapi.veriff.com';

// Replace with your actual payload if needed
const payload = {
  person: {
    givenName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com'
  },
  document: {
    type: 'DRIVERS_LICENSE',
    country: 'US'
  },
  vendorData: 'test-user-id',
  callback: 'http://localhost:5000/api/veriff/result'
};

const cleanPayload = JSON.parse(JSON.stringify(payload)); // Remove undefined/null
const bodyString = JSON.stringify(cleanPayload);
const timestamp = Math.floor(Date.now() / 1000);

function createVeriffSignature(payloadString) {
  return crypto
    .createHmac('sha256', VERIFF_PRIVATE_KEY)
    .update(payloadString)
    .digest('hex');
}

const signature = createVeriffSignature(bodyString);

console.log('--- Veriff Minimal HMAC Test ---');
console.log('Public Key:', VERIFF_PUBLIC_KEY);
console.log('Private Key (length):', VERIFF_PRIVATE_KEY ? VERIFF_PRIVATE_KEY.length : 'undefined');
console.log('Payload:', bodyString);
console.log('Signature:', signature);
console.log('Timestamp:', timestamp);
console.log('API URL:', VERIFF_API_URL);

axios.post(`${VERIFF_API_URL}/v1/sessions`, cleanPayload, {
  headers: {
    'Content-Type': 'application/json',
    'X-AUTH-CLIENT': VERIFF_PUBLIC_KEY,
    'X-SIGNATURE': signature,
    'X-TIMESTAMP': timestamp
  }
}).then(res => {
  console.log('SUCCESS! Response:');
  console.dir(res.data, { depth: null });
}).catch(err => {
  if (err.response) {
    console.error('ERROR:', err.response.data);
  } else {
    console.error('ERROR:', err.message);
  }
}); 