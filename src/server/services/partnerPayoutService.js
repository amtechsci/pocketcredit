/**
 * Partner Payout Service
 * Calculates payout eligibility and amounts for partner leads
 */

const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Calculate payout eligibility based on 20-day rule
 * Payout is applicable only for leads where loan disbursal is completed within 20 days from lead share date
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

    // Payout eligible if disbursed within 20 days
    const eligible = daysDiff <= 20;

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
        : `Disbursed after ${daysDiff} days (20 days limit)`
    };
  } catch (error) {
    console.error('Error calculating payout eligibility:', error);
    throw error;
  }
};

/**
 * Calculate payout amount based on disbursal amount
 * This is a placeholder - actual payout calculation should be based on business rules
 */
const calculatePayoutAmount = (disbursalAmount) => {
  if (!disbursalAmount || disbursalAmount <= 0) {
    return 0;
  }

  // Example: 2% of disbursal amount (adjust based on business rules)
  const payoutPercentage = parseFloat(process.env.PARTNER_PAYOUT_PERCENTAGE) || 2;
  const payoutAmount = (parseFloat(disbursalAmount) * payoutPercentage) / 100;

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
 * Update lead with payout information
 */
const updateLeadPayout = async (leadId, disbursalAmount, disbursedAt) => {
  try {
    await initializeDatabase();

    // Calculate payout eligibility
    const eligibility = await calculatePayoutEligibility(leadId);

    // Calculate payout amount if eligible
    const payoutAmount = eligibility.eligible ? calculatePayoutAmount(disbursalAmount) : 0;
    const payoutGrade = eligibility.eligible ? getPayoutGrade(disbursalAmount) : null;

    // Update lead
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

    // Find lead by user_id and utm_source
    const leads = await executeQuery(
      `SELECT id, partner_id, loan_application_id
       FROM partner_leads
       WHERE user_id = ? AND utm_source = ?
       ORDER BY lead_shared_at DESC
       LIMIT 1`,
      [userId, utmSource]
    );

    if (leads && leads.length > 0 && !leads[0].loan_application_id) {
      // Update lead with loan application
      await executeQuery(
        `UPDATE partner_leads
         SET loan_application_id = ?,
             user_registered_at = COALESCE(user_registered_at, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [loanApplicationId, leads[0].id]
      );

      // Get loan status
      const loan = await executeQuery(
        `SELECT status, disbursed_at, loan_amount, disbursal_amount
         FROM loan_applications
         WHERE id = ?`,
        [loanApplicationId]
      );

      if (loan && loan.length > 0) {
        await executeQuery(
          `UPDATE partner_leads
           SET loan_status = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [loan[0].status, leads[0].id]
        );

        // If loan is disbursed, update payout info
        if (loan[0].disbursed_at) {
          await updateLeadPayout(
            leads[0].id,
            loan[0].disbursal_amount || loan[0].loan_amount,
            loan[0].disbursed_at
          );
        }
      }

      return { success: true, lead_id: leads[0].id };
    }

    return { success: false, reason: 'Lead not found or already linked' };
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

