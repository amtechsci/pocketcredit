/**
 * Script to update partner public_key_path
 * Usage: 
 *   node src/server/scripts/updatePartnerPublicKey.js <partner_uuid> <pem_file_path>
 *   OR
 *   node src/server/scripts/updatePartnerPublicKey.js <partner_uuid> --content "<pem_content>"
 */

// Load environment variables first
// Try multiple possible .env file locations
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Try server directory first (most common location)
const serverEnvPath = path.join(__dirname, '../.env');
const rootEnvPath = path.join(__dirname, '../../../.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  // Fallback to default dotenv behavior (looks for .env in current working directory)
  dotenv.config();
}

// fs and path already required above
const { findPartnerByUuid } = require('../models/partner');
const { executeQuery, initializeDatabase } = require('../config/database');

async function updatePartnerPublicKey(partnerUuid, pemFilePathOrContent, isContent = false) {
  try {
    await initializeDatabase();
    
    console.log(`\n🔐 Setting up public key for Partner UUID: ${partnerUuid}\n`);
    
    // Check if partner exists
    const partner = await findPartnerByUuid(partnerUuid);
    
    if (!partner) {
      console.log('❌ Partner not found or inactive');
      console.log(`   Partner UUID: ${partnerUuid}`);
      return;
    }
    
    console.log(`✅ Partner found: ${partner.name} (${partner.client_id})`);
    
    // Read PEM content
    let pemContent;
    if (isContent) {
      pemContent = pemFilePathOrContent;
    } else {
      if (!fs.existsSync(pemFilePathOrContent)) {
        console.error(`❌ PEM file not found: ${pemFilePathOrContent}`);
        return;
      }
      pemContent = fs.readFileSync(pemFilePathOrContent, 'utf8');
    }
    
    // Validate PEM format
    if (!pemContent.includes('BEGIN PUBLIC KEY') && !pemContent.includes('BEGIN RSA PUBLIC KEY')) {
      console.error('❌ Invalid PEM format. Expected PUBLIC KEY format.');
      return;
    }
    
    // Create partners directory if it doesn't exist
    const partnersDir = path.join(__dirname, '../../partner_keys/partners');
    if (!fs.existsSync(partnersDir)) {
      fs.mkdirSync(partnersDir, { recursive: true });
      console.log(`📁 Created directory: ${partnersDir}`);
    }
    
    // Save PEM file
    const publicKeyPath = path.join(partnersDir, `${partnerUuid}_public.pem`);
    fs.writeFileSync(publicKeyPath, pemContent.trim() + '\n');
    
    // Convert to forward slashes for database (works on both Windows and Linux)
    const dbPath = publicKeyPath.replace(/\\/g, '/');
    
    console.log(`✅ Public key saved to: ${publicKeyPath}`);
    
    // Update database
    await executeQuery(
      'UPDATE partners SET public_key_path = ?, updated_at = NOW() WHERE partner_uuid = ?',
      [dbPath, partnerUuid]
    );
    
    console.log('✅ Database updated successfully!');
    console.log(`\n📋 Configuration Summary:`);
    console.log(`   Partner UUID: ${partnerUuid}`);
    console.log(`   Client ID: ${partner.client_id}`);
    console.log(`   Public Key Path: ${dbPath}`);
    console.log(`\n✅ Partner public key setup complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get arguments from command line
const partnerUuid = process.argv[2];
const pemInput = process.argv[3];
const isContent = pemInput === '--content';
const pemValue = isContent ? process.argv[4] : pemInput;

if (!partnerUuid || !pemValue) {
  console.log('Usage:');
  console.log('  node src/server/scripts/updatePartnerPublicKey.js <partner_uuid> <pem_file_path>');
  console.log('  OR');
  console.log('  node src/server/scripts/updatePartnerPublicKey.js <partner_uuid> --content "<pem_content>"');
  console.log('\nExample:');
  console.log('  node src/server/scripts/updatePartnerPublicKey.js PC_3267MCL11 ./public.pem');
  console.log('  OR');
  console.log('  node src/server/scripts/updatePartnerPublicKey.js PC_3267MCL11 --content "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"');
  process.exit(1);
}

updatePartnerPublicKey(partnerUuid, pemValue, isContent).then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
