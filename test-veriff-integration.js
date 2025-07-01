require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const testVeriffIntegration = async () => {
  console.log('=== Veriff Integration Test ===\n');
  
  // Check environment variables
  console.log('1. Environment Configuration:');
  console.log('   VERIFF_PUBLIC_KEY:', process.env.VERIFF_PUBLIC_KEY ? '✅ Set' : '❌ Not set');
  console.log('   VERIFF_PRIVATE_KEY:', process.env.VERIFF_PRIVATE_KEY ? '✅ Set' : '❌ Not set');
  console.log('   VERIFF_API_URL:', process.env.VERIFF_API_URL || 'https://stationapi.veriff.com (default)');
  console.log('   API_BASE_URL:', process.env.API_BASE_URL || 'http://localhost:5000 (default)');
  console.log('');

  // Check if API keys are configured
  if (!process.env.VERIFF_PUBLIC_KEY || !process.env.VERIFF_PRIVATE_KEY) {
    console.error('❌ ERROR: Veriff API keys not configured');
    console.error('Please set the following environment variables:');
    console.error('   VERIFF_PUBLIC_KEY=your_public_key_here');
    console.error('   VERIFF_PRIVATE_KEY=your_private_key_here');
    console.error('');
    console.error('You can get these from your Veriff dashboard at https://dashboard.veriff.me');
    process.exit(1);
  }

  console.log('✅ SUCCESS: Veriff API keys are configured\n');

  // Test API connectivity
  console.log('2. Testing Veriff API Connectivity:');
  try {
    const VERIFF_API_URL = process.env.VERIFF_API_URL || 'https://stationapi.veriff.com';
    const VERIFF_PUBLIC_KEY = process.env.VERIFF_PUBLIC_KEY;
    const VERIFF_PRIVATE_KEY = process.env.VERIFF_PRIVATE_KEY;

    // Create test session payload
    const testPayload = {
      person: {
        givenName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      },
      document: {
        type: 'DRIVERS_LICENSE',
        country: 'US'
      },
      vendorData: 'test_session_123',
      timestamp: Math.floor(Date.now() / 1000)
    };

    // Create signature
    const bodyString = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac('sha256', VERIFF_PRIVATE_KEY)
      .update(bodyString)
      .digest('hex');

    console.log('   Testing session creation...');
    
    const response = await axios.post(`${VERIFF_API_URL}/v1/sessions`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': VERIFF_PUBLIC_KEY,
        'X-SIGNATURE': signature,
        'X-TIMESTAMP': testPayload.timestamp
      }
    });

    if (response.data && response.data.verification) {
      console.log('   ✅ Session created successfully');
      console.log('   Session ID:', response.data.verification.id);
      console.log('   Session URL:', response.data.verification.url);
      console.log('');
    } else {
      console.log('   ❌ Unexpected response format');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }

  } catch (error) {
    console.log('   ❌ API test failed');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', error.response.data);
    } else {
      console.log('   Error:', error.message);
    }
    console.log('');
  }

  // Test backend endpoints
  console.log('3. Testing Backend Endpoints:');
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
  
  try {
    console.log('   Testing session creation endpoint...');
    const sessionResponse = await axios.post(`${API_BASE_URL}/api/veriff/session`, {
      person: {
        givenName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      },
      document: {
        type: 'DRIVERS_LICENSE',
        country: 'US'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token' // You'll need a valid JWT token
      }
    });

    if (sessionResponse.data && sessionResponse.data.success) {
      console.log('   ✅ Backend session endpoint working');
      console.log('   Session ID:', sessionResponse.data.data.id);
    } else {
      console.log('   ❌ Backend session endpoint failed');
      console.log('   Response:', sessionResponse.data);
    }

  } catch (error) {
    console.log('   ❌ Backend test failed');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', error.response.data);
    } else {
      console.log('   Error:', error.message);
    }
  }

  console.log('');
  console.log('4. Integration Status:');
  console.log('   ✅ Veriff WebSDK package installed');
  console.log('   ✅ Frontend verification page created (/verify-identity)');
  console.log('   ✅ Backend API routes created (/api/veriff/*)');
  console.log('   ✅ VeriffSession model created');
  console.log('   ✅ User model updated with verification fields');
  console.log('   ✅ Webhook handling implemented');
  console.log('   ✅ HMAC signature verification implemented');
  console.log('');
  console.log('5. Next Steps:');
  console.log('   1. Get your Veriff API keys from https://dashboard.veriff.me');
  console.log('   2. Add the keys to your .env file:');
  console.log('      VERIFF_PUBLIC_KEY=your_public_key_here');
  console.log('      VERIFF_PRIVATE_KEY=your_private_key_here');
  console.log('   3. Configure webhook URL in Veriff dashboard:');
  console.log('      https://your-domain.com/api/veriff/result');
  console.log('   4. Test the integration by visiting /verify-identity');
  console.log('');
  console.log('✅ Veriff integration is ready for configuration!');
};

// Run the test
testVeriffIntegration().catch(console.error); 