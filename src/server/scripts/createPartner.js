/**
 * Script to create a new partner
 * Usage: node scripts/createPartner.js
 */

const { createPartner } = require('../models/partner');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log('=== Create New Partner ===\n');

    const partnerUuid = await question('Partner UUID (e.g., partner_uuid_12345): ');
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
    console.log(`  UUID: ${partner.partner_uuid}`);
    console.log(`  Client ID: ${partner.client_id}`);
    console.log(`  Name: ${partner.name}`);
    console.log(`  Email: ${partner.email || 'N/A'}`);
    console.log(`  Active: ${partner.is_active ? 'Yes' : 'No'}`);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating partner:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();

