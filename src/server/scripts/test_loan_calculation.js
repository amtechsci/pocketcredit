const { calculateLoanValues } = require('../utils/loanCalculations');

console.log('=== LOAN CALCULATION TEST ===\n');

// Test case: ₹10,000 loan for 15 days with Bronze tier rates
const testLoanData = {
  loan_amount: 10000,
  processing_fee_percent: 10,      // 10%
  interest_percent_per_day: 0.001  // 0.001 (which is 0.1% per day)
};

const days = 15;

console.log('INPUT:');
console.log(`  Loan Amount: ₹${testLoanData.loan_amount.toLocaleString()}`);
console.log(`  Processing Fee: ${testLoanData.processing_fee_percent}%`);
console.log(`  Interest Rate: ${testLoanData.interest_percent_per_day} per day (${testLoanData.interest_percent_per_day * 100}% per day)`);
console.log(`  Duration: ${days} days`);

console.log('\n--- Calculating ---\n');

try {
  const result = calculateLoanValues(testLoanData, days);
  
  console.log('RESULTS:');
  console.log(`  Principal: ₹${result.principal.toLocaleString()}`);
  console.log(`  Processing Fee: ₹${result.processingFee.toLocaleString()} (${result.processingFeePercent}%)`);
  console.log(`  Disbursement Amount: ₹${result.disbAmount.toLocaleString()} (what user receives)`);
  console.log(`  Interest: ₹${result.interest.toLocaleString()}`);
  console.log(`  Total Repayable: ₹${result.totalRepayable.toLocaleString()}`);
  
  console.log('\n--- Verification ---\n');
  
  // Verify calculations
  const expectedProcessingFee = 10000 * 0.10; // 10%
  const expectedDisbursement = 10000 - expectedProcessingFee;
  const expectedInterest = 10000 * 0.001 * 15;
  const expectedTotalRepayable = 10000 + expectedInterest;
  
  console.log('EXPECTED vs ACTUAL:');
  console.log(`  Processing Fee: ₹${expectedProcessingFee} ${result.processingFee === expectedProcessingFee ? '✓' : '✗'}`);
  console.log(`  Disbursement: ₹${expectedDisbursement} ${result.disbAmount === expectedDisbursement ? '✓' : '✗'}`);
  console.log(`  Interest: ₹${expectedInterest} ${result.interest === expectedInterest ? '✓' : '✗'}`);
  console.log(`  Total Repayable: ₹${expectedTotalRepayable} ${result.totalRepayable === expectedTotalRepayable ? '✓' : '✗'}`);
  
  console.log('\n--- Business Flow ---\n');
  console.log('1. User applies for ₹10,000 loan');
  console.log(`2. Processing fee ₹${result.processingFee.toLocaleString()} is deducted`);
  console.log(`3. User receives ₹${result.disbAmount.toLocaleString()} (not shown to user)`);
  console.log(`4. Interest calculated: ₹10,000 × 0.001 × 15 days = ₹${result.interest.toLocaleString()}`);
  console.log(`5. User must repay: ₹10,000 + ₹${result.interest.toLocaleString()} = ₹${result.totalRepayable.toLocaleString()}`);
  
  // Check if all values match expected
  const allCorrect = 
    result.processingFee === expectedProcessingFee &&
    result.disbAmount === expectedDisbursement &&
    result.interest === expectedInterest &&
    result.totalRepayable === expectedTotalRepayable;
  
  if (allCorrect) {
    console.log('\n✅ ALL CALCULATIONS CORRECT!');
  } else {
    console.log('\n❌ SOME CALCULATIONS ARE INCORRECT!');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

