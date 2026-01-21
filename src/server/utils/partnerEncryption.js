const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Partner Encryption Utility
 * 
 * This module provides encryption/decryption functionality for partner API.
 * It uses RSA-OAEP for key encryption and AES-256-GCM for data encryption.
 * 
 * Note: For production, consider using @pocketcredit/secure-partner-sdk
 */

const ALGORITHM = 'RSA-OAEP-AES256-GCM';
const AES_ALGORITHM = 'aes-256-gcm';
const RSA_ALGORITHM = 'RSA-OAEP';
const KEY_SIZE = 32; // 256 bits for AES-256

/**
 * Generate a random AES key
 * @returns {Buffer} Random 32-byte key
 */
const generateAESKey = () => {
  return crypto.randomBytes(KEY_SIZE);
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {Buffer} key - AES key
 * @returns {Object} { encryptedData, authTag, iv }
 */
const encryptAES = (plaintext, key) => {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM (recommended)
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    authTag: authTag.toString('base64'),
    iv: iv.toString('base64')
  };
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data (base64)
 * @param {Buffer} key - AES key
 * @param {string} authTag - Authentication tag (base64)
 * @param {string} iv - Initialization vector (base64, 12 bytes recommended for GCM)
 * @returns {string} Decrypted plaintext
 */
const decryptAES = (encryptedData, key, authTag, iv) => {
  const ivBuffer = Buffer.from(iv, 'base64');
  // Ensure IV is correct size (12 bytes for GCM is recommended, but 16 also works)
  const actualIV = ivBuffer.length === 12 ? ivBuffer : ivBuffer.slice(0, 12);
  
  const decipher = crypto.createDecipheriv(
    AES_ALGORITHM,
    key,
    actualIV
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Encrypt AES key using RSA-OAEP
 * @param {Buffer} aesKey - AES key to encrypt
 * @param {string} publicKeyPem - RSA public key in PEM format
 * @returns {string} Encrypted key (base64)
 */
const encryptRSA = (aesKey, publicKeyPem) => {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    aesKey
  );
  return encrypted.toString('base64');
};

/**
 * Decrypt AES key using RSA-OAEP
 * @param {string} encryptedKey - Encrypted key (base64)
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {Buffer} Decrypted AES key
 */
const decryptRSA = (encryptedKey, privateKeyPem) => {
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedKey, 'base64')
  );
  return decrypted;
};

/**
 * Sign data using RSA
 * @param {string} data - Data to sign
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {string} Signature (base64)
 */
const signData = (data, privateKeyPem) => {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
};

/**
 * Verify signature using RSA
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify (base64)
 * @param {string} publicKeyPem - RSA public key in PEM format
 * @returns {boolean} True if signature is valid
 */
const verifySignature = (data, signature, publicKeyPem) => {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKeyPem, signature, 'base64');
};

/**
 * Encrypt payload for partner API
 * @param {string} partnerId - Partner UUID
 * @param {Object} data - Data to encrypt
 * @param {string} partnerPublicKeyPem - Partner's public key
 * @param {string} ourPrivateKeyPem - Our private key (for signing)
 * @returns {Object} Encrypted payload
 */
const encryptForPartner = (partnerId, data, partnerPublicKeyPem, ourPrivateKeyPem) => {
  try {
    // Generate timestamp once to ensure consistency between signing and payload
    const timestamp = Date.now();
    
    // Generate AES key
    const aesKey = generateAESKey();
    
    // Encrypt data with AES
    const plaintext = JSON.stringify(data);
    const { encryptedData, authTag, iv } = encryptAES(plaintext, aesKey);
    
    // Encrypt AES key with RSA
    const encryptedKey = encryptRSA(aesKey, partnerPublicKeyPem);
    
    // Create payload for signing
    const payloadToSign = JSON.stringify({
      version: '1.0',
      partnerId,
      timestamp,
      encryptedKey,
      encryptedData,
      authTag,
      algorithm: ALGORITHM
    });
    
    // Sign the payload
    const signature = signData(payloadToSign, ourPrivateKeyPem);
    
    // Include IV in the payload (some implementations embed it, we'll include it separately)
    // Note: In production with SDK, IV might be handled differently
    return {
      version: '1.0',
      partnerId,
      timestamp, // Use the same timestamp that was signed
      encryptedKey,
      encryptedData,
      authTag,
      iv, // Include IV in payload
      signature,
      algorithm: ALGORITHM
    };
  } catch (error) {
    console.error('Error encrypting for partner:', error);
    throw new Error('Encryption failed: ' + error.message);
  }
};

/**
 * Decrypt payload from partner API
 * @param {Object} encryptedPayload - Encrypted payload
 * @param {string} partnerPublicKeyPem - Partner's public key (for signature verification)
 * @param {string} ourPrivateKeyPem - Our private key (for decryption)
 * @returns {Object} Decrypted data
 */
const decryptFromPartner = (encryptedPayload, partnerPublicKeyPem, ourPrivateKeyPem) => {
  try {
    const { encryptedKey, encryptedData, authTag, signature, partnerId, timestamp, iv } = encryptedPayload;
    
    // Verify signature (include IV if present)
    // Note: The signature payload must match exactly what was signed during encryption
    const payloadToVerify = JSON.stringify({
      version: encryptedPayload.version,
      partnerId,
      timestamp: encryptedPayload.timestamp, // Use timestamp from payload, not the destructured one
      encryptedKey,
      encryptedData,
      authTag,
      algorithm: encryptedPayload.algorithm
    });
    
    if (!verifySignature(payloadToVerify, signature, partnerPublicKeyPem)) {
      throw new Error('Invalid signature');
    }
    
    // Decrypt AES key
    const aesKey = decryptRSA(encryptedKey, ourPrivateKeyPem);
    
    // Decrypt data - use IV from payload or generate default (for compatibility)
    const ivToUse = iv || Buffer.alloc(12).toString('base64'); // Default to 12-byte IV
    const decrypted = decryptAES(encryptedData, aesKey, authTag, ivToUse);
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error decrypting from partner:', error);
    throw new Error('Decryption failed: ' + error.message);
  }
};

/**
 * Load key from file
 * @param {string} keyPath - Path to key file (can be absolute or relative)
 * @returns {string} Key content
 */
const loadKeyFromFile = (keyPath) => {
  try {
    let fullPath;
    
    // If path is absolute (starts with / or C:\), use it as-is
    if (path.isAbsolute(keyPath)) {
      fullPath = keyPath;
    } else {
      // If path starts with /, it's a Linux-style absolute path - convert to Windows if needed
      if (keyPath.startsWith('/')) {
        // Try to resolve relative to project root
        const projectRoot = path.resolve(__dirname, '../..');
        // Remove leading slash and resolve
        const relativePath = keyPath.substring(1);
        fullPath = path.join(projectRoot, relativePath);
      } else {
        // Relative path - resolve from project root
        const projectRoot = path.resolve(__dirname, '../..');
        fullPath = path.resolve(projectRoot, keyPath);
      }
    }
    
    // Normalize path separators for current OS
    fullPath = path.normalize(fullPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Key file not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error('Error loading key from file:', error);
    throw error;
  }
};

module.exports = {
  encryptForPartner,
  decryptFromPartner,
  loadKeyFromFile,
  ALGORITHM
};

