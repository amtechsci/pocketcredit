/**
 * Script to update partner IP whitelist
 * Usage: 
 *   node src/server/scripts/updatePartnerIpWhitelist.js <partner_uuid> <ip1,ip2,ip3>
 *   node src/server/scripts/updatePartnerIpWhitelist.js <partner_uuid> "" (to clear whitelist - allow all IPs)
 */

// Load environment variables first
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Try multiple possible .env file locations
const serverEnvPath = path.join(__dirname, '../.env');
const rootEnvPath = path.join(__dirname, '../../../.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const { findPartnerByUuid } = require('../models/partner');
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Validate IP address format
 */
function isValidIp(ip) {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  // IPv6 validation (basic)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Validate and normalize IP whitelist
 */
function validateIpWhitelist(ipString) {
  if (!ipString || ipString.trim() === '') {
    return null; // Empty means allow all IPs
  }
  
  const ips = ipString.split(',').map(ip => ip.trim()).filter(ip => ip);
  
  // Validate each IP
  const invalidIps = ips.filter(ip => !isValidIp(ip));
  if (invalidIps.length > 0) {
    throw new Error(`Invalid IP addresses: ${invalidIps.join(', ')}`);
  }
  
  return ips.join(', ');
}

async function updatePartnerIpWhitelist(partnerUuid, ipWhitelist) {
  try {
    await initializeDatabase();
    
    console.log(`\n🔐 Updating IP whitelist for Partner UUID: ${partnerUuid}\n`);
    
    // Check if partner exists
    const partner = await findPartnerByUuid(partnerUuid);
    
    if (!partner) {
      console.log('❌ Partner not found or inactive');
      console.log(`   Partner UUID: ${partnerUuid}`);
      return;
    }
    
    console.log(`✅ Partner found: ${partner.name} (${partner.client_id})`);
    
    // Validate and normalize IP whitelist
    let normalizedIps = null;
    try {
      normalizedIps = validateIpWhitelist(ipWhitelist);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      return;
    }
    
    // Update database
    await executeQuery(
      'UPDATE partners SET allowed_ips = ?, updated_at = NOW() WHERE partner_uuid = ?',
      [normalizedIps, partnerUuid]
    );
    
    console.log('✅ IP whitelist updated successfully!');
    console.log(`\n📋 Configuration Summary:`);
    console.log(`   Partner UUID: ${partnerUuid}`);
    console.log(`   Client ID: ${partner.client_id}`);
    if (normalizedIps) {
      console.log(`   Allowed IPs: ${normalizedIps}`);
      console.log(`   Status: IP whitelist enabled (only listed IPs allowed)`);
    } else {
      console.log(`   Allowed IPs: (empty - all IPs allowed)`);
      console.log(`   Status: IP whitelist disabled (all IPs allowed)`);
    }
    console.log(`\n✅ Partner IP whitelist setup complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get arguments from command line
const partnerUuid = process.argv[2];
const ipWhitelist = process.argv[3];

if (!partnerUuid) {
  console.log('Usage:');
  console.log('  node src/server/scripts/updatePartnerIpWhitelist.js <partner_uuid> <ip1,ip2,ip3>');
  console.log('  node src/server/scripts/updatePartnerIpWhitelist.js <partner_uuid> "" (to allow all IPs)');
  console.log('\nExamples:');
  console.log('  node src/server/scripts/updatePartnerIpWhitelist.js PC_3267MCL11 "192.168.1.1,10.0.0.1"');
  console.log('  node src/server/scripts/updatePartnerIpWhitelist.js PC_3267MCL11 "203.0.113.0/24" (CIDR notation)');
  console.log('  node src/server/scripts/updatePartnerIpWhitelist.js PC_3267MCL11 "" (allow all IPs)');
  console.log('\nIP Format:');
  console.log('  - Single IP: "192.168.1.1"');
  console.log('  - Multiple IPs: "192.168.1.1,10.0.0.1,203.0.113.5"');
  console.log('  - CIDR notation: "192.168.1.0/24" (allows 192.168.1.0-255)');
  console.log('  - Empty string: "" (allows all IPs)');
  process.exit(1);
}

updatePartnerIpWhitelist(partnerUuid, ipWhitelist || '').then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
