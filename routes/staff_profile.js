const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');
const mongoose = require('mongoose');

// Get staff profile by ID
router.get('/:id', async (req, res) => {
  try {
    const staff = await Staff.findOne({ staffId: req.params.id });

    if (!staff) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    // Format the response data
    const staffData = {
      id: staff.staffId,
      firstName: staff.firstName,
      middleName: staff.middleName || '',
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone,
      additionalContactNumber: staff.additionalContactNumber || '',
      birthdate: staff.birthdate,
      role: staff.role,
      position: staff.position || '',
      department: staff.department || '',
      officeAddress: staff.officeAddress || '',
      isApproved: staff.isApproved,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt
    };

    res.json(staffData);
  } catch (error) {
    console.error('Error fetching staff profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update staff profile
router.put('/:id', async (req, res) => {
  try {
    const staff = await Staff.findOne({ staffId: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    // Update only the fields that are provided in the request
    const updateFields = [
      'firstName', 'middleName', 'lastName', 'phone', 'additionalContactNumber',
      'position', 'department', 'officeAddress'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        staff[field] = req.body[field];
      }
    });

    // Update the updatedAt timestamp
    staff.updatedAt = new Date();

    // Save the updated staff
    await staff.save();

    // Format the response data
    const updatedStaffData = {
      id: staff.staffId,
      firstName: staff.firstName,
      middleName: staff.middleName || '',
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone,
      additionalContactNumber: staff.additionalContactNumber || '',
      birthdate: staff.birthdate,
      role: staff.role,
      position: staff.position || '',
      department: staff.department || '',
      officeAddress: staff.officeAddress || '',
      isApproved: staff.isApproved,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt
    };

    res.json(updatedStaffData);
  } catch (error) {
    console.error('Error updating staff profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 
