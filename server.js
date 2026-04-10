const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const authRoutes = require('./routes/auth');
const staffProfileRoutes = require('./routes/staff_profile');
const patientProfileRoutes = require('./routes/patient_profile');
const biteCaseRoutes = require('./routes/bite_cases');
const vaccinationDateRoutes = require('./routes/vaccination_dates');
const barangayRoutes = require('./routes/barangay');
const vaccineStocksRouter = require('./routes/vaccine_stocks');
const centerHoursRoutes = require('./routes/center_hours');
const notificationRoutes = require('./routes/notifications');
const cronService = require('./services/cronService');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.1.10:3000',
  'http://localhost',
  'http://192.168.1.10',
  'http://localhost:58258',      // Flutter Web on Chrome
  'http://127.0.0.1:58258',      // Flutter Web on Chrome (alternate)
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:8080',
  'http://localhost:8100',
  'https://bitealert-yzau.onrender.com',
  'http://bitealert-yzau.onrender.com',
  'https://bitealert-mobile.onrender.com',
  'http://bitealert-mobile.onrender.com',
  'http://10.0.2.2:3000',        // Android emulator
  'http://10.0.2.2'              // Android emulator without port
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Staff-Name', 'X-Staff-Center', 'X-Staff-Id', 'X-Audit-Intent'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle verify-email route
app.get('/verify-email/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify-email.html'));
});

// Debug middleware to log all requests (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    next();
  });
}

// MongoDB Connection with retry logic
const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
  } catch (err) {
    console.error('=== MONGODB CONNECTION ERROR ===');
    console.error('MongoDB connection error:', err);
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff-profile', staffProfileRoutes);
app.use('/api/patient-profile', patientProfileRoutes);
app.use('/api/bite-cases', biteCaseRoutes);
app.use('/api/vaccination-dates', vaccinationDateRoutes);
app.use('/api/barangay', barangayRoutes);
app.use('/api/vaccine-stocks', vaccineStocksRouter);
app.use('/api', centerHoursRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoint to check database connection
app.get('/api/debug/db', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'ok',
      connectionState: states[state],
      models: Object.keys(mongoose.models),
      database: mongoose.connection.db.databaseName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Basic route for testing server
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Manual trigger for treatment reminders (for testing)
app.post('/api/trigger-reminders', async (req, res) => {
  try {
    const result = await cronService.triggerTreatmentReminders();
    res.json({
      message: 'Treatment reminders triggered successfully',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering treatment reminders:', error);
    res.status(500).json({
      message: 'Failed to trigger treatment reminders',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to create CronExecution record manually
app.post('/api/test-cron-execution', async (req, res) => {
  try {
    const CronExecution = require('./models/CronExecution');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const executionRecord = new CronExecution({
      jobName: 'test_execution',
      executionDate: today,
      status: 'success',
      executedAt: new Date(),
      results: {
        totalTreatments: 1,
        notificationsSent: 1,
        errors: []
      }
    });
    
    await executionRecord.save();
    
    res.json({
      message: 'Test cron execution record created successfully',
      record: executionRecord
    });
  } catch (error) {
    console.error('❌ Error creating test cron execution:', error);
    res.status(500).json({
      message: 'Error creating test cron execution',
      error: error.message
    });
  }
});

// Check if cron_executions collection exists and has data
app.get('/api/check-cron-executions', async (req, res) => {
  try {
    const CronExecution = require('./models/CronExecution');
    
    // Count all records
    const count = await CronExecution.countDocuments();
    
    // Get all records
    const records = await CronExecution.find({}).sort({ executedAt: -1 }).limit(10);
    
    res.json({
      message: 'Cron executions collection check',
      totalRecords: count,
      recentRecords: records
    });
  } catch (error) {
    console.error('❌ Error checking cron executions:', error);
    res.status(500).json({
      message: 'Error checking cron executions',
      error: error.message
    });
  }
});

// Get cron service status
app.get('/api/cron-status', (req, res) => {
  try {
    const status = cronService.getStatus();
    res.json({
      message: 'Cron service status',
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cron status:', error);
    res.status(500).json({
      message: 'Failed to get cron status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('=== ERROR OCCURRED ===');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('=== END ERROR ===');
  
  const statusCode = err.status || 500;
  const errorMessage = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    status: 'error',
    message: errorMessage,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { error: err })
  });
});

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, '0.0.0.0', () => {
  
  // Start cron service for treatment reminders
  try {
    cronService.start();
  } catch (error) {
    console.error('❌ Failed to start cron service:', error);
  }
});
