/**
 * Script to create encrypted request body for Partner API
 * 
 * This script:
 * 1. Encrypts lead data with AES-256-GCM
 * 2. Encrypts AES key with Pocket Credit's public RSA key
 * 3. Signs the payload with partner's private key
 * 4. Generates the complete encrypted request body
 * 
 * Usage: node src/server/scripts/createEncryptedRequestBody.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

// Pocket Credit's Public Key (provided by Pocket Credit)
const POCKET_CREDIT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxC8+3l6+K+U419Ndu1qC
f+GsWDpuQLXbC41KiEAqM3wgeWxtbhfIC6ZJXfX85Ot7U1TTlMudxzk22KB7L1dv
S17QCJTg7oYjpwEq+O0m39VHB5lObgoh+kxyGQSe1GvxvA7XJtDcppHcqxo+waS+
xyT/qtORf/F78HlE1+eh/EReDa3OCaHuWzorrqWBbSMvMWWmWjRXFBGAw7GfcX0m
uDtCEQ2257MpgWAP2KE8KO3VQcb6Hqt11Eqp208yPjd+wzmKPLGaaoJDhRZoBwTL
gL8k2VR2v4ZAGwrCap8lfiLFxtm7AM+y5LjkfnbJ7pKaXiMJZWGTOpEXW9xMrQFn
BwIDAQAB
-----END PUBLIC KEY-----`;

// Partner Configuration
const PARTNER_ID = 'PC_3267MCL11'; // Your partner UUID

// Partner's Private Key (for signing - load from file or paste here)
const PARTNER_PRIVATE_KEY_PATH = path.join(__dirname, '../../partner_keys/partner_private.pem');
// OR paste your private key directly:
// const PARTNER_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
// YOUR_PRIVATE_KEY_HERE
// -----END PRIVATE KEY-----`;

// Lead Data to Encrypt
const leadData = {
    first_name: "John",
    last_name: "Doe",
    mobile_number: "9876543210",
    pan_number: "ABCDE1234F",
    // Optional fields
    date_of_birth: "1990-01-15",
    employment_type: "Salaried",
    monthly_salary: 50000,
    payment_mode: "Bank Transfer"
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

function createEncryptedRequestBody(leadData, partnerId, pocketCreditPublicKey, partnerPrivateKey) {
    try {
        console.log('🔐 Starting encryption process...\n');

        // Step 1: Generate random AES-256 key (32 bytes)
        const aesKey = crypto.randomBytes(32);
        console.log('✅ Generated AES-256 key (32 bytes)');

        // Step 2: Encrypt lead data with AES-256-GCM
        const plaintext = JSON.stringify(leadData);
        const iv = crypto.randomBytes(12); // 96-bit IV for GCM (recommended)

        const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
        let encryptedData = cipher.update(plaintext, 'utf8', 'base64');
        encryptedData += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        console.log('✅ Encrypted lead data with AES-256-GCM');
        console.log(`   Plaintext length: ${plaintext.length} bytes`);
        console.log(`   Encrypted length: ${encryptedData.length} base64 chars`);

        // Step 3: Encrypt AES key with Pocket Credit's public RSA key
        const encryptedKey = crypto.publicEncrypt(
            {
                key: pocketCreditPublicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            aesKey
        ).toString('base64');
        console.log('✅ Encrypted AES key with RSA-OAEP');
        console.log(`   Encrypted key length: ${encryptedKey.length} base64 chars`);

        // Step 4: Create payload for signing
        const timestamp = Date.now();
        const payloadToSign = JSON.stringify({
            version: '1.0',
            partnerId: partnerId,
            timestamp: timestamp,
            encryptedKey: encryptedKey,
            encryptedData: encryptedData,
            authTag: authTag.toString('base64'),
            iv: iv.toString('base64'),
            algorithm: 'RSA-OAEP-AES256-GCM'
        });
        console.log('✅ Created payload for signing');

        // Step 5: Sign the payload with partner's private key
        const signature = crypto.createSign('SHA256')
            .update(payloadToSign)
            .sign(partnerPrivateKey, 'base64');
        console.log('✅ Signed payload with partner private key');
        console.log(`   Signature length: ${signature.length} base64 chars`);

        // Step 6: Prepare final request body
        const requestBody = {
            partnerId: partnerId,
            encryptedData: encryptedData,
            encryptedKey: encryptedKey,
            authTag: authTag.toString('base64'),
            iv: iv.toString('base64'),
            signature: signature,
            timestamp: timestamp,  // Required for signature verification
            version: '1.0',
            algorithm: 'RSA-OAEP-AES256-GCM'
        };

        console.log('\n✅ Encrypted request body created successfully!\n');
        return requestBody;

    } catch (error) {
        console.error('❌ Error creating encrypted request body:', error.message);
        throw error;
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

function main() {
    try {
        // Load partner private key
        let partnerPrivateKey;
        
        if (fs.existsSync(PARTNER_PRIVATE_KEY_PATH)) {
            console.log(`📁 Loading partner private key from: ${PARTNER_PRIVATE_KEY_PATH}`);
            partnerPrivateKey = fs.readFileSync(PARTNER_PRIVATE_KEY_PATH, 'utf8');
        } else {
            console.error('❌ Partner private key not found!');
            console.error(`   Expected at: ${PARTNER_PRIVATE_KEY_PATH}`);
            console.error('   OR update PARTNER_PRIVATE_KEY constant in the script');
            process.exit(1);
        }

        // Create encrypted request body
        const requestBody = createEncryptedRequestBody(
            leadData,
            PARTNER_ID,
            POCKET_CREDIT_PUBLIC_KEY,
            partnerPrivateKey
        );

        // Display the request body
        console.log('📦 Encrypted Request Body:');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(requestBody, null, 2));
        console.log('─'.repeat(80));

        // Save to file (optional)
        const outputPath = path.join(__dirname, '../../partner_keys/encrypted_request_body.json');
        fs.writeFileSync(outputPath, JSON.stringify(requestBody, null, 2));
        console.log(`\n💾 Saved to: ${outputPath}`);

        // Display usage instructions
        console.log('\n📝 Usage Instructions:');
        console.log('   1. Copy the request body above');
        console.log('   2. Send POST request to: https://pocketcredit.in/api/v1/partner/lead-dedupe-check');
        console.log('   3. Include headers:');
        console.log('      - Authorization: Bearer {your_access_token}');
        console.log('      - Content-Type: application/json');
        console.log('   4. Use the request body as the request payload\n');

        // Example cURL command
        console.log('📋 Example cURL Command:');
        console.log('─'.repeat(80));
        console.log(`curl --location --request POST 'https://pocketcredit.in/api/v1/partner/lead-dedupe-check' \\`);
        console.log(`--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data '${JSON.stringify(requestBody)}'`);
        console.log('─'.repeat(80));

        return requestBody;

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export for use as module
module.exports = {
    createEncryptedRequestBody,
    POCKET_CREDIT_PUBLIC_KEY,
    PARTNER_ID
};
