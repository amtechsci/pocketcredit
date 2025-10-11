const Joi = require('joi');
const { updateProfileById, getProfileSummary } = require('../models/user');
const { createOrUpdateAddress, getPrimaryAddress } = require('../models/address');
const { createOrUpdateVerificationRecord } = require('../models/verification');
const { executeQuery } = require('../config/database');

/**
 * User Controller
 * Handles user profile management and updates
 */

// Validation schemas
const basicProfileSchema = Joi.object({
  full_name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Full name must be at least 3 characters long',
    'string.max': 'Full name must not exceed 100 characters',
    'any.required': 'Full name as per PAN Card is required'
  }),
  pan_number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
    'string.pattern.base': 'PAN number must be in valid format (e.g., ABCDE1234F)',
    'any.required': 'PAN number is required'
  }),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required().messages({
    'string.pattern.base': 'Pincode must be a valid 6-digit Indian pincode',
    'any.required': 'Pincode is required'
  }),
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Invalid latitude',
    'number.max': 'Invalid latitude',
    'any.required': 'Location access is required. Please enable location permissions.'
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Invalid longitude',
    'number.max': 'Invalid longitude',
    'any.required': 'Location access is required. Please enable location permissions.'
  }),
  date_of_birth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required'
  })
});

const additionalProfileSchema = Joi.object({
  // Current Address fields
  current_address_line1: Joi.string().min(5).max(255).required().messages({
    'string.min': 'Current address must be at least 5 characters long',
    'string.max': 'Current address must not exceed 255 characters',
    'any.required': 'Current address is required'
  }),
  current_address_line2: Joi.string().max(255).optional().allow(''),
  current_city: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Current city must be at least 2 characters long',
    'string.max': 'Current city must not exceed 100 characters',
    'any.required': 'Current city is required'
  }),
  current_state: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Current state must be at least 2 characters long',
    'string.max': 'Current state must not exceed 100 characters',
    'any.required': 'Current state is required'
  }),
  current_pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required().messages({
    'string.pattern.base': 'Current pincode must be a valid 6-digit Indian pincode',
    'any.required': 'Current pincode is required'
  }),
  current_country: Joi.string().default('India'),
  
  // Permanent Address fields
  permanent_address_line1: Joi.string().min(5).max(255).required().messages({
    'string.min': 'Permanent address must be at least 5 characters long',
    'string.max': 'Permanent address must not exceed 255 characters',
    'any.required': 'Permanent address is required'
  }),
  permanent_address_line2: Joi.string().max(255).optional().allow(''),
  permanent_city: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Permanent city must be at least 2 characters long',
    'string.max': 'Permanent city must not exceed 100 characters',
    'any.required': 'Permanent city is required'
  }),
  permanent_state: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Permanent state must be at least 2 characters long',
    'string.max': 'Permanent state must not exceed 100 characters',
    'any.required': 'Permanent state is required'
  }),
  permanent_pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required().messages({
    'string.pattern.base': 'Permanent pincode must be a valid 6-digit Indian pincode',
    'any.required': 'Permanent pincode is required'
  }),
  permanent_country: Joi.string().default('India'),
  
  
  // PAN number (stored in users table)
  pan_number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
    'string.pattern.base': 'PAN number must be in valid format (e.g., ABCDE1234F)',
    'any.required': 'PAN number is required'
  })
});

/**
 * Update basic profile details (Step 2)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBasicProfile = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Validate request body
    const { error, value } = basicProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Split full name into first_name and last_name
    const nameParts = value.full_name.trim().split(/\s+/);
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || nameParts[0]; // If no last name, use first name

    // Get user's employment type
    const userQuery = 'SELECT employment_type FROM users WHERE id = ?';
    const userResult = await executeQuery(userQuery, [userId]);
    const employmentType = userResult[0]?.employment_type;

    // Calculate user's age from date of birth
    const birthDate = new Date(value.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      // Haven't had birthday this year yet
      age--;
    }
    
    // Age validation based on employment type
    if (employmentType === 'salaried') {
      // Salaried: Age must be 45 or below
      if (age > 45) {
        // Hold application permanently
        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', 'Age limit exceeded for salaried applicants', userId]
        );

        return res.status(200).json({
          status: 'success',
          message: 'Application has been placed on hold due to age restrictions',
          data: {
            hold_reason: 'Age limit exceeded for salaried applicants (must be 45 or below)',
            hold_permanent: true,
            user_age: age
          }
        });
      }
    } else if (employmentType === 'student') {
      // Student: Age must be 19 or above
      if (age < 19) {
        // Calculate when they will turn 19
        const turn19Date = new Date(birthDate);
        turn19Date.setFullYear(birthDate.getFullYear() + 19);
        
        // Hold until they turn 19
        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, hold_until_date = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', 'Age requirement not met for students', turn19Date, userId]
        );

        return res.status(200).json({
          status: 'success',
          message: 'Application will be held until you turn 19 years old',
          data: {
            hold_reason: 'Age requirement not met (must be 19 or above for students)',
            hold_until: turn19Date,
            user_age: age,
            turn_19_date: turn19Date
          }
        });
      }
    } else {
      // For other employment types, use generic age validation
      const configs = await executeQuery('SELECT config_key, config_value FROM eligibility_config WHERE config_key IN (?, ?)', ['min_age_years', 'max_age_years']);
      const criteria = {};
      configs.forEach(c => {
        criteria[c.config_key] = c.config_value;
      });

      const minAge = parseInt(criteria.min_age_years || '18');
      const maxAge = parseInt(criteria.max_age_years || '65');
      
      if (age < minAge) {
        return res.status(400).json({
          status: 'error',
          message: `You must be at least ${minAge} years old to apply for a loan`
        });
      }

      if (age > maxAge) {
        return res.status(400).json({
          status: 'error',
          message: `Maximum age limit for loan application is ${maxAge} years`
        });
      }
    }

    // Check PAN uniqueness in verification_records
    const panCheckQuery = 'SELECT user_id FROM verification_records WHERE document_type = ? AND document_number = ? AND user_id != ?';
    const existingPAN = await executeQuery(panCheckQuery, ['pan', value.pan_number.toUpperCase(), userId]);
    if (existingPAN.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'PAN number is already registered with another account'
      });
    }

    // Combine latitude and longitude into latlong format
    const latlong = `${value.latitude},${value.longitude}`;

    // Determine next step based on employment type
    let nextStep = 'dashboard';
    let profileCompleted = true;
    let stepCompleted = 'basic_details';
    let message = 'Profile completed successfully! You can now apply for a loan.';

    if (employmentType === 'student') {
      // Students need to complete Step 3 (college info)
      nextStep = 'college_details';
      profileCompleted = false;
      stepCompleted = 'basic_details';
      message = 'Basic information completed! Please provide your college details.';
    }

    // Prepare update data with split names, pincode, location
    const updateData = {
      first_name,
      last_name,
      pincode: value.pincode,
      latlong,
      date_of_birth: value.date_of_birth,
      profile_completion_step: employmentType === 'student' ? 3 : 2, // Step 3 for students, Step 2 for others
      profile_completed: profileCompleted
    };

    // Update user profile
    const updatedUser = await updateProfileById(userId, updateData);

    // Save PAN in verification_records table
    await executeQuery(`
      INSERT INTO verification_records (user_id, document_type, document_number, verification_status, created_at, updated_at)
      VALUES (?, 'pan', ?, 'pending', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        document_number = VALUES(document_number),
        updated_at = NOW()
    `, [userId, value.pan_number.toUpperCase()]);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get profile summary
    const profileSummary = await getProfileSummary(updatedUser);

    res.json({
      status: 'success',
      message: message,
      data: {
        user: profileSummary,
        next_step: nextStep,
        step_completed: stepCompleted,
        profile_completed: profileCompleted
      }
    });

  } catch (error) {
    console.error('Update basic profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update basic profile'
    });
  }
};

/**
 * Update additional profile details (Step 3)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAdditionalProfile = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Validate request body
    const { error, value } = additionalProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Check PAN number uniqueness
    const panCheckQuery = 'SELECT id FROM verification_records WHERE document_number = ? AND user_id != ?';
    const existingPAN = await executeQuery(panCheckQuery, [value.pan_number, userId]);
    if (existingPAN.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'PAN number is already registered with another account'
      });
    }

    // Separate address data and PAN number
    const { 
      pan_number, 
      current_address_line1,
      current_address_line2,
      current_city,
      current_state,
      current_pincode,
      current_country,
      permanent_address_line1,
      permanent_address_line2,
      permanent_city,
      permanent_state,
      permanent_pincode,
      permanent_country,
      ...rest 
    } = value;

    // Update user profile with completion step (PAN goes to verification_records)
    const userUpdateData = {
      profile_completion_step: 4, // Move to employment details step
      profile_completed: false // Not complete yet, still need employment details
    };

    const updatedUser = await updateProfileById(userId, userUpdateData);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Prepare current address data
    const currentAddressData = {
      address_line1: current_address_line1,
      address_line2: current_address_line2,
      city: current_city,
      state: current_state,
      pincode: current_pincode,
      country: current_country
    };

    // Prepare permanent address data
    const permanentAddressData = {
      address_line1: permanent_address_line1,
      address_line2: permanent_address_line2,
      city: permanent_city,
      state: permanent_state,
      pincode: permanent_pincode,
      country: permanent_country
    };

    // Create or update addresses in addresses table
    const currentAddress = await createOrUpdateAddress(userId, currentAddressData, 'current');
    const permanentAddress = await createOrUpdateAddress(userId, permanentAddressData, 'permanent');

    // Create or update PAN verification record
    const panVerification = await createOrUpdateVerificationRecord(userId, 'pan', pan_number);

    // Get profile summary
    const profileSummary = await getProfileSummary(updatedUser);

    res.json({
      status: 'success',
      message: 'Additional details saved successfully',
      data: {
        user: profileSummary,
        addresses: {
          current: currentAddress,
          permanent: permanentAddress
        },
        verification: {
          pan: panVerification
        },
        profile_completed: false,
        next_step: 'employment_details',
        step_completed: 'additional_details'
      }
    });

  } catch (error) {
    console.error('Update additional profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update additional profile'
    });
  }
};

/**
 * Get profile completion status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfileStatus = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const { findUserById } = require('../models/user');
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const profileSummary = await getProfileSummary(user);

    // Determine current step and next step
    let currentStep = user.profile_completion_step || 0;
    let nextStep = null;
    let stepName = '';

    switch (currentStep) {
      case 0:
        stepName = 'incomplete';
        nextStep = 'basic_details';
        break;
      case 1:
        stepName = 'otp_verified';
        nextStep = 'basic_details';
        break;
      case 2:
        stepName = 'basic_details';
        nextStep = 'additional_details';
        break;
      case 3:
        stepName = 'additional_details';
        nextStep = 'employment_details';
        break;
      case 4:
        stepName = 'employment_details';
        nextStep = 'complete';
        break;
      case 5:
        stepName = 'complete';
        nextStep = null;
        break;
      default:
        stepName = 'unknown';
        nextStep = 'basic_details';
    }

    res.json({
      status: 'success',
      data: {
        user: profileSummary,
        profile_status: {
          current_step: currentStep,
          step_name: stepName,
          next_step: nextStep,
          is_complete: currentStep >= 5,
          progress_percentage: Math.min((currentStep / 5) * 100, 100)
        }
      }
    });

  } catch (error) {
    console.error('Get profile status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get profile status'
    });
  }
};

/**
 * Update student profile details (Step 3 for students)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateStudentProfile = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const { college_name, graduation_status } = req.body;

    // Validate required fields
    if (!college_name || !graduation_status) {
      return res.status(400).json({
        status: 'error',
        message: 'College name and graduation status are required'
      });
    }

    // Validate graduation status
    if (!['graduated', 'not_graduated'].includes(graduation_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid graduation status'
      });
    }

    // Update user profile with student details
    const updateData = {
      college_name,
      graduation_status,
      profile_completion_step: 2, // Complete the profile
      profile_completed: true // Mark profile as completed
    };

    const updatedUser = await updateProfileById(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get profile summary
    const profileSummary = await getProfileSummary(updatedUser);

    res.json({
      status: 'success',
      message: 'Student profile completed successfully!',
      data: {
        user: profileSummary,
        next_step: 'dashboard',
        profile_completed: true
      }
    });

  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update student profile'
    });
  }
};

module.exports = {
  updateBasicProfile,
  updateAdditionalProfile,
  updateStudentProfile,
  getProfileStatus
};
