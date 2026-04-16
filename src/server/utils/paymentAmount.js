/**
 * Shared backend payment amount calculation (same rules as /api/payment/create-order).
 * @param {Object} loan - Loan row (must include id)
 * @param {string} paymentType - pre-close, full_payment, emi_1st..emi_4th, loan_repayment, etc.
 * @returns {Promise<number>}
 */
async function calculatePaymentAmount(loan, paymentType) {
  const { getLoanCalculation } = require('./loanCalculations');
  const { calculateOutstandingBalance, calculateExtensionFees } = require('./extensionCalculations');

  try {
    const calculation = await getLoanCalculation(loan.id);

    if (!calculation) {
      throw new Error('Failed to get loan calculation');
    }

    const calculationData = calculation;

    if (paymentType === 'pre-close') {
      const principal = parseFloat(calculationData.principal || loan.processed_amount || loan.sanctioned_amount || loan.loan_amount || loan.principal_amount || 0);
      const interestTillToday = calculationData.interest?.interestTillToday || 0;
      const preCloseFeePercent = 10;
      const preCloseFee = Math.round((principal * preCloseFeePercent) / 100 * 100) / 100;
      const preCloseFeeGST = Math.round(preCloseFee * 0.18 * 100) / 100;
      const precloseAmount = principal + interestTillToday + preCloseFee + preCloseFeeGST;
      console.log(`💰 Pre-close calculation: Principal (₹${principal}) + Interest Till Today (₹${interestTillToday}) + Pre-close Fee (₹${preCloseFee}) + GST on Pre-close Fee (₹${preCloseFeeGST}) = ₹${precloseAmount}`);
      return precloseAmount;
    } else if (paymentType === 'full_payment') {
      const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
      const penaltyTotal = calculationData.penalty?.penalty_total || 0;
      const fullPaymentAmount = totalRepayable + penaltyTotal;
      console.log(`💰 Full payment calculation: Total Repayable (₹${totalRepayable}) + Penalty (₹${penaltyTotal}) = ₹${fullPaymentAmount}`);
      return fullPaymentAmount;
    } else if (paymentType && paymentType.startsWith('emi_')) {
      const emiNumber = parseInt(paymentType.replace('emi_', '').replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''), 10);

      if (isNaN(emiNumber) || emiNumber < 1) {
        throw new Error(`Invalid EMI number in paymentType: ${paymentType}`);
      }

      const schedule = calculationData.repayment?.schedule || [];

      if (schedule.length === 0) {
        try {
          const { executeQuery } = require('../config/database');
          const loanRecords = await executeQuery(
            `SELECT emi_schedule 
             FROM loan_applications 
             WHERE id = ? 
             LIMIT 1`,
            [loan.id]
          );

          if (loanRecords && loanRecords.length > 0 && loanRecords[0].emi_schedule) {
            let emiScheduleData = loanRecords[0].emi_schedule;

            if (typeof emiScheduleData === 'string') {
              try {
                emiScheduleData = JSON.parse(emiScheduleData);
              } catch (parseError) {
                console.warn(`⚠️ Could not parse emi_schedule JSON: ${parseError.message}`);
                emiScheduleData = null;
              }
            }

            if (emiScheduleData && Array.isArray(emiScheduleData)) {
              const emiRecord = emiScheduleData.find(
                (e) => (e.emi_number === emiNumber || e.instalment_no === emiNumber)
              );

              if (emiRecord && emiRecord.emi_amount) {
                const emiAmount = parseFloat(emiRecord.emi_amount);
                if (emiAmount > 0) {
                  console.log(`💰 EMI ${emiNumber} calculation (from loan_applications.emi_schedule JSON): ₹${emiAmount}`);
                  return emiAmount;
                }
              }
            }
          }
        } catch (dbError) {
          console.warn(`⚠️ Could not fetch EMI from loan_applications.emi_schedule: ${dbError.message}`);
        }

        const emiCount = parseInt(loan.plan_snapshot ? (typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot).emi_count : 1) || 1;
        const processedAmount = parseFloat(loan.processed_amount || loan.loan_amount || 0);

        if (processedAmount > 0) {
          const postServiceFee = calculationData.fees?.post_service_fee || calculationData.post_service_fee || 0;
          const postServiceFeeGST = calculationData.fees?.post_service_fee_gst || calculationData.post_service_fee_gst || 0;
          const totalFees = postServiceFee + postServiceFeeGST;
          const interestRatePerDay = parseFloat(loan.interest_percent_per_day || 0.001);
          const estimatedInterest = processedAmount * interestRatePerDay * 30;
          const totalAmount = processedAmount + estimatedInterest + totalFees;
          const emiAmount = totalAmount / emiCount;

          console.log(`💰 EMI ${emiNumber} calculation (fallback from loan amount): Principal (₹${processedAmount}) + Interest (₹${estimatedInterest}) + Fees (₹${totalFees}) / ${emiCount} = ₹${emiAmount}`);

          if (emiAmount > 0) {
            return emiAmount;
          }
        }

        const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
        const emiAmount = totalRepayable / emiCount;
        console.log(`💰 EMI ${emiNumber} calculation (fallback from total repayable): Total (₹${totalRepayable}) / ${emiCount} = ₹${emiAmount}`);

        if (emiAmount <= 0 || isNaN(emiAmount)) {
          throw new Error(`Cannot calculate EMI ${emiNumber} amount: totalRepayable (₹${totalRepayable}) is invalid or emiCount (${emiCount}) is invalid`);
        }

        return emiAmount;
      }

      const emi = schedule.find(e => e.emi_number === emiNumber || e.instalment_no === emiNumber);

      if (!emi) {
        throw new Error(`EMI ${emiNumber} not found in repayment schedule`);
      }

      let emiAmount = emi.instalment_amount;

      if (!emiAmount || emiAmount <= 0) {
        const principal = emi.principal || 0;
        const interest = emi.interest || 0;
        const postServiceFee = emi.post_service_fee || 0;
        const gstOnPostServiceFee = emi.gst_on_post_service_fee || 0;
        const penaltyTotal = emi.penalty_total || emi.penalty || 0;
        const dpdInterestOnTotalPrincipal = parseFloat(emi.dpd_interest_on_total_principal || emi.dpd_interest || 0) || 0;

        emiAmount = principal + interest + postServiceFee + gstOnPostServiceFee + penaltyTotal + dpdInterestOnTotalPrincipal;
      }

      const penaltyTotal = emi.penalty_total || emi.penalty || 0;
      const dpdInterestOnTotalPrincipal = parseFloat(emi.dpd_interest_on_total_principal || emi.dpd_interest || 0) || 0;

      if (penaltyTotal > 0) {
        const baseAmount = (emi.principal || 0) + (emi.interest || 0) + (emi.post_service_fee || 0) + (emi.gst_on_post_service_fee || 0) + dpdInterestOnTotalPrincipal;
        const tolerance = 0.01;
        if (Math.abs(emiAmount - baseAmount) < tolerance) {
          emiAmount = emiAmount + penaltyTotal;
          console.log(`💰 EMI ${emiNumber}: Adding penalty (₹${penaltyTotal}) to base amount (₹${baseAmount}) = ₹${emiAmount}`);
        }
      }

      console.log(`💰 EMI ${emiNumber} calculation: ₹${emiAmount} (Principal: ₹${emi.principal || 0}, Interest: ₹${emi.interest || 0}, Fee: ₹${emi.post_service_fee || 0}, GST: ₹${emi.gst_on_post_service_fee || 0}, Penalty: ₹${penaltyTotal}, DPD int. on total principal: ₹${dpdInterestOnTotalPrincipal})`);

      return emiAmount;
    } else {
      const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
      console.log(`💰 Default payment calculation: Total Repayable = ₹${totalRepayable}`);
      return totalRepayable;
    }
  } catch (error) {
    console.error('❌ Error calculating payment amount:', error);
    throw error;
  }
}

module.exports = { calculatePaymentAmount };
