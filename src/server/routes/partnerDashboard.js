const express = require('express');
const router = express.Router();
const { authenticatePartnerToken } = require('../middleware/partnerAuth');
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * GET /api/v1/partner/dashboard/leads
 * Get all leads shared by this partner
 */
router.get('/leads', authenticatePartnerToken, async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;

    const { page = 1, limit = 50, status, start_date, end_date } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        pl.id,
        pl.first_name,
        pl.last_name,
        pl.mobile_number,
        pl.pan_number,
        pl.dedupe_status,
        pl.dedupe_code,
        pl.utm_link,
        pl.lead_shared_at,
        pl.user_registered_at,
        pl.loan_application_id,
        pl.loan_status,
        pl.disbursed_at,
        pl.disbursal_amount,
        pl.payout_eligible,
        pl.payout_amount,
        pl.payout_grade,
        pl.payout_status,
        u.id as user_id,
        u.email,
        la.application_number,
        DATEDIFF(COALESCE(pl.disbursed_at, NOW()), pl.lead_shared_at) as days_to_disbursal
      FROM partner_leads pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN loan_applications la ON pl.loan_application_id = la.id
      WHERE pl.partner_id = ?
    `;
    const params = [partner.id];

    // Apply filters
    if (status) {
      query += ` AND pl.dedupe_status = ?`;
      params.push(status);
    }

    if (start_date) {
      query += ` AND DATE(pl.lead_shared_at) >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(pl.lead_shared_at) <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY pl.lead_shared_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const leads = await executeQuery(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM partner_leads
      WHERE partner_id = ?
    `;
    const countParams = [partner.id];

    if (status) {
      countQuery += ` AND dedupe_status = ?`;
      countParams.push(status);
    }

    if (start_date) {
      countQuery += ` AND DATE(lead_shared_at) >= ?`;
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND DATE(lead_shared_at) <= ?`;
      countParams.push(end_date);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: {
        leads: leads || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Partner dashboard leads error:', error);
    res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

/**
 * GET /api/v1/partner/dashboard/stats
 * Get partner statistics
 */
router.get('/stats', authenticatePartnerToken, async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;

    const stats = await executeQuery(
      `SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN dedupe_status = 'fresh_lead' THEN 1 ELSE 0 END) as fresh_leads,
        SUM(CASE WHEN dedupe_status = 'registered_user' THEN 1 ELSE 0 END) as registered_users,
        SUM(CASE WHEN dedupe_status = 'active_user' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN loan_application_id IS NOT NULL THEN 1 ELSE 0 END) as loan_applications,
        SUM(CASE WHEN disbursed_at IS NOT NULL THEN 1 ELSE 0 END) as disbursed_loans,
        SUM(CASE WHEN payout_eligible = 1 THEN 1 ELSE 0 END) as payout_eligible_leads,
        SUM(COALESCE(payout_amount, 0)) as total_payout_amount
      FROM partner_leads
      WHERE partner_id = ?`,
      [partner.id]
    );

    res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: stats[0] || {}
    });
  } catch (error) {
    console.error('Partner dashboard stats error:', error);
    res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

/**
 * GET /api/v1/partner/dashboard/lead/:leadId
 * Get detailed information about a specific lead
 */
router.get('/lead/:leadId', authenticatePartnerToken, async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;
    const { leadId } = req.params;

    const lead = await executeQuery(
      `SELECT 
        pl.*,
        u.email,
        u.status as user_status,
        la.application_number,
        la.loan_amount,
        la.status as loan_status,
        la.disbursed_at,
        la.created_at as loan_created_at
      FROM partner_leads pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN loan_applications la ON pl.loan_application_id = la.id
      WHERE pl.id = ? AND pl.partner_id = ?
      LIMIT 1`,
      [leadId, partner.id]
    );

    if (!lead || lead.length === 0) {
      return res.status(404).json({
        status: false,
        code: 4040,
        message: 'Lead not found'
      });
    }

    res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: lead[0]
    });
  } catch (error) {
    console.error('Partner dashboard lead detail error:', error);
    res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

module.exports = router;

