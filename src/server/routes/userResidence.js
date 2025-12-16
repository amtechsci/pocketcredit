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

    // Helper function to extract address fields from any source (Experian, Digitap, etc.)
    const extractAddressFields = (addr) => {
      if (!addr || typeof addr !== 'object') return null;
      
      // Log all available fields for debugging
      console.log('📋 Address Raw Fields:', Object.keys(addr || {}));
      console.log('📋 Address Raw Values:', JSON.stringify(addr, null, 2));
      
      // Check all possible field name variations
      const addressLine1 = addr.address_line1 || addr.line1 || addr.building_name || addr.house || addr.house_number || 
                          addr.address1 || addr.street || addr.street_address || addr.building || 
                          addr.house_number || '';
      
      const addressLine2 = addr.address_line2 || addr.line2 || addr.street_name || addr.locality || addr.area || 
                          addr.address2 || addr.landmark || addr.area_name || addr.loc || '';
      
      const city = addr.city || addr.district || addr.town || addr.village || addr.vtc || '';
      
      const district = addr.dist || addr.district || '';
      
      const state = addr.state || addr.state_name || '';
      
      const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.postcode || addr.zip || addr.pc || '';
      
      const country = addr.country || 'India';
      
      // Build full address from all available fields
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
        let kycData = null;

        if (typeof verificationData === 'string') {
          kycData = JSON.parse(verificationData);
        } else {
          kycData = verificationData;
        }
        
        console.log('📋 Raw Digilocker KYC Data:', JSON.stringify(kycData, null, 2));

        // Extract address from Digilocker KYC data
        // Structure may vary, check common paths
        if (kycData) {
          const kycDataObj = kycData.kycData || kycData.data || kycData;
          
          // Check for address in various possible locations
          if (kycDataObj.address) {
            const addr = kycDataObj.address;
            
            // Digilocker uses specific field names: house, loc, vtc, dist, subdist, po, pc, state, country
            // Build address_line1 from house/house_number/building_name
            const addressLine1 = addr.address_line1 || addr.building_name || addr.line1 || addr.house || addr.house_number || '';
            
            // Build address_line2 from locality/loc/street_name/area
            const addressLine2 = addr.address_line2 || addr.street_name || addr.line2 || addr.locality || addr.loc || addr.area || '';
            
            // Build city from vtc (village/town/city) or city or district
            const city = addr.city || addr.vtc || addr.district || '';
            
            // Build district from dist
            const district = addr.dist || addr.district || '';
            
            // Build pincode from pc or pincode
            const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.pc || '';
            
            // Build full address from all available fields
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
            
            // Digilocker uses specific field names: house, loc, vtc, dist, subdist, po, pc, state, country
            // Build address_line1 from house/house_number/building_name
            const addressLine1 = addr.address_line1 || addr.building_name || addr.line1 || addr.house || addr.house_number || '';
            
            // Build address_line2 from locality/loc/street_name/area
            const addressLine2 = addr.address_line2 || addr.street_name || addr.line2 || addr.locality || addr.loc || addr.area || '';
            
            // Build city from vtc (village/town/city) or city or district
            const city = addr.city || addr.vtc || addr.district || '';
            
            // Build district from dist
            const district = addr.dist || addr.district || '';
            
            // Build pincode from pc or pincode
            const pincode = addr.pincode || addr.postal_code || addr.pin_code || addr.pc || '';
            
            // Build full address from all available fields
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
        
        console.log('📋 Raw Experian Report Data (Top Level Keys):', Object.keys(reportData || {}));
        console.log('📋 Raw Experian Report Data (Full):', JSON.stringify(reportData, null, 2));

        // Extract addresses from Experian report
        // Experian may return multiple addresses
        if (reportData) {
          const addressesList = [];
          
          // Check for addresses in various possible locations
          console.log('🔍 Checking for addresses in reportData.addresses:', !!reportData.addresses);
          console.log('🔍 Checking for addresses in reportData.address:', !!reportData.address);
          console.log('🔍 Checking for addresses in reportData.result:', !!reportData.result);
          console.log('🔍 Checking for addresses in reportData.data:', !!reportData.data);
          
          if (reportData.addresses && Array.isArray(reportData.addresses)) {
            console.log('✅ Found addresses array with', reportData.addresses.length, 'items');
            reportData.addresses.forEach((addr, index) => {
              const extractedAddr = extractAddressFields(addr);
              if (extractedAddr) {
                extractedAddr.index = index + 1;
                addressesList.push(extractedAddr);
              }
            });
          } else if (reportData.address) {
            console.log('✅ Found single address object');
            // Single address
            const addr = Array.isArray(reportData.address) ? reportData.address[0] : reportData.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          } else if (reportData.result && reportData.result.addresses) {
            // Nested in result
            if (Array.isArray(reportData.result.addresses)) {
              reportData.result.addresses.forEach((addr, index) => {
                const extractedAddr = extractAddressFields(addr);
                if (extractedAddr) {
                  extractedAddr.index = index + 1;
                  addressesList.push(extractedAddr);
                }
              });
            }
          } else if (reportData.result && reportData.result.address) {
            // Single address nested in result
            const addr = Array.isArray(reportData.result.address) ? reportData.result.address[0] : reportData.result.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          } else if (reportData.data && reportData.data.addresses) {
            // Nested in data
            if (Array.isArray(reportData.data.addresses)) {
              reportData.data.addresses.forEach((addr, index) => {
                const extractedAddr = extractAddressFields(addr);
                if (extractedAddr) {
                  extractedAddr.index = index + 1;
                  addressesList.push(extractedAddr);
                }
              });
            }
          } else if (reportData.data && reportData.data.address) {
            // Single address nested in data
            const addr = Array.isArray(reportData.data.address) ? reportData.data.address[0] : reportData.data.address;
            const extractedAddr = extractAddressFields(addr);
            if (extractedAddr) {
              extractedAddr.index = 1;
              addressesList.push(extractedAddr);
            }
          }
          
          // If still no addresses found, check for common Experian response structures
          if (addressesList.length === 0) {
            console.log('⚠️ No addresses found in standard locations, checking alternative fields...');
            // Check if address info is directly in the response
            const possibleAddressFields = ['address', 'addresses', 'current_address', 'permanent_address', 'residence_address'];
            for (const field of possibleAddressFields) {
              if (reportData[field]) {
                console.log(`✅ Found address in field: ${field}`);
                const addr = Array.isArray(reportData[field]) ? reportData[field][0] : reportData[field];
                const extractedAddr = extractAddressFields(addr);
                if (extractedAddr) {
                  extractedAddr.index = addressesList.length + 1;
                  addressesList.push(extractedAddr);
                }
                break;
              }
            }
            
            // Also check nested structures more deeply
            if (addressesList.length === 0 && reportData.result) {
              console.log('🔍 Checking nested result structure...');
              const resultKeys = Object.keys(reportData.result);
              console.log('📋 Result keys:', resultKeys);
              
              // Check if address is nested deeper
              for (const key of resultKeys) {
                if (typeof reportData.result[key] === 'object' && reportData.result[key] !== null) {
                  const nestedObj = reportData.result[key];
                  if (nestedObj.address || nestedObj.addresses || nestedObj.state || nestedObj.pincode) {
                    console.log(`✅ Found potential address in result.${key}`);
                    const addr = nestedObj.address || nestedObj.addresses?.[0] || nestedObj;
                    const extractedAddr = extractAddressFields(addr);
                    if (extractedAddr) {
                      extractedAddr.index = addressesList.length + 1;
                      addressesList.push(extractedAddr);
                    }
                    break;
                  }
                }
              }
            }
          }
          
          console.log(`📊 Total Experian addresses extracted: ${addressesList.length}`);

          addresses.experian_addresses = addressesList;
        }
      }
    } catch (experianError) {
      console.error('Error fetching Experian addresses:', experianError);
      // Continue even if Experian fetch fails
    }

    // Also check users.address_data and digitap_responses for addresses
    try {
      // Check users.address_data first
      const userData = await executeQuery(
        `SELECT address_data, pincode, state 
         FROM users 
         WHERE id = ?`,
        [userId]
      );

      if (userData && userData.length > 0 && userData[0].address_data) {
        let addressData = userData[0].address_data;
        
        if (typeof addressData === 'string') {
          addressData = JSON.parse(addressData);
        }
        
        console.log('📋 Users address_data:', JSON.stringify(addressData, null, 2));
        
        // address_data can be an array or object
        if (Array.isArray(addressData) && addressData.length > 0) {
          addressData.forEach((addr, index) => {
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

      // Check digitap_responses
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

        console.log('📋 Digitap response_data:', JSON.stringify(data, null, 2));

        // Extract address from Digitap response
        if (data && data.address) {
          const addr = Array.isArray(data.address) ? data.address[0] : data.address;
          const extractedAddr = extractAddressFields(addr);
          
          if (extractedAddr) {
            // Check if this address already exists
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
      // Continue even if fetch fails
    }

    // Log addresses for debugging - detailed output
    console.log('\n📋 ========== AVAILABLE ADDRESSES RESPONSE ==========');
    console.log('📋 Digilocker Address:', JSON.stringify(addresses.digilocker_address, null, 2));
    console.log('📋 Experian Addresses Count:', addresses.experian_addresses?.length || 0);
    addresses.experian_addresses?.forEach((addr, idx) => {
      console.log(`📋 Experian Address ${idx + 1}:`, JSON.stringify(addr, null, 2));
    });
    console.log('📋 Full Addresses Object:', JSON.stringify(addresses, null, 2));
    console.log('📋 ====================================================\n');
    
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

/**
 * POST /api/user/additional-information
 * Save marital status, spoken language, and work experience
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

    // Validation
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

    // Convert work experience to years (for database storage)
    let work_experience_years = null;
    if (work_experience === '0-2') {
      work_experience_years = 1; // Average of 0-2
    } else if (work_experience === '2-5') {
      work_experience_years = 3; // Average of 2-5
    } else if (work_experience === '5-8') {
      work_experience_years = 6; // Average of 5-8
    } else if (work_experience === '8+') {
      work_experience_years = 10; // Default for 8+
    }

    // Check if columns exist before updating
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

    // Add spoken_language if column exists
    if (existingColumns.includes('spoken_language')) {
      updateFields.push('spoken_language = ?');
      updateValues.push(spoken_language);
    }

    // Add work_experience_range if column exists
    if (existingColumns.includes('work_experience_range')) {
      updateFields.push('work_experience_range = ?');
      updateValues.push(work_experience);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    // Update users table
    await executeQuery(
      `UPDATE users 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );

    // Note: work_experience_range is saved to users table above
    // Note: Employment details are now stored in employment_details table only (user-specific)
    // is a user-level field, not employment-details-specific

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

