// Test script for MarketCheck API integration
require('dotenv').config();
const axios = require('axios');

const fetchMarketCheckPricing = async (vin) => {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) throw new Error('No API key set');

  // 1. Try MarketCheck's vehicle specs endpoint first
  const specsUrl = `https://mc-api.marketcheck.com/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${apiKey}`;
  console.log('Trying specs endpoint:', specsUrl);
  try {
    const response = await axios.get(specsUrl);
    const data = response.data;
    console.log('MarketCheck specs response:', JSON.stringify(data, null, 2));
    
    // Extract vehicle specs for pricing
    const {
      year,
      make,
      model,
      trim,
      transmission,
      drivetrain,
      fuel_type,
      highway_mpg,
      city_mpg,
      engine_size,
      engine_block,
      cylinders,
      doors
    } = data;

    // 2. Try MarketCheck's price prediction endpoint
    const transmissionLower = transmission ? transmission.toLowerCase() : '';
    
    // Build query parameters, only including valid values
    const queryParams = new URLSearchParams({
      api_key: apiKey,
      car_type: "used",
      year: year || '',
      make: make || '',
      model: model || '',
      trim: trim || '',
      transmission: transmissionLower === "manual" ? "Manual" : "Automatic",
      drivetrain: drivetrain?.toLowerCase() === "fwd" ? "FWD" : drivetrain || '',
      fuel_type: fuel_type || '',
      latitude: 41.149358, // Default location
      longitude: -96.145336, // Default location
      miles: 20000 // Default mileage
    });
    
    // Only add engine parameters if they have valid values
    if (highway_mpg && !isNaN(parseInt(highway_mpg))) queryParams.append('highway_mpg', highway_mpg);
    if (city_mpg && !isNaN(parseInt(city_mpg))) queryParams.append('city_mpg', city_mpg);
    if (doors && !isNaN(parseInt(doors))) queryParams.append('doors', doors);
    
    // Extract engine size from engine string (e.g., "2.5L I4" -> "2.5")
    if (data.engine) {
      const engineMatch = data.engine.match(/(\d+\.?\d*)L/);
      if (engineMatch) {
        queryParams.append('engine_size', engineMatch[1]);
      }
    }

    const priceUrl = `https://mc-api.marketcheck.com/v2/predict/car/price?${queryParams.toString()}`;
    console.log('Trying price prediction endpoint:', priceUrl);
    
    const priceResponse = await axios.get(priceUrl);
    const priceData = priceResponse.data;
    console.log('MarketCheck price response:', JSON.stringify(priceData, null, 2));
    
    if (priceData?.price_range?.lower_bound) {
      return { 
        estimatedValue: parseFloat(priceData.price_range.lower_bound), 
        source: 'MarketCheck API (Price Prediction)',
        priceRange: priceData.price_range
      };
    }
  } catch (error) {
    console.error('Specs/Price endpoint error:', error.response?.data || error.message);
  }

  // 3. Try MarketCheck's vehicle history endpoint
  const historyUrl = `https://mc-api.marketcheck.com/v2/history/car/${encodeURIComponent(vin)}?api_key=${apiKey}`;
  console.log('Trying history endpoint:', historyUrl);
  try {
    const response = await axios.get(historyUrl);
    const data = response.data;
    console.log('MarketCheck history response:', JSON.stringify(data, null, 2));
    
    if (data && Array.isArray(data) && data.length > 0) {
      // Filter out unrealistic prices (e.g., > $100k for most vehicles)
      const realisticListings = data.filter(listing => {
        const price = parseFloat(listing.price);
        return price && price > 1000 && price < 100000; // Reasonable price range
      });
      
      if (realisticListings.length > 0) {
        // Get the most recent realistic listing
        const latestListing = realisticListings[0];
        return { 
          estimatedValue: parseFloat(latestListing.price), 
          source: 'MarketCheck API (Vehicle History)',
          listing: latestListing
        };
      }
    }
  } catch (error) {
    console.error('History endpoint error:', error.response?.data || error.message);
  }

  // 4. Try MarketCheck's search endpoint
  const searchUrl = `https://mc-api.marketcheck.com/v2/search/car/active?api_key=${apiKey}&vin=${encodeURIComponent(vin)}`;
  console.log('Trying search endpoint:', searchUrl);
  try {
    const response = await axios.get(searchUrl);
    const data = response.data;
    console.log('MarketCheck search response:', JSON.stringify(data, null, 2));
    
    if (data && data.listings && data.listings.length > 0) {
      const prices = data.listings
        .filter(listing => {
          const price = parseFloat(listing.price);
          return price && price > 1000 && price < 100000; // Reasonable price range
        })
        .map(listing => parseFloat(listing.price));
      
      if (prices.length > 0) {
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        return { 
          estimatedValue: Math.round(averagePrice), 
          source: 'MarketCheck API (Active Listings)'
        };
      }
    }
  } catch (error) {
    console.error('Search endpoint error:', error.response?.data || error.message);
  }

  throw new Error('No pricing data available from MarketCheck API');
};

// Test with a more realistic VIN (Toyota Camry)
const testVIN = process.argv[2] || '4T1B11HK5JU123456'; // Sample Toyota Camry VIN

console.log('=== MarketCheck API Test ===');
console.log('Environment check:');
console.log('- MARKETCHECK_API_KEY:', process.env.MARKETCHECK_API_KEY ? 'Set' : 'Not set');
console.log('- Test VIN:', testVIN);
console.log('');

fetchMarketCheckPricing(testVIN)
  .then(result => {
    console.log('✅ SUCCESS: MarketCheck API integration working');
    console.log('Result:', result);
  })
  .catch(error => {
    console.error('❌ ERROR: MarketCheck API integration failed');
    console.error('Error:', error.message);
    process.exit(1);
  }); 