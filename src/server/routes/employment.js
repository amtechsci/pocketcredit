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
 * POST /api/employment/details
 * Submit detailed employment information for loan application
 */
router.post('/details', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { company_name, industry, department, designation, application_id } = req.body;

    // Validation
    if (!company_name || !industry || !department || !designation) {
      return res.status(400).json({
        success: false,
        message: 'All employment fields are required'
      });
    }

    if (!application_id) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Verify the application belongs to the user
    const application = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (!application || application.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    // Check if employment details already exist for this application
    const existing = await executeQuery(
      'SELECT id FROM application_employment_details WHERE application_id = ?',
      [application_id]
    );

    if (existing.length > 0) {
      // Update existing record
      await executeQuery(
        `UPDATE application_employment_details 
         SET company_name = ?, 
             industry = ?, 
             department = ?, 
             designation = ?, 
             updated_at = NOW() 
         WHERE application_id = ?`,
        [company_name, industry, department, designation, application_id]
      );
    } else {
      // Insert new record
      await executeQuery(
        `INSERT INTO application_employment_details 
         (application_id, user_id, company_name, industry, department, designation, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [application_id, userId, company_name, industry, department, designation]
      );
    }

    // Also update the employment_details table for user's profile
    const employmentExists = await executeQuery(
      'SELECT id FROM employment_details WHERE user_id = ?',
      [userId]
    );

    if (employmentExists.length > 0) {
      await executeQuery(
        `UPDATE employment_details 
         SET company_name = ?, 
             designation = ?, 
             updated_at = NOW() 
         WHERE user_id = ?`,
        [company_name, designation, userId]
      );
    } else {
      await executeQuery(
        `INSERT INTO employment_details 
         (user_id, company_name, designation, employment_type, created_at, updated_at) 
         VALUES (?, ?, ?, 'salaried', NOW(), NOW())`,
        [userId, company_name, designation]
      );
    }

    res.json({
      success: true,
      message: 'Employment details saved successfully',
      data: {
        company_name,
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
