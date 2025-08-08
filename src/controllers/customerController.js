const VehicleSubmission = require('../models/customer/customer');
const axios = require('axios');
const { getVehicleSpecs, getVehiclePricing } = require('./allcontrollers');
const { uploadToCloudinary } = require('../config/cloudinary');
const multer = require('multer');

// Helper function to get vehicle data from VIN using the existing getVehicleSpecs and getVehiclePricing
const getVehicleDataFromVIN = async (vin) => {
  try {
    console.log(`Fetching vehicle data and pricing for VIN: ${vin}`);
    
    // Create a mock request/response to use the existing functions
    const mockReq = { params: { vin } };
    let specsData = null;
    let pricingData = null;
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          return mockRes;
        }
      }),
      json: (data) => {
        return mockRes;
      }
    };
    
    // First, get vehicle specs
    const specsRes = {
      status: (code) => ({
        json: (data) => {
          specsData = data;
          return specsRes;
        }
      }),
      json: (data) => {
        specsData = data;
        return specsRes;
      }
    };
    
    await getVehicleSpecs(mockReq, specsRes);
    
    // Then, get vehicle pricing
    const pricingRes = {
      status: (code) => ({
        json: (data) => {
          pricingData = data;
          return pricingRes;
        }
      }),
      json: (data) => {
        pricingData = data;
        return pricingRes;
      }
    };
    
    try {
      await getVehiclePricing(mockReq, pricingRes);
    } catch (pricingError) {
      console.warn('Could not fetch pricing data:', pricingError.message);
      // Continue without pricing data
    }
    
    // Combine specs and pricing data
    let result = {
      make: '',
      model: '',
      year: 0,
      trim: '',
      transmission: '',
      estimatedPrice: 0
    };
    
    if (specsData && specsData.success && specsData.data) {
      const specs = specsData.data;
      result = {
        make: specs.make || '',
        model: specs.model || '',
        year: specs.year ? parseInt(specs.year) : 0,
        trim: specs.trim || '',
        transmission: specs.transmission || '',
        estimatedPrice: 0
      };
    }
    
    if (pricingData && pricingData.success && pricingData.data && pricingData.data.estimatedValue) {
      result.estimatedPrice = pricingData.data.estimatedValue;
      console.log(`Found estimated price: $${result.estimatedPrice}`);
    }
    
    if (result.make && result.model && result.year) {
      return result;
    } else {
      console.warn('API returned incomplete data, using fallback');
      return getFallbackVehicleData(vin);
    }
  } catch (error) {
    console.error('Error calling vehicle APIs:', error);
    return getFallbackVehicleData(vin);
  }
};

// Fallback function when API is not available
const getFallbackVehicleData = (vin) => {
  // Simple VIN pattern matching for demo purposes
  const vinUpper = vin.toUpperCase();
  
  if (vinUpper.includes('1HGBH41JXMN109186')) {
    return { make: 'Honda', model: 'Civic', year: 2021, trim: 'LX', transmission: 'CVT', estimatedPrice: 22000 };
  } else if (vinUpper.startsWith('WBA')) {
    return { make: 'BMW', model: '328i', year: 2018, trim: 'Sport', transmission: 'Automatic', estimatedPrice: 28000 };
  } else if (vinUpper.startsWith('1FT')) {
    return { make: 'Ford', model: 'F-150', year: 2020, trim: 'XLT', transmission: 'Automatic', estimatedPrice: 35000 };
  } else if (vinUpper.startsWith('1G1')) {
    return { make: 'Chevrolet', model: 'Malibu', year: 2019, trim: 'LT', transmission: 'Automatic', estimatedPrice: 18000 };
  } else if (vinUpper.startsWith('JM1')) {
    return { make: 'Mazda', model: 'CX-5', year: 2020, trim: 'Sport', transmission: 'Automatic', estimatedPrice: 26000 };
  } else if (vinUpper.startsWith('1N4')) {
    return { make: 'Nissan', model: 'Altima', year: 2019, trim: 'S', transmission: 'CVT', estimatedPrice: 19000 };
  } else if (vinUpper.startsWith('JTDBT')) {
    return { make: 'Toyota', model: 'Prius', year: 2018, trim: 'L', transmission: 'CVT', estimatedPrice: 21000 };
  }
  
  return {
    make: 'Unknown',
    model: 'Unknown',
    year: new Date().getFullYear() - 5,
    trim: 'Base',
    transmission: 'Automatic',
    estimatedPrice: 15000 // Default estimated price for unknown vehicles
  };
};

// Create initial vehicle submission with VIN or License Plate
exports.createVehicleSubmission = async (req, res) => {
  try {
    console.log('Creating vehicle submission with request body:', req.body);
    const { type, value, state, vehicleSpecs } = req.body; // type: 'vin' or 'license', value: the actual VIN/plate, vehicleSpecs: from MarketCheck API
    
    if (!type || !value) {
      console.log('Missing required fields - type:', type, 'value:', value);
      return res.status(400).json({
        success: false,
        error: 'Type and value are required'
      });
    }

    // Check if a submission with this VIN/license plate already exists
    let existingSubmission = null;
    if (type === 'vin') {
      existingSubmission = await VehicleSubmission.findOne({ 'vinOrPlate.vin': value.toUpperCase() });
    } else if (type === 'license') {
      existingSubmission = await VehicleSubmission.findOne({ 'vinOrPlate.licensePlate': value.toUpperCase() });
    }

    if (existingSubmission) {
      console.log('Found existing submission with ID:', existingSubmission._id);
      const responseData = {
        id: existingSubmission._id.toString(),
        ...existingSubmission.toObject()
      };
      return res.status(200).json({
        success: true,
        data: responseData
      });
    }

    let vehicleData = {};
    
    if (type === 'vin') {
      // Validate VIN format (17 characters)
      if (value.length !== 17) {
        return res.status(400).json({
          success: false,
          error: 'VIN must be 17 characters long'
        });
      }
      
      // Use vehicle specs from frontend if available, otherwise fetch from API
      let apiData = null;
      if (vehicleSpecs && vehicleSpecs.year && vehicleSpecs.make && vehicleSpecs.model) {
        apiData = {
          make: vehicleSpecs.make,
          model: vehicleSpecs.model,
          year: parseInt(vehicleSpecs.year) || 0,
          trim: vehicleSpecs.trim || '',
          transmission: vehicleSpecs.transmission || '',
          estimatedPrice: vehicleSpecs.estimatedPrice || 0
        };
      } else {
        // Fallback to our internal API call which includes pricing
        apiData = await getVehicleDataFromVIN(value);
      }
      
      vehicleData.vinOrPlate = {
        vin: value.toUpperCase(),
        make: apiData?.make || '',
        model: apiData?.model || '',
        year: apiData?.year || 0,
        trim: apiData?.trim || '',
        transmission: apiData?.transmission || '',
        licensePlate: '',
        estimatedPrice: apiData?.estimatedPrice || 0
      };
    } else if (type === 'license') {
      vehicleData.vinOrPlate = {
        vin: '',
        make: '',
        model: '',
        year: 0,
        trim: '',
        transmission: '',
        licensePlate: value.toUpperCase(),
        estimatedPrice: 0
      };
    }

    // Add state if provided
    if (state) {
      vehicleData.saleConfirmation = {
        state: state
      };
    }

    console.log('Creating submission with vehicle data:', vehicleData);
    const submission = new VehicleSubmission(vehicleData);
    await submission.save();
    console.log('Submission saved successfully with ID:', submission._id);

    const responseData = {
      id: submission._id.toString(),
      ...submission.toObject()
    };
    console.log('Sending response data:', responseData);

    res.status(201).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error creating vehicle submission:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating vehicle submission'
    });
  }
};

// Update vehicle info (make, model, year)
exports.updateVehicleInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { make, model, year } = req.body;

    const updateData = {};
    if (make !== undefined) updateData['vinOrPlate.make'] = make;
    if (model !== undefined) updateData['vinOrPlate.model'] = model;
    if (year !== undefined) updateData['vinOrPlate.year'] = year;

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating vehicle info:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating vehicle info'
    });
  }
};

// Update vehicle basics (Step 2)
exports.updateVehicleBasics = async (req, res) => {
  try {
    const { id } = req.params;
    const basicsData = req.body;

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { 
        $set: { 
          basics: basicsData 
        }
      },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating vehicle basics:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating vehicle basics'
    });
  }
};

// Update vehicle condition (Step 3)
exports.updateVehicleCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const conditionData = req.body;

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { 
        $set: { 
          condition: conditionData 
        }
      },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating vehicle condition:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating vehicle condition'
    });
  }
};

// Get vehicle submission by ID
exports.getVehicleSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await VehicleSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error fetching vehicle submission:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching vehicle submission'
    });
  }
};

// Get all vehicle submissions (for admin/agent use)
exports.getAllVehicleSubmissions = async (req, res) => {
  try {
    const submissions = await VehicleSubmission.find()
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 submissions

    res.json({
      success: true,
      count: submissions.length,
      data: submissions
    });

  } catch (error) {
    console.error('Error fetching vehicle submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching vehicle submissions'
    });
  }
};

// Update contact email and generate offer (Step 4)
exports.updateContactAndGenerateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find the submission
    const submission = await VehicleSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    // Generate offer amount based on vehicle data and condition
    const offerAmount = generateOfferAmount(submission);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Update submission with email and offer
    const updatedSubmission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { 
        $set: { 
          'contact.email': email,
          'offer.amount': offerAmount,
          'offer.expiresAt': expiresAt,
          'offer.generated': true,
          'offer.generatedAt': new Date()
        }
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedSubmission
    });

  } catch (error) {
    console.error('Error updating contact and generating offer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating contact and generating offer'
    });
  }
};

// Helper function to generate offer amount
const generateOfferAmount = (submission) => {
  let baseAmount = 15000; // Default base amount
  
  // Use estimated price from VIN decode if available
  if (submission.vinOrPlate && submission.vinOrPlate.estimatedPrice > 0) {
    baseAmount = submission.vinOrPlate.estimatedPrice;
  }
  
  // Adjust based on mileage
  if (submission.basics && submission.basics.mileage) {
    const mileage = submission.basics.mileage;
    if (mileage < 30000) {
      baseAmount *= 1.1; // 10% bonus for low mileage
    } else if (mileage > 100000) {
      baseAmount *= 0.9; // 10% reduction for high mileage
    }
  }
  
  // Adjust based on overall condition
  if (submission.condition && submission.condition.overallCondition) {
    const condition = submission.condition.overallCondition;
    switch (condition) {
      case 'Like New':
        baseAmount *= 1.15;
        break;
      case 'Pretty Great':
        baseAmount *= 1.05;
        break;
      case 'Just Okay':
        baseAmount *= 0.95;
        break;
      case 'Kind of Rough':
        baseAmount *= 0.85;
        break;
      case 'Major Issues':
        baseAmount *= 0.7;
        break;
    }
  }
  
  // Adjust based on accident history
  if (submission.condition && submission.condition.accidentHistory) {
    const accidents = submission.condition.accidentHistory;
    if (accidents === '1 Accident') {
      baseAmount *= 0.95;
    } else if (accidents === '2 or More Accidents') {
      baseAmount *= 0.85;
    }
  }
  
  // Adjust based on drivability
  if (submission.condition && submission.condition.isDrivable === false) {
    baseAmount *= 0.8;
  }
  
  // Adjust for mechanical issues
  if (submission.condition && submission.condition.mechanicalIssues && submission.condition.mechanicalIssues.length > 0) {
    if (!submission.condition.mechanicalIssues.includes('No Mechanical or Electrical Issues')) {
      baseAmount *= 0.9;
    }
  }
  
  // Adjust for engine issues
  if (submission.condition && submission.condition.engineIssues && submission.condition.engineIssues.length > 0) {
    if (!submission.condition.engineIssues.includes('No Engine Issues')) {
      baseAmount *= 0.9;
    }
  }
  
  // Round to nearest 100
  return Math.round(baseAmount / 100) * 100;
};

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB field size limit
    fields: 10,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('File received:', file.originalname, file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload ownership verification photos
exports.uploadOwnershipPhoto = async (req, res) => {
  // Use multer middleware manually to better handle errors
  upload.single('photo')(req, res, async (err) => {
    try {
      const { submissionId, type } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No photo file provided'
        });
      }

      if (!submissionId || !type) {
        return res.status(400).json({
          success: false,
          error: 'Submission ID and photo type are required'
        });
      }

      if (!['odometer', 'photoID'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid photo type. Must be "odometer" or "photoID"'
        });
      }

      // Find the submission
      const submission = await VehicleSubmission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle submission not found'
        });
      }

      // Check Cloudinary configuration
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.error('Cloudinary configuration missing');
        return res.status(500).json({
          success: false,
          error: 'Cloudinary configuration missing. Please check environment variables.'
        });
      }

      // Upload to Cloudinary
      const uploadOptions = {
        folder: `vos-ownership-verification/${submissionId}`,
        public_id: `${type}_${Date.now()}`,
        transformation: [
          { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
        ]
      };

      console.log(`Uploading ${type} photo to Cloudinary for submission ${submissionId}`);
      console.log('File size:', req.file.size, 'bytes');
      console.log('File mimetype:', req.file.mimetype);
      
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, uploadOptions);
      
      console.log('Cloudinary upload successful:', cloudinaryResult.secure_url);

      // Update the submission with the photo URL
      const updateField = type === 'odometer' ? 'ownership.odometerPhoto' : 'ownership.photoID';
      const updatedSubmission = await VehicleSubmission.findByIdAndUpdate(
        submissionId,
        { 
          $set: { 
            [updateField]: cloudinaryResult.secure_url,
            'ownership.titleVerified': true // Auto-verify title when photos are uploaded
          }
        },
        { new: true, runValidators: true }
      );

      console.log(`${type} photo uploaded and submission updated successfully`);

      res.json({
        success: true,
        data: {
          photoUrl: cloudinaryResult.secure_url,
          submission: updatedSubmission
        }
      });

    } catch (error) {
      console.error('Error uploading ownership photo:', error);
      
      // Handle multer errors
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size too large. Maximum size is 10MB'
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Server error while uploading photo'
      });
    }
  });
};

// Update payout method (Step 9)
exports.updatePayoutMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { payoutMethod } = req.body;

    if (!payoutMethod) {
      return res.status(400).json({
        success: false,
        error: 'Payout method is required'
      });
    }

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { 
        $set: { 
          payoutMethod: payoutMethod
        }
      },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating payout method:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating payout method'
    });
  }
};

// Update appointment details (Step 10)
exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentType, appointmentDateTime, address, notes } = req.body;

    if (!appointmentType || !appointmentDateTime) {
      return res.status(400).json({
        success: false,
        error: 'Appointment type and date/time are required'
      });
    }

    const updateData = {
      'appointment.type': appointmentType,
      'appointmentDateTime': new Date(appointmentDateTime)
    };

    // Add address if provided (for any appointment type)
    if (address) {
      updateData['appointment.address'] = address;
    }

    // Add notes if provided
    if (notes) {
      updateData['appointment.notes'] = notes;
    }

    console.log('Updating appointment with data:', updateData);
    console.log('Request body:', req.body);

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    console.log('Appointment saved successfully:', {
      appointmentType: submission.appointment?.type,
      appointmentDateTime: submission.appointmentDateTime,
      address: submission.appointment?.address,
      notes: submission.appointment?.notes
    });

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating appointment'
    });
  }
};

// Update mobile number for customer communication
exports.updateMobile = async (req, res) => {
  try {
    const { id } = req.params;
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number is required'
      });
    }

    // Validate mobile number format (10 digits)
    const mobileDigits = mobile.replace(/\D/g, '');
    if (mobileDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number must be 10 digits'
      });
    }

    const submission = await VehicleSubmission.findByIdAndUpdate(
      id,
      { 
        $set: { 
          'contact.mobile': mobileDigits
        }
      },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error updating mobile number:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating mobile number'
    });
  }
};

// Get vehicle submissions by customer email
exports.getVehicleSubmissionsByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const submissions = await VehicleSubmission.find({ 
      'contact.email': email 
    })
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: submissions.length,
      data: submissions
    });

  } catch (error) {
    console.error('Error fetching customer submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching customer submissions'
    });
  }
};
