const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const {
  findAllPartners,
  findPartnerById,
  createPartner,
  updatePartner
} = require('../models/partner');

const router = express.Router();

const PARTNERS_KEYS_DIR = path.join(__dirname, '..', 'partner_keys', 'partners');

/**
 * Validate that a string looks like a PEM key (public key).
 * @param {string} pem - Raw PEM content
 * @returns {boolean}
 */
function isValidPemContent(pem) {
  if (!pem || typeof pem !== 'string') return false;
  const trimmed = pem.trim();
  return (
    (trimmed.includes('-----BEGIN PUBLIC KEY-----') && trimmed.includes('-----END PUBLIC KEY-----')) ||
    (trimmed.includes('-----BEGIN RSA PUBLIC KEY-----') && trimmed.includes('-----END RSA PUBLIC KEY-----'))
  );
}

/**
 * Sanitize client_id for use in filename (alphanumeric and underscore only).
 * @param {string} clientId
 * @returns {string}
 */
function sanitizeClientIdForFilename(clientId) {
  return String(clientId).replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Write PEM content to partner_keys/partners/{clientId}_public.pem and return relative path.
 * @param {string} clientId - Partner client_id (used for filename)
 * @param {string} pemContent - Full PEM string
 * @returns {string} Relative path e.g. partner_keys/partners/PC_ABC_public.pem
 */
function writePartnerPublicKey(clientId, pemContent) {
  if (!isValidPemContent(pemContent)) {
    throw new Error('Invalid PEM content. Must include -----BEGIN PUBLIC KEY----- and -----END PUBLIC KEY----- (or RSA PUBLIC KEY).');
  }
  if (!fs.existsSync(PARTNERS_KEYS_DIR)) {
    fs.mkdirSync(PARTNERS_KEYS_DIR, { recursive: true });
  }
  const safeName = sanitizeClientIdForFilename(clientId) || 'partner';
  const filename = `${safeName}_public.pem`;
  const filePath = path.join(PARTNERS_KEYS_DIR, filename);
  fs.writeFileSync(filePath, pemContent.trim(), 'utf8');
  return path.join('partner_keys', 'partners', filename).replace(/\\/g, '/');
}

const requireSuperadmin = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ status: 'error', message: 'Permission denied. Superadmin only.' });
  }
  next();
};

/**
 * GET /api/admin/partners
 * List all partners (admin, includes inactive)
 */
router.get('/', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const partners = await findAllPartners();
    res.json({ status: 'success', data: { partners } });
  } catch (error) {
    console.error('Admin list partners error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to list partners' });
  }
});

/**
 * GET /api/admin/partners/:id
 * Get one partner by id
 */
router.get('/:id', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid partner id' });
    }
    const partner = await findPartnerById(id);
    if (!partner) {
      return res.status(404).json({ status: 'error', message: 'Partner not found' });
    }
    res.json({ status: 'success', data: partner });
  } catch (error) {
    console.error('Admin get partner error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to get partner' });
  }
});

/**
 * POST /api/admin/partners
 * Create a new partner
 * Body may include public_key_pem (paste PEM content) or public_key_path (file path). If public_key_pem is provided, it is written to a file and path is set.
 */
router.post('/', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const { client_id, client_secret, name, email, public_key_path, public_key_pem, allowed_ips } = req.body;
    if (!client_id || !client_secret || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'client_id, client_secret, and name are required'
      });
    }
    const clientIdTrimmed = String(client_id).trim();
    let resolvedPublicKeyPath = public_key_path ? String(public_key_path).trim() : null;
    if (public_key_pem && String(public_key_pem).trim()) {
      try {
        resolvedPublicKeyPath = writePartnerPublicKey(clientIdTrimmed, public_key_pem);
      } catch (pemErr) {
        return res.status(400).json({
          status: 'error',
          message: pemErr.message || 'Invalid public key PEM'
        });
      }
    }
    const partner_uuid = uuidv4();
    const partner = await createPartner({
      partner_uuid,
      client_id: clientIdTrimmed,
      client_secret,
      name: String(name).trim(),
      email: email ? String(email).trim() : null,
      public_key_path: resolvedPublicKeyPath,
      allowed_ips: allowed_ips != null ? String(allowed_ips).trim() : null
    });
    res.status(201).json({ status: 'success', data: partner });
  } catch (error) {
    console.error('Admin create partner error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to create partner' });
  }
});

/**
 * PUT /api/admin/partners/:id
 * Update a partner
 * Body may include public_key_pem (paste PEM content) or public_key_path. If public_key_pem is provided, it is written to a file and path is set.
 */
router.put('/:id', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid partner id' });
    }
    const partner = await findPartnerById(id);
    if (!partner) {
      return res.status(404).json({ status: 'error', message: 'Partner not found' });
    }
    const { name, email, public_key_path, public_key_pem, allowed_ips, is_active, client_secret } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (email !== undefined) updates.email = email ? String(email).trim() : null;
    if (allowed_ips !== undefined) updates.allowed_ips = allowed_ips != null ? String(allowed_ips).trim() : null;
    if (typeof is_active === 'boolean') updates.is_active = is_active ? 1 : 0;
    if (client_secret && String(client_secret).trim()) updates.client_secret = String(client_secret).trim();

    if (public_key_pem && String(public_key_pem).trim()) {
      try {
        updates.public_key_path = writePartnerPublicKey(partner.client_id, public_key_pem);
      } catch (pemErr) {
        return res.status(400).json({
          status: 'error',
          message: pemErr.message || 'Invalid public key PEM'
        });
      }
    } else if (public_key_path !== undefined) {
      updates.public_key_path = public_key_path ? String(public_key_path).trim() : null;
    }

    const updated = await updatePartner(id, updates);
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Partner not found' });
    }
    res.json({ status: 'success', data: updated });
  } catch (error) {
    console.error('Admin update partner error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to update partner' });
  }
});

/**
 * GET /api/admin/partners/:id/leads
 * Get leads for a partner (admin view)
 */
router.get('/:id/leads', authenticateAdmin, requireSuperadmin, async (req, res) => {
  try {
    await initializeDatabase();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid partner id' });
    }
    const partner = await findPartnerById(id);
    if (!partner) {
      return res.status(404).json({ status: 'error', message: 'Partner not found' });
    }

    const { page = 1, limit = 50, status, start_date, end_date } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitVal = Math.min(parseInt(limit) || 50, 100);
    const offsetVal = parseInt(offset) || 0;

    let query = `
      SELECT 
        pl.id,
        pl.first_name,
        pl.last_name,
        pl.mobile_number,
        pl.pan_number,
        pl.dedupe_status,
        pl.dedupe_code,
        pl.lead_shared_at,
        pl.user_registered_at,
        pl.loan_application_id,
        pl.loan_status,
        pl.disbursed_at,
        pl.disbursal_amount,
        pl.payout_eligible,
        pl.payout_amount,
        pl.payout_grade,
        pl.payout_status,
        u.id as user_id,
        u.email,
        la.application_number
      FROM partner_leads pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN loan_applications la ON pl.loan_application_id = la.id
      WHERE pl.partner_id = ?
    `;
    const params = [id];

    if (status) {
      query += ` AND pl.dedupe_status = ?`;
      params.push(status);
    }
    if (start_date) {
      query += ` AND DATE(pl.lead_shared_at) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(pl.lead_shared_at) <= ?`;
      params.push(end_date);
    }

    const countQuery = `
      SELECT COUNT(*) as total FROM partner_leads pl WHERE pl.partner_id = ?
      ${status ? ' AND pl.dedupe_status = ?' : ''}
      ${start_date ? ' AND DATE(pl.lead_shared_at) >= ?' : ''}
      ${end_date ? ' AND DATE(pl.lead_shared_at) <= ?' : ''}
    `;
    const countParams = [id];
    if (status) countParams.push(status);
    if (start_date) countParams.push(start_date);
    if (end_date) countParams.push(end_date);

    query += ` ORDER BY pl.lead_shared_at DESC LIMIT ${limitVal} OFFSET ${offsetVal}`;

    const [leads, countResult] = await Promise.all([
      executeQuery(query, params),
      executeQuery(countQuery, countParams)
    ]);
    const total = countResult[0]?.total || 0;

    res.json({
      status: 'success',
      data: {
        partner: { id: partner.id, name: partner.name, client_id: partner.client_id },
        leads: leads || [],
        pagination: {
          page: parseInt(page) || 1,
          limit: limitVal,
          total,
          total_pages: Math.ceil(total / limitVal)
        }
      }
    });
  } catch (error) {
    console.error('Admin get partner leads error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to get partner leads' });
  }
});

module.exports = router;
