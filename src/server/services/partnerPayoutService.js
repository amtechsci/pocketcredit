/**
 * Partner Payout Service
 * Calculates payout eligibility and amounts for partner leads
 */

const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Calculate payout eligibility based on 30-day rule
 * Payout is applicable only for leads where loan disbursal is completed within 30 days from lead share date
 */
const calculatePayoutEligibility = async (leadId) => {
  try {
    await initializeDatabase();

    const lead = await executeQuery(
      `SELECT 
        id, lead_shared_at, disbursed_at, disbursal_amount, payout_eligible
      FROM partner_leads
      WHERE id = ?`,
      [leadId]
    );

    if (!lead || lead.length === 0) {
      return { eligible: false, reason: 'Lead not found' };
    }

    const leadData = lead[0];

    // If not disbursed, not eligible
    if (!leadData.disbursed_at) {
      return { eligible: false, reason: 'Loan not disbursed yet' };
    }

    // Calculate days between lead share and disbursal
    // Parse dates as strings first to avoid timezone conversion
    const { parseDateToString } = require('../utils/loanCalculations');
    let leadShareDate;
    if (leadData.lead_shared_at) {
      const dateStr = parseDateToString(leadData.lead_shared_at);
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        leadShareDate = new Date(year, month - 1, day);
      } else {
        leadShareDate = new Date();
      }
    } else {
      leadShareDate = new Date();
    }
    leadShareDate.setHours(0, 0, 0, 0);
    
    let disbursalDate;
    if (leadData.disbursed_at) {
      const dateStr = parseDateToString(leadData.disbursed_at);
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        disbursalDate = new Date(year, month - 1, day);
      } else {
        disbursalDate = new Date();
      }
    } else {
      disbursalDate = new Date();
    }
    disbursalDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((disbursalDate - leadShareDate) / (1000 * 60 * 60 * 24));

    // Payout eligible if disbursed within 30 days
    const eligible = daysDiff <= 30;

    // Update lead with payout eligibility
    await executeQuery(
      `UPDATE partner_leads 
       SET payout_eligible = ?, updated_at = NOW()
       WHERE id = ?`,
      [eligible ? 1 : 0, leadId]
    );

    return {
      eligible,
      days_to_disbursal: daysDiff,
      reason: eligible 
        ? `Disbursed within ${daysDiff} days` 
        : `Disbursed after ${daysDiff} days (30 days limit)`
    };
  } catch (error) {
    console.error('Error calculating payout eligibility:', error);
    throw error;
  }
};

/**
 * Calculate payout amount based on disbursal amount and payout percentage
 * @param {number|string} disbursalAmount - Disbursal amount
 * @param {number|null} payoutPercentage - Partner's payout % (from partners.payout_percentage); fallback to env or 2
 */
const calculatePayoutAmount = (disbursalAmount, payoutPercentage = null) => {
  if (!disbursalAmount || disbursalAmount <= 0) {
    return 0;
  }

  const pct = payoutPercentage != null
    ? parseFloat(payoutPercentage)
    : (parseFloat(process.env.PARTNER_PAYOUT_PERCENTAGE) || 2);
  const payoutAmount = (parseFloat(disbursalAmount) * pct) / 100;

  return Math.round(payoutAmount * 100) / 100; // Round to 2 decimal places
};

/**
 * Determine payout grade based on disbursal amount
 */
const getPayoutGrade = (disbursalAmount) => {
  if (!disbursalAmount || disbursalAmount <= 0) {
    return 'N/A';
  }

  const amount = parseFloat(disbursalAmount);

  if (amount >= 100000) {
    return 'A+';
  } else if (amount >= 50000) {
    return 'A';
  } else if (amount >= 25000) {
    return 'B';
  } else if (amount >= 10000) {
    return 'C';
  } else {
    return 'D';
  }
};

/**
 * Update lead with payout information.
 * Payout is only for the first loan per lead: if this lead already has a payout (payout_amount set),
 * we do not overwrite (no payout for second/subsequent loans).
 */
const updateLeadPayout = async (leadId, disbursalAmount, disbursedAt) => {
  try {
    await initializeDatabase();

    const { findPartnerById } = require('../models/partner');

    const leadRows = await executeQuery(
      `SELECT id, partner_id, payout_amount, disbursed_at
       FROM partner_leads WHERE id = ?`,
      [leadId]
    );
    if (!leadRows || leadRows.length === 0) {
      return { eligible: false, reason: 'Lead not found' };
    }
    const lead = leadRows[0];

    // First-loan-only: we only give payout for the first disbursal per lead
    if (lead.disbursed_at != null) {
      return {
        eligible: lead.payout_amount != null && parseFloat(lead.payout_amount) > 0,
        payout_amount: lead.payout_amount || 0,
        payout_grade: null,
        days_to_disbursal: null,
        skipped: true,
        reason: 'Payout only for first loan; this lead already has a disbursal recorded'
      };
    }

    // Calculate payout eligibility (30-day rule)
    const eligibility = await calculatePayoutEligibility(leadId);

    let payoutPercentage = null;
    if (lead.partner_id) {
      const partner = await findPartnerById(lead.partner_id);
      if (partner && partner.payout_percentage != null) {
        payoutPercentage = partner.payout_percentage;
      }
    }

    const payoutAmount = eligibility.eligible ? calculatePayoutAmount(disbursalAmount, payoutPercentage) : 0;
    const payoutGrade = eligibility.eligible ? getPayoutGrade(disbursalAmount) : null;

    await executeQuery(
      `UPDATE partner_leads
       SET disbursal_amount = ?,
           disbursed_at = ?,
           payout_eligible = ?,
           payout_amount = ?,
           payout_grade = ?,
           payout_status = CASE 
             WHEN ? = 1 THEN 'eligible'
             ELSE 'pending'
           END,
           updated_at = NOW()
       WHERE id = ?`,
      [
        disbursalAmount,
        disbursedAt,
        eligibility.eligible ? 1 : 0,
        payoutAmount,
        payoutGrade,
        eligibility.eligible ? 1 : 0,
        leadId
      ]
    );

    return {
      eligible: eligibility.eligible,
      payout_amount: payoutAmount,
      payout_grade: payoutGrade,
      days_to_disbursal: eligibility.days_to_disbursal
    };
  } catch (error) {
    console.error('Error updating lead payout:', error);
    throw error;
  }
};

/**
 * Link loan application to partner lead
 * This should be called when a user with UTM parameters applies for a loan
 */
const linkLoanToLead = async (userId, loanApplicationId, utmSource) => {
  try {
    await initializeDatabase();

    // Get loan status first
    const loan = await executeQuery(
      `SELECT status, disbursed_at, loan_amount, disbursal_amount
       FROM loan_applications
       WHERE id = ?`,
      [loanApplicationId]
    );

    if (!loan || loan.length === 0) {
      return { success: false, reason: 'Loan not found' };
    }

    const loanStatus = loan[0].status;
    const loanData = loan[0];

    // Find the primary lead (from utm_source that triggered signup) for payout attribution
    const primaryLead = await executeQuery(
      `SELECT id, partner_id, loan_application_id
       FROM partner_leads
       WHERE user_id = ? AND utm_source = ?
       ORDER BY lead_shared_at DESC
       LIMIT 1`,
      [userId, utmSource]
    );

    let primaryLeadId = null;
    if (primaryLead && primaryLead.length > 0 && !primaryLead[0].loan_application_id) {
      // Update primary lead with loan application (for payout attribution)
      await executeQuery(
        `UPDATE partner_leads
         SET loan_application_id = ?,
             user_registered_at = COALESCE(user_registered_at, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [loanApplicationId, primaryLead[0].id]
      );
      primaryLeadId = primaryLead[0].id;

      // If loan is disbursed, update payout info for primary lead only
      if (loanData.disbursed_at) {
        await updateLeadPayout(
          primaryLead[0].id,
          loanData.disbursal_amount || loanData.loan_amount,
          loanData.disbursed_at
        );
      }
    }

    // Update loan_status for ALL partner_leads entries for this user_id
    // This ensures all partners who shared this lead can see the loan status
    // BUT: Only the primary partner (utm_source) gets loan_application_id set
    // Other partners will see loan_status but NOT have loan_application_id (indicating converted by another partner)
    await executeQuery(
      `UPDATE partner_leads
       SET loan_status = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [loanStatus, userId]
    );

    return { success: true, lead_id: primaryLeadId || 'updated_all' };
  } catch (error) {
    console.error('Error linking loan to lead:', error);
    throw error;
  }
};

module.exports = {
  calculatePayoutEligibility,
  calculatePayoutAmount,
  getPayoutGrade,
  updateLeadPayout,
  linkLoanToLead
};

