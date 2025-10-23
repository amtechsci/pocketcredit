const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// POST /api/employment-quick-check - Initial eligibility check
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { employment_type, income_range, eligible_loan_amount, payment_mode, date_of_birth } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Validate required fields
    if (!employment_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employment type is required' 
      });
    }

    // Update user's employment type
    await executeQuery(
      'UPDATE users SET employment_type = ?, updated_at = NOW() WHERE id = ?',
      [employment_type, userId]
    );

    // Handle different employment types
    const holdTypes = ['self_employed', 'part_time', 'freelancer', 'homemaker', 'retired', 'no_job', 'others'];
    
    if (holdTypes.includes(employment_type)) {
      // Hold application permanently
      await executeQuery(
        'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
        ['on_hold', 'not_eligible', `Application held due to employment type: ${employment_type}`, userId]
      );

      return res.json({
        success: true,
        data: {
          eligible: false,
          message: 'Application has been placed on hold due to your employment type',
          hold_reason: `Employment type: ${employment_type}`,
          hold_permanent: true
        }
      });
    }

    // For salaried users - validate salary fields
    if (employment_type === 'salaried') {
      if (!income_range || !eligible_loan_amount || !payment_mode || !date_of_birth) {
        return res.status(400).json({ 
          success: false, 
          message: 'Income range, payment mode, and date of birth are required for salaried users' 
        });
      }

      // Age validation - hold permanently if age > 45
      const dob = new Date(date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear() - 
        ((today.getMonth() < dob.getMonth() || 
         (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0);

      if (age > 45) {
        // Hold application permanently due to age
        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, date_of_birth = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', `Application held: Age (${age} years) exceeds maximum limit of 45 years`, date_of_birth, userId]
        );

        return res.json({
          success: true,
          data: {
            eligible: false,
            message: 'Sorry, applicants above 45 years of age are not eligible at this time',
            hold_reason: `Age: ${age} years (maximum 45 years allowed)`,
            hold_permanent: true
          }
        });
      }

      // Get eligibility criteria from config
      const configs = await executeQuery('SELECT config_key, config_value FROM eligibility_config');
      const criteria = {};
      configs.forEach(c => {
        criteria[c.config_key] = c.config_value;
      });

      const holdDays = parseInt(criteria.hold_period_days || '90');

      // Check eligibility
      const issues = [];
      let eligible = true;

      // Income range is already validated on frontend, but double-check
      const validRanges = ['1k-15k', '15k-25k', '25k-35k', 'above-35k'];
      if (!validRanges.includes(income_range)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid income range selected'
        });
      }

      // Check payment mode
      if (payment_mode === 'cash') {
        // Cash payment - hold permanently
        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', 'Cash payment mode not allowed', userId]
        );

        return res.json({
          success: true,
          data: {
            eligible: false,
            message: 'Application held permanently due to cash payment mode',
            hold_reason: 'Cash payment mode',
            hold_permanent: true
          }
        });
      } else if (payment_mode === 'cheque') {
        // Cheque payment - hold for 90 days
        const holdUntil = new Date();
        holdUntil.setDate(holdUntil.getDate() + holdDays);
        
        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, application_hold_reason = ?, hold_until_date = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', 'Cheque payment mode', holdUntil, userId]
        );

        return res.json({
          success: true,
          data: {
            eligible: false,
            message: `Application held for ${holdDays} days due to cheque payment mode`,
            hold_reason: 'Cheque payment mode',
            hold_until: holdUntil,
            hold_days: holdDays
          }
        });
      }

      if (eligible) {
        // Use the loan amount calculated from income range
        const loanLimit = parseFloat(eligible_loan_amount);
        
        // User is eligible - update profile step, set loan limit, income range, date of birth, and save employment info
        await executeQuery(
          'UPDATE users SET profile_completion_step = 2, status = ?, eligibility_status = ?, loan_limit = ?, income_range = ?, date_of_birth = ?, updated_at = NOW() WHERE id = ?',
          ['active', 'eligible', loanLimit, income_range, date_of_birth, userId]
        );

        // Save employment data
        await executeQuery(`
          INSERT INTO employment_details 
          (user_id, employment_type, income_range, salary_payment_mode, created_at, updated_at)
          VALUES (?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE 
            employment_type = VALUES(employment_type),
            income_range = VALUES(income_range),
            salary_payment_mode = VALUES(salary_payment_mode),
            updated_at = NOW()
        `, [userId, employment_type, income_range, payment_mode]);

        return res.json({
          success: true,
          data: {
            eligible: true,
            loan_limit: loanLimit,
            income_range: income_range,
            message: 'Eligibility verified successfully'
          }
        });
      } else {
        // User is not eligible due to salary
        const eligibilityReason = issues.join('. ');

        await executeQuery(
          'UPDATE users SET status = ?, eligibility_status = ?, eligibility_reason = ?, profile_completion_step = 2, updated_at = NOW() WHERE id = ?',
          ['on_hold', 'not_eligible', eligibilityReason, userId]
        );

        return res.json({
          success: true,
          data: {
            eligible: false,
            message: `You are currently not eligible. ${issues.join('. ')}`,
            issues
          }
        });
      }
    }

    // For student users - skip Step 2, go directly to Step 3 (College Information)
    if (employment_type === 'student') {
      await executeQuery(
        'UPDATE users SET profile_completion_step = 3, status = ?, eligibility_status = ?, updated_at = NOW() WHERE id = ?',
        ['active', 'pending', userId]
      );

      return res.json({
        success: true,
        data: {
          eligible: true,
          message: 'Student application started successfully'
        }
      });
    }

    // Default response for unknown employment types
    return res.status(400).json({
      success: false,
      message: 'Invalid employment type'
    });

  } catch (error) {
    console.error('Employment quick check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while checking eligibility'
    });
  }
});

module.exports = router;


