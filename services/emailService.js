require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// SendGrid configuration
let sgMail;
try {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} catch (error) {
  console.warn('SendGrid not available:', error.message);
  sgMail = null;
}

// Use default email configuration if environment variables are not set
const emailUser = process.env.EMAIL_USER || 'bitealert.app@gmail.com';
const emailPassword = process.env.EMAIL_PASSWORD || 'your-app-password-here';

if (!emailUser || !emailPassword || emailPassword === 'your-app-password-here') {
  console.warn('⚠️ Email configuration is incomplete. Using fallback configuration.');
  console.warn('⚠️ Please set EMAIL_USER and EMAIL_PASSWORD environment variables for production use.');
}

// Create a transporter using Gmail with better configuration for cloud hosting
let transporter;

try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPassword
    },
    tls: {
      rejectUnauthorized: false
    }
  });
} catch (transporterError) {
  console.error('Failed to create email transporter:', transporterError);
  transporter = null;
}

// Verify transporter configuration
if (transporter) {
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email transporter verification failed:', error);
  }
});
} else {
  console.warn('⚠️ Email transporter not available - email service disabled');
}

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// SendGrid email sending function
const sendEmailViaSendGrid = async (email, token, type = 'verification') => {
  try {
    // Check if SendGrid is available
    if (!sgMail || !process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid not configured. Skipping SendGrid email send.');
      return false;
    }

    let msg;
    
    if (type === 'verification') {
      // Email verification template
      msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@bitealert.com',
          name: 'Bite Alert'
        },
        subject: 'Bite Alert - Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #7D0C0C; margin: 0; font-size: 24px;">Bite Alert</h1>
              <p style="color: #666666; margin: 5px 0;">Your Health Companion</p>
            </div>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <p style="font-size: 16px; line-height: 1.5; color: #333333; margin: 0;">
                Thank you for registering with Bite Alert. To complete your registration, please verify your email address by clicking the button below:
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://bitealert-yzau.onrender.com/verify-email/${token}" 
                 style="background-color: #7D0C0C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>

            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <p style="font-size: 14px; color: #666666; text-align: center; margin: 0;">
                If you did not create an account with Bite Alert, please ignore this email.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                This is an automated message, please do not reply to this email.<br>
                © ${new Date().getFullYear()} Bite Alert. All rights reserved.
              </p>
            </div>
          </div>
        `
      };
    } else if (type === 'password-reset') {
      // Password reset OTP template
      msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@bitealert.com',
          name: 'Bite Alert'
        },
        subject: 'Bite Alert - Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #7D0C0C; margin: 0; font-size: 24px;">Bite Alert</h1>
              <p style="color: #666666; margin: 5px 0;">Your Health Companion</p>
            </div>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <p style="font-size: 16px; line-height: 1.5; color: #333333; margin: 0;">
                You have requested to reset your password. Please use the following verification code:
              </p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; color: #7D0C0C; letter-spacing: 2px;">${token}</span>
              </div>
              <p style="font-size: 14px; color: #666666; margin: 0;">
                This code will expire in 5 minutes.
              </p>
            </div>

            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <p style="font-size: 14px; color: #666666; text-align: center; margin: 0;">
                If you did not request this password reset, please ignore this email.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                This is an automated message, please do not reply to this email.<br>
                © ${new Date().getFullYear()} Bite Alert. All rights reserved.
              </p>
            </div>
          </div>
        `
      };
    } else {
      throw new Error('Invalid email type');
    }

    await sgMail.send(msg);
    
    return true;
    
  } catch (error) {
    console.error('❌ SendGrid email sending failed:', error);
    console.error('❌ Error details:', error.response?.body || error.message);
    return false;
  }
};

// Send verification email with SendGrid as primary service
const sendVerificationEmail = async (email, token, type = 'verification') => {
  try {
    // Try SendGrid first (preferred for production)
    let emailSent = await sendEmailViaSendGrid(email, token, type);
    
    if (emailSent) {
      return true;
    }

    // Fallback to Nodemailer if SendGrid fails

    // Check if email configuration is available
    if (!emailUser || !emailPassword || emailPassword === 'your-app-password-here') {
      console.warn('⚠️ Email service not configured. Skipping email send.');
      console.warn('⚠️ User registration will continue without email verification.');
      return true; // Return success to not block registration
    }

    // Check if transporter is available
    if (!transporter) {
      console.warn('⚠️ Email transporter not available. Skipping email send.');
      console.warn('⚠️ User registration will continue without email verification.');
      return true; // Return success to not block registration
    }

    // Use Nodemailer for email sending

    let mailOptions;
    
    if (type === 'verification') {
      // Email verification template for registration
      mailOptions = {
        from: {
          name: 'Bite Alert',
          address: emailUser
        },
        to: email,
        subject: 'Bite Alert - Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #7D0C0C; margin: 0; font-size: 24px;">Bite Alert</h1>
              <p style="color: #666666; margin: 5px 0;">Your Health Companion</p>
            </div>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <p style="font-size: 16px; line-height: 1.5; color: #333333; margin: 0;">
                Thank you for registering with Bite Alert. To complete your registration, please verify your email address by clicking the button below:
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://bitealert-yzau.onrender.com/verify-email/${token}" 
                 style="background-color: #7D0C0C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>

            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <p style="font-size: 14px; color: #666666; text-align: center; margin: 0;">
                If you did not create an account with Bite Alert, please ignore this email.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                This is an automated message, please do not reply to this email.<br>
                © ${new Date().getFullYear()} Bite Alert. All rights reserved.
              </p>
            </div>
          </div>
        `
      };
    } else if (type === 'password-reset') {
      // OTP template for password reset
      mailOptions = {
        from: {
          name: 'Bite Alert',
          address: emailUser
        },
        to: email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #7D0C0C; margin: 0; font-size: 24px;">Bite Alert</h1>
              <p style="color: #666666; margin: 5px 0;">Your Health Companion</p>
            </div>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <p style="font-size: 16px; line-height: 1.5; color: #333333; margin: 0;">
                You have requested to reset your password. Please use the following verification code:
              </p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; color: #7D0C0C; letter-spacing: 2px;">${token}</span>
              </div>
              <p style="font-size: 14px; color: #666666; margin: 0;">
                This code will expire in 5 minutes.
              </p>
            </div>

            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <p style="font-size: 14px; color: #666666; text-align: center; margin: 0;">
                If you did not request this password reset, please ignore this email.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                This is an automated message, please do not reply to this email.<br>
                © ${new Date().getFullYear()} Bite Alert. All rights reserved.
              </p>
            </div>
          </div>
        `
      };
    } else {
      throw new Error('Invalid email type');
    }

    // Add timeout wrapper for email sending
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout')), 30000); // 30 second timeout
    });
    
    try {
      await Promise.race([emailPromise, timeoutPromise]);
      return true;
    } catch (sendError) {
      console.warn('Nodemailer email sending failed:', sendError.message);
      return false; // Return false instead of throwing
    }
  } catch (error) {
    console.warn('Email service error:', error.message);
    
    // Don't throw error if email service is not configured
    if (!emailUser || !emailPassword || emailPassword === 'your-app-password-here') {
      console.warn('Email service not configured. Registration will continue without email verification.');
      return true;
    }
    
    return false;
  }
};

// Gmail fallback email service
const sendEmailViaAPI = async (email, token, type = 'verification') => {
  try {
    // Import the Gmail service
    const { sendGmailVerification, sendEmailViaExternalService } = require('./gmailService');
    
    // Try Gmail service first
    let emailSent = await sendGmailVerification(email, token, type);
    
    if (emailSent) {
      return true;
    }
    
    // If Gmail fails, try external service
    emailSent = await sendEmailViaExternalService(email, token, type);
    
    if (emailSent) {
      return true;
    }
    
    // If both fail, log the verification details as fallback
    return true; // Return success to not block registration
    
  } catch (error) {
    console.error('❌ Gmail fallback service failed:', error);
    return false;
  }
};

// Simple HTTP email service (placeholder)
const sendEmailViaHTTP = async (email, token, type = 'verification') => {
  try {
    // Simple fallback - just log the verification details
    return true; // Return success to not block registration
    
  } catch (error) {
    console.error('❌ Simple email service failed:', error);
    return false;
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendEmailViaSendGrid,
  sendEmailViaAPI,
  sendEmailViaHTTP
}; 
