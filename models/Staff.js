const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  staffId: {
    type: String,
    unique: true,
    required: true,
    sparse: true,
    default: function() {
      const currentYear = new Date().getFullYear();
      return `STF-${currentYear}0001`; // Default value, will be updated in pre-save
    }
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  middleName: {
    type: String,
    default: '',
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  birthdate: {
    type: Date,
    required: [true, 'Birthdate is required']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function(v) {
        return /[A-Z]/.test(v) && // At least one uppercase letter
               /[0-9]/.test(v) && // At least one number
               /[!@#$%^&*(),.?":{}|<>]/.test(v); // At least one special character
      },
      message: 'Password must contain at least one uppercase letter, one number, and one special character (!@#$%^&*(),.?":{}|<>)'
    }
  },
  role: {
    type: String,
    default: 'Staff',
    enum: {
      values: ['Staff', 'staff'],
      message: 'Role must be either "Staff" or "staff"'
    },
    set: function(v) {
      return v === 'staff' ? 'Staff' : v;
    }
  },
  position: {
    type: String,
    default: '',
    trim: true
  },
  department: {
    type: String,
    default: '',
    trim: true
  },
  officeAddress: {
    type: String,
    default: '',
    trim: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String
  },
  tokenExpiry: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  autoIndex: false // Disable automatic index creation
});

// Generate staffId before saving
staffSchema.pre('save', async function(next) {
  try {
    // Only generate staffId if it's a new document
    if (this.isNew) {
      const currentYear = new Date().getFullYear();
      
      // Find the last staff ID for the current year
      const lastStaff = await this.constructor.findOne(
        { staffId: new RegExp(`^STF-${currentYear}`) },
        { staffId: 1 },
        { sort: { staffId: -1 } }
      );

      let sequence = 1;
      if (lastStaff) {
        // Extract the sequence number from the last staff ID
        const lastSequence = parseInt(lastStaff.staffId.split('-')[1].substring(4));
        sequence = lastSequence + 1;
      }

      // Generate new staff ID
      this.staffId = `STF-${currentYear}${sequence.toString().padStart(4, '0')}`;
    }

    // Hash password before saving
    if (!this.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error);
  }
});

// Method to compare password
staffSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) {
      console.error('No password hash stored for user');
      return false;
    }
    
    if (!candidatePassword) {
      console.error('No candidate password provided');
      return false;
    }
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw new Error('Error comparing passwords');
  }
};

const Staff = mongoose.model('Staff', staffSchema);

// Remove automatic index creation
// Staff.createIndexes().catch(console.error);

module.exports = Staff; 
