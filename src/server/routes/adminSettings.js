const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const userConfigRoutes = require('./userConfig');
const configManagementRoutes = require('./configManagement');

const router = express.Router();

const ensureMemberTiersTable = async () => {
  await initializeDatabase();
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS member_tiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tier_name VARCHAR(50) NOT NULL UNIQUE,
      processing_fee_percent DECIMAL(5,2) NOT NULL,
      interest_percent_per_day DECIMAL(7,5) NOT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const seedDefaultTiers = async () => {
  // Insert defaults if missing
  const tiers = [
    { name: 'bronze', fee: 10.0, rate: 0.01000 },
    { name: 'silver', fee: 8.0, rate: 0.01000 },
    { name: 'gold', fee: 5.0, rate: 0.01000 },
  ];

  for (const t of tiers) {
    await executeQuery(
      `INSERT INTO member_tiers (tier_name, processing_fee_percent, interest_percent_per_day)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE processing_fee_percent = VALUES(processing_fee_percent), interest_percent_per_day = VALUES(interest_percent_per_day)`,
      [t.name, t.fee, t.rate]
    );
  }
};

// Integration configs (sms, email, cloud)
const ensureIntegrationConfigsTable = async () => {
  await initializeDatabase();
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS integration_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('sms','email','cloud') NOT NULL,
      provider VARCHAR(100) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'inactive',
      config JSON NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_type_provider (type, provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

// List integrations by type
router.get('/integrations/:type', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    if (!['sms','email','cloud'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Invalid integration type' });
    }
    await ensureIntegrationConfigsTable();
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
    await ensureIntegrationConfigsTable();
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
    await ensureIntegrationConfigsTable();
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
    await ensureMemberTiersTable();
    const tiers = await executeQuery('SELECT * FROM member_tiers ORDER BY id ASC');
    res.json({ status: 'success', data: tiers });
  } catch (error) {
    console.error('Get member tiers error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch member tiers' });
  }
});

router.post('/member-tiers/seed', authenticateAdmin, async (req, res) => {
  try {
    await ensureMemberTiersTable();
    await seedDefaultTiers();
    const tiers = await executeQuery('SELECT * FROM member_tiers ORDER BY id ASC');
    res.json({ status: 'success', message: 'Seeded default member tiers', data: tiers });
  } catch (error) {
    console.error('Seed member tiers error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to seed member tiers' });
  }
});

router.post('/member-tiers', authenticateAdmin, async (req, res) => {
  try {
    const { tier_name, processing_fee_percent, interest_percent_per_day } = req.body;
    if (!tier_name || processing_fee_percent == null || interest_percent_per_day == null) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }
    await ensureMemberTiersTable();
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
    await ensureMemberTiersTable();
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

// Mount user config routes
router.use('/', userConfigRoutes);

// Mount configuration management routes
router.use('/', configManagementRoutes);

module.exports = router;


