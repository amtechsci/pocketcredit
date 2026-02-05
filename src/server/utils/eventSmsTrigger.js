/**
 * Event-Based SMS Trigger Helper
 * 
 * Automatically triggers event-based SMS templates when events occur in the system.
 * This is separate from manual triggers and cron-based triggers.
 */

const { executeQuery, initializeDatabase } = require('../config/database');
const { smsService } = require('../utils/smsService');
const cronLogger = require('../services/cronLogger');
const { initSmsLogsTable } = require('../routes/adminSmsTemplates');

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(message, data) {
  return message
    .replace(/{name}/g, data.name || 'Customer')
    .replace(/{user_name}/g, data.name || 'Customer')
    .replace(/{url}/g, data.url || 'https://pocketcredit.in')
    .replace(/{email}/g, data.email || 'support@pocketcredit.in')
    .replace(/{due_date}/g, data.due_date || '')
    .replace(/{emi_amount}/g, data.emi_amount || '0')
    .replace(/{amount}/g, data.amount || '0')
    .replace(/{days_passed}/g, data.days_passed || '0')
    .replace(/{savings}/g, data.savings || '0')
    .replace(/{otp}/g, data.otp || '1234')
    .replace(/{validity}/g, data.validity || '5')
    .replace(/{emi_number}/g, data.emi_number || '1')
    .replace(/{bank_name}/g, data.bank_name || 'Bank')
    .replace(/{account_number}/g, data.account_number || '****')
    .replace(/{acc_manager_name}/g, data.acc_manager_name || 'Account Manager')
    .replace(/{acc_manager_phone}/g, data.acc_manager_phone || '')
    .replace(/{reference_name}/g, data.reference_name || 'Reference')
    .replace(/{new_limit}/g, data.new_limit || '0');
}

/**
 * Format date as DD-MM-YYYY
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Automatically trigger an event-based SMS template
 * 
 * @param {string} templateKey - The template key (e.g., 'loan_cleared', 'emi_cleared')
 * @param {object} options - Options object
 * @param {number} options.userId - User ID
 * @param {number} [options.loanId] - Loan ID (optional)
 * @param {object} [options.variables] - Additional variables to override defaults
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function triggerEventSMS(templateKey, options = {}) {
  const { userId, loanId, variables = {} } = options;

  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    await initializeDatabase();
    await initSmsLogsTable();

    // Get template
    const templates = await executeQuery(
      'SELECT * FROM sms_templates WHERE template_key = ? AND trigger_type = ? AND is_active = 1',
      [templateKey, 'event']
    );

    if (!templates || templates.length === 0) {
      // Template not found or not active - this is not an error, just skip
      return { success: false, error: 'Template not found or not active' };
    }

    const template = templates[0];

    if (!template.template_id) {
      // Template exists but no DLT ID configured - skip silently
      return { success: false, error: 'Template does not have a DLT Template ID configured' };
    }

    // Get user details
    const users = await executeQuery(
      'SELECT id, first_name, last_name, phone, alternate_mobile FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = users[0];
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';

    // Get loan details if loanId provided
    let loan = null;
    if (loanId) {
      const loans = await executeQuery(
        'SELECT id, loan_amount, status, processed_due_date, emi_amount, application_number, emi_schedule FROM loan_applications WHERE id = ? AND user_id = ?',
        [loanId, userId]
      );
      if (loans && loans.length > 0) {
        loan = loans[0];
        
        // Extract due_date from processed_due_date or emi_schedule
        if (!loan.due_date) {
          if (loan.processed_due_date) {
            // processed_due_date can be a single date string or JSON array
            try {
              const dueDateData = typeof loan.processed_due_date === 'string' 
                ? JSON.parse(loan.processed_due_date) 
                : loan.processed_due_date;
              
              if (Array.isArray(dueDateData) && dueDateData.length > 0) {
                // Multi-EMI: use first due date
                loan.due_date = dueDateData[0];
              } else if (typeof dueDateData === 'string') {
                // Single date
                loan.due_date = dueDateData;
              }
            } catch (e) {
              // If it's already a date string, use it directly
              loan.due_date = loan.processed_due_date;
            }
          } else if (loan.emi_schedule) {
            // Try to get due date from emi_schedule
            try {
              const emiSchedule = typeof loan.emi_schedule === 'string' 
                ? JSON.parse(loan.emi_schedule) 
                : loan.emi_schedule;
              
              if (Array.isArray(emiSchedule) && emiSchedule.length > 0) {
                loan.due_date = emiSchedule[0].due_date || emiSchedule[0].date;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    }

    // Prepare variables for message replacement
    const messageData = {
      name: userName,
      user_name: userName,
      url: 'https://pocketcredit.in',
      email: 'support@pocketcredit.in',
      due_date: loan?.due_date ? formatDate(loan.due_date) : '',
      emi_amount: loan?.emi_amount ? `₹${loan.emi_amount}` : '₹0',
      amount: loan?.loan_amount ? `₹${loan.loan_amount}` : '₹0',
      days_passed: '0',
      savings: '₹0',
      otp: '1234',
      validity: '5',
      emi_number: '1',
      bank_name: 'Bank',
      account_number: '****',
      acc_manager_name: 'Account Manager',
      acc_manager_phone: '',
      reference_name: 'Reference',
      new_limit: '₹0',
      ...variables // Override with provided variables
    };

    const finalMessage = replaceTemplateVariables(template.message_template, messageData);

    // Determine which mobile number to use
    let mobile = null;
    if (template.send_to === 'alternate') {
      mobile = user.alternate_mobile || user.phone;
    } else if (template.send_to === 'both') {
      mobile = user.phone; // Send to primary first
    } else {
      mobile = user.phone;
    }

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return { success: false, error: 'User does not have a valid mobile number' };
    }

    // Send SMS
    const result = await smsService.sendSMS({
      to: mobile,
      message: finalMessage,
      templateId: template.template_id,
      senderId: template.sender_id || 'PKTCRD'
    });

    // Log to database
    await executeQuery(`
      INSERT INTO sms_logs (user_id, loan_id, template_id, mobile, message, status, response, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      loanId || loan?.id || null,
      template.template_key,
      mobile,
      finalMessage,
      result.success ? 'auto' : 'failed',
      JSON.stringify(result)
    ]);

    // Log to cron logger
    if (result.success) {
      await cronLogger.info(`Auto Event SMS: Sent ${template.template_key} to user ${userId} (${mobile})`);
    } else {
      await cronLogger.error(`Auto Event SMS: Failed to send ${template.template_key} to user ${userId}: ${result.description}`, result);
    }

    return {
      success: result.success,
      message: result.success ? `SMS sent successfully to ${mobile}` : `Failed to send SMS: ${result.description}`,
      error: result.success ? undefined : result.description
    };

  } catch (error) {
    await cronLogger.error(`Auto Event SMS: Error triggering ${templateKey} for user ${userId}: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  triggerEventSMS
};
