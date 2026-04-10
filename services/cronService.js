const cron = require('node-cron');
const axios = require('axios');
const CronExecution = require('../models/CronExecution');

class CronService {
  constructor() {
    this.isRunning = false;
  }

  // Check if we missed today's 8 AM execution and run it if needed
  async checkForMissedExecution() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // If it's after 8 AM today, check if we missed the execution
      if (currentHour > 8 || (currentHour === 8 && currentMinute > 0)) {
        // Check if we already ran today
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        const existingExecution = await CronExecution.findOne({
          jobName: 'treatment_reminders',
          executionDate: { $gte: today }
        });
        
        if (!existingExecution) {
          await this.sendTreatmentReminders();
        }
      }
    } catch (error) {
      console.error('Error checking for missed execution:', error);
    }
  }

  // Start the cron job service
  start() {
    if (this.isRunning) {
      return;
    }
    
    // Check if we missed today's 8 AM execution
    this.checkForMissedExecution();
    
    // Schedule treatment reminders to run daily at 8:00 AM
    const treatmentReminderJob = cron.schedule('0 8 * * *', async () => {
      await this.sendTreatmentReminders();
    }, {
      scheduled: true,
      timezone: "Asia/Manila" // Philippines timezone
    });

    // Schedule a test job to run every minute (for testing)
    const testJob = cron.schedule('* * * * *', async () => {
      // Uncomment the line below to test treatment reminders
      // await this.sendTreatmentReminders();
    }, {
      scheduled: false, // Set to true to enable test job
      timezone: "Asia/Manila"
    });

    this.isRunning = true;
  }

  // Stop the cron service
  stop() {
    if (!this.isRunning) {
      return;
    }

    cron.destroy();
    this.isRunning = false;
  }

  // Send treatment reminders
  async sendTreatmentReminders() {
    let executionRecord = null;
    
    try {
      // Record the execution start
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      executionRecord = new CronExecution({
        jobName: 'treatment_reminders',
        executionDate: today,
        status: 'running',
        executedAt: new Date()
      });
      const savedRecord = await executionRecord.save();
      
      // Import the notification function directly instead of making HTTP request
      const { sendTreatmentReminders } = require('../routes/notifications');
      
      // Call the function directly
      const result = await sendTreatmentReminders();
      
      // Update execution record with success
      if (executionRecord) {
        await CronExecution.findByIdAndUpdate(executionRecord._id, {
          status: 'success',
          results: {
            totalTreatments: result.totalTreatments || 0,
            notificationsSent: result.notificationsSent || 0,
            errors: []
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error sending treatment reminders:', error.message);
      
      // Update execution record with failure
      if (executionRecord) {
        await CronExecution.findByIdAndUpdate(executionRecord._id, {
          status: 'failed',
          errorMessage: error.message,
          results: {
            totalTreatments: 0,
            notificationsSent: 0,
            errors: [error.message]
          }
        });
      }
      
      throw error;
    }
  }

  // Manual trigger for testing
  async triggerTreatmentReminders() {
    try {
      const result = await this.sendTreatmentReminders();
      return result;
    } catch (error) {
      console.error('❌ Manual trigger failed:', error.message);
      throw error;
    }
  }

  // Get cron service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      timezone: 'Asia/Manila',
      scheduledJobs: [
        {
          name: 'Treatment Reminders',
          schedule: '0 8 * * *',
          description: 'Daily at 8:00 AM',
          timezone: 'Asia/Manila'
        }
      ]
    };
  }
}

// Create singleton instance
const cronService = new CronService();

module.exports = cronService;

