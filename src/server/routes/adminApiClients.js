const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin } = require('../middleware/auth');
const { initializeDatabase } = require('../config/database');
const {
  findAllApiClients,
  findApiClientById,
  createApiClient,
  updateApiClient
} = require('../models/apiClient');

const router = express.Router();

const requireSuperadmin = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ status: 'error', message: 'Permission denied. Superadmin only.' });
  }
  next();
};

router.get('/', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    await initializeDatabase();
    const clients = await findAllApiClients();
    res.json({ status: 'success', data: { api_clients: clients } });
  } catch (error) {
    console.error('Admin list API clients error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to list API clients' });
  }
});

router.get('/:id', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id' });
    }
    await initializeDatabase();
    const client = await findApiClientById(id);
    if (!client) {
      return res.status(404).json({ status: 'error', message: 'API client not found' });
    }
    res.json({ status: 'success', data: client });
  } catch (error) {
    console.error('Admin get API client error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to get API client' });
  }
});

router.post('/', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const { client_id, client_secret, name, email, allowed_ips, public_key_path } = req.body;
    if (!client_id || !client_secret || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'client_id, client_secret, and name are required'
      });
    }

    await initializeDatabase();
    const created = await createApiClient({
      client_uuid: uuidv4(),
      client_id: String(client_id).trim(),
      client_secret: String(client_secret),
      name: String(name).trim(),
      email: email ? String(email).trim() : null,
      allowed_ips: allowed_ips != null ? String(allowed_ips).trim() : null,
      public_key_path: public_key_path ? String(public_key_path).trim() : null
    });

    res.status(201).json({
      status: 'success',
      data: created,
      message:
        'Save client_secret and webhook_signing_secret now; they cannot be retrieved later.'
    });
  } catch (error) {
    console.error('Admin create API client error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to create API client' });
  }
});

router.put('/:id', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id' });
    }

    await initializeDatabase();
    const existing = await findApiClientById(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'API client not found' });
    }

    const { name, email, allowed_ips, public_key_path, is_active, client_secret } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (allowed_ips !== undefined) updates.allowed_ips = allowed_ips;
    if (public_key_path !== undefined) updates.public_key_path = public_key_path;
    if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;
    if (client_secret) updates.client_secret = client_secret;

    const updated = await updateApiClient(id, updates);
    res.json({ status: 'success', data: updated });
  } catch (error) {
    console.error('Admin update API client error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to update API client' });
  }
});

module.exports = router;
