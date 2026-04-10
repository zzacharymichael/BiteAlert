const express = require('express');
const router = express.Router();
const VaccinationDate = require('../models/VaccinationDate');
const mongoose = require('mongoose');
const AuditTrail = require('../models/AuditTrail');
const Staff = require('../models/Staff');
const Patient = require('../models/Patient');
const BiteCase = require('../models/BiteCase');
const jwt = require('jsonwebtoken');

async function resolveStaff(req) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if ((decoded.role || '').toLowerCase() === 'staff') {
        const staff = await Staff.findOne({ staffId: decoded.userId });
        if (staff) return staff;
      }
    }
    // Fallback to headers
    const headerStaffId = (req.headers['x-staff-id'] || '').toString();
    if (headerStaffId) {
      const staff = await Staff.findOne({ staffId: headerStaffId });
      if (staff) return staff;
    }
  } catch (_) {}
  return null;
}

// Create vaccination dates for a bite case
router.post('/', async (req, res) => {
  try {
    const vaccinationDateData = {
      ...req.body,
      treatmentStatus: req.body.treatmentStatus || 'in_progress'
    };
    const vaccinationDate = new VaccinationDate(vaccinationDateData);
    const savedVaccinationDate = await vaccinationDate.save();
    res.status(201).json(savedVaccinationDate);
  } catch (error) {
    console.error('Error creating vaccination dates:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get vaccination dates by bite case ID
router.get('/bite-case/:biteCaseId', async (req, res) => {
  try {
    const vaccinationDates = await VaccinationDate.find({ biteCaseId: req.params.biteCaseId });
    res.json(vaccinationDates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get vaccination dates by patient ID
router.get('/patient/:patientId', async (req, res) => {
  try {
    const vaccinationDates = await VaccinationDate.find({ patientId: req.params.patientId });
    res.json(vaccinationDates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all vaccination dates
router.get('/', async (req, res) => {
  try {
    const vaccinationDates = await VaccinationDate.find();
    res.json(vaccinationDates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update vaccination dates
router.put('/:id', async (req, res) => {
  try {
    // Get the existing record first
    const existingVaccinationDate = await VaccinationDate.findById(req.params.id);
    if (!existingVaccinationDate) {
      return res.status(404).json({ message: 'Vaccination dates not found' });
    }

    // Create update data without modifying d14Status and d28Status
    const vaccinationDateData = {
      d0Date: req.body.d0Date,
      d3Date: req.body.d3Date,
      d7Date: req.body.d7Date,
      d14Date: req.body.d14Date,
      d28Date: req.body.d28Date,
      d0Status: req.body.d0Status,
      d3Status: req.body.d3Status,
      d7Status: req.body.d7Status,
      treatmentStatus: req.body.treatmentStatus // Always use the provided treatment status
    };

    // Only update d14Status and d28Status if they are explicitly provided
    if (req.body.d14Status) {
      vaccinationDateData.d14Status = req.body.d14Status;
    }
    if (req.body.d28Status) {
      vaccinationDateData.d28Status = req.body.d28Status;
    }

    const updatedVaccinationDate = await VaccinationDate.findByIdAndUpdate(
      req.params.id,
      vaccinationDateData,
      { new: true, runValidators: true }
    );

    if (!updatedVaccinationDate) {
      return res.status(404).json({ message: 'Vaccination dates not found' });
    }
    // Keep bite_cases.scheduleDates in sync with vaccination dates
    try {
      const scheduleDates = [
        updatedVaccinationDate.d0Date || '',
        updatedVaccinationDate.d3Date || '',
        updatedVaccinationDate.d7Date || '',
        updatedVaccinationDate.d14Date || '',
        updatedVaccinationDate.d28Date || '',
      ].filter(Boolean);
      if (scheduleDates.length > 0) {
        await BiteCase.findOneAndUpdate(
          { registrationNumber: updatedVaccinationDate.registrationNumber },
          { $set: { scheduleDates } },
          { new: false }
        );
      }
    } catch (syncErr) {
      console.error('Failed to sync scheduleDates to bite_cases:', syncErr);
    }

    // Write audit trail per dose status change
    try {
      const staff = await resolveStaff(req);
      const doseLabels = {
        d0Status: 'Day 0',
        d3Status: 'Day 3',
        d7Status: 'Day 7',
        d14Status: 'Day 14',
        d28Status: 'Day 28/30',
      };

      // Load patient name if possible
      let patientName = '';
      try {
        const biteCase = await BiteCase.findOne({ registrationNumber: existingVaccinationDate.registrationNumber });
        if (biteCase) {
          patientName = [biteCase.firstName, biteCase.middleName, biteCase.lastName].filter(Boolean).join(' ').trim();
        } else if (existingVaccinationDate.patientId) {
          const patient = await Patient.findOne({ patientId: existingVaccinationDate.patientId });
          if (patient) patientName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ').trim();
        }
      } catch (_) {}

      const prev = existingVaccinationDate;
      const curr = updatedVaccinationDate;
      const statusKeys = ['d0Status','d3Status','d7Status','d14Status','d28Status'];
      for (const key of statusKeys) {
        const before = prev[key];
        const after = curr[key];
        if (before !== after && typeof after === 'string' && after.toLowerCase() === 'completed') {
          const label = doseLabels[key] || key;
          await AuditTrail.create({
            role: 'Staff',
            firstName: staff?.firstName || '',
            middleName: staff?.middleName || '',
            lastName: staff?.lastName || '',
            centerName: staff?.officeAddress || '',
            action: `Completed ${label} vaccination for ${patientName}`,
            patientName: patientName,
            // Ensure ID column shows the staff ID for vaccination completion actions
            patientID: null,
            staffID: staff?.staffId || null,
          });
        }
      }

      // Write audit trail per dose date reschedule (when date fields change)
      const dateKeys = [
        { key: 'd0Date', label: 'Day 0' },
        { key: 'd3Date', label: 'Day 3' },
        { key: 'd7Date', label: 'Day 7' },
        { key: 'd14Date', label: 'Day 14' },
        { key: 'd28Date', label: 'Day 28/30' },
      ];
      for (const { key, label } of dateKeys) {
        const beforeDate = prev[key] ? new Date(prev[key]).toISOString() : '';
        const afterDate = curr[key] ? new Date(curr[key]).toISOString() : '';
        if (beforeDate !== afterDate) {
          // Dedupe: avoid duplicate reschedule logs within a short window
          const recentSince = new Date(Date.now() - 3000);
          const recent = await AuditTrail.findOne({
            action: `Rescheduled ${label} vaccination for ${patientName}`,
            staffID: staff?.staffId || null,
            timestamp: { $gte: recentSince }
          }).sort({ timestamp: -1 });
          if (!recent) {
            await AuditTrail.create({
              role: 'Staff',
              firstName: staff?.firstName || '',
              middleName: staff?.middleName || '',
              lastName: staff?.lastName || '',
              centerName: staff?.officeAddress || '',
              action: `Rescheduled ${label} vaccination for ${patientName}`,
              patientName: patientName,
              patientID: null,
              staffID: staff?.staffId || null,
            });
          }
        }
      }

    } catch (auditErr) {
      console.error('Failed to write audit for vaccination status update:', auditErr);
    }

    res.json(updatedVaccinationDate);
  } catch (error) {
    console.error('Error updating vaccination dates:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(400).json({ 
      message: error.message,
      details: error.name === 'ValidationError' ? error.errors : undefined
    });
  }
});

module.exports = router; 
