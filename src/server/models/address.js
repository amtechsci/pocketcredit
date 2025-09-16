const { executeQuery } = require('../config/database');

/**
 * Address Model
 * Handles all database interactions for the addresses table
 */

/**
 * Create or update user address
 * @param {number} userId - User ID
 * @param {Object} addressData - Address data object
 * @param {string} addressType - Type of address (current, permanent, office)
 * @returns {Promise<Object>} Created/updated address object
 */
const createOrUpdateAddress = async (userId, addressData, addressType = 'current') => {
  try {
    const {
      address_line1,
      address_line2 = '',
      city,
      state,
      pincode,
      country = 'India'
    } = addressData;

    // Check if address already exists for this user and type
    const existingAddressQuery = `
      SELECT id FROM addresses 
      WHERE user_id = ? AND address_type = ?
    `;
    const existingAddresses = await executeQuery(existingAddressQuery, [userId, addressType]);

    if (existingAddresses.length > 0) {
      // Update existing address
      const updateQuery = `
        UPDATE addresses SET 
          address_line1 = ?, 
          address_line2 = ?, 
          city = ?, 
          state = ?, 
          pincode = ?, 
          country = ?, 
          updated_at = NOW()
        WHERE user_id = ? AND address_type = ?
      `;
      
      await executeQuery(updateQuery, [
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        country,
        userId,
        addressType
      ]);

      // Return the updated address
      const updatedAddressQuery = `
        SELECT * FROM addresses 
        WHERE user_id = ? AND address_type = ?
      `;
      const updatedAddresses = await executeQuery(updatedAddressQuery, [userId, addressType]);
      return updatedAddresses[0];
    } else {
      // Create new address
      const insertQuery = `
        INSERT INTO addresses (
          user_id, address_type, address_line1, address_line2, 
          city, state, pincode, country, is_primary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const result = await executeQuery(insertQuery, [
        userId,
        addressType,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        country,
        true // Set as primary address
      ]);

      // Return the created address
      const createdAddressQuery = `
        SELECT * FROM addresses WHERE id = ?
      `;
      const createdAddresses = await executeQuery(createdAddressQuery, [result.insertId]);
      return createdAddresses[0];
    }
  } catch (error) {
    console.error('Error creating/updating address:', error.message);
    throw error;
  }
};

/**
 * Get user addresses
 * @param {number} userId - User ID
 * @param {string} addressType - Optional address type filter
 * @returns {Promise<Array>} Array of address objects
 */
const getUserAddresses = async (userId, addressType = null) => {
  try {
    let query = 'SELECT * FROM addresses WHERE user_id = ?';
    let params = [userId];

    if (addressType) {
      query += ' AND address_type = ?';
      params.push(addressType);
    }

    query += ' ORDER BY is_primary DESC, created_at ASC';

    const addresses = await executeQuery(query, params);
    return addresses;
  } catch (error) {
    console.error('Error getting user addresses:', error.message);
    throw error;
  }
};

/**
 * Get primary address for user
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Primary address object or null
 */
const getPrimaryAddress = async (userId) => {
  try {
    const query = `
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = TRUE 
      ORDER BY created_at ASC 
      LIMIT 1
    `;
    
    const addresses = await executeQuery(query, [userId]);
    return addresses.length > 0 ? addresses[0] : null;
  } catch (error) {
    console.error('Error getting primary address:', error.message);
    throw error;
  }
};

/**
 * Delete user address
 * @param {number} userId - User ID
 * @param {string} addressType - Address type to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteUserAddress = async (userId, addressType) => {
  try {
    const query = 'DELETE FROM addresses WHERE user_id = ? AND address_type = ?';
    const result = await executeQuery(query, [userId, addressType]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error deleting user address:', error.message);
    throw error;
  }
};

module.exports = {
  createOrUpdateAddress,
  getUserAddresses,
  getPrimaryAddress,
  deleteUserAddress
};
