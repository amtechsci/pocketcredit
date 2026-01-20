/**
 * Script to create a new partner
 * Usage: 
 *   Interactive: node src/server/scripts/createPartner.js
 *   Command line: node src/server/scripts/createPartner.js <partner_uuid> <client_id> <client_secret> <name> [email] [public_key_path]
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

const { createPartner } = require('../models/partner');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createPartnerInteractive() {
  try {
    console.log('=== Create New Partner ===\n');

    const partnerUuid = await question('Partner UUID (e.g., PC_XXXXX): ');
    const clientId = await question('Client ID: ');
    const clientSecret = await question('Client Secret: ');
    const name = await question('Partner Name: ');
    const email = await question('Partner Email (optional): ') || null;
    const publicKeyPath = await question('Public Key Path (optional, for encryption): ') || null;

    console.log('\nCreating partner...');

    const partner = await createPartner({
      partner_uuid: partnerUuid,
      client_id: clientId,
      client_secret: clientSecret,
      name,
      email,
      public_key_path: publicKeyPath
    });

    console.log('\n✅ Partner created successfully!');
    console.log('\nPartner Details:');
    console.log(`  ID: ${partner.id}`);
    console.log(`  UUID: ${partner.partner_uuid}`);
    console.log(`  Client ID: ${partner.client_id}`);
    console.log(`  Name: ${partner.name}`);
    console.log(`  Email: ${partner.email || 'N/A'}`);
    console.log(`  Active: ${partner.is_active ? 'Yes' : 'No'}`);
    console.log(`  Public Key Path: ${publicKeyPath || 'Not configured'}`);
    
    console.log('\n📋 Credentials:');
    console.log(`  Client ID: ${clientId}`);
    console.log(`  Client Secret: ${clientSecret}`);
    console.log('\n⚠️  Save these credentials securely!');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating partner:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   Partner with this UUID or Client ID already exists!');
    }
    rl.close();
    process.exit(1);
  }
}

async function createPartnerFromArgs() {
  try {
    const partnerUuid = process.argv[2];
    const clientId = process.argv[3];
    const clientSecret = process.argv[4];
    const name = process.argv[5];
    const email = process.argv[6] || null;
    const publicKeyPath = process.argv[7] || null;

    if (!partnerUuid || !clientId || !clientSecret || !name) {
      console.log('Usage: node src/server/scripts/createPartner.js <partner_uuid> <client_id> <client_secret> <name> [email] [public_key_path]');
      console.log('\nExample:');
      console.log('  node src/server/scripts/createPartner.js PC_ABC123 PC_9999 MySecret123 "Partner Name" partner@example.com');
      process.exit(1);
    }

    console.log('\n🔐 Creating new partner...\n');

    const partner = await createPartner({
      partner_uuid: partnerUuid,
      client_id: clientId,
      client_secret: clientSecret,
      name,
      email,
      public_key_path: publicKeyPath
    });

    console.log('✅ Partner created successfully!\n');
    console.log('Partner Details:');
    console.log(`  ID: ${partner.id}`);
    console.log(`  UUID: ${partner.partner_uuid}`);
    console.log(`  Client ID: ${partner.client_id}`);
    console.log(`  Name: ${partner.name}`);
    console.log(`  Email: ${partner.email || 'N/A'}`);
    console.log(`  Active: ${partner.is_active ? 'Yes' : 'No'}`);
    console.log(`  Public Key Path: ${publicKeyPath || 'Not configured'}`);
    
    console.log('\n📋 Credentials:');
    console.log(`  Client ID: ${clientId}`);
    console.log(`  Client Secret: ${clientSecret}`);
    console.log('\n⚠️  Save these credentials securely!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating partner:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   Partner with this UUID or Client ID already exists!');
    }
    process.exit(1);
  }
}

// Check if arguments provided (command line mode) or interactive mode
if (process.argv.length > 2) {
  createPartnerFromArgs();
} else {
  createPartnerInteractive();
}

