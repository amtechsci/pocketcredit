/**
 * Script to check partner credentials and status
 * Usage: node src/server/scripts/checkPartner.js <client_id>
 */

const { findPartnerByClientId } = require('../models/partner');
const { executeQuery, initializeDatabase } = require('../config/database');
const bcrypt = require('bcrypt');

async function checkPartner(clientId) {
  try {
    await initializeDatabase();
    
    console.log(`\n🔍 Checking partner with Client ID: ${clientId}\n`);
    
    // Check if partner exists
    const partner = await findPartnerByClientId(clientId);
    
    if (!partner) {
      console.log('❌ Partner not found or inactive');
      console.log('\nPossible reasons:');
      console.log('  1. Client ID does not exist');
      console.log('  2. Partner is inactive (is_active = 0)');
      console.log('\nTo check all partners, run:');
      console.log('  SELECT client_id, partner_uuid, name, is_active FROM partners;');
      return;
    }
    
    console.log('✅ Partner found!\n');
    console.log('Partner Details:');
    console.log(`  ID: ${partner.id}`);
    console.log(`  Partner UUID: ${partner.partner_uuid}`);
    console.log(`  Client ID: ${partner.client_id}`);
    console.log(`  Name: ${partner.name}`);
    console.log(`  Email: ${partner.email || 'N/A'}`);
    console.log(`  Active: ${partner.is_active ? 'Yes ✅' : 'No ❌'}`);
    console.log(`  Public Key Path: ${partner.public_key_path || 'Not configured'}`);
    console.log(`  Created: ${partner.created_at}`);
    console.log(`  Updated: ${partner.updated_at}`);
    
    // Test password verification
    console.log('\n🔐 To test client_secret, you can:');
    console.log('  1. Use the login API endpoint');
    console.log('  2. Or update the client_secret using SQL:');
    console.log('\n     UPDATE partners');
    console.log(`     SET client_secret = '$2b$10$...' -- bcrypt hash`);
    console.log(`     WHERE client_id = '${clientId}';`);
    console.log('\n     To generate a new hash:');
    console.log('     node -e "const bcrypt=require(\'bcrypt\');bcrypt.hash(\'your_secret\',10).then(h=>console.log(h));"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get client_id from command line
const clientId = process.argv[2];

if (!clientId) {
  console.log('Usage: node src/server/scripts/checkPartner.js <client_id>');
  console.log('\nExample:');
  console.log('  node src/server/scripts/checkPartner.js PC_7588');
  process.exit(1);
}

checkPartner(clientId).then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
