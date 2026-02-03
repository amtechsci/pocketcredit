/**
 * Notification Service
 * Handles SMS and Email notifications for credit limit updates
 */

const EmailService = require('./emailService');
const { initializeDatabase, executeQuery } = require('../config/database');

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Send SMS via smswala API
   * @param {string} mobile - Mobile number
   * @param {string} message - SMS message
   * @returns {Promise<boolean>}
   */
  async sendSMS(mobile, message) {
    try {
      if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        console.warn(`[Notification] Invalid mobile number: ${mobile}`);
        return false;
      }

      // Use the same SMS API configuration as OTP sending
      const template_id = '1407174844163241940'; // Default template ID
      const sender = 'CREDLB';
      
      const smsUrl = `https://sms.smswala.in/app/smsapi/index.php?key=2683C705E7CB39&campaign=16613&routeid=30&type=text&contacts=${mobile}&senderid=${sender}&msg=${encodeURIComponent(message)}&template_id=${template_id}&pe_id=1401337620000065797`;
      
      const response = await fetch(smsUrl);
      const result = await response.text();
      
      console.log(`[Notification] SMS sent to ${mobile}: ${result}`);
      return true;

    } catch (error) {
      console.error(`[Notification] SMS sending failed for ${mobile}:`, error);
      return false;
    }
  }

  /**
   * Send email notification
   * @param {string} email - Email address
   * @param {string} recipientName - Recipient name
   * @param {string} subject - Email subject
   * @param {string} htmlContent - Email HTML content
   * @returns {Promise<boolean>}
   */
  async sendEmail(email, recipientName, subject, htmlContent) {
    try {
      if (!email || !email.includes('@')) {
        console.warn(`[Notification] Invalid email address: ${email}`);
        return false;
      }

      await this.emailService.transporter.sendMail({
        from: `"Pocket Credit" <${process.env.SMTP_USER || 'noreply@pocketcredit.in'}>`,
        to: email,
        subject: subject,
        html: htmlContent
      });

      console.log(`[Notification] Email sent to ${email}`);
      return true;

    } catch (error) {
      console.error(`[Notification] Email sending failed for ${email}:`, error);
      return false;
    }
  }

  /**
   * Send credit limit increase notification via SMS and Email
   * @param {object} options - Notification options
   * @param {number} options.userId - User ID
   * @param {string} options.mobile - Mobile number
   * @param {string} options.email - Email address
   * @param {string} options.recipientName - Recipient name
   * @param {number} options.newLimit - New credit limit amount
   * @returns {Promise<{smsSent: boolean, emailSent: boolean}>}
   */
  async sendCreditLimitNotification({ userId, mobile, email, recipientName, newLimit }) {
    const message = `Your Credit limit is increased to Rs.${newLimit.toLocaleString('en-IN')}. Kindly log in & accept the new limit.`;
    const emailSubject = 'Credit Limit Increased - Pocket Credit';
    
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #0052FF 0%, #00C49A 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
      margin: -30px -30px 30px -30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 20px 0;
    }
    .limit-box {
      background: #f0f4f8;
      border-left: 4px solid #0052FF;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .limit-amount {
      font-size: 32px;
      font-weight: bold;
      color: #0052FF;
      margin: 10px 0;
    }
    .cta-button {
      display: inline-block;
      background: #0052FF;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Credit Limit Increased!</h1>
    </div>
    <div class="content">
      <p>Dear ${recipientName || 'Customer'},</p>
      <p>We are pleased to inform you that your credit limit has been increased.</p>
      
      <div class="limit-box">
        <p style="margin: 0 0 10px 0; color: #6b7280;">Your New Credit Limit:</p>
        <div class="limit-amount">₹${newLimit.toLocaleString('en-IN')}</div>
      </div>
      
      <p>Kindly log in to your account and accept the new limit to start using it.</p>
      
      <a href="${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/dashboard" class="cta-button">
        Log In & Accept Limit
      </a>
      
      <p>If you have any questions, please feel free to contact our support team.</p>
      
      <p>Best regards,<br>Pocket Credit Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email from Pocket Credit. Please do not reply to this email.</p>
      <p>For support, contact us at support@pocketcredit.in</p>
    </div>
  </div>
</body>
</html>
    `;

    const results = {
      smsSent: false,
      emailSent: false
    };

    // Send SMS
    if (mobile) {
      results.smsSent = await this.sendSMS(mobile, message);
    }

    // Send Email
    if (email) {
      results.emailSent = await this.sendEmail(email, recipientName, emailSubject, emailHTML);
    }

    // Log notification in database (optional - table may not exist)
    try {
      await initializeDatabase();
      // Check if table exists before inserting
      const tableCheck = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'notification_logs'
      `);
      
      if (tableCheck && tableCheck.length > 0 && tableCheck[0].count > 0) {
        await executeQuery(`
          INSERT INTO notification_logs (user_id, notification_type, message, status, created_at)
          VALUES (?, 'credit_limit_increase', ?, ?, NOW())
        `, [
          userId,
          message,
          results.smsSent || results.emailSent ? 'sent' : 'failed'
        ]);
      }
    } catch (logError) {
      // Silently ignore - table may not exist, which is fine
      console.log('[Notification] Notification logging skipped (table may not exist)');
    }

    return results;
  }
}

module.exports = new NotificationService();

