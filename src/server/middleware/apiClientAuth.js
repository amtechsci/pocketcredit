const jwt = require('jsonwebtoken');
const { findApiClientByUuid, verifyApiClientCredentials, findApiClientByClientId } = require('../models/apiClient');
const { getIpAddress } = require('../utils/loginDataParser');
const { getBankApiJwtSecret } = require('../utils/bankApiConfig');

const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';

function checkApiClientIpAllowed(req, apiClient) {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && origin.includes('pocketcredit')) return true;
  if (!apiClient.allowed_ips || !String(apiClient.allowed_ips).trim()) return true;

  const clientIp = getIpAddress(req);
  const allowedIps = String(apiClient.allowed_ips)
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  return allowedIps.some((allowedIp) => {
    if (allowedIp === clientIp) return true;
    if (allowedIp.includes('/')) {
      const [network, prefixLength] = allowedIp.split('/');
      const prefix = parseInt(prefixLength, 10);
      if (Number.isNaN(prefix)) return false;
      const ipToNumber = (ip) =>
        ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      return (ipToNumber(network) & mask) === (ipToNumber(clientIp) & mask);
    }
    return false;
  });
}

const authenticateApiClientBasic = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ status: false, code: 4210, message: 'Authentication failed' });
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
    const [clientId, clientSecret] = credentials.split(':');
    if (!clientId || !clientSecret) {
      return res.status(401).json({ status: false, code: 4211, message: 'Invalid API credentials' });
    }

    if (!(await findApiClientByClientId(clientId))) {
      return res.status(401).json({
        status: false,
        code: 4211,
        message: `Invalid API credentials: Client ID '${clientId}' not found or inactive`
      });
    }

    const apiClient = await verifyApiClientCredentials(clientId, clientSecret);
    if (!apiClient) {
      return res.status(401).json({ status: false, code: 4211, message: 'Invalid API credentials' });
    }

    if (!checkApiClientIpAllowed(req, apiClient)) {
      return res.status(403).json({ status: false, code: 4212, message: 'IP address not allowed' });
    }

    req.apiClient = apiClient;
    next();
  } catch (error) {
    console.error('Bank API client auth error:', error);
    return res.status(500).json({ status: false, code: 4210, message: 'Authentication failed' });
  }
};

const authenticateApiClientToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: false, code: 4214, message: 'Token is required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, getBankApiJwtSecret(), { clockTolerance: 60 });
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 4217 : 4215;
      return res.status(401).json({
        status: false,
        code,
        message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
      });
    }

    if (decoded.type !== 'bank_api_access_token') {
      return res.status(401).json({ status: false, code: 4215, message: 'Invalid token type' });
    }

    const apiClient = await findApiClientByUuid(decoded.client_uuid || decoded.aud);
    if (!apiClient) {
      return res.status(401).json({ status: false, code: 4215, message: 'Invalid token' });
    }

    req.apiClient = apiClient;
    next();
  } catch (error) {
    console.error('Bank API token error:', error);
    return res.status(500).json({ status: false, code: 4210, message: 'Authentication failed' });
  }
};

const generateApiClientAccessToken = (apiClient) => {
  const payload = {
    client_uuid: apiClient.client_uuid,
    client_id: apiClient.client_id,
    type: 'bank_api_access_token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    aud: apiClient.client_uuid,
    iss: 'pocketcredit-bank-api'
  };
  return jwt.sign(payload, getBankApiJwtSecret());
};

const generateApiClientRefreshToken = (apiClient) => {
  const payload = {
    client_uuid: apiClient.client_uuid,
    client_id: apiClient.client_id,
    type: 'bank_api_refresh_token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    aud: apiClient.client_uuid,
    iss: 'pocketcredit-bank-api'
  };
  return jwt.sign(payload, getBankApiJwtSecret());
};

const verifyApiClientRefreshToken = (token) => {
  const decoded = jwt.verify(token, getBankApiJwtSecret(), { clockTolerance: 60 });
  if (decoded.type !== 'bank_api_refresh_token') {
    throw new Error('Invalid token type');
  }
  return decoded;
};

module.exports = {
  authenticateApiClientBasic,
  authenticateApiClientToken,
  generateApiClientAccessToken,
  generateApiClientRefreshToken,
  verifyApiClientRefreshToken
};
