const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const { markVerified } = require('../services/employmentVerificationService');

/**
 * GET /api/admin/employment-verification/docs-verify
 */
router.get('/docs-verify', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let whereClause = "evr.status = 'docs_verify'";
    const params = [];

    if (search) {
      whereClause += ` AND (
        u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ? OR
        u.email LIKE ? OR la.application_number LIKE ? OR la.id = ?
      )`;
      const term = `%${search}%`;
      const loanId = /^\d+$/.test(search) ? parseInt(search, 10) : null;
      params.push(term, term, term, term, term, loanId || -1);
    }

    const countRows = await executeQuery(
      `SELECT COUNT(*) AS total
       FROM employment_verification_records evr
       JOIN users u ON u.id = evr.user_id
       LEFT JOIN loan_applications la ON la.id = evr.loan_application_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const rows = await executeQuery(
      `SELECT
         evr.id AS record_id,
         evr.user_id,
         evr.loan_application_id,
         evr.status,
         evr.payslip_s3_key,
         evr.company_id_s3_key,
         evr.payslip_document_id,
         evr.company_id_document_id,
         evr.created_at,
         evr.updated_at,
         u.first_name,
         u.last_name,
         u.phone,
         u.email,
         la.application_number,
         la.loan_amount,
         lad_p.file_path AS payslip_url,
         lad_c.file_path AS company_id_url
       FROM employment_verification_records evr
       JOIN users u ON u.id = evr.user_id
       LEFT JOIN loan_applications la ON la.id = evr.loan_application_id
       LEFT JOIN loan_application_documents lad_p ON lad_p.id = evr.payslip_document_id
       LEFT JOIN loan_application_documents lad_c ON lad_c.id = evr.company_id_document_id
       WHERE ${whereClause}
       ORDER BY evr.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      status: 'success',
      data: {
        records: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('docs-verify list error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch docs verify list' });
  }
});

/**
 * POST /api/admin/employment-verification/approve-selected
 */
router.post('/approve-selected', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { recordIds } = req.body;
    const adminId = req.admin?.id || req.adminId || null;

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'recordIds array is required' });
    }

    const placeholders = recordIds.map(() => '?').join(',');
    const rows = await executeQuery(
      `SELECT id, user_id, loan_application_id, status
       FROM employment_verification_records
       WHERE id IN (${placeholders}) AND status = 'docs_verify'`,
      recordIds
    );

    if (rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid records to approve' });
    }

    for (const row of rows) {
      await markVerified(row.id, 'manual_docs', { verified_by_admin_id: adminId });
    }

    res.json({
      status: 'success',
      message: `Approved ${rows.length} profile(s)`,
      data: { approvedCount: rows.length, approvedIds: rows.map((r) => r.id) }
    });
  } catch (error) {
    console.error('approve-selected error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to approve selected profiles' });
  }
});

module.exports = router;
