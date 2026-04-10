const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const Patient = require('../models/Patient');
const VaccinationDate = require('../models/VaccinationDate');
const BiteCase = require('../models/BiteCase');
const FCMToken = require('../models/FCMToken');

// Initialize Firebase Admin SDK (you'll need to add your service account key)
let serviceAccount;
try {
  // In production, use environment variable for service account key
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // For development, you can use a local service account file
    serviceAccount = require('../firebase-service-account.json');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK not initialized:', error.message);
  console.warn('⚠️ Push notifications will not work without proper Firebase configuration');
}

// FCM tokens are now stored in MongoDB database
// No need for in-memory storage - tokens persist across restarts

// Register FCM token for a user
router.post('/register-token', async (req, res) => {
  try {
    const { userId, userRole, fcmToken, platform } = req.body;
    
    if (!userId || !fcmToken) {
      return res.status(400).json({ 
        message: 'User ID and FCM token are required' 
      });
    }

    // Generate a device ID based on the FCM token (same token = same device)
    const deviceId = fcmToken.substring(0, 20); // Use first 20 chars as device identifier
    
    // Store token in database (persists across restarts)
    const tokenData = {
      userId,
      fcmToken,
      platform: platform || 'flutter',
      deviceId,
      userRole,
      isActive: true,
      registeredAt: new Date(),
      lastUsedAt: new Date()
    };

    // Upsert token (update if exists, insert if new)
    await FCMToken.findOneAndUpdate(
      { fcmToken: fcmToken },
      tokenData,
      { upsert: true, new: true }
    );

    // Get count of users on this device
    const usersOnDevice = await FCMToken.find({ 
      deviceId: deviceId, 
      isActive: true 
    }).distinct('userId');

    res.json({ 
      message: 'FCM token registered successfully',
      userId,
      userRole,
      deviceId,
      usersOnDevice: usersOnDevice
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Send notification to specific user
router.post('/send-to-user', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    
    if (!userId || !title || !body) {
      return res.status(400).json({ 
        message: 'User ID, title, and body are required' 
      });
    }

    // Find user's token in database
    const userToken = await FCMToken.findOne({ 
      userId: userId, 
      isActive: true 
    });
    
    if (!userToken) {
      return res.status(404).json({ 
        message: 'User token not found' 
      });
    }

    const message = {
      token: userToken.fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await admin.messaging().send(message);
    
    res.json({ 
      message: 'Notification sent successfully',
      messageId: response 
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Function to send treatment reminder notifications
async function sendTreatmentReminders() {
  try {
    // Get all patients with treatments scheduled for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find vaccination dates where any dose is scheduled for today and not completed
    // Also exclude if overall treatment is completed
    const todayTreatments = await VaccinationDate.find({
      $and: [
        {
          $or: [
            { d0Date: { $gte: today, $lt: tomorrow }, d0Status: { $ne: 'completed' } },
            { d3Date: { $gte: today, $lt: tomorrow }, d3Status: { $ne: 'completed' } },
            { d7Date: { $gte: today, $lt: tomorrow }, d7Status: { $ne: 'completed' } },
            { d14Date: { $gte: today, $lt: tomorrow }, d14Status: { $ne: 'completed' } },
            { d28Date: { $gte: today, $lt: tomorrow }, d28Status: { $ne: 'completed' } }
          ]
        },
        { treatmentStatus: { $ne: 'completed' } }
      ]
    });

    let notificationsSent = 0;
    const results = [];

    for (const treatment of todayTreatments) {
      try {
        // Find which dose is scheduled for today
        let todayDose = null;
        let doseName = '';
        
        if (treatment.d0Date && treatment.d0Date >= today && treatment.d0Date < tomorrow && treatment.d0Status !== 'completed') {
          todayDose = treatment.d0Date;
          doseName = 'D0';
        } else if (treatment.d3Date && treatment.d3Date >= today && treatment.d3Date < tomorrow && treatment.d3Status !== 'completed') {
          todayDose = treatment.d3Date;
          doseName = 'D3';
        } else if (treatment.d7Date && treatment.d7Date >= today && treatment.d7Date < tomorrow && treatment.d7Status !== 'completed') {
          todayDose = treatment.d7Date;
          doseName = 'D7';
        } else if (treatment.d14Date && treatment.d14Date >= today && treatment.d14Date < tomorrow && treatment.d14Status !== 'completed') {
          todayDose = treatment.d14Date;
          doseName = 'D14';
        } else if (treatment.d28Date && treatment.d28Date >= today && treatment.d28Date < tomorrow && treatment.d28Status !== 'completed') {
          todayDose = treatment.d28Date;
          doseName = 'D28';
        }

        if (!todayDose) continue;

        // Get patient's FCM token from database
        const userToken = await FCMToken.findOne({ 
          userId: treatment.patientId, 
          isActive: true 
        });
        
        if (!userToken) {
          continue;
        }

        // Fetch patient name from database
        let patientName = 'Patient';
        try {
          const patient = await Patient.findOne({ patientId: treatment.patientId });
          if (patient) {
            patientName = `${patient.firstName} ${patient.lastName}`.trim();
          }
        } catch (error) {
        }

        // Check if this device has multiple users
        const deviceId = userToken.deviceId;
        const usersOnDevice = await FCMToken.find({ 
          deviceId: deviceId, 
          isActive: true 
        }).distinct('userId');
        const isMultiUserDevice = usersOnDevice.length > 1;

        const title = 'Treatment Reminder';
        let body;
        
        if (isMultiUserDevice) {
          // Include patient name for multi-user devices
          body = `📋 ${patientName} has a ${doseName} treatment scheduled today. Please visit the center for vaccination.`;
        } else {
          // Standard message for single-user devices
          body = `Hello ${patientName}, you have a ${doseName} treatment scheduled today. Please visit the center for your vaccination.`;
        }

        const message = {
          token: userToken.fcmToken,
          notification: {
            title,
            body,
          },
          data: {
            type: 'treatment_reminder',
            treatmentId: treatment._id.toString(),
            patientId: treatment.patientId,
            patientName: patientName,
            doseName: doseName,
            scheduledDate: todayDose.toISOString(),
            isMultiUserDevice: isMultiUserDevice.toString(),
            usersOnDevice: usersOnDevice.join(',')
          },
        };

        const response = await admin.messaging().send(message);
        
        notificationsSent++;
        results.push({
          patientId: treatment.patientId,
          patientName: patientName,
          treatmentId: treatment._id,
          doseName: doseName,
          messageId: response,
          isMultiUserDevice: isMultiUserDevice,
          usersOnDevice: usersOnDevice,
          success: true
        });

      } catch (error) {
        console.error(`Error sending reminder to patient ${treatment.patientId}:`, error);
        results.push({
          patientId: treatment.patientId,
          treatmentId: treatment._id,
          success: false,
          error: error.message
        });
      }
    }

    return {
      message: 'Treatment reminders processed',
      totalTreatments: todayTreatments.length,
      notificationsSent,
      results
    };

  } catch (error) {
    console.error('Error sending treatment reminders:', error);
    throw error;
  }
}

// Send treatment reminder notifications
router.post('/send-treatment-reminders', async (req, res) => {
  try {
    const result = await sendTreatmentReminders();
    res.json(result);
  } catch (error) {
    console.error('Error sending treatment reminders:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get user's FCM token status
router.get('/token-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user's token in database
    const userToken = await FCMToken.findOne({ 
      userId: userId, 
      isActive: true 
    });
    
    if (!userToken) {
      return res.status(404).json({ 
        message: 'User token not found' 
      });
    }

    // Get all users on this device
    const usersOnDevice = await FCMToken.find({ 
      deviceId: userToken.deviceId, 
      isActive: true 
    }).distinct('userId');

    res.json({
      userId,
      hasToken: true,
      platform: userToken.platform,
      deviceId: userToken.deviceId,
      registeredAt: userToken.registeredAt,
      lastUsedAt: userToken.lastUsedAt,
      usersOnDevice: usersOnDevice
    });
  } catch (error) {
    console.error('Error getting token status:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get all users on a device
router.get('/device-users/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Get all active users on this device from database
    const usersOnDevice = await FCMToken.find({ 
      deviceId: deviceId, 
      isActive: true 
    }).distinct('userId');
    
    res.json({
      deviceId,
      usersOnDevice,
      totalUsers: usersOnDevice.length
    });
  } catch (error) {
    console.error('Error getting device users:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Remove user's FCM token
router.delete('/remove-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user's token in database
    const userToken = await FCMToken.findOne({ userId: userId, isActive: true });
    
    if (!userToken) {
      return res.status(404).json({ 
        message: 'User token not found' 
      });
    }

    // Mark token as inactive instead of deleting (for audit trail)
    await FCMToken.findByIdAndUpdate(userToken._id, { 
      isActive: false,
      lastUsedAt: new Date()
    });

    // Get remaining users on this device
    const remainingUsersOnDevice = await FCMToken.find({ 
      deviceId: userToken.deviceId, 
      isActive: true 
    }).distinct('userId');

    res.json({ 
      message: 'FCM token removed successfully',
      userId,
      remainingUsersOnDevice: remainingUsersOnDevice
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Test notification endpoint
router.post('/test-notification', async (req, res) => {
  try {
    const { userId, title, body } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        message: 'User ID is required' 
      });
    }

    // Find user's token in database
    const userToken = await FCMToken.findOne({ 
      userId: userId, 
      isActive: true 
    });
    
    if (!userToken) {
      return res.status(404).json({ 
        message: 'User token not found' 
      });
    }

    const message = {
      token: userToken.fcmToken,
      notification: {
        title: title || 'Test Notification',
        body: body || 'This is a test notification from BiteAlert',
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await admin.messaging().send(message);
    
    res.json({ 
      message: 'Test notification sent successfully',
      messageId: response 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router;
module.exports.sendTreatmentReminders = sendTreatmentReminders;

