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
      email = null,
      public_key_path = null,
      allowed_ips = null
    } = partnerData;

    // Hash the client secret
    const hashedSecret = await bcrypt.hash(client_secret, 10);

    const query = `
      INSERT INTO partners (
        partner_uuid, client_id, client_secret, name, email, public_key_path, allowed_ips, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `;

    const values = [partner_uuid, client_id, hashedSecret, name, email, public_key_path, allowed_ips];
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
  verifyPartnerCredentials,
  createPartner
};

