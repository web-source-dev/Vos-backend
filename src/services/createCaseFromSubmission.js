const VehicleSubmission = require('../models/customer/customer');
const Case = require('../models/Case');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

/**
 * Creates a Case, Customer, and Vehicle record from a customer submission
 * @param {string} submissionId - The _id of the VehicleSubmission
 * @param {string} createdBy - The user ID who is creating the case
 * @param {string} agentId - The agent ID assigned to the case (optional)
 * @returns {Object} - Object containing the created case, customer, and vehicle
 */
const createCaseFromSubmission = async (submissionId, agentId = null) => {
  try {
    // Find the customer submission
    const submission = await VehicleSubmission.findById(submissionId);
    
    if (!submission) {
      throw new Error('Customer submission not found');
    }

    const user = await User.findOne({email: submission.contact?.email});
    
    const createdBy = user?._id;

    // Create Customer record
    const customerData = {
      firstName: user?.firstName || '', // Will be extracted from contact info if available
      lastName: user?.lastName || '', // Will be extracted from contact info if available
      cellPhone: submission.contact?.mobile || '',
      email1: submission.contact?.email || '',
      source: 'online', // Default source for online submissions
      agent: agentId,
      createdAt: new Date()
    };

    const customer = new Customer(customerData);
    await customer.save();

    // Create Vehicle record
    const vehicleData = {
      customer: customer._id,
      year: submission.vinOrPlate?.year?.toString() || '',
      make: submission.vinOrPlate?.make || '',
      model: submission.vinOrPlate?.model || '',
      currentMileage: submission.basics?.mileage?.toString() || '',
      vin: submission.vinOrPlate?.vin || '',
      color: submission.basics?.color || '',
      bodyStyle: '', // Not available in submission
      licensePlate: submission.vinOrPlate?.licensePlate || '',
      licenseState: '', // Not available in submission
      titleNumber: '', // Not available in submission
      titleStatus: 'clean', // Default value
      loanStatus: submission.basics?.loanLeaseStatus === 'loan' ? 'still-has-loan' : 
                  submission.basics?.loanLeaseStatus === 'lease' ? 'still-has-loan' : 'paid-off',
      loanAmount: submission.basics?.loanDetails?.loanBalance || 
                  submission.basics?.leaseDetails?.leasePayoff || 0,
      secondSetOfKeys: submission.condition?.keyCount > 1,
      hasTitleInPossession: submission.ownership?.titleVerified || false,
      titleInOwnName: submission.ownership?.titleVerified || false,
      knownDefects: submission.condition?.mechanicalIssues?.join(', ') || 
                   submission.condition?.engineIssues?.join(', ') || 
                   submission.condition?.exteriorDamage?.join(', ') || '',
      estimatedValue: submission.vinOrPlate?.estimatedPrice || 0,
      pricingSource: 'submission',
      pricingLastUpdated: new Date(),
      isElectric: false, // Default value
      createdAt: new Date()
    };

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    // Create Case record
    const caseData = {
      customer: customer._id,
      vehicle: vehicle._id,
      currentStage: 2,
      stageStatuses: {
        1: 'complete',
        2: 'active',
        3: 'pending',
        4: 'pending',
        5: 'pending',
        6: 'pending'
      },
      status: 'new',
      priority: 'medium',
      estimatedValue: submission.vinOrPlate?.estimatedPrice || 0,
      thankYouSent: false,
      completion: {
        thankYouSent: false,
        leaveBehinds: {
          vehicleLeft: false,
          keysHandedOver: false,
          documentsReceived: false
        },
        pdfGenerated: false,
        titleConfirmation: false
      },
      lastActivity: {
        description: 'Case created from customer submission',
        timestamp: new Date()
      },
      createdBy: createdBy,
      updatedBy: [{
        user: createdBy,
        timestamp: new Date()
      }],
      estimatorId: agentId,
      createdAt: new Date()
    };

    const caseRecord = new Case(caseData);
    await caseRecord.save();

    return {
      case: caseRecord,
      customer: customer,
      vehicle: vehicle,
      submission: submission
    };

  } catch (error) {
    console.error('Error creating case from submission:', error);
    throw error;
  }
};

module.exports = createCaseFromSubmission;
