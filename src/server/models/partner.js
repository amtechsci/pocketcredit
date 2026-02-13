const bcrypt = require('bcrypt');
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Find partner by client_id
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} Partner object or null
 */
const findPartnerByClientId = async (clientId) => {
  try {
    await initializeDatabase();
    const partners = await executeQuery(
      'SELECT * FROM partners WHERE client_id = ? AND is_active = 1',
      [clientId]
    );
    return partners && partners.length > 0 ? partners[0] : null;
  } catch (error) {
    console.error('Error finding partner by client_id:', error);
    throw error;
  }
};

/**
 * Find partner by partner_uuid
 * @param {string} partnerUuid - Partner UUID
 * @returns {Promise<Object|null>} Partner object or null
 */
const findPartnerByUuid = async (partnerUuid) => {
  try {
    await initializeDatabase();
    const partners = await executeQuery(
      'SELECT * FROM partners WHERE partner_uuid = ? AND is_active = 1',
      [partnerUuid]
    );
    return partners && partners.length > 0 ? partners[0] : null;
  } catch (error) {
    console.error('Error finding partner by uuid:', error);
    throw error;
  }
};

/**
 * Verify partner credentials
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client secret (plain text)
 * @returns {Promise<Object|null>} Partner object if valid, null otherwise
 */
const verifyPartnerCredentials = async (clientId, clientSecret) => {
  try {
    const partner = await findPartnerByClientId(clientId);
    if (!partner) {
      console.log(`Partner not found: client_id=${clientId}`);
      return null;
    }

    // Verify password
    const isValid = await bcrypt.compare(clientSecret, partner.client_secret);
    if (!isValid) {
      console.log(`Invalid client_secret for client_id=${clientId}`);
      return null;
    }

    console.log(`✅ Partner authenticated: client_id=${clientId}, partner_uuid=${partner.partner_uuid}`);
    return partner;
  } catch (error) {
    console.error('Error verifying partner credentials:', error);
    throw error;
  }
};

/**
 * Find all partners (for admin - includes inactive)
 * @returns {Promise<Array>} List of partners
 */
const findAllPartners = async () => {
  try {
    await initializeDatabase();
    const partners = await executeQuery(
      'SELECT id, partner_uuid, client_id, name, category, activities, email, public_key_path, allowed_ips, is_active, created_at, updated_at FROM partners ORDER BY created_at DESC'
    );
    return partners || [];
  } catch (error) {
    console.error('Error finding all partners:', error);
    throw error;
  }
};

/**
 * Find partner by id (for admin - includes inactive)
 * @param {number} id - Partner id
 * @returns {Promise<Object|null>} Partner object or null
 */
const findPartnerById = async (id) => {
  try {
    await initializeDatabase();
    const partners = await executeQuery(
      'SELECT id, partner_uuid, client_id, name, category, activities, email, public_key_path, allowed_ips, is_active, created_at, updated_at FROM partners WHERE id = ?',
      [id]
    );
    return partners && partners.length > 0 ? partners[0] : null;
  } catch (error) {
    console.error('Error finding partner by id:', error);
    throw error;
  }
};

/**
 * Update a partner
 * @param {number} id - Partner id
 * @param {Object} updates - Fields to update (name, email, public_key_path, allowed_ips, is_active, client_secret optional)
 * @returns {Promise<Object|null>} Updated partner or null
 */
const updatePartner = async (id, updates) => {
  try {
    await initializeDatabase();
    const partner = await findPartnerById(id);
    if (!partner) return null;

    const allowed = ['name', 'category', 'activities', 'email', 'public_key_path', 'allowed_ips', 'is_active', 'client_secret'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key) && value !== undefined) {
        if (key === 'client_secret' && value) {
          const hashedSecret = await bcrypt.hash(value, 10);
          setClauses.push('client_secret = ?');
          values.push(hashedSecret);
        } else if (key !== 'client_secret') {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (setClauses.length === 0) return partner;

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE partners SET ${setClauses.join(', ')} WHERE id = ?`;
    await executeQuery(query, values);
    return findPartnerById(id);
  } catch (error) {
    console.error('Error updating partner:', error);
    throw error;
  }
};

/**
 * Create a new partner
 * @param {Object} partnerData - Partner data
 * @returns {Promise<Object>} Created partner object
 */
const createPartner = async (partnerData) => {
  try {
    await initializeDatabase();
    const {
      partner_uuid,
      client_id,
      client_secret,
      name,
      category = null,
      activities = null,
      email = null,
      public_key_path = null,
      allowed_ips = null
    } = partnerData;

    // Hash the client secret
    const hashedSecret = await bcrypt.hash(client_secret, 10);

    const query = `
      INSERT INTO partners (
        partner_uuid, client_id, client_secret, name, category, activities, email, public_key_path, allowed_ips, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `;

    const values = [partner_uuid, client_id, hashedSecret, name, category, activities, email, public_key_path, allowed_ips];
    const result = await executeQuery(query, values);

    return {
      id: result.insertId,
      partner_uuid,
      client_id,
      name,
      email,
      is_active: true
    };
  } catch (error) {
    console.error('Error creating partner:', error);
    throw error;
  }
};

module.exports = {
  findPartnerByClientId,
  findPartnerByUuid,
  findPartnerById,
  findAllPartners,
  verifyPartnerCredentials,
  createPartner,
  updatePartner
};

