const mongoose = require('mongoose');

const biteCaseSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true
  },
  philhealthNo: {
    type: String,
    required: false,
    default: ''
  },
  dateRegistered: {
    type: String,
    required: true
  },
  arrivalDate: {
    type: String,
    required: false,
    default: ''
  },
  arrivalTime: {
    type: String,
    required: false,
    default: ''
  },
  firstName: {
    type: String,
    required: true
  },
  middleName: {
    type: String,
    required: false,
    default: ''
  },
  lastName: {
    type: String,
    required: true
  },
  civilStatus: {
    type: String,
    required: false,
    default: ''
  },
  birthdate: {
    type: String,
    required: false,
    default: ''
  },
  birthplace: {
    type: String,
    required: false,
    default: ''
  },
  nationality: {
    type: String,
    required: false,
    default: ''
  },
  religion: {
    type: String,
    required: false,
    default: ''
  },
  occupation: {
    type: String,
    required: false,
    default: ''
  },
  contactNo: {
    type: String,
    required: false,
    default: ''
  },
  houseNo: {
    type: String,
    required: true
  },
  street: {
    type: String,
    required: true
  },
  barangay: {
    type: String,
    required: true
  },
  subdivision: {
    type: String,
    required: false,
    default: ''
  },
  city: {
    type: String,
    required: true
  },
  province: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  age: {
    type: String,
    required: true
  },
  weight: {
    type: String,
    required: true
  },
  sex: {
    type: String,
    required: true
  },
  center: {
    type: String,
    required: true
  },
  scheduleDates: {
    type: [String],
    required: true
  },
  animalStatus: {
    type: String
  },
  remarks: {
    type: String
  },
  
  // History of Bite - Using Arrays
  dateOfInquiry: {
    type: String,
    required: false,
    default: ''
  },
  timeOfInjury: {
    type: String,
    required: false,
    default: ''
  },
  
  // Type of Exposure - Array of selected types
  typeOfExposure: {
    type: [String],
    default: [],
    enum: ['NON-BITE', 'BITE']
  },
  
  // Site of Bite - Array of selected sites
  siteOfBite: {
    type: [String],
    default: [],
    enum: ['Head', 'Face', 'Neck', 'Chest', 'Back', 'Abdomen', 'Upper Extremities', 'Lower Extremities', 'Others']
  },
  othersBiteSpecify: {
    type: String,
    required: false,
    default: ''
  },
  
  // Nature of Injury - Array of selected injuries
  natureOfInjury: {
    type: [String],
    default: [],
    enum: ['Multiple Injuries', 'Abrasion', 'Avulsion', 'Burn', 'Concussion', 'Contusion', 'Open Wound', 'Trauma', 'Others']
  },
  burnDegree: {
    type: Number,
    required: false,
    default: 0
  },
  burnSite: {
    type: String,
    required: false,
    default: ''
  },
  // Text fields for specific injury details
  othersInjuryDetails: {
    type: String,
    required: false,
    default: ''
  },
  
  // External Cause - Array of selected causes
  externalCause: {
    type: [String],
    default: [],
    enum: ['Bite/Sting', 'Chemical Substance']
  },
  biteStingDetails: {
    type: String,
    required: false,
    default: ''
  },
  chemicalSubstanceDetails: {
    type: String,
    required: false,
    default: ''
  },
  
  // Place of Occurrence - Array of selected places
  placeOfOccurrence: {
    type: [String],
    default: [],
    enum: ['Home', 'School', 'Road', 'Neighbor', 'Others']
  },
  placeOthersDetails: {
    type: String,
    required: false,
    default: ''
  },
  
  // Disposition - Array of selected dispositions
  disposition: {
    type: [String],
    default: [],
    enum: ['Treated & Sent Home', 'Transferred to another facility/hospital']
  },
  transferredTo: {
    type: String,
    required: false,
    default: ''
  },
  
  // Circumstance of Bite - Array of selected circumstances
  circumstanceOfBite: {
    type: [String],
    default: [],
    enum: ['Provoked', 'Unprovoked']
  },
  
  // Animal Profile - Using nested objects for better organization
  animalProfile: {
    species: {
      type: [String],
      default: [],
      enum: ['Dog', 'Cat', 'Others']
    },
    othersSpecify: {
      type: String,
      required: false,
      default: ''
    },
    clinicalStatus: {
      type: [String],
      default: [],
      enum: ['Healthy', 'Sick', 'Died', 'Killed']
    },
    brainExam: {
      type: [String],
      default: [],
      enum: ['Brain Exam Done', 'No Brain Exam', 'Unknown']
    },
    vaccinationStatus: {
      type: [String],
      default: [],
      enum: ['Immunized', 'Not Immunized']
    },
    vaccinationDate: {
      type: String,
      required: false,
      default: ''
    },
    ownership: {
      type: [String],
      default: [],
      enum: ['Pet', 'Neighbor', 'Stray']
    }
  },
  
  // Management - Complete management object
  management: {
    washingWound: {
      type: [String],
      default: [],
      enum: ['Yes', 'No']
    },
    category: {
      type: [String],
      default: [],
      enum: ['Category 1', 'Category 2', 'Category 3']
    },
    diagnosis: {
      type: String,
      required: false,
      default: ''
    },
    allergyHistory: {
      type: String,
      required: false,
      default: ''
    },
    maintenanceMedications: {
      type: String,
      required: false,
      default: ''
    },
    managementDetails: {
      type: String,
      required: false,
      default: ''
    }
  },
  
  // Patient Immunization - Using nested objects
  patientImmunization: {
    dpt: {
      type: [String],
      default: [],
      enum: ['Complete', 'Incomplete', 'None']
    },
    dptYearGiven: {
      type: String,
      required: false,
      default: ''
    },
    dptDosesGiven: {
      type: String,
      required: false,
      default: ''
    },
    tt: {
      type: [String],
      default: [],
      enum: ['Active', 'Passive']
    },
    ttDates: {
      type: [String],
      default: []
    },
    skinTest: {
      type: Boolean,
      default: false
    },
    skinTestTime: {
      type: String,
      required: false,
      default: ''
    },
    skinTestReadTime: {
      type: String,
      required: false,
      default: ''
    },
    skinTestResult: {
      type: String,
      required: false,
      default: ''
    },
    skinTestDose: {
      type: String,
      required: false,
      default: ''
    },
    skinTestDate: {
      type: String,
      required: false,
      default: ''
    },
    tig: {
      type: Boolean,
      default: false
    },
    tigDose: {
      type: String,
      required: false,
      default: ''
    },
    tigDate: {
      type: String,
      required: false,
      default: ''
    }
   },
   
   
   // Current Anti-Rabies Immunization - Using nested objects
  currentImmunization: {
    type: {
      type: [String],
      default: [],
      enum: ['Active', 'Post-exposure', 'Pre-exposure', 'Previously Immunized']
    },
    vaccine: {
      type: [String],
      default: [],
      enum: ['PVRV', 'PCEC']
    },
    route: {
      type: [String],
      default: [],
      enum: ['ID', 'IM']
    },
    passive: {
      type: Boolean,
      default: false
    },
    skinTest: {
      type: Boolean,
      default: false
    },
    skinTestTime: {
      type: String,
      required: false,
      default: ''
    },
    skinTestReadTime: {
      type: String,
      required: false,
      default: ''
    },
    skinTestResult: {
      type: String,
      required: false,
      default: ''
    },
    skinTestDate: {
      type: String,
      required: false,
      default: ''
    },
    hrig: {
      type: Boolean,
      default: false
    },
    hrigDose: {
      type: String,
      required: false,
      default: ''
    },
    hrigDate: {
      type: String,
      required: false,
      default: ''
    },
    localInfiltration: {
      type: Boolean,
      default: false
    },
     schedule: {
       type: [String],
       default: [],
       enum: ['Structured', 'Unstructured']
     },

          // ERIG Section - Before D0
      erig: {
        dateTaken: {
          type: String,
          required: false,
          default: ''
        },
        medicineUsed: {
          type: String,
          required: false,
          default: ''
        },
        branchNo: {
          type: String,
          required: false,
          default: ''
        }
        
      },
     // Dose-specific medicine and branch tracking
     doseMedicines: [{
       dose: {
         type: String,
         required: false,
         default: ''
       },
       medicineUsed: {
         type: String,
         required: false,
         default: ''
       },
       branchNo: {
         type: String,
         required: false,
         default: ''
       }
     }]
   },
  
  status: {
    type: String,
    default: 'in_progress'
  },
  
  // Assessment tracking
  initiallyAssessedBy: {
    type: String,
    required: false,
    default: ''
  },
  finalAssessedBy: {
    type: String,
    required: false,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BiteCase', biteCaseSchema);
