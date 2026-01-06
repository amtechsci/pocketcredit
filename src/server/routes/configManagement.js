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

// GET /api/admin/settings/system-settings - Get system settings
router.get('/system-settings', async (req, res) => {
  try {
    await initializeDatabase();
    
    const settings = await executeQuery(
      'SELECT `key`, value, description FROM system_settings'
    );
    
    // Convert to object format
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = {
        value: setting.value,
        description: setting.description
      };
    });
    
    res.json({
      success: true,
      data: settingsObj
    });
    
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching system settings'
    });
  }
});

// PUT /api/admin/settings/system-settings/:key - Update system setting
router.put('/system-settings/:key', async (req, res) => {
  try {
    await initializeDatabase();
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Value is required'
      });
    }
    
    // Check if setting exists
    const existing = await executeQuery(
      'SELECT `key` FROM system_settings WHERE `key` = ?',
      [key]
    );
    
    if (existing && existing.length > 0) {
      // Update existing
      await executeQuery(
        'UPDATE system_settings SET value = ?, description = ?, updated_at = NOW() WHERE `key` = ?',
        [value, description || null, key]
      );
    } else {
      // Insert new
      await executeQuery(
        'INSERT INTO system_settings (`key`, value, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [key, value, description || null]
      );
    }
    
    res.json({
      success: true,
      message: 'System setting updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating system setting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating system setting'
    });
  }
});

module.exports = router;
