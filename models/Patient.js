const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    unique: true,
    required: true,
    sparse: true,
    default: function() {
      const currentYear = new Date().getFullYear();
      return `PAT-${currentYear}0001`; // Default value, will be updated in pre-save
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
  additionalContactNumber: {
    type: String,
    default: '',
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
    default: 'Patient',
    enum: {
      values: ['Patient', 'patient'],
      message: 'Role must be either "Patient" or "patient"'
    },
    set: function(v) {
      return v === 'patient' ? 'Patient' : v;
    }
  },
  houseNo: {
    type: String,
    default: '',
    trim: true
  },
  street: {
    type: String,
    default: '',
    trim: true
  },
  barangay: {
    type: String,
    default: '',
    trim: true
  },
  subdivision: {
    type: String,
    default: '',
    trim: true
  },
  city: {
    type: String,
    default: '',
    trim: true
  },
  province: {
    type: String,
    default: '',
    trim: true
  },
  zipCode: {
    type: String,
    default: '',
    trim: true
  },
  birthPlace: {
    type: String,
    default: '',
    trim: true
  },
  religion: {
    type: String,
    default: '',
    trim: true
  },
  occupation: {
    type: String,
    default: '',
    trim: true
  },
  nationality: {
    type: String,
    default: '',
    trim: true
  },

  civilStatus: {
    type: String,
    default: '',
    trim: true
  },
  sex: {
    type: String,
    default: '',
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: 'active',
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: 'Status must be active, inactive, or suspended'
    }
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

// Generate patientId before saving
patientSchema.pre('save', async function(next) {
  try {
    // Only generate patientId if it's a new document
    if (this.isNew) {
      const currentYear = new Date().getFullYear();
      
      // Get initials from first and last name
      const firstInitial = this.firstName.charAt(0).toUpperCase();
      const lastInitial = this.lastName.charAt(0).toUpperCase();
      const middleInitial = this.middleName ? this.middleName.charAt(0).toUpperCase() : '';
      const initials = `${firstInitial}${middleInitial}${lastInitial}`;
      
      // Find all patient IDs for the current year and get the highest sequence
      const patients = await this.constructor.find(
        { 
          patientId: { 
            $regex: `^PAT-.*${currentYear}`,
            $options: 'i'
          }
        },
        { patientId: 1 }
      );

      let maxSequence = 0;
      for (const patient of patients) {
        const sequenceStr = patient.patientId.substring(patient.patientId.length - 4);
        const sequence = parseInt(sequenceStr);
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }

      // Generate new patient ID with format: PAT-[Initials][Year][4-digit number]
      this.patientId = `PAT-${initials}${currentYear}${(maxSequence + 1).toString().padStart(4, '0')}`;
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
patientSchema.methods.comparePassword = async function(candidatePassword) {
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

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient; 
