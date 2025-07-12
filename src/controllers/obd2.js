const OBD2Code = require('../models/OBD2Code');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');

// Regular expression to find OBD2 codes in text
// Most common format is a letter followed by 4 digits (e.g., P0301)
const OBD2_CODE_REGEX = /([PBCU][0-9]{4})/gi;

/**
 * Get all OBD2 codes
 * @route GET /api/obd2
 * @access Private
 */
exports.getAllOBD2Codes = async (req, res) => {
  try {
    // Support search, sorting, and pagination
    const search = req.query.search || '';
    const sort = req.query.sort || 'code';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (search) {
      query = { 
        $or: [
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ] 
      };
    }

    // Execute query with pagination
    const codes = await OBD2Code.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await OBD2Code.countDocuments(query);

    res.status(200).json({
      success: true,
      count: codes.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: codes
    });
  } catch (error) {
    console.error('Error getting OBD2 codes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Get single OBD2 code
 * @route GET /api/obd2/:id
 * @access Private
 */
exports.getOBD2Code = async (req, res) => {
  try {
    const code = await OBD2Code.findById(req.params.id);

    if (!code) {
      return res.status(404).json({
        success: false,
        error: 'OBD2 code not found'
      });
    }

    res.status(200).json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting OBD2 code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Create new OBD2 code
 * @route POST /api/obd2
 * @access Private (Admin)
 */
exports.createOBD2Code = async (req, res) => {
  try {
    const { code, description, codeType, commonCauses, criticality, estimatedRepairCost } = req.body;

    // Validate required fields
    if (!code || !description || !criticality) {
      return res.status(400).json({
        success: false,
        error: 'Code, description, and criticality are required'
      });
    }

    // Check if code already exists
    const existingCode = await OBD2Code.findOne({ code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        error: 'Code already exists'
      });
    }

    // Create OBD2 code
    const obd2Code = await OBD2Code.create({
      code: code.toUpperCase(), // Store codes in uppercase
      description,
      codeType,
      commonCauses,
      criticality,
      estimatedRepairCost: estimatedRepairCost || ''
    });

    res.status(201).json({
      success: true,
      data: obd2Code
    });
  } catch (error) {
    console.error('Error creating OBD2 code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Update OBD2 code
 * @route PUT /api/obd2/:id
 * @access Private (Admin)
 */
exports.updateOBD2Code = async (req, res) => {
  try {
    const { description, codeType, commonCauses, criticality, estimatedRepairCost } = req.body;

    // Find and update
    const obd2Code = await OBD2Code.findByIdAndUpdate(
      req.params.id, 
      { description, codeType, commonCauses, criticality, estimatedRepairCost, updatedAt: Date.now() }, 
      { new: true, runValidators: true }
    );

    if (!obd2Code) {
      return res.status(404).json({
        success: false,
        error: 'OBD2 code not found'
      });
    }

    res.status(200).json({
      success: true,
      data: obd2Code
    });
  } catch (error) {
    console.error('Error updating OBD2 code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Delete OBD2 code
 * @route DELETE /api/obd2/:id
 * @access Private (Admin)
 */
exports.deleteOBD2Code = async (req, res) => {
  try {
    const obd2Code = await OBD2Code.findByIdAndDelete(req.params.id);

    if (!obd2Code) {
      return res.status(404).json({
        success: false,
        error: 'OBD2 code not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting OBD2 code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Parse OBD2 PDF and extract codes
 * @route POST /api/obd2/parse-pdf
 * @access Private
 */
exports.parseOBD2PDF = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log(req.files);
    const file = req.files.file;
    
    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        error: 'Only PDF files are allowed'
      });
    }

    // Create directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../uploads/obd2');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Save the file
    await file.mv(filePath);

    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Parse the PDF
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    // Extract OBD2 codes
    const codes = pdfText.match(OBD2_CODE_REGEX) || [];
    
    // Remove duplicates and convert to uppercase
    const uniqueCodes = [...new Set(codes.map(code => code.toUpperCase()))];
    
    // Find these codes in the database
    const matchingCodes = await OBD2Code.find({
      code: { $in: uniqueCodes }
    });
    
    // Find codes not in the database
    const knownCodes = matchingCodes.map(codeObj => codeObj.code);
    const unknownCodes = uniqueCodes.filter(code => !knownCodes.includes(code));

    // Return the result
    res.status(200).json({
      success: true,
      data: {
        filePath: `/uploads/obd2/${uniqueFilename}`,
        filename: uniqueFilename,
        extractedCodes: uniqueCodes,
        matchingCodes,
        unknownCodes,
        totalCodesFound: uniqueCodes.length,
        criticalCodesFound: matchingCodes.filter(code => code.criticality >= 4).length,
      }
    });
  } catch (error) {
    console.error('Error parsing OBD2 PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Error parsing PDF'
    });
  }
};

/**
 * Upload OBD2 scan PDF to a specific case and process it
 * @route POST /api/cases/:caseId/obd2-scan
 * @access Private
 */
exports.uploadOBD2ScanToCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.files.file;
    
    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        error: 'Only PDF files are allowed'
      });
    }

    // Create directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../uploads/obd2');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueFilename = `case-${caseId}-obd2-${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Save the file
    await file.mv(filePath);

    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Parse the PDF
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    // Extract OBD2 codes
    const codes = pdfText.match(OBD2_CODE_REGEX) || [];
    
    // Remove duplicates and convert to uppercase
    const uniqueCodes = [...new Set(codes.map(code => code.toUpperCase()))];
    
    // Find these codes in the database
    const matchingCodes = await OBD2Code.find({
      code: { $in: uniqueCodes }
    });
    
    // Find codes not in the database
    const knownCodes = matchingCodes.map(codeObj => codeObj.code);
    const unknownCodes = uniqueCodes.filter(code => !knownCodes.includes(code));

    // Find the case and its associated quote
    const Case = require('../models/Case');
    const Quote = require('../models/Quote');
    
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Find or create quote for this case
    let quote = await Quote.findOne({ caseId: caseId });
    if (!quote) {
      // Create a new quote if none exists
      quote = await Quote.create({
        caseId: caseId,
        status: 'draft'
      });
      
      // Update the case with the quote reference
      await Case.findByIdAndUpdate(caseId, { quote: quote._id });
    }

    // Update the quote with OBD2 scan information
    const updatedQuote = await Quote.findByIdAndUpdate(
      quote._id,
      {
        obd2Scan: {
          scanDate: new Date(),
          filePath: `/uploads/obd2/${uniqueFilename}`,
          extractedCodes: uniqueCodes,
          criticalCodes: matchingCodes.filter(code => code.criticality >= 4).map(code => ({
            code: code.code,
            description: code.description,
            criticality: code.criticality,
            estimatedRepairCost: code.estimatedRepairCost || ''
          }))
        }
      },
      { new: true }
    );

    // Return the result
    res.status(200).json({
      success: true,
      data: {
        filePath: `/uploads/obd2/${uniqueFilename}`,
        filename: uniqueFilename,
        extractedCodes: uniqueCodes,
        matchingCodes,
        unknownCodes,
        totalCodesFound: uniqueCodes.length,
        criticalCodesFound: matchingCodes.filter(code => code.criticality >= 4).length,
      }
    });
  } catch (error) {
    console.error('Error uploading OBD2 scan:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing OBD2 scan'
    });
  }
}; 