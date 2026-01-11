const express = require('express');
const { requireAuth } = require('../middleware/jwtAuth');
const { executeQuery, initializeDatabase } = require('../config/database');

const router = express.Router();

// POST /api/employment-details - Save employment details
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const {
      monthly_income,
      employment_type: raw_employment_type,
      company_name,
      designation,
      work_experience_years
    } = req.body;

    await initializeDatabase();

    // Validation
    if (!monthly_income || !employment_type || !company_name || !designation) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required'
      });
    }

    if (isNaN(monthly_income) || parseFloat(monthly_income) <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Monthly income must be a positive number'
      });
    }

    // Check minimum income requirement
    if (parseFloat(monthly_income) < 25000) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum monthly income of ₹25,000 is required'
      });
    }

    if (work_experience_years && (isNaN(work_experience_years) || parseInt(work_experience_years) < 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'Work experience years must be a non-negative number'
      });
    }

    const employment_type = (raw_employment_type || '').toLowerCase();
    const validEmploymentTypes = ['salaried', 'self_employed', 'business', 'other'];
    if (!validEmploymentTypes.includes(employment_type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid employment type'
      });
    }

    // Check eligibility requirements
    const isEligible = parseFloat(monthly_income) >= 25000 && employment_type === 'salaried';
    
    if (!isEligible) {
      // User is not eligible - update profile to not eligible status
      await executeQuery(
        `UPDATE users SET 
         profile_completion_step = 5, 
         profile_completed = true, 
         eligibility_status = 'not_eligible',
         eligibility_reason = 'Income below ₹25,000 or not salaried employment',
         eligibility_retry_date = DATE_ADD(NOW(), INTERVAL 6 MONTH),
         updated_at = NOW() 
         WHERE id = ?`,
        [userId]
      );

      return res.json({
        status: 'success',
        message: 'Employment details saved. You are not eligible for loans at this time.',
        data: {
          eligible: false,
          reason: 'Income below ₹25,000 or not salaried employment',
          retry_after: '6 months'
        }
      });
    }

    // Check if employment record exists
    const existing = await executeQuery(
      'SELECT id FROM employment_details WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existing.length > 0) {
      // Update existing record
      result = await executeQuery(
        `UPDATE employment_details SET 
         employment_type = ?, 
         company_name = ?, 
         designation = ?, 
         work_experience_years = ?, 
         updated_at = NOW() 
         WHERE user_id = ?`,
        [employment_type, company_name, designation, work_experience_years ? parseInt(work_experience_years, 10) : null, userId]
      );
    } else {
      // Create new record
      result = await executeQuery(
        `INSERT INTO employment_details 
         (user_id, employment_type, company_name, designation, work_experience_years, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, employment_type, company_name, designation, work_experience_years ? parseInt(work_experience_years, 10) : null]
      );
    }

    // Update user's profile completion step
    await executeQuery(
      'UPDATE users SET profile_completion_step = 5, profile_completed = true, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    // Get updated user data
    const userResult = await executeQuery(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      status: 'success',
      message: 'Profile completed successfully',
      data: {
        user: userResult[0],
        next_step: 'dashboard',
        step_completed: 'employment_details',
        profile_completed: true
      }
    });

  } catch (error) {
    console.error('Employment details save error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error while saving employment details'
    });
  }
});

// GET /api/employment-details - Get employment details
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    await initializeDatabase();

    const employment = await executeQuery(
      'SELECT * FROM employment_details WHERE user_id = ?',
      [userId]
    );

    if (employment.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Employment details not found'
      });
    }

    const employmentData = employment[0];

    res.json({
      status: 'success',
      data: {
        employment_type: employmentData.employment_type,
        company_name: employmentData.company_name,
        designation: employmentData.designation,
        work_experience_years: employmentData.work_experience_years
      }
    });

  } catch (error) {
    console.error('Employment details fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error while fetching employment details'
    });
  }
});

/**
 * GET /api/employment-details/status
 * Check if employment details are already completed (user-specific, not application-specific)
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if employment details exist for this user (user-specific, one-time step)
    const userEmploymentDetails = await executeQuery(
      'SELECT * FROM employment_details WHERE user_id = ?',
      [userId]
    );

    // Get user's monthly_net_income and salary_date from users table
    const userData = await executeQuery(
      'SELECT monthly_net_income, salary_date FROM users WHERE id = ?',
      [userId]
    );

    // Employment is considered completed if all required fields are present
    let completed = false;
    
    if (userEmploymentDetails.length > 0) {
      const empDetails = userEmploymentDetails[0];
      // Check if all required fields are present
      completed = !!(
        empDetails.company_name &&
        empDetails.industry &&
        empDetails.department &&
        empDetails.designation &&
        empDetails.education &&
        userData[0]?.monthly_net_income &&
        userData[0]?.salary_date
      );
    }

    // Return employment data for pre-filling the form
    let employmentData = null;
    if (userEmploymentDetails.length > 0) {
      const empDetails = userEmploymentDetails[0];
      employmentData = {
        company_name: empDetails.company_name || null,
        designation: empDetails.designation || null,
        industry: empDetails.industry || null,
        department: empDetails.department || null,
        education: empDetails.education || null,
        monthly_net_income: userData[0]?.monthly_net_income || null,
        salary_date: userData[0]?.salary_date || null
      };
    }

    res.json({
      status: 'success',
      message: 'Employment status retrieved',
      data: {
        completed: completed,
        hasEmploymentDetails: userEmploymentDetails.length > 0,
        employmentData: employmentData // Return data for pre-filling
      }
    });

  } catch (error) {
    console.error('Employment status check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check employment status',
      error: error.message
    });
  }
});

/**
 * POST /api/employment-details/details
 * Submit detailed employment information (user-specific, one-time step)
 */
router.post('/details', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { 
      company_name, 
      monthly_net_income,
      income_confirmed,
      education,
      salary_date,
      industry, 
      department, 
      designation
      // application_id is no longer required - this is now user-specific
    } = req.body;

    // Validation
    if (!company_name || !industry || !department || !designation) {
      return res.status(400).json({
        success: false,
        message: 'All employment fields are required'
      });
    }

    if (!monthly_net_income || parseFloat(monthly_net_income) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Monthly net income is required and must be greater than 0'
      });
    }

    if (!income_confirmed) {
      return res.status(400).json({
        success: false,
        message: 'Income confirmation is required'
      });
    }

    if (!education) {
      return res.status(400).json({
        success: false,
        message: 'Education level is required'
      });
    }

    if (!salary_date || parseInt(salary_date) < 1 || parseInt(salary_date) > 31) {
      return res.status(400).json({
        success: false,
        message: 'Valid salary date (1-31) is required'
      });
    }

    // Update users table with monthly_net_income and salary_date
    await executeQuery(
      `UPDATE users 
       SET monthly_net_income = ?, 
           salary_date = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [monthly_net_income, parseInt(salary_date), userId]
    );

    // Adjust first-time loan amount to 8% of salary if applicable
    try {
      const { adjustFirstTimeLoanAmount } = require('../utils/creditLimitCalculator');
      const adjustmentResult = await adjustFirstTimeLoanAmount(userId, parseFloat(monthly_net_income));
      if (adjustmentResult.adjusted) {
        console.log(`✅ First-time loan amount adjusted: Loan ${adjustmentResult.loanId} from ₹${adjustmentResult.oldAmount} to ₹${adjustmentResult.newAmount}`);
      }
    } catch (adjustmentError) {
      // Don't fail the request if adjustment fails - log and continue
      console.error('⚠️ Error adjusting first-time loan amount (non-critical):', adjustmentError.message);
    }

    // Check if employment details already exist for this user (user-specific, one record per user)
    const existing = await executeQuery(
      'SELECT id FROM employment_details WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing record (user-specific, not application-specific)
      await executeQuery(
        `UPDATE employment_details 
         SET company_name = ?, 
             education = ?,
             industry = ?, 
             department = ?, 
             designation = ?,
             employment_type = COALESCE(employment_type, 'salaried'),
             updated_at = NOW() 
         WHERE user_id = ?`,
        [company_name, education, industry, department, designation, userId]
      );
    } else {
      // Insert new record (user-specific, one record per user)
      await executeQuery(
        `INSERT INTO employment_details 
         (user_id, company_name, education, industry, department, designation, employment_type, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'salaried', NOW(), NOW())`,
        [userId, company_name, education, industry, department, designation]
      );
    }

    res.json({
      success: true,
      message: 'Employment details saved successfully',
      data: {
        company_name,
        education,
        industry,
        department,
        designation
      }
    });

  } catch (error) {
    console.error('Employment details submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save employment details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
