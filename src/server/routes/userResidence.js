const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');

/**
 * GET /api/user/available-addresses
 * Get available addresses from Experian, Digilocker, and Digitap responses
 */
router.get('/available-addresses', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const addresses = {
      digilocker_address: null,
      experian_addresses: []
    };

    // Fetch Digilocker address from kyc_verifications
    try {
      const kycVerifications = await executeQuery(
        `SELECT verification_data 
         FROM kyc_verifications 
         WHERE user_id = ? AND kyc_method = 'digilocker'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (kycVerifications && kycVerifications.length > 0) {
        const verificationData = kycVerifications[0].verification_data;
        let kycData = null;

        if (typeof verificationData === 'string') {
          kycData = JSON.parse(verificationData);
        } else {
          kycData = verificationData;
        }

        // Extract address from Digilocker KYC data
        // Structure may vary, check common paths
        if (kycData) {
          const kycDataObj = kycData.kycData || kycData.data || kycData;
          
          // Check for address in various possible locations
          if (kycDataObj.address) {
            const addr = kycDataObj.address;
            addresses.digilocker_address = {
              address_line1: addr.address_line1 || addr.building_name || addr.line1 || '',
              address_line2: addr.address_line2 || addr.street_name || addr.line2 || '',
              city: addr.city || '',
              state: addr.state || '',
              pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || null
            };
          } else if (kycDataObj.aadhaar && kycDataObj.aadhaar.address) {
            const addr = kycDataObj.aadhaar.address;
            addresses.digilocker_address = {
              address_line1: addr.address_line1 || addr.building_name || addr.line1 || '',
              address_line2: addr.address_line2 || addr.street_name || addr.line2 || '',
              city: addr.city || '',
              state: addr.state || '',
              pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || null
            };
          }
        }
      }
    } catch (digilockerError) {
      console.error('Error fetching Digilocker address:', digilockerError);
      // Continue even if Digilocker fetch fails
    }

    // Fetch Experian addresses from credit_checks
    try {
      const creditChecks = await executeQuery(
        `SELECT full_report 
         FROM credit_checks 
         WHERE user_id = ? 
         ORDER BY checked_at DESC LIMIT 1`,
        [userId]
      );

      if (creditChecks && creditChecks.length > 0) {
        const fullReport = creditChecks[0].full_report;
        let reportData = null;

        if (typeof fullReport === 'string') {
          reportData = JSON.parse(fullReport);
        } else {
          reportData = fullReport;
        }

        // Extract addresses from Experian report
        // Experian may return multiple addresses
        if (reportData) {
          const addressesList = [];
          
          // Check for addresses in various possible locations
          if (reportData.addresses && Array.isArray(reportData.addresses)) {
            reportData.addresses.forEach((addr, index) => {
              addressesList.push({
                address_line1: addr.address_line1 || addr.line1 || addr.building_name || '',
                address_line2: addr.address_line2 || addr.line2 || addr.street_name || '',
                city: addr.city || '',
                state: addr.state || '',
                pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
                country: addr.country || 'India',
                full_address: addr.full_address || addr.complete_address || null,
                index: index + 1
              });
            });
          } else if (reportData.address) {
            // Single address
            const addr = reportData.address;
            addressesList.push({
              address_line1: addr.address_line1 || addr.line1 || addr.building_name || '',
              address_line2: addr.address_line2 || addr.line2 || addr.street_name || '',
              city: addr.city || '',
              state: addr.state || '',
              pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || null,
              index: 1
            });
          } else if (reportData.result && reportData.result.addresses) {
            // Nested in result
            if (Array.isArray(reportData.result.addresses)) {
              reportData.result.addresses.forEach((addr, index) => {
                addressesList.push({
                  address_line1: addr.address_line1 || addr.line1 || addr.building_name || '',
                  address_line2: addr.address_line2 || addr.line2 || addr.street_name || '',
                  city: addr.city || '',
                  state: addr.state || '',
                  pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
                  country: addr.country || 'India',
                  full_address: addr.full_address || addr.complete_address || null,
                  index: index + 1
                });
              });
            }
          }

          addresses.experian_addresses = addressesList;
        }
      }
    } catch (experianError) {
      console.error('Error fetching Experian addresses:', experianError);
      // Continue even if Experian fetch fails
    }

    // Also check digitap_responses for addresses
    try {
      const digitapResponses = await executeQuery(
        `SELECT response_data 
         FROM digitap_responses 
         WHERE user_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (digitapResponses && digitapResponses.length > 0) {
        const responseData = digitapResponses[0].response_data;
        let data = null;

        if (typeof responseData === 'string') {
          data = JSON.parse(responseData);
        } else {
          data = responseData;
        }

        // Extract address from Digitap response
        if (data && data.address) {
          const addr = Array.isArray(data.address) ? data.address[0] : data.address;
          
          // Add to Experian addresses if not already present
          const addrStr = JSON.stringify(addr);
          const exists = addresses.experian_addresses.some((a) => 
            JSON.stringify(a) === addrStr
          );
          
          if (!exists) {
            addresses.experian_addresses.push({
              address_line1: addr.address_line1 || addr.building_name || addr.line1 || '',
              address_line2: addr.address_line2 || addr.street_name || addr.line2 || '',
              city: addr.city || '',
              state: addr.state || '',
              pincode: addr.pincode || addr.postal_code || addr.pin_code || '',
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || null,
              index: addresses.experian_addresses.length + 1
            });
          }
        }
      }
    } catch (digitapError) {
      console.error('Error fetching Digitap address:', digitapError);
      // Continue even if Digitap fetch fails
    }

    res.json({
      success: true,
      data: addresses
    });

  } catch (error) {
    console.error('Get available addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available addresses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/user/residence-address
 * Save residence address and type
 */
router.post('/residence-address', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const {
      residence_type,
      source,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      country = 'India',
      full_address
    } = req.body;

    // Validation
    if (!residence_type || !['owned', 'rented'].includes(residence_type)) {
      return res.status(400).json({
        success: false,
        message: 'Residence type is required and must be "owned" or "rented"'
      });
    }

    if (!address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    // Validate pincode
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 6 digits'
      });
    }

    // Save residence type to users table
    await executeQuery(
      `UPDATE users 
       SET residence_type = ?, updated_at = NOW() 
       WHERE id = ?`,
      [residence_type, userId]
    );

    // Save address to addresses table (as current/residence address)
    const existingAddress = await executeQuery(
      `SELECT id FROM addresses 
       WHERE user_id = ? AND address_type = 'current'`,
      [userId]
    );

    if (existingAddress && existingAddress.length > 0) {
      // Update existing address
      await executeQuery(
        `UPDATE addresses 
         SET address_line1 = ?, 
             address_line2 = ?,
             city = ?,
             state = ?,
             pincode = ?,
             country = ?,
             is_primary = TRUE,
             updated_at = NOW()
         WHERE user_id = ? AND address_type = 'current'`,
        [address_line1, address_line2 || null, city, state, pincode, country, userId]
      );
    } else {
      // Insert new address
      await executeQuery(
        `INSERT INTO addresses 
         (user_id, address_type, address_line1, address_line2, city, state, pincode, country, is_primary, created_at, updated_at)
         VALUES (?, 'current', ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
        [userId, address_line1, address_line2 || null, city, state, pincode, country]
      );
    }

    // Also save to users table for quick access
    const addressString = full_address || `${address_line1}${address_line2 ? ', ' + address_line2 : ''}, ${city}, ${state} - ${pincode}`;
    await executeQuery(
      `UPDATE users 
       SET address_data = ?, 
           pincode = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [JSON.stringify({
        source,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        country,
        full_address: addressString
      }), pincode, userId]
    );

    // Check if user has a loan application, if not create one with "under_review" status
    const existingApplications = await executeQuery(
      `SELECT id, status FROM loan_applications 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    let applicationId = null;
    if (existingApplications && existingApplications.length > 0) {
      // Update existing application status to under_review
      applicationId = existingApplications[0].id;
      await executeQuery(
        `UPDATE loan_applications 
         SET status = 'under_review', updated_at = NOW() 
         WHERE id = ?`,
        [applicationId]
      );
    } else {
      // Create a new loan application with under_review status
      // Generate application number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const application_number = `PC${timestamp}${random}`;

      const result = await executeQuery(
        `INSERT INTO loan_applications 
         (user_id, application_number, status, created_at, updated_at)
         VALUES (?, ?, 'under_review', NOW(), NOW())`,
        [userId, application_number]
      );
      applicationId = result.insertId;
    }

    res.json({
      success: true,
      message: 'Residence address saved successfully',
      data: {
        residence_type,
        address: {
          address_line1,
          address_line2,
          city,
          state,
          pincode,
          country
        },
        application_id: applicationId
      }
    });

  } catch (error) {
    console.error('Save residence address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save residence address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

