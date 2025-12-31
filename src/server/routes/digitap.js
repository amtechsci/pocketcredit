const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const { fetchUserPrefillData, validatePANDetails } = require('../services/digitapService');
const { saveUserInfoFromPANAPI, saveAddressFromPANAPI } = require('../services/userInfoService');
const { compareNames } = require('../utils/nameComparison');

// POST /api/digitap/prefill - Fetch user data from Digitap API
// NOTE: No checkHoldStatus here - allow fetching data even if on hold
router.post('/prefill', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user's mobile number
    const users = await executeQuery(
      'SELECT phone FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const mobileNumber = users[0].phone;

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number not found for user'
      });
    }

    console.log(`Fetching Digitap prefill data for user ${userId}`);

    // Call Digitap API
    const result = await fetchUserPrefillData(mobileNumber);

    if (!result.success) {
      console.log('Digitap API call failed, allowing manual entry');
      return res.json({
        success: false,
        allow_manual: true,
        message: 'Unable to fetch details automatically. Please enter manually.',
        error: result.error
      });
    }

    const userData = result.data;

    // Store response in database
    try {
      await executeQuery(`
        INSERT INTO digitap_responses 
        (user_id, mobile_number, response_data, experian_score, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [
        userId,
        mobileNumber,
        JSON.stringify(userData),
        userData.experian_score || null
      ]);
      console.log('Digitap response stored in database');
    } catch (dbError) {
      console.error('Error storing Digitap response:', dbError);
      // Continue even if storage fails
    }

    // Check credit score
    if (userData.experian_score !== null && userData.experian_score !== undefined) {
      console.log(`User credit score: ${userData.experian_score}`);

      if (userData.experian_score < 630) {
        console.log('Credit score below threshold, applying 60-day hold');

        // Create 60-day hold
        const holdUntil = new Date();
        holdUntil.setDate(holdUntil.getDate() + 60);

        await executeQuery(`
          UPDATE users 
          SET status = 'on_hold', 
              eligibility_status = 'not_eligible',
              application_hold_reason = ?,
              hold_until_date = ?,
              experian_score = ?,
              updated_at = NOW()
          WHERE id = ?
        `, [
          `Low credit score: ${userData.experian_score} (Minimum required: 630)`,
          holdUntil,
          userData.experian_score,
          userId
        ]);

        return res.json({
          success: false,
          hold_applied: true,
          credit_score: userData.experian_score,
          hold_until: holdUntil,
          hold_days: 60,
          message: `Your credit score (${userData.experian_score}) is below our minimum requirement of 630. You can reapply after ${holdUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        });
      }

      // Credit score is good, update user
      await executeQuery(
        'UPDATE users SET experian_score = ?, updated_at = NOW() WHERE id = ?',
        [userData.experian_score, userId]
      );
    } else {
      console.log('No credit score in response, proceeding without score check');
    }

    // Convert DOB from DD-MM-YYYY to YYYY-MM-DD for HTML date input
    let convertedDOB = null;
    if (userData.dob) {
      try {
        const dobParts = userData.dob.split('-'); // DD-MM-YYYY
        if (dobParts.length === 3) {
          convertedDOB = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`; // YYYY-MM-DD
        }
      } catch (e) {
        console.error('DOB conversion error:', e);
      }
    }

    // Return pre-fill data
    console.log('Digitap prefill successful, returning data');
    res.json({
      success: true,
      data: {
        name: userData.name || null,
        dob: convertedDOB || userData.dob || null,
        pan: userData.pan || null,
        gender: userData.gender || null,
        email: userData.email || null,
        address: userData.address || null,
        credit_score: userData.experian_score || null,
        age: userData.age || null
      },
      message: 'Details fetched successfully'
    });

  } catch (error) {
    console.error('Digitap prefill error:', error);
    res.status(500).json({
      success: false,
      allow_manual: true,
      message: 'Failed to fetch details. Please enter manually.'
    });
  }
});

// POST /api/digitap/save-prefill - Save accepted prefill data to user tables
// NOTE: checkHoldStatus added - block saving if on hold
router.post('/save-prefill', requireAuth, checkHoldStatus, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { name, dob, pan, gender, email, address } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log(`Saving Digitap prefill data for user ${userId}`);

    // Split name into first and last name
    let first_name = name || '';
    let last_name = '';
    if (name) {
      const nameParts = name.trim().split(' ');
      if (nameParts.length > 1) {
        first_name = nameParts[0];
        last_name = nameParts.slice(1).join(' ');
      }
    }

    // Parse address data to extract pincode
    let pincode = null;
    let address_data = null;
    if (address && Array.isArray(address) && address.length > 0) {
      // Use the first address
      const firstAddress = address[0];
      pincode = firstAddress.postal_code || null;
      address_data = JSON.stringify(address);
    }

    // Update users table with Digitap data
    // For salaried users, Digitap provides all required info so mark profile as complete
    await executeQuery(`
      UPDATE users 
      SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        pan_number = COALESCE(?, pan_number),
        pincode = COALESCE(?, pincode),
        address_data = COALESCE(?, address_data),
        profile_completion_step = 5,
        profile_completed = true,
        updated_at = NOW()
      WHERE id = ?
    `, [
      first_name,
      last_name,
      email,
      dob,
      gender,
      pan,
      pincode,
      address_data,
      userId
    ]);

    console.log('Digitap prefill data saved to users table and profile marked as complete');

    res.json({
      status: 'success',
      message: 'Profile completed successfully with your details',
      data: { 
        saved: true,
        profile_completed: true
      }
    });

  } catch (error) {
    console.error('Error saving Digitap prefill:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save details'
    });
  }
});

// POST /api/digitap/validate-pan - Validate PAN and fetch details
// NOTE: checkHoldStatus added - block validation if on hold
router.post('/validate-pan', requireAuth, checkHoldStatus, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { pan } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!pan) {
      return res.status(400).json({
        success: false,
        message: 'PAN number is required'
      });
    }

    console.log(`Validating PAN for user ${userId}: ${pan}`);

    // Call PAN validation API
    const result = await validatePANDetails(pan.toUpperCase());

    if (!result.success) {
      return res.json({
        success: false,
        message: result.error || 'Failed to validate PAN',
        allow_manual: true
      });
    }

    const panData = result.data;

    // Split name into first and last name
    let first_name = panData.first_name || '';
    let last_name = panData.last_name || '';
    if (!first_name && panData.name) {
      const nameParts = panData.name.trim().split(' ');
      first_name = nameParts[0] || '';
      last_name = nameParts.slice(1).join(' ') || '';
    }

    // Get PAN name for comparison
    const panName = panData.name || `${first_name} ${last_name}`.trim();

    // Check if user has Aadhaar name from Digilocker (for name comparison)
    // This applies only when PAN was NOT fetched from Aadhaar API
    const aadhaarInfo = await executeQuery(
      `SELECT name FROM user_info 
       WHERE user_id = ? AND source = 'digilocker' AND is_primary = 1 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    // If Aadhaar name exists and PAN name is available, compare them
    if (aadhaarInfo.length > 0 && aadhaarInfo[0].name && panName) {
      const aadhaarName = aadhaarInfo[0].name;
      
      // Compare names using the utility function
      const comparisonResult = compareNames(aadhaarName, panName);
      const matchPercentage = comparisonResult.percentage;

      console.log(`📊 Name Comparison Result:`);
      console.log(`   Aadhaar Name: ${aadhaarName}`);
      console.log(`   PAN Name: ${panName}`);
      console.log(`   Match Percentage: ${matchPercentage}%`);
      console.log(`   Details:`, JSON.stringify(comparisonResult.details, null, 2));

      // Get current validation attempts
      const userAttempts = await executeQuery(
        `SELECT pan_validation_attempts FROM users WHERE id = ?`,
        [userId]
      );
      const currentAttempts = userAttempts[0]?.pan_validation_attempts || 0;

      // If match percentage is less than 50%
      if (matchPercentage < 50) {
        // Increment attempts counter
        const newAttempts = currentAttempts + 1;
        await executeQuery(
          `UPDATE users 
           SET pan_validation_attempts = ?, 
               last_pan_validation_attempt = NOW() 
           WHERE id = ?`,
          [newAttempts, userId]
        );

        console.log(`⚠️ Name mismatch detected (${matchPercentage}%). Attempt ${newAttempts}/2`);

        // If this is the 1st attempt (now newAttempts = 1), show error
        // After 2nd attempt (newAttempts >= 2), allow to proceed
        if (newAttempts < 2) {
          return res.json({
            success: false,
            name_mismatch: true,
            match_percentage: matchPercentage,
            aadhaar_name: aadhaarName,
            pan_name: panName,
            attempts: newAttempts,
            message: 'Kindly enter your PAN number correctly',
            allow_retry: true
          });
        } else {
          console.log(`✅ Allowing after ${newAttempts} failed attempts`);
          // Reset attempts counter and proceed
          await executeQuery(
            `UPDATE users SET pan_validation_attempts = 0 WHERE id = ?`,
            [userId]
          );
        }
      } else {
        console.log(`✅ Name match successful (${matchPercentage}%)`);
        // Reset attempts counter on successful match
        if (currentAttempts > 0) {
          await executeQuery(
            `UPDATE users SET pan_validation_attempts = 0 WHERE id = ?`,
            [userId]
          );
        }
      }
    } else {
      console.log(`ℹ️ Skipping name comparison (no Aadhaar data or PAN fetched from Aadhaar)`);
    }

    // Parse address data to extract pincode
    let pincode = null;
    let address_data = null;
    if (panData.address && Array.isArray(panData.address) && panData.address.length > 0) {
      const firstAddress = panData.address[0];
      pincode = firstAddress.postal_code || firstAddress.pincode || null;
      address_data = JSON.stringify(panData.address);
    }

    // Update users table with PAN validation data
    await executeQuery(`
      UPDATE users 
      SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        pan_number = ?,
        pincode = COALESCE(?, pincode),
        address_data = COALESCE(?, address_data),
        profile_completion_step = 5,
        profile_completed = true,
        updated_at = NOW()
      WHERE id = ?
    `, [
      first_name,
      last_name,
      panData.email || null,
      panData.dob || null,
      panData.gender || null,
      pan.toUpperCase(),
      pincode,
      address_data,
      userId
    ]);

    // Save PAN in verification_records table
    await executeQuery(`
      INSERT INTO verification_records (user_id, document_type, document_number, verification_status, created_at, updated_at)
      VALUES (?, 'pan', ?, 'pending', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        document_number = VALUES(document_number),
        updated_at = NOW()
    `, [userId, pan.toUpperCase()]);

    // Save user info and address from PAN API to user_info table
    try {
      const userInfoResult = await saveUserInfoFromPANAPI(userId, panData, pan.toUpperCase());
      if (userInfoResult.success) {
        console.log(`✅ User info saved from PAN API: ${userInfoResult.action}`);
      }
      
      const addressResult = await saveAddressFromPANAPI(userId, panData, pan.toUpperCase());
      if (addressResult.success) {
        console.log(`✅ Address saved from PAN API: ${addressResult.action}`);
      }
    } catch (infoError) {
      console.error('❌ Error saving user info/address from PAN API:', infoError);
      // Don't fail the request if info extraction fails
    }

    console.log('PAN validation data saved to users table');

    res.json({
      status: 'success',
      message: 'PAN validated and profile completed successfully',
      data: {
        saved: true,
        profile_completed: true,
        pan_data: {
          name: panData.name,
          first_name: first_name,
          last_name: last_name,
          dob: panData.dob,
          gender: panData.gender,
          address: panData.address
        }
      }
    });

  } catch (error) {
    console.error('Error validating PAN:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate PAN'
    });
  }
});

module.exports = router;

