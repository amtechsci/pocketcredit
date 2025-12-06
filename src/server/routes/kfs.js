const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { initializeDatabase, executeQuery } = require('../config/database');
const { calculateLoanValues, calculateTotalDays } = require('../utils/loanCalculations');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

/**
 * GET /api/kfs/:loanId
 * Generate KFS (Key Facts Statement) data for a loan
 */
router.get('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const { loanId } = req.params;
    
    console.log('📄 Generating KFS for loan ID:', loanId);
    
    // Fetch loan application details including dynamic fees
    const [loans] = await db.execute(`
      SELECT 
        la.*,
        la.fees_breakdown,
        la.disbursal_amount,
        la.total_deduct_from_disbursal,
        la.total_add_to_total,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth,
        u.gender, u.marital_status
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }
    
    const loan = loans[0];
    
    // Get address details
    const [addresses] = await db.execute(`
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = 1 
      LIMIT 1
    `, [loan.user_id]);
    
    const address = addresses[0] || {};
    
    // Get employment details and income range from users
    const [employment] = await db.execute(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      LIMIT 1
    `, [loan.user_id]);
    
    const employmentDetails = employment[0] || {};
    
    // Convert income_range to approximate monthly income for display
    const getMonthlyIncomeFromRange = (range) => {
      if (!range) return 0;
      const rangeMap = {
        '1k-20k': 10000,
        '20k-30k': 25000,
        '30k-40k': 35000,
        'above-40k': 50000
      };
      return rangeMap[range] || 0;
    };
    
    // Parse fees breakdown if available
    let feesBreakdown = [];
    let totalDeductFromDisbursal = 0;
    let totalAddToTotal = 0;
    let disbursalAmount = null;
    
    if (loan.fees_breakdown) {
      try {
        feesBreakdown = typeof loan.fees_breakdown === 'string' 
          ? JSON.parse(loan.fees_breakdown) 
          : loan.fees_breakdown;
        
        // Calculate totals from breakdown
        feesBreakdown.forEach(fee => {
          if (fee.application_method === 'deduct_from_disbursal') {
            totalDeductFromDisbursal += parseFloat(fee.amount || 0);
          } else if (fee.application_method === 'add_to_total') {
            totalAddToTotal += parseFloat(fee.amount || 0);
          }
        });
      } catch (e) {
        console.error('Error parsing fees_breakdown:', e);
      }
    }
    
    // Use disbursal_amount if available, otherwise calculate
    const principal = parseFloat(loan.loan_amount || 0);
    const intPercentPerDay = parseFloat(loan.interest_percent_per_day || 0.3);
    
    // Get days from plan_snapshot or default to 30
    let days = 30;
    if (loan.plan_snapshot) {
      try {
        const planData = typeof loan.plan_snapshot === 'string' 
          ? JSON.parse(loan.plan_snapshot) 
          : loan.plan_snapshot;
        days = planData.repayment_days || 30;
      } catch (e) {
        days = 30;
      }
    }
    
    // If loan is disbursed, calculate actual days
    if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      days = calculateTotalDays(loan.disbursed_at);
    }
    
    // Use dynamic fees if available, otherwise fallback to legacy calculation
    let calculations;
    let processingFee = 0;
    let gst = 0;
    let disbAmount = principal;
    
    if (feesBreakdown.length > 0 && loan.disbursal_amount !== null) {
      // Use dynamic fees
      disbursalAmount = parseFloat(loan.disbursal_amount || 0);
      disbAmount = disbursalAmount;
      
      // Calculate GST on fees deducted from disbursal (18% GST)
      gst = totalDeductFromDisbursal * 0.18;
      
      // Calculate interest on disbursed amount
      const interest = (disbAmount * intPercentPerDay / 100) * days;
      
      // Total repayable = disbursed amount + interest + fees added to total
      const totalRepayable = disbAmount + interest + totalAddToTotal;
      
      calculations = {
        principal: principal,
        processingFee: totalDeductFromDisbursal,
        gst: gst,
        disbAmount: disbAmount,
        interest: interest,
        totalAmount: totalRepayable
      };
      
      processingFee = totalDeductFromDisbursal;
    } else {
      // Fallback to legacy calculation
      const pfPercent = parseFloat(loan.processing_fee_percent || 14);
      const loanData = {
        loan_amount: principal,
        processing_fee_percent: pfPercent,
        interest_percent_per_day: intPercentPerDay
      };
      calculations = calculateLoanValues(loanData, days);
      processingFee = calculations.processingFee;
      gst = calculations.gst;
      disbAmount = calculations.disbAmount;
    }
    
    // Calculate APR (Annual Percentage Rate)
    // APR = ((All Fees + GST + Interest) / Loan Amount) / Days * 36500
    const totalCharges = processingFee + gst + totalAddToTotal + calculations.interest;
    const apr = ((totalCharges / principal) / days) * 36500;
    
    // Generate due date (today + days)
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + days);
    
    // Prepare KFS data
    const kfsData = {
      // Company Information
      company: {
        name: 'Pocket Credit Private Limited',
        cin: 'U65999DL2024PTC123456', // Update with actual CIN
        rbi_registration: 'B-14.03456', // Update with actual RBI registration
        registered_office: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
        address: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
        phone: '+91 9876543210',
        email: 'support@pocketcredit.in',
        website: 'www.pocketcredit.in',
        jurisdiction: 'Gurugram, Haryana'
      },
      
      // Loan Details
      loan: {
        id: loan.id,
        application_number: loan.application_number,
        type: loan.loan_purpose || 'Personal Loan',
        sanctioned_amount: principal,
        disbursed_amount: calculations.disbAmount,
        loan_term_days: days,
        status: loan.status,
        created_at: loan.created_at,
        applied_date: loan.created_at,
        approved_date: loan.approved_at,
        disbursed_date: loan.disbursed_at,
        due_date: dueDate.toISOString()
      },
      
      // Borrower Details
      borrower: {
        name: `${loan.first_name} ${loan.last_name || ''}`.trim(),
        father_name: 'N/A', // Column doesn't exist yet
        mother_name: 'N/A', // Column doesn't exist yet
        email: loan.email,
        phone: loan.phone,
        date_of_birth: loan.date_of_birth,
        gender: loan.gender || 'N/A',
        marital_status: loan.marital_status || 'N/A',
        pan_number: 'N/A', // Column doesn't exist yet
        aadhar_number: 'N/A', // Column doesn't exist yet
        address: {
          line1: address.address_line1 || 'N/A',
          line2: address.address_line2 || '',
          city: address.city || 'N/A',
          state: address.state || 'N/A',
          pincode: address.pincode || 'N/A',
          country: address.country || 'India'
        },
        employment: {
          type: employmentDetails.employment_type || 'N/A',
          company: employmentDetails.company_name || 'N/A',
          designation: employmentDetails.designation || 'N/A',
          monthly_income: getMonthlyIncomeFromRange(employmentDetails.income_range)
        }
      },
      
      // Interest & Charges
      interest: {
        rate_per_day: intPercentPerDay,
        rate_type: 'Fixed',
        total_interest: calculations.interest,
        calculation_days: days
      },
      
      // Fees & Charges (dynamic fees support)
      fees: {
        processing_fee: processingFee,
        processing_fee_percent: feesBreakdown.length > 0 ? null : parseFloat(loan.processing_fee_percent || 14),
        gst: gst,
        gst_percent: 18,
        total_upfront_charges: processingFee + gst,
        fees_breakdown: feesBreakdown,
        total_deduct_from_disbursal: totalDeductFromDisbursal,
        total_add_to_total: totalAddToTotal
      },
      
      // Calculations
      calculations: {
        principal: principal,
        processing_fee: processingFee,
        gst: gst,
        disbursed_amount: disbAmount,
        interest: calculations.interest,
        total_repayable: calculations.totalAmount,
        apr: parseFloat(apr.toFixed(2))
      },
      
      // Repayment Schedule
      repayment: {
        type: 'Bullet Payment',
        number_of_instalments: 1,
        instalment_amount: calculations.totalAmount,
        first_due_date: dueDate.toISOString(),
        schedule: [
          {
            instalment_no: 1,
            outstanding_principal: principal,
            principal: principal,
            interest: calculations.interest,
            instalment_amount: calculations.totalAmount,
            due_date: dueDate.toISOString()
          }
        ]
      },
      
      // Penal Charges
      penal_charges: {
        late_payment_fee: '4% of overdue principal (one-time on first day)',
        daily_penalty: '0.2% of overdue principal per day (from second day onwards)',
        post_due_interest: `${intPercentPerDay}% per day on principal overdue`,
        foreclosure_charges: 'Zero foreclosure charges'
      },
      
      // Grievance Redressal
      grievance: {
        nodal_officer: {
          name: 'Mr. Rajesh Kumar',
          phone: '+91 9876543210',
          email: 'grievance@pocketcredit.in'
        },
        escalation: {
          name: 'Ms. Priya Sharma',
          designation: 'Chief Compliance Officer',
          phone: '+91 9876543211',
          email: 'compliance@pocketcredit.in'
        }
      },
      
      // Digital Loan Specific
      digital_loan: {
        cooling_off_period: '3 days',
        lsp_list_url: 'https://pocketcredit.in/lsp',
        payment_method: 'Digital payment through app or payment link'
      },
      
      // Additional Info
      additional: {
        loan_transferable: 'Yes',
        co_lending: 'No',
        recovery_clause: '1(X)',
        grievance_clause: '12'
      },
      
      // Generated metadata
      generated_at: new Date().toISOString(),
      generated_by: req.admin?.id || 'system'
    };
    
    console.log('✅ KFS data generated successfully');
    
    res.json({
      success: true,
      data: kfsData
    });
    
  } catch (error) {
    console.error('❌ Error generating KFS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate KFS',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/:loanId/generate-pdf
 * Generate and download PDF for KFS
 */
router.post('/:loanId/generate-pdf', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { htmlContent } = req.body;
    
    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }
    
    console.log('📄 Generating PDF for loan ID:', loanId);
    
    // Get loan data for filename
    const db = await initializeDatabase();
    const [loans] = await db.execute(
      'SELECT application_number FROM loan_applications WHERE id = ?',
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    const applicationNumber = loans[0].application_number;
    const filename = `KFS_${applicationNumber}.pdf`;
    
    // Generate PDF
    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
    
    console.log('📤 Sending PDF, size:', pdfResult.buffer.length, 'bytes');
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Send PDF buffer directly
    res.end(pdfResult.buffer, 'binary');
    
    console.log('✅ PDF sent successfully');
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/:loanId/email-pdf
 * Generate PDF and send via email
 */
router.post('/:loanId/email-pdf', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { htmlContent, recipientEmail, recipientName } = req.body;
    
    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }
    
    console.log('📧 Generating and emailing PDF for loan ID:', loanId);
    
    // Get loan data
    const db = await initializeDatabase();
    const [loans] = await db.execute(`
      SELECT 
        la.id, la.application_number, la.loan_amount, la.status,
        u.email, u.first_name, u.last_name
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    const loan = loans[0];
    const filename = `KFS_${loan.application_number}.pdf`;
    
    // Generate PDF
    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
    
    // Prepare email data
    const emailRecipient = recipientEmail || loan.email;
    const emailName = recipientName || `${loan.first_name} ${loan.last_name}`;
    
    // Send email
    const emailResult = await emailService.sendKFSEmail({
      loanId: loan.id,
      recipientEmail: emailRecipient,
      recipientName: emailName,
      loanData: {
        application_number: loan.application_number,
        sanctioned_amount: loan.loan_amount,
        loan_term_days: 30, // Default or fetch from plan
        status: loan.status
      },
      pdfBuffer: pdfResult.buffer,
      pdfFilename: filename,
      sentBy: req.admin?.id
    });
    
    res.json({
      success: true,
      message: 'PDF generated and email sent successfully',
      data: {
        emailSent: true,
        recipientEmail: emailRecipient,
        messageId: emailResult.messageId
      }
    });
    
    console.log('✅ PDF emailed successfully');
    
  } catch (error) {
    console.error('❌ Error emailing PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

/**
 * GET /api/kfs/:loanId/email-history
 * Get email history for a loan
 */
router.get('/:loanId/email-history', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    
    const history = await emailService.getEmailHistory(loanId);
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('❌ Error fetching email history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email history',
      error: error.message
    });
  }
});

module.exports = router;

