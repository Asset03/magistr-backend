const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if email configuration is available
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('Email service not configured. Missing SMTP credentials.');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email service connection failed:', error);
          this.isConfigured = false;
        } else {
          logger.info('Email service is ready to send messages');
          this.isConfigured = true;
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options) {
    if (!this.isConfigured) {
      logger.warn('Email service not configured, skipping email send');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || `"Scientific Publications" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Scientific Publications Analysis Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Welcome to Scientific Publications Analysis Platform</h2>
        <p>Dear ${user.name},</p>
        <p>Welcome to our comprehensive platform for analyzing scientific publications. We're excited to have you join our community of researchers and academics.</p>
        
        <h3>What you can do with our platform:</h3>
        <ul>
          <li>Search and analyze scientific publications</li>
          <li>Track citation networks and collaborations</li>
          <li>Create and manage your author profile</li>
          <li>Access advanced analytics and insights</li>
          <li>Discover trending research topics</li>
        </ul>
        
        <p>Your account has been successfully created with the email: <strong>${user.email}</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Login Credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Role: ${user.role}</p>
          ${user.affiliation ? `<p>Affiliation: ${user.affiliation}</p>` : ''}
        </div>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>The Scientific Publications Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This email was sent to ${user.email}. If you believe this was sent in error, please contact support.
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Welcome to Scientific Publications Analysis Platform. Your account has been created successfully.`
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Password Reset Request</h2>
        <p>Dear ${user.name},</p>
        <p>We received a request to reset your password for your Scientific Publications account.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>To reset your password, click the link below:</strong></p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p><strong>Important:</strong></p>
        <ul>
          <li>This link will expire in 10 minutes</li>
          <li>If you didn't request this password reset, please ignore this email</li>
          <li>For security reasons, never share this link with anyone</li>
        </ul>
        
        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${resetUrl}
        </p>
        
        <p>If you have any concerns about your account security, please contact our support team immediately.</p>
        
        <p>Best regards,<br>The Scientific Publications Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This email was sent to ${user.email}. If you didn't request a password reset, please ignore this message.
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Password reset link: ${resetUrl}. This link will expire in 10 minutes.`
    });
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    
    const subject = 'Email Verification Required';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Email Verification Required</h2>
        <p>Dear ${user.name},</p>
        <p>Thank you for registering with Scientific Publications Analysis Platform. To complete your registration, please verify your email address.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Click the button below to verify your email:</strong></p>
          <a href="${verificationUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p><strong>Why verify your email?</strong></p>
        <ul>
          <li>Ensure account security and prevent unauthorized access</li>
          <li>Enable important account notifications</li>
          <li>Recover your account if you forget your password</li>
          <li>Receive updates about new publications and features</li>
        </ul>
        
        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${verificationUrl}
        </p>
        
        <p>If you didn't create this account, please contact our support team immediately.</p>
        
        <p>Best regards,<br>The Scientific Publications Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This email was sent to ${user.email}. If you didn't register for an account, please ignore this message.
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Please verify your email address: ${verificationUrl}`
    });
  }

  // Send new publication notification
  async sendNewPublicationNotification(user, publication) {
    const publicationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/publications/${publication._id}`;
    
    const subject = 'New Publication Added';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">New Publication Added</h2>
        <p>Dear ${user.name},</p>
        <p>A new publication has been added to the Scientific Publications database that may interest you:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">${publication.title}</h3>
          <p><strong>Authors:</strong> ${publication.authors.map(a => a.author.name).join(', ')}</p>
          <p><strong>Journal:</strong> ${publication.journal?.name || 'N/A'}</p>
          <p><strong>Year:</strong> ${publication.publicationYear}</p>
          <p><strong>Citations:</strong> ${publication.citationsCount}</p>
          
          <p><strong>Abstract:</strong></p>
          <p style="font-style: italic;">${publication.abstract.substring(0, 300)}${publication.abstract.length > 300 ? '...' : ''}</p>
          
          <a href="${publicationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">
            View Publication
          </a>
        </div>
        
        <p>This publication was selected based on your research interests and previous activity on the platform.</p>
        
        <p>Best regards,<br>The Scientific Publications Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          You received this email because you have notifications enabled. 
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings">Manage notification preferences</a>
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `New publication: ${publication.title} by ${publication.authors.map(a => a.author.name).join(', ')}`
    });
  }

  // Send collaboration invitation
  async sendCollaborationInvitation(fromUser, toUser, projectName) {
    const subject = 'Collaboration Invitation';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Collaboration Invitation</h2>
        <p>Dear ${toUser.name},</p>
        <p><strong>${fromUser.name}</strong> from ${fromUser.affiliation || 'Unknown Institution'} has invited you to collaborate on a research project.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Project Details</h3>
          <p><strong>Project Name:</strong> ${projectName}</p>
          <p><strong>Invited by:</strong> ${fromUser.name}</p>
          <p><strong>Affiliation:</strong> ${fromUser.affiliation || 'N/A'}</p>
          <p><strong>Email:</strong> ${fromUser.email}</p>
        </div>
        
        <p>This invitation is based on your shared research interests and previous publications in related fields.</p>
        
        <p>You can respond to this invitation by replying directly to this email or by contacting ${fromUser.name} at ${fromUser.email}.</p>
        
        <p>Best regards,<br>The Scientific Publications Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This invitation was sent based on research collaboration suggestions. 
          If you're not interested, you can simply ignore this message.
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: toUser.email,
      subject,
      html,
      text: `Collaboration invitation from ${fromUser.name} for project: ${projectName}`
    });
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
