const Joi = require('joi');
const { updateProfileById, getProfileSummary } = require('../models/user');
const { createOrUpdateAddress, getPrimaryAddress } = require('../models/address');
const { createOrUpdateVerificationRecord } = require('../models/verification');
const { executeQuery } = require('../config/database');
const { invalidateUserCache } = require('./dashboardController');

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
  email: Joi.string().email().allow('').optional(),
  pan_number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
    'string.pattern.base': 'PAN number must be in valid format (e.g., ABCDE1234F)',
    'any.required': 'PAN number is required'
  }),
  gender: Joi.string().valid('male', 'female', 'other').required().messages({
    'any.only': 'Gender must be male, female, or other',
    'any.required': 'Gender is required'
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

    // Get first_name and last_name from request (no need to split)
    const first_name = value.first_name;
    const last_name = value.last_name;

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

    // Prepare update data with names, gender, location
    const updateData = {
      first_name,
      last_name,
      gender: value.gender,
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

    const { date_of_birth, college_name, graduation_status } = req.body;

    // Validate required fields
    if (!date_of_birth || !college_name || !graduation_status) {
      return res.status(400).json({
        status: 'error',
        message: 'Date of birth, college name and graduation status are required'
      });
    }

    // Validate graduation status
    if (!['graduated', 'not_graduated'].includes(graduation_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid graduation status'
      });
    }

    // Age validation for students
    const dob = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    // If student is less than 19 years old, apply temporary hold
    if (age < 19) {
      // Calculate date when user turns 19
      const turnNineteenDate = new Date(dob);
      turnNineteenDate.setFullYear(turnNineteenDate.getFullYear() + 19);
      
      await executeQuery(`
        UPDATE users 
        SET 
          date_of_birth = ?,
          status = 'on_hold',
          eligibility_status = 'age_restriction',
          application_hold_reason = ?,
          hold_until_date = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        date_of_birth,
        `You must be at least 19 years old to apply for a student loan. Your application will be automatically reviewed when you turn 19 on ${turnNineteenDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        turnNineteenDate,
        userId
      ]);

      console.log(`🚫 Student age hold applied for user ${userId}: Age ${age}, hold until ${turnNineteenDate.toISOString()}`);

      // Get updated user
      const users = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
      const updatedUser = users[0];
      const profileSummary = await getProfileSummary(updatedUser);

      return res.json({
        status: 'success',
        message: 'You must be at least 19 years old to apply',
        data: {
          user: profileSummary,
          hold_until: turnNineteenDate.toISOString(),
          hold_reason: `You must be at least 19 years old to apply for a student loan. Please reapply after ${turnNineteenDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          age_restriction: true
        }
      });
    }

    // If age is 19 or above, proceed with normal profile completion
    
    // Set loan limit based on graduation status
    // Not graduated: ₹10,000 | Graduated: ₹25,000
    const loanLimit = graduation_status === 'graduated' ? 25000 : 10000;
    
    console.log(`💰 Setting loan limit for student: ₹${loanLimit} (Status: ${graduation_status})`);
    
    const updateData = {
      date_of_birth,
      college_name,
      graduation_status,
      loan_limit: loanLimit,
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
      message: `Student profile completed successfully! Your loan limit is ₹${loanLimit.toLocaleString('en-IN')}`,
      data: {
        user: profileSummary,
        loan_limit: loanLimit,
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

/**
 * Update graduation status for students (Upsell feature)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateGraduationStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const { graduation_status, graduation_date } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Validate graduation status
    if (!graduation_status || !['graduated', 'not_graduated'].includes(graduation_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid graduation status is required'
      });
    }

    // Check if user is a student
    const users = await executeQuery('SELECT employment_type, graduation_status, loan_limit FROM users WHERE id = ?', [userId]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (users[0].employment_type !== 'student') {
      return res.status(400).json({
        status: 'error',
        message: 'This feature is only available for students'
      });
    }

    const currentStatus = users[0].graduation_status;

    // If already graduated, cannot change back
    if (currentStatus === 'graduated' && graduation_status === 'not_graduated') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot change graduation status from graduated to not graduated'
      });
    }

    // Update loan limit based on new graduation status
    const newLoanLimit = graduation_status === 'graduated' ? 25000 : 10000;
    const oldLoanLimit = users[0].loan_limit || 10000;

    console.log(`🎓 Updating graduation status for user ${userId}: ${currentStatus} → ${graduation_status}`);
    console.log(`💰 Loan limit change: ₹${oldLoanLimit} → ₹${newLoanLimit}`);

    // Update graduation status and loan limit
    const updateData = {
      graduation_status,
      loan_limit: newLoanLimit,
      updated_at: new Date()
    };

    if (graduation_date && graduation_status === 'graduated') {
      updateData.graduation_date = graduation_date;
    }

    const updatedUser = await updateProfileById(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Failed to update graduation status'
      });
    }

    // Invalidate dashboard cache so new loan limit is reflected immediately
    invalidateUserCache(userId);
    console.log(`🔄 Dashboard cache invalidated for user ${userId}`);

    // Get updated profile
    const profileSummary = await getProfileSummary(updatedUser);

    // Determine if this is an upgrade
    const isUpgrade = graduation_status === 'graduated' && currentStatus === 'not_graduated';

    res.json({
      status: 'success',
      message: isUpgrade 
        ? `🎉 Congratulations on your graduation! Your loan limit has been increased to ₹${newLoanLimit.toLocaleString('en-IN')}`
        : 'Graduation status updated successfully',
      data: {
        user: profileSummary,
        loan_limit: newLoanLimit,
        old_loan_limit: oldLoanLimit,
        upgraded: isUpgrade
      }
    });

  } catch (error) {
    console.error('Update graduation status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update graduation status'
    });
  }
};

/**
 * Update additional details (Step 3 for salaried users)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAdditionalDetails = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const { personal_email, marital_status, salary_date, official_email } = req.body;

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!personal_email || !emailRegex.test(personal_email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid personal email is required'
      });
    }

    if (!official_email || !emailRegex.test(official_email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid official email is required'
      });
    }

    if (!marital_status || !['single', 'married', 'divorced', 'widow'].includes(marital_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid marital status is required'
      });
    }

    if (!salary_date || salary_date < 1 || salary_date > 31) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid salary date (1-31) is required'
      });
    }

    // Check if emails are verified
    const [verifications] = await db.execute(
      `SELECT type, verified FROM email_otp_verification 
       WHERE user_id = ? AND email IN (?, ?) AND verified = TRUE`,
      [userId, personal_email, official_email]
    );

    const personalVerified = verifications.some(v => v.type === 'personal' && v.email === personal_email);
    const officialVerified = verifications.some(v => v.type === 'official' && v.email === official_email);

    if (!personalVerified) {
      return res.status(400).json({
        status: 'error',
        message: 'Personal email must be verified before proceeding'
      });
    }

    if (!officialVerified) {
      return res.status(400).json({
        status: 'error',
        message: 'Official email must be verified before proceeding'
      });
    }

    // Update user record
    await db.execute(
      `UPDATE users 
       SET personal_email = ?,
           personal_email_verified = TRUE,
           official_email = ?,
           official_email_verified = TRUE,
           marital_status = ?,
           salary_date = ?,
           profile_completion_step = 4
       WHERE id = ?`,
      [personal_email, official_email, marital_status, salary_date, userId]
    );

    // Fetch updated user
    const [users] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Additional details saved successfully',
      data: {
        user: users[0]
      }
    });
  } catch (error) {
    console.error('Update additional details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save additional details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  updateBasicProfile,
  updateAdditionalProfile,
  updateStudentProfile,
  updateGraduationStatus,
  getProfileStatus,
  updateAdditionalDetails
};
