const { getPool } = require('../config/database');

/**
 * Loan Application Model
 * Handles all database interactions for the loan_applications table
 */

/**
 * Generate unique application number
 * @returns {string} Unique application number
 */
const generateApplicationNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PC${timestamp}${random}`;
};

/**
 * Create a new loan application
 * @param {number} userId - User ID
 * @param {Object} applicationData - Application data
 * @returns {Promise<Object>} Created application object
 */
const createApplication = async (userId, applicationData) => {
  try {
    const pool = getPool();
    const {
      loan_amount,
      tenure_months,
      loan_purpose,
      interest_rate = null,
      emi_amount = null
    } = applicationData;

    // Generate unique application number
    const application_number = generateApplicationNumber();

    const query = `
      INSERT INTO loan_applications (
        user_id, application_number, loan_amount, loan_purpose,
        tenure_months, interest_rate, emi_amount, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const values = [
      userId,
      application_number,
      loan_amount,
      loan_purpose,
      tenure_months,
      interest_rate,
      emi_amount,
      'submitted' // Initial status
    ];

    const [result] = await pool.execute(query, values);
    
    // Return the created application
    return await findApplicationById(result.insertId);
  } catch (error) {
    console.error('Error creating loan application:', error.message);
    throw error;
  }
};

/**
 * Find loan application by ID
 * @param {number} applicationId - Application ID
 * @returns {Promise<Object|null>} Application object or null if not found
 */
const findApplicationById = async (applicationId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT la.*, u.first_name, u.last_name, u.phone, u.email
      FROM loan_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `;
    const [rows] = await pool.execute(query, [applicationId]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding application by ID:', error.message);
    throw error;
  }
};

/**
 * Find all loan applications by user ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of application objects
 */
const findApplicationsByUserId = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        la.id,
        la.application_number,
        la.loan_amount,
        la.loan_purpose,
        la.tenure_months,
        la.interest_rate,
        la.emi_amount,
        la.status,
        la.rejection_reason,
        la.approved_at,
        la.disbursed_at,
        la.created_at,
        la.updated_at
      FROM loan_applications la
      WHERE la.user_id = ?
      ORDER BY la.created_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);
    
    return rows;
  } catch (error) {
    console.error('Error finding applications by user ID:', error.message);
    throw error;
  }
};

/**
 * Find loan application by application number
 * @param {string} applicationNumber - Application number
 * @returns {Promise<Object|null>} Application object or null if not found
 */
const findApplicationByNumber = async (applicationNumber) => {
  try {
    const pool = getPool();
    const query = `
      SELECT la.*, u.first_name, u.last_name, u.phone, u.email
      FROM loan_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.application_number = ?
    `;
    const [rows] = await pool.execute(query, [applicationNumber]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding application by number:', error.message);
    throw error;
  }
};

/**
 * Update loan application status
 * @param {number} applicationId - Application ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object|null>} Updated application or null if not found
 */
const updateApplication = async (applicationId, updateData) => {
  try {
    const pool = getPool();
    
    // Build dynamic query based on provided fields
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(applicationId);
    const query = `UPDATE loan_applications SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const [result] = await pool.execute(query, values);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return await findApplicationById(applicationId);
  } catch (error) {
    console.error('Error updating application:', error.message);
    throw error;
  }
};

/**
 * Get loan application statistics for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Application statistics
 */
const getApplicationStats = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) as disbursed_count,
        SUM(CASE WHEN status = 'approved' OR status = 'disbursed' THEN loan_amount ELSE 0 END) as total_approved_amount
      FROM loan_applications 
      WHERE user_id = ?
    `;
    const [rows] = await pool.execute(query, [userId]);
    
    return rows[0] || {
      total_applications: 0,
      submitted_count: 0,
      under_review_count: 0,
      approved_count: 0,
      rejected_count: 0,
      disbursed_count: 0,
      total_approved_amount: 0
    };
  } catch (error) {
    console.error('Error getting application stats:', error.message);
    throw error;
  }
};

/**
 * Check if user has pending applications
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if user has pending applications
 */
const hasPendingApplications = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT COUNT(*) as count
      FROM loan_applications 
      WHERE user_id = ? 
      AND status IN ('submitted', 'under_review')
    `;
    const [rows] = await pool.execute(query, [userId]);
    
    return rows[0].count > 0;
  } catch (error) {
    console.error('Error checking pending applications:', error.message);
    throw error;
  }
};

/**
 * Get application summary for response
 * @param {Object} application - Application object
 * @returns {Object} Application summary
 */
const getApplicationSummary = (application) => {
  return {
    id: application.id,
    application_number: application.application_number,
    loan_amount: application.loan_amount,
    loan_purpose: application.loan_purpose,
    tenure_months: application.tenure_months,
    interest_rate: application.interest_rate,
    emi_amount: application.emi_amount,
    status: application.status,
    rejection_reason: application.rejection_reason,
    approved_at: application.approved_at,
    disbursed_at: application.disbursed_at,
    created_at: application.created_at,
    updated_at: application.updated_at
  };
};

module.exports = {
  createApplication,
  findApplicationById,
  findApplicationsByUserId,
  findApplicationByNumber,
  updateApplication,
  getApplicationStats,
  hasPendingApplications,
  getApplicationSummary,
  generateApplicationNumber
};
