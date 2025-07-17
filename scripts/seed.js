const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Import models
const User = require('../src/models/User');
const Customer = require('../src/models/Customer');
const Vehicle = require('../src/models/Vehicle');
const Case = require('../src/models/Case');
const Inspection = require('../src/models/Inspection');
const Quote = require('../src/models/Quote');
const Transaction = require('../src/models/Transaction');
const OBD2Code = require('../src/models/OBD2Code');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vos', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Sample data arrays
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria', 'William', 'Jennifer', 'Richard', 'Linda', 'Thomas', 'Patricia', 'Christopher', 'Barbara', 'Daniel', 'Elizabeth'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus', 'Acura', 'Infiniti', 'Buick', 'Cadillac', 'Chrysler', 'Dodge'];
const models = {
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', 'Prius', 'Avalon'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 'Ridgeline', 'Insight'],
  'Ford': ['F-150', 'Escape', 'Explorer', 'Mustang', 'Focus', 'Fusion', 'Edge', 'Ranger'],
  'Chevrolet': ['Silverado', 'Equinox', 'Malibu', 'Camaro', 'Tahoe', 'Suburban', 'Colorado', 'Traverse'],
  'Nissan': ['Altima', 'Sentra', 'Rogue', 'Murano', 'Pathfinder', 'Frontier', 'Titan', 'Maxima']
};
const colors = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Beige'];
const bodyStyles = ['Sedan', 'SUV', 'Truck', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Van', 'Minivan'];
const sources = ['contact_form', 'walk_in', 'phone', 'online', 'on_the_road', 'social_media', 'other'];
const locations = ['Downtown', 'Northside', 'Southside', 'Eastside', 'Westside', 'Central'];
const years = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'];

// OBD2 Codes data
const obd2Codes = [
  { code: 'P0300', description: 'Random/Multiple Cylinder Misfire Detected', codeType: 'Powertrain', commonCauses: 'Faulty spark plugs, ignition coils, fuel injectors', criticality: 4, estimatedRepairCost: '$150 - $500' },
  { code: 'P0171', description: 'System Too Lean (Bank 1)', codeType: 'Powertrain', commonCauses: 'Vacuum leak, faulty MAF sensor, fuel pressure', criticality: 3, estimatedRepairCost: '$100 - $300' },
  { code: 'P0420', description: 'Catalyst System Efficiency Below Threshold (Bank 1)', codeType: 'Powertrain', commonCauses: 'Faulty catalytic converter, oxygen sensors', criticality: 4, estimatedRepairCost: '$500 - $1500' },
  { code: 'P0128', description: 'Coolant Thermostat Temperature Below Regulating Temperature', codeType: 'Powertrain', commonCauses: 'Faulty thermostat, low coolant level', criticality: 2, estimatedRepairCost: '$50 - $200' },
  { code: 'P0442', description: 'Evaporative Emission Control System Leak Detected (Small Leak)', codeType: 'Powertrain', commonCauses: 'Loose gas cap, faulty purge valve', criticality: 2, estimatedRepairCost: '$20 - $150' },
  { code: 'P0506', description: 'Idle Control System RPM Lower Than Expected', codeType: 'Powertrain', commonCauses: 'Dirty throttle body, faulty IAC valve', criticality: 2, estimatedRepairCost: '$80 - $250' },
  { code: 'P0700', description: 'Transmission Control System Malfunction', codeType: 'Powertrain', commonCauses: 'Faulty transmission control module', criticality: 5, estimatedRepairCost: '$300 - $1000' },
  { code: 'P1000', description: 'OBD System Readiness Test Not Complete', codeType: 'Powertrain', commonCauses: 'Recent battery disconnect, incomplete drive cycle', criticality: 1, estimatedRepairCost: 'No cost - drive cycle needed' },
  { code: 'B0001', description: 'Driver Airbag Circuit Short to Ground', codeType: 'Body', commonCauses: 'Faulty airbag module, wiring issue', criticality: 5, estimatedRepairCost: '$200 - $800' },
  { code: 'C0035', description: 'Left Front Wheel Speed Sensor Circuit Malfunction', codeType: 'Chassis', commonCauses: 'Faulty wheel speed sensor, wiring issue', criticality: 3, estimatedRepairCost: '$100 - $300' }
];

// Helper functions
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randomMileage = () => randomNumber(50000, 150000);
const randomVIN = () => '1HGBH41JXMN109' + randomNumber(100, 999);
const randomLicensePlate = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  return randomElement(letters) + randomElement(letters) + randomNumber(100, 999) + randomElement(letters) + randomElement(letters);
};

// Generate random phone number
const randomPhone = () => {
  const areaCode = randomNumber(200, 999);
  const prefix = randomNumber(200, 999);
  const line = randomNumber(1000, 9999);
  return `${areaCode}-${prefix}-${line}`;
};

// Generate random email
const randomEmail = (firstName, lastName) => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNumber(1, 999)}@${randomElement(domains)}`;
};

// Generate inspection questions
const generateInspectionQuestions = () => {
  const questions = [
    {
      id: 'exterior_condition',
      question: 'What is the overall exterior condition?',
      type: 'rating',
      options: [
        { value: '1', label: 'Poor', points: 1 },
        { value: '2', label: 'Fair', points: 2 },
        { value: '3', label: 'Good', points: 3 },
        { value: '4', label: 'Very Good', points: 4 },
        { value: '5', label: 'Excellent', points: 5 }
      ],
      required: true,
      answer: randomNumber(1, 5)
    },
    {
      id: 'interior_condition',
      question: 'What is the overall interior condition?',
      type: 'rating',
      options: [
        { value: '1', label: 'Poor', points: 1 },
        { value: '2', label: 'Fair', points: 2 },
        { value: '3', label: 'Good', points: 3 },
        { value: '4', label: 'Very Good', points: 4 },
        { value: '5', label: 'Excellent', points: 5 }
      ],
      required: true,
      answer: randomNumber(1, 5)
    },
    {
      id: 'engine_condition',
      question: 'How does the engine run?',
      type: 'radio',
      options: [
        { value: 'excellent', label: 'Excellent - No issues', points: 5 },
        { value: 'good', label: 'Good - Minor issues', points: 4 },
        { value: 'fair', label: 'Fair - Some issues', points: 3 },
        { value: 'poor', label: 'Poor - Major issues', points: 2 },
        { value: 'broken', label: 'Broken - Won\'t start', points: 1 }
      ],
      required: true,
      answer: randomElement(['excellent', 'good', 'fair', 'poor'])
    },
    {
      id: 'transmission_condition',
      question: 'How does the transmission perform?',
      type: 'radio',
      options: [
        { value: 'excellent', label: 'Excellent - Smooth shifts', points: 5 },
        { value: 'good', label: 'Good - Minor issues', points: 4 },
        { value: 'fair', label: 'Fair - Some issues', points: 3 },
        { value: 'poor', label: 'Poor - Major issues', points: 2 },
        { value: 'broken', label: 'Broken - Won\'t shift', points: 1 }
      ],
      required: true,
      answer: randomElement(['excellent', 'good', 'fair', 'poor'])
    },
    {
      id: 'body_damage',
      question: 'Is there any body damage?',
      type: 'yesno',
      required: true,
      answer: randomElement([true, false])
    },
    {
      id: 'body_damage_details',
      question: 'Describe any body damage:',
      type: 'text',
      required: false,
      answer: randomElement([true, false]) ? 'Minor scratches on passenger side door' : null
    }
  ];
  return questions;
};

// Generate inspection sections
const generateInspectionSections = () => {
  return [
    {
      id: 'exterior',
      name: 'Exterior Inspection',
      description: 'Complete exterior condition assessment',
      icon: 'car',
      questions: generateInspectionQuestions().slice(0, 2),
      rating: randomNumber(1, 5),
      score: randomNumber(10, 25),
      maxScore: 25,
      completed: true
    },
    {
      id: 'interior',
      name: 'Interior Inspection',
      description: 'Complete interior condition assessment',
      icon: 'seat',
      questions: generateInspectionQuestions().slice(2, 4),
      rating: randomNumber(1, 5),
      score: randomNumber(10, 25),
      maxScore: 25,
      completed: true
    },
    {
      id: 'mechanical',
      name: 'Mechanical Inspection',
      description: 'Engine and transmission assessment',
      icon: 'wrench',
      questions: generateInspectionQuestions().slice(4, 6),
      rating: randomNumber(1, 5),
      score: randomNumber(15, 30),
      maxScore: 30,
      completed: true
    }
  ];
};

// Seed function
async function seed() {
  try {
    console.log('Starting seed process...');

    // Clear existing data
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Vehicle.deleteMany({});
    await Case.deleteMany({});
    await Inspection.deleteMany({});
    await Quote.deleteMany({});
    await Transaction.deleteMany({});
    await OBD2Code.deleteMany({});

    console.log('Cleared existing data');

    // Create OBD2 Codes
    console.log('Creating OBD2 Codes...');
    const createdOBD2Codes = await OBD2Code.insertMany(obd2Codes);
    console.log(`Created ${createdOBD2Codes.length} OBD2 codes`);

    // Create Users
    console.log('Creating Users...');
    const users = [];
    const roles = ['admin', 'agent', 'estimator', 'inspector'];
    
    for (let i = 0; i < 50; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const user = new User({
        email: randomEmail(firstName, lastName),
        password: 'password123',
        firstName,
        lastName,
        role: randomElement(roles),
        location: randomElement(locations),
        isVerified: true,
        verifiedAt: new Date()
      });
      users.push(await user.save());
    }
    console.log(`Created ${users.length} users`);

    // Create Customers
    console.log('Creating Customers...');
    const customers = [];
    for (let i = 0; i < 50; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const customer = new Customer({
        firstName,
        middleInitial: randomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']),
        lastName,
        cellPhone: randomPhone(),
        homePhone: randomPhone(),
        email1: randomEmail(firstName, lastName),
        email2: randomElement([true, false]) ? randomEmail(firstName, lastName) : null,
        email3: randomElement([true, false]) ? randomEmail(firstName, lastName) : null,
        hearAboutVOS: randomElement(['Google', 'Facebook', 'Friend', 'TV Ad', 'Radio', 'Billboard']),
        source: randomElement(sources),
        receivedOtherQuote: randomElement([true, false]),
        otherQuoteOfferer: randomElement([true, false]) ? randomElement(['CarMax', 'Carvana', 'Local Dealer', 'Private Buyer']) : null,
        otherQuoteAmount: randomElement([true, false]) ? randomNumber(1000, 15000) : null,
        notes: randomElement([true, false]) ? `Customer notes: ${randomElement(['Interested in quick sale', 'Needs money for new car', 'Moving soon', 'Financial hardship'])}` : null,
        agent: randomElement(users.filter(u => u.role === 'agent'))._id,
        storeLocation: randomElement(locations)
      });
      customers.push(await customer.save());
    }
    console.log(`Created ${customers.length} customers`);

    // Create Vehicles
    console.log('Creating Vehicles...');
    const vehicles = [];
    for (let i = 0; i < 50; i++) {
      const make = randomElement(makes);
      const vehicle = new Vehicle({
        customer: customers[i]._id,
        year: randomElement(years),
        make,
        model: randomElement(models[make] || ['Unknown']),
        currentMileage: randomMileage().toString(),
        vin: randomVIN(),
        color: randomElement(colors),
        bodyStyle: randomElement(bodyStyles),
        licensePlate: randomLicensePlate(),
        licenseState: randomElement(['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI']),
        titleNumber: 'TITLE' + randomNumber(100000, 999999),
        titleStatus: randomElement(['clean', 'salvage', 'rebuilt', 'lemon', 'flood', 'junk', 'not-sure']),
        loanStatus: randomElement(['paid-off', 'still-has-loan', 'not-sure']),
        loanAmount: randomElement([true, false]) ? randomNumber(5000, 25000) : null,
        secondSetOfKeys: randomElement([true, false]),
        hasTitleInPossession: randomElement([true, false]),
        titleInOwnName: randomElement([true, false]),
        knownDefects: randomElement([true, false]) ? randomElement(['Minor scratches', 'Check engine light', 'AC not working', 'Tire wear', 'Brake noise']) : null,
        estimatedValue: randomNumber(2000, 25000),
        pricingSource: randomElement(['KBB', 'NADA', 'Edmunds', 'Market Analysis']),
        pricingLastUpdated: randomDate(new Date(2023, 0, 1), new Date())
      });
      vehicles.push(await vehicle.save());
    }
    console.log(`Created ${vehicles.length} vehicles`);

    // Create Cases
    console.log('Creating Cases...');
    const cases = [];
    for (let i = 0; i < 50; i++) {
      // Half completed cases (stages 6-7), half in progress (stages 1-5)
      const isCompleted = i < 25;
      const currentStage = isCompleted ? randomNumber(6, 7) : randomNumber(1, 5);
      
      const stageStatuses = {};
      for (let stage = 1; stage <= 7; stage++) {
        if (stage < currentStage) {
          stageStatuses[stage] = 'complete';
        } else if (stage === currentStage) {
          stageStatuses[stage] = 'active';
        } else {
          stageStatuses[stage] = 'pending';
        }
      }

      const status = isCompleted ? 'completed' : randomElement(['new', 'active', 'scheduled', 'quote-ready', 'negotiating']);
      const completionStatus = isCompleted ? {
        thankYouSent: randomElement([true, false]),
        sentAt: randomElement([true, false]) ? randomDate(new Date(2023, 0, 1), new Date()) : null,
        leaveBehinds: {
          vehicleLeft: randomElement([true, false]),
          keysHandedOver: randomElement([true, false]),
          documentsReceived: randomElement([true, false])
        },
        pdfGenerated: randomElement([true, false]),
        completedAt: randomDate(new Date(2023, 0, 1), new Date()),
        titleConfirmation: randomElement([true, false])
      } : {
        thankYouSent: false,
        sentAt: null,
        leaveBehinds: {
          vehicleLeft: false,
          keysHandedOver: false,
          documentsReceived: false
        },
        pdfGenerated: false,
        completedAt: null,
        titleConfirmation: false
      };

      const caseData = {
        customer: customers[i]._id,
        vehicle: vehicles[i]._id,
        currentStage,
        stageStatuses,
        status,
        priority: randomElement(['low', 'medium', 'high']),
        estimatedValue: randomNumber(2000, 25000),
        thankYouSent: isCompleted ? randomElement([true, false]) : false,
        completion: completionStatus,
        lastActivity: {
          description: isCompleted ? randomElement([
            'Customer accepted offer',
            'Documents uploaded',
            'Payment processed',
            'Vehicle picked up',
            'Transaction completed'
          ]) : randomElement([
            'Customer contacted for inspection scheduling',
            'Inspection scheduled',
            'Inspection in progress',
            'Quote prepared and sent',
            'Customer reviewing offer'
          ]),
          timestamp: randomDate(new Date(2023, 0, 1), new Date())
        },
        pdfCaseFile: isCompleted ? `/uploads/cases/case_${i + 1}.pdf` : null,
        createdBy: randomElement(users)._id,
        updatedBy: [{
          user: randomElement(users)._id,
          timestamp: randomDate(new Date(2023, 0, 1), new Date())
        }]
      };

      // Add documents if case is in later stages
      if (currentStage > 2) {
        caseData.documents = {
          driverLicenseFront: {
            path: `/uploads/documents/dl_front_${i + 1}.jpg`,
            originalName: 'driver_license_front.jpg',
            uploadedAt: randomDate(new Date(2023, 0, 1), new Date())
          },
          driverLicenseRear: {
            path: `/uploads/documents/dl_rear_${i + 1}.jpg`,
            originalName: 'driver_license_rear.jpg',
            uploadedAt: randomDate(new Date(2023, 0, 1), new Date())
          },
          vehicleTitle: {
            path: `/uploads/documents/title_${i + 1}.pdf`,
            originalName: 'vehicle_title.pdf',
            uploadedAt: randomDate(new Date(2023, 0, 1), new Date())
          }
        };
      }

      const caseInstance = new Case(caseData);
      cases.push(await caseInstance.save());
    }
    console.log(`Created ${cases.length} cases`);

    // Create Inspections
    console.log('Creating Inspections...');
    const inspections = [];
    for (let i = 0; i < 50; i++) {
      // Half completed, half pending
      const isCompleted = i < 25;
      const status = isCompleted ? 'completed' : randomElement(['scheduled', 'in-progress']);
      const completed = isCompleted;
      const completedAt = isCompleted ? randomDate(new Date(2023, 0, 1), new Date()) : null;
      
      const inspection = new Inspection({
        vehicle: vehicles[i]._id,
        customer: customers[i]._id,
        inspector: {
          firstName: randomElement(firstNames),
          lastName: randomElement(lastNames),
          email: randomEmail(randomElement(firstNames), randomElement(lastNames)),
          phone: randomPhone()
        },
        scheduledDate: randomDate(new Date(2023, 0, 1), new Date()),
        scheduledTime: `${randomNumber(8, 17)}:${randomElement(['00', '30'])}`,
        dueByDate: randomDate(new Date(2023, 0, 1), new Date()),
        dueByTime: `${randomNumber(8, 17)}:${randomElement(['00', '30'])}`,
        notesForInspector: randomElement([true, false]) ? 'Please check for any hidden damage and test all systems thoroughly.' : null,
        status,
        accessToken: crypto.randomBytes(20).toString('hex'),
        sections: generateInspectionSections(),
        overallRating: completed ? randomNumber(1, 5) : null,
        overallScore: completed ? randomNumber(50, 100) : 0,
        maxPossibleScore: 100,
        emailSent: randomElement([true, false]),
        completed,
        completedAt,
        inspectionNotes: completed ? randomElement([true, false]) ? 'Vehicle in good condition with minor wear and tear expected for age and mileage.' : null : null,
        recommendations: completed ? randomElement([true, false]) ? ['Replace brake pads', 'Check alignment', 'Service transmission'] : [] : [],
        safetyIssues: completed ? randomElement([true, false]) ? [{
          severity: randomElement(['low', 'medium', 'high', 'critical']),
          description: 'Minor brake wear',
          location: 'Front brakes',
          estimatedCost: randomNumber(100, 500)
        }] : [] : [],
        maintenanceItems: completed ? randomElement([true, false]) ? [{
          priority: randomElement(['low', 'medium', 'high']),
          description: 'Oil change needed',
          estimatedCost: randomNumber(30, 100),
          recommendedAction: 'Schedule oil change within 1000 miles'
        }] : [] : [],
        vinVerification: {
          vinNumber: vehicles[i].vin,
          vinMatch: completed ? randomElement(['yes', 'no', 'not_verified']) : 'not_verified'
        },
        createdBy: randomElement(users.filter(u => u.role === 'inspector'))._id
      });
      inspections.push(await inspection.save());
    }
    console.log(`Created ${inspections.length} inspections`);

    // Create Quotes
    console.log('Creating Quotes...');
    const quotes = [];
    for (let i = 0; i < 50; i++) {
      const offerAmount = randomNumber(1500, 20000);
      
      // Half completed quotes (accepted/declined), half pending
      const isCompleted = i < 25;
      const status = isCompleted ? randomElement(['accepted', 'declined', 'expired']) : randomElement(['draft', 'ready', 'presented', 'negotiating']);
      const decision = isCompleted ? randomElement(['accepted', 'declined']) : randomElement(['pending', 'negotiating']);
      
      const quote = new Quote({
        caseId: cases[i]._id,
        vehicle: vehicles[i]._id,
        customer: customers[i]._id,
        inspection: inspections[i]._id, // Link to corresponding inspection
        estimator: {
          firstName: randomElement(firstNames),
          lastName: randomElement(lastNames),
          email: randomEmail(randomElement(firstNames), randomElement(lastNames)),
          phone: randomPhone()
        },
        offerAmount,
        expiryDate: randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        notes: randomElement([true, false]) ? 'Based on current market conditions and vehicle condition assessment.' : null,
        titleReminder: true,
        estimatedValue: offerAmount + randomNumber(-1000, 1000),
        status,
        accessToken: crypto.randomBytes(20).toString('hex'),
        offerDecision: {
          decision,
          counterOffer: decision === 'negotiating' ? randomNumber(offerAmount - 1000, offerAmount + 1000) : null,
          customerNotes: decision !== 'pending' ? randomElement([true, false]) ? 'Customer considering the offer' : null : null,
          finalAmount: decision === 'accepted' ? randomNumber(offerAmount - 500, offerAmount + 500) : null,
          decisionDate: decision !== 'pending' ? randomDate(new Date(2023, 0, 1), new Date()) : null,
          reason: decision === 'declined' ? randomElement(['Need more money', 'Found better offer', 'Changed mind', 'Timing issue']) : null
        },
        obd2Scan: randomElement([true, false]) ? {
          scanDate: randomDate(new Date(2023, 0, 1), new Date()),
          filePath: `/uploads/obd2/scan_${i + 1}.txt`,
          extractedCodes: randomElement([true, false]) ? [randomElement(createdOBD2Codes).code] : [],
          criticalCodes: randomElement([true, false]) ? [{
            code: randomElement(createdOBD2Codes).code,
            description: randomElement(createdOBD2Codes).description,
            criticality: randomNumber(1, 5),
            estimatedRepairCost: randomElement(createdOBD2Codes).estimatedRepairCost
          }] : []
        } : null,
        emailSent: randomElement([true, false]),
        generatedAt: randomDate(new Date(2023, 0, 1), new Date()),
        createdBy: randomElement(users.filter(u => u.role === 'estimator'))._id
      });
      quotes.push(await quote.save());
    }
    console.log(`Created ${quotes.length} quotes`);

    // Create Transactions
    console.log('Creating Transactions...');
    const transactions = [];
    for (let i = 0; i < 50; i++) {
      // Only create transactions for accepted quotes (first 25)
      const isCompleted = i < 25;
      const paymentStatus = isCompleted ? randomElement(['processing', 'completed']) : 'pending';
      const completedAt = isCompleted ? randomDate(new Date(2023, 0, 1), new Date()) : null;
      
      const transaction = new Transaction({
        vehicle: vehicles[i]._id,
        customer: customers[i]._id,
        quote: quotes[i]._id,
        billOfSale: {
          sellerName: `${customers[i].firstName} ${customers[i].lastName}`,
          sellerAddress: `${randomNumber(100, 9999)} ${randomElement(['Main St', 'Oak Ave', 'Pine Rd', 'Elm St', 'Maple Dr'])}`,
          sellerCity: randomElement(['Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose']),
          sellerState: randomElement(['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI']),
          sellerZip: randomNumber(10000, 99999).toString(),
          sellerPhone: customers[i].cellPhone,
          sellerEmail: customers[i].email1,
          sellerDLNumber: 'DL' + randomNumber(100000000, 999999999),
          sellerDLState: randomElement(['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI']),
          buyerRepName: `${randomElement(users.filter(u => u.role === 'agent')).firstName} ${randomElement(users.filter(u => u.role === 'agent')).lastName}`,
          vehicleVIN: vehicles[i].vin,
          vehicleYear: vehicles[i].year,
          vehicleMake: vehicles[i].make,
          vehicleModel: vehicles[i].model,
          vehicleColor: vehicles[i].color,
          vehicleBodyStyle: vehicles[i].bodyStyle,
          vehicleLicensePlate: vehicles[i].licensePlate,
          vehicleLicenseState: vehicles[i].licenseState,
          vehicleTitleNumber: vehicles[i].titleNumber,
          vehicleMileage: vehicles[i].currentMileage,
          saleDate: randomDate(new Date(2023, 0, 1), new Date()),
          saleTime: `${randomNumber(8, 17)}:${randomElement(['00', '30'])}`,
          salePrice: quotes[i].offerAmount,
          paymentMethod: 'ACH Transfer',
          odometerReading: vehicles[i].currentMileage,
          odometerAccurate: true,
          titleStatus: vehicles[i].titleStatus,
          knownDefects: vehicles[i].knownDefects || 'None',
          asIsAcknowledgment: true,
          notaryRequired: randomElement([true, false]),
          notaryName: randomElement([true, false]) ? `${randomElement(firstNames)} ${randomElement(lastNames)}` : null,
          notaryCommissionExpiry: randomElement([true, false]) ? randomDate(new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) : null,
          witnessName: randomElement([true, false]) ? `${randomElement(firstNames)} ${randomElement(lastNames)}` : null,
          witnessPhone: randomElement([true, false]) ? randomPhone() : null
        },
        preferredPaymentMethod: randomElement(['Wire', 'ACH', 'Check']),
        bankDetails: {
          bankName: randomElement(['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'US Bank']),
          loanNumber: randomElement([true, false]) ? 'LOAN' + randomNumber(100000, 999999) : null,
          payoffAmount: randomElement([true, false]) ? randomNumber(5000, 25000) : null
        },
        documents: {
          signedBillOfSale: isCompleted ? `/uploads/transactions/bill_of_sale_${i + 1}.pdf` : null
        },
        paymentStatus,
        pdfGenerated: isCompleted,
        pdfPath: isCompleted ? `/uploads/transactions/transaction_${i + 1}.pdf` : null,
        submittedAt: randomDate(new Date(2023, 0, 1), new Date()),
        completedAt,
        createdBy: randomElement(users.filter(u => u.role === 'agent'))._id
      });
      transactions.push(await transaction.save());
    }
    console.log(`Created ${transactions.length} transactions`);

    // Update cases with related data
    console.log('Updating cases with related data...');
    for (let i = 0; i < cases.length; i++) {
      const updates = {};
      
      // Link inspection, quote, and transaction to case
      updates.inspection = inspections[i]._id;
      updates.quote = quotes[i]._id;
      updates.transaction = transactions[i]._id;
      
      await Case.findByIdAndUpdate(cases[i]._id, updates);
    }

    console.log('Seed completed successfully!');
    console.log('\nSummary:');
    console.log(`- ${users.length} users created (all roles: admin, agent, estimator, inspector)`);
    console.log(`- ${customers.length} customers created`);
    console.log(`- ${vehicles.length} vehicles created`);
    console.log(`- ${cases.length} cases created (25 completed, 25 in progress)`);
    console.log(`- ${inspections.length} inspections created (25 completed, 25 pending)`);
    console.log(`- ${quotes.length} quotes created (25 accepted/declined, 25 pending)`);
    console.log(`- ${transactions.length} transactions created (25 completed, 25 pending)`);
    console.log(`- ${createdOBD2Codes.length} OBD2 codes created`);
    console.log('\nData Distribution:');
    console.log('- First 25 records: Completed workflows (inspections done, quotes accepted, transactions completed)');
    console.log('- Last 25 records: In-progress workflows (inspections pending, quotes pending, transactions pending)');
    console.log('- All entities are properly linked for testing complete user flows');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seed(); 