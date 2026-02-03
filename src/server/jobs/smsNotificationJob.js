/**
 * SMS Notification Cron Job
 * 
 * Sends automated SMS notifications based on DPD (Days Past Due), 
 * loan status, and scheduled times.
 * 
 * Runs every minute and checks if any SMS should be sent based on current time.
 * Templates are loaded from the sms_templates database table.
 * 
 * @see SMS Templates CSV for template definitions
 */

const { executeQuery, initializeDatabase } = require('../config/database');
const cronLogger = require('../services/cronLogger');
const { smsService } = require('../utils/smsService');
const { initSmsTemplatesTable, seedDefaultTemplates } = require('../routes/adminSmsTemplates');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current time in HH:MM format (IST)
 */
function getCurrentTimeIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  const hours = istTime.getUTCHours().toString().padStart(2, '0');
  const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current date in IST
 */
function getCurrentDateIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

/**
 * Check if current time matches any scheduled time (within 1 minute tolerance)
 */
function isScheduledTime(times, currentTime) {
  if (!times || !Array.isArray(times)) return false;
  
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  
  for (const time of times) {
    const [schedHour, schedMin] = time.split(':').map(Number);
    if (currentHour === schedHour && currentMin === schedMin) {
      return true;
    }
  }
  return false;
}

/**
 * Check if DPD is in the given range
 */
function isDpdInRange(dpd, dpdValues) {
  if (!dpdValues) return false;
  
  if (Array.isArray(dpdValues)) {
    return dpdValues.includes(dpd);
  }
  if (typeof dpdValues === 'object' && dpdValues.min !== undefined && dpdValues.max !== undefined) {
    return dpd >= dpdValues.min && dpd <= dpdValues.max;
  }
  return false;
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
 * Replace template variables with actual values
 */
function replaceTemplateVariables(message, data) {
  return message
    .replace(/{name}/g, data.name || 'Customer')
    .replace(/{user_name}/g, data.name || 'Customer')
    .replace(/{url}/g, data.url || 'http://pocketcredit.in')
    .replace(/{email}/g, data.email || 'support@pocketcredit.in')
    .replace(/{due_date}/g, data.due_date || '')
    .replace(/{emi_amount}/g, data.emi_amount || '0')
    .replace(/{amount}/g, data.amount || '0')
    .replace(/{days_passed}/g, data.days_passed || '0')
    .replace(/{savings}/g, data.savings || '0')
    .replace(/{loan_amount}/g, data.loan_amount || '0')
    .replace(/{new_limit}/g, data.new_limit || '0')
    .replace(/{acc_manager_name}/g, data.acc_manager_name || '')
    .replace(/{acc_manager_phone}/g, data.acc_manager_phone || '')
    .replace(/{reference_name}/g, data.reference_name || '')
    .replace(/{bank_name}/g, data.bank_name || '')
    .replace(/{account_number}/g, data.account_number || '')
    .replace(/{emi_number}/g, data.emi_number || 'EMI-1');
}

/**
 * Check if SMS was already sent today for this template and user
 */
async function wasSMSSentToday(userId, templateKey, mobileType) {
  try {
    const today = getCurrentDateIST();
    const dateStr = today.toISOString().split('T')[0];
    
    const result = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM sms_logs 
      WHERE user_id = ? 
        AND template_id = ? 
        AND DATE(sent_at) = ?
    `, [userId, `${templateKey}_${mobileType}`, dateStr]);
    
    return result && result[0] && result[0].count > 0;
  } catch (error) {
    // If table doesn't exist, assume not sent
    return false;
  }
}

/**
 * Initialize sms_logs table
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
      status VARCHAR(20),
      response TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_template_date (user_id, template_id, sent_at)
    )
  `);
}

/**
 * Log SMS sent
 */
async function logSMSSent(userId, loanId, templateKey, mobile, message, status, response) {
  try {
    await executeQuery(`
      INSERT INTO sms_logs (user_id, loan_id, template_id, mobile, message, status, response, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [userId, loanId, templateKey, mobile, message, status, JSON.stringify(response)]);
  } catch (error) {
    console.error('[SMS Cron] Error logging SMS:', error.message);
  }
}

/**
 * Send SMS to a user
 */
async function sendSMSToUser(user, loan, template, message) {
  const mobiles = [];
  
  // Primary phone
  if (template.send_to === 'primary' || template.send_to === 'both') {
    if (user.phone) mobiles.push({ number: user.phone, type: 'primary' });
  }
  
  // Alternate phone (if sending to both)
  if (template.send_to === 'both' || template.send_to === 'alternate') {
    if (user.alternate_mobile && user.alternate_mobile !== user.phone) {
      mobiles.push({ number: user.alternate_mobile, type: 'alternate' });
    }
  }
  
  let sentCount = 0;
  
  for (const mobile of mobiles) {
    try {
      // Check if already sent today
      const alreadySent = await wasSMSSentToday(user.id, template.template_key, mobile.type);
      if (alreadySent) {
        console.log(`[SMS Cron] Already sent ${template.template_key} to user ${user.id} (${mobile.type}) today, skipping`);
        continue;
      }
      
      // Skip if template ID not configured
      if (!template.template_id) {
        console.log(`[SMS Cron] DLT Template ID not configured for ${template.template_key}, skipping`);
        await logSMSSent(user.id, loan?.id, `${template.template_key}_${mobile.type}`, mobile.number, message, 'skipped', { reason: 'DLT Template ID not configured' });
        continue;
      }
      
      const result = await smsService.sendSMS({
        to: mobile.number,
        message: message,
        templateId: template.template_id,
        senderId: template.sender_id || 'PKTCRD'
      });
      
      await logSMSSent(user.id, loan?.id, `${template.template_key}_${mobile.type}`, mobile.number, message, result.success ? 'sent' : 'failed', result);
      
      if (result.success) {
        sentCount++;
        console.log(`[SMS Cron] Sent ${template.template_key} to ${mobile.number} (${mobile.type})`);
      } else {
        console.error(`[SMS Cron] Failed to send ${template.template_key} to ${mobile.number}: ${result.description}`);
      }
    } catch (error) {
      console.error(`[SMS Cron] Error sending SMS to ${mobile.number}:`, error.message);
      await logSMSSent(user.id, loan?.id, `${template.template_key}_${mobile.type}`, mobile.number, message, 'error', { error: error.message });
    }
  }
  
  return sentCount;
}

/**
 * Load active templates from database
 */
async function loadTemplatesFromDB() {
  try {
    const templates = await executeQuery(`
      SELECT * FROM sms_templates WHERE is_active = 1
    `);
    
    // Parse JSON fields with safe parsing - no warnings for valid edge cases
    const safeJsonParse = (value, defaultValue = null) => {
      // Handle null/empty values
      if (!value || value === '' || value === 'null') return defaultValue;
      
      // Already parsed by MySQL JSON column - return as-is
      if (typeof value === 'object') return value;
      
      // String value - try to parse
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          // Silently return default - data may have been stored in wrong format
          // Run the fixSmsTemplatesJson migration script to fix this
          return defaultValue;
        }
      }
      
      return defaultValue;
    };
    
    return templates.map(t => ({
      ...t,
      dpd_values: safeJsonParse(t.dpd_values, null),
      status_values: safeJsonParse(t.status_values, null),
      scheduled_times: safeJsonParse(t.scheduled_times, [])
    }));
  } catch (error) {
    console.error('[SMS Cron] Error loading templates:', error);
    return [];
  }
}

// ============================================================================
// MAIN JOB FUNCTIONS
// ============================================================================

/**
 * Process DPD-based SMS templates
 */
async function processDPDBasedSMS(templates, currentTime) {
  let totalSent = 0;
  
  // Filter DPD and salary_day templates
  const dpdTemplates = templates.filter(t => 
    t.trigger_type === 'dpd' || t.trigger_type === 'salary_day'
  );
  
  for (const template of dpdTemplates) {
    // Check if this template should run at current time
    if (!isScheduledTime(template.scheduled_times, currentTime)) {
      continue;
    }
    
    console.log(`[SMS Cron] Processing template: ${template.template_key}`);
    
    try {
      // Build DPD condition
      let dpdCondition = '';
      const dpdValues = template.dpd_values;
      
      if (Array.isArray(dpdValues)) {
        dpdCondition = `DATEDIFF(CURDATE(), 
          CASE 
            WHEN la.processed_due_date IS NOT NULL THEN 
              CASE 
                WHEN JSON_VALID(la.processed_due_date) THEN 
                  CASE 
                    WHEN JSON_TYPE(la.processed_due_date) = 'ARRAY' THEN JSON_UNQUOTE(JSON_EXTRACT(la.processed_due_date, '$[0]'))
                    ELSE JSON_UNQUOTE(la.processed_due_date)
                  END
                ELSE la.processed_due_date
              END
            ELSE DATE_ADD(la.processed_at, INTERVAL 30 DAY)
          END
        ) IN (${dpdValues.join(',')})`;
      } else if (dpdValues && typeof dpdValues === 'object') {
        dpdCondition = `DATEDIFF(CURDATE(), 
          CASE 
            WHEN la.processed_due_date IS NOT NULL THEN 
              CASE 
                WHEN JSON_VALID(la.processed_due_date) THEN 
                  CASE 
                    WHEN JSON_TYPE(la.processed_due_date) = 'ARRAY' THEN JSON_UNQUOTE(JSON_EXTRACT(la.processed_due_date, '$[0]'))
                    ELSE JSON_UNQUOTE(la.processed_due_date)
                  END
                ELSE la.processed_due_date
              END
            ELSE DATE_ADD(la.processed_at, INTERVAL 30 DAY)
          END
        ) BETWEEN ${dpdValues.min} AND ${dpdValues.max}`;
      } else {
        console.log(`[SMS Cron] Invalid DPD values for template ${template.template_key}`);
        continue;
      }
      
      // Additional condition for salary_day templates
      let additionalCondition = '';
      if (template.trigger_type === 'salary_day') {
        additionalCondition = 'AND u.salary_date = DAY(CURDATE())';
      }
      
      const query = `
        SELECT 
          la.id as loan_id,
          la.application_number,
          la.loan_amount,
          la.processed_amount,
          la.processed_due_date,
          la.processed_at,
          la.status as loan_status,
          la.emi_schedule,
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.phone,
          u.alternate_mobile,
          u.salary_date,
          DATEDIFF(CURDATE(), 
            CASE 
              WHEN la.processed_due_date IS NOT NULL THEN 
                CASE 
                  WHEN JSON_VALID(la.processed_due_date) THEN 
                    CASE 
                      WHEN JSON_TYPE(la.processed_due_date) = 'ARRAY' THEN JSON_UNQUOTE(JSON_EXTRACT(la.processed_due_date, '$[0]'))
                      ELSE JSON_UNQUOTE(la.processed_due_date)
                    END
                  ELSE la.processed_due_date
                END
              ELSE DATE_ADD(la.processed_at, INTERVAL 30 DAY)
            END
          ) as dpd
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE la.status IN ('account_manager', 'overdue')
          AND la.processed_at IS NOT NULL
          AND u.phone IS NOT NULL
          AND ${dpdCondition}
          ${additionalCondition}
        ORDER BY la.id
        LIMIT 500
      `;
      
      const loans = await executeQuery(query);
      
      if (!loans || loans.length === 0) {
        console.log(`[SMS Cron] No loans found for template ${template.template_key}`);
        continue;
      }
      
      console.log(`[SMS Cron] Found ${loans.length} loans for template ${template.template_key}`);
      
      for (const loan of loans) {
        // Parse due date for display
        let dueDate = '';
        try {
          if (loan.processed_due_date) {
            const dueDateParsed = typeof loan.processed_due_date === 'string' 
              ? (loan.processed_due_date.startsWith('[') ? JSON.parse(loan.processed_due_date)[0] : loan.processed_due_date)
              : loan.processed_due_date;
            dueDate = formatDate(dueDateParsed);
          }
        } catch (e) {
          dueDate = formatDate(loan.processed_at);
        }
        
        // Calculate savings for preclose template
        let savings = 0;
        if (template.template_key === 'preclose') {
          const remainingDays = Math.max(0, -loan.dpd);
          savings = Math.round((loan.loan_amount || 0) * 0.001 * remainingDays);
        }
        
        // Prepare message data
        const messageData = {
          name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'Customer',
          url: 'http://pocketcredit.in',
          email: 'support@pocketcredit.in',
          due_date: dueDate,
          emi_amount: (loan.processed_amount || loan.loan_amount || 0).toLocaleString('en-IN'),
          days_passed: Math.abs(loan.dpd || 0),
          savings: savings.toLocaleString('en-IN'),
          loan_amount: (loan.loan_amount || 0).toLocaleString('en-IN')
        };
        
        const message = replaceTemplateVariables(template.message_template, messageData);
        
        const user = {
          id: loan.user_id,
          phone: loan.phone,
          alternate_mobile: loan.alternate_mobile
        };
        
        const sent = await sendSMSToUser(user, loan, template, message);
        totalSent += sent;
      }
    } catch (error) {
      console.error(`[SMS Cron] Error processing template ${template.template_key}:`, error);
      await cronLogger.error(`SMS template ${template.template_key} error: ${error.message}`, error);
    }
  }
  
  return totalSent;
}

/**
 * Process status-based SMS templates
 */
async function processStatusBasedSMS(templates, currentTime) {
  let totalSent = 0;
  
  // Filter status-based templates
  const statusTemplates = templates.filter(t => t.trigger_type === 'status');
  
  for (const template of statusTemplates) {
    // Check if this template should run at current time
    if (!isScheduledTime(template.scheduled_times, currentTime)) {
      continue;
    }
    
    console.log(`[SMS Cron] Processing status template: ${template.template_key}`);
    
    try {
      const statuses = template.status_values;
      if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
        continue;
      }
      
      const statusList = statuses.map(s => `'${s}'`).join(',');
      
      const query = `
        SELECT 
          la.id as loan_id,
          la.application_number,
          la.status as loan_status,
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.phone,
          u.alternate_mobile
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE la.status IN (${statusList})
          AND u.phone IS NOT NULL
          AND la.id = (
            SELECT MAX(la2.id) 
            FROM loan_applications la2 
            WHERE la2.user_id = la.user_id
          )
        ORDER BY la.id
        LIMIT 500
      `;
      
      const loans = await executeQuery(query);
      
      if (!loans || loans.length === 0) {
        console.log(`[SMS Cron] No loans found for status template ${template.template_key}`);
        continue;
      }
      
      console.log(`[SMS Cron] Found ${loans.length} loans for status template ${template.template_key}`);
      
      for (const loan of loans) {
        const messageData = {
          name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'Customer',
          url: 'http://pocketcredit.in'
        };
        
        const message = replaceTemplateVariables(template.message_template, messageData);
        
        const user = {
          id: loan.user_id,
          phone: loan.phone,
          alternate_mobile: loan.alternate_mobile
        };
        
        const sent = await sendSMSToUser(user, loan, template, message);
        totalSent += sent;
      }
    } catch (error) {
      console.error(`[SMS Cron] Error processing status template ${template.template_key}:`, error);
      await cronLogger.error(`SMS status template ${template.template_key} error: ${error.message}`, error);
    }
  }
  
  return totalSent;
}

/**
 * Main SMS notification job function
 */
async function runSMSNotificationJob() {
  const startTime = Date.now();
  let totalSent = 0;
  
  try {
    await initializeDatabase();
    
    // Initialize tables
    await initSmsLogsTable();
    await initSmsTemplatesTable();
    
    // Seed default templates if table is empty
    const templateCount = await executeQuery('SELECT COUNT(*) as count FROM sms_templates');
    if (!templateCount || templateCount[0].count === 0) {
      console.log('[SMS Cron] No templates found, seeding defaults...');
      await seedDefaultTemplates();
    }
    
    const currentTime = getCurrentTimeIST();
    console.log(`[SMS Cron] Running SMS notification job at ${currentTime} IST`);
    
    // Load templates from database
    const templates = await loadTemplatesFromDB();
    console.log(`[SMS Cron] Loaded ${templates.length} active templates`);
    
    if (templates.length === 0) {
      console.log('[SMS Cron] No active templates found');
      return { success: true, totalSent: 0, duration: Date.now() - startTime };
    }
    
    // Process DPD-based SMS
    const dpdSent = await processDPDBasedSMS(templates, currentTime);
    totalSent += dpdSent;
    
    // Process status-based SMS
    const statusSent = await processStatusBasedSMS(templates, currentTime);
    totalSent += statusSent;
    
    const duration = Date.now() - startTime;
    
    if (totalSent > 0) {
      await cronLogger.info(`SMS notification job completed: ${totalSent} SMS sent in ${duration}ms`);
    }
    
    return {
      success: true,
      totalSent,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[SMS Cron] Job failed:', error);
    await cronLogger.error(`SMS notification job failed: ${error.message}`, error);
    
    return {
      success: false,
      totalSent,
      duration,
      error: error.message
    };
  }
}

// Run if called directly (for testing)
if (require.main === module) {
  runSMSNotificationJob()
    .then((result) => {
      console.log('Job completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}

module.exports = { runSMSNotificationJob };
