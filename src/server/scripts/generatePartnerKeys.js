/**
 * Script to generate RSA key pair for Partner API encryption
 * 
 * This generates:
 * - pocketcredit_private.pem: Private key (KEEP SECRET - used by Pocket Credit to decrypt)
 * - pocketcredit_public.pem: Public key (SHARE WITH PARTNERS - used by partners to encrypt)
 * 
 * Usage: node src/server/scripts/generatePartnerKeys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const KEY_SIZE = 2048; // RSA key size in bits
const KEYS_DIR = path.join(__dirname, '../../partner_keys');

// Create keys directory if it doesn't exist
if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    console.log(`📁 Created directory: ${KEYS_DIR}`);
}

// Check if keys already exist
const privateKeyPath = path.join(KEYS_DIR, 'pocketcredit_private.pem');
const publicKeyPath = path.join(KEYS_DIR, 'pocketcredit_public.pem');

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
    console.log('⚠️  WARNING: Keys already exist!');
    console.log(`   Private key: ${privateKeyPath}`);
    console.log(`   Public key: ${publicKeyPath}`);
    console.log('\n   If you want to regenerate, delete the existing keys first.');
    console.log('   This will invalidate all existing encrypted requests!');
    process.exit(1);
}

console.log('🔐 Generating RSA key pair for Partner API encryption...\n');

try {
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: KEY_SIZE,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    // Save private key (restrictive permissions: owner read/write only)
    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
    console.log(`✅ Private key saved to: ${privateKeyPath}`);
    console.log(`   Permissions: 600 (owner read/write only)`);

    // Save public key (readable by all)
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log(`✅ Public key saved to: ${publicKeyPath}`);

    // Display key information
    console.log('\n📋 Key Information:');
    console.log(`   Algorithm: RSA-${KEY_SIZE}`);
    console.log(`   Format: PEM`);
    console.log(`   Usage: Encrypt AES-256 keys for partner API requests`);
    console.log(`   Encryption: RSA-OAEP with SHA-256`);

    // Display public key (for easy copying)
    console.log('\n📤 Public Key (share with partners):');
    console.log('─'.repeat(60));
    console.log(publicKey);
    console.log('─'.repeat(60));

    // Test the keys work
    console.log('\n🧪 Testing key pair...');
    const testData = Buffer.from('Test encryption/decryption');
    
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        testData
    );

    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        encrypted
    );

    if (testData.equals(decrypted)) {
        console.log('✅ Key pair test passed! Encryption/decryption works correctly.\n');
    } else {
        console.error('❌ Key pair test failed!');
        process.exit(1);
    }

    // Next steps
    console.log('📝 Next Steps:');
    console.log('   1. Set environment variable:');
    console.log(`      PARTNER_PRIVATE_KEY_PATH=${privateKeyPath}`);
    console.log('   2. Enable encryption in environment:');
    console.log('      PARTNER_API_ENCRYPTION_ENABLED=true');
    console.log('   3. Share the public key with partners via secure channel');
    console.log('   4. Update partner documentation with public key');
    console.log('\n⚠️  SECURITY REMINDER:');
    console.log('   - Keep the private key SECRET and secure');
    console.log('   - Never commit private key to version control');
    console.log('   - Use secure channels to share public key with partners');
    console.log('   - Consider using a key management service for production\n');

} catch (error) {
    console.error('❌ Error generating keys:', error.message);
    process.exit(1);
}
