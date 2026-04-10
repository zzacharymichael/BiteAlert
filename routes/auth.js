const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Patient = require('../models/Patient');
const AuditTrail = require('../models/AuditTrail');
const { generateVerificationToken, sendVerificationEmail, sendEmailViaAPI } = require('../services/emailService');
const path = require('path');

// Debug route to check database contents
router.get('/debug/users', async (req, res) => {
  try {
    const staff = await Staff.find({}, { password: 0 });
    const patients = await Patient.find({}, { password: 0 });
    res.json({
      staff,
      patients,
      totalStaff: staff.length,
      totalPatients: patients.length
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Debug route to check specific user
router.get('/debug/user/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const staff = await Staff.findOne({ email });
    const patient = await Patient.findOne({ email });
    
    if (staff) {
      res.json({
        found: true,
        type: 'staff',
        user: {
          email: staff.email,
          firstName: staff.firstName,
          middleName: staff.middleName,
          lastName: staff.lastName,
          role: staff.role,
          hasPassword: !!staff.password
        }
      });
    } else if (patient) {
      res.json({
        found: true,
        type: 'patient',
        user: {
          email: patient.email,
          firstName: patient.firstName,
          middleName: patient.middleName,
          lastName: patient.lastName,
          role: patient.role,
          hasPassword: !!patient.password
        }
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Temporary storage for OTPs (in production, use Redis or similar)
const otpStore = new Map();

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // First try staff login
    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      // Check if staff is approved
      if (!staff.isApproved) {
        return res.status(403).json({ 
          message: 'Your account is pending approval. Please contact the administrator.',
          isApproved: false
        });
      }
      
      try {
        const isMatch = await staff.comparePassword(password);
        if (isMatch) {
          const token = jwt.sign(
            { userId: staff.staffId, role: 'staff' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          // Create audit trail for sign-in (staff)
          try {
            await AuditTrail.create({
              role: 'Staff',
              firstName: staff.firstName,
              middleName: staff.middleName || '',
              lastName: staff.lastName,
              centerName: staff.officeAddress || '',
              action: 'Signed in',
              patientID: null,
              staffID: staff.staffId,
            });
          } catch (auditErr) {
            console.error('Failed to write staff sign-in audit:', auditErr);
          }
          
          const userData = {
            id: staff.staffId,
            firstName: staff.firstName,
            middleName: staff.middleName || '',
            lastName: staff.lastName,
            email: staff.email,
            phone: staff.phone,
            birthdate: staff.birthdate,
            role: staff.role,
            position: staff.position || '',
            department: staff.department || '',
            healthServices: staff.healthServices || '',
            isApproved: staff.isApproved,
            isVerified: staff.isVerified,
            createdAt: staff.createdAt,
            updatedAt: staff.updatedAt
          };

          return res.json({
            message: 'Login successful',
            user: userData,
            token: token
          });
        }
      } catch (error) {
        console.error('Error comparing staff password:', error);
      }
    }

    // If staff login fails, try patient login
    const patient = await Patient.findOne({ email: normalizedEmail });
    if (patient) {
      try {
        const isMatch = await patient.comparePassword(password);
        if (isMatch) {
          const token = jwt.sign(
            { userId: patient.patientId, role: patient.role.toLowerCase() },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          // Create audit trail for sign-in (patient)
          try {
            await AuditTrail.create({
              role: 'Patient',
              firstName: patient.firstName,
              middleName: patient.middleName || '',
              lastName: patient.lastName,
              centerName: patient.barangay || '',
              action: 'Signed in',
              patientID: patient.patientId,
              staffID: null,
            });
          } catch (auditErr) {
            console.error('Failed to write patient sign-in audit:', auditErr);
          }
          
          const userData = {
            id: patient.patientId,
            firstName: patient.firstName,
            middleName: patient.middleName || '',
            lastName: patient.lastName,
            email: patient.email,
            phone: patient.phone,
            birthdate: patient.birthdate,
            role: patient.role,
            isVerified: patient.isVerified,
          };

          return res.json({
            message: 'Login successful',
            user: userData,
            token: token
          });
        }
      } catch (error) {
        console.error('Error comparing patient password:', error);
      }
    }

    return res.status(401).json({ 
      message: 'Invalid email or password',
      details: 'Please check your email and password and try again.'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: 'An unexpected error occurred during login. Please try again.'
    });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, 
      middleName, 
      lastName, 
      email, 
      phone, 
      birthdate, 
      password, 
      role,
      isVerified,
      // Additional profile fields
      birthPlace,
      religion,
      occupation,
      nationality,
      sex,
      civilStatus,
      houseNo,
      street,
      barangay,
      subdivision,
      city,
      province,
      zipCode
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !birthdate || !password || !role) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        errors: ['All required fields must be filled out']
      });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check both collections for existing email
    const existingStaff = await Staff.findOne({ email: normalizedEmail });
    const existingPatient = await Patient.findOne({ email: normalizedEmail });
    
    if (existingStaff || existingPatient) {
      return res.status(400).json({ 
        message: 'Email already exists',
        errors: ['This email is already registered']
      });
    }

    // Generate verification token (only if not pre-verified)
    const verificationToken = isVerified === true ? undefined : generateVerificationToken();
    const tokenExpiry = isVerified === true ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user based on role
    let user;
    if (role.toLowerCase() === 'staff') {
      user = new Staff({
        firstName,
        middleName,
        lastName,
        email: normalizedEmail,
        phone,
        birthdate,
        password,
        role: 'staff',
        isApproved: false,
        isVerified: isVerified === true ? true : false,
        verificationToken,
        tokenExpiry
      });
    } else {
      user = new Patient({
        firstName,
        middleName,
        lastName,
        email: normalizedEmail,
        phone,
        birthdate,
        password,
        role: 'patient',
        isVerified: isVerified === true ? true : false,
        verificationToken,
        tokenExpiry,
        // Additional profile fields
        birthPlace: birthPlace || '',
        religion: religion || '',
        occupation: occupation || '',
        nationality: nationality || '',
        sex: sex || '',
        civilStatus: civilStatus || '',
        houseNo: houseNo || '',
        street: street || '',
        barangay: barangay || '',
        subdivision: subdivision || '',
        city: city || '',
        province: province || '',
        zipCode: zipCode || ''
      });
    }

    // Save user
    await user.save();

    // Send verification email (only if not pre-verified) - NON-BLOCKING
    if (isVerified !== true && verificationToken) {
      // Start email sending in background without waiting
      
      // Use setImmediate to make this truly non-blocking
      setImmediate(async () => {
        try {
          let emailSent = await sendVerificationEmail(normalizedEmail, verificationToken);
          
        // If main email service fails, try fallback service
        if (!emailSent) {
          emailSent = await sendEmailViaAPI(normalizedEmail, verificationToken);
        }
          
          if (emailSent) {
          }
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't prevent registration if email fails
        }
      });
    }

    const successMessage = isVerified 
      ? 'Registration successful. Account is verified and ready to use.'
      : 'Registration successful. Please check your email to verify your account.';

    return res.status(201).json({
      message: successMessage,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Verify email route
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with this token
    const staff = await Staff.findOne({ 
      verificationToken: token,
      tokenExpiry: { $gt: Date.now() }
    });
    
    const patient = await Patient.findOne({ 
      verificationToken: token,
      tokenExpiry: { $gt: Date.now() }
    });

    const user = staff || patient;
    
    if (!user) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(400).json({
        message: 'Invalid or expired verification token'
      });
      }
      return res.redirect('/verify-email.html');
    }

    // Update user verification status
    user.isVerified = true;
    user.verificationToken = undefined;
    user.tokenExpiry = undefined;
    await user.save();

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      message: 'Email verified successfully'
    });
    }

    // Redirect to the HTML page for browser requests
    return res.redirect('/verify-email.html');
  } catch (error) {
    console.error('Email verification error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
    }
    return res.redirect('/verify-email.html');
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Check both collections for the email
    const staff = await Staff.findOne({ email: normalizedEmail });
    const patient = await Patient.findOne({ email: normalizedEmail });

    if (!staff && !patient) {
      return res.status(404).json({ message: 'Email not found in either patient or staff records' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry


    // Store OTP
    otpStore.set(normalizedEmail, {
      otp,
      expiry: otpExpiry,
      type: staff ? 'staff' : 'patient'
    });

    // Send OTP via email - NON-BLOCKING
    
    // Start email sending in background without waiting
    setImmediate(async () => {
      try {
        let emailSent = await sendVerificationEmail(normalizedEmail, otp, 'password-reset');
        
        // If main email service fails, try fallback service
        if (!emailSent) {
          emailSent = await sendEmailViaAPI(normalizedEmail, otp, 'password-reset');
        }
        
        if (emailSent) {
        }
      } catch (error) {
        console.error('Error sending OTP:', error);
      }
    });
    
    // Return immediately without waiting for email
    return res.json({ 
      message: 'OTP sent successfully. Please check your email.',
      otp: otp // Include OTP in response for testing (remove in production)
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const storedData = otpStore.get(normalizedEmail);

    if (!storedData) {
      return res.status(400).json({ message: 'No OTP found for this email' });
    }

    if (Date.now() > storedData.expiry) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    return res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Validate password format
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ 
        message: 'Invalid password format',
        details: 'Password must be at least 8 characters long'
      });
    }

    // Check for required password components
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUpperCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({ 
        message: 'Invalid password format',
        details: 'Password must contain at least one uppercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>)'
      });
    }

    // Find user in both collections
    const staff = await Staff.findOne({ email: normalizedEmail });
    const patient = await Patient.findOne({ email: normalizedEmail });

    if (!staff && !patient) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Update password in the appropriate collection
    if (staff) {
      staff.password = newPassword;
      await staff.save();
    } else {
      patient.password = newPassword;
      await patient.save();
    }

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Invalid password format',
        details: error.message
      });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// Manual verification endpoint (for testing when emails don't work)
router.get('/manual-verify/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user in both collections
    const staff = await Staff.findOne({ email: normalizedEmail });
    const patient = await Patient.findOne({ email: normalizedEmail });
    
    const user = staff || patient;
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        email: normalizedEmail 
      });
    }
    
    if (user.isVerified) {
      return res.json({ 
        message: 'Account is already verified',
        email: normalizedEmail,
        isVerified: true
      });
    }
    
    // Manually verify the account
    user.isVerified = true;
    user.verificationToken = undefined;
    user.tokenExpiry = undefined;
    await user.save();
    
    return res.json({ 
      message: 'Account successfully verified',
      email: normalizedEmail,
      isVerified: true,
      userId: user.staffId || user.patientId
    });
    
  } catch (error) {
    console.error('Manual verification error:', error);
    return res.status(500).json({ 
      message: 'Manual verification failed', 
      error: error.message 
    });
  }
});

// Email testing endpoint (for debugging)
router.post('/test-email', async (req, res) => {
  try {
    const { email, type = 'verification' } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const testToken = 'test-token-' + Date.now();
    
    // Test main email service
    let mainServiceResult = await sendVerificationEmail(email, testToken, type);
    
    // Test alternative email service
    let altServiceResult = await sendEmailViaAPI(email, testToken, type);

    return res.json({
      message: 'Email test completed',
      results: {
        mainService: mainServiceResult,
        alternativeService: altServiceResult,
        testToken: testToken,
        email: email,
        type: type
      }
    });
  } catch (error) {
    console.error('Email test error:', error);
    return res.status(500).json({ 
      message: 'Email test failed', 
      error: error.message 
    });
  }
});

module.exports = router; 

// Logout route - expects Authorization: Bearer <token> or { token } in body
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const bodyToken = req.body && typeof req.body.token === 'string' ? req.body.token : null;
    const token = headerToken || bodyToken;
    if (!token) {
      return res.status(400).json({ message: 'Missing token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // decoded contains { userId, role }
    const role = (decoded.role || '').toLowerCase();

    if (role === 'staff') {
      const staff = await Staff.findOne({ staffId: decoded.userId });
      if (staff) {
        try {
          await AuditTrail.create({
            role: 'Staff',
            firstName: staff.firstName,
            middleName: staff.middleName || '',
            lastName: staff.lastName,
            centerName: staff.officeAddress || '',
            action: 'Signed out',
            patientID: null,
            staffID: staff.staffId,
          });
        } catch (auditErr) {
          console.error('Failed to write staff sign-out audit:', auditErr);
        }
      } else {
      }
    } else if (role === 'patient') {
      const patient = await Patient.findOne({ patientId: decoded.userId });
      if (patient) {
        try {
          await AuditTrail.create({
            role: 'Patient',
            firstName: patient.firstName,
            middleName: patient.middleName || '',
            lastName: patient.lastName,
            centerName: patient.barangay || '',
            action: 'Signed out',
            patientID: patient.patientId,
            staffID: null,
          });
        } catch (auditErr) {
          console.error('Failed to write patient sign-out audit:', auditErr);
        }
      } else {
      }
    }

    // For stateless JWT, we cannot invalidate the token server-side without a blacklist.
    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET alias for quick testing: /api/auth/logout?token=...
router.get('/logout', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (!token) {
      return res.status(400).json({ message: 'Missing token' });
    }

    // Reuse POST handler logic by faking body
    req.body = { token };
    return router.handle(req, res);
  } catch (err) {
    console.error('GET /logout error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
