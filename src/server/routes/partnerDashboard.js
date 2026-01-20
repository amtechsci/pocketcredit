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

    // Use string interpolation for LIMIT and OFFSET (MySQL doesn't accept them as parameters)
    const limitValue = parseInt(limit);
    const offsetValue = parseInt(offset);
    query += ` ORDER BY pl.lead_shared_at DESC LIMIT ${limitValue} OFFSET ${offsetValue}`;

    const leads = await executeQuery(query, params);

    // Hide UTM links for registered users (2004) and active users (2006)
    // Only show UTM links for fresh leads (2005) to match API response behavior
    const processedLeads = (leads || []).map(lead => {
      if (lead.dedupe_code === 2004 || lead.dedupe_code === 2006) {
        return {
          ...lead,
          utm_link: null // Hide UTM link for registered/active users
        };
      }
      return lead; // Keep UTM link for fresh leads (2005)
    });

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
        leads: processedLeads,
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

    // Get basic stats
    const basicStats = await executeQuery(
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

    // Get BRE-based approval/rejection stats
    // Only count FRESH LEADS (2005) for credit checks - registered users are already Pocket Credit users
    // Approved = users who passed BRE (is_eligible = 1 in credit_checks)
    // Rejected = users who failed BRE (is_eligible = 0 OR status = 'on_hold' with Experian Hold reason)
    const breStats = await executeQuery(
      `SELECT 
        COUNT(DISTINCT pl.id) as total_leads_with_credit_check,
        SUM(CASE WHEN cc.is_eligible = 1 THEN 1 ELSE 0 END) as approved_leads,
        SUM(CASE WHEN (cc.is_eligible = 0 OR (u.status = 'on_hold' AND u.application_hold_reason LIKE 'Experian Hold%')) THEN 1 ELSE 0 END) as rejected_leads,
        SUM(CASE WHEN cc.id IS NULL THEN 1 ELSE 0 END) as pending_credit_check
      FROM partner_leads pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN credit_checks cc ON u.id = cc.user_id
      WHERE pl.partner_id = ? 
      AND pl.dedupe_status = 'fresh_lead'`,
      [partner.id]
    );

    const stats = basicStats[0] || {};
    const breData = breStats[0] || {};
    
    // Calculate percentages
    const totalLeads = parseInt(stats.total_leads) || 0;
    const approvedLeads = parseInt(breData.approved_leads) || 0;
    const rejectedLeads = parseInt(breData.rejected_leads) || 0;
    const pendingCreditCheck = parseInt(breData.pending_credit_check) || 0;
    const totalWithCreditCheck = parseInt(breData.total_leads_with_credit_check) || 0;
    
    const approvalRate = totalWithCreditCheck > 0 ? ((approvedLeads / totalWithCreditCheck) * 100).toFixed(2) : '0.00';
    const rejectionRate = totalWithCreditCheck > 0 ? ((rejectedLeads / totalWithCreditCheck) * 100).toFixed(2) : '0.00';
    
    // Merge stats
    const finalStats = {
      ...stats,
      // BRE-based stats
      approved_leads: approvedLeads,
      rejected_leads: rejectedLeads,
      pending_credit_check: pendingCreditCheck,
      total_leads_with_credit_check: totalWithCreditCheck,
      approval_rate_percent: parseFloat(approvalRate),
      rejection_rate_percent: parseFloat(rejectionRate),
      // API cost tracking - only fresh leads count as payable credit checks
      // Registered users are already Pocket Credit users, so they don't count as payable
      total_credit_checks: totalWithCreditCheck, // Only fresh leads (2005)
      wasted_credit_checks: rejectedLeads // Rejected fresh leads = wasted API calls
    };

    res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: finalStats
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

    // Hide UTM links for registered users (2004) and active users (2006)
    // Only show UTM links for fresh leads (2005) to match API response behavior
    const leadData = lead[0];
    if (leadData.dedupe_code === 2004 || leadData.dedupe_code === 2006) {
      leadData.utm_link = null; // Hide UTM link for registered/active users
    }

    res.json({
      status: true,
      code: 2000,
      message: 'Success',
      data: leadData
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

