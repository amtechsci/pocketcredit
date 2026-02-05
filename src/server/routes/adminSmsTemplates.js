/**
 * Admin SMS Templates Management Routes
 * 
 * CRUD operations for SMS templates stored in database
 */

const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * Initialize SMS logs table
 */
async function initSmsLogsTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      loan_id INT,
      template_id VARCHAR(100),
      mobile VARCHAR(15),
      message TEXT,
      status ENUM('sent', 'failed', 'skipped', 'error', 'dry_run', 'manual', 'auto') DEFAULT 'sent',
      response JSON,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_loan_id (loan_id),
      INDEX idx_sent_at (sent_at),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  // Add 'auto' to ENUM if table already exists (migration)
  try {
    await executeQuery(`
      ALTER TABLE sms_logs 
      MODIFY COLUMN status ENUM('sent', 'failed', 'skipped', 'error', 'dry_run', 'manual', 'auto') DEFAULT 'sent'
    `);
  } catch (error) {
    // Ignore error if column doesn't exist or ENUM already has 'auto'
    // This is safe to ignore for migration purposes
  }
}

/**
 * Initialize SMS templates table
 */
async function initSmsTemplatesTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS sms_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_key VARCHAR(50) NOT NULL UNIQUE,
      template_name VARCHAR(100) NOT NULL,
      template_id VARCHAR(50) COMMENT 'DLT registered template ID',
      sender_id VARCHAR(6) DEFAULT 'PKTCRD',
      message_template TEXT NOT NULL,
      
      -- Trigger conditions
      trigger_type ENUM('dpd', 'status', 'event', 'salary_day', 'commitment') DEFAULT 'dpd',
      dpd_values JSON COMMENT 'Array of specific DPD values or {min, max} range',
      status_values JSON COMMENT 'Array of loan statuses',
      
      -- Schedule
      scheduled_times JSON COMMENT 'Array of times in HH:MM format',
      
      -- Target
      send_to ENUM('primary', 'both', 'alternate', 'reference') DEFAULT 'both',
      
      -- Status
      is_active TINYINT(1) DEFAULT 1,
      
      -- Metadata
      category VARCHAR(50) COMMENT 'Category for grouping (collection, reminder, marketing)',
      description TEXT,
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_trigger_type (trigger_type),
      INDEX idx_is_active (is_active),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Note: Templates are managed via admin UI - no seed function needed
// Template data is stored in sms_templates database table

/**
 * Get all SMS templates
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    await initSmsTemplatesTable();

    const { category, trigger_type, is_active } = req.query;

    let query = 'SELECT * FROM sms_templates WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (trigger_type) {
      query += ' AND trigger_type = ?';
      params.push(trigger_type);
    }
    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY category, template_name';

    const templates = await executeQuery(query, params);

    // Safe JSON parse helper - handles already-parsed objects
    const safeJsonParse = (value, defaultValue = null) => {
      if (!value || value === '' || value === 'null') return defaultValue;
      if (typeof value === 'object') return value; // Already parsed
      try {
        return JSON.parse(value);
      } catch (e) {
        return defaultValue;
      }
    };

    // Parse JSON fields
    const parsedTemplates = templates.map(t => ({
      ...t,
      dpd_values: safeJsonParse(t.dpd_values, null),
      status_values: safeJsonParse(t.status_values, null),
      scheduled_times: safeJsonParse(t.scheduled_times, [])
    }));

    res.json({
      success: true,
      data: parsedTemplates
    });
  } catch (error) {
    console.error('[SMS Templates] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS templates'
    });
  }
});

/**
 * Get single SMS template
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const templates = await executeQuery(
      'SELECT * FROM sms_templates WHERE id = ?',
      [id]
    );

    if (!templates || templates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templates[0];
    
    // Safe JSON parse helper
    const safeJsonParse = (value, defaultValue = null) => {
      if (!value || value === '' || value === 'null') return defaultValue;
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch (e) { return defaultValue; }
    };
    
    res.json({
      success: true,
      data: {
        ...template,
        dpd_values: safeJsonParse(template.dpd_values, null),
        status_values: safeJsonParse(template.status_values, null),
        scheduled_times: safeJsonParse(template.scheduled_times, [])
      }
    });
  } catch (error) {
    console.error('[SMS Templates] Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS template'
    });
  }
});

/**
 * Create SMS template
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    await initSmsTemplatesTable();

    const {
      template_key,
      template_name,
      template_id,
      sender_id,
      message_template,
      trigger_type,
      dpd_values,
      status_values,
      scheduled_times,
      send_to,
      category,
      description
    } = req.body;

    // Validation
    if (!template_key || !template_name || !message_template) {
      return res.status(400).json({
        success: false,
        message: 'template_key, template_name, and message_template are required'
      });
    }

    // Check for duplicate key
    const existing = await executeQuery(
      'SELECT id FROM sms_templates WHERE template_key = ?',
      [template_key]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Template with this key already exists'
      });
    }

    const result = await executeQuery(`
      INSERT INTO sms_templates 
      (template_key, template_name, template_id, sender_id, message_template, 
       trigger_type, dpd_values, status_values, scheduled_times, send_to, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      template_key,
      template_name,
      template_id || null,
      sender_id || 'PKTCRD',
      message_template,
      trigger_type || 'dpd',
      dpd_values ? JSON.stringify(dpd_values) : null,
      status_values ? JSON.stringify(status_values) : null,
      scheduled_times ? JSON.stringify(scheduled_times) : '[]',
      send_to || 'both',
      category || null,
      description || null
    ]);

    res.json({
      success: true,
      message: 'Template created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('[SMS Templates] Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create SMS template'
    });
  }
});

/**
 * Update SMS template
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const {
      template_name,
      template_id,
      sender_id,
      message_template,
      trigger_type,
      dpd_values,
      status_values,
      scheduled_times,
      send_to,
      is_active,
      category,
      description
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (template_name !== undefined) {
      updates.push('template_name = ?');
      params.push(template_name);
    }
    if (template_id !== undefined) {
      updates.push('template_id = ?');
      params.push(template_id);
    }
    if (sender_id !== undefined) {
      updates.push('sender_id = ?');
      params.push(sender_id);
    }
    if (message_template !== undefined) {
      updates.push('message_template = ?');
      params.push(message_template);
    }
    if (trigger_type !== undefined) {
      updates.push('trigger_type = ?');
      params.push(trigger_type);
    }
    if (dpd_values !== undefined) {
      updates.push('dpd_values = ?');
      params.push(JSON.stringify(dpd_values));
    }
    if (status_values !== undefined) {
      updates.push('status_values = ?');
      params.push(JSON.stringify(status_values));
    }
    if (scheduled_times !== undefined) {
      updates.push('scheduled_times = ?');
      params.push(JSON.stringify(scheduled_times));
    }
    if (send_to !== undefined) {
      updates.push('send_to = ?');
      params.push(send_to);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);

    await executeQuery(
      `UPDATE sms_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('[SMS Templates] Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update SMS template'
    });
  }
});

/**
 * Delete SMS template
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    await executeQuery('DELETE FROM sms_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('[SMS Templates] Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete SMS template'
    });
  }
});

/**
 * Toggle template active status
 */
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    await executeQuery(
      'UPDATE sms_templates SET is_active = NOT is_active WHERE id = ?',
      [id]
    );

    const updated = await executeQuery(
      'SELECT is_active FROM sms_templates WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Template status toggled',
      data: { is_active: updated[0]?.is_active === 1 }
    });
  } catch (error) {
    console.error('[SMS Templates] Error toggling template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle SMS template'
    });
  }
});

/**
 * Seed default templates (no-op function)
 * Templates are managed via admin UI - this is kept for backwards compatibility
 */
async function seedDefaultTemplates() {
  // Templates are now managed via admin UI
  // This function exists for backwards compatibility with smsNotificationJob.js
  console.log('[SMS Templates] Templates are managed via admin UI - no seeding needed');
  return;
}

/**
 * POST /api/admin/sms-templates/:templateKey/trigger
 * Manually trigger an event-based SMS template for a user
 */
router.post('/:templateKey/trigger', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { templateKey } = req.params;
    const { userId, loanId, variables } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Get template
    const templates = await executeQuery(
      'SELECT * FROM sms_templates WHERE template_key = ? AND trigger_type = ?',
      [templateKey, 'event']
    );

    if (!templates || templates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event-based template not found'
      });
    }

    const template = templates[0];

    if (!template.template_id) {
      return res.status(400).json({
        success: false,
        message: 'Template does not have a DLT Template ID configured'
      });
    }

    // Get user details
    const users = await executeQuery(
      'SELECT id, first_name, last_name, phone, alternate_mobile FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';

    // Get loan details if loanId provided
    let loan = null;
    if (loanId) {
      const loans = await executeQuery(
        'SELECT id, loan_amount, status, due_date, emi_amount FROM loan_applications WHERE id = ? AND user_id = ?',
        [loanId, userId]
      );
      if (loans && loans.length > 0) {
        loan = loans[0];
      }
    }

    // Prepare variables for message replacement
    const messageData = {
      name: userName,
      user_name: userName,
      url: 'https://pocketcredit.in',
      email: 'support@pocketcredit.in',
      due_date: loan?.due_date ? new Date(loan.due_date).toLocaleDateString('en-IN') : '',
      emi_amount: loan?.emi_amount || '0',
      amount: loan?.loan_amount || '0',
      days_passed: '0',
      savings: '0',
      otp: '1234',
      validity: '5',
      emi_number: '1',
      bank_name: 'Bank',
      account_number: '****',
      acc_manager_name: 'Account Manager',
      acc_manager_phone: '',
      reference_name: 'Reference',
      new_limit: '0',
      ...variables // Override with provided variables
    };

    // Replace variables in message
    const replaceTemplateVariables = (message, data) => {
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
      return res.status(400).json({
        success: false,
        message: 'User does not have a valid mobile number'
      });
    }

    // Send SMS
    const { smsService } = require('../utils/smsService');
    const result = await smsService.sendSMS({
      to: mobile,
      message: finalMessage,
      templateId: template.template_id,
      senderId: template.sender_id || 'PKTCRD'
    });

    // Log to database
    await initSmsLogsTable();
    await executeQuery(`
      INSERT INTO sms_logs (user_id, loan_id, template_id, mobile, message, status, response, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      loanId || loan?.id || null,
      template.template_key,
      mobile,
      finalMessage,
      result.success ? 'manual' : 'failed',
      JSON.stringify(result)
    ]);

    // Log to cron logger
    const cronLogger = require('../services/cronLogger');
    if (result.success) {
      await cronLogger.info(`Manual SMS Trigger: Sent ${template.template_key} to user ${userId} (${mobile})`);
    } else {
      await cronLogger.error(`Manual SMS Trigger: Failed to send ${template.template_key} to user ${userId}: ${result.description}`, result);
    }

    if (result.success) {
      res.json({
        success: true,
        message: `SMS sent successfully to ${mobile}`,
        data: {
          mobile,
          message: finalMessage,
          template: template.template_name
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send SMS: ${result.description}`,
        data: result
      });
    }

  } catch (error) {
    const cronLogger = require('../services/cronLogger');
    await cronLogger.error(`Manual SMS Trigger: Error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger SMS',
      error: error.message
    });
  }
});

// Export for use in cron job
module.exports = router;
module.exports.initSmsTemplatesTable = initSmsTemplatesTable;
module.exports.initSmsLogsTable = initSmsLogsTable;
module.exports.seedDefaultTemplates = seedDefaultTemplates;