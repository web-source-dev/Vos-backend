# Veriff Integration Setup Guide

## Overview

This guide will help you set up Veriff identity verification in your VOS application. Veriff provides secure, compliant identity verification services that can be integrated into your application.

## What's Already Implemented

✅ **Frontend Components:**
- Veriff WebSDK integration with proper loading
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

### 3. Configure Webhook URL

In your Veriff dashboard:

1. Go to **Settings** > **Webhooks**
2. Add your webhook URL: `https://your-domain.com/api/veriff/result`
3. Make sure the webhook is enabled
4. Test the webhook to ensure it's working

### 4. Test the Integration

Run the test script to verify everything is working:

```bash
cd backend
node test-veriff-integration.js
```

This will:
- Check your environment configuration
- Test API connectivity
- Verify backend endpoints
- Provide detailed feedback on any issues

### 5. Frontend Integration

The frontend is already configured to work with Veriff. When a user clicks the "Verify Identity" button:

1. A session is created via the backend API
2. The Veriff SDK is loaded and initialized
3. The verification modal opens with the session URL
4. User completes the verification process
5. Results are received via webhook and stored in the database

## API Endpoints

### Create Session
```
POST /api/veriff/session
Content-Type: application/json
Authorization: Bearer <jwt_token>

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

### Webhook Handler
```
POST /api/veriff/result
Content-Type: application/json

{
  "verification": {
    "id": "session_id",
    "status": "approved|declined|resubmission_requested",
    "person": { ... },
    "document": { ... }
  }
}
```

### Get Session Status
```
GET /api/veriff/session/:sessionId
Authorization: Bearer <jwt_token>
```

## Webhook Payload Structure

When Veriff sends a webhook, it includes:

```json
{
  "status": "success",
  "verification": {
    "id": "session_id",
    "status": "approved",
    "person": {
      "firstName": "JOHN",
      "lastName": "DOE",
      "dateOfBirth": "1990-01-01"
    },
    "document": {
      "number": "DOC123456",
      "type": "DRIVERS_LICENSE",
      "country": "US"
    }
  }
}
```

## Status Codes

- `approved`: Verification successful
- `declined`: Verification failed
- `resubmission_requested`: User needs to resubmit documents
- `review`: Manual review required
- `expired`: Session expired
- `abandoned`: User abandoned the process

## Troubleshooting

### Common Issues

1. **API Keys Not Working**
   - Verify you're using the correct keys from your Veriff dashboard
   - Make sure the keys are for the correct environment (sandbox/production)
   - Check that the private key is the full length

2. **Webhook Not Receiving Data**
   - Verify the webhook URL is correct and accessible
   - Check that your server can receive POST requests
   - Ensure the webhook is enabled in your Veriff dashboard

3. **SDK Not Loading**
   - Check browser console for JavaScript errors
   - Verify the SDK URL is accessible
   - Make sure you're not blocking external scripts

4. **Session Creation Fails**
   - Check the backend logs for detailed error messages
   - Verify the API payload format is correct
   - Ensure all required fields are provided

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

This will provide detailed logs of API requests and responses.

## Security Considerations

1. **API Keys**: Never expose your private key in frontend code
2. **Webhook Verification**: Always verify webhook signatures in production
3. **HTTPS**: Use HTTPS for all webhook URLs in production
4. **Rate Limiting**: Implement rate limiting on your API endpoints
5. **Data Storage**: Ensure verification data is stored securely

## Production Checklist

- [ ] API keys configured for production environment
- [ ] Webhook URL uses HTTPS
- [ ] Webhook signature verification enabled
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Database indexes created for performance
- [ ] Rate limiting implemented
- [ ] SSL certificate installed
- [ ] Monitoring and alerting set up

## Support

If you encounter issues:

1. Check the Veriff documentation: https://devdocs.veriff.com/
2. Review the test script output for specific error messages
3. Check your server logs for detailed error information
4. Contact Veriff support if the issue is with their API

## References

- [Veriff API Documentation](https://devdocs.veriff.com/apidocs)
- [Document-only IDV Guide](https://devdocs.veriff.com/v1/docs/document-only-idv)
- [HMAC Authentication Guide](https://devdocs.veriff.com/docs/hmac-authentication-and-endpoint-security)
- [Status Codes Reference](https://devdocs.veriff.com/docs/verification-session-status-codes-table) 