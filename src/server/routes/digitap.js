const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const { fetchUserPrefillData } = require('../services/digitapService');

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

    console.log('Digitap prefill data saved to users table');

    res.json({
      status: 'success',
      message: 'Details saved successfully',
      data: { saved: true }
    });

  } catch (error) {
    console.error('Error saving Digitap prefill:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save details'
    });
  }
});

module.exports = router;

