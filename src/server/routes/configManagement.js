const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// =====================================================
// CONFIGURATION MANAGEMENT API
// =====================================================

// GET /api/admin/settings/sms-configs - Get all SMS configurations
router.get('/sms-configs', async (req, res) => {
  try {
    await initializeDatabase();
    
    const configs = await executeQuery(
      'SELECT id, config_name, provider, api_url, api_key, username, password, status, is_primary, created_at, updated_at FROM sms_configs ORDER BY is_primary DESC, id'
    );
    
    res.json({
      success: true,
      data: configs
    });
    
  } catch (error) {
    console.error('Error fetching SMS configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching SMS configurations'
    });
  }
});

// PUT /api/admin/settings/sms-configs/:id - Update SMS configuration
router.put('/sms-configs/:id', async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { config_name, provider, api_url, api_key, username, password, status, is_primary } = req.body;
    
    // Validate required fields
    if (!config_name || !provider || !api_url || !api_key || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // If setting as primary, deactivate other primary configs
    if (is_primary) {
      await executeQuery(
        'UPDATE sms_configs SET is_primary = FALSE WHERE id != ?',
        [id]
      );
    }
    
    const result = await executeQuery(
      'UPDATE sms_configs SET config_name = ?, provider = ?, api_url = ?, api_key = ?, username = ?, password = ?, status = ?, is_primary = ?, updated_at = NOW() WHERE id = ?',
      [config_name, provider, api_url, api_key, username, password, status, is_primary, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'SMS configuration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'SMS configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating SMS configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating SMS configuration'
    });
  }
});

// GET /api/admin/settings/email-configs - Get all Email configurations
router.get('/email-configs', async (req, res) => {
  try {
    await initializeDatabase();
    
    const configs = await executeQuery(
      'SELECT id, config_name, provider, host, port, encryption, username, password, from_email, from_name, status, is_primary, created_at, updated_at FROM email_configs ORDER BY is_primary DESC, id'
    );
    
    res.json({
      success: true,
      data: configs
    });
    
  } catch (error) {
    console.error('Error fetching Email configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching Email configurations'
    });
  }
});

// PUT /api/admin/settings/email-configs/:id - Update Email configuration
router.put('/email-configs/:id', async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { config_name, provider, host, port, encryption, username, password, from_email, from_name, status, is_primary } = req.body;
    
    // Validate required fields
    if (!config_name || !provider || !host || !port || !username || !password || !from_email || !from_name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // If setting as primary, deactivate other primary configs
    if (is_primary) {
      await executeQuery(
        'UPDATE email_configs SET is_primary = FALSE WHERE id != ?',
        [id]
      );
    }
    
    const result = await executeQuery(
      'UPDATE email_configs SET config_name = ?, provider = ?, host = ?, port = ?, encryption = ?, username = ?, password = ?, from_email = ?, from_name = ?, status = ?, is_primary = ?, updated_at = NOW() WHERE id = ?',
      [config_name, provider, host, port, encryption, username, password, from_email, from_name, status, is_primary, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Email configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating Email configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating Email configuration'
    });
  }
});

// GET /api/admin/settings/cloud-configs - Get all Cloud configurations
router.get('/cloud-configs', async (req, res) => {
  try {
    await initializeDatabase();
    
    const configs = await executeQuery(
      'SELECT id, config_name, provider, bucket_name, access_key, secret_key, region, base_url, status, is_primary, created_at, updated_at FROM cloud_configs ORDER BY is_primary DESC, id'
    );
    
    res.json({
      success: true,
      data: configs
    });
    
  } catch (error) {
    console.error('Error fetching Cloud configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching Cloud configurations'
    });
  }
});

// PUT /api/admin/settings/cloud-configs/:id - Update Cloud configuration
router.put('/cloud-configs/:id', async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { config_name, provider, bucket_name, access_key, secret_key, region, base_url, status, is_primary } = req.body;
    
    // Validate required fields
    if (!config_name || !provider || !bucket_name || !access_key || !secret_key || !region || !base_url) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // If setting as primary, deactivate other primary configs
    if (is_primary) {
      await executeQuery(
        'UPDATE cloud_configs SET is_primary = FALSE WHERE id != ?',
        [id]
      );
    }
    
    const result = await executeQuery(
      'UPDATE cloud_configs SET config_name = ?, provider = ?, bucket_name = ?, access_key = ?, secret_key = ?, region = ?, base_url = ?, status = ?, is_primary = ?, updated_at = NOW() WHERE id = ?',
      [config_name, provider, bucket_name, access_key, secret_key, region, base_url, status, is_primary, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cloud configuration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Cloud configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating Cloud configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating Cloud configuration'
    });
  }
});

// POST /api/admin/settings/test-sms - Test SMS configuration
router.post('/test-sms', async (req, res) => {
  try {
    const { config_id, test_number, test_message } = req.body;
    
    // Get SMS configuration
    await initializeDatabase();
    const configs = await executeQuery(
      'SELECT * FROM sms_configs WHERE id = ? AND status = "active"',
      [config_id]
    );
    
    if (!configs || configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active SMS configuration not found'
      });
    }
    
    const config = configs[0];
    
    // Mock SMS sending (replace with actual SMS service integration)
    console.log(`📱 Testing SMS to ${test_number}: ${test_message}`);
    console.log(`Using config: ${config.config_name} (${config.api_url})`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.json({
      success: true,
      message: 'SMS test sent successfully',
      data: {
        config_name: config.config_name,
        test_number,
        test_message,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error testing SMS configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while testing SMS configuration'
    });
  }
});

// POST /api/admin/settings/test-email - Test Email configuration
router.post('/test-email', async (req, res) => {
  try {
    const { config_id, test_email, test_subject, test_message } = req.body;
    
    // Get Email configuration
    await initializeDatabase();
    const configs = await executeQuery(
      'SELECT * FROM email_configs WHERE id = ? AND status = "active"',
      [config_id]
    );
    
    if (!configs || configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active Email configuration not found'
      });
    }
    
    const config = configs[0];
    
    // Mock Email sending (replace with actual email service integration)
    console.log(`📧 Testing Email to ${test_email}: ${test_subject}`);
    console.log(`Using config: ${config.config_name} (${config.host}:${config.port})`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.json({
      success: true,
      message: 'Email test sent successfully',
      data: {
        config_name: config.config_name,
        test_email,
        test_subject,
        test_message,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error testing Email configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while testing Email configuration'
    });
  }
});

module.exports = router;
