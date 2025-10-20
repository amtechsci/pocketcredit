const nodemailer = require('nodemailer');
const { initializeDatabase } = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  /**
   * Initialize email transporter
   */
  initTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Send KFS PDF via email
   * @param {object} options - Email options
   * @returns {Promise<object>} Email result
   */
  async sendKFSEmail(options) {
    const {
      loanId,
      recipientEmail,
      recipientName,
      loanData,
      pdfBuffer,
      pdfFilename,
      sentBy
    } = options;

    try {
      console.log(`📧 Sending KFS email to ${recipientEmail}...`);

      // Create email HTML template
      const emailHTML = this.createKFSEmailTemplate({
        recipientName,
        loanData
      });

      // Send email
      const info = await this.transporter.sendMail({
        from: `"Pocket Credit" <${process.env.SMTP_USER || 'noreply@pocketcredit.in'}>`,
        to: recipientEmail,
        subject: `Key Facts Statement - Loan Application ${loanData.application_number}`,
        html: emailHTML,
        attachments: [
          {
            filename: pdfFilename || `KFS_${loanData.application_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      console.log('✅ Email sent successfully:', info.messageId);

      // Log email in database
      await this.logEmail({
        loanId,
        recipientEmail,
        subject: `Key Facts Statement - Loan Application ${loanData.application_number}`,
        status: 'sent',
        sentBy,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error('❌ Email sending failed:', error);

      // Log failed email
      await this.logEmail({
        loanId,
        recipientEmail,
        subject: `Key Facts Statement - Loan Application ${loanData.application_number}`,
        status: 'failed',
        sentBy,
        errorMessage: error.message
      });

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Create KFS email HTML template
   * @param {object} data - Template data
   * @returns {string} HTML email content
   */
  createKFSEmailTemplate(data) {
    const { recipientName, loanData } = data;

    return `
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
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .value {
      color: #333;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Key Facts Statement</h1>
    <p>Your Loan Application Details</p>
  </div>
  
  <div class="content">
    <p>Dear ${recipientName},</p>
    
    <p>Thank you for choosing <strong>Pocket Credit</strong> for your financial needs. Please find attached the Key Facts Statement (KFS) for your loan application.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #667eea;">Loan Details</h3>
      <div class="info-row">
        <span class="label">Application Number:</span>
        <span class="value">${loanData.application_number}</span>
      </div>
      <div class="info-row">
        <span class="label">Loan Amount:</span>
        <span class="value">₹${loanData.sanctioned_amount?.toLocaleString('en-IN')}</span>
      </div>
      <div class="info-row">
        <span class="label">Loan Term:</span>
        <span class="value">${loanData.loan_term_days} days</span>
      </div>
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="value" style="color: #28a745; font-weight: bold;">${loanData.status}</span>
      </div>
    </div>
    
    <div class="warning">
      <strong>⚠️ Important:</strong> Please review the attached KFS document carefully. It contains important information about your loan terms, interest rates, fees, and repayment schedule.
    </div>
    
    <p><strong>What's Next?</strong></p>
    <ul>
      <li>Review the Key Facts Statement attached to this email</li>
      <li>Understand all terms and conditions</li>
      <li>Contact us if you have any questions</li>
      <li>Complete any pending documentation</li>
    </ul>
    
    <p>If you have any questions or need clarification, please don't hesitate to reach out to our support team.</p>
    
    <div style="text-align: center;">
      <a href="tel:+919876543210" class="button">📞 Call Support</a>
      <a href="mailto:support@pocketcredit.in" class="button">✉️ Email Us</a>
    </div>
    
    <p>Best regards,<br>
    <strong>Pocket Credit Team</strong></p>
  </div>
  
  <div class="footer">
    <p><strong>Pocket Credit Private Limited</strong></p>
    <p>Plot No. 123, Sector 18, Gurugram, Haryana 122015</p>
    <p>Phone: +91 9876543210 | Email: support@pocketcredit.in</p>
    <p style="margin-top: 20px; font-size: 10px; color: #999;">
      This is an automated email. Please do not reply to this email.<br>
      If you did not request this information, please contact us immediately.
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Log email in database
   * @param {object} data - Email log data
   */
  async logEmail(data) {
    try {
      const db = await initializeDatabase();
      
      await db.execute(`
        INSERT INTO kfs_email_log 
        (loan_id, recipient_email, subject, status, sent_at, error_message, sent_by, pdf_generated_at)
        VALUES (?, ?, ?, ?, NOW(), ?, ?, NOW())
      `, [
        data.loanId,
        data.recipientEmail,
        data.subject,
        data.status,
        data.errorMessage || null,
        data.sentBy || null
      ]);

      console.log('📝 Email logged in database');
    } catch (error) {
      console.error('Error logging email:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Get email history for a loan
   * @param {number} loanId - Loan ID
   * @returns {Promise<Array>} Email history
   */
  async getEmailHistory(loanId) {
    try {
      const db = await initializeDatabase();
      
      const [emails] = await db.execute(`
        SELECT 
          id, recipient_email, subject, status, 
          sent_at, opened_at, error_message, created_at
        FROM kfs_email_log
        WHERE loan_id = ?
        ORDER BY created_at DESC
      `, [loanId]);

      return emails;
    } catch (error) {
      console.error('Error fetching email history:', error);
      return [];
    }
  }

  /**
   * Test email configuration
   * @returns {Promise<boolean>} Test result
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email server connection successful');
      return true;
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;

