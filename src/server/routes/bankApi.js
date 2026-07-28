const express = require('express');
const router = express.Router();
const { initializeDatabase } = require('../config/database');
const {
  authenticateApiClientBasic,
  authenticateApiClientToken,
  generateApiClientAccessToken,
  generateApiClientRefreshToken,
  verifyApiClientRefreshToken
} = require('../middleware/apiClientAuth');
const { findApiClientByUuid } = require('../models/apiClient');
const { parseApiClientRequestBody, sendApiClientResponse } = require('../utils/apiClientEnvelope');
const {
  initiateForApiClient,
  getStatusForApiClient,
  getReportForApiClient
} = require('../services/apiClientBankStatementService');

/**
 * B2B Bank / Account Aggregator API (NOT lead partners).
 * Base: /api/v1/bank-api
 */

router.post('/login', authenticateApiClientBasic, async (req, res) => {
  try {
    const apiClient = req.apiClient;
    const responseData = {
      status: true,
      code: 2000,
      message: 'Success',
      data: {
        access_token: generateApiClientAccessToken(apiClient),
        refresh_token: generateApiClientRefreshToken(apiClient),
        token_type: 'Bearer',
        expires_in: 900,
        client_uuid: apiClient.client_uuid
      }
    };
    return res.json(responseData);
  } catch (error) {
    console.error('Bank API login error:', error);
    return res.status(500).json({ status: false, code: 5000, message: 'Token generation failed' });
  }
});

router.post('/refresh-token', authenticateApiClientBasic, async (req, res) => {
  try {
    const refreshToken =
      req.headers.refresh_token ||
      req.headers['refresh-token'] ||
      req.body?.refresh_token;

    if (!refreshToken) {
      return res.status(400).json({ status: false, code: 2003, message: 'refresh_token is required' });
    }

    const decoded = verifyApiClientRefreshToken(refreshToken);
    const apiClient = await findApiClientByUuid(decoded.client_uuid);
    if (!apiClient) {
      return res.status(401).json({ status: false, code: 4215, message: 'Invalid refresh token' });
    }

    return res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: {
        access_token: generateApiClientAccessToken(apiClient),
        token_type: 'Bearer',
        expires_in: 900
      }
    });
  } catch (error) {
    return res.status(401).json({ status: false, code: 4215, message: 'Invalid refresh token' });
  }
});

router.post('/initiate', authenticateApiClientToken, async (req, res) => {
  try {
    await initializeDatabase();
    const apiClient = req.apiClient;
    let wasEncrypted = false;
    let body = req.body;

    try {
      const parsed = parseApiClientRequestBody(apiClient, req.body);
      body = parsed.data;
      wasEncrypted = parsed.wasEncrypted;
    } catch (parseErr) {
      return res.status(400).json({
        status: false,
        code: parseErr.code || 2003,
        message: parseErr.message || 'Invalid request'
      });
    }

    const result = await initiateForApiClient(apiClient, body);
    const responseData = {
      status: result.ok,
      code: result.code,
      message: result.message,
      ...(result.data ? { data: result.data } : {})
    };

    if (!result.ok) {
      return res.status(result.status || 400).json(responseData);
    }
    return sendApiClientResponse(res, apiClient, responseData, wasEncrypted);
  } catch (error) {
    console.error('Bank API initiate error:', error);
    return res.status(500).json({ status: false, code: 5000, message: 'Internal Server Error' });
  }
});

router.get('/status', authenticateApiClientToken, async (req, res) => {
  try {
    await initializeDatabase();
    const { request_id: requestId, external_ref: externalRef } = req.query;
    const result = await getStatusForApiClient(req.apiClient, {
      requestId: requestId ? Number(requestId) : undefined,
      externalRef: externalRef ? String(externalRef) : undefined
    });
    const responseData = {
      status: result.ok,
      code: result.code,
      message: result.message,
      ...(result.data ? { data: result.data } : {})
    };
    return res.status(result.status || (result.ok ? 200 : 500)).json(responseData);
  } catch (error) {
    console.error('Bank API status error:', error);
    return res.status(500).json({ status: false, code: 5000, message: 'Internal Server Error' });
  }
});

router.get('/report', authenticateApiClientToken, async (req, res) => {
  try {
    await initializeDatabase();
    const { request_id: requestId, external_ref: externalRef, include_xml: includeXml } = req.query;
    const result = await getReportForApiClient(req.apiClient, {
      requestId: requestId ? Number(requestId) : undefined,
      externalRef: externalRef ? String(externalRef) : undefined,
      includeXml: includeXml === 'true' || includeXml === '1'
    });
    const responseData = {
      status: result.ok,
      code: result.code,
      message: result.message,
      ...(result.data ? { data: result.data } : {})
    };
    return res.status(result.status || (result.ok ? 200 : 500)).json(responseData);
  } catch (error) {
    console.error('Bank API report error:', error);
    return res.status(500).json({ status: false, code: 5000, message: 'Internal Server Error' });
  }
});

module.exports = router;
