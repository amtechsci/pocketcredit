const { executeQuery } = require('../config/database');

/**
 * User Model
 * Handles all database interactions for the users table
 */

/**
 * Find user by mobile number
 * @param {string} phone - Mobile phone number
 * @returns {Promise<Object|null>} User object or null if not found
 */
const findUserByMobileNumber = async (phone) => {
  try {
    const query = 'SELECT * FROM users WHERE phone = ?';
    const rows = await executeQuery(query, [phone]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by mobile number:', error.message);
    throw error;
  }
};

/**
 * Find user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
const findUserById = async (id) => {
  try {
    const query = 'SELECT * FROM users WHERE id = ?';
    const rows = await executeQuery(query, [id]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by ID:', error.message);
    throw error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data object
 * @returns {Promise<Object>} Created user object
 */
const createUser = async (userData) => {
  try {
    const {
      phone,
      email = null,
      first_name = null,
      last_name = null,
      date_of_birth = null,
      gender = null,
      marital_status = null
    } = userData;

    // Get default credit score from user_config
    let defaultCreditScore = 640; // fallback value
    try {
      const configs = await executeQuery(
        'SELECT config_value FROM user_config WHERE config_key = ?',
        ['default_credit_score']
      );
      if (configs && configs.length > 0) {
        defaultCreditScore = parseInt(configs[0].config_value);
      }
    } catch (configError) {
      console.warn('Could not fetch default credit score, using fallback:', configError.message);
    }

    const query = `
      INSERT INTO users (
        phone, email, first_name, last_name, 
        date_of_birth, gender, marital_status, 
        phone_verified, status, profile_completion_step, credit_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const values = [
      phone,
      email,
      first_name,
      last_name,
      date_of_birth,
      gender,
      marital_status,
      true, // phone_verified = true after OTP verification
      'active', // status = active
      1, // profile_completion_step = 1 (Start with Step 1: Employment Quick Check)
      defaultCreditScore // credit_score = default from config
    ];

    const result = await executeQuery(query, values);
    
    // Return the created user
    const createdUser = await findUserById(result.insertId);
    return createdUser;
  } catch (error) {
    console.error('Error creating user:', error.message);
    throw error;
  }
};

/**
 * Update user information
 * @param {number} id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated user object or null if not found
 */
const updateUser = async (id, updateData) => {
  try {
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
    
    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await executeQuery(query, values);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return await findUserById(id);
  } catch (error) {
    console.error('Error updating user:', error.message);
    throw error;
  }
};

/**
 * Update user's last login timestamp
 * @param {number} id - User ID
 * @returns {Promise<boolean>} Success status
 */
const updateLastLogin = async (id) => {
  try {
    const query = 'UPDATE users SET last_login_at = NOW() WHERE id = ?';
    const result = await executeQuery(query, [id]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating last login:', error.message);
    throw error;
  }
};

/**
 * Check if user profile is complete
 * @param {Object} user - User object
 * @returns {boolean} Profile completion status
 */
const isProfileComplete = (user) => {
  const requiredFields = ['first_name', 'last_name', 'email'];
  return requiredFields.every(field => user[field] && user[field].trim() !== '');
};

/**
 * Update user profile by ID with flexible data
 * @param {number} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated user object or null if not found
 */
const updateProfileById = async (userId, updateData) => {
  try {
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
    
    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await executeQuery(query, values);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    // Return the complete updated user profile
    return await findUserById(userId);
  } catch (error) {
    console.error('Error updating profile by ID:', error.message);
    throw error;
  }
};

/**
 * Get user profile summary
 * @param {Object} user - User object
 * @returns {Object} Profile summary
 */
const getProfileSummary = async (user) => {
  // Fetch PAN from verification_records if exists
  let pan_number = null;
  try {
    const panRecords = await executeQuery(
      'SELECT document_number FROM verification_records WHERE user_id = ? AND document_type = ? LIMIT 1',
      [user.id, 'pan']
    );
    if (panRecords && panRecords.length > 0) {
      pan_number = panRecords[0].document_number;
    }
  } catch (error) {
    console.error('Error fetching PAN:', error.message);
  }

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    personal_email: user.personal_email || null,
    personal_email_verified: user.personal_email_verified || false,
    official_email: user.official_email || null,
    official_email_verified: user.official_email_verified || false,
    first_name: user.first_name,
    last_name: user.last_name,
    date_of_birth: user.date_of_birth,
    gender: user.gender,
    marital_status: user.marital_status || null,
    spoken_language: user.spoken_language || null,
    work_experience_range: user.work_experience_range || null,
    employment_type: user.employment_type,
    graduation_status: user.graduation_status,
    income_range: user.income_range,
    phone_verified: user.phone_verified,
    email_verified: user.email_verified,
    kyc_completed: user.kyc_completed,
    status: user.status,
    profile_completion_step: user.profile_completion_step || 0,
    profile_completed: user.profile_completed || false,
    credit_score: user.credit_score || 640,
    loan_limit: user.loan_limit || 0,
    pincode: user.pincode,
    pan_number: pan_number || user.pan_number,
    latlong: user.latlong,
    residence_type: user.residence_type || null,
    eligibility_status: user.eligibility_status,
    created_at: user.created_at,
    last_login_at: user.last_login_at
  };
}; 

module.exports = {
  findUserByMobileNumber,
  findUserById,
  createUser,
  updateUser,
  updateProfileById,
  updateLastLogin,
  isProfileComplete,
  getProfileSummary
};
