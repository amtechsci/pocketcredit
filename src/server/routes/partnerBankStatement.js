const express = require('express');
const router = express.Router();
const { authenticatePartnerToken } = require('../middleware/partnerAuth');
const { initializeDatabase } = require('../config/database');
const { parsePartnerRequestBody, sendPartnerApiResponse } = require('../utils/partnerApiEnvelope');
const {
  initiateForPartner,
  getStatusForPartner,
  getReportForPartner
} = require('../services/partnerBankStatementService');

router.use(authenticatePartnerToken);

router.post('/initiate', async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;
    let wasEncrypted = false;
    let body = req.body;

    try {
      const parsed = parsePartnerRequestBody(partner, req.body);
      body = parsed.data;
      wasEncrypted = parsed.wasEncrypted;
    } catch (parseErr) {
      const code = parseErr.code || 2003;
      return res.status(400).json({
        status: false,
        code,
        message: parseErr.message || 'Invalid request'
      });
    }

    const result = await initiateForPartner(partner, body);
    const responseData = {
      status: result.ok,
      code: result.code,
      message: result.message,
      ...(result.data ? { data: result.data } : {})
    };

    if (!result.ok) {
      return res.status(result.status || 400).json(responseData);
    }
    return sendPartnerApiResponse(res, partner, responseData, wasEncrypted);
  } catch (error) {
    console.error('Partner bank-statement initiate error:', error);
    return res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;
    const { request_id: requestId, partner_ref: partnerRef } = req.query;

    const result = await getStatusForPartner(partner, {
      requestId: requestId ? Number(requestId) : undefined,
      partnerRef: partnerRef ? String(partnerRef) : undefined
    });

    const responseData = {
      status: result.ok,
      code: result.code,
      message: result.message,
      ...(result.data ? { data: result.data } : {})
    };

    return res.status(result.status || (result.ok ? 200 : 500)).json(responseData);
  } catch (error) {
    console.error('Partner bank-statement status error:', error);
    return res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

router.get('/report', async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;
    const { request_id: requestId, partner_ref: partnerRef, include_xml: includeXml } = req.query;

    const result = await getReportForPartner(partner, {
      requestId: requestId ? Number(requestId) : undefined,
      partnerRef: partnerRef ? String(partnerRef) : undefined,
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
    console.error('Partner bank-statement report error:', error);
    return res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

module.exports = router;
