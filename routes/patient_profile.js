const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// Get all patients
router.get('/', async (req, res) => {
  try {
    const patients = await Patient.find({}, {
      firstName: 1,
      middleName: 1,
      lastName: 1,
      patientId: 1,
      barangay: 1 // <-- add this
    });
    
    const formattedPatients = patients.map(patient => ({
      id: patient.patientId,
      firstName: patient.firstName,
      middleName: patient.middleName || '',
      lastName: patient.lastName,
      barangay: patient.barangay || '' // <-- add this
    }));
    
    res.json(formattedPatients);
  } catch (error) {
    console.error('Error fetching all patients:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get patient profile by ID
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id });

    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    // Format the response data
    const patientData = {
      id: patient.patientId,
      firstName: patient.firstName,
      middleName: patient.middleName || '',
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      additionalContactNumber: patient.additionalContactNumber || '',
      birthdate: patient.birthdate,
      role: patient.role,
      houseNo: patient.houseNo || '',
      street: patient.street || '',
      barangay: patient.barangay || '',
      subdivision: patient.subdivision || '',
      city: patient.city || '',
      province: patient.province || '',
      zipCode: patient.zipCode || '',
      birthPlace: patient.birthPlace || '',
      religion: patient.religion || '',
      occupation: patient.occupation || '',
      nationality: patient.nationality || '',
      civilStatus: patient.civilStatus || '',
      sex: patient.sex || '',
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };

    res.json(patientData);
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update patient profile
router.put('/:id', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id });
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    // Update only the fields that are provided in the request
    const updateFields = [
      'firstName', 'middleName', 'lastName', 'phone', 'additionalContactNumber',
      'houseNo', 'street', 'barangay', 'subdivision',
      'city', 'province', 'zipCode', 'birthPlace',
      'religion', 'occupation', 'nationality',
      'civilStatus', 'sex'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    // Update the updatedAt timestamp
    patient.updatedAt = new Date();

    // Save the updated patient
    await patient.save();

    // Format the response data
    const updatedPatientData = {
      id: patient.patientId,
      firstName: patient.firstName,
      middleName: patient.middleName || '',
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      additionalContactNumber: patient.additionalContactNumber || '',
      birthdate: patient.birthdate,
      role: patient.role,
      houseNo: patient.houseNo || '',
      street: patient.street || '',
      barangay: patient.barangay || '',
      subdivision: patient.subdivision || '',
      city: patient.city || '',
      province: patient.province || '',
      zipCode: patient.zipCode || '',
      birthPlace: patient.birthPlace || '',
      religion: patient.religion || '',
      occupation: patient.occupation || '',
      nationality: patient.nationality || '',
      civilStatus: patient.civilStatus || '',
      sex: patient.sex || '',
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };

    res.json(updatedPatientData);
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 
