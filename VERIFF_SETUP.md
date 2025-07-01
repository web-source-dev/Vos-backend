# Veriff Integration Setup Guide

## Overview

This guide will help you set up Veriff identity verification in your VOS application. Veriff provides secure, compliant identity verification services that can be integrated into your application.

## What's Already Implemented

✅ **Frontend Components:**
- Veriff WebSDK package installed (`@veriff/js-sdk`)
- Identity verification page at `/verify-identity`
- Complete UI with status indicators and error handling
- Integration with your existing authentication system
- Updated to use correct SDK version (1.5) and API host (stationapi.veriff.com)

✅ **Backend API:**
- Session creation endpoint (`POST /api/veriff/session`)
- Webhook handling endpoint (`POST /api/veriff/result`)
- Session status endpoint (`GET /api/veriff/session/:sessionId`)
- Database models for storing verification sessions
- User model updated with verification status fields

✅ **Security Features:**
- HMAC signature verification for webhooks
- Protected API routes requiring authentication
- Secure session management
- Database storage of verification data

## Setup Steps

### 1. Get Veriff API Keys

1. Go to [Veriff Dashboard](https://dashboard.veriff.me)
2. Sign up for an account or log in
3. Navigate to the API section
4. Copy your **Public Key** and **Private Key**

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Veriff API Configuration
VERIFF_PUBLIC_KEY=your_actual_public_key_here
VERIFF_PRIVATE_KEY=your_actual_private_key_here
VERIFF_API_URL=https://stationapi.veriff.com

# Optional: Custom webhook URL (if different from default)
API_BASE_URL=https://your-domain.com
```

**Important Notes:**
- Replace the placeholder values with your actual Veriff API keys from your dashboard
- The API secret (private key) should be a long string (typically 64+ characters)
- Make sure you're copying the full API secret, not a truncated version
- The example keys shown above are placeholders and will not work

### 3. Configure Webhook URL

In your Veriff dashboard:
1. Go to **Settings** → **Webhooks**
2. Add your webhook URL: `https://your-domain.com/api/veriff/result`
3. Select the events you want to receive (recommended: all events)
4. Save the webhook configuration

### 4. Test the Integration

Run the test script to verify your configuration:

```bash
npm run test-veriff
```

### 5. Test the Frontend

1. Start your development server
2. Navigate to `/verify-identity`
3. Click "Start Verification"
4. Complete the verification process

## API Endpoints

### Create Verification Session
```
POST /api/veriff/session
Authorization: Bearer <token>
Content-Type: application/json

{
  "person": {
    "givenName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
  },
  "document": {
    "type": "DRIVERS_LICENSE",
    "country": "US"
  }
}
```

### Get Session Status
```
GET /api/veriff/session/:sessionId
Authorization: Bearer <token>
```

### Webhook Endpoint
```
POST /api/veriff/result
Content-Type: application/json

{
  "verification": {
    "id": "session_id",
    "status": "approved|declined|submitted",
    "person": { ... },
    "document": { ... }
  }
}
```

## Database Schema

### VeriffSession Model
```javascript
{
  sessionId: String (required, unique),
  userId: ObjectId (ref: User),
  status: String (enum: created, started, submitted, approved, declined, expired, abandoned),
  url: String (required),
  person: {
    givenName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    idNumber: String
  },
  document: {
    type: String,
    country: String
  },
  verificationData: Mixed,
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date
}
```

### User Model Updates
```javascript
{
  // ... existing fields
  isVerified: Boolean (default: false),
  verifiedAt: Date
}
```

## Frontend Integration

The verification page is located at `/verify-identity` and includes:

- **Status Management**: Tracks verification progress
- **Error Handling**: Graceful error handling with user feedback
- **Responsive Design**: Works on desktop and mobile
- **Integration**: Seamlessly integrates with your existing auth system

## Security Considerations

1. **API Key Security**: Never commit API keys to version control
2. **Webhook Verification**: Always verify webhook signatures in production
3. **Data Privacy**: Ensure compliance with data protection regulations
4. **HTTPS**: Always use HTTPS in production for secure communication

## Troubleshooting

### Common Issues

1. **"API keys not configured"**
   - Ensure environment variables are set correctly
   - Restart your server after adding environment variables

2. **"Failed to create verification session"**
   - Check your API keys are correct
   - Verify your Veriff account is active
   - Check network connectivity

3. **"Signature does not match" error**
   - Ensure you're using the full API secret (not truncated)
   - The API secret should be 64+ characters long
   - Double-check that you copied the complete secret from your Veriff dashboard
   - Verify the API keys are for the correct environment (sandbox vs production)

3. **"Webhook not receiving data"**
   - Verify webhook URL is accessible from the internet
   - Check webhook configuration in Veriff dashboard
   - Ensure your server can handle POST requests

4. **"Verification page not loading"**
   - Check browser console for JavaScript errors
   - Verify Veriff SDK is loading correctly
   - Ensure user is authenticated

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed logs for troubleshooting.

## Production Checklist

- [ ] API keys configured in production environment
- [ ] Webhook URL configured in Veriff dashboard
- [ ] HTTPS enabled for all communications
- [ ] Database migrations run for new models
- [ ] Error monitoring configured
- [ ] Compliance requirements reviewed
- [ ] User data handling policies updated

## Support

For Veriff-specific issues:
- [Veriff Documentation](https://docs.veriff.com/)
- [Veriff Support](https://support.veriff.com/)

For VOS application issues:
- Check application logs
- Review this documentation
- Contact your development team

## Next Steps

After completing the setup:

1. **Test thoroughly** in development environment
2. **Deploy to staging** and test with real Veriff environment
3. **Deploy to production** with proper monitoring
4. **Monitor verification success rates** and user feedback
5. **Optimize** based on usage patterns and feedback

Your Veriff integration is now ready for production use! 🎉 