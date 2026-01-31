const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const userConfigRoutes = require('./userConfig');
const configManagementRoutes = require('./configManagement');
const eligibilityConfigRoutes = require('./eligibilityConfig');

const router = express.Router();

// List integrations by type
router.get('/integrations/:type', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    if (!['sms','email','cloud'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Invalid integration type' });
    }
    const rows = await executeQuery('SELECT * FROM integration_configs WHERE type = ? ORDER BY id ASC', [type]);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch integrations' });
  }
});

// Create integration
router.post('/integrations/:type', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { provider, status = 'inactive', config } = req.body;
    if (!['sms','email','cloud'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Invalid integration type' });
    }
    if (!provider) {
      return res.status(400).json({ status: 'error', message: 'Provider is required' });
    }
    await executeQuery(
      'INSERT INTO integration_configs (type, provider, status, config) VALUES (?, ?, ?, ?)',
      [type, provider.toLowerCase(), status, config ? JSON.stringify(config) : null]
    );
    res.status(201).json({ status: 'success', message: 'Integration created' });
  } catch (error) {
    console.error('Create integration error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create integration' });
  }
});

// Update integration
router.put('/integrations/:type/:id', authenticateAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { provider, status, config } = req.body;
    if (!['sms','email','cloud'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Invalid integration type' });
    }
    await executeQuery(
      `UPDATE integration_configs SET 
         provider = COALESCE(?, provider),
         status = COALESCE(?, status),
         config = COALESCE(?, config),
         updated_at = NOW()
       WHERE id = ? AND type = ?`,
      [provider ? provider.toLowerCase() : null, status || null, config ? JSON.stringify(config) : null, id, type]
    );
    res.json({ status: 'success', message: 'Integration updated' });
  } catch (error) {
    console.error('Update integration error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update integration' });
  }
});

router.get('/member-tiers', authenticateAdmin, async (req, res) => {
  try {
    const tiers = await executeQuery('SELECT * FROM member_tiers ORDER BY id ASC');
    res.json({ status: 'success', data: tiers });
  } catch (error) {
    console.error('Get member tiers error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch member tiers' });
  }
});

router.post('/member-tiers', authenticateAdmin, async (req, res) => {
  try {
    const { tier_name, processing_fee_percent, interest_percent_per_day } = req.body;
    if (!tier_name || processing_fee_percent == null || interest_percent_per_day == null) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }
    await executeQuery(
      'INSERT INTO member_tiers (tier_name, processing_fee_percent, interest_percent_per_day) VALUES (?, ?, ?)',
      [tier_name.toLowerCase(), parseFloat(processing_fee_percent), parseFloat(interest_percent_per_day)]
    );
    res.status(201).json({ status: 'success', message: 'Member tier created' });
  } catch (error) {
    console.error('Create member tier error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create member tier' });
  }
});

router.put('/member-tiers/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tier_name, processing_fee_percent, interest_percent_per_day } = req.body;
    await executeQuery(
      `UPDATE member_tiers SET 
        tier_name = COALESCE(?, tier_name),
        processing_fee_percent = COALESCE(?, processing_fee_percent),
        interest_percent_per_day = COALESCE(?, interest_percent_per_day),
        updated_at = NOW()
       WHERE id = ?`,
      [tier_name ? tier_name.toLowerCase() : null, 
       processing_fee_percent != null ? parseFloat(processing_fee_percent) : null, 
       interest_percent_per_day != null ? parseFloat(interest_percent_per_day) : null, 
       id]
    );
    res.json({ status: 'success', message: 'Member tier updated' });
  } catch (error) {
    console.error('Update member tier error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update member tier' });
  }
});

router.delete('/member-tiers/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM member_tiers WHERE id = ?', [id]);
    res.json({ status: 'success', message: 'Member tier deleted successfully' });
  } catch (error) {
    console.error('Delete member tier error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete member tier' });
  }
});

// Mount user config routes
router.use('/', userConfigRoutes);

// Mount configuration management routes
router.use('/', configManagementRoutes);

// Mount eligibility configuration routes
router.use('/', eligibilityConfigRoutes);

module.exports = router;


