/**
 * Payment Gateway Routes
 * Handles loan repayment via Cashfree
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const cashfreePayment = require('../services/cashfreePayment');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper function to generate NOC HTML content
 * @param {object} nocData - NOC data object
 * @returns {string} HTML content for NOC document
 */
function generateNOCHTML(nocData) {
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      // Handle YYYY-MM-DD format
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
      }
      // Handle ISO datetime strings
      if (typeof dateString === 'string' && dateString.includes('T')) {
        const datePart = dateString.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [year, month, day] = datePart.split('-');
          return `${day}-${month}-${year}`;
        }
      }
      // Handle MySQL datetime format
      if (typeof dateString === 'string' && dateString.includes(' ')) {
        const datePart = dateString.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [year, month, day] = datePart.split('-');
          return `${day}-${month}-${year}`;
        }
      }
      // Fallback
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const borrowerName = nocData.borrower?.name || 
    `${nocData.borrower?.first_name || ''} ${nocData.borrower?.last_name || ''}`.trim() || 
    'N/A';
  
  const applicationNumber = nocData.loan?.application_number || nocData.loan?.loan_id || 'N/A';
  const shortLoanId = applicationNumber && applicationNumber !== 'N/A' 
    ? `PLL${String(applicationNumber).slice(-4)}`
    : (nocData.loan?.id ? `PLL${String(nocData.loan.id).padStart(4, '0').slice(-4)}` : 'PLLXXX');
  
  const todayDate = formatDate(nocData.generated_at || new Date().toISOString());

  return `
    <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; background-color: white;">
      <div style="padding: 32px;">
        <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px solid #000; padding-bottom: 8px;">
          <h2 style="font-weight: bold; margin-bottom: 4px; font-size: 14pt;">
            SPHEETI FINTECH PRIVATE LIMITED
          </h2>
          <p style="font-size: 12px; margin-bottom: 4px;">
            CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361
          </p>
          <p style="font-size: 12px; margin-bottom: 8px;">
            Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001
          </p>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-weight: bold; font-size: 13pt; text-transform: uppercase;">
            NO DUES CERTIFICATE
          </h1>
        </div>

        <div style="margin-bottom: 16px;">
          <p style="font-size: 12px;">
            <strong>Date :</strong> ${todayDate}
          </p>
        </div>

        <div style="margin-bottom: 16px;">
          <p style="font-size: 12px;">
            <strong>Name of the Customer:</strong> ${borrowerName}
          </p>
        </div>

        <div style="margin-bottom: 16px;">
          <p style="font-size: 12px;">
            <strong>Sub: No Dues Certificate for Loan ID - ${shortLoanId}</strong>
          </p>
        </div>

        <div style="margin-bottom: 16px;">
          <p style="font-weight: bold;">Dear Sir/Madam,</p>
        </div>

        <div style="margin-bottom: 24px; text-align: justify;">
          <p>
            This letter is to confirm that Spheeti Fintech Private Limited has received payment for the aforesaid loan ID and no amount is outstanding and payable by you to the Company under the aforesaid loan ID.
          </p>
        </div>

        <div style="margin-top: 32px;">
          <p style="margin-bottom: 4px; font-weight: bold;">Thanking you,</p>
          <p style="font-weight: bold;">On behalf of Spheeti Fintech Private Limited</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Helper function to generate and send NOC email when loan is cleared
 * @param {number} loanId - Loan ID
 * @returns {Promise<void>}
 */
async function generateAndSendNOCEmail(loanId) {
  try {
    console.log(`📧 Generating and sending NOC email for loan ID: ${loanId}`);

    const emailService = require('../services/emailService');
    const pdfService = require('../services/pdfService');

    // Get loan details
    const loans = await executeQuery(`
      SELECT 
        la.*,
        DATE(la.disbursed_at) as disbursed_at_date,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email, 
        u.phone, u.date_of_birth, u.gender, u.marital_status, u.pan_number
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);

    if (!loans || loans.length === 0) {
      console.error(`❌ Loan #${loanId} not found for NOC email`);
      return;
    }

    const loan = loans[0];

    // Verify loan is cleared
    if (loan.status !== 'cleared') {
      console.log(`ℹ️ Loan #${loanId} is not cleared (status: ${loan.status}), skipping NOC email`);
      return;
    }

    // Get recipient email
    const recipientEmail = loan.personal_email || loan.official_email || loan.email;
    const recipientName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'User';

    if (!recipientEmail) {
      console.error(`❌ No email found for loan #${loanId}, cannot send NOC email`);
      return;
    }

    // Prepare NOC data
    const borrower = {
      name: recipientName,
      first_name: loan.first_name || '',
      last_name: loan.last_name || '',
      email: recipientEmail,
      phone: loan.phone || '',
      date_of_birth: loan.date_of_birth || '',
      gender: loan.gender || '',
      marital_status: loan.marital_status || '',
      pan_number: loan.pan_number || ''
    };

    const company = {
      name: 'SPHEETI FINTECH PRIVATE LIMITED',
      cin: 'U65929MH2018PTC306088',
      rbi_registration: 'N-13.02361',
      address: 'Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001'
    };

    const loanData = {
      id: loan.id,
      application_number: loan.application_number || loan.id,
      loan_id: loan.application_number || loan.id,
      sanctioned_amount: loan.sanctioned_amount || loan.loan_amount || 0,
      loan_amount: loan.loan_amount || loan.sanctioned_amount || 0,
      disbursed_at: loan.disbursed_at || loan.disbursed_at_date,
      status: loan.status
    };

    const nocData = {
      company,
      loan: loanData,
      borrower,
      generated_at: new Date().toISOString()
    };

    // Generate HTML content
    const htmlContent = generateNOCHTML(nocData);

    // Generate PDF
    const filename = `No_Dues_Certificate_${loan.application_number || loanId}.pdf`;
    if (!pdfService) {
      console.error('❌ PDF service not available for NOC email');
      return;
    }

    let pdfResult;
    try {
      pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
      
      let pdfBuffer;
      if (Buffer.isBuffer(pdfResult)) {
        pdfBuffer = pdfResult;
      } else if (pdfResult.buffer) {
        pdfBuffer = pdfResult.buffer;
      } else {
        throw new Error('PDF generation returned invalid result structure');
      }
      
      if (!Buffer.isBuffer(pdfBuffer)) {
        if (pdfBuffer instanceof Uint8Array || pdfBuffer.constructor?.name === 'Uint8Array') {
          pdfBuffer = Buffer.from(pdfBuffer);
        } else {
          throw new Error('PDF generation returned invalid buffer type');
        }
      }
      
      pdfResult.buffer = pdfBuffer;
      console.log('✅ NOC PDF generated for email, size:', pdfBuffer.length, 'bytes');
    } catch (pdfError) {
      console.error('❌ Error generating NOC PDF for email:', pdfError);
      return;
    }

    // Send email
    try {
      await emailService.sendNOCEmail({
        loanId: loan.id,
        recipientEmail: recipientEmail,
        recipientName: recipientName,
        loanData: {
          application_number: loan.application_number || loan.id,
          loan_amount: loan.loan_amount || loan.sanctioned_amount || 0
        },
        pdfBuffer: pdfResult.buffer,
        pdfFilename: filename,
        sentBy: null // System-generated
      });

      console.log(`✅ NOC email sent successfully to ${recipientEmail} for loan #${loanId}`);
    } catch (emailError) {
      console.error('❌ Error sending NOC email:', emailError);
      // Don't throw - email failure shouldn't block loan clearance
    }

  } catch (error) {
    console.error(`❌ Error generating and sending NOC email for loan #${loanId}:`, error);
    // Don't throw - email failure shouldn't block loan clearance
  }
}


/**
 * POST /api/payment/create-order
 * Create a payment order for loan repayment
 */
/**
 * Calculate payment amount based on paymentType and loan data
 * Backend authority - determines correct amount from loan calculation
 * @param {Object} loan - Loan data
 * @param {string} paymentType - Payment type: 'pre-close', 'emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th', 'full_payment'
 * @returns {Promise<number>} Calculated payment amount
 */
async function calculatePaymentAmount(loan, paymentType) {
  const { getLoanCalculation } = require('../utils/loanCalculations');
  const { calculateOutstandingBalance, calculateExtensionFees } = require('../utils/extensionCalculations');
  
  try {
    // Get loan calculation (includes repayment schedule for multi-EMI loans)
    // getLoanCalculation returns { success: true, loanId, status, ...calculation }
    const calculation = await getLoanCalculation(loan.id);
    
    if (!calculation) {
      throw new Error('Failed to get loan calculation');
    }
    
    // getLoanCalculation returns object with success: true and calculation data
    // Use calculation directly as it already has all the data we need
    const calculationData = calculation;
    
    // Determine amount based on paymentType
    if (paymentType === 'pre-close') {
      // Pre-close: Outstanding Balance + Interest Till Today
      const outstandingBalance = calculateOutstandingBalance(loan);
      
      // Get interest till today from calculation
      const interestTillToday = calculationData.interest?.interestTillToday || 0;
      
      // For pre-close, also include penalty if overdue
      const penaltyTotal = calculationData.penalty?.penalty_total || 0;
      
      const precloseAmount = outstandingBalance + interestTillToday + penaltyTotal;
      console.log(`💰 Pre-close calculation: Outstanding (₹${outstandingBalance}) + Interest Till Today (₹${interestTillToday}) + Penalty (₹${penaltyTotal}) = ₹${precloseAmount}`);
      
      return precloseAmount;
    } else if (paymentType === 'full_payment') {
      // Full payment: Total repayable + penalty (if overdue)
      const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
      const penaltyTotal = calculationData.penalty?.penalty_total || 0;
      
      const fullPaymentAmount = totalRepayable + penaltyTotal;
      console.log(`💰 Full payment calculation: Total Repayable (₹${totalRepayable}) + Penalty (₹${penaltyTotal}) = ₹${fullPaymentAmount}`);
      
      return fullPaymentAmount;
    } else if (paymentType && paymentType.startsWith('emi_')) {
      // EMI payment: Get amount from repayment schedule
      const emiNumber = parseInt(paymentType.replace('emi_', '').replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''));
      
      if (isNaN(emiNumber) || emiNumber < 1) {
        throw new Error(`Invalid EMI number in paymentType: ${paymentType}`);
      }
      
      // Get repayment schedule
      const schedule = calculationData.repayment?.schedule || [];
      
      if (schedule.length === 0) {
        // Fallback 1: Try to get EMI amount from loan's emi_schedule JSON column
        // NOTE: emi_schedule is stored as JSON in loan_applications table, not a separate table
        try {
          const { executeQuery } = require('../config/database');
          
          // Get emi_schedule JSON from loan_applications table
          const loanRecords = await executeQuery(
            `SELECT emi_schedule 
             FROM loan_applications 
             WHERE id = ? 
             LIMIT 1`,
            [loan.id]
          );
          
          if (loanRecords && loanRecords.length > 0 && loanRecords[0].emi_schedule) {
            let emiScheduleData = loanRecords[0].emi_schedule;
            
            // Parse JSON if it's a string
            if (typeof emiScheduleData === 'string') {
              try {
                emiScheduleData = JSON.parse(emiScheduleData);
              } catch (parseError) {
                console.warn(`⚠️ Could not parse emi_schedule JSON: ${parseError.message}`);
                emiScheduleData = null;
              }
            }
            
            if (emiScheduleData && Array.isArray(emiScheduleData)) {
              // Find the EMI by number (emi_number or instalment_no)
              const emiRecord = emiScheduleData.find(
                (e) => (e.emi_number === emiNumber || e.instalment_no === emiNumber)
              );
              
              if (emiRecord && emiRecord.emi_amount) {
                const emiAmount = parseFloat(emiRecord.emi_amount);
                if (emiAmount > 0) {
                  console.log(`💰 EMI ${emiNumber} calculation (from loan_applications.emi_schedule JSON): ₹${emiAmount}`);
                  // NOTE: This amount may not include current penalty if EMI became overdue later
                  // The repayment schedule from getLoanCalculation is more accurate
                  return emiAmount;
                }
              }
            }
          }
        } catch (dbError) {
          console.warn(`⚠️ Could not fetch EMI from loan_applications.emi_schedule: ${dbError.message}`);
        }
        
        // Fallback 2: Calculate from loan amount + fees
        const emiCount = parseInt(loan.plan_snapshot ? (typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot).emi_count : 1) || 1;
        const processedAmount = parseFloat(loan.processed_amount || loan.loan_amount || 0);
        
        if (processedAmount > 0) {
          // Get fees from calculation data
          const postServiceFee = calculationData.fees?.post_service_fee || calculationData.post_service_fee || 0;
          const postServiceFeeGST = calculationData.fees?.post_service_fee_gst || calculationData.post_service_fee_gst || 0;
          const totalFees = postServiceFee + postServiceFeeGST;
          
          // Calculate interest (rough estimate: principal * rate * days / 100)
          // For first EMI, use 30 days as estimate
          const interestRatePerDay = parseFloat(loan.interest_percent_per_day || 0.001);
          const estimatedInterest = processedAmount * interestRatePerDay * 30;
          
          // EMI = (Principal + Interest + Fees) / EMI Count
          const totalAmount = processedAmount + estimatedInterest + totalFees;
          const emiAmount = totalAmount / emiCount;
          
          console.log(`💰 EMI ${emiNumber} calculation (fallback from loan amount): Principal (₹${processedAmount}) + Interest (₹${estimatedInterest}) + Fees (₹${totalFees}) / ${emiCount} = ₹${emiAmount}`);
          
          if (emiAmount > 0) {
            return emiAmount;
          }
        }
        
        // Fallback 3: Use total repayable divided by EMI count (last resort)
        const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
        const emiAmount = totalRepayable / emiCount;
        console.log(`💰 EMI ${emiNumber} calculation (fallback from total repayable): Total (₹${totalRepayable}) / ${emiCount} = ₹${emiAmount}`);
        
        // Validate the calculated amount is valid
        if (emiAmount <= 0 || isNaN(emiAmount)) {
          throw new Error(`Cannot calculate EMI ${emiNumber} amount: totalRepayable (₹${totalRepayable}) is invalid or emiCount (${emiCount}) is invalid`);
        }
        
        return emiAmount;
      }
      
      // Find the specific EMI in schedule
      const emi = schedule.find(e => e.emi_number === emiNumber || e.instalment_no === emiNumber);
      
      if (!emi) {
        throw new Error(`EMI ${emiNumber} not found in repayment schedule`);
      }
      
      // EMI amount includes principal + interest + post service fee + GST + penalty (if overdue)
      // PRIORITY: Use instalment_amount if available (includes penalty for overdue EMIs)
      // FALLBACK: Calculate from components (principal + interest + fees + penalty)
      let emiAmount = emi.instalment_amount;
      
      if (!emiAmount || emiAmount <= 0) {
        // Calculate from components
        const principal = emi.principal || 0;
        const interest = emi.interest || 0;
        const postServiceFee = emi.post_service_fee || 0;
        const gstOnPostServiceFee = emi.gst_on_post_service_fee || 0;
        const penaltyTotal = emi.penalty_total || emi.penalty || 0;
        
        emiAmount = principal + interest + postServiceFee + gstOnPostServiceFee + penaltyTotal;
      }
      
      // CRITICAL: If EMI is overdue, ensure penalty is included
      // Check if penalty_total exists in the EMI data (from dynamic calculation)
      const penaltyTotal = emi.penalty_total || emi.penalty || 0;
      
      // If instalment_amount doesn't include penalty but penalty exists, add it
      if (penaltyTotal > 0) {
        const baseAmount = (emi.principal || 0) + (emi.interest || 0) + (emi.post_service_fee || 0) + (emi.gst_on_post_service_fee || 0);
        // Only add penalty if it's not already included in instalment_amount
        // We check by comparing: if instalment_amount ≈ baseAmount, then penalty is missing
        const tolerance = 0.01; // 1 paise tolerance
        if (Math.abs(emiAmount - baseAmount) < tolerance) {
          // Penalty is not included, add it
          emiAmount = emiAmount + penaltyTotal;
          console.log(`💰 EMI ${emiNumber}: Adding penalty (₹${penaltyTotal}) to base amount (₹${baseAmount}) = ₹${emiAmount}`);
        }
      }
      
      console.log(`💰 EMI ${emiNumber} calculation: ₹${emiAmount} (Principal: ₹${emi.principal || 0}, Interest: ₹${emi.interest || 0}, Fee: ₹${emi.post_service_fee || 0}, GST: ₹${emi.gst_on_post_service_fee || 0}, Penalty: ₹${penaltyTotal})`);
      
      return emiAmount;
    } else {
      // Default: use total repayable
      const totalRepayable = calculationData.total?.repayable || calculationData.total_repayable || 0;
      console.log(`💰 Default payment calculation: Total Repayable = ₹${totalRepayable}`);
      return totalRepayable;
    }
  } catch (error) {
    console.error('❌ Error calculating payment amount:', error);
    throw error;
  }
}

router.post('/create-order', authenticateToken, async (req, res) => {
    let orderId = null; // Initialize to avoid scope issues in error handling
    
    try {
        const userId = req.user.id;
        
        const { loanId, amount, paymentType } = req.body; // paymentType: 'pre-close', 'emi_1st', 'emi_2nd', 'emi_3rd', etc.

        // Validate input
        if (!loanId) {
            return res.status(400).json({
                success: false,
                message: 'Loan ID is required'
            });
        }
        
        // Amount is now optional - backend will calculate it
        // But we'll validate it if provided to ensure frontend matches backend

        // Validate paymentType if provided
        if (paymentType && !['pre-close', 'emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th', 'full_payment', 'loan_repayment'].includes(paymentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment type. Must be: pre-close, emi_1st, emi_2nd, emi_3rd, emi_4th, full_payment, or loan_repayment'
            });
        }

        // Fetch loan details with all email fields and plan snapshot, including status
        const [loan] = await executeQuery(
            `SELECT la.*, 
                    CONCAT(u.first_name, ' ', u.last_name) as name,
                    u.email, 
                    u.personal_email,
                    u.official_email,
                    u.phone 
             FROM loan_applications la 
             JOIN users u ON la.user_id = u.id 
             WHERE la.id = ? AND la.user_id = ?`,
            [loanId, userId]
        );

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Check if loan is cleared - if cleared, don't allow more payments
        if (loan.status === 'cleared') {
            return res.status(400).json({
                success: false,
                message: 'This loan has already been cleared. No further payments are required.'
            });
        }

        // Validate loan has required fields
        if (!loan.application_number) {
            console.error('[Payment] Loan missing application_number:', { loanId, userId });
            return res.status(400).json({
                success: false,
                message: 'Loan application number is missing. Please contact support.'
            });
        }

        // Parse plan snapshot to get EMI count
        let planSnapshot = {};
        let emiCount = 1;
        try {
            planSnapshot = typeof loan.plan_snapshot === 'string' 
                ? JSON.parse(loan.plan_snapshot) 
                : loan.plan_snapshot || {};
            emiCount = planSnapshot.emi_count || 1;
        } catch (e) {
            console.error('[Payment] Error parsing plan_snapshot:', e);
        }

        // Determine payment type if not provided
        let finalPaymentType = paymentType;
        
        // CRITICAL: If paymentType is explicitly provided (especially 'pre-close' or 'full_payment'), ALWAYS use it and skip ALL auto-detection
        if (finalPaymentType === 'pre-close' || finalPaymentType === 'full_payment') {
            // Explicitly provided pre-close or full_payment - use it as-is, skip ALL auto-detection
            // DO NOT fall through to auto-detection - finalPaymentType is already set correctly
        } else if (!finalPaymentType) {
            // Auto-detect payment type only if not provided
            // Check if this is a single payment loan (emi_count = 1)
            if (emiCount === 1) {
                // For single payment loans, use 'full_payment' which will clear immediately
                finalPaymentType = 'full_payment';
            } else {
                // Multi-EMI loan: Auto-detect based on paid EMIs
                // Note: We can't use amount for detection anymore since it's optional
                // So we'll determine based on which EMIs have been paid
                const paidEmis = await executeQuery(
                    `SELECT payment_type 
                     FROM payment_orders 
                     WHERE loan_id = ? 
                     AND payment_type IN ('emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th')
                     AND status = 'PAID'
                     ORDER BY payment_type`,
                    [loanId]
                );
                
                const paidEmiNumbers = paidEmis.map(t => {
                    if (t.payment_type === 'emi_1st') return 1;
                    if (t.payment_type === 'emi_2nd') return 2;
                    if (t.payment_type === 'emi_3rd') return 3;
                    if (t.payment_type === 'emi_4th') return 4;
                    return 0;
                }).sort((a, b) => a - b);
                
                // Find next unpaid EMI
                let nextEmi = 1;
                for (let i = 1; i <= emiCount; i++) {
                    if (!paidEmiNumbers.includes(i)) {
                        nextEmi = i;
                        break;
                    }
                }
                
                if (nextEmi === 1) finalPaymentType = 'emi_1st';
                else if (nextEmi === 2) finalPaymentType = 'emi_2nd';
                else if (nextEmi === 3) finalPaymentType = 'emi_3rd';
                else if (nextEmi === 4) finalPaymentType = 'emi_4th';
                else finalPaymentType = 'loan_repayment'; // Fallback
            }
        }
        
        // Ensure finalPaymentType is set (should never be null/undefined at this point)
        if (!finalPaymentType) {
            return res.status(400).json({
                success: false,
                message: 'Payment type is required. Please specify paymentType in the request.'
            });
        }
        
        // CRITICAL: If paymentType was explicitly 'pre-close' or 'full_payment', ensure it's preserved
        // This is a defensive check to prevent any accidental overrides
        if (paymentType === 'pre-close' || paymentType === 'full_payment') {
            if (finalPaymentType !== paymentType) {
                console.warn(`[Payment] ⚠️ WARNING: paymentType was "${paymentType}" but finalPaymentType became "${finalPaymentType}". Correcting to preserve original type.`);
                finalPaymentType = paymentType;
            }
        }
        
        // BACKEND AUTHORITY: Calculate amount from backend based on paymentType
        // Frontend amount is now optional/deprecated - backend determines the correct amount
        let calculatedAmount;
        try {
            calculatedAmount = await calculatePaymentAmount(loan, finalPaymentType);
            console.log(`💰 Backend calculated amount for ${finalPaymentType}: ₹${calculatedAmount}`);
        } catch (calcError) {
            console.error('❌ Error calculating payment amount from backend:', calcError);
            // If calculation fails, fall back to frontend amount if provided
            if (!amount) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to calculate payment amount. Please try again or contact support.',
                    error: calcError.message
                });
            }
            calculatedAmount = parseFloat(amount);
            console.warn(`⚠️ Using frontend amount as fallback: ₹${calculatedAmount}`);
        }
        
        // Validate frontend amount if provided (strict validation with 1 paise tolerance)
        if (amount !== undefined && amount !== null) {
            const frontendAmount = parseFloat(amount);
            const amountDiff = Math.abs(frontendAmount - calculatedAmount);
            
            // Allow 0.01 (1 paise) tolerance for rounding differences
            if (amountDiff > 0.01) {
                console.warn(`⚠️ Frontend amount (₹${frontendAmount}) differs from backend calculated amount (₹${calculatedAmount}) by ₹${amountDiff.toFixed(2)}`);
                // Still use backend amount, but log the difference
                // In production, you might want to reject mismatched amounts for security
            }
        }
        
        // Use backend-calculated amount (source of truth)
        const finalAmount = calculatedAmount;
        
        // CRITICAL: Validate amount is valid before creating order
        if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
            console.error(`❌ [Payment] Invalid calculated amount for ${finalPaymentType}: ₹${finalAmount}`);
            return res.status(400).json({
                success: false,
                message: `Cannot create payment order: Invalid amount calculated (₹${finalAmount}). Please contact support.`,
                error: 'INVALID_AMOUNT',
                calculatedAmount: finalAmount,
                paymentType: finalPaymentType
            });
        }

        // Validate sequential EMI payments (only for EMI types, skip for pre-close/full_payment)
        // IMPORTANT: Only check if loan is NOT cleared
        if (finalPaymentType && finalPaymentType.startsWith('emi_') && loan.status !== 'cleared') {
            // Get which EMIs have been paid using payment_orders table
            const paidEmis = await executeQuery(
                `SELECT payment_type 
                 FROM payment_orders 
                 WHERE loan_id = ? 
                 AND payment_type IN ('emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th')
                 AND status = 'PAID'
                 ORDER BY payment_type`,
                [loanId]
            );
            
            const paidEmiNumbers = paidEmis.map(t => {
                if (t.payment_type === 'emi_1st') return 1;
                if (t.payment_type === 'emi_2nd') return 2;
                if (t.payment_type === 'emi_3rd') return 3;
                if (t.payment_type === 'emi_4th') return 4;
                return 0;
            }).sort((a, b) => a - b);
            
            // Determine which EMI user is trying to pay
            let requestedEmiNumber = 0;
            if (finalPaymentType === 'emi_1st') requestedEmiNumber = 1;
            else if (finalPaymentType === 'emi_2nd') requestedEmiNumber = 2;
            else if (finalPaymentType === 'emi_3rd') requestedEmiNumber = 3;
            else if (finalPaymentType === 'emi_4th') requestedEmiNumber = 4;
            
            // Check if this EMI was already paid (only if loan is not cleared)
            if (paidEmiNumbers.includes(requestedEmiNumber)) {
                return res.status(400).json({
                    success: false,
                    message: `${finalPaymentType.replace('_', ' ').toUpperCase()} has already been paid. Please pay the next unpaid EMI.`
                });
            }
            
            // Check if previous EMIs are paid (sequential validation)
            for (let i = 1; i < requestedEmiNumber; i++) {
                if (!paidEmiNumbers.includes(i)) {
                    const emiName = i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : `${i}th`;
                    return res.status(400).json({
                        success: false,
                        message: `Please pay ${emiName} EMI first before paying ${finalPaymentType.replace('_', ' ').toUpperCase()}. EMIs must be paid in sequential order.`
                    });
                }
            }
        }

        // Get email - use personal_email, official_email, or email (in that priority order)
        const customerEmail = loan.personal_email || loan.official_email || loan.email;
        
        // Validate customer details
        if (!customerEmail) {
            console.error('[Payment] Loan missing customer email:', { 
                loanId, 
                userId,
                hasEmail: !!loan.email,
                hasPersonalEmail: !!loan.personal_email,
                hasOfficialEmail: !!loan.official_email
            });
            return res.status(400).json({
                success: false,
                message: 'Customer email is required for payment processing. Please update your email in profile settings.'
            });
        }

        // Check if there's an existing pending or paid order for this loan WITH THE SAME PAYMENT TYPE
        // This prevents reusing order IDs for different payment types (e.g., emi_1st vs emi_2nd)
        const orderPaymentType = finalPaymentType || 'loan_repayment';
        const existingOrders = await executeQuery(
            `SELECT order_id, status, amount, payment_session_id, payment_type, 
             DATE_FORMAT(created_at, '%Y-%m-%d') as created_at 
             FROM payment_orders 
             WHERE loan_id = ? AND user_id = ? AND payment_type = ? AND status IN ('PENDING', 'PAID')
             ORDER BY created_at DESC 
             LIMIT 1`,
            [loanId, userId, orderPaymentType]
        );

        if (existingOrders.length > 0) {
            const existingOrder = existingOrders[0];

            // If there's a PAID order with the same payment type, check if payment was actually processed
            if (existingOrder.status === 'PAID') {
                // Check if loan payment record exists
                const paymentRecord = await executeQuery(
                    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                    [existingOrder.order_id, loanId]
                );

                if (paymentRecord.length > 0) {
                    // Check current loan status first - if cleared, don't allow more payments
                    const currentLoanStatus = await executeQuery(
                        `SELECT status FROM loan_applications WHERE id = ?`,
                        [loanId]
                    );
                    
                    if (currentLoanStatus.length > 0 && currentLoanStatus[0].status === 'cleared') {
                        return res.status(400).json({
                            success: false,
                            message: 'This loan has already been cleared. No further payments are required.'
                        });
                    }
                    
                    // Even if payment is processed, check if loan should be cleared
                    try {
                        const loanDetails = await executeQuery(
                            `SELECT 
                                id, processed_amount, loan_amount,
                                processed_post_service_fee, fees_breakdown, plan_snapshot,
                                status
                            FROM loan_applications 
                            WHERE id = ?`,
                            [loanId]
                        );

                        if (loanDetails.length > 0) {
                            const loan = loanDetails[0];
                            
                            // Only check for cleared status if loan is in account_manager or overdue status
                            if (loan.status === 'account_manager' || loan.status === 'overdue') {
                                // Calculate total payments made for this loan
                                const totalPaymentsResult = await executeQuery(
                                    `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                     FROM loan_payments 
                                     WHERE loan_id = ? AND status = 'SUCCESS'`,
                                    [loanId]
                                );
                                
                                const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                
                                // Calculate outstanding balance
                                const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                const outstandingBalance = calculateOutstandingBalance(loan);
                                
                                console.log(`💰 Checking if loan #${loanId} should be cleared:`, {
                                    totalPaid: totalPaid,
                                    outstandingBalance: outstandingBalance,
                                    remaining: outstandingBalance - totalPaid
                                });
                                
                                // If total payments >= outstanding balance (with small tolerance for rounding)
                                if (totalPaid >= outstandingBalance - 0.01) {
                                    // Mark loan as cleared
                                    await executeQuery(
                                        `UPDATE loan_applications 
                                         SET status = 'cleared', updated_at = NOW() 
                                         WHERE id = ?`,
                                        [loanId]
                                    );
                                    
                                    console.log(`✅ Loan #${loanId} fully paid and marked as CLEARED`);
                                    
                                    // Credit limit recalculation removed - now happens on loan disbursement, not on loan clearance
                                    
                                    // Check if user should be moved to cooling period after clearing this loan
                                    // Cooling period triggers when user reaches 32.1% (₹1,50,000) after clearing a loan
                                    try {
                                        const { calculateCreditLimitFor2EMI, checkAndMarkCoolingPeriod } = require('../utils/creditLimitCalculator');
                                        
                                        // Recalculate credit limit to check if user reached premium limit (32.1%)
                                        const creditLimitData = await calculateCreditLimitFor2EMI(loan.user_id);
                                        
                                        if (creditLimitData.newLimit === 150000 && creditLimitData.percentage === 32.1) {
                                            // User has reached premium limit (32.1% = ₹1,50,000) - mark in cooling period
                                            await checkAndMarkCoolingPeriod(loan.user_id, loanId, creditLimitData);
                                            console.log(`[Payment] User ${loan.user_id} moved to cooling period after clearing loan #${loanId} (reached 32.1% = ₹1,50,000)`);
                                        }
                                    } catch (coolingPeriodError) {
                                        console.error('❌ Error checking cooling period after loan clearance (non-fatal):', coolingPeriodError);
                                        // Don't fail - cooling period check failure shouldn't block loan clearance
                                    }
                                    
                                    // Send NOC email to user
                                    try {
                                        await generateAndSendNOCEmail(loanId);
                                    } catch (nocEmailError) {
                                        console.error('❌ Error sending NOC email (non-fatal):', nocEmailError);
                                        // Don't fail - email failure shouldn't block loan clearance
                                    }
                                }
                            }
                        }
                    } catch (clearanceError) {
                        console.error('❌ Error checking if loan should be cleared:', clearanceError);
                        // Don't fail the response, just log the error
                    }
                    
                    return res.json({
                        success: true,
                        message: 'Payment already processed',
                        data: {
                            orderId: existingOrder.order_id,
                            status: 'PAID',
                            alreadyProcessed: true
                        }
                    });
                } else {
                    // Payment marked as PAID but not processed - trigger processing
                    // Continue to create new order or return existing one with note to check status
                    return res.json({
                        success: true,
                        message: 'Payment order exists but needs verification',
                        data: {
                            orderId: existingOrder.order_id,
                            status: existingOrder.status,
                            paymentSessionId: existingOrder.payment_session_id,
                            needsVerification: true,
                            checkoutUrl: existingOrder.payment_session_id 
                                ? `https://payments.cashfree.com/checkout/${existingOrder.payment_session_id}`
                                : null
                        }
                    });
                }
            } else if (existingOrder.status === 'PENDING') {
                // CRITICAL: Check if existing order amount matches newly calculated amount
                // If amounts don't match (e.g., penalty was added), create new order with correct amount
                const existingAmount = parseFloat(existingOrder.amount || 0);
                const amountDifference = Math.abs(existingAmount - finalAmount);
                
                // If amounts differ by more than 1 paise (0.01), create new order
                if (amountDifference > 0.01) {
                    console.warn(`⚠️ [Payment] Existing PENDING order amount (₹${existingAmount}) differs from calculated amount (₹${finalAmount}). Creating new order.`);
                    // Mark old order as expired due to amount mismatch
                    try {
                        await executeQuery(
                            `UPDATE payment_orders SET status = 'EXPIRED', updated_at = NOW() WHERE order_id = ?`,
                            [existingOrder.order_id]
                        );
                        console.log(`✅ Marked old order ${existingOrder.order_id} as EXPIRED due to amount mismatch`);
                    } catch (updateError) {
                        console.warn('[Payment] Could not mark old order as expired:', updateError);
                    }
                    // Continue to create new order below with correct amount
                } else {
                    // Check if pending order is too old (more than 30 minutes) - create new order
                    const orderAge = Date.now() - new Date(existingOrder.created_at).getTime();
                    const thirtyMinutes = 30 * 60 * 1000;
                    
                    if (orderAge > thirtyMinutes) {
                        // Mark old order as expired and continue to create new order
                        try {
                            await executeQuery(
                                `UPDATE payment_orders SET status = 'EXPIRED', updated_at = NOW() WHERE order_id = ?`,
                                [existingOrder.order_id]
                            );
                        } catch (updateError) {
                            console.warn('[Payment] Could not mark old order as expired:', updateError);
                        }
                        // Continue to create new order below
                    } else {
                        // Amount matches and order is recent - return existing pending order
                        console.log(`✅ Using existing PENDING order ${existingOrder.order_id} with matching amount ₹${existingAmount}`);
                        return res.json({
                            success: true,
                            message: 'Existing payment order found',
                            data: {
                                orderId: existingOrder.order_id,
                                status: 'PENDING',
                                paymentSessionId: existingOrder.payment_session_id,
                                checkoutUrl: existingOrder.payment_session_id 
                                    ? `https://payments.cashfree.com/checkout/${existingOrder.payment_session_id}`
                                    : null
                            }
                        });
                    }
                }
            }
        }

        // Generate unique order ID with payment type to ensure uniqueness per payment type
        // Format: LOAN_{app_number}_{payment_type}_{timestamp}
        // This ensures each payment type (emi_1st, emi_2nd, etc.) gets a unique order ID
        // Replace '-' with '_' and keep underscores for payment types like 'emi_1st'
        const paymentTypeSuffix = finalPaymentType ? `_${finalPaymentType.replace(/-/g, '_')}` : '';
        orderId = `LOAN_${loan.application_number}${paymentTypeSuffix}_${Date.now()}`;

        // Create payment order in database
        // Insert payment order with payment type
        try {
            // Use finalPaymentType or default to 'loan_repayment'
            const orderPaymentType = finalPaymentType || 'loan_repayment';
            await executeQuery(
                `INSERT INTO payment_orders (
            order_id, loan_id, user_id, amount, payment_type, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'PENDING', NOW())`,
                [orderId, loanId, userId, finalAmount, orderPaymentType]
            );
        } catch (insertError) {
            console.error('[Payment] Failed to insert payment order:', insertError);
            // If it's a duplicate key error, that's okay - order already exists
            if (insertError.message && insertError.message.includes('Duplicate entry')) {
                // Order already exists, continue
            } else {
                throw insertError; // Re-throw if it's a different error
            }
        }

        // Validate Cashfree service is configured
        // Check environment variables directly since service properties might not be exposed
        if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
            console.error('[Payment] Cashfree credentials not configured in environment');
            return res.status(503).json({
                success: false,
                message: 'Payment gateway is not configured. Please contact support.',
                error: 'CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET not set'
            });
        }

        // Create Cashfree order
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001';
        const returnUrl = `${frontendUrl}/payment/return?orderId=${orderId}`;
        const notifyUrl = `${backendUrl}/api/payment/webhook`;

        const orderResult = await cashfreePayment.createOrder({
            orderId,
            amount: finalAmount, // Use backend-calculated amount
            customerName: loan.name || 'Customer',
            customerEmail: customerEmail, // Use the resolved email
            customerPhone: loan.phone || '9999999999', // Default phone if missing
            returnUrl,
            notifyUrl
        });

        if (!orderResult.success) {
            console.error('[Payment] Cashfree order creation failed:', orderResult.error);
            
            // Update order status to FAILED
            await executeQuery(
                `UPDATE payment_orders 
           SET status = 'FAILED', updated_at = NOW() 
           WHERE order_id = ?`,
                [orderId]
            );
            
            const statusCode = orderResult.statusCode || 500;
            return res.status(statusCode).json({
                success: false,
                message: orderResult.error || 'Failed to create payment order',
                error: orderResult.error
            });
        }

        // Extract and clean payment_session_id
        let paymentSessionId = orderResult.data.payment_session_id;
        if (!paymentSessionId) {
            console.error('[Payment] No payment_session_id in Cashfree response');
            return res.status(500).json({
                success: false,
                message: 'Payment gateway did not return a valid session. Please try again.',
                error: 'Missing payment_session_id in response'
            });
        }

        // Clean the session ID - remove any trailing garbage (like "paymentpayment")
        // Session IDs should start with "session_" and be alphanumeric with dashes/underscores
        const cleanSessionId = paymentSessionId
            .trim()
            .split(/\s+/)[0]  // Take first part if there are spaces
            .replace(/[^a-zA-Z0-9_\-]/g, '') // Remove any invalid characters
            .replace(/paymentpayment$/i, ''); // Remove trailing "paymentpayment" if present
        
        console.log('[Payment] Payment session ID processing:', {
            original: paymentSessionId.substring(0, 50) + '...',
            originalLength: paymentSessionId.length,
            cleaned: cleanSessionId.substring(0, 50) + '...',
            cleanedLength: cleanSessionId.length,
            isValid: cleanSessionId.startsWith('session_')
        });

        if (!cleanSessionId.startsWith('session_')) {
            console.error('[Payment] Invalid session ID format after cleaning');
            return res.status(500).json({
                success: false,
                message: 'Invalid payment session received. Please try again.',
                error: 'Session ID does not start with "session_"'
            });
        }

        // Update order with cleaned payment_session_id
        await executeQuery(
            `UPDATE payment_orders 
       SET payment_session_id = ?, cashfree_response = ? 
       WHERE order_id = ?`,
            [
                cleanSessionId,
                JSON.stringify(orderResult.data),
                orderId
            ]
        );

        // Create a clean response object with cleaned session ID
        const cleanOrderResponse = {
            ...orderResult.data,
            payment_session_id: cleanSessionId
        };

        // Get checkout URL - pass clean response to handle payment_link if available
        let checkoutUrl;
        try {
            checkoutUrl = cashfreePayment.getCheckoutUrl(cleanOrderResponse);
            
            // Verify URL format
            if (!checkoutUrl || !checkoutUrl.startsWith('http')) {
                throw new Error(`Invalid checkout URL format: ${checkoutUrl}`);
            }
            
            // Verify environment match
            const isSandboxSession = checkoutUrl.includes('payments-test.cashfree.com');
            const isProductionSession = checkoutUrl.includes('payments.cashfree.com');
            const isSandboxAPI = cashfreePayment.baseURL.includes('sandbox');
            
            if (isSandboxAPI && !isSandboxSession) {
                console.warn('[Payment] WARNING: Sandbox API but production checkout URL detected');
            }
            if (!isSandboxAPI && !isProductionSession) {
                console.warn('[Payment] WARNING: Production API but sandbox checkout URL detected');
            }
            
        } catch (urlError) {
            console.error('[Payment] Failed to generate checkout URL:', urlError);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate payment URL. Please try again.',
                error: urlError.message
            });
        }

        console.log('✅ Payment order created:', { 
            orderId, 
            checkoutUrl,
            environment: cashfreePayment.isProduction ? 'PRODUCTION' : 'SANDBOX'
        });

        res.json({
            success: true,
            data: {
                orderId,
                paymentSessionId: cleanSessionId, // Use cleaned session ID
                checkoutUrl
            }
        });

    } catch (error) {
        console.error('❌ Error creating payment order:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Order ID at error:', orderId);
        
        // Provide more helpful error messages
        let errorMessage = 'Internal server error';
        let statusCode = 500;
        
        if (error.message) {
            if (error.message.includes('orderId')) {
                errorMessage = 'Failed to process payment order. Please try again.';
            } else if (error.message.includes('doesn\'t exist') || error.message.includes('Unknown table')) {
                errorMessage = 'Payment system is not properly configured. Please contact support.';
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
                errorMessage = 'Payment gateway is temporarily unavailable. Please try again later.';
                statusCode = 503;
            } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
                errorMessage = 'Payment gateway authentication failed. Please contact support.';
                statusCode = 503;
            } else {
                errorMessage = error.message;
            }
        }
        
        // Always log full error details for debugging
        console.error('[Payment] Full error details:', {
            message: error.message,
            code: error.code,
            orderId: orderId,
            loanId: req.body?.loanId,
            amount: req.body?.amount
        });
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production' ? error.message : undefined
        });
    }
});

/**
 * POST /api/payment/webhook
 * Cashfree webhook for payment status
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        
        // Handle different body formats
        let payload;
        if (Buffer.isBuffer(req.body)) {
            // Body is a Buffer (raw)
            try {
                payload = JSON.parse(req.body.toString('utf8'));
            } catch (parseError) {
                console.error('❌ Failed to parse Buffer body:', parseError);
                return res.status(400).json({ message: 'Invalid webhook payload format' });
            }
        } else if (typeof req.body === 'string') {
            // Body is a string - check if it's valid JSON
            const trimmed = req.body.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    payload = JSON.parse(req.body);
                } catch (parseError) {
                    console.error('❌ Failed to parse string body:', parseError, 'Body:', req.body);
                    return res.status(400).json({ message: 'Invalid webhook payload format' });
                }
            } else {
                console.error('❌ Invalid JSON string in webhook body (not starting with { or [):', req.body);
                return res.status(400).json({ message: 'Invalid webhook payload format' });
            }
        } else if (typeof req.body === 'object' && req.body !== null) {
            // Already an object (parsed by global express.json middleware)
            payload = req.body;
        } else {
            console.error('❌ Unexpected webhook body type:', typeof req.body, 'Value:', req.body);
            return res.status(400).json({ message: 'Invalid webhook payload' });
        }
        
        // Validate payload structure
        if (!payload || typeof payload !== 'object') {
            console.error('❌ Invalid payload structure:', payload);
            return res.status(400).json({ message: 'Invalid webhook payload structure' });
        }

        console.log('🔔 Payment webhook received:', payload);

        // Verify signature (optional but recommended)
        // const isValid = cashfreePayment.verifyWebhookSignature(signature, payload);
        // if (!isValid) {
        //   console.error('❌ Invalid webhook signature');
        //   return res.status(401).json({ message: 'Invalid signature' });
        // }

        const { order, payment } = payload.data || {};
        if (!order) {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        const orderId = order.order_id;
        const orderAmount = order.order_amount;
        
        // Extract bank reference number from payment object
        // Cashfree provides bank reference in various fields: payment_message, payment_utr, bank_reference_number, utr
        const bankReferenceNumber = payment?.payment_message || 
                                   payment?.payment_utr || 
                                   payment?.bank_reference_number || 
                                   payment?.utr || 
                                   payment?.reference_number ||
                                   null;
        
        console.log(`💰 Bank reference number extracted: ${bankReferenceNumber || 'Not found'} (from payment object)`, {
            payment_message: payment?.payment_message,
            payment_utr: payment?.payment_utr,
            bank_reference_number: payment?.bank_reference_number,
            utr: payment?.utr,
            reference_number: payment?.reference_number
        });
        
        // Determine order status from webhook
        // Cashfree webhook doesn't include order_status directly
        // We need to derive it from payment_status or webhook type
        let orderStatus = 'PENDING'; // Default
        
        if (payment) {
            // If payment_status is SUCCESS, order is PAID
            if (payment.payment_status === 'SUCCESS') {
                orderStatus = 'PAID';
            } else if (payment.payment_status === 'FAILED') {
                orderStatus = 'FAILED';
            }
        }
        
        // Also check webhook type
        if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
            orderStatus = 'PAID';
        } else if (payload.type === 'PAYMENT_FAILED_WEBHOOK' || payload.type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
            orderStatus = 'FAILED';
        }

        console.log(`💰 Webhook order status determined: ${orderStatus} (from payment_status: ${payment?.payment_status}, type: ${payload.type})`);

        // Update payment order status
        await executeQuery(
            `UPDATE payment_orders 
       SET status = ?, webhook_data = ?, updated_at = NOW() 
       WHERE order_id = ?`,
            [orderStatus, JSON.stringify(payload), orderId]
        );

        // If payment succeeded, process based on payment type
        if (orderStatus === 'PAID') {
            const [paymentOrder] = await executeQuery(
                'SELECT loan_id, extension_id, payment_type, user_id, amount FROM payment_orders WHERE order_id = ?',
                [orderId]
            );

            if (paymentOrder) {
                // Check if this is an extension payment
                if (paymentOrder.payment_type === 'extension_fee' && paymentOrder.extension_id) {
                    console.log('✅ Extension payment successful, auto-approving extension:', {
                        extensionId: paymentOrder.extension_id,
                        orderId,
                        amount: orderAmount
                    });

                    try {
                        // First check if extension is already approved (by order-status check) - skip if so
                        const extensionStatusCheck = await executeQuery(
                            `SELECT status, payment_status FROM loan_extensions WHERE id = ?`,
                            [paymentOrder.extension_id]
                        );
                        
                        if (extensionStatusCheck.length > 0) {
                            const extStatus = extensionStatusCheck[0];
                            if (extStatus.status === 'approved' && extStatus.payment_status === 'paid') {
                                console.log(`ℹ️ Extension #${paymentOrder.extension_id} is already approved (by order-status check), skipping webhook processing`);
                                // Skip processing if already approved, but continue to send webhook response
                            } else {
                                // Check if transaction already exists for this order to avoid duplicates
                                const existingTransaction = await executeQuery(
                                    `SELECT id FROM transactions WHERE reference_number = ? AND loan_application_id = ? AND transaction_type LIKE 'loan_extension_%'`,
                                    [bankReferenceNumber || orderId, paymentOrder.loan_id]
                                );
                                
                                if (existingTransaction.length > 0) {
                                    console.log(`ℹ️ Transaction already exists for extension payment order ${orderId}, skipping duplicate`);
                                } else {
                                    // Import and use the approval function
                                    const { approveExtension } = require('../utils/extensionApproval');
                                    const approvalResult = await approveExtension(
                                        paymentOrder.extension_id,
                                        bankReferenceNumber || orderId, // Use bank reference number if available, otherwise fallback to orderId
                                        null // No admin ID for auto-approval
                                    );

                                    console.log('✅ Extension auto-approved:', approvalResult);

                                    // Send extension letter email after successful payment
                                    try {
                                        const emailService = require('../services/emailService');
                                        const pdfService = require('../services/pdfService');
                                        
                                        // Get extension and loan details for email
                                        const extensionDetails = await executeQuery(`
                                SELECT 
                                    le.*,
                                    la.application_number,
                                    la.processed_at,
                                    la.processed_due_date,
                                    la.plan_snapshot,
                                    u.first_name,
                                    u.last_name,
                                    u.email,
                                    u.personal_email,
                                    u.official_email,
                                    u.salary_date
                                FROM loan_extensions le
                                INNER JOIN loan_applications la ON le.loan_application_id = la.id
                                INNER JOIN users u ON la.user_id = u.id
                                            WHERE le.id = ?
                                        `, [paymentOrder.extension_id]);

                                        if (extensionDetails && extensionDetails.length > 0) {
                                            const ext = extensionDetails[0];
                                            const recipientEmail = ext.personal_email || ext.official_email || ext.email;
                                            
                                            if (recipientEmail) {
                                                try {
                                                    // Get loan details
                                                    const loanDetails = await executeQuery(`
                                            SELECT 
                                                la.*,
                                                u.first_name, u.last_name, u.email, u.personal_email, u.official_email,
                                                u.salary_date
                                            FROM loan_applications la
                                            INNER JOIN users u ON la.user_id = u.id
                                            WHERE la.id = ?
                                        `, [ext.loan_application_id]);
                                        
                                        if (!loanDetails || loanDetails.length === 0) {
                                            console.warn('⚠️ Loan not found for extension letter email');
                                            return;
                                        }
                                        
                                        const loan = loanDetails[0];
                                        
                                        // Get extension letter data (reuse existing logic from kfs.js)
                                        // For now, we'll generate a simple HTML from extension data
                                        // In production, you might want to use the full extension letter template
                                        
                                        // Parse extension dates
                                        let originalDueDate = ext.original_due_date;
                                        let newDueDate = ext.new_due_date;
                                        try {
                                            if (typeof originalDueDate === 'string' && originalDueDate.startsWith('[')) {
                                                const parsed = JSON.parse(originalDueDate);
                                                originalDueDate = Array.isArray(parsed) ? parsed[0] : originalDueDate;
                                            }
                                            if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
                                                const parsed = JSON.parse(newDueDate);
                                                newDueDate = Array.isArray(parsed) ? parsed[0] : newDueDate;
                                            }
                                        } catch (e) {
                                            // Keep original values if parsing fails
                                        }
                                        
                                        // Generate HTML content (simplified - you can enhance this to match your template)
                                        const htmlContent = `
                                            <!DOCTYPE html>
                                            <html>
                                            <head>
                                                <meta charset="UTF-8">
                                                <title>Extension Letter</title>
                                            </head>
                                            <body style="font-family: Arial, sans-serif; padding: 20px;">
                                                <h1>Loan Extension Letter</h1>
                                                <p><strong>Application Number:</strong> ${loan.application_number}</p>
                                                <p><strong>Extension Number:</strong> ${ext.extension_number}</p>
                                                <h2>Extension Details</h2>
                                                <p>Extension Fee: ₹${ext.extension_fee}</p>
                                                <p>GST: ₹${ext.gst_amount}</p>
                                                <p>Interest Till Date: ₹${ext.interest_till_date}</p>
                                                <p>Total Amount: ₹${ext.total_extension_amount}</p>
                                                <p>Original Due Date: ${originalDueDate}</p>
                                                <p>New Due Date: ${newDueDate}</p>
                                                <p>Extension Period: ${ext.extension_period_days} days</p>
                                            </body>
                                                        </html>
                                                    `;
                                                    
                                                    // Generate PDF from HTML
                                                    const filename = `Extension_Letter_${loan.application_number}.pdf`;
                                                    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);

                                                    // Send email with PDF
                                                    await emailService.sendExtensionLetterEmail({
                                                        loanId: ext.loan_application_id,
                                                        recipientEmail,
                                                        recipientName: `${ext.first_name} ${ext.last_name || ''}`.trim(),
                                                        loanData: {
                                                            application_number: loan.application_number
                                                        },
                                                        pdfBuffer: pdfResult.buffer,
                                                        pdfFilename: filename,
                                                        sentBy: 'system'
                                                    });

                                                    console.log('✅ Extension letter email sent to:', recipientEmail);
                                                } catch (emailError) {
                                                    console.error('❌ Error sending extension letter email (non-fatal):', emailError);
                                                    // Don't fail the webhook if email fails
                                                }
                                            }
                                        }
                                    } catch (emailError) {
                                        console.error('❌ Error sending extension letter email (non-fatal):', emailError);
                                        // Don't fail the webhook if email fails
                                    }
                                }
                            }
                        } else {
                            console.warn(`⚠️ Extension #${paymentOrder.extension_id} not found`);
                        }
                    } catch (approvalError) {
                        console.error('❌ Error auto-approving extension:', approvalError);
                        // Log error but don't fail the webhook - payment was successful
                    }
                } else {
                    // Loan repayment (pre-close or EMI)
                    const paymentType = paymentOrder.payment_type || 'loan_repayment';
                    console.log(`💳 Processing ${paymentType} payment for loan: ${paymentOrder.loan_id}`);
                    
                    // First check if loan is already cleared (by order-status check) - skip if so
                    const loanStatusCheck = await executeQuery(
                        `SELECT status FROM loan_applications WHERE id = ?`,
                        [paymentOrder.loan_id]
                    );
                    
                    if (loanStatusCheck.length > 0 && loanStatusCheck[0].status === 'cleared') {
                        console.log(`ℹ️ Loan #${paymentOrder.loan_id} is already cleared (by order-status check), skipping webhook processing`);
                        // Skip processing if already cleared, but continue to send webhook response
                    } else {
                        // Check if payment record already exists to avoid duplicates
                        const existingPayment = await executeQuery(
                            `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                            [orderId, paymentOrder.loan_id]
                        );
                        
                        if (existingPayment.length === 0) {
                            // Create payment record
                            await executeQuery(
                                `INSERT INTO loan_payments (
                                    loan_id, amount, payment_method, transaction_id, status, payment_date
                                ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
                                [paymentOrder.loan_id, orderAmount, orderId]
                            );
                            console.log(`✅ Loan payment record created for loan: ${paymentOrder.loan_id}`);
                            
                            // Get loan details to determine transaction type and get user_id
                            const loanInfo = await executeQuery(
                                `SELECT user_id, application_number, plan_snapshot FROM loan_applications WHERE id = ?`,
                                [paymentOrder.loan_id]
                            );
                            
                            if (loanInfo.length > 0) {
                                const applicationNumber = loanInfo[0].application_number;
                                
                                // Try to create transaction record (may fail due to ENUM constraints, but that's OK)
                                try {
                                    // Use valid ENUM values: 'emi_payment' for EMIs, 'credit' for full payments
                                    let transactionType = 'emi_payment'; // Default for EMI payments
                                    if (paymentType === 'pre-close' || paymentType === 'full_payment') {
                                        transactionType = 'credit';
                                    }
                                    
                                    // Get system admin ID for created_by (required foreign key to admins table)
                                    const systemAdmins = await executeQuery(
                                        'SELECT id FROM admins WHERE is_active = 1 AND role = ? ORDER BY created_at ASC LIMIT 1',
                                        ['superadmin']
                                    );
                                    const systemAdminId = systemAdmins.length > 0 ? systemAdmins[0].id : null;
                                    
                                    if (!systemAdminId) {
                                        // If no system admin found, skip transaction creation
                                        console.warn('⚠️ No system admin found, skipping transaction record creation');
                                    } else {
                                        // Use 'other' for payment_method since 'cashfree' isn't in ENUM
                                        await executeQuery(
                                            `INSERT INTO transactions (
                                                user_id, loan_application_id, transaction_type, amount, description,
                                                category, payment_method, reference_number, transaction_date,
                                                status, priority, created_by, created_at, updated_at
                                            ) VALUES (?, ?, ?, ?, ?, 'loan', 'other', ?, CURDATE(), 'completed', 'high', ?, NOW(), NOW())`,
                                            [
                                                paymentOrder.user_id,
                                                paymentOrder.loan_id,
                                                transactionType,
                                                orderAmount,
                                                `${paymentType === 'pre-close' || paymentType === 'full_payment' ? 'Full Payment' : paymentType.replace('_', ' ').toUpperCase()} via Cashfree - Order: ${orderId}, App: ${applicationNumber}`,
                                                bankReferenceNumber || orderId, // Use bank reference number if available, otherwise fallback to orderId
                                                systemAdminId  // created_by = system admin for automated payments
                                            ]
                                        );
                                        console.log(`✅ Transaction record created: ${transactionType}`);
                                    }
                                } catch (txnError) {
                                    // Transaction creation failed (possibly due to created_by constraint)
                                    // This is non-fatal - continue with loan clearance
                                    console.warn(`⚠️ Could not create transaction record (non-fatal): ${txnError.message}`);
                                }
                            }
                        } else {
                            console.log(`ℹ️ Payment record already exists for order ${orderId}, skipping duplicate`);
                        }

                        // ALWAYS check if loan should be cleared (runs for all successful payments)
                    try {
                        // Get loan details to calculate outstanding balance
                            const loanDetails = await executeQuery(
                                `SELECT 
                                    id, processed_amount, loan_amount,
                                    processed_post_service_fee, fees_breakdown, plan_snapshot,
                                    emi_schedule, status
                                FROM loan_applications 
                                WHERE id = ?`,
                                [paymentOrder.loan_id]
                            );

                        if (loanDetails.length > 0) {
                            const loan = loanDetails[0];
                            
                            // Only check for cleared status if loan is in account_manager status
                            // (Skip if already cleared by order-status check)
                            if (loan.status === 'account_manager') {
                                let shouldClearLoan = false;
                                
                                // Pre-close or full_payment: Immediately clear the loan
                                if (paymentType === 'pre-close' || paymentType === 'full_payment') {
                                    shouldClearLoan = true;
                                    console.log(`💰 ${paymentType === 'pre-close' ? 'Pre-close' : 'Full payment'} received - loan will be cleared immediately`);
                                } else if (paymentType.startsWith('emi_')) {
                                    // EMI payment: Only clear if this is the last EMI
                                    // Parse plan snapshot to get EMI count
                                    let planSnapshot = {};
                                    let emiCount = 1;
                                    try {
                                        planSnapshot = typeof loan.plan_snapshot === 'string' 
                                            ? JSON.parse(loan.plan_snapshot) 
                                            : loan.plan_snapshot || {};
                                        emiCount = planSnapshot.emi_count || 1;
                                    } catch (e) {
                                        console.error('Error parsing plan_snapshot:', e);
                                    }
                                    
                                    // Determine which EMI this is
                                    let currentEmiNumber = 0;
                                    if (paymentType === 'emi_1st') currentEmiNumber = 1;
                                    else if (paymentType === 'emi_2nd') currentEmiNumber = 2;
                                    else if (paymentType === 'emi_3rd') currentEmiNumber = 3;
                                    else if (paymentType === 'emi_4th') currentEmiNumber = 4;
                                    
                                    // Update emi_schedule to mark this EMI as paid
                                    try {
                                        let emiSchedule = loan.emi_schedule;
                                        if (emiSchedule) {
                                            let emiScheduleArray = null;
                                            try {
                                                emiScheduleArray = typeof emiSchedule === 'string' 
                                                    ? JSON.parse(emiSchedule) 
                                                    : emiSchedule;
                                            } catch (parseError) {
                                                console.error('Error parsing emi_schedule:', parseError);
                                            }
                                            
                                            if (Array.isArray(emiScheduleArray) && emiScheduleArray.length >= currentEmiNumber) {
                                                // Update the status of the corresponding EMI (0-indexed array)
                                                const emiIndex = currentEmiNumber - 1;
                                                emiScheduleArray[emiIndex] = {
                                                    ...emiScheduleArray[emiIndex],
                                                    status: 'paid'
                                                };
                                                
                                                // Update emi_schedule in database
                                                await executeQuery(
                                                    `UPDATE loan_applications 
                                                     SET emi_schedule = ? 
                                                     WHERE id = ?`,
                                                    [JSON.stringify(emiScheduleArray), paymentOrder.loan_id]
                                                );
                                                
                                                console.log(`✅ Updated emi_schedule: EMI #${currentEmiNumber} marked as paid`);
                                            } else {
                                                console.warn(`⚠️ emi_schedule array not found or invalid for EMI #${currentEmiNumber}`);
                                            }
                                        } else {
                                            console.warn(`⚠️ emi_schedule not found in loan record`);
                                        }
                                    } catch (emiScheduleError) {
                                        console.error('❌ Error updating emi_schedule:', emiScheduleError);
                                        // Don't fail the webhook - payment was successful, just log the error
                                    }
                                    
                                    // Check if this is the last EMI
                                    if (currentEmiNumber === emiCount) {
                                        shouldClearLoan = true;
                                        console.log(`💰 Last EMI (${currentEmiNumber}/${emiCount}) paid - loan will be cleared`);
                                    } else {
                                        console.log(`ℹ️ EMI ${currentEmiNumber}/${emiCount} paid - loan will not be cleared yet`);
                                    }
                                } else {
                                    // Fallback: Use old logic (sum all payments)
                                    const totalPaymentsResult = await executeQuery(
                                        `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                         FROM loan_payments 
                                         WHERE loan_id = ? AND status = 'SUCCESS'`,
                                        [paymentOrder.loan_id]
                                    );
                                    
                                    const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                    
                                    const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                    const outstandingBalance = calculateOutstandingBalance(loan);
                                    
                                    console.log(`💰 Payment check for loan #${paymentOrder.loan_id}:`, {
                                        totalPaid: totalPaid,
                                        outstandingBalance: outstandingBalance,
                                        remaining: outstandingBalance - totalPaid
                                    });
                                    
                                    // If total payments >= outstanding balance (with small tolerance for rounding)
                                    if (totalPaid >= outstandingBalance - 0.01) {
                                        shouldClearLoan = true;
                                    }
                                }
                                
                                // Clear the loan if conditions are met
                                if (shouldClearLoan) {
                                    await executeQuery(
                                        `UPDATE loan_applications 
                                         SET status = 'cleared', updated_at = NOW() 
                                         WHERE id = ?`,
                                        [paymentOrder.loan_id]
                                    );
                                    
                                    // Update transaction description to note loan was cleared
                                    try {
                                        await executeQuery(
                                            `UPDATE transactions 
                                             SET description = CONCAT(description, ' - Loan cleared')
                                             WHERE reference_number = ? AND loan_application_id = ?`,
                                            [orderId, paymentOrder.loan_id]
                                        );
                                    } catch (txnUpdateErr) {
                                        console.warn(`⚠️ Could not update transaction description (non-fatal)`);
                                    }
                                    
                                    console.log(`✅ Loan #${paymentOrder.loan_id} marked as CLEARED (${paymentType})`);
                                    
                                    // Credit limit recalculation removed - now happens on loan disbursement, not on loan clearance
                                    
                                    // Send NOC email to user
                                    try {
                                        await generateAndSendNOCEmail(paymentOrder.loan_id);
                                    } catch (nocEmailError) {
                                        console.error('❌ Error sending NOC email (non-fatal):', nocEmailError);
                                        // Don't fail - email failure shouldn't block loan clearance
                                    }
                                } else {
                                    console.log(`ℹ️ Loan #${paymentOrder.loan_id} payment received but not cleared yet (${paymentType})`);
                                }
                            } else {
                                console.log(`ℹ️ Loan #${paymentOrder.loan_id} status is '${loan.status}', skipping clearance check`);
                            }
                        }
                    } catch (clearanceError) {
                        console.error('❌ Error checking if loan should be cleared:', clearanceError);
                        // Don't fail the webhook - payment was successful, just log the error
                    }

                    console.log('✅ Loan payment processed:', {
                        loanId: paymentOrder.loan_id,
                        amount: orderAmount
                    });
                    }
                }
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

/**
 * GET /api/payment/pending
 * Get all pending payment orders for the authenticated user
 */
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch all pending payment orders for the user
        const orders = await executeQuery(
            `SELECT 
                po.id,
                po.order_id,
                po.loan_id,
                po.extension_id,
                po.amount,
                po.payment_type,
                po.status,
                po.payment_session_id,
                po.created_at,
                po.updated_at,
                la.application_number,
                la.loan_amount as loan_amount,
                la.status as loan_status
            FROM payment_orders po
            LEFT JOIN loan_applications la ON po.loan_id = la.id
            WHERE po.user_id = ? AND po.status = 'PENDING'
            ORDER BY po.created_at DESC`,
            [userId]
        );

        console.log(`📊 Found ${orders.length} pending payment orders`);

        // Optionally fetch fresh status from Cashfree for each order (but don't fail if it errors)
        const ordersWithStatus = await Promise.all(
            orders.map(async (order) => {
                try {
                    const cashfreeStatus = await cashfreePayment.getOrderStatus(order.order_id);
                    // If Cashfree shows PAID, update our database
                    if (cashfreeStatus.data && cashfreeStatus.data.order_status === 'PAID') {
                        console.log(`💰 Order ${order.order_id} is PAID in Cashfree, updating status...`);
                        await executeQuery(
                            `UPDATE payment_orders SET status = 'PAID', updated_at = NOW() WHERE order_id = ?`,
                            [order.order_id]
                        );
                        // Process the payment if it's paid
                        // (This would trigger the webhook processing logic)
                    }
                    return {
                        ...order,
                        cashfreeStatus: cashfreeStatus.data || null
                    };
                } catch (error) {
                    console.error(`❌ Error fetching Cashfree status for order ${order.order_id}:`, error);
                    return {
                        ...order,
                        cashfreeStatus: null
                    };
                }
            })
        );

        res.json({
            success: true,
            data: {
                orders: ordersWithStatus,
                count: ordersWithStatus.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching pending payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending payments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/payment/order-status/:orderId
 * Get payment order status from both database and Cashfree API
 * This endpoint calls Cashfree API to get the latest payment status
 */
router.get('/order-status/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;


        // Fetch from database first
        const [order] = await executeQuery(
            `SELECT po.*, la.application_number, la.status as loan_status
       FROM payment_orders po
       JOIN loan_applications la ON po.loan_id = la.id
       WHERE po.order_id = ? AND po.user_id = ?`,
            [orderId, userId]
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Always fetch fresh status from Cashfree API (backend call)
        console.log(`📞 Calling Cashfree API to get order status for: ${orderId}`);
        const cashfreeStatus = await cashfreePayment.getOrderStatus(orderId);

        if (!cashfreeStatus.success) {
            console.error(`❌ Failed to fetch status from Cashfree:`, cashfreeStatus.error);
            // Return database status if Cashfree call fails
            return res.json({
                success: true,
                data: {
                    ...order,
                    cashfreeStatus: null,
                    error: 'Failed to fetch status from Cashfree',
                    note: 'Showing database status only'
                }
            });
        }

        // Extract order status from Cashfree response
        const cashfreeOrderStatus = cashfreeStatus.orderStatus || 
                                   cashfreeStatus.data?.order_status || 
                                   cashfreeStatus.data?.order?.order_status;
        const paymentReceived = cashfreeStatus.paymentReceived || (cashfreeOrderStatus === 'PAID');
        
        // Extract bank reference number from Cashfree API response
        // Check in payments array (if available) or payment object
        const cashfreeData = cashfreeStatus.data || {};
        const payments = cashfreeData.payments || cashfreeData.payment || [];
        const paymentData = Array.isArray(payments) && payments.length > 0 ? payments[0] : (payments || cashfreeData.payment || {});
        
        const bankReferenceNumber = paymentData?.payment_message || 
                                   paymentData?.payment_utr || 
                                   paymentData?.bank_reference_number || 
                                   paymentData?.utr || 
                                   paymentData?.reference_number ||
                                   cashfreeData?.payment_message ||
                                   cashfreeData?.payment_utr ||
                                   null;
        
        console.log(`💰 Cashfree order status: ${cashfreeOrderStatus}, Payment received: ${paymentReceived}`);
        console.log(`💰 Bank reference number from API: ${bankReferenceNumber || 'Not found'}`, {
            payment_message: paymentData?.payment_message || cashfreeData?.payment_message,
            payment_utr: paymentData?.payment_utr || cashfreeData?.payment_utr,
            bank_reference_number: paymentData?.bank_reference_number,
            utr: paymentData?.utr,
            reference_number: paymentData?.reference_number
        });

        // If Cashfree shows payment is PAID, process it regardless of DB status
        // This handles cases where payment was successful but processing failed
        if (paymentReceived) {
            // Update DB status if it's still PENDING
            if (order.status === 'PENDING') {
                console.log(`🔄 Updating order status from PENDING to PAID in database`);
                await executeQuery(
                    `UPDATE payment_orders SET status = 'PAID', updated_at = NOW() WHERE order_id = ?`,
                    [orderId]
                );
                order.status = 'PAID';
            } else if (order.status === 'PAID') {
                console.log(`ℹ️ Order is already PAID in database, but checking if payment needs to be processed`);
            }
            
            // Process the payment (similar to webhook processing)
            // This will handle cases where payment is PAID but loan/extension wasn't processed
            try {
                const [paymentOrder] = await executeQuery(
                    'SELECT loan_id, extension_id, payment_type, amount, user_id FROM payment_orders WHERE order_id = ?',
                    [orderId]
                );

                if (paymentOrder) {
                    const paymentType = paymentOrder.payment_type || 'loan_repayment';
                    
                    // Handle loan repayments (pre-close, full_payment, EMI, or general repayment)
                    if (paymentType === 'loan_repayment' || paymentType === 'pre-close' || paymentType === 'full_payment' || paymentType.startsWith('emi_')) {
                        // Process loan repayment
                        console.log(`💳 Processing ${paymentType} payment for loan: ${paymentOrder.loan_id}`);
                        
                        // First check if loan is already cleared (by webhook) - skip if so
                        const loanStatusCheck = await executeQuery(
                            `SELECT status FROM loan_applications WHERE id = ?`,
                            [paymentOrder.loan_id]
                        );
                        
                        if (loanStatusCheck.length > 0 && loanStatusCheck[0].status === 'cleared') {
                            console.log(`ℹ️ Loan #${paymentOrder.loan_id} is already cleared (by webhook), skipping order-status processing`);
                            // Still return the order data, just skip processing
                        } else {
                            // Check if payment record already exists to avoid duplicates
                            const existingPayment = await executeQuery(
                                `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                                [orderId, paymentOrder.loan_id]
                            );
                            
                            if (existingPayment.length === 0) {
                                // Create payment record
                                await executeQuery(
                                    `INSERT INTO loan_payments (
                                        loan_id, amount, payment_method, transaction_id, status, payment_date
                                    ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
                                    [paymentOrder.loan_id, paymentOrder.amount, orderId]
                                );
                                console.log(`✅ Loan payment record created for loan: ${paymentOrder.loan_id}`);
                                
                                // Get loan details to determine transaction type and get user_id
                                const loanInfo = await executeQuery(
                                    `SELECT user_id, application_number, plan_snapshot FROM loan_applications WHERE id = ?`,
                                    [paymentOrder.loan_id]
                                );
                                
                                if (loanInfo.length > 0) {
                                    const applicationNumber = loanInfo[0].application_number;
                                    
                                    // Try to create transaction record (may fail due to ENUM constraints, but that's OK)
                                    try {
                                        // Use valid ENUM values: 'emi_payment' for EMIs, 'credit' for full payments
                                        let transactionType = 'emi_payment'; // Default for EMI payments
                                        if (paymentType === 'pre-close' || paymentType === 'full_payment') {
                                            transactionType = 'credit';
                                        }
                                        
                                        // Get system admin ID for created_by (required foreign key to admins table)
                                        const systemAdmins = await executeQuery(
                                            'SELECT id FROM admins WHERE is_active = 1 AND role = ? ORDER BY created_at ASC LIMIT 1',
                                            ['superadmin']
                                        );
                                        const systemAdminId = systemAdmins.length > 0 ? systemAdmins[0].id : null;
                                        
                                        if (!systemAdminId) {
                                            // If no system admin found, skip transaction creation
                                            console.warn('⚠️ No system admin found, skipping transaction record creation');
                                        } else {
                                            // Use 'other' for payment_method since 'cashfree' isn't in ENUM
                                            await executeQuery(
                                                `INSERT INTO transactions (
                                                    user_id, loan_application_id, transaction_type, amount, description,
                                                    category, payment_method, reference_number, transaction_date,
                                                    status, priority, created_by, created_at, updated_at
                                                ) VALUES (?, ?, ?, ?, ?, 'loan', 'other', ?, CURDATE(), 'completed', 'high', ?, NOW(), NOW())`,
                                                [
                                                    paymentOrder.user_id,
                                                    paymentOrder.loan_id,
                                                    transactionType,
                                                    paymentOrder.amount,
                                                    `${paymentType === 'pre-close' || paymentType === 'full_payment' ? 'Full Payment' : paymentType.replace('_', ' ').toUpperCase()} via Cashfree - Order: ${orderId}, App: ${applicationNumber}`,
                                                    bankReferenceNumber || orderId, // Use bank reference number from API if available, otherwise fallback to orderId
                                                    systemAdminId  // created_by = system admin for automated payments
                                                ]
                                            );
                                            console.log(`✅ Transaction record created: ${transactionType}`);
                                        }
                                    } catch (txnError) {
                                        console.warn(`⚠️ Could not create transaction record (non-fatal): ${txnError.message}`);
                                    }
                                }
                            } else {
                                console.log(`ℹ️ Payment record already exists for order ${orderId}, skipping duplicate`);
                            }

                            // ALWAYS check if loan should be cleared (runs for all successful payments)
                            try {
                                    const loanDetails = await executeQuery(
                                        `SELECT 
                                            id, processed_amount, loan_amount,
                                            processed_post_service_fee, fees_breakdown, plan_snapshot,
                                            emi_schedule, status
                                        FROM loan_applications 
                                        WHERE id = ?`,
                                        [paymentOrder.loan_id]
                                    );

                                    if (loanDetails.length > 0) {
                                        const loan = loanDetails[0];
                                        
                                        // Only process if not already cleared (double-check)
                                        if (loan.status === 'account_manager') {
                                            let shouldClearLoan = false;
                                            
                                            // Pre-close or full_payment: Immediately clear the loan
                                            if (paymentType === 'pre-close' || paymentType === 'full_payment') {
                                                shouldClearLoan = true;
                                                console.log(`💰 ${paymentType === 'pre-close' ? 'Pre-close' : 'Full payment'} received - loan will be cleared immediately`);
                                            } else if (paymentType.startsWith('emi_')) {
                                                // EMI payment: Only clear if this is the last EMI
                                                let planSnapshot = {};
                                                let emiCount = 1;
                                                try {
                                                    planSnapshot = typeof loan.plan_snapshot === 'string' 
                                                        ? JSON.parse(loan.plan_snapshot) 
                                                        : loan.plan_snapshot || {};
                                                    emiCount = planSnapshot.emi_count || 1;
                                                } catch (e) {
                                                    console.error('Error parsing plan_snapshot:', e);
                                                }
                                                
                                                // Determine which EMI this is
                                                let currentEmiNumber = 0;
                                                if (paymentType === 'emi_1st') currentEmiNumber = 1;
                                                else if (paymentType === 'emi_2nd') currentEmiNumber = 2;
                                                else if (paymentType === 'emi_3rd') currentEmiNumber = 3;
                                                else if (paymentType === 'emi_4th') currentEmiNumber = 4;
                                                
                                                // Update emi_schedule to mark this EMI as paid
                                                try {
                                                    let emiSchedule = loan.emi_schedule;
                                                    if (emiSchedule) {
                                                        let emiScheduleArray = null;
                                                        try {
                                                            emiScheduleArray = typeof emiSchedule === 'string' 
                                                                ? JSON.parse(emiSchedule) 
                                                                : emiSchedule;
                                                        } catch (parseError) {
                                                            console.error('Error parsing emi_schedule:', parseError);
                                                        }
                                                        
                                                        if (Array.isArray(emiScheduleArray) && emiScheduleArray.length >= currentEmiNumber) {
                                                            // Update the status of the corresponding EMI (0-indexed array)
                                                            const emiIndex = currentEmiNumber - 1;
                                                            emiScheduleArray[emiIndex] = {
                                                                ...emiScheduleArray[emiIndex],
                                                                status: 'paid'
                                                            };
                                                            
                                                            // Update emi_schedule in database
                                                            await executeQuery(
                                                                `UPDATE loan_applications 
                                                                 SET emi_schedule = ? 
                                                                 WHERE id = ?`,
                                                                [JSON.stringify(emiScheduleArray), paymentOrder.loan_id]
                                                            );
                                                            
                                                            console.log(`✅ Updated emi_schedule: EMI #${currentEmiNumber} marked as paid`);
                                                        } else {
                                                            console.warn(`⚠️ emi_schedule array not found or invalid for EMI #${currentEmiNumber}`);
                                                        }
                                                    } else {
                                                        console.warn(`⚠️ emi_schedule not found in loan record`);
                                                    }
                                                } catch (emiScheduleError) {
                                                    console.error('❌ Error updating emi_schedule:', emiScheduleError);
                                                    // Don't fail the webhook - payment was successful, just log the error
                                                }
                                                
                                                // Check if this is the last EMI
                                                if (currentEmiNumber === emiCount) {
                                                    shouldClearLoan = true;
                                                    console.log(`💰 Last EMI (${currentEmiNumber}/${emiCount}) paid - loan will be cleared`);
                                                } else {
                                                    console.log(`ℹ️ EMI ${currentEmiNumber}/${emiCount} paid - loan will not be cleared yet`);
                                                }
                                            } else {
                                                // Fallback: Use old logic (sum all payments)
                                                const totalPaymentsResult = await executeQuery(
                                                    `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                                     FROM loan_payments 
                                                     WHERE loan_id = ? AND status = 'SUCCESS'`,
                                                    [paymentOrder.loan_id]
                                                );
                                                
                                                const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                                
                                                const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                                const outstandingBalance = calculateOutstandingBalance(loan);
                                                
                                                console.log(`💰 Payment check for loan #${paymentOrder.loan_id}:`, {
                                                    totalPaid: totalPaid,
                                                    outstandingBalance: outstandingBalance,
                                                    remaining: outstandingBalance - totalPaid
                                                });
                                                
                                                // If total payments >= outstanding balance (with small tolerance for rounding)
                                                if (totalPaid >= outstandingBalance - 0.01) {
                                                    shouldClearLoan = true;
                                                }
                                            }
                                            
                                            // Clear the loan if conditions are met
                                            if (shouldClearLoan) {
                                                await executeQuery(
                                                    `UPDATE loan_applications 
                                                     SET status = 'cleared', updated_at = NOW() 
                                                     WHERE id = ?`,
                                                    [paymentOrder.loan_id]
                                                );
                                                
                                                // Update transaction description to note loan was cleared
                                                try {
                                                    await executeQuery(
                                                        `UPDATE transactions 
                                                         SET description = CONCAT(description, ' - Loan cleared')
                                                         WHERE reference_number = ? AND loan_application_id = ?`,
                                                        [bankReferenceNumber || orderId, paymentOrder.loan_id]
                                                    );
                                                } catch (txnUpdateErr) {
                                                    console.warn(`⚠️ Could not update transaction description (non-fatal)`);
                                                }
                                                
                                                console.log(`✅ Loan #${paymentOrder.loan_id} marked as CLEARED (${paymentType})`);
                                                
                                                // Credit limit recalculation removed - now happens on loan disbursement, not on loan clearance
                                                
                                                // Send NOC email to user
                                                try {
                                                    await generateAndSendNOCEmail(paymentOrder.loan_id);
                                                } catch (nocEmailError) {
                                                    console.error('❌ Error sending NOC email (non-fatal):', nocEmailError);
                                                    // Don't fail - email failure shouldn't block loan clearance
                                                }
                                            } else {
                                                console.log(`ℹ️ Loan #${paymentOrder.loan_id} payment received but not cleared yet (${paymentType})`);
                                            }
                                        } else {
                                            console.log(`ℹ️ Loan #${paymentOrder.loan_id} status is '${loan.status}', skipping clearance check`);
                                        }
                                    }
                            } catch (clearanceError) {
                                console.error('❌ Error checking if loan should be cleared:', clearanceError);
                            }
                        }
                    } else if (paymentOrder.payment_type === 'extension_fee' && paymentOrder.extension_id) {
                        // Process extension payment
                        console.log(`📅 Processing extension payment for extension: ${paymentOrder.extension_id}`);
                        
                        // First check if extension is already approved (by webhook) - skip if so
                        const extensionStatusCheck = await executeQuery(
                            `SELECT status, payment_status FROM loan_extensions WHERE id = ?`,
                            [paymentOrder.extension_id]
                        );
                        
                        if (extensionStatusCheck.length > 0) {
                            const extStatus = extensionStatusCheck[0];
                            if (extStatus.status === 'approved' && extStatus.payment_status === 'paid') {
                                console.log(`ℹ️ Extension #${paymentOrder.extension_id} is already approved (by webhook), skipping order-status processing`);
                                // Skip processing if already approved
                            } else {
                                // Check if transaction already exists for this order to avoid duplicates
                                const existingTransaction = await executeQuery(
                                    `SELECT id FROM transactions WHERE reference_number = ? AND loan_application_id = ? AND transaction_type LIKE 'loan_extension_%'`,
                                    [bankReferenceNumber || orderId, paymentOrder.loan_id]
                                );
                                
                                if (existingTransaction.length > 0) {
                                    console.log(`ℹ️ Transaction already exists for extension payment order ${orderId}, skipping duplicate`);
                                } else {
                                    try {
                                        const { approveExtension } = require('../utils/extensionApproval');
                                        const approvalResult = await approveExtension(
                                            paymentOrder.extension_id,
                                            bankReferenceNumber || orderId, // Use bank reference number if available, otherwise fallback to orderId
                                            null
                                        );
                                        console.log('✅ Extension auto-approved:', approvalResult);
                                    } catch (approvalError) {
                                        console.error('❌ Error auto-approving extension:', approvalError);
                                    }
                                }
                            }
                        } else {
                            console.warn(`⚠️ Extension #${paymentOrder.extension_id} not found`);
                        }
                    }
                }
            } catch (processError) {
                console.error('❌ Error processing payment:', processError);
                // Don't fail the response, just log the error
            }
        }

        res.json({
            success: true,
            data: {
                ...order,
                status: order.status, // Updated status if changed
                loan_status: order.loan_status, // Include loan status
                cashfreeStatus: cashfreeStatus.data,
                paymentReceived: paymentReceived,
                paymentStatus: cashfreeOrderStatus || order.status,
                // Additional payment info if available
                cfOrderId: cashfreeStatus.data?.cf_order_id || null,
                orderAmount: cashfreeStatus.data?.order_amount || order.amount
            }
        });

    } catch (error) {
        console.error('❌ Error fetching order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
