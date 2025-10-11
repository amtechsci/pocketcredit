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
        (plan_name, plan_code, plan_type, repayment_days, emi_frequency, emi_count, 
         total_duration_days, min_credit_score, eligible_member_tiers, eligible_employment_types,
         is_active, plan_order, description, terms_conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan_name, 
        plan_code, 
        plan_type, 
        repayment_days || null,
        emi_frequency || null,
        emi_count || null,
        totalDurationDays,
        min_credit_score || 0,
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
      SET plan_name = ?, plan_code = ?, plan_type = ?, repayment_days = ?, 
          emi_frequency = ?, emi_count = ?, total_duration_days = ?, 
          min_credit_score = ?, eligible_member_tiers = ?, eligible_employment_types = ?,
          is_active = ?, plan_order = ?, description = ?, terms_conditions = ?,
          updated_at = NOW()
      WHERE id = ?`,
      [
        plan_name, 
        plan_code, 
        plan_type, 
        repayment_days || null,
        emi_frequency || null,
        emi_count || null,
        totalDurationDays,
        min_credit_score || 0,
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

module.exports = router;

