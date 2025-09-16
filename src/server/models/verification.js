const { executeQuery } = require('../config/database');

/**
 * Verification Model
 * Handles all database interactions for the verification_records table
 */

/**
 * Create or update verification record
 * @param {number} userId - User ID
 * @param {string} documentType - Type of document (pan, aadhaar, etc.)
 * @param {string} documentNumber - Document number
 * @param {string} documentPath - Optional file path
 * @returns {Promise<Object>} Created/updated verification record
 */
const createOrUpdateVerificationRecord = async (userId, documentType, documentNumber, documentPath = null) => {
  try {
    // Check if verification record already exists for this user and document type
    const existingRecordQuery = `
      SELECT id FROM verification_records 
      WHERE user_id = ? AND document_type = ?
    `;
    const existingRecords = await executeQuery(existingRecordQuery, [userId, documentType]);

    if (existingRecords.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE verification_records SET 
          document_number = ?, 
          document_path = ?, 
          verification_status = 'pending',
          updated_at = NOW()
        WHERE user_id = ? AND document_type = ?
      `;
      
      await executeQuery(updateQuery, [
        documentNumber,
        documentPath,
        userId,
        documentType
      ]);

      // Return the updated record
      const updatedRecordQuery = `
        SELECT * FROM verification_records 
        WHERE user_id = ? AND document_type = ?
      `;
      const updatedRecords = await executeQuery(updatedRecordQuery, [userId, documentType]);
      return updatedRecords[0];
    } else {
      // Create new record
      const insertQuery = `
        INSERT INTO verification_records (
          user_id, document_type, document_number, document_path, 
          verification_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())
      `;
      
      const result = await executeQuery(insertQuery, [
        userId,
        documentType,
        documentNumber,
        documentPath
      ]);

      // Return the created record
      const createdRecordQuery = `
        SELECT * FROM verification_records WHERE id = ?
      `;
      const createdRecords = await executeQuery(createdRecordQuery, [result.insertId]);
      return createdRecords[0];
    }
  } catch (error) {
    console.error('Error creating/updating verification record:', error.message);
    throw error;
  }
};

/**
 * Get user verification records
 * @param {number} userId - User ID
 * @param {string} documentType - Optional document type filter
 * @returns {Promise<Array>} Array of verification records
 */
const getUserVerificationRecords = async (userId, documentType = null) => {
  try {
    let query = 'SELECT * FROM verification_records WHERE user_id = ?';
    let params = [userId];

    if (documentType) {
      query += ' AND document_type = ?';
      params.push(documentType);
    }

    query += ' ORDER BY created_at DESC';

    const records = await executeQuery(query, params);
    return records;
  } catch (error) {
    console.error('Error getting user verification records:', error.message);
    throw error;
  }
};

/**
 * Get specific verification record
 * @param {number} userId - User ID
 * @param {string} documentType - Document type
 * @returns {Promise<Object|null>} Verification record or null
 */
const getVerificationRecord = async (userId, documentType) => {
  try {
    const query = `
      SELECT * FROM verification_records 
      WHERE user_id = ? AND document_type = ?
    `;
    
    const records = await executeQuery(query, [userId, documentType]);
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error getting verification record:', error.message);
    throw error;
  }
};

/**
 * Update verification status
 * @param {number} recordId - Record ID
 * @param {string} status - New status (pending, verified, rejected)
 * @param {number} verifiedBy - User ID who verified
 * @param {string} rejectionReason - Optional rejection reason
 * @returns {Promise<boolean>} Success status
 */
const updateVerificationStatus = async (recordId, status, verifiedBy = null, rejectionReason = null) => {
  try {
    const query = `
      UPDATE verification_records SET 
        verification_status = ?, 
        verified_by = ?, 
        verified_at = ?, 
        rejection_reason = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    const verifiedAt = status === 'verified' ? new Date() : null;
    
    const result = await executeQuery(query, [
      status,
      verifiedBy,
      verifiedAt,
      rejectionReason,
      recordId
    ]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating verification status:', error.message);
    throw error;
  }
};

module.exports = {
  createOrUpdateVerificationRecord,
  getUserVerificationRecords,
  getVerificationRecord,
  updateVerificationStatus
};
