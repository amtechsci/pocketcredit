const path = require('path');
const { encryptForPartner, decryptFromPartner, loadKeyFromFile } = require('./partnerEncryption');

function isEncryptedPartnerBody(body, partner) {
  return (
    body &&
    (body.partnerId === partner.partner_uuid || body.partnerId === partner.client_id) &&
    body.encryptedData &&
    body.encryptedKey
  );
}

function shouldEncryptPartnerResponse(partner, requestWasEncrypted) {
  return (
    requestWasEncrypted &&
    process.env.PARTNER_API_ENCRYPTION_ENABLED === 'true' &&
    !!partner.public_key_path
  );
}

function loadPartnerEncryptionKeys(partner) {
  const partnerPublicKey = loadKeyFromFile(partner.public_key_path);
  const ourPrivateKeyPath =
    process.env.PARTNER_PRIVATE_KEY_PATH ||
    path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
  const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);
  return { partnerPublicKey, ourPrivateKey };
}

/**
 * Decrypt partner request body when encrypted envelope is used.
 * @returns {{ data: object, wasEncrypted: boolean }}
 */
function parsePartnerRequestBody(partner, body) {
  if (!isEncryptedPartnerBody(body, partner)) {
    return { data: body || {}, wasEncrypted: false };
  }

  if (!partner.public_key_path) {
    const err = new Error('Encryption not configured for this partner');
    err.code = 4122;
    throw err;
  }

  const { partnerPublicKey, ourPrivateKey } = loadPartnerEncryptionKeys(partner);
  const data = decryptFromPartner(body, partnerPublicKey, ourPrivateKey);
  return { data, wasEncrypted: true };
}

/**
 * Send JSON or encrypted partner API response.
 */
function sendPartnerApiResponse(res, partner, responseData, requestWasEncrypted) {
  if (shouldEncryptPartnerResponse(partner, requestWasEncrypted)) {
    try {
      const { partnerPublicKey, ourPrivateKey } = loadPartnerEncryptionKeys(partner);
      const encryptedResponse = encryptForPartner(
        partner.partner_uuid,
        responseData,
        partnerPublicKey,
        ourPrivateKey
      );
      return res.json(encryptedResponse);
    } catch (encryptError) {
      console.error('Partner API encryption error:', encryptError);
    }
  }
  return res.json(responseData);
}

module.exports = {
  isEncryptedPartnerBody,
  parsePartnerRequestBody,
  sendPartnerApiResponse
};
