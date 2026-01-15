/**
 * Script to update partner client_secret
 * Usage: node src/server/scripts/updatePartnerSecret.js <client_id> <new_secret>
 */

const { findPartnerByClientId } = require('../models/partner');
const { executeQuery, initializeDatabase } = require('../config/database');
const bcrypt = require('bcrypt');

async function updatePartnerSecret(clientId, newSecret) {
  try {
    await initializeDatabase();
    
    console.log(`\n🔐 Updating client_secret for Client ID: ${clientId}\n`);
    
    // Check if partner exists
    const partner = await findPartnerByClientId(clientId);
    
    if (!partner) {
      console.log('❌ Partner not found or inactive');
      console.log(`   Client ID: ${clientId}`);
      return;
    }
    
    console.log(`✅ Partner found: ${partner.name} (${partner.partner_uuid})`);
    console.log('\nHashing new client_secret...');
    
    // Hash the new secret
    const hashedSecret = await bcrypt.hash(newSecret, 10);
    
    // Update in database
    await executeQuery(
      'UPDATE partners SET client_secret = ?, updated_at = NOW() WHERE client_id = ?',
      [hashedSecret, clientId]
    );
    
    console.log('✅ Client secret updated successfully!');
    console.log('\nYou can now login with:');
    console.log(`  Client ID: ${clientId}`);
    console.log(`  Client Secret: ${newSecret}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get arguments from command line
const clientId = process.argv[2];
const newSecret = process.argv[3];

if (!clientId || !newSecret) {
  console.log('Usage: node src/server/scripts/updatePartnerSecret.js <client_id> <new_secret>');
  console.log('\nExample:');
  console.log('  node src/server/scripts/updatePartnerSecret.js PC_7588 MyNewSecret123');
  process.exit(1);
}

updatePartnerSecret(clientId, newSecret).then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
