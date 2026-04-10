const nodemailer = require('nodemailer');

const emailUser = process.env.EMAIL_USER || '';
const emailPassword = process.env.EMAIL_PASSWORD || '';

function createTransporter() {
  if (!emailUser || !emailPassword) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function buildMailOptions(email, token, type) {
  if (type === 'verification') {
    return {
      from: {
        name: 'Bite Alert',
        address: emailUser
      },
      to: email,
      subject: 'Bite Alert - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7D0C0C;">Bite Alert</h2>
          <p>Please verify your account by clicking the link below:</p>
          <p>
            <a href="https://bitealert-yzau.onrender.com/verify-email/${token}" style="background-color: #7D0C0C; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
          </p>
          <p>If you did not create this account, you may ignore this email.</p>
        </div>
      `
    };
  }

  if (type === 'password-reset') {
    return {
      from: {
        name: 'Bite Alert',
        address: emailUser
      },
      to: email,
      subject: 'Bite Alert - Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7D0C0C;">Bite Alert</h2>
          <p>You requested a password reset. Use this code:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #7D0C0C;">${token}</p>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `
    };
  }

  throw new Error('Invalid email type');
}

async function sendGmailVerification(email, token, type = 'verification') {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      return false;
    }

    const mailOptions = buildMailOptions(email, token, type);
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Gmail service send failed:', error.message || error);
    return false;
  }
}

async function sendEmailViaExternalService(email, token, type = 'verification') {
  // Placeholder for future third-party fallback integration.
  // Returning false allows the caller to continue fallback handling.
  void email;
  void token;
  void type;
  return false;
}

module.exports = {
  sendGmailVerification,
  sendEmailViaExternalService
};
