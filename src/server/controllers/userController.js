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
  first_name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name must not exceed 50 characters',
    'any.required': 'First name is required'
  }),
  last_name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name must not exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  date_of_birth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required'
  }),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  marital_status: Joi.string().valid('single', 'married', 'divorced', 'widowed').optional()
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

    // Check email uniqueness
    const emailCheckQuery = 'SELECT id FROM users WHERE email = ? AND id != ?';
    const existingEmail = await executeQuery(emailCheckQuery, [value.email, userId]);
    if (existingEmail.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Email address is already registered with another account'
      });
    }

    // Check age requirement (18+)
    const birthDate = new Date(value.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      // Haven't had birthday this year yet
      age--;
    }
    
    if (age < 18) {
      return res.status(400).json({
        status: 'error',
        message: 'You must be at least 18 years old to register'
      });
    }

    // Prepare update data
    const updateData = {
      ...value,
      profile_completion_step: 3 // Move to step 3 after basic details
    };

    // Update user profile
    const updatedUser = await updateProfileById(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get profile summary
    const profileSummary = getProfileSummary(updatedUser);

    res.json({
      status: 'success',
      message: 'Basic profile updated successfully',
      data: {
        user: profileSummary,
        next_step: 'additional_details',
        step_completed: 'basic_details'
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
    const profileSummary = getProfileSummary(updatedUser);

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

    const profileSummary = getProfileSummary(user);

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

module.exports = {
  updateBasicProfile,
  updateAdditionalProfile,
  getProfileStatus
};
