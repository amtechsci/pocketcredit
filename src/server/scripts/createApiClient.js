/**
 * Create a B2B Bank API client (Account Aggregator), NOT a lead partner.
 * Usage:
 *   node src/server/scripts/createApiClient.js <client_id> <client_secret> <name> [email] [allowed_ips]
 */

const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const serverEnvPath = path.join(__dirname, '../.env');
const rootEnvPath = path.join(__dirname, '../../../.env');
if (fs.existsSync(serverEnvPath)) dotenv.config({ path: serverEnvPath });
else if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
else dotenv.config();

const { createApiClient } = require('../models/apiClient');

async function main() {
  const clientId = process.argv[2];
  const clientSecret = process.argv[3];
  const name = process.argv[4];
  const email = process.argv[5] || null;
  const allowedIps = process.argv[6] || null;

  if (!clientId || !clientSecret || !name) {
    console.log(
      'Usage: node src/server/scripts/createApiClient.js <client_id> <client_secret> <name> [email] [allowed_ips]'
    );
    process.exit(1);
  }

  const client = await createApiClient({
    client_uuid: uuidv4(),
    client_id: clientId,
    client_secret: clientSecret,
    name,
    email,
    allowed_ips: allowedIps && allowedIps.trim() !== '' ? allowedIps.trim() : null
  });

  console.log('\n✅ Bank API client created\n');
  console.log(`  client_uuid: ${client.client_uuid}`);
  console.log(`  client_id:   ${client.client_id}`);
  console.log(`  name:        ${client.name}`);
  console.log('\n📋 Credentials (store securely):');
  console.log(`  BANK_API_CLIENT_ID=${clientId}`);
  console.log(`  BANK_API_CLIENT_SECRET=${clientSecret}`);
  console.log(`  BANK_API_CLIENT_UUID=${client.client_uuid}`);
  console.log('\nWebhook HMAC key material: BANK_API_JWT_SECRET on Pocket server + client_uuid');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
