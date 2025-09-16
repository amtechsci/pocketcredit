const express = require('express');
const { requireAuth } = require('../middleware/session');
const { getConnection } = require('../config/database');

const router = express.Router();

// POST /api/employment-details - Save employment details
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const { 
      monthly_income, 
      employment_type, 
      company_name, 
      designation, 
      salary_date 
    } = req.body;

    // Validation
    if (!monthly_income || !employment_type || !company_name || !designation || !salary_date) {
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

    if (isNaN(salary_date) || parseInt(salary_date) < 1 || parseInt(salary_date) > 31) {
      return res.status(400).json({
        status: 'error',
        message: 'Salary date must be between 1 and 31'
      });
    }

    const validEmploymentTypes = ['salaried', 'self_employed', 'business', 'other'];
    if (!validEmploymentTypes.includes(employment_type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid employment type'
      });
    }

    const connection = await getConnection();

    // Check if employment record exists
    const [existing] = await connection.execute(
      'SELECT id FROM employment_details WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existing.length > 0) {
      // Update existing record
      [result] = await connection.execute(
        `UPDATE employment_details SET 
         employment_type = ?, 
         company_name = ?, 
         designation = ?, 
         monthly_salary = ?, 
         salary_date = ?, 
         updated_at = NOW() 
         WHERE user_id = ?`,
        [employment_type, company_name, designation, parseFloat(monthly_income), parseInt(salary_date), userId]
      );
    } else {
      // Create new record
      [result] = await connection.execute(
        `INSERT INTO employment_details 
         (user_id, employment_type, company_name, designation, monthly_salary, salary_date) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, employment_type, company_name, designation, parseFloat(monthly_income), parseInt(salary_date)]
      );
    }

    // Update user's profile completion step
    await connection.execute(
      'UPDATE users SET profile_completion_step = 5, profile_completed = true, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    // Get updated user data
    const [userResult] = await connection.execute(
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
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const connection = await getConnection();

    const [employment] = await connection.execute(
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
        monthly_income: employmentData.monthly_salary,
        employment_type: employmentData.employment_type,
        company_name: employmentData.company_name,
        designation: employmentData.designation,
        salary_date: employmentData.salary_date
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

module.exports = router;
