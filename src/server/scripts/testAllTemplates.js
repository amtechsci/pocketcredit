/**
 * Test All SMS Templates
 * Sends a test SMS for each template to the specified number
 * Run: node src/server/scripts/testAllTemplates.js
 */

require('dotenv').config();
const { executeQuery, initializeDatabase } = require('../config/database');
const { smsService } = require('../utils/smsService');
const { initSmsTemplatesTable } = require('../routes/adminSmsTemplates');

const TEST_MOBILE = '8800899875';

// Sample data for template variable replacement
const sampleData = {
  otp: '1234',
  validity: '5',
  name: 'Test User',
  user_name: 'Test User',
  days_passed: '10',
  savings: '500',
  url: 'https://pocketcredit.in',
  due_date: '2026-02-15',
  emi_amount: '5000',
  emi_number: '1',
  amount: '2500',
  bank_name: 'HDFC Bank',
  account_number: '****1234',
  acc_manager_name: 'John Doe',
  acc_manager_phone: '9876543210',
  reference_name: 'Reference Person',
  email: 'support@pocketcredit.in',
  new_limit: '50000'
};

/**
 * Replace template variables with sample data
 */
function replaceVariables(template, data = sampleData) {
  let message = template;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    message = message.replace(regex, data[key]);
  });
  return message;
}

/**
 * Test all SMS templates
 */
async function testAllTemplates() {
  try {
    await initializeDatabase();
    await initSmsTemplatesTable();

    console.log('='.repeat(70));
    console.log('Testing All SMS Templates');
    console.log('='.repeat(70));
    console.log(`Test Mobile: ${TEST_MOBILE}`);
    console.log('='.repeat(70));
    console.log();

    // Get all active templates
    const templates = await executeQuery(`
      SELECT * FROM sms_templates WHERE is_active = 1 ORDER BY category, template_name
    `);

    if (!templates || templates.length === 0) {
      console.log('❌ No active templates found in database');
      return;
    }

    console.log(`Found ${templates.length} active templates\n`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    // Safe JSON parse helper
    const safeJsonParse = (value, defaultValue = null) => {
      if (!value || value === '' || value === 'null') return defaultValue;
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch (e) { return defaultValue; }
    };

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const templateNum = i + 1;
      
      console.log(`[${templateNum}/${templates.length}] Testing: ${template.template_name}`);
      console.log(`  Key: ${template.template_key}`);
      console.log(`  Category: ${template.category || 'N/A'}`);
      console.log(`  Trigger: ${template.trigger_type}`);

      // Check if template ID is configured
      if (!template.template_id) {
        console.log(`  ⚠️  SKIPPED: No DLT Template ID configured`);
        results.skipped++;
        console.log();
        continue;
      }

      // Replace variables in message
      const message = replaceVariables(template.message_template);

      try {
        const result = await smsService.sendSMS({
          to: TEST_MOBILE,
          message: message,
          templateId: template.template_id,
          senderId: template.sender_id || 'PKTCRD'
        });

        if (result.success) {
          console.log(`  ✅ SUCCESS: SMS sent (UID: ${result.uid || 'N/A'})`);
          results.success++;
        } else {
          console.log(`  ❌ FAILED: ${result.description} (Status: ${result.status})`);
          results.failed++;
        }
      } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        results.failed++;
      }

      console.log();
      
      // Small delay between sends to avoid rate limiting
      if (i < templates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Summary
    console.log('='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Templates: ${templates.length}`);
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  Skipped (No Template ID): ${results.skipped}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error testing templates:', error);
  }
}

// Run the test
testAllTemplates();
