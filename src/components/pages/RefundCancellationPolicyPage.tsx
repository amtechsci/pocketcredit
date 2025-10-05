import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { RefreshCw, FileText } from 'lucide-react';

export function RefundCancellationPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <RefreshCw className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#1E2A3B' }}>
              Refund and Cancellation <span style={{ color: '#0052FF' }}>Policy</span>
            </h1>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              spheeti fintech private Limited | Last Reviewed: 05/08/2025
            </p>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 md:p-12">
            
            {/* Introduction */}
            <section className="mb-8">
              <p className="text-sm text-gray-700 mb-4">
                <strong>Applicable to Loans/Services offered by spheeti fintech private Limited (the "Company")</strong>
              </p>
              <p className="text-sm text-gray-700 mb-4">
                This policy outlines the terms and conditions under which refunds and cancellations will be 
                processed for loan applications and payments made via our platform.
              </p>
            </section>

            {/* Section 1: Loan Disbursement */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                1. LOAN DISBURSEMENT
              </h2>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  Once the loan amount has been disbursed, it shall be non-refundable under any 
                  circumstance.
                </li>
                <li className="text-sm text-gray-700">
                  In cases where a borrower opts for early foreclosure or prepayment, such payments shall 
                  not result in any refund of interest, fees, or charges already paid or accrued.
                </li>
              </ul>
            </section>

            {/* Section 2: Interest and Fees */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                2. INTEREST AND FEES
              </h2>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  All interest and charges levied on the loan shall be non-refundable, irrespective of whether 
                  the loan is serviced partially or fully.
                </li>
              </ul>
            </section>

            {/* Section 3: Cancellation of Loan Application */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                3. CANCELLATION OF LOAN APPLICATION
              </h2>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  Borrowers may request cancellation of their loan application at any point prior to the 
                  disbursement of funds.
                </li>
                <li className="text-sm text-gray-700">
                  Such cancellation requests must be made in writing and submitted to our customer support 
                  team at: <a href="mailto:support@pocketcredit.in" className="text-blue-600 hover:underline">support@pocketcredit.in</a>
                </li>
              </ul>
            </section>

            {/* Section 4: Cool-Off / Lookup Period */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                4. COOL-OFF / LOOKUP PERIOD
              </h2>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  All sanctioned loans may include a cool-off or look-up period (typically 2 days) from the 
                  date of disbursement.
                </li>
                <li className="text-sm text-gray-700">
                  During this period, borrowers may choose to foreclose the loan by repaying the full 
                  disbursement amount along with a proportionate Annualised Percentage Rate (APR) fee.
                </li>
                <li className="text-sm text-gray-700">
                  Post this window, the loan shall be governed by regular foreclosure and prepayment terms, 
                  without refund eligibility.
                </li>
              </ul>
            </section>

            {/* Section 5: Refund for Technical Errors */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                5. REFUND FOR TECHNICAL ERRORS (EMI/LOAN REPAYMENTS)
              </h2>
              <p className="text-sm text-gray-700 mb-3">
                Refunds shall be considered only under the following specific conditions:
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  Multiple deductions from the customer's account due to technical error.
                </li>
                <li className="text-sm text-gray-700">
                  Excess payment made in a single transaction due to gateway/system error.
                </li>
                <li className="text-sm text-gray-700">
                  Failed transaction: If the payment was deducted but the loan repayment was unsuccessful.
                </li>
              </ul>
              <p className="text-sm text-gray-700 mt-4">
                In such cases, only the excess amount (excluding applicable Payment Gateway charges) shall be 
                refunded after validation.
              </p>
            </section>

            {/* Section 6: Refund Request Procedure */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                6. REFUND REQUEST PROCEDURE
              </h2>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  The customer must submit a formal refund request, along with the transaction ID and 
                  relevant details to: <a href="mailto:support@pocketcredit.in" className="text-blue-600 hover:underline">support@pocketcredit.in</a>
                </li>
                <li className="text-sm text-gray-700">
                  Refunds, upon verification and approval, shall be processed by electronic transfer to the 
                  customer's bank account within 21 calendar days from the date of receipt of the request.
                  <ul className="list-circle ml-6 mt-2">
                    <li className="text-sm text-gray-700">
                      Refunds may reflect in the customer's account between 3–21 working days, 
                      depending on the bank's processing timeline.
                    </li>
                  </ul>
                </li>
              </ul>
            </section>

            {/* Section 7: Exclusions from Liability */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                7. EXCLUSIONS FROM LIABILITY
              </h2>
              <p className="text-sm text-gray-700 mb-3">
                The Company shall not be liable for failure to process any refund or payment due to reasons 
                including but not limited to:
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  Incomplete, inaccurate, or delayed payment instructions;
                </li>
                <li className="text-sm text-gray-700">
                  Insufficient funds or account limits;
                </li>
                <li className="text-sm text-gray-700">
                  Funds held under lien, freeze, or encumbrance;
                </li>
                <li className="text-sm text-gray-700">
                  Delays or refusal by the customer's bank or the NPCI;
                </li>
                <li className="text-sm text-gray-700">
                  Acts beyond Company's control (force majeure) such as natural disasters, bank strikes, 
                  system failures, or other unforeseen events.
                </li>
              </ul>
              <p className="text-sm text-gray-700 mt-4">
                In case of failed transactions, the customer will be notified via email.
              </p>
            </section>

            {/* Contact Information */}
            <section className="mb-8 bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-3" style={{ color: '#1E2A3B' }}>
                Contact Us
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                For refund requests, cancellations, or any queries regarding this policy, please contact:
              </p>
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> <a href="mailto:support@pocketcredit.in" className="text-blue-600 hover:underline">support@pocketcredit.in</a>
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Company:</strong> spheeti fintech private Limited
              </p>
            </section>

            {/* Action Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline"
                onClick={() => window.print()}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Print / Download
              </Button>
              <Button 
                onClick={() => navigate('/home')}
                style={{ backgroundColor: '#0052FF' }}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}