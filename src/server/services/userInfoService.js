const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * User Info Service
 * Handles extraction and storage of user information from multiple sources
 */

/**
 * Extract and save user info from Digilocker KYC response
 * @param {number} userId - User ID
 * @param {Object} kycData - KYC data from Digilocker API
 * @param {string} transactionId - Transaction ID from Digilocker
 * @returns {Promise<Object>} Saved user info record
 */
async function saveUserInfoFromDigilocker(userId, kycData, transactionId) {
  try {
    await initializeDatabase();

    // Parse kycData if it's a string
    let parsedKycData = kycData;
    if (typeof kycData === 'string') {
      try {
        parsedKycData = JSON.parse(kycData);
      } catch (e) {
        console.error('Error parsing kycData:', e);
        return { success: false, error: 'Invalid KYC data format' };
      }
    }

    // Extract user information from KYC data
    const name = parsedKycData.name || null;
    const gender = parsedKycData.gender ? 
      (parsedKycData.gender.toLowerCase() === 'm' ? 'male' : 
       parsedKycData.gender.toLowerCase() === 'f' ? 'female' : 'other') : null;
    
    // Parse DOB (format: DD-MM-YYYY or DD/MM/YYYY)
    let dob = null;
    if (parsedKycData.dob) {
      const dobStr = parsedKycData.dob.replace(/\//g, '-');
      const parts = dobStr.split('-');
      if (parts.length === 3) {
        // Format: DD-MM-YYYY
        dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // Prepare additional details
    const additionalDetails = {
      maskedAdharNumber: parsedKycData.maskedAdharNumber || null,
      careOf: parsedKycData.careOf || null,
      uniqueId: parsedKycData.uniqueId || null,
      status: parsedKycData.status || null
    };

    // Check if user_info already exists for this source
    const existing = await executeQuery(
      `SELECT id FROM user_info 
       WHERE user_id = ? AND source = 'digilocker' AND source_reference = ?`,
      [userId, transactionId]
    );

    if (existing.length > 0) {
      // Update existing record
      await executeQuery(
        `UPDATE user_info 
         SET name = ?, gender = ?, dob = ?, additional_details = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, gender, dob, JSON.stringify(additionalDetails), existing[0].id]
      );
      console.log(`✅ Updated user_info from Digilocker for user ${userId}`);
      
      // Update users table with first_name and last_name if they're null
      // IMPORTANT: Use COALESCE to preserve existing values (prefer user-entered data over KYC data)
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
        
        // Update only fields that are currently NULL (preserve existing user data)
        await executeQuery(
          `UPDATE users 
           SET first_name = COALESCE(first_name, ?),
               last_name = COALESCE(last_name, ?),
               date_of_birth = COALESCE(date_of_birth, ?),
               gender = COALESCE(gender, ?),
               updated_at = NOW()
           WHERE id = ?`,
          [firstName, lastName, dob, gender, userId]
        );
        console.log(`✅ Updated users table with data from Digilocker for user ${userId} (preserving existing values)`);
      }
      
      return { success: true, id: existing[0].id, action: 'updated' };
    } else {
      // Mark other digilocker records as not primary
      await executeQuery(
        `UPDATE user_info SET is_primary = 0 WHERE user_id = ? AND source = 'digilocker'`,
        [userId]
      );

      // Insert new record
      const result = await executeQuery(
        `INSERT INTO user_info 
         (user_id, name, gender, dob, additional_details, source, source_reference, is_primary, verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'digilocker', ?, 1, 1, NOW(), NOW())`,
        [userId, name, gender, dob, JSON.stringify(additionalDetails), transactionId]
      );
      console.log(`✅ Saved user_info from Digilocker for user ${userId}`);
      
      // Update users table with first_name and last_name if they're null
      // IMPORTANT: Use COALESCE to preserve existing values (prefer user-entered data over KYC data)
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
        
        // Update only fields that are currently NULL (preserve existing user data)
        await executeQuery(
          `UPDATE users 
           SET first_name = COALESCE(first_name, ?),
               last_name = COALESCE(last_name, ?),
               date_of_birth = COALESCE(date_of_birth, ?),
               gender = COALESCE(gender, ?),
               updated_at = NOW()
           WHERE id = ?`,
          [firstName, lastName, dob, gender, userId]
        );
        console.log(`✅ Updated users table with data from Digilocker for user ${userId} (preserving existing values)`);
      }
      
      return { success: true, id: result.insertId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error saving user info from Digilocker:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract and save address from Digilocker KYC response
 * @param {number} userId - User ID
 * @param {Object} kycData - KYC data from Digilocker API
 * @param {string} transactionId - Transaction ID from Digilocker
 * @returns {Promise<Object>} Saved address record
 */
async function saveAddressFromDigilocker(userId, kycData, transactionId) {
  try {
    await initializeDatabase();

    // Parse kycData if it's a string
    let parsedKycData = kycData;
    if (typeof kycData === 'string') {
      try {
        parsedKycData = JSON.parse(kycData);
      } catch (e) {
        console.error('Error parsing kycData:', e);
        return { success: false, error: 'Invalid KYC data format' };
      }
    }

    const address = parsedKycData.address;
    if (!address || typeof address !== 'object') {
      return { success: false, error: 'No address data in KYC response' };
    }

    // Extract address components
    const addressLine1 = address.house || '';
    const addressLine2 = [
      address.street,
      address.landmark,
      address.loc
    ].filter(Boolean).join(', ') || null;
    const city = address.vtc || address.loc || null;
    const state = address.state || null;
    const pincode = address.pc || null;
    const country = address.country || 'India';

    // Check if address already exists for this source
    const existing = await executeQuery(
      `SELECT id FROM addresses 
       WHERE user_id = ? AND source = 'digilocker' AND source_reference = ?`,
      [userId, transactionId]
    );

    if (existing.length > 0) {
      // Update existing address
      await executeQuery(
        `UPDATE addresses 
         SET address_line1 = ?, address_line2 = ?, city = ?, state = ?, pincode = ?, country = ?, updated_at = NOW()
         WHERE id = ?`,
        [addressLine1, addressLine2, city, state, pincode, country, existing[0].id]
      );
      console.log(`✅ Updated address from Digilocker for user ${userId}`);
      return { success: true, id: existing[0].id, action: 'updated' };
    } else {
      // Insert new address
      const result = await executeQuery(
        `INSERT INTO addresses 
         (user_id, address_type, address_line1, address_line2, city, state, pincode, country, source, source_reference, is_primary, verified, created_at, updated_at)
         VALUES (?, 'permanent', ?, ?, ?, ?, ?, ?, 'digilocker', ?, 1, 1, NOW(), NOW())`,
        [userId, addressLine1, addressLine2, city, state, pincode, country, transactionId]
      );
      console.log(`✅ Saved address from Digilocker for user ${userId}`);
      return { success: true, id: result.insertId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error saving address from Digilocker:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract and save user info from Bank API response
 * @param {number} userId - User ID
 * @param {Object} reportData - Bank statement report data
 * @param {string} requestId - Request ID or transaction ID from bank API
 * @returns {Promise<Object>} Saved user info record
 */
async function saveUserInfoFromBankAPI(userId, reportData, requestId) {
  try {
    await initializeDatabase();

    // Parse report data if it's a string
    let report = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;

    // Try to find account holder name in various locations
    let accountHolderName = null;
    
    // Path 1: Direct in report
    if (report.account_holder_name || report.accountHolderName) {
      accountHolderName = report.account_holder_name || report.accountHolderName;
    }
    
    // Path 2: In banks array
    if (!accountHolderName && report.banks && Array.isArray(report.banks)) {
      for (const bank of report.banks) {
        if (bank.accounts && Array.isArray(bank.accounts)) {
          for (const account of bank.accounts) {
            if (account.account_holder_name || account.accountHolderName || account.name) {
              accountHolderName = account.account_holder_name || account.accountHolderName || account.name;
              break;
            }
          }
        }
        if (accountHolderName) break;
      }
    }

    if (!accountHolderName) {
      return { success: false, error: 'No account holder name found in bank report' };
    }

    // Prepare additional details
    const additionalDetails = {
      bankName: report.bank_name || report.bankName || null,
      accountNumber: report.account_number || report.accountNumber || null,
      ifscCode: report.ifsc_code || report.ifscCode || null
    };

    // Check if user_info already exists for this source
    const existing = await executeQuery(
      `SELECT id FROM user_info 
       WHERE user_id = ? AND source = 'bank_api' AND source_reference = ?`,
      [userId, requestId]
    );

    if (existing.length > 0) {
      // Update existing record
      await executeQuery(
        `UPDATE user_info 
         SET name = ?, additional_details = ?, updated_at = NOW()
         WHERE id = ?`,
        [accountHolderName, JSON.stringify(additionalDetails), existing[0].id]
      );
      console.log(`✅ Updated user_info from Bank API for user ${userId}`);
      return { success: true, id: existing[0].id, action: 'updated' };
    } else {
      // Mark other bank_api records as not primary
      await executeQuery(
        `UPDATE user_info SET is_primary = 0 WHERE user_id = ? AND source = 'bank_api'`
      );

      // Insert new record
      const result = await executeQuery(
        `INSERT INTO user_info 
         (user_id, name, additional_details, source, source_reference, is_primary, verified, created_at, updated_at)
         VALUES (?, ?, ?, 'bank_api', ?, 1, 1, NOW(), NOW())`,
        [userId, accountHolderName, JSON.stringify(additionalDetails), requestId]
      );
      console.log(`✅ Saved user_info from Bank API for user ${userId}`);
      return { success: true, id: result.insertId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error saving user info from Bank API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all user info records for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of user info records
 */
async function getUserInfo(userId) {
  try {
    await initializeDatabase();
    const records = await executeQuery(
      `SELECT * FROM user_info WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC`,
      [userId]
    );
    return records;
  } catch (error) {
    console.error('❌ Error getting user info:', error);
    throw error;
  }
}

/**
 * Extract and save user info from PAN API response
 * @param {number} userId - User ID
 * @param {Object} panData - PAN data from PAN validation API
 * @param {string} panNumber - PAN number
 * @returns {Promise<Object>} Saved user info record
 */
async function saveUserInfoFromPANAPI(userId, panData, panNumber) {
  try {
    await initializeDatabase();

    // Extract user information from PAN data
    const name = panData.name || panData.fullname || null;
    const phone = panData.mobile || null;
    const email = panData.email || null;
    const gender = panData.gender ? 
      (panData.gender.toLowerCase() === 'm' || panData.gender.toLowerCase() === 'male' ? 'male' : 
       panData.gender.toLowerCase() === 'f' || panData.gender.toLowerCase() === 'female' ? 'female' : 'other') : null;
    
    // DOB is already in YYYY-MM-DD format from PAN API
    const dob = panData.dob || null;

    // Prepare additional details
    const additionalDetails = {
      pan: panNumber.toUpperCase(),
      first_name: panData.first_name || null,
      middle_name: panData.middle_name || null,
      last_name: panData.last_name || null,
      pan_type: panData.pan_type || null,
      aadhaar_number: panData.aadhaar_number || null,
      aadhaar_linked: panData.aadhaar_linked || false,
      address: panData.address || null
    };

    // Check if user_info already exists for this source and PAN
    const existing = await executeQuery(
      `SELECT id FROM user_info 
       WHERE user_id = ? AND source = 'pan_api' AND JSON_EXTRACT(additional_details, '$.pan') = ?`,
      [userId, panNumber.toUpperCase()]
    );

    if (existing.length > 0) {
      // Update existing record
      await executeQuery(
        `UPDATE user_info 
         SET name = ?, phone = ?, email = ?, gender = ?, dob = ?, additional_details = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, phone, email, gender, dob, JSON.stringify(additionalDetails), existing[0].id]
      );
      console.log(`✅ Updated user_info from PAN API for user ${userId}`);
      
      // Update users table with first_name and last_name if they're null
      // Use first_name/last_name from panData if available, otherwise split the name
      let firstName = panData.first_name || null;
      let lastName = panData.last_name || null;
      
      // If first_name/last_name not in panData, split the name
      if (!firstName && !lastName && name) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0] || null;
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
      }
      
      // Update only if first_name or last_name is null
      if (firstName || lastName) {
        await executeQuery(
          `UPDATE users 
           SET first_name = COALESCE(first_name, ?),
               last_name = COALESCE(last_name, ?),
               date_of_birth = COALESCE(date_of_birth, ?),
               gender = COALESCE(gender, ?),
               pan_number = COALESCE(pan_number, ?),
               email = COALESCE(email, ?),
               phone = COALESCE(phone, ?),
               updated_at = NOW()
           WHERE id = ? AND (first_name IS NULL OR last_name IS NULL)`,
          [firstName, lastName, dob, gender, panNumber.toUpperCase(), email, phone, userId]
        );
        console.log(`✅ Updated users table with name from PAN API for user ${userId}`);
      }
      
      return { success: true, id: existing[0].id, action: 'updated' };
    } else {
      // Mark other pan_api records as not primary
      await executeQuery(
        `UPDATE user_info SET is_primary = 0 WHERE user_id = ? AND source = 'pan_api'`,
        [userId]
      );

      // Insert new record
      const result = await executeQuery(
        `INSERT INTO user_info 
         (user_id, name, phone, email, gender, dob, additional_details, source, source_reference, is_primary, verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pan_api', ?, 1, 1, NOW(), NOW())`,
        [userId, name, phone, email, gender, dob, JSON.stringify(additionalDetails), panNumber.toUpperCase()]
      );
      console.log(`✅ Saved user_info from PAN API for user ${userId}`);
      
      // Update users table with first_name and last_name if they're null
      // Use first_name/last_name from panData if available, otherwise split the name
      let firstName = panData.first_name || null;
      let lastName = panData.last_name || null;
      
      // If first_name/last_name not in panData, split the name
      if (!firstName && !lastName && name) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0] || null;
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
      }
      
      // Update only if first_name or last_name is null
      if (firstName || lastName) {
        await executeQuery(
          `UPDATE users 
           SET first_name = COALESCE(first_name, ?),
               last_name = COALESCE(last_name, ?),
               date_of_birth = COALESCE(date_of_birth, ?),
               gender = COALESCE(gender, ?),
               pan_number = COALESCE(pan_number, ?),
               email = COALESCE(email, ?),
               phone = COALESCE(phone, ?),
               updated_at = NOW()
           WHERE id = ? AND (first_name IS NULL OR last_name IS NULL)`,
          [firstName, lastName, dob, gender, panNumber.toUpperCase(), email, phone, userId]
        );
        console.log(`✅ Updated users table with name from PAN API for user ${userId}`);
      }
      
      return { success: true, id: result.insertId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error saving user info from PAN API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract and save address from PAN API response
 * @param {number} userId - User ID
 * @param {Object} panData - PAN data from PAN validation API
 * @param {string} panNumber - PAN number
 * @returns {Promise<Object>} Saved address record
 */
async function saveAddressFromPANAPI(userId, panData, panNumber) {
  try {
    await initializeDatabase();

    const address = panData.address;
    if (!address || !Array.isArray(address) || address.length === 0) {
      return { success: false, error: 'No address data in PAN response' };
    }

    const firstAddress = address[0];

    // Extract address components
    const addressLine1 = firstAddress.address_line1 || firstAddress.building_name || '';
    const addressLine2 = [
      firstAddress.address_line2,
      firstAddress.street_name,
      firstAddress.locality
    ].filter(Boolean).join(', ') || null;
    const city = firstAddress.city || null;
    const state = firstAddress.state || null;
    const pincode = firstAddress.pincode || firstAddress.postal_code || null;
    const country = firstAddress.country || 'India';

    // Check if address already exists for this source
    const existing = await executeQuery(
      `SELECT id FROM addresses 
       WHERE user_id = ? AND source = 'pan_api' AND source_reference = ?`,
      [userId, panNumber.toUpperCase()]
    );

    if (existing.length > 0) {
      // Update existing address
      await executeQuery(
        `UPDATE addresses 
         SET address_line1 = ?, address_line2 = ?, city = ?, state = ?, pincode = ?, country = ?, updated_at = NOW()
         WHERE id = ?`,
        [addressLine1, addressLine2, city, state, pincode, country, existing[0].id]
      );
      console.log(`✅ Updated address from PAN API for user ${userId}`);
      return { success: true, id: existing[0].id, action: 'updated' };
    } else {
      // Insert new address
      const result = await executeQuery(
        `INSERT INTO addresses 
         (user_id, address_type, address_line1, address_line2, city, state, pincode, country, source, source_reference, is_primary, verified, created_at, updated_at)
         VALUES (?, 'permanent', ?, ?, ?, ?, ?, ?, 'pan_api', ?, 1, 1, NOW(), NOW())`,
        [userId, addressLine1, addressLine2, city, state, pincode, country, panNumber.toUpperCase()]
      );
      console.log(`✅ Saved address from PAN API for user ${userId}`);
      return { success: true, id: result.insertId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Error saving address from PAN API:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveUserInfoFromDigilocker,
  saveAddressFromDigilocker,
  saveUserInfoFromBankAPI,
  saveUserInfoFromPANAPI,
  saveAddressFromPANAPI,
  getUserInfo
};

