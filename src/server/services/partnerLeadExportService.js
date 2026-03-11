/**
 * Partner Lead Export Service
 * Fetches partner leads with user/loan/employment/address data for XLSX export.
 * Includes all loan statuses (cancelled, submitted, disbursal, account_manager, etc.).
 * Date filter is by FIRST LOAN APPLIED DATE (la.created_at, or lead_shared_at if no loan yet).
 * Admin and partner Excel use this same service so both get the same rows for same partner + date range.
 */

const { executeQuery } = require('../config/database');

/**
 * Format date as DDMMYYYY for export (e.g. 09041987)
 */
function formatDateDDMMYYYY(date) {
  if (!date) return '';
  const d = typeof date === 'string' || !(date instanceof Date) ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Build export rows for partner leads (all statuses). Date filter by first loan applied date.
 * @param {number} partnerId - Partner ID
 * @param {Object} options - { start_date, end_date, own_leads_only }
 *   start_date, end_date (YYYY-MM-DD): filter by first loan applied date (la.created_at, or lead_shared_at if no loan).
 *   end_date is EXCLUSIVE: for "February only" send end_date=YYYY-03-01.
 * @returns {Promise<Array>} Array of row objects with export column keys
 */
async function getLeadExportData(partnerId, options = {}) {
  const { start_date, end_date, own_leads_only = true } = options;

  // Application date = when the linked loan was applied, or lead_shared_at if no loan yet
  const applicationDateExpr = 'COALESCE(la.created_at, pl.lead_shared_at)';

  let query = `
    SELECT
      pl.id as lead_id,
      pl.first_name as pl_first_name,
      pl.last_name as pl_last_name,
      pl.mobile_number as pl_mobile,
      pl.pan_number as pl_pan,
      pl.date_of_birth as pl_dob,
      pl.lead_shared_at,
      pl.utm_link,
      pl.disbursed_at as pl_disbursed_at,
      pl.disbursal_amount as pl_disbursal_amount,
      COALESCE(la.status, pl.loan_status) as loan_status,
      la.id as loan_id,
      la.application_number,
      la.loan_amount as la_loan_amount,
      la.created_at as loan_created_at,
      la.disbursed_at as la_disbursed_at,
      la.disbursal_amount as la_disbursal_amount,
      u.id as user_id,
      u.first_name as u_first_name,
      u.last_name as u_last_name,
      u.phone as u_mobile,
      u.pan_number as u_pan,
      u.date_of_birth as u_dob,
      u.gender,
      u.income_range,
      u.monthly_net_income,
      u.experian_score as u_experian_score,
      COALESCE(ed.company_name, '') as company_name,
      COALESCE(ed.designation, '') as designation,
      COALESCE(ed.education, '') as education,
      COALESCE(ed.department, '') as department,
      COALESCE(a.city, '') as city,
      COALESCE(a.state, '') as state,
      COALESCE(a.pincode, '') as pincode,
      COALESCE(p.name, '') as partner_name,
      cc.credit_score as cc_experian_score
    FROM partner_leads pl
    LEFT JOIN users u ON pl.user_id = u.id
    LEFT JOIN loan_applications la ON pl.loan_application_id = la.id
    LEFT JOIN (
      SELECT ed1.user_id, ed1.company_name, ed1.designation, ed1.education, ed1.department
      FROM employment_details ed1
      WHERE ed1.id = (SELECT MAX(ed2.id) FROM employment_details ed2 WHERE ed2.user_id = ed1.user_id)
    ) ed ON u.id = ed.user_id
    LEFT JOIN (
      SELECT a1.user_id, a1.city, a1.state, a1.pincode
      FROM addresses a1
      WHERE a1.is_primary = 1 AND a1.id = (
        SELECT MAX(a2.id) FROM addresses a2 WHERE a2.user_id = a1.user_id AND a2.is_primary = 1
      )
    ) a ON u.id = a.user_id
    LEFT JOIN partners p ON pl.partner_id = p.id
    LEFT JOIN (
      SELECT cc1.user_id, cc1.credit_score
      FROM credit_checks cc1
      WHERE cc1.id = (SELECT MAX(cc2.id) FROM credit_checks cc2 WHERE cc2.user_id = cc1.user_id)
    ) cc ON u.id = cc.user_id
    WHERE pl.partner_id = ?
  `;
  const params = [partnerId];

  // Only include leads that actually belong to this partner (not existing-user leads
  // from other partners). user_id IS NULL = fresh lead; user_registered_at IS NOT NULL = user
  // registered through this partner.
  if (own_leads_only) {
    query += ` AND (pl.user_id IS NULL OR pl.user_registered_at IS NOT NULL)`;
  }

  // Date filter: by first loan applied date (la.created_at) or lead_shared_at if no loan. end_date EXCLUSIVE.
  if (start_date) {
    query += ` AND DATE(${applicationDateExpr}) >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND DATE(${applicationDateExpr}) < ?`;
    params.push(end_date);
  }

  query += ` ORDER BY ${applicationDateExpr} DESC`;

  const rows = await executeQuery(query, params);

  const exportRows = (rows || []).map((row) => {
    const applicantName = [row.u_first_name || row.pl_first_name, row.u_last_name || row.pl_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || '—';
    // Application ID: short format PLL + id (e.g. PLL1802), not long PC...
    const applicationId = row.loan_id ? `PLL${row.loan_id}` : '';
    const mobile = row.u_mobile || row.pl_mobile || '';
    const pan = row.u_pan || row.pl_pan || '';
    const dob = row.u_dob || row.pl_dob;
    const applicationDate = row.loan_created_at || row.lead_shared_at;
    const disbursedDate = row.la_disbursed_at || row.pl_disbursed_at;
    // Principal amount: applied loan amount, not disbursed amount
    const principalAmount = row.la_loan_amount != null ? parseFloat(row.la_loan_amount) : (row.pl_disbursal_amount != null ? row.pl_disbursal_amount : '');
    const experianScore = row.u_experian_score != null ? String(row.u_experian_score) : (row.cc_experian_score != null ? String(row.cc_experian_score) : '');

    // lead_source: API = lead created via partner API (has utm_link); UTM = user came via UTM link only
    const lead_source = (row.utm_link && String(row.utm_link).trim()) ? 'API' : 'UTM';

    return {
      'Application ID': applicationId,
      'Applicant Name': applicantName,
      'Mobile': mobile,
      'PAN Number': pan,
      'Date of Birth': dob ? formatDateDDMMYYYY(dob) : '',
      'Gender': row.gender || '',
      'lead_source': lead_source,
      'Application Date': applicationDate ? formatDateDDMMYYYY(applicationDate) : '',
      'Disbursed Date': disbursedDate ? formatDateDDMMYYYY(disbursedDate) : '',
      'principal amount': principalAmount,
      'Monthly Income Range': row.income_range || '',
      'Company Name': row.company_name || '',
      'Designation': row.designation || '',
      'Education': row.education || '',
      'Department': row.department || '',
      'Income Entered by User': row.monthly_net_income != null ? parseFloat(row.monthly_net_income) : 0,
      'Partner Name': row.partner_name || '',
      'Experian Score': experianScore,
      'City': row.city || '',
      'State': row.state || '',
      'Pincode': row.pincode || '',
      'Loan status': row.loan_status || ''
    };
  });

  return exportRows;
}

module.exports = {
  getLeadExportData,
  formatDateDDMMYYYY
};
