/**
 * Extract public key from partner's private key
 * 
 * For testing: If you have partner_private.pem, extract the public key
 * 
 * Usage: node src/server/scripts/extractPartnerPublicKey.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const PARTNER_PRIVATE_KEY_PATH = path.join(__dirname, '../../partner_keys/partner_private.pem');
const PARTNER_PUBLIC_KEY_OUTPUT = path.join(__dirname, '../../partner_keys/partners/PC_3267MCL11_public.pem');

function extractPublicKey() {
    try {
        console.log('📁 Loading partner private key...');
        
        if (!fs.existsSync(PARTNER_PRIVATE_KEY_PATH)) {
            console.error('❌ Partner private key not found!');
            console.error(`   Expected at: ${PARTNER_PRIVATE_KEY_PATH}`);
            process.exit(1);
        }
        
        const privateKey = fs.readFileSync(PARTNER_PRIVATE_KEY_PATH, 'utf8');
        
        console.log('🔑 Extracting public key from private key...');
        
        // Create a key object from private key
        const keyObject = crypto.createPrivateKey(privateKey);
        
        // Export as public key
        const publicKey = keyObject.export({
            type: 'spki',
            format: 'pem'
        });
        
        // Create partners directory if it doesn't exist
        const partnersDir = path.dirname(PARTNER_PUBLIC_KEY_OUTPUT);
        if (!fs.existsSync(partnersDir)) {
            fs.mkdirSync(partnersDir, { recursive: true });
            console.log(`📁 Created directory: ${partnersDir}`);
        }
        
        // Save public key
        fs.writeFileSync(PARTNER_PUBLIC_KEY_OUTPUT, publicKey);
        console.log(`✅ Public key extracted and saved to: ${PARTNER_PUBLIC_KEY_OUTPUT}`);
        
        console.log('\n📤 Partner Public Key:');
        console.log('─'.repeat(80));
        console.log(publicKey);
        console.log('─'.repeat(80));
        
        console.log('\n📝 Next Step: Update database');
        console.log('─'.repeat(80));
        console.log(`UPDATE partners`);
        console.log(`SET public_key_path = '${PARTNER_PUBLIC_KEY_OUTPUT.replace(/\\/g, '/')}'`);
        console.log(`WHERE partner_uuid = 'PC_3267MCL11';`);
        console.log('─'.repeat(80));
        
        return publicKey;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    extractPublicKey();
}

module.exports = { extractPublicKey };
