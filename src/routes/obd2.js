const express = require('express');
const router = express.Router();
const { 
  getAllOBD2Codes, 
  getOBD2Code, 
  createOBD2Code, 
  updateOBD2Code, 
  deleteOBD2Code,
  parseOBD2PDF,
  bulkImportOBD2Codes
} = require('../controllers/obd2');
// Get all OBD2 codes
router.get('/', getAllOBD2Codes);

// Get single OBD2 code
router.get('/:id', getOBD2Code);

// Parse OBD2 PDF
router.post('/parse-pdf', parseOBD2PDF);


// Create new OBD2 code
router.post('/', createOBD2Code);

// Update OBD2 code
router.put('/:id', updateOBD2Code);

// Delete OBD2 code
router.delete('/:id', deleteOBD2Code);

module.exports = router; 