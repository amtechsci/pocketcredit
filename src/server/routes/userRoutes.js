const express = require('express');
const { updateBasicProfile, updateAdditionalProfile, updateStudentProfile, updateGraduationStatus, getProfileStatus, updateAdditionalDetails } = require('../controllers/userController');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const { executeQuery, initializeDatabase } = require('../config/database');

const router = express.Router();

/**
 * ============================================================================
 * USER ROUTES - Consolidated User Management
 * ============================================================================
 * All user-related endpoints are organized by feature area
 */

// ============================================================================
// PROFILE ROUTES
// ============================================================================

/**
 * @route   PUT /api/user/profile/basic
 * @desc    Update basic profile details (Step 2)
 * @access  Private
 */
router.put('/profile/basic', requireAuth, checkHoldStatus, updateBasicProfile);

/**
 * @route   PUT /api/user/profile/additional
 * @desc    Update additional profile details (Step 3)
 * @access  Private
 */
router.put('/profile/additional', requireAuth, checkHoldStatus, updateAdditionalProfile);

/**
 * @route   PUT /api/user/profile/student
 * @desc    Update student profile details (Step 3 for students)
 * @access  Private
 */
router.put('/profile/student', requireAuth, checkHoldStatus, updateStudentProfile);

/**
 * @route   GET /api/user/profile/status
 * @desc    Get profile completion status
 * @access  Private
 */
router.get('/profile/status', requireAuth, getProfileStatus);

/**
 * @route   PUT /api/user/profile/additional-details
 * @desc    Update additional details (email, marital status, salary date)
 * @access  Private
 */
router.put('/profile/additional-details', requireAuth, checkHoldStatus, updateAdditionalDetails);

// ============================================================================
// ADDRESS ROUTES
// ============================================================================

/**
 * @route   GET /api/user/addresses/available
 * @route   GET /api/user/available-addresses (backward compatibility)
 * @desc    Get available addresses from Experian, Digilocker, and Digitap responses
 * @access  Private
 */
const getAvailableAddresses = async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const addresses = {
      digilocker_address: null,
      experian_addresses: []
    };

    // Helper function to extract address fields from any source
    const extractAddressFields = (addr) => {
      if (!addr || typeof addr !== 'object') return null;
      
      const addressLine1 = addr.address_line1 || addr.line1 || addr.building_name || addr.house || addr.house_number || 
                          addr.address1 || addr.street || addr.street_address || addr.building || '';
      const addressLine2 = addr.address_line2 || addr.line2 || addr.street_name || addr.locality || addr.area || 
                          addr.address2 || addr.landmark || addr.area_name || addr.loc || '';
      const city = addr.city || addr.district || addr.town || addr.village || addr.vtc || '';
      const district = addr.dist || addr.district || '';
      const state = addr.state || addr.state_name || '';
      const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.postcode || addr.zip || addr.pc || '';
      const country = addr.country || 'India';
      
      const addressParts = [];
      if (addressLine1) addressParts.push(addressLine1);
      if (addressLine2) addressParts.push(addressLine2);
      if (city) addressParts.push(city);
      if (district && district !== city) addressParts.push(district);
      if (state) addressParts.push(state);
      if (pincode) addressParts.push(pincode);
      if (country && country !== 'India') addressParts.push(country);
      
      return {
        address_line1: addressLine1,
        address_line2: addressLine2,
        city: city,
        state: state,
        pincode: pincode,
        country: country,
        full_address: addr.full_address || addr.complete_address || addr.address || 
                    (addressParts.length > 0 ? addressParts.join(', ') : null)
      };
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
        let kycData = typeof verificationData === 'string' ? JSON.parse(verificationData) : verificationData;
        
        if (kycData) {
          const kycDataObj = kycData.kycData || kycData.data || kycData;
          
          if (kycDataObj.address) {
            const addr = kycDataObj.address;
            const addressLine1 = addr.address_line1 || addr.building_name || addr.line1 || addr.house || addr.house_number || '';
            const addressLine2 = addr.address_line2 || addr.street_name || addr.line2 || addr.locality || addr.loc || addr.area || '';
            const city = addr.city || addr.vtc || addr.district || '';
            const district = addr.dist || addr.district || '';
            const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.pc || '';
            
            const addressParts = [];
            if (addressLine1) addressParts.push(addressLine1);
            if (addressLine2) addressParts.push(addressLine2);
            if (city) addressParts.push(city);
            if (district && district !== city) addressParts.push(district);
            if (addr.subdist && addr.subdist !== city && addr.subdist !== district) addressParts.push(addr.subdist);
            if (addr.state) addressParts.push(addr.state);
            if (pincode) addressParts.push(pincode);
            if (addr.country && addr.country !== 'India') addressParts.push(addr.country);
            
            addresses.digilocker_address = {
              address_line1: addressLine1,
              address_line2: addressLine2,
              city: city,
              state: addr.state || '',
              pincode: pincode,
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || (addressParts.length > 0 ? addressParts.join(', ') : null)
            };
          } else if (kycDataObj.aadhaar && kycDataObj.aadhaar.address) {
            const addr = kycDataObj.aadhaar.address;
            const addressLine1 = addr.address_line1 || addr.building_name || addr.line1 || addr.house || addr.house_number || '';
            const addressLine2 = addr.address_line2 || addr.street_name || addr.line2 || addr.locality || addr.loc || addr.area || '';
            const city = addr.city || addr.vtc || addr.district || '';
            const district = addr.dist || addr.district || '';
            const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.pc || '';
            
            const addressParts = [];
            if (addressLine1) addressParts.push(addressLine1);
            if (addressLine2) addressParts.push(addressLine2);
            if (city) addressParts.push(city);
            if (district && district !== city) addressParts.push(district);
            if (addr.subdist && addr.subdist !== city && addr.subdist !== district) addressParts.push(addr.subdist);
            if (addr.state) addressParts.push(addr.state);
            if (pincode) addressParts.push(pincode);
            if (addr.country && addr.country !== 'India') addressParts.push(addr.country);
            
            addresses.digilocker_address = {
              address_line1: addressLine1,
              address_line2: addressLine2,
              city: city,
              state: addr.state || '',
              pincode: pincode,
              country: addr.country || 'India',
              full_address: addr.full_address || addr.complete_address || (addressParts.length > 0 ? addressParts.join(', ') : null)
            };
          }
        }
      }
    } catch (digilockerError) {
      console.error('Error fetching Digilocker address:', digilockerError);
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
        let reportData = typeof fullReport === 'string' ? JSON.parse(fullReport) : fullReport;
        
        if (reportData) {
          const addressesList = [];
          
          if (reportData.addresses && Array.isArray(reportData.addresses)) {
            reportData.addresses.forEach((addr, index) => {
              const extractedAddr = extractAddressFields(addr);
              if (extractedAddr) {
                extractedAddr.index = index + 1;
                addressesList.push(extractedAddr);
              }
            });
          } else if (reportData.address) {
            const addr = Array.isArray(reportData.address) ? reportData.address[0] : reportData.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          } else if (reportData.result?.addresses) {
            if (Array.isArray(reportData.result.addresses)) {
              reportData.result.addresses.forEach((addr, index) => {
                const extractedAddr = extractAddressFields(addr);
                if (extractedAddr) {
                  extractedAddr.index = index + 1;
                  addressesList.push(extractedAddr);
                }
              });
            }
          } else if (reportData.result?.address) {
            const addr = Array.isArray(reportData.result.address) ? reportData.result.address[0] : reportData.result.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          } else if (reportData.data?.addresses) {
            if (Array.isArray(reportData.data.addresses)) {
              reportData.data.addresses.forEach((addr, index) => {
                const extractedAddr = extractAddressFields(addr);
                if (extractedAddr) {
                  extractedAddr.index = index + 1;
                  addressesList.push(extractedAddr);
                }
              });
            }
          } else if (reportData.data?.address) {
            const addr = Array.isArray(reportData.data.address) ? reportData.data.address[0] : reportData.data.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          }
          
          addresses.experian_addresses = addressesList;
        }
      }
    } catch (experianError) {
      console.error('Error fetching Experian addresses:', experianError);
    }

    // Check users.address_data and digitap_responses for addresses
    try {
      const userData = await executeQuery(
        `SELECT address_data, pincode, state 
         FROM users 
         WHERE id = ?`,
        [userId]
      );

      if (userData && userData.length > 0 && userData[0].address_data) {
        let addressData = userData[0].address_data;
        addressData = typeof addressData === 'string' ? JSON.parse(addressData) : addressData;
        
        if (Array.isArray(addressData) && addressData.length > 0) {
          addressData.forEach((addr) => {
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = addresses.experian_addresses.length + 1;
              addresses.experian_addresses.push(extractedAddr);
            }
          });
        } else if (addressData && typeof addressData === 'object') {
          const extractedAddr = extractAddressFields(addressData);
          if (extractedAddr) {
            extractedAddr.index = addresses.experian_addresses.length + 1;
            addresses.experian_addresses.push(extractedAddr);
          }
        }
      }

      const digitapResponses = await executeQuery(
        `SELECT response_data 
         FROM digitap_responses 
         WHERE user_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (digitapResponses && digitapResponses.length > 0) {
        const responseData = digitapResponses[0].response_data;
        let data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;

        if (data?.address) {
          const addr = Array.isArray(data.address) ? data.address[0] : data.address;
          const extractedAddr = extractAddressFields(addr);
          
          if (extractedAddr) {
            const exists = addresses.experian_addresses.some((a) => 
              a.state === extractedAddr.state && 
              a.pincode === extractedAddr.pincode &&
              a.city === extractedAddr.city
            );
            
            if (!exists) {
              extractedAddr.index = addresses.experian_addresses.length + 1;
              addresses.experian_addresses.push(extractedAddr);
            }
          }
        }
      }
    } catch (digitapError) {
      console.error('Error fetching Digitap/user address:', digitapError);
    }

    // Fetch all addresses from addresses table
    try {
      const dbAddresses = await executeQuery(
        `SELECT id, address_type, address_line1, address_line2, city, state, pincode, country, source, source_reference, is_primary
         FROM addresses 
         WHERE user_id = ? AND address_type = 'permanent'
         ORDER BY is_primary DESC, created_at DESC`,
        [userId]
      );

      if (dbAddresses && dbAddresses.length > 0) {
        dbAddresses.forEach((dbAddr) => {
          const formattedAddr = {
            id: dbAddr.id,
            address_line1: dbAddr.address_line1 || '',
            address_line2: dbAddr.address_line2 || '',
            city: dbAddr.city || '',
            state: dbAddr.state || '',
            pincode: dbAddr.pincode || '',
            country: dbAddr.country || 'India',
            source: dbAddr.source || 'unknown',
            source_reference: dbAddr.source_reference || null,
            is_primary: dbAddr.is_primary || 0
          };

          const addressParts = [];
          if (formattedAddr.address_line1) addressParts.push(formattedAddr.address_line1);
          if (formattedAddr.address_line2) addressParts.push(formattedAddr.address_line2);
          if (formattedAddr.city) addressParts.push(formattedAddr.city);
          if (formattedAddr.state) addressParts.push(formattedAddr.state);
          if (formattedAddr.pincode) addressParts.push(formattedAddr.pincode);
          if (formattedAddr.country && formattedAddr.country !== 'India') addressParts.push(formattedAddr.country);
          formattedAddr.full_address = addressParts.length > 0 ? addressParts.join(', ') : null;

          if (dbAddr.source === 'digilocker') {
            if (!addresses.digilocker_address) {
              addresses.digilocker_address = formattedAddr;
            } else {
              addresses.experian_addresses.push({
                ...formattedAddr,
                label: `Address from ${dbAddr.source} (ID: ${dbAddr.id})`
              });
            }
          } else {
            addresses.experian_addresses.push({
              ...formattedAddr,
              label: `Address from ${dbAddr.source === 'pan_api' ? 'PAN API' : dbAddr.source}`
            });
          }
        });
      }
    } catch (dbAddressError) {
      console.error('Error fetching addresses from addresses table:', dbAddressError);
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
};

router.get('/addresses/available', requireAuth, getAvailableAddresses);
router.get('/available-addresses', requireAuth, getAvailableAddresses); // Backward compatibility

/**
 * @route   POST /api/user/addresses/residence
 * @route   POST /api/user/residence-address (backward compatibility)
 * @desc    Save residence address and type
 * @access  Private
 */
const saveResidenceAddress = async (req, res) => {
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

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 6 digits'
      });
    }

    await executeQuery(
      `UPDATE users 
       SET residence_type = ?, updated_at = NOW() 
       WHERE id = ?`,
      [residence_type, userId]
    );

    const existingAddress = await executeQuery(
      `SELECT id FROM addresses 
       WHERE user_id = ? AND address_type = 'current'`,
      [userId]
    );

    if (existingAddress && existingAddress.length > 0) {
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
      await executeQuery(
        `INSERT INTO addresses 
         (user_id, address_type, address_line1, address_line2, city, state, pincode, country, is_primary, created_at, updated_at)
         VALUES (?, 'current', ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
        [userId, address_line1, address_line2 || null, city, state, pincode, country]
      );
    }

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

    const existingApplications = await executeQuery(
      `SELECT id, status FROM loan_applications 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    let applicationId = null;
    if (existingApplications && existingApplications.length > 0) {
      applicationId = existingApplications[0].id;
      await executeQuery(
        `UPDATE loan_applications 
         SET status = 'under_review', updated_at = NOW() 
         WHERE id = ?`,
        [applicationId]
      );
    } else {
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
};

router.post('/addresses/residence', requireAuth, saveResidenceAddress);
router.post('/residence-address', requireAuth, saveResidenceAddress); // Backward compatibility

// ============================================================================
// LOAN PLAN ROUTES
// ============================================================================

/**
 * @route   PUT /api/user/loan-plan
 * @route   PUT /api/user/selected-loan-plan (backward compatibility)
 * @desc    Update user's selected loan plan
 * @access  Private
 */
const updateSelectedLoanPlan = async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'plan_id is required'
      });
    }

    const plans = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan plan not found or inactive'
      });
    }

    await executeQuery(
      'UPDATE users SET selected_loan_plan_id = ?, updated_at = NOW() WHERE id = ?',
      [plan_id, userId]
    );

    res.json({
      status: 'success',
      message: 'Loan plan selected successfully',
      data: { plan_id }
    });
  } catch (error) {
    console.error('Update selected loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update selected loan plan'
    });
  }
};

router.put('/loan-plan', requireAuth, updateSelectedLoanPlan);
router.put('/selected-loan-plan', requireAuth, updateSelectedLoanPlan); // Backward compatibility

/**
 * @route   GET /api/user/loan-plan
 * @route   GET /api/user/selected-loan-plan (backward compatibility)
 * @desc    Get user's selected loan plan
 * @access  Private
 */
const getSelectedLoanPlan = async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const users = await executeQuery(
      `SELECT u.selected_loan_plan_id 
       FROM users u 
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    let planId = user.selected_loan_plan_id;

    if (!planId) {
      const defaultPlans = await executeQuery(
        'SELECT id FROM loan_plans WHERE is_default = 1 AND is_active = 1 LIMIT 1'
      );
      if (defaultPlans.length > 0) {
        planId = defaultPlans[0].id;
      }
    }

    if (!planId) {
      return res.status(404).json({
        status: 'error',
        message: 'No loan plan available'
      });
    }

    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE id = ?',
      [planId]
    );

    res.json({
      status: 'success',
      data: {
        plan: plans[0] || null,
        is_user_selected: user.selected_loan_plan_id === planId,
        is_system_default: !user.selected_loan_plan_id
      }
    });
  } catch (error) {
    console.error('Get selected loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get selected loan plan'
    });
  }
};

router.get('/loan-plan', requireAuth, getSelectedLoanPlan);
router.get('/selected-loan-plan', requireAuth, getSelectedLoanPlan); // Backward compatibility

// ============================================================================
// ADDITIONAL INFORMATION ROUTES
// ============================================================================

/**
 * @route   PUT /api/user/graduation-status
 * @desc    Update graduation status for students (Upsell feature)
 * @access  Private
 */
router.put('/graduation-status', requireAuth, updateGraduationStatus);

/**
 * @route   POST /api/user/additional-information
 * @desc    Save marital status, spoken language, and work experience
 * @access  Private
 */
router.post('/additional-information', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const {
      marital_status,
      spoken_language,
      work_experience
    } = req.body;

    if (!marital_status || !['single', 'married', 'divorced', 'widow'].includes(marital_status)) {
      return res.status(400).json({
        success: false,
        message: 'Marital status is required and must be one of: single, married, divorced, widow'
      });
    }

    if (!spoken_language || spoken_language.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Spoken language is required'
      });
    }

    if (!work_experience || !['0-2', '2-5', '5-8', '8+'].includes(work_experience)) {
      return res.status(400).json({
        success: false,
        message: 'Work experience is required and must be one of: 0-2, 2-5, 5-8, 8+'
      });
    }

    const checkColumns = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME IN ('spoken_language', 'work_experience_range')
    `);

    const existingColumns = checkColumns.map(row => row.COLUMN_NAME);
    const updateFields = ['marital_status = ?'];
    const updateValues = [marital_status];

    if (existingColumns.includes('spoken_language')) {
      updateFields.push('spoken_language = ?');
      updateValues.push(spoken_language);
    }

    if (existingColumns.includes('work_experience_range')) {
      updateFields.push('work_experience_range = ?');
      updateValues.push(work_experience);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    await executeQuery(
      `UPDATE users 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Additional information saved successfully'
    });

  } catch (error) {
    console.error('Save additional information error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save additional information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
