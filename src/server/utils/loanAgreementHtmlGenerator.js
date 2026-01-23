/**
 * Server-side Loan Agreement HTML Generator
 * Generates Loan Agreement HTML directly without Puppeteer browser navigation
 */

const { formatCurrency, formatDate } = require('./kfsHtmlGenerator');

/**
 * Generate the base CSS styles for the Loan Agreement document
 */
function getBaseStyles() {
    return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
      .loan-agreement-content { background: white; max-width: 210mm; margin: 0 auto; }
      .page { padding: 40px; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-justify { text-align: justify; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 12px; }
      .mb-4 { margin-bottom: 16px; }
      .mb-6 { margin-bottom: 24px; }
      .mt-4 { margin-top: 16px; }
      .mt-6 { margin-top: 24px; }
      .p-4 { padding: 16px; }
      .font-bold { font-weight: bold; }
      .text-xl { font-size: 20px; }
      .text-lg { font-size: 14px; }
      .text-sm { font-size: 11px; }
      .text-xs { font-size: 9px; }
      .underline { text-decoration: underline; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      td, th { border: 1px solid #333; padding: 8px; vertical-align: top; }
      .no-border td, .no-border th { border: none; }
      hr { margin: 16px 0; border-color: #999; }
      ul, ol { margin-left: 24px; margin-bottom: 12px; }
      li { margin-bottom: 6px; }
      .page-break { page-break-before: always; }
      .header { border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
      .section-title { font-size: 12pt; font-weight: bold; margin: 20px 0 10px 0; text-decoration: underline; }
      .clause { margin-bottom: 16px; }
      .clause-title { font-weight: bold; margin-bottom: 8px; }
      .signature-section { margin-top: 40px; }
      .signature-box { display: inline-block; width: 45%; vertical-align: top; }
    </style>
  `;
}

/**
 * Generate Loan Agreement HTML from data
 * @param {Object} data - The loan/KFS data object
 * @returns {string} Complete HTML document
 */
function generateLoanAgreementHTML(data) {
    const borrowerName = data.borrower?.name || 'Borrower';
    const borrowerAddress = data.borrower?.address
        ? `${data.borrower.address.line1 || ''} ${data.borrower.address.line2 || ''}, ${data.borrower.address.city || ''}, ${data.borrower.address.state || ''} - ${data.borrower.address.pincode || ''}`
        : 'Address not available';
    const loanAmount = data.loan?.sanctioned_amount || 0;
    const disbursedAmount = data.calculations?.disbursed_amount || data.loan?.disbursed_amount || 0;
    const interestRate = ((data.interest?.rate_per_day || 0) * 100).toFixed(2);
    const processingFee = data.fees?.processing_fee || 0;
    const gst = data.fees?.gst || 0;
    const totalRepayable = data.calculations?.total_repayable || 0;
    const applicationNumber = data.loan?.application_number || '';
    const firstDueDate = data.repayment?.first_due_date || '';

    // Format all EMI dates
    const formatAllEmiDates = () => {
        if (data.repayment?.all_emi_dates && data.repayment.all_emi_dates.length > 1) {
            return data.repayment.all_emi_dates.map(date => formatDate(date)).join(', ');
        }
        return formatDate(data.repayment?.first_due_date);
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Loan Agreement - ${applicationNumber}</title>
  ${getBaseStyles()}
</head>
<body>
  <div class="loan-agreement-content">
    <div class="page">
      <!-- Header -->
      <div class="header text-center">
        <h1 class="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
        <p class="text-sm">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
        <p class="text-sm">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
        <p class="text-sm">Email: support@pocketcredit.in | Website: www.pocketcredit.in</p>
      </div>

      <h2 class="text-lg font-bold text-center mb-4 underline">LOAN AGREEMENT</h2>

      <p class="mb-4 text-justify">
        This Loan Agreement ("Agreement") is entered into on <strong>${formatDate(data.generated_at)}</strong> 
        by and between:
      </p>

      <div class="mb-4">
        <p class="font-bold">LENDER:</p>
        <p><strong>SPHEETI FINTECH PRIVATE LIMITED</strong>, a company incorporated under the Companies Act, 2013, 
        having its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, 
        MAHARASHTRA, 421001 (hereinafter referred to as the "Lender" which expression shall, unless repugnant 
        to the context or meaning thereof, include its successors and assigns)</p>
      </div>

      <p class="text-center mb-4"><strong>AND</strong></p>

      <div class="mb-4">
        <p class="font-bold">BORROWER:</p>
        <p><strong>${borrowerName}</strong>, residing at ${borrowerAddress}, 
        PAN: ${data.borrower?.pan_number || data.borrower?.pan || 'N/A'}, 
        Mobile: ${data.borrower?.phone || 'N/A'} 
        (hereinafter referred to as the "Borrower" which expression shall, unless repugnant to the context or 
        meaning thereof, include his/her heirs, executors, administrators and legal representatives)</p>
      </div>

      <!-- Loan Details Table -->
      <h3 class="section-title">SCHEDULE - LOAN DETAILS</h3>
      <table>
        <tbody>
          <tr>
            <td style="width: 40%;"><strong>Loan Account/Application Number</strong></td>
            <td>${applicationNumber}</td>
          </tr>
          <tr>
            <td><strong>Sanctioned Loan Amount</strong></td>
            <td>${formatCurrency(loanAmount)}</td>
          </tr>
          <tr>
            <td><strong>Processing Fee</strong></td>
            <td>${formatCurrency(processingFee)}</td>
          </tr>
          <tr>
            <td><strong>GST on Processing Fee (18%)</strong></td>
            <td>${formatCurrency(gst)}</td>
          </tr>
          <tr>
            <td><strong>Net Disbursement Amount</strong></td>
            <td>${formatCurrency(disbursedAmount)}</td>
          </tr>
          <tr>
            <td><strong>Rate of Interest</strong></td>
            <td>${interestRate}% per day (Fixed)</td>
          </tr>
          <tr>
            <td><strong>Total Repayable Amount</strong></td>
            <td>${formatCurrency(totalRepayable)}</td>
          </tr>
          <tr>
            <td><strong>Repayment Due Date(s)</strong></td>
            <td>${formatAllEmiDates()}</td>
          </tr>
          <tr>
            <td><strong>Mode of Repayment</strong></td>
            <td>Digital payment through app or payment link</td>
          </tr>
        </tbody>
      </table>

      <!-- Terms and Conditions -->
      <h3 class="section-title">TERMS AND CONDITIONS</h3>

      <div class="clause">
        <p class="clause-title">1. GRANT OF LOAN</p>
        <p class="text-justify">Subject to the terms and conditions contained herein, the Lender agrees to grant 
        the Borrower a loan of ${formatCurrency(loanAmount)} (the "Loan"). The Borrower agrees to repay the Loan 
        along with interest and other charges as specified in this Agreement.</p>
      </div>

      <div class="clause">
        <p class="clause-title">2. DISBURSEMENT</p>
        <p class="text-justify">The Loan shall be disbursed to the Borrower's bank account after deduction of 
        applicable processing fees and GST. The net disbursement amount shall be ${formatCurrency(disbursedAmount)}.</p>
      </div>

      <div class="clause">
        <p class="clause-title">3. INTEREST</p>
        <p class="text-justify">Interest shall be charged at the rate of ${interestRate}% per day on the principal 
        outstanding amount. Interest shall be calculated on a simple interest basis from the date of disbursement 
        until the date of full repayment.</p>
      </div>

      <div class="clause">
        <p class="clause-title">4. REPAYMENT</p>
        <p class="text-justify">The Borrower shall repay the Loan along with interest on or before the due date(s) 
        specified above. Repayment shall be made through the digital payment methods provided by the Lender.</p>
      </div>

      <div class="clause">
        <p class="clause-title">5. PREPAYMENT</p>
        <p class="text-justify">The Borrower may prepay the Loan in full or in part at any time without any 
        prepayment charges. In case of prepayment, interest shall be charged only for the period the loan was 
        outstanding.</p>
      </div>

      <div class="clause">
        <p class="clause-title">6. LATE PAYMENT CHARGES</p>
        <p class="text-justify">In case of delayed payment beyond the due date, the following charges shall apply:</p>
        <ul>
          <li>First day after due date: 5% of overdue principal (one-time)</li>
          <li>2nd to 10th day after due date: 1% per day of overdue principal</li>
          <li>11th to 120th day after due date: 0.6% per day of overdue principal</li>
          <li>Beyond 120 days: No additional charges, but recovery actions may be initiated</li>
        </ul>
        <p>All late payment charges are subject to 18% GST.</p>
      </div>

      <div class="clause">
        <p class="clause-title">7. RECOVERY MECHANISM</p>
        <p class="text-justify">In case of non-payment, the Lender may undertake recovery through:</p>
        <ul>
          <li>Digital recovery and reminder communications</li>
          <li>In-house or outsourced collection agents</li>
          <li>Field collection (if required)</li>
          <li>Legal notice and arbitration</li>
        </ul>
      </div>
    </div>

    <!-- Page 2 -->
    <div class="page page-break">
      <div class="clause">
        <p class="clause-title">8. BORROWER'S REPRESENTATIONS AND WARRANTIES</p>
        <p class="text-justify">The Borrower represents and warrants that:</p>
        <ol type="a">
          <li>All information provided in the loan application is true, complete and accurate.</li>
          <li>The Borrower has the legal capacity to enter into this Agreement.</li>
          <li>The Loan shall be used for legitimate personal purposes only.</li>
          <li>There are no pending legal proceedings against the Borrower that may affect repayment.</li>
        </ol>
      </div>

      <div class="clause">
        <p class="clause-title">8.3 GRIEVANCE REDRESSAL</p>
        <p class="text-justify">For any grievances or complaints, the Borrower may contact:</p>
        <table class="no-border">
          <tr>
            <td style="border: none; width: 150px;"><strong>Nodal Officer:</strong></td>
            <td style="border: none;">Mr. Kiran</td>
          </tr>
          <tr>
            <td style="border: none;"><strong>Phone:</strong></td>
            <td style="border: none;">+91 9573794121</td>
          </tr>
          <tr>
            <td style="border: none;"><strong>Email:</strong></td>
            <td style="border: none;">${data.grievance?.nodal_officer?.email || 'Kiran@pocketcredit.in'}</td>
          </tr>
        </table>
        <p class="mt-4">If the complaint is not resolved within 30 days, the Borrower may escalate to the 
        Chief Compliance Officer or approach the RBI Integrated Ombudsman.</p>
      </div>

      <div class="clause">
        <p class="clause-title">9. CREDIT REPORTING</p>
        <p class="text-justify">The Borrower acknowledges that the Lender will report all loan-related information, 
        including repayment history, to Credit Information Companies (CICs) as per RBI regulations. Late payments 
        or defaults may negatively impact the Borrower's credit score.</p>
      </div>

      <div class="clause">
        <p class="clause-title">10. GOVERNING LAW AND JURISDICTION</p>
        <p class="text-justify">This Agreement shall be governed by and construed in accordance with the laws of 
        India. Any disputes arising out of or in connection with this Agreement shall be subject to the exclusive 
        jurisdiction of the courts in Mumbai, Maharashtra.</p>
      </div>

      <div class="clause">
        <p class="clause-title">11. MODIFICATION</p>
        <p class="text-justify">No modification or amendment of this Agreement shall be valid unless made in 
        writing and signed by both parties.</p>
      </div>

      <div class="clause">
        <p class="clause-title">12. ENTIRE AGREEMENT</p>
        <p class="text-justify">This Agreement, together with the Key Facts Statement (KFS), constitutes the 
        entire agreement between the parties and supersedes all prior negotiations, representations or agreements 
        relating to the subject matter hereof.</p>
      </div>

      <!-- Signature Section -->
      <div class="signature-section mt-6">
        <p class="mb-4"><strong>IN WITNESS WHEREOF</strong>, the parties have executed this Agreement on the 
        date first written above.</p>

        <table class="no-border" style="margin-top: 40px;">
          <tr>
            <td style="border: none; width: 50%; vertical-align: top;">
              <p><strong>For SPHEETI FINTECH PRIVATE LIMITED</strong></p>
              <br /><br /><br />
              <p>____________________________</p>
              <p>Authorized Signatory</p>
              <p>Date: ${formatDate(data.generated_at)}</p>
            </td>
            <td style="border: none; width: 50%; vertical-align: top;">
              <p><strong>BORROWER</strong></p>
              <br /><br /><br />
              <p>____________________________</p>
              <p>${borrowerName}</p>
              <p>Date: ${formatDate(data.generated_at)}</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Bank Details for Repayment -->
      <div class="mt-6" style="background: #f5f5f5; padding: 16px; border: 1px solid #ddd;">
        <p class="font-bold mb-2">IMPORTANT: REPAYMENT INSTRUCTIONS</p>
        <p class="text-sm">All loan repayments must be made only through the Pocket Credit app or payment links 
        provided by the Lender. Do not make payments to any individual bank accounts. The Lender shall not be 
        responsible for payments made to unauthorized accounts.</p>
      </div>

      <!-- Footer -->
      <div class="mt-6 text-center text-xs" style="color: #666;">
        <p>This is a digitally generated document and is valid without physical signature when executed 
        through the Pocket Credit digital platform.</p>
        <p>Document Reference: ${applicationNumber} | Generated: ${formatDate(data.generated_at)}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

    return html;
}

module.exports = {
    generateLoanAgreementHTML
};
