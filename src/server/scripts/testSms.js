/**
 * Test SMS Script - Direct API Testing
 * Run: node src/server/scripts/testSms.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function testSMS() {
  const testMobile = '8800899875';
  const testMessage = '1234 is your OTP for Pocketcredit login verification. This code is valid for 5 min. Do not share this OTP with anyone for security reasons.';
  const OTP_TEMPLATE_ID = '1107900001243800002';
  
  const apiKey = process.env.ONEXTEL_API_KEY;
  const password = process.env.ONEXTEL_PASSWORD;
  const entityId = process.env.ONEXTEL_ENTITY_ID;
  const baseUrl = process.env.ONEXTEL_BASE_URL || 'https://api.onexaura.com';

  console.log('='.repeat(50));
  console.log('Testing OneXtel SMS API - Direct');
  console.log('='.repeat(50));
  console.log('Mobile:', testMobile);
  console.log('Template ID:', OTP_TEMPLATE_ID);
  console.log('API Key:', apiKey || 'Missing');
  console.log('Password:', password ? '✓ Configured' : '✗ Missing');
  console.log('Entity ID:', entityId || 'Missing');
  console.log('Base URL:', baseUrl);
  console.log('='.repeat(50));

  // Auth works! Testing sender ID and 'to' parameter (Format 5-6 showed INVALID SENDER)
  const urlFormats = [
    // Format 1: Try 'from' instead of 'senderid'
    `${baseUrl}/api/sms?key=${apiKey}&pwd=${password}&to=${testMobile}&from=PKTCRD&msg=${encodeURIComponent(testMessage)}&entityid=${entityId}&templateid=${OTP_TEMPLATE_ID}`,
    // Format 2: Without sender ID (use default)
    `${baseUrl}/api/sms?key=${apiKey}&pwd=${password}&to=${testMobile}&msg=${encodeURIComponent(testMessage)}&entityid=${entityId}&templateid=${OTP_TEMPLATE_ID}`,
    // Format 3: Try SPFNTC sender (company name abbrev)
    `${baseUrl}/api/sms?key=${apiKey}&pwd=${password}&to=${testMobile}&senderid=SPFNTC&msg=${encodeURIComponent(testMessage)}&entityid=${entityId}&templateid=${OTP_TEMPLATE_ID}`,
    // Format 4: Try sender with 'from' param
    `${baseUrl}/api/sms?key=${apiKey}&pwd=${password}&to=${testMobile}&from=SPFNTC&msg=${encodeURIComponent(testMessage)}&entityid=${entityId}&templateid=${OTP_TEMPLATE_ID}`,
    // Format 5: Try SPHETI (Spheeti)
    `${baseUrl}/api/sms?key=${apiKey}&pwd=${password}&to=${testMobile}&senderid=SPHETI&msg=${encodeURIComponent(testMessage)}&entityid=${entityId}&templateid=${OTP_TEMPLATE_ID}`,
  ];

  for (let i = 0; i < urlFormats.length; i++) {
    console.log(`\n--- Testing Format ${i + 1} ---`);
    try {
      const response = await fetch(urlFormats[i], {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const text = await response.text();
      console.log('Response:', text);
      
      try {
        const json = JSON.parse(text);
        if (json.status === 100 || json.uid) {
          console.log('✅ SUCCESS with format', i + 1);
          return;
        }
      } catch (e) {
        // Not JSON
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
  
  console.log('\n❌ All formats failed');
}

testSMS();
