/**
 * Server-side KFS HTML Generator
 * Generates KFS (Key Facts Statement) HTML directly without Puppeteer browser navigation
 * This is a server-side port of the SharedKFSDocument React component
 */

/**
 * Format currency in INR format
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date to DD/MM/YYYY format
 */
function formatDate(dateString) {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    // Handle YYYY-MM-DD format
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    // Handle ISO datetime strings
    if (typeof dateString === 'string' && dateString.includes('T')) {
      const datePart = dateString.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
      }
    }
    // Handle MySQL datetime format
    if (typeof dateString === 'string' && dateString.includes(' ')) {
      const datePart = dateString.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
      }
    }
    // Fallback
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Get fees grouped by application method
 */
function getFeesByMethod(kfsData, method) {
  if (!kfsData?.fees?.fees_breakdown || !Array.isArray(kfsData.fees.fees_breakdown)) {
    return [];
  }
  return kfsData.fees.fees_breakdown.filter(fee => fee.application_method === method);
}

/**
 * Calculate APR
 */
function calculateAPR(kfsData) {
  if (!kfsData) return '0.00';
  if (kfsData.calculations?.apr !== undefined && kfsData.calculations.apr !== null) {
    return kfsData.calculations.apr.toFixed(2);
  }
  return '0.00';
}

/**
 * Generate the base CSS styles for the KFS document
 */
function getBaseStyles() {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.4; }
      .kfs-document-content { background: white; }
      .page { padding: 32px; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 12px; }
      .mb-4 { margin-bottom: 16px; }
      .mb-6 { margin-bottom: 24px; }
      .p-2 { padding: 8px; }
      .p-8 { padding: 32px; }
      .font-bold { font-weight: bold; }
      .text-xl { font-size: 18px; }
      .text-sm { font-size: 11px; }
      .text-xs { font-size: 9px; }
      .bg-gray-100 { background-color: #f3f4f6; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 12px; }
      td, th { border: 1px solid #000; padding: 8px; vertical-align: top; }
      hr { margin-bottom: 16px; border-color: #9ca3af; }
      ul { margin-left: 20px; margin-bottom: 8px; }
      li { margin-bottom: 4px; }
      .page-break { page-break-before: always; }
      .list-disc { list-style-type: disc; }
      .leading-relaxed { line-height: 1.6; }
    </style>
  `;
}

/**
 * Generate KFS HTML from data
 * @param {Object} kfsData - The KFS data object
 * @returns {string} Complete HTML document
 */
function generateKFSHTML(kfsData) {
  const deductFromDisbursalFees = getFeesByMethod(kfsData, 'deduct_from_disbursal');
  const addToTotalFees = getFeesByMethod(kfsData, 'add_to_total');
  const apr = calculateAPR(kfsData);
  const interestRatePercent = ((kfsData.interest?.rate_per_day || 0) * 100).toFixed(2);

  // Calculate loan term display
  const getLoanTermDisplay = () => {
    const emiCount = kfsData.loan?.emi_count;
    if (emiCount && emiCount > 1) {
      const days = 165 + (emiCount - 1) * 30;
      return `Up to ${days} days`;
    }
    return 'Up to 165 days';
  };

  // Format all EMI dates
  const formatAllEmiDates = () => {
    if (kfsData.repayment?.all_emi_dates && kfsData.repayment.all_emi_dates.length > 1) {
      return kfsData.repayment.all_emi_dates.map(date => formatDate(date)).join(', ');
    }
    return formatDate(kfsData.repayment?.first_due_date);
  };

  // Generate deduct from disbursal fees rows
  const generateDeductFeesRows = () => {
    if (deductFromDisbursalFees.length > 0) {
      return deductFromDisbursalFees.map((fee, index) => `
        <tr>
          <td></td>
          <td>(${index + 1}) ${fee.fee_name || 'Processing fees'}</td>
          <td>Onetime</td>
          <td>${formatCurrency(parseFloat(fee.fee_amount || fee.amount || 0))}</td>
          <td>N/A</td>
          <td>N/A</td>
        </tr>
      `).join('');
    }
    return `
      <tr>
        <td></td>
        <td>(i) Processing fees</td>
        <td>Onetime</td>
        <td>${formatCurrency(kfsData.fees?.processing_fee || 0)}</td>
        <td>N/A</td>
        <td>N/A</td>
      </tr>
    `;
  };

  // Generate add to total fees rows
  const generateAddFeesRows = () => {
    if (addToTotalFees.length > 0) {
      return addToTotalFees.map((fee, index) => `
        <tr>
          <td></td>
          <td>(${deductFromDisbursalFees.length + index + 1}) ${fee.fee_name || 'Service fees'}</td>
          <td>Onetime</td>
          <td>${formatCurrency(parseFloat(fee.fee_amount || fee.amount || 0))}</td>
          <td>N/A</td>
          <td>N/A</td>
        </tr>
      `).join('');
    }
    return '';
  };

  // Generate GST row
  const gstAmount = (kfsData.fees?.gst_on_deduct_from_disbursal || 0) +
    (kfsData.fees?.gst_on_add_to_total || 0) ||
    kfsData.fees?.gst || 0;
  const generateGSTRow = () => {
    if (gstAmount > 0) {
      const feeIndex = deductFromDisbursalFees.length + addToTotalFees.length + 1;
      return `
        <tr>
          <td></td>
          <td>(${feeIndex}) GST (18%)</td>
          <td>Onetime</td>
          <td>${formatCurrency(gstAmount)}</td>
          <td>N/A</td>
          <td>N/A</td>
        </tr>
      `;
    }
    return '';
  };

  // Generate repayment schedule rows
  const generateRepaymentScheduleRows = () => {
    if (kfsData.repayment?.schedule && Array.isArray(kfsData.repayment.schedule) && kfsData.repayment.schedule.length > 0) {
      return kfsData.repayment.schedule.map((emi, index) => `
        <tr>
          <td style="text-align: center;">${emi.instalment_no || (index + 1)}</td>
          <td>${formatCurrency(emi.outstanding_principal || 0)}</td>
          <td>${formatCurrency(emi.principal || 0)}</td>
          <td>${(emi.interest || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+${((emi.post_service_fee || 0) + (emi.gst_on_post_service_fee || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>${formatCurrency(emi.instalment_amount || 0)}</td>
        </tr>
      `).join('');
    }

    // Fallback for single payment
    const principal = kfsData.loan?.sanctioned_amount || kfsData.calculations?.principal || 0;
    const totalInterest = kfsData.calculations?.interest || 0;
    const postServiceFee = kfsData.fees?.total_add_to_total || 0;
    const postServiceFeeGST = Math.round(postServiceFee * 0.18 * 100) / 100;
    const postServiceFeeWithGST = postServiceFee + postServiceFeeGST;
    const instalmentAmount = principal + totalInterest + postServiceFee + postServiceFeeGST;

    return `
      <tr>
        <td style="text-align: center;">1</td>
        <td>${formatCurrency(principal)}</td>
        <td>${formatCurrency(principal)}</td>
        <td>${totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+${postServiceFeeWithGST.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${formatCurrency(instalmentAmount)}</td>
      </tr>
    `;
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Key Facts Statement - ${kfsData.loan?.application_number || ''}</title>
  ${getBaseStyles()}
</head>
<body>
  <div class="kfs-document-content">
    <!-- PAGE 1 - PART A -->
    <div class="page">
      <!-- Header -->
      <div class="text-center mb-4">
        <h1 class="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
        <p class="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
        <p class="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
      </div>
      <hr />

      <!-- Part A Title -->
      <div class="text-center mb-3">
        <p class="font-bold text-sm">PART A - Key Facts Statement</p>
        <p class="font-bold text-sm">Annex A</p>
        <p class="font-bold text-sm">Part 1 (Interest rate and fees/charges)</p>
      </div>

      <!-- Main Table -->
      <table>
        <tbody>
          <tr>
            <td style="width: 5%;">1</td>
            <td style="width: 40%;">Loan proposal/account No.</td>
            <td style="width: 20%;">${kfsData.loan?.application_number ? `PLL${kfsData.loan.application_number.slice(-4)}` : kfsData.loan?.application_number || ''}</td>
            <td style="width: 15%;">Type of Loan</td>
            <td style="width: 20%;">${kfsData.loan?.type || 'Personal'}</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Sanctioned Loan amount (in Rupees)</td>
            <td>${formatCurrency(kfsData.loan?.sanctioned_amount || 0)}</td>
            <td colspan="2" rowspan="2"></td>
          </tr>
          <tr>
            <td>3</td>
            <td>Disbursal schedule</td>
            <td>100% upfront</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="2">(i) Disbursement in stages or 100% upfront.</td>
            <td colspan="2"></td>
          </tr>
          <tr>
            <td>4</td>
            <td>Loan term (year/months/days)</td>
            <td colspan="3">${getLoanTermDisplay()}</td>
          </tr>
          <tr>
            <td>5</td>
            <td>Instalment details</td>
            <td colspan="3"></td>
          </tr>
          <tr>
            <td></td>
            <td>Type of instalments</td>
            <td>Number of EPIs</td>
            <td>EPI (₹)</td>
            <td>Commencement of repayment, post sanction</td>
          </tr>
          <tr>
            <td></td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>${formatAllEmiDates()}</td>
          </tr>
          <tr>
            <td>6</td>
            <td>Interest rate (%) and type (fixed or floating or hybrid)</td>
            <td colspan="3">${interestRatePercent}% per day (fixed)</td>
          </tr>
          <tr>
            <td>7</td>
            <td>Additional Information in case of Floating rate of interest</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>

      <!-- Floating Rate Table -->
      <table>
        <tbody>
          <tr>
            <td style="width: 5%;"></td>
            <td style="width: 15%;">Reference Benchmark</td>
            <td style="width: 10%;">Benchmark rate (%) (B)</td>
            <td style="width: 10%;">Spread (%) (S)</td>
            <td style="width: 10%;">Final rate (%) R = (B)+(S)</td>
            <td style="width: 10%;">Reset periodicity (Months)</td>
            <td colspan="3">Impact of change in the reference benchmark (for 25 bps change in 'R', change in ₹)</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>B</td>
            <td>S</td>
            <td>EPI (₹)</td>
            <td>No. of EPIs</td>
          </tr>
          <tr>
            <td></td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
          </tr>
        </tbody>
      </table>

      <!-- Fees/Charges Table -->
      <table>
        <tbody>
          <tr>
            <td style="width: 5%;">8</td>
            <td colspan="5">Fee/Charges</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="2">Payable to the RE (A)</td>
            <td colspan="3" class="text-right">Payable to a third party through RE (B)</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>One-time/ Recurring</td>
            <td>Amount (in ₹) or Percentage (%) as applicable</td>
            <td>One time/ Recurring</td>
            <td>Amount (in ₹) or Percentage (%) as applicable</td>
          </tr>
          ${generateDeductFeesRows()}
          ${generateAddFeesRows()}
          ${generateGSTRow()}
          <tr>
            <td></td>
            <td>(${deductFromDisbursalFees.length + addToTotalFees.length + (gstAmount > 0 ? 1 : 0) + 1}) Insurance charges</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
          </tr>
          <tr>
            <td></td>
            <td>(${deductFromDisbursalFees.length + addToTotalFees.length + (gstAmount > 0 ? 1 : 0) + 2}) Valuation fees</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
          </tr>
        </tbody>
      </table>

      <!-- APR and Contingent Charges -->
      <table>
        <tbody>
          <tr>
            <td style="width: 5%;">9</td>
            <td style="width: 30%;">Annual Percentage Rate (APR) (%)</td>
            <td style="width: 65%;">${apr}</td>
          </tr>
          <tr>
            <td>10</td>
            <td colspan="2">Details of Contingent Charges (in ₹ or %, as applicable)</td>
          </tr>
          <tr>
            <td></td>
            <td>(i) Penal charges, if any, in case of delayed payment</td>
            <td>
              <p class="mb-2"><strong>a) Late Payment Fees / Penal charges:</strong></p>
              <p class="mb-1">If you miss a loan repayment:</p>
              <ul class="list-disc" style="margin-left: 20px; margin-bottom: 8px;">
                <li>On the first day after the due date: You'll be charged a one-time penalty of 5% of the overdue principal amount.</li>
                <li>From 2nd day after due date to 10th day after due date: you'll be charged 1% per day of the overdue principal amount.</li>
                <li>From 11th day after due date to 120th day after due date: you'll be charged 0.6% per day of the overdue principal amount.</li>
                <li>Above 120 days it's "0"</li>
              </ul>
              <p class="mb-2"><strong>Clarification:</strong> For the avoidance of doubt, it is hereby clarified that the Penal Charges will be calculated on the principal overdue amount only and shall be levied distinctly and separately from the components of the principal overdue amount and the loan interest. These charges are not added to the rate of interest against which the loan has been advanced and are also not subject to any further interest. Please note that these charges are calculated in a manner so as to be commensurate to the default and are levied in a non-discriminatory manner for this loan product.</p>
              <p><strong>b) Annualized Rate of Interest post-due date:</strong></p>
              <p>In case of loan repayment overdue, basic interest charges shall continue to accrue at the same rate at ${interestRatePercent}% per day on the Principal overdue amount from the First Overdue Day to Till the Loan is closed.</p>
            </td>
          </tr>
          <tr>
            <td></td>
            <td>(ii) Other penal charges, if any</td>
            <td>N/A</td>
          </tr>
          <tr>
            <td></td>
            <td>(iii) Foreclosure charges, if applicable</td>
            <td>Zero Foreclosure charges</td>
          </tr>
          <tr>
            <td></td>
            <td>(iv) Charges for switching of loans from floating to fixed rate and vice versa</td>
            <td>N/A</td>
          </tr>
          <tr>
            <td></td>
            <td>(v) Any other charges (please specify)</td>
            <td>
              Loan Tenure Extension 1: 21% of (2) + GST<br />
              Loan Tenure Extension 2: 21% of (2) + GST<br />
              Loan Tenure Extension 3: 21% of (2) + GST<br />
              Loan Tenure Extension 4: 21% of (2) + GST
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGE 2 - PART 2 -->
    <div class="page page-break">
      <!-- Header -->
      <div class="text-center mb-4">
        <h1 class="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
        <p class="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
        <p class="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
      </div>
      <hr />

      <div class="text-center mb-3">
        <p class="font-bold text-sm">Part 2 (Other qualitative information)</p>
      </div>

      <table>
        <tbody>
          <tr>
            <td style="width: 5%;">1</td>
            <td style="width: 70%;">Clause of Loan agreement relating to engagement of recovery agents</td>
            <td style="width: 25%;">7</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Clause of Loan agreement which details grievance redressal mechanism</td>
            <td>8.3</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Phone number and email id of the nodal grievance redressal officer</td>
            <td>
              Name: Mr.Kiran<br />
              Number: +91 9573794121<br />
              Mail ID: ${kfsData?.grievance?.email}
            </td>
          </tr>
          <tr>
            <td>4</td>
            <td>Whether the loan is, or in future maybe, subject to transfer to other REs or securitisation (Yes/No)</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>5</td>
            <td colspan="2">In case of lending under collaborative lending arrangements (e.g., co-lending/ outsourcing), following additional details may be furnished:</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td style="width: 5%;"></td>
            <td style="width: 31%;" class="font-bold">Name of the originating RE, along with its funding proportion</td>
            <td style="width: 32%;" class="font-bold">Name of the partner RE along with its proportion of funding</td>
            <td style="width: 32%;" class="font-bold">Blended rate of interest</td>
          </tr>
          <tr>
            <td></td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td style="width: 5%;">6</td>
            <td colspan="2">In case of digital loans, following specific disclosures may be furnished:</td>
          </tr>
          <tr>
            <td></td>
            <td style="width: 70%;">(i) Cooling off/look-up period, in terms of RE's board approved policy, during which borrower shall not be charged any penalty on prepayment of loan</td>
            <td style="width: 25%;">3 days</td>
          </tr>
          <tr>
            <td></td>
            <td>(ii) Details of LSP acting as recovery agent and authorized to approach the borrower</td>
            <td>Refer to: List of LSPs</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGE 3 - ANNEX B -->
    <div class="page page-break">
      <!-- Header -->
      <div class="text-center mb-4">
        <h1 class="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
        <p class="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
        <p class="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
      </div>
      <hr />

      <div class="text-center mb-3">
        <p class="font-bold text-sm">Annex B</p>
        <p class="font-bold text-sm">computation of APR</p>
      </div>

      <table>
        <thead>
          <tr>
            <th class="bg-gray-100" style="width: 5%;">Sr. No.</th>
            <th class="bg-gray-100" style="width: 60%;">Parameter</th>
            <th class="bg-gray-100" style="width: 35%;">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Sanctioned Loan amount (in Rupees)</td>
            <td>${formatCurrency(kfsData.loan?.sanctioned_amount || 0)}</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Loan Term (in years/ months/ days)</td>
            <td>${getLoanTermDisplay()}</td>
          </tr>
          <tr>
            <td></td>
            <td>a) No. of instalments for payment of principal, in case of non- equated periodic loans</td>
            <td>${kfsData.loan?.emi_count || kfsData.repayment?.number_of_instalments || (kfsData.repayment?.all_emi_dates?.length || 1)}</td>
          </tr>
          <tr>
            <td></td>
            <td>b) Type of EPI<br />Amount of each EPI (in Rupees) and<br />nos. of EPIs (e.g., no. of EMIs in case of monthly instalments)</td>
            <td>N/A<br />N/A<br />N/A</td>
          </tr>
          <tr>
            <td></td>
            <td>c) No. of instalments for payment of capitalised interest, if any</td>
            <td>N/A</td>
          </tr>
          <tr>
            <td></td>
            <td>d) Commencement of repayment, post sanction</td>
            <td>${formatAllEmiDates()}</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Interest rate type (fixed or floating or hybrid)</td>
            <td>Fixed</td>
          </tr>
          <tr>
            <td>4</td>
            <td>Rate of Interest</td>
            <td>${interestRatePercent}% per day</td>
          </tr>
          <tr>
            <td>5</td>
            <td>Total Interest Amount to be charged during the entire tenor of the loan as per the rate prevailing on sanction date (in Rupees)</td>
            <td>${formatCurrency(kfsData.interest?.total_interest || kfsData.calculations?.interest || 0)}</td>
          </tr>
          <tr>
            <td>6</td>
            <td>Fee/ Charges payable (in Rupees)</td>
            <td>${((kfsData.fees?.processing_fee || 0) + (kfsData.fees?.gst || 0) + (kfsData.fees?.total_add_to_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td></td>
            <td>A Payable to the RE</td>
            <td>${((kfsData.fees?.processing_fee || 0) + (kfsData.fees?.gst || 0) + (kfsData.fees?.total_add_to_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td></td>
            <td>B Payable to third-party routed through RE</td>
            <td>NA</td>
          </tr>
          <tr>
            <td>7</td>
            <td>Net disbursed amount (in Rupees)</td>
            <td>${formatCurrency(kfsData.calculations?.disbursed_amount || 0)}</td>
          </tr>
          <tr>
            <td>8</td>
            <td>Total amount to be paid by the borrower (in Rupees)</td>
            <td>${formatCurrency(kfsData.calculations?.total_repayable || 0)}</td>
          </tr>
          <tr>
            <td>9</td>
            <td>Annual Percentage rate- Effective annualized interest rate (in percentage)</td>
            <td>${apr}</td>
          </tr>
          <tr>
            <td>10</td>
            <td>Schedule of disbursement as per terms and conditions</td>
            <td>100% upfront</td>
          </tr>
          <tr>
            <td>11</td>
            <td>Due date of payment of instalment and interest</td>
            <td>${formatAllEmiDates()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGE 4 - ANNEX C & PART B -->
    <div class="page page-break">
      <!-- Header -->
      <div class="text-center mb-4">
        <h1 class="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
        <p class="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
        <p class="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
      </div>
      <hr />

      <div class="text-center mb-3">
        <p class="font-bold text-sm">Annex C</p>
        <p class="font-bold text-sm">Repayment Schedule</p>
      </div>

      <table class="mb-4">
        <thead>
          <tr>
            <th class="bg-gray-100">Instalment No.</th>
            <th class="bg-gray-100">Outstanding Principal (in Rupees)</th>
            <th class="bg-gray-100">Principal (in Rupees)</th>
            <th class="bg-gray-100">Interest + post service fee inclusive GST (in Rupees)</th>
            <th class="bg-gray-100">Instalment (in Rupees)</th>
          </tr>
        </thead>
        <tbody>
          ${generateRepaymentScheduleRows()}
        </tbody>
      </table>

      <div class="text-center mb-3">
        <p class="font-bold text-sm">PART B- SANCTION LETTER</p>
      </div>

      <div class="mb-3 text-xs">
        <p>Dear ${kfsData.borrower?.name || 'Customer'},</p>
        <p>Date: ${formatDate(kfsData.generated_at)}</p>
        <p>Sub: SANCTION LETTER</p>
      </div>

      <div class="mb-3 text-xs leading-relaxed">
        <p class="mb-2">With reference to your application for availing a loan we are pleased to sanction the same subject to the terms and conditions as mentioned above in Key Facts Statement in PART A and in the loan agreement to be executed. Payable in the manner as mentioned in the Key Facts Statement (KFS) above & in the loan agreement to be executed.</p>
        <p class="mb-2">The Borrower understands that the Lender has adopted risk-based pricing which is arrived by considering broad parameters like the borrower's financial and credit risk profile. Hence the rates of Interest will be different for different categories of borrowers based on the internal credit risk algorithms.</p>
        <p class="mb-2">Please note that this communication should not be construed as giving rise to any obligation on the part of LSP/DLA/RE unless the loan agreement and the other documents relating to the above assistance are executed by you in such form and manner as may be required by LSP/DLA/RE.</p>
        <p class="mb-3">We look forward to your availing of the sanctioned loan and assure you our best service always.</p>
      </div>

      <div class="mb-3">
        <p class="font-bold text-sm mb-2">TERMS & CONDITIONS OF RECOVERY MECHANISM</p>
        <p class="text-xs mb-2">The lender undertakes the recovery practices considering the following terms:</p>
        <ul class="list-disc text-xs mb-2" style="margin-left: 20px;">
          <li>In-house/Outsource Recovery</li>
          <li>Digital Recovery</li>
          <li>Reminder Communication</li>
          <li>Field Collection (if required)</li>
        </ul>
        <p class="text-xs mb-2">Where the Lender has failed to recover the money from the borrower it will rely upon the following legal recovery:</p>
        <ul class="list-disc text-xs mb-2" style="margin-left: 20px;">
          <li>Legal Notice</li>
          <li>Arbitration & Conciliation</li>
        </ul>
        <p class="text-xs mb-2">For the purpose of undertaking collection and recovery the Lender may either on its own or through the Lending service provider (including its debt recovery agents etc.) undertake collection or recovery from the Borrower.</p>
        <p class="text-xs mb-3">All loans are to be paid to the lender only through the digital lending app or payment link generated and shared with the borrowers by the Lender.</p>
      </div>

      <div class="mb-3">
        <p class="font-bold text-sm mb-2">Other Disclosures:</p>
        <ul class="list-disc text-xs" style="margin-left: 20px;">
          <li>The lender will not be responsible for any payments made to any individual or entity in their bank accounts.</li>
          <li>As per the RBI regulations information related to all borrowings and payments against those borrowings are reported to Credit Information Companies on a regular basis with in the stipulated timelines.</li>
          <li>Payment of Loans after the due date may impact your credit scores maintained by the Credit Information Companies.</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

module.exports = {
  generateKFSHTML,
  formatCurrency,
  formatDate
};
