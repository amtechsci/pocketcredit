const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/admin/loan-plans - Get all loan plans
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const plans = await executeQuery(
      'SELECT * FROM loan_plans ORDER BY plan_order ASC'
    );

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get loan plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan plans'
    });
  }
});

/**
 * GET /api/admin/loan-plans/:id/fees - Get fees assigned to a loan plan
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.get('/:id/fees', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const planFees = await executeQuery(
      `SELECT 
        lpf.id,
        lpf.loan_plan_id,
        lpf.fee_type_id,
        lpf.fee_percent,
        ft.fee_name,
        ft.application_method,
        ft.description
       FROM loan_plan_fees lpf
       INNER JOIN fee_types ft ON lpf.fee_type_id = ft.id
       WHERE lpf.loan_plan_id = ?
       ORDER BY ft.fee_name ASC`,
      [id]
    );

    res.json({
      success: true,
      data: planFees
    });
  } catch (error) {
    console.error('Get loan plan fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan plan fees'
    });
  }
});

/**
 * POST /api/admin/loan-plans/:id/fees - Assign fee to loan plan
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.post('/:id/fees', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { fee_type_id, fee_percent } = req.body;

    if (!fee_type_id || fee_percent === undefined) {
      return res.status(400).json({
        success: false,
        message: 'fee_type_id and fee_percent are required'
      });
    }

    // Check if loan plan exists
    const plan = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ?',
      [id]
    );

    if (plan.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    // Check if fee type exists
    const feeType = await executeQuery(
      'SELECT id FROM fee_types WHERE id = ? AND is_active = 1',
      [fee_type_id]
    );

    if (feeType.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee type not found or inactive'
      });
    }

    // Insert or update fee assignment
    await executeQuery(
      `INSERT INTO loan_plan_fees (loan_plan_id, fee_type_id, fee_percent)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE fee_percent = ?`,
      [id, fee_type_id, parseFloat(fee_percent), parseFloat(fee_percent)]
    );

    res.json({
      success: true,
      message: 'Fee assigned to loan plan successfully'
    });
  } catch (error) {
    console.error('Assign fee to loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign fee to loan plan'
    });
  }
});

/**
 * DELETE /api/admin/loan-plans/:id/fees/:feeId - Remove fee from loan plan
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.delete('/:id/fees/:feeId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id, feeId } = req.params;

    await executeQuery(
      'DELETE FROM loan_plan_fees WHERE loan_plan_id = ? AND id = ?',
      [id, feeId]
    );

    res.json({
      success: true,
      message: 'Fee removed from loan plan successfully'
    });
  } catch (error) {
    console.error('Remove fee from loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove fee from loan plan'
    });
  }
});

/**
 * GET /api/admin/loan-plans/:id - Get single loan plan
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE id = ?',
      [id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    res.json({
      success: true,
      data: plans[0]
    });
  } catch (error) {
    console.error('Get loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan plan'
    });
  }
});

/**
 * POST /api/admin/loan-plans - Create new loan plan
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { 
      plan_name, 
      plan_code, 
      plan_type, 
      repayment_days,
      calculate_by_salary_date,
      emi_frequency, 
      emi_count,
      min_credit_score,
      eligible_member_tiers,
      eligible_employment_types,
      is_active,
      plan_order,
      description,
      terms_conditions
    } = req.body;

    // Validate required fields
    if (!plan_name || !plan_code || !plan_type || !plan_order) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: plan_name, plan_code, plan_type, plan_order'
      });
    }

    // Validate plan type specific fields
    if (plan_type === 'single' && !repayment_days) {
      return res.status(400).json({
        success: false,
        message: 'repayment_days is required for single payment plans'
      });
    }

    if (plan_type === 'multi_emi' && (!emi_frequency || !emi_count)) {
      return res.status(400).json({
        success: false,
        message: 'emi_frequency and emi_count are required for multi-EMI plans'
      });
    }

    // Calculate total duration for multi-EMI plans
    let totalDurationDays = null;
    if (plan_type === 'multi_emi' && emi_frequency && emi_count) {
      const daysPerEmi = {
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30
      };
      totalDurationDays = daysPerEmi[emi_frequency] * emi_count;
    } else if (plan_type === 'single') {
      totalDurationDays = repayment_days;
    }

    // Check if plan_code already exists
    const existingPlan = await executeQuery(
      'SELECT id FROM loan_plans WHERE plan_code = ?',
      [plan_code]
    );

    if (existingPlan.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A plan with this code already exists'
      });
    }

    const result = await executeQuery(
      `INSERT INTO loan_plans 
        (plan_name, plan_code, plan_type, repayment_days, calculate_by_salary_date, emi_frequency, emi_count, 
         total_duration_days, min_credit_score, interest_percent_per_day, eligible_member_tiers, eligible_employment_types,
         is_active, plan_order, description, terms_conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan_name, 
        plan_code, 
        plan_type, 
        repayment_days || null,
        calculate_by_salary_date ? 1 : 0,
        emi_frequency || null,
        emi_count || null,
        totalDurationDays,
        min_credit_score || 0,
        interest_percent_per_day ? parseFloat(interest_percent_per_day) : null,
        eligible_member_tiers ? JSON.stringify(eligible_member_tiers) : null,
        eligible_employment_types ? JSON.stringify(eligible_employment_types) : null,
        is_active !== false ? 1 : 0,
        plan_order,
        description || null,
        terms_conditions || null
      ]
    );

    res.json({
      success: true,
      message: 'Loan plan created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan plan'
    });
  }
});

/**
 * PUT /api/admin/loan-plans/:id - Update loan plan
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { 
      plan_name, 
      plan_code, 
      plan_type, 
      repayment_days,
      calculate_by_salary_date,
      emi_frequency, 
      emi_count,
      min_credit_score,
      eligible_member_tiers,
      eligible_employment_types,
      is_active,
      plan_order,
      description,
      terms_conditions
    } = req.body;

    // Check if plan exists
    const existing = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    // Calculate total duration for multi-EMI plans
    let totalDurationDays = null;
    if (plan_type === 'multi_emi' && emi_frequency && emi_count) {
      const daysPerEmi = {
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30
      };
      totalDurationDays = daysPerEmi[emi_frequency] * emi_count;
    } else if (plan_type === 'single') {
      totalDurationDays = repayment_days;
    }

    await executeQuery(
      `UPDATE loan_plans 
      SET plan_name = ?, plan_code = ?, plan_type = ?, repayment_days = ?, calculate_by_salary_date = ?,
          emi_frequency = ?, emi_count = ?, total_duration_days = ?, 
          min_credit_score = ?, interest_percent_per_day = ?, eligible_member_tiers = ?, eligible_employment_types = ?,
          is_active = ?, plan_order = ?, description = ?, terms_conditions = ?,
          updated_at = NOW()
      WHERE id = ?`,
      [
        plan_name, 
        plan_code, 
        plan_type, 
        repayment_days || null,
        calculate_by_salary_date ? 1 : 0,
        emi_frequency || null,
        emi_count || null,
        totalDurationDays,
        min_credit_score || 0,
        interest_percent_per_day ? parseFloat(interest_percent_per_day) : null,
        eligible_member_tiers ? JSON.stringify(eligible_member_tiers) : null,
        eligible_employment_types ? JSON.stringify(eligible_employment_types) : null,
        is_active !== false ? 1 : 0,
        plan_order,
        description || null,
        terms_conditions || null,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Loan plan updated successfully'
    });
  } catch (error) {
    console.error('Update loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update loan plan'
    });
  }
});

/**
 * DELETE /api/admin/loan-plans/:id - Delete loan plan
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    // Check if plan exists
    const existing = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    await executeQuery('DELETE FROM loan_plans WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Loan plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete loan plan'
    });
  }
});

/**
 * PATCH /api/admin/loan-plans/:id/toggle - Toggle plan active status
 */
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const existing = await executeQuery(
      'SELECT id, is_active FROM loan_plans WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    const newStatus = existing[0].is_active ? 0 : 1;

    await executeQuery(
      'UPDATE loan_plans SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Loan plan ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        is_active: newStatus
      }
    });
  } catch (error) {
    console.error('Toggle loan plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle loan plan status'
    });
  }
});

/**
 * GET /api/admin/loan-plans/:id/late-penalties - Get late penalties for a loan plan
 */
router.get('/:id/late-penalties', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const penalties = await executeQuery(
      'SELECT * FROM late_penalty_tiers WHERE loan_plan_id = ? ORDER BY tier_order ASC',
      [id]
    );

    res.json({
      success: true,
      data: penalties
    });
  } catch (error) {
    console.error('Get late penalties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch late penalties'
    });
  }
});

/**
 * POST /api/admin/loan-plans/:id/late-penalties - Create late penalty tier for a loan plan
 */
router.post('/:id/late-penalties', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { days_overdue_start, days_overdue_end, penalty_percent, tier_order } = req.body;

    // Validate required fields
    if (days_overdue_start === undefined || penalty_percent === undefined || tier_order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: days_overdue_start, penalty_percent, tier_order'
      });
    }

    // Check if loan plan exists
    const plan = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ?',
      [id]
    );

    if (plan.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found'
      });
    }

    const result = await executeQuery(
      `INSERT INTO late_penalty_tiers 
        (loan_plan_id, days_overdue_start, days_overdue_end, penalty_percent, tier_order)
      VALUES (?, ?, ?, ?, ?)`,
      [id, days_overdue_start, days_overdue_end || null, penalty_percent, tier_order]
    );

    res.json({
      success: true,
      message: 'Late penalty tier created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create late penalty error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create late penalty tier'
    });
  }
});

/**
 * PUT /api/admin/loan-plans/:id/late-penalties/:penaltyId - Update late penalty tier
 */
router.put('/:id/late-penalties/:penaltyId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id, penaltyId } = req.params;
    const { days_overdue_start, days_overdue_end, penalty_percent, tier_order } = req.body;

    // Validate required fields
    if (days_overdue_start === undefined || penalty_percent === undefined || tier_order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: days_overdue_start, penalty_percent, tier_order'
      });
    }

    await executeQuery(
      `UPDATE late_penalty_tiers 
      SET days_overdue_start = ?, days_overdue_end = ?, penalty_percent = ?, tier_order = ?, updated_at = NOW()
      WHERE id = ? AND loan_plan_id = ?`,
      [days_overdue_start, days_overdue_end || null, penalty_percent, tier_order, penaltyId, id]
    );

    res.json({
      success: true,
      message: 'Late penalty tier updated successfully'
    });
  } catch (error) {
    console.error('Update late penalty error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update late penalty tier'
    });
  }
});

/**
 * DELETE /api/admin/loan-plans/:id/late-penalties/:penaltyId - Delete late penalty tier
 */
router.delete('/:id/late-penalties/:penaltyId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id, penaltyId } = req.params;

    await executeQuery(
      'DELETE FROM late_penalty_tiers WHERE id = ? AND loan_plan_id = ?',
      [penaltyId, id]
    );

    res.json({
      success: true,
      message: 'Late penalty tier deleted successfully'
    });
  } catch (error) {
    console.error('Delete late penalty error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete late penalty tier'
    });
  }
});

module.exports = router;

