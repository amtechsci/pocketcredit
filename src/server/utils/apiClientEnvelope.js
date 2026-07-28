const path = require('path');
const { encryptForPartner, decryptFromPartner, loadKeyFromFile } = require('./partnerEncryption');

function isEncryptedApiClientBody(body, apiClient) {
  return (
    body &&
    (body.clientId === apiClient.client_uuid || body.clientId === apiClient.client_id) &&
    body.encryptedData &&
    body.encryptedKey
  );
}

function shouldEncryptApiClientResponse(apiClient, requestWasEncrypted) {
  return (
    requestWasEncrypted &&
    process.env.BANK_API_ENCRYPTION_ENABLED === 'true' &&
    !!apiClient.public_key_path
  );
}

function loadApiClientEncryptionKeys(apiClient) {
  const publicKey = loadKeyFromFile(apiClient.public_key_path);
  const ourPrivateKeyPath =
    process.env.BANK_API_PRIVATE_KEY_PATH ||
    process.env.PARTNER_PRIVATE_KEY_PATH ||
    path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
  const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);
  return { publicKey, ourPrivateKey };
}

function parseApiClientRequestBody(apiClient, body) {
  if (!isEncryptedApiClientBody(body, apiClient)) {
    return { data: body || {}, wasEncrypted: false };
  }
  if (!apiClient.public_key_path) {
    const err = new Error('Encryption not configured for this API client');
    err.code = 4222;
    throw err;
  }
  const { publicKey, ourPrivateKey } = loadApiClientEncryptionKeys(apiClient);
  const wrapped = { ...body, partnerId: body.clientId };
  const data = decryptFromPartner(wrapped, publicKey, ourPrivateKey);
  return { data, wasEncrypted: true };
}

function sendApiClientResponse(res, apiClient, responseData, requestWasEncrypted) {
  if (shouldEncryptApiClientResponse(apiClient, requestWasEncrypted)) {
    try {
      const { publicKey, ourPrivateKey } = loadApiClientEncryptionKeys(apiClient);
      const encryptedResponse = encryptForPartner(
        apiClient.client_uuid,
        responseData,
        publicKey,
        ourPrivateKey
      );
      return res.json(encryptedResponse);
    } catch (encryptError) {
      console.error('Bank API encryption error:', encryptError);
    }
  }
  return res.json(responseData);
}

module.exports = {
  parseApiClientRequestBody,
  sendApiClientResponse
};
