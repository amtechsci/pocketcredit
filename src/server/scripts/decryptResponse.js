/**
 * Script to decrypt encrypted API response
 * 
 * Usage: node src/server/scripts/decryptResponse.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Your (Pocket Credit) Private Key - for decrypting AES keys
const POCKET_CREDIT_PRIVATE_KEY_PATH = path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');

// Partner's Public Key - for verifying signature
const PARTNER_PUBLIC_KEY_PATH = path.join(__dirname, '../../partner_keys/partners/PC_3267MCL11_public.pem');

// Encrypted response from API (paste here)
const encryptedResponse = {
    "version": "1.0",
    "partnerId": "PC_3267MCL11",
    "timestamp": 1768336800219,
    "encryptedKey": "TOhEtJcfXq8d6K8yQ2bfLvEUdybVoVdZkk54s7n0AObZBeYXPkxqWTEhR4TEEMaXg82Fq7GGc/expfIX2e9ieEtIqvw9sjBnkCOcw7YuJb5Y2YMINOfEy8AFl/zrSDSqedCu4mAINGiUXpTi4mu41WYHNMqC/BiAumfxT6vNqOHQ7cIhP6XOB/jQYsarQy+GWa2jva+gwdvXpN4PoIMCFIb8WGAml60tRN9g8MC5vJ5kkqG+qOaVk1U3wZKRIlnGQCqtZNZMqUZrg6IyjoSRsDkv/6lXJ8p4LO7cezWGVBKDLsOkt5bJZnURjMw9fjTyy+uXEJ7H6uPwaEoT0mxoSg==",
    "encryptedData": "+oADX10bf2Jx4uQ6ejES63SpmOGaADZ5i1oabSjYLXZWSkLCmo6nljGd+aDG8aicdXt0/poWnA==",
    "authTag": "DGTQT8QFgTDGYxxWaYCt+Q==",
    "iv": "ztpJ4XBWbKRn0TE4",
    "signature": "bX6mvz7n9C79HI/8fTP9AOqEXcpXkYD9WlZQCi4OBv4M7AO1LJB0xzDdJJQoLu5+6yPhuQtGFSuOeF91l3LqiFylBnLCqz6B6Zm+C7bBxXe71hyzXlsMfGGLhyOjOmUBFC0j4Lp9DY/1dp49r0+wN5Xhc+JQ3+sPkSj6MnXJuAWPUTG0gsF4QCZCnaRO6d6giwtIh9YsiHTtbp5p0ybnpo3ssDoFXUaGvlGfmryj7D2DNJxv86nY0yUMcHACK2rrsGvvR7/W2AeEemq2FyaUZ40yT65TZBq9ZdqICINQEy8bdgEAxZC/ddsgH1aIggZcncOXyXQ0Vw90lMDyd+HoPg==",
    "algorithm": "RSA-OAEP-AES256-GCM"
};

// ============================================================================
// DECRYPTION FUNCTION
// ============================================================================

function decryptResponse(encryptedPayload, partnerPublicKeyPem, ourPrivateKeyPem) {
    try {
        const { encryptedKey, encryptedData, authTag, signature, partnerId, timestamp, iv } = encryptedPayload;
        
        console.log('🔓 Starting decryption process...\n');
        
        // Step 1: Verify signature
        console.log('🔍 Verifying signature...');
        const payloadToVerify = JSON.stringify({
            version: encryptedPayload.version,
            partnerId,
            timestamp,
            encryptedKey,
            encryptedData,
            authTag: encryptedPayload.authTag,
            iv: iv || '',
            algorithm: encryptedPayload.algorithm
        });
        
        const verify = crypto.createVerify('SHA256');
        verify.update(payloadToVerify);
        const isValid = verify.verify(partnerPublicKeyPem, signature, 'base64');
        
        if (!isValid) {
            throw new Error('Invalid signature - response may have been tampered with');
        }
        console.log('✅ Signature verified');
        
        // Step 2: Decrypt AES key
        console.log('🔓 Decrypting AES key...');
        const aesKey = crypto.privateDecrypt(
            {
                key: ourPrivateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encryptedKey, 'base64')
        );
        console.log('✅ AES key decrypted');
        
        // Step 3: Decrypt data
        console.log('🔓 Decrypting response data...');
        const ivBuffer = Buffer.from(iv, 'base64');
        const actualIV = ivBuffer.length === 12 ? ivBuffer : ivBuffer.slice(0, 12);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, actualIV);
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        console.log('✅ Data decrypted');
        
        // Step 4: Parse JSON
        const responseData = JSON.parse(decrypted);
        console.log('\n✅ Decryption successful!\n');
        
        return responseData;
        
    } catch (error) {
        console.error('❌ Decryption error:', error.message);
        throw error;
    }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
    try {
        // Load keys
        console.log('📁 Loading keys...\n');
        
        if (!fs.existsSync(POCKET_CREDIT_PRIVATE_KEY_PATH)) {
            console.error('❌ Pocket Credit private key not found!');
            console.error(`   Expected at: ${POCKET_CREDIT_PRIVATE_KEY_PATH}`);
            process.exit(1);
        }
        
        if (!fs.existsSync(PARTNER_PUBLIC_KEY_PATH)) {
            console.error('❌ Partner public key not found!');
            console.error(`   Expected at: ${PARTNER_PUBLIC_KEY_PATH}`);
            console.error('\n   You need to store the partner\'s public key first.');
            console.error('   See PARTNER_PUBLIC_KEY_SETUP.md for instructions.');
            process.exit(1);
        }
        
        const pocketCreditPrivateKey = fs.readFileSync(POCKET_CREDIT_PRIVATE_KEY_PATH, 'utf8');
        const partnerPublicKey = fs.readFileSync(PARTNER_PUBLIC_KEY_PATH, 'utf8');
        
        console.log('✅ Keys loaded\n');
        
        // Decrypt response
        const decryptedResponse = decryptResponse(
            encryptedResponse,
            partnerPublicKey,
            pocketCreditPrivateKey
        );
        
        // Display decrypted response
        console.log('📥 Decrypted Response:');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(decryptedResponse, null, 2));
        console.log('─'.repeat(80));
        
        return decryptedResponse;
        
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
module.exports = { decryptResponse };
