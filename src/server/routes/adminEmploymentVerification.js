const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const { markVerified } = require('../services/employmentVerificationService');

/**
 * Rows waiting for admin document review:
 * - employment docs pending (docs_verify / both docs uploaded), AND
 * - loan still in Submitted only (exclude Under Review, Ready to Repeat Disbursal, etc.)
 */
const DOCS_VERIFY_WHERE = `(
  (
    evr.status = 'docs_verify'
    OR (
      evr.status NOT IN ('verified')
      AND evr.payslip_document_id IS NOT NULL
      AND evr.company_id_document_id IS NOT NULL
    )
  )
  AND la.id IS NOT NULL
  AND la.status = 'submitted'
)`;

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

    let whereClause = DOCS_VERIFY_WHERE;
    const params = [];

    if (search) {
      whereClause += ` AND (
        u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ? OR
        u.email LIKE ? OR la.application_number LIKE ? OR CAST(la.id AS CHAR) = ? OR
        CONCAT('PLL', la.id) LIKE ? OR CAST(evr.user_id AS CHAR) = ?
      )`;
      const term = `%${search}%`;
      const digits = search.replace(/\D/g, '');
      const loanId = /^\d+$/.test(digits) ? digits : search;
      params.push(term, term, term, term, term, loanId, term, digits || search);
    }

    // Heal: if both docs are present but status was never flipped to docs_verify
    try {
      await executeQuery(
        `UPDATE employment_verification_records
         SET status = 'docs_verify',
             method = COALESCE(method, 'manual_docs'),
             updated_at = NOW()
         WHERE status NOT IN ('verified', 'docs_verify')
           AND payslip_document_id IS NOT NULL
           AND company_id_document_id IS NOT NULL`
      );
    } catch (healErr) {
      console.warn('docs-verify heal update skipped:', healErr.message);
    }

    const countRows = await executeQuery(
      `SELECT COUNT(*) AS total
       FROM employment_verification_records evr
       JOIN users u ON u.id = evr.user_id
       LEFT JOIN loan_applications la ON la.id = COALESCE(
         evr.loan_application_id,
         (SELECT MAX(la2.id) FROM loan_applications la2 WHERE la2.user_id = evr.user_id)
       )
       WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Interpolate LIMIT/OFFSET — mysql2 prepared LIMIT ? often throws and returns empty list
    const rows = await executeQuery(
      `SELECT
         evr.id AS record_id,
         evr.user_id,
         COALESCE(evr.loan_application_id, la.id) AS loan_application_id,
         evr.status AS ev_status,
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
         la.loan_purpose,
         la.status AS loan_status,
         DATE_FORMAT(la.created_at, '%Y-%m-%d') AS application_date,
         ed.employment_type,
         ed.company_name,
         av.name AS verify_user_name,
         af.name AS follow_up_user_name,
         am.name AS acc_manager_name,
         ar.name AS recovery_officer_name,
         lad_p.file_path AS payslip_url,
         lad_c.file_path AS company_id_url
       FROM employment_verification_records evr
       JOIN users u ON u.id = evr.user_id
       LEFT JOIN loan_applications la ON la.id = COALESCE(
         evr.loan_application_id,
         (SELECT MAX(la2.id) FROM loan_applications la2 WHERE la2.user_id = evr.user_id)
       )
       LEFT JOIN (
         SELECT ed1.user_id, ed1.employment_type, ed1.company_name
         FROM employment_details ed1
         WHERE ed1.id = (
           SELECT MAX(ed2.id) FROM employment_details ed2 WHERE ed2.user_id = ed1.user_id
         )
       ) ed ON ed.user_id = u.id
       LEFT JOIN admins av ON la.assigned_verify_admin_id COLLATE utf8mb4_unicode_ci = av.id
       LEFT JOIN admins af ON la.assigned_follow_up_admin_id COLLATE utf8mb4_unicode_ci = af.id
       LEFT JOIN admins am ON la.assigned_account_manager_id COLLATE utf8mb4_unicode_ci = am.id
       LEFT JOIN admins ar ON la.assigned_recovery_officer_id COLLATE utf8mb4_unicode_ci = ar.id
       LEFT JOIN loan_application_documents lad_p ON lad_p.id = evr.payslip_document_id
       LEFT JOIN loan_application_documents lad_c ON lad_c.id = evr.company_id_document_id
       WHERE ${whereClause}
       ORDER BY evr.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      status: 'success',
      data: {
        records: rows || [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0
      }
    });
  } catch (error) {
    console.error('docs-verify list error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch docs verify list'
    });
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

    const ids = recordIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    if (ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid recordIds' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const rows = await executeQuery(
      `SELECT id, user_id, loan_application_id, status
       FROM employment_verification_records
       WHERE id IN (${placeholders})
         AND (
           status = 'docs_verify'
           OR (
             status NOT IN ('verified')
             AND payslip_document_id IS NOT NULL
             AND company_id_document_id IS NOT NULL
           )
         )`,
      ids
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
