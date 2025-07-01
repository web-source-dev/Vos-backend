# VOS Backend API

This is the backend API for the Vehicle Operations System (VOS) with MarketCheck integration for real-time vehicle pricing.

## Features

- Vehicle case management
- Inspection scheduling and management
- Quote preparation and management
- Real-time vehicle pricing via MarketCheck API
- PDF generation for case files and bills of sale
- Email notifications
- User authentication and authorization
- Analytics and reporting

## MarketCheck API Integration

The system uses MarketCheck API to fetch real-time vehicle pricing based on VIN (Vehicle Identification Number). This provides accurate, up-to-date market values for vehicles.

### Setup

1. **Get MarketCheck API Key**: Sign up for a MarketCheck API account at [marketcheck.com](https://marketcheck.com) and obtain your API key.

2. **Environment Variables**: Add the following to your `.env` file:
   ```
   MARKETCHECK_API_KEY=your_marketcheck_api_key_here
   ```

3. **API Endpoint**: The system will automatically fetch vehicle pricing when a VIN is provided in the quote preparation stage.

### How it Works

1. When a user enters a VIN in the quote preparation stage, the system sends the VIN to MarketCheck API
2. MarketCheck returns real-time pricing data based on current market conditions and listings
3. The system calculates average pricing from available listings or uses valuation data
4. The pricing data is stored in the vehicle record and used for quote preparation
5. Users can refresh pricing data to get the latest market values

### API Endpoints Used

The system uses two MarketCheck API endpoints:

1. **Search Endpoint**: `https://api.marketcheck.com/v1/search?vin={vin}&api_key={api_key}`
   - Returns vehicle listings with pricing data
   - System calculates average price from listings

2. **Valuation Endpoint**: `https://api.marketcheck.com/v1/valuation?vin={vin}&api_key={api_key}`
   - Returns direct valuation data
   - Used as fallback if search endpoint doesn't provide sufficient data

### API Endpoints

- `GET /api/vehicle/pricing/:vin` - Fetch vehicle pricing from MarketCheck API
- Requires authentication
- Returns: `{ estimatedValue: number, source: string, lastUpdated: string }`

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env`:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   MARKETCHECK_API_KEY=your_marketcheck_api_key
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   BASE_URL=http://localhost:3000
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

## API Documentation

### Vehicle Pricing

The vehicle pricing endpoint fetches real-time data from MarketCheck API:

```javascript
// Example request
GET /api/vehicle/pricing/1HGBH41JXMN109186

// Example response
{
  "success": true,
  "data": {
    "estimatedValue": 25000,
    "source": "MarketCheck API",
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Handling

If MarketCheck API is unavailable or returns invalid data, the system will return an appropriate error message:

```javascript
{
  "success": false,
  "error": "Failed to get valid pricing data from MarketCheck API for this VIN"
}
```

## Troubleshooting

### MarketCheck API Issues

1. **Invalid API Key**: Ensure your `MARKETCHECK_API_KEY` is correct and active
2. **Rate Limiting**: MarketCheck API has rate limits. Check your API usage
3. **Invalid VIN**: Ensure the VIN is valid and properly formatted
4. **Network Issues**: Check your internet connection and firewall settings

### Common Error Messages

- `MarketCheck API key not configured`: Add `MARKETCHECK_API_KEY` to your `.env` file
- `MarketCheck API request failed`: Check your API key and network connection
- `No pricing data available`: The VIN may not be found in MarketCheck's database

## Support

For issues with MarketCheck API integration, contact MarketCheck support or check their API documentation.

For VOS system issues, check the application logs or contact the development team. 