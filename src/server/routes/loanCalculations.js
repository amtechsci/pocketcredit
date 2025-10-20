const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { initializeDatabase } = require('../config/database');
const {
  calculateTotalDays,
  calculateLoanValues,
  getLoanCalculation,
  updateLoanCalculation
} = require('../utils/loanCalculations');

/**
 * GET /api/loan-calculations/:loanId
 * Get calculated values for a loan
 * Query params:
 *   - days: Optional custom days for calculation
 */
router.get('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    const customDays = req.query.days ? parseInt(req.query.days) : null;
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    const calculation = await getLoanCalculation(db, loanId, customDays);
    
    res.json({
      success: true,
      data: calculation
    });
    
  } catch (error) {
    console.error('Error getting loan calculation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate loan values'
    });
  }
});

/**
 * PUT /api/loan-calculations/:loanId
 * Update loan calculation parameters (PF%, Interest%)
 * Body:
 *   - processing_fee_percent: number
 *   - interest_percent_per_day: number
 */
router.put('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    const { processing_fee_percent, interest_percent_per_day } = req.body;
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    const updates = {};
    
    if (processing_fee_percent !== undefined) {
      updates.processing_fee_percent = processing_fee_percent;
    }
    
    if (interest_percent_per_day !== undefined) {
      updates.interest_percent_per_day = interest_percent_per_day;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    const result = await updateLoanCalculation(db, loanId, updates);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error updating loan calculation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update loan calculation'
    });
  }
});

/**
 * POST /api/loan-calculations/calculate
 * Calculate loan values without saving (for preview)
 * Body:
 *   - loan_amount: number
 *   - processing_fee_percent: number
 *   - interest_percent_per_day: number
 *   - days: number
 */
router.post('/calculate', authenticateAdmin, async (req, res) => {
  try {
    const { loan_amount, processing_fee_percent, interest_percent_per_day, days } = req.body;
    
    // Validate inputs
    if (!loan_amount || !processing_fee_percent || !interest_percent_per_day || !days) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const loanData = {
      loan_amount: parseFloat(loan_amount),
      processing_fee_percent: parseFloat(processing_fee_percent),
      interest_percent_per_day: parseFloat(interest_percent_per_day)
    };
    
    const calculation = calculateLoanValues(loanData, parseInt(days));
    
    res.json({
      success: true,
      data: calculation
    });
    
  } catch (error) {
    console.error('Error calculating loan values:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to calculate loan values'
    });
  }
});

/**
 * GET /api/loan-calculations/:loanId/days
 * Get total days since disbursement
 */
router.get('/:loanId/days', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    const [loans] = await db.execute(
      'SELECT disbursed_at, status FROM loan_applications WHERE id = ?',
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    const loan = loans[0];
    
    if (!loan.disbursed_at) {
      return res.json({
        success: true,
        data: {
          disbursed: false,
          days: 0,
          message: 'Loan not yet disbursed'
        }
      });
    }
    
    const days = calculateTotalDays(loan.disbursed_at);
    
    res.json({
      success: true,
      data: {
        disbursed: true,
        disbursed_at: loan.disbursed_at,
        days: days,
        status: loan.status
      }
    });
    
  } catch (error) {
    console.error('Error calculating days:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate days'
    });
  }
});

module.exports = router;

