const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize express
const app = express();

// Middleware
app.use(express.json());

// File Upload Middleware
app.use(fileUpload({
  createParentPath: true,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/',
  debug: process.env.NODE_ENV === 'development'
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://vos.rtnglobal.co',
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove any undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Enable credentials
};

app.use(cors(corsOptions));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'pdfs'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'images'), { recursive: true });
}

// Serve static files from the uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve PDF files from the pdfs folder with proper debugging
app.use('/files', (req, res, next) => {
  console.log('PDF file requested:', req.url);
  
  // Clean the URL (remove any query parameters)
  const cleanUrl = req.url.split('?')[0];
  const filePath = path.join(__dirname, '../uploads/pdfs', cleanUrl);
  
  console.log('Full path:', filePath);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log('File not found:', filePath);
      console.log('Error:', err.message);
      
      // List available files for debugging
      fs.readdir(path.join(__dirname, '../uploads/pdfs'), (dirErr, files) => {
        if (!dirErr) {
          console.log('Available files in pdfs directory:', files);
        }
        res.status(404).send('File not found');
      });
    } else {
      console.log('File exists, serving:', filePath);
      // Set content type for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=' + path.basename(filePath));
      next();
    }
  });
}, express.static(path.join(__dirname, '../uploads/pdfs')));

// Import routes
const authRoutes = require('./routes/auth');
const allRoutes = require('./routes/allroutes');
const veriffRoutes = require('./routes/veriff');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api', allRoutes);
app.use('/api/veriff', veriffRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('VOS API is running');
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 