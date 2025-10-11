const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// POST /api/employment-quick-check - Initial eligibility check
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { employment_type, monthly_salary, payment_mode, designation } = req.body;

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
      if (!monthly_salary || !payment_mode || !designation) {
        return res.status(400).json({ 
          success: false, 
          message: 'Salary, payment mode, and designation are required for salaried users' 
        });
      }

      // Get eligibility criteria from config
      const configs = await executeQuery('SELECT config_key, config_value FROM eligibility_config');
      const criteria = {};
      configs.forEach(c => {
        criteria[c.config_key] = c.config_value;
      });

      const minSalary = parseInt(criteria.min_monthly_salary || '30000');
      const allowedModes = (criteria.allowed_payment_modes || 'bank_transfer,cheque').split(',').map(m => m.trim());
      const holdDays = parseInt(criteria.hold_period_days || '90');

      // Check eligibility
      const issues = [];
      let eligible = true;

      // Check salary
      if (parseInt(monthly_salary) < minSalary) {
        eligible = false;
        issues.push(`Minimum monthly salary required is ₹${minSalary.toLocaleString()}`);
      }

      // Check payment mode
      const normalizedPaymentMode = payment_mode.toLowerCase().replace(' ', '_');
      if (!allowedModes.includes(normalizedPaymentMode)) {
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
      }

      if (eligible) {
        // Get loan limit from tiers table based on salary
        const salary = parseFloat(monthly_salary);
        
        // Fetch active loan limit tiers ordered by tier_order
        const tiers = await executeQuery(
          'SELECT * FROM loan_limit_tiers WHERE is_active = 1 ORDER BY tier_order ASC'
        );

        let loanLimit = 0;
        
        // Find the matching tier for the salary
        for (const tier of tiers) {
          const minSalary = parseFloat(tier.min_salary);
          const maxSalary = tier.max_salary ? parseFloat(tier.max_salary) : null;
          
          // Check if salary falls in this tier
          if (maxSalary === null) {
            // No upper limit (e.g., "35000 and above")
            if (salary >= minSalary) {
              loanLimit = parseFloat(tier.loan_limit);
              break;
            }
          } else {
            // Has both min and max
            if (salary >= minSalary && salary <= maxSalary) {
              loanLimit = parseFloat(tier.loan_limit);
              break;
            }
          }
        }
        
        // If no tier matched, set loan limit to 0
        if (loanLimit === 0) {
          eligible = false;
          issues.push('Your salary does not fall within any eligible loan tier');
        }
        
        // User is eligible - update profile step, set loan limit, and save employment info
        await executeQuery(
          'UPDATE users SET profile_completion_step = 2, status = ?, eligibility_status = ?, loan_limit = ?, updated_at = NOW() WHERE id = ?',
          ['active', 'eligible', loanLimit, userId]
        );

        // Save employment data
        await executeQuery(`
          INSERT INTO employment_details 
          (user_id, employment_type, monthly_salary, salary_payment_mode, designation, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE 
            employment_type = VALUES(employment_type),
            monthly_salary = VALUES(monthly_salary),
            salary_payment_mode = VALUES(salary_payment_mode),
            designation = VALUES(designation),
            updated_at = NOW()
        `, [userId, employment_type, monthly_salary, payment_mode, designation]);

        return res.json({
          success: true,
          data: {
            eligible: true,
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

    // For student users - no salary validation needed
    if (employment_type === 'student') {
      await executeQuery(
        'UPDATE users SET profile_completion_step = 2, status = ?, eligibility_status = ?, updated_at = NOW() WHERE id = ?',
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


