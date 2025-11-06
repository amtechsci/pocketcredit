const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../utils/mysqlDatabase');
const router = express.Router();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const connection = await getConnection();
    const [users] = await connection.execute(
      'SELECT id, email, status FROM users WHERE id = ? AND status = "active"',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

// =====================================================
// USER REGISTRATION & AUTHENTICATION
// =====================================================

// POST /api/users/register - User Registration
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, first_name, last_name, date_of_birth, gender } = req.body;

    // Validation
    if (!email || !phone || !password || !first_name || !last_name || !date_of_birth || !gender) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Phone validation (Indian format)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use +91XXXXXXXXXX'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const connection = await getConnection();

    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Get default member tier
    const [defaultTier] = await connection.execute(
      'SELECT id FROM member_tiers WHERE is_default = TRUE LIMIT 1'
    );

    const member_id = defaultTier.length > 0 ? defaultTier[0].id : 1;

    // Create user
    const [result] = await connection.execute(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, 
                         date_of_birth, gender, member_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, phone, password_hash, first_name, last_name, date_of_birth, gender, member_id]
    );

    const userId = result.insertId;

    // Create initial KYC status
    await connection.execute(
      'INSERT INTO user_kyc_status (user_id) VALUES (?)',
      [userId]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: userId, email: email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create session
    const sessionToken = jwt.sign(
      { userId: userId, sessionId: Date.now() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await connection.execute(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [userId, sessionToken]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: userId,
          email,
          phone,
          first_name,
          last_name,
          date_of_birth,
          gender,
          member_id,
          email_verified: false,
          phone_verified: false,
          kyc_completed: false
        },
        token,
        sessionToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// POST /api/users/login - User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const connection = await getConnection();

    // Get user with member tier info
    const [users] = await connection.execute(
      `SELECT u.*, mt.name as tier_name, mt.display_name as tier_display_name 
       FROM users u 
       LEFT JOIN member_tiers mt ON u.member_id = mt.id 
       WHERE u.email = ? AND u.status = 'active'`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await connection.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create session
    const sessionToken = jwt.sign(
      { userId: user.id, sessionId: Date.now() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await connection.execute(
      'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [user.id, sessionToken]
    );

    // Remove password_hash from response
    delete user.password_hash;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
        sessionToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// POST /api/users/logout - User Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const connection = await getConnection();

    // Revoke session
    await connection.execute(
      'UPDATE user_sessions SET status = "revoked" WHERE session_token = ?',
      [token]
    );

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
});

// =====================================================
// USER PROFILE MANAGEMENT
// =====================================================

// GET /api/users/profile - Get User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();

    // Get user with member tier info
    const [users] = await connection.execute(
      `SELECT u.*, mt.name as tier_name, mt.display_name as tier_display_name,
              mt.max_loan_amount, mt.processing_fee_rate, mt.interest_rate_per_day
       FROM users u 
       LEFT JOIN member_tiers mt ON u.member_id = mt.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    delete user.password_hash;

    // Get addresses
    const [addresses] = await connection.execute(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY address_type',
      [req.user.id]
    );

    // Get employment
    const [employment] = await connection.execute(
      'SELECT * FROM user_employment WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    // Get bank accounts
    const [bankAccounts] = await connection.execute(
      'SELECT * FROM user_bank_accounts WHERE user_id = ? ORDER BY is_primary DESC',
      [req.user.id]
    );

    // Get KYC status
    const [kycStatus] = await connection.execute(
      'SELECT * FROM user_kyc_status WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        user,
        addresses,
        employment: employment[0] || null,
        bankAccounts,
        kycStatus: kycStatus[0] || null
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile'
    });
  }
});

// PUT /api/users/profile - Update User Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, gender, marital_status } = req.body;

    const connection = await getConnection();

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (first_name) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name) { updates.push('last_name = ?'); values.push(last_name); }
    if (date_of_birth) { updates.push('date_of_birth = ?'); values.push(date_of_birth); }
    if (gender) { updates.push('gender = ?'); values.push(gender); }
    if (marital_status) { updates.push('marital_status = ?'); values.push(marital_status); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(req.user.id);

    await connection.execute(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile'
    });
  }
});

// =====================================================
// ADDRESS MANAGEMENT
// =====================================================

// POST /api/users/addresses - Add Address
router.post('/addresses', authenticateToken, async (req, res) => {
  try {
    const { address_type, address_line1, address_line2, city, state, pincode, country = 'India' } = req.body;

    if (!address_type || !address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Required address fields missing'
      });
    }

    const connection = await getConnection();

    const [result] = await connection.execute(
      `INSERT INTO user_addresses (user_id, address_type, address_line1, address_line2, city, state, pincode, country) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, address_type, address_line1, address_line2, city, state, pincode, country]
    );

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: {
        id: result.insertId,
        address_type,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        country
      }
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding address'
    });
  }
});

// PUT /api/users/addresses/:id - Update Address
router.put('/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { address_line1, address_line2, city, state, pincode, country } = req.body;

    const connection = await getConnection();

    // Verify address belongs to user
    const [addresses] = await connection.execute(
      'SELECT id FROM user_addresses WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (addresses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (address_line1) { updates.push('address_line1 = ?'); values.push(address_line1); }
    if (address_line2 !== undefined) { updates.push('address_line2 = ?'); values.push(address_line2); }
    if (city) { updates.push('city = ?'); values.push(city); }
    if (state) { updates.push('state = ?'); values.push(state); }
    if (pincode) { updates.push('pincode = ?'); values.push(pincode); }
    if (country) { updates.push('country = ?'); values.push(country); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    await connection.execute(
      `UPDATE user_addresses SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Address updated successfully'
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating address'
    });
  }
});

// =====================================================
// EMPLOYMENT MANAGEMENT
// =====================================================

// POST /api/users/employment - Add/Update Employment
router.post('/employment', authenticateToken, async (req, res) => {
  try {
    const { 
      employment_type, 
      company_name, 
      designation, 
      work_experience_years, 
      work_experience_months,
      salary_date,
      company_address,
      company_phone,
      company_email
    } = req.body;

    if (!employment_type) {
      return res.status(400).json({
        success: false,
        message: 'Employment type is required'
      });
    }

    const connection = await getConnection();

    // Check if employment record exists
    const [existing] = await connection.execute(
      'SELECT id FROM user_employment WHERE user_id = ?',
      [req.user.id]
    );

    let result;
    if (existing.length > 0) {
      // Update existing
      const updates = [];
      const values = [];

      if (employment_type) { updates.push('employment_type = ?'); values.push(employment_type); }
      if (company_name !== undefined) { updates.push('company_name = ?'); values.push(company_name); }
      if (designation !== undefined) { updates.push('designation = ?'); values.push(designation); }
      if (work_experience_years !== undefined) { updates.push('work_experience_years = ?'); values.push(work_experience_years); }
      if (work_experience_months !== undefined) { updates.push('work_experience_months = ?'); values.push(work_experience_months); }
      if (salary_date !== undefined) { updates.push('salary_date = ?'); values.push(salary_date); }
      if (company_address !== undefined) { updates.push('company_address = ?'); values.push(company_address); }
      if (company_phone !== undefined) { updates.push('company_phone = ?'); values.push(company_phone); }
      if (company_email !== undefined) { updates.push('company_email = ?'); values.push(company_email); }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      values.push(existing[0].id);

      await connection.execute(
        `UPDATE user_employment SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      result = { insertId: existing[0].id, affectedRows: 1 };
    } else {
      // Create new
      [result] = await connection.execute(
        `INSERT INTO user_employment (user_id, employment_type, company_name, designation, 
                                     work_experience_years, work_experience_months, 
                                     salary_date, company_address, company_phone, company_email) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, employment_type, company_name, designation, work_experience_years, 
         work_experience_months, salary_date, company_address, company_phone, company_email]
      );
    }

    res.status(201).json({
      success: true,
      message: existing.length > 0 ? 'Employment updated successfully' : 'Employment added successfully',
      data: {
        id: result.insertId,
        employment_type,
        company_name,
        designation,
        work_experience_years,
        work_experience_months,
        salary_date
      }
    });

  } catch (error) {
    console.error('Employment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving employment'
    });
  }
});

// =====================================================
// BANK ACCOUNT MANAGEMENT
// =====================================================

// POST /api/users/bank-accounts - Add Bank Account
router.post('/bank-accounts', authenticateToken, async (req, res) => {
  try {
    const { 
      bank_name, 
      account_number, 
      ifsc_code, 
      account_holder_name, 
      account_type = 'savings',
      is_primary = false
    } = req.body;

    if (!bank_name || !account_number || !ifsc_code || !account_holder_name) {
      return res.status(400).json({
        success: false,
        message: 'All bank account fields are required'
      });
    }

    // IFSC code validation
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc_code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IFSC code format'
      });
    }

    const connection = await getConnection();

    // If setting as primary, unset other primary accounts
    if (is_primary) {
      await connection.execute(
        'UPDATE user_bank_accounts SET is_primary = FALSE WHERE user_id = ?',
        [req.user.id]
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO user_bank_accounts (user_id, bank_name, account_number, ifsc_code, 
                                      account_holder_name, account_type, is_primary) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, bank_name, account_number, ifsc_code, account_holder_name, account_type, is_primary]
    );

    res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      data: {
        id: result.insertId,
        bank_name,
        account_number: account_number.replace(/\d(?=\d{4})/g, '*'), // Mask account number
        ifsc_code,
        account_holder_name,
        account_type,
        is_primary
      }
    });

  } catch (error) {
    console.error('Add bank account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding bank account'
    });
  }
});

// PUT /api/users/bank-accounts/:id/set-primary - Set Primary Bank Account
router.put('/bank-accounts/:id/set-primary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    // Verify account belongs to user
    const [accounts] = await connection.execute(
      'SELECT id FROM user_bank_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (accounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Unset all primary accounts
    await connection.execute(
      'UPDATE user_bank_accounts SET is_primary = FALSE WHERE user_id = ?',
      [req.user.id]
    );

    // Set this account as primary
    await connection.execute(
      'UPDATE user_bank_accounts SET is_primary = TRUE WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Primary bank account updated successfully'
    });

  } catch (error) {
    console.error('Set primary bank account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating primary bank account'
    });
  }
});

// =====================================================
// KYC STATUS MANAGEMENT
// =====================================================

// GET /api/users/kyc-status - Get KYC Status
router.get('/kyc-status', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();

    const [kycStatus] = await connection.execute(
      'SELECT * FROM user_kyc_status WHERE user_id = ?',
      [req.user.id]
    );

    if (kycStatus.length === 0) {
      // Create initial KYC status if not exists
      await connection.execute(
        'INSERT INTO user_kyc_status (user_id) VALUES (?)',
        [req.user.id]
      );

      const [newStatus] = await connection.execute(
        'SELECT * FROM user_kyc_status WHERE user_id = ?',
        [req.user.id]
      );

      return res.json({
        success: true,
        data: newStatus[0]
      });
    }

    res.json({
      success: true,
      data: kycStatus[0]
    });

  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching KYC status'
    });
  }
});

// PUT /api/users/kyc-status - Update KYC Status
router.put('/kyc-status', authenticateToken, async (req, res) => {
  try {
    const {
      pan_verified,
      aadhaar_verified,
      address_verified,
      bank_account_verified,
      employment_verified,
      video_kyc_verified,
      overall_status
    } = req.body;

    const connection = await getConnection();

    // Build update query
    const updates = [];
    const values = [];

    if (pan_verified !== undefined) { updates.push('pan_verified = ?'); values.push(pan_verified); }
    if (aadhaar_verified !== undefined) { updates.push('aadhaar_verified = ?'); values.push(aadhaar_verified); }
    if (address_verified !== undefined) { updates.push('address_verified = ?'); values.push(address_verified); }
    if (bank_account_verified !== undefined) { updates.push('bank_account_verified = ?'); values.push(bank_account_verified); }
    if (employment_verified !== undefined) { updates.push('employment_verified = ?'); values.push(employment_verified); }
    if (video_kyc_verified !== undefined) { updates.push('video_kyc_verified = ?'); values.push(video_kyc_verified); }
    if (overall_status) { updates.push('overall_status = ?'); values.push(overall_status); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(req.user.id);

    await connection.execute(
      `UPDATE user_kyc_status SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'KYC status updated successfully'
    });

  } catch (error) {
    console.error('Update KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating KYC status'
    });
  }
});

module.exports = router;