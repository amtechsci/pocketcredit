const express = require('express');
const router = express.Router();
const { generateBankStatementURL } = require('../services/digitapBankStatementService');

/**
 * POST /api/test-digitap/generate-url
 * Test Digitap generateurl API directly
 */
router.post('/generate-url', async (req, res) => {
  try {
    console.log('🧪 Testing Digitap Generate URL API...');
    
    const testData = {
      client_ref_num: 'TEST-' + Date.now(),
      return_url: 'https://pocketcredit.in/success',
      txn_completed_cburl: 'https://pocketcredit.in/webhook',
      mobile_num: req.body.mobile_num || '8800899875',
      start_date: req.body.start_date || '2024-10-01',
      end_date: req.body.end_date || '2025-04-06',
      destination: req.body.destination || 'accountaggregator',
      aa_vendor: req.body.aa_vendor || 'onemoney',
      multi_aa: req.body.multi_aa || '0'
    };

    console.log('Test request:', JSON.stringify(testData, null, 2));

    const result = await generateBankStatementURL(testData);

    console.log('Test result:', JSON.stringify(result, null, 2));

    res.json({
      success: result.success,
      testData: testData,
      digitapResponse: result,
      message: result.success ? 'Digitap API is working!' : 'Digitap API failed',
      instructions: result.success 
        ? 'You can use this URL to test: ' + result.data.url
        : 'Check the error message and contact Digitap support'
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test failed with exception'
    });
  }
});

module.exports = router;

