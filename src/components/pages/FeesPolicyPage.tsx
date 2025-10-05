import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { DollarSign, FileText } from 'lucide-react';

export function FeesPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <DollarSign className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#1E2A3B' }}>
              Interest Rate, Penalty Charges, and <span style={{ color: '#0052FF' }}>Other Fees Policy</span>
            </h1>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              spheeti fintech private Limited | RBI Registered NBFC
            </p>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 md:p-12">
            
            {/* Section 1: INTRODUCTION */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                1. INTRODUCTION
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                spheeti fintech private Limited ("the Company" or "pocketcredit") is a Non-Banking Finance Company 
                registered with Reserve Bank of India ("RBI"). The Company is presently engaged in the business of 
                providing short term personal loans and advances without any collateral and/or security. The 
                Company has laid out appropriate internal principles and procedures in determining Interest Rate, 
                Overdue and other Charges and also made it available on its website, and shall update whenever 
                there is a change.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                The Board of Directors of the Company has adopted the Policy for Determining 
                Overdue Charges/Penalties ("the Policy") in accordance with the Master Direction – Reserve Bank of 
                India (Non-Banking Financial Company- Scale Based Regulation) Directions, 2023, Guidelines on 
                Digital Lending and other regulations applicable to the Company, in order to lay out appropriate 
                internal principles and procedures in determining charges.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                Keeping view of the RBI Guidelines as cited above, the following internal guiding principles and interest rate model are therefore laid out 
                by the board of the Company. This policy should always be read in conjunction with RBI guidelines, 
                directives, circulars and instructions. The Company will apply the best industry practices so long as 
                such practice does not conflict with or violate RBI guidelines.
              </p>
            </section>

            {/* Section 2: OBJECTIVES */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                2. OBJECTIVES
              </h2>
              <p className="text-sm text-gray-700 mb-3">
                The primary objectives of this Policy are to:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>1.</strong> Ensure that the interest rates charged by the Company are transparent, fair, and in compliance 
                  with regulatory requirements.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>2.</strong> Communicate the annualised rate of interest to the borrower along with the approach for risk 
                  gradation and rationale for charging different rates across borrower categories.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>3.</strong> Provide clarity regarding the methodology and rationale behind the determination of interest 
                  rates.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>4.</strong> Outline the factors considered in the determination of interest rates and other charges.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>5.</strong> Outline broad principles for levying penal charges in a fair and consistent manner.
                </li>
              </ul>
            </section>

            {/* Section 3: INTEREST RATE MODEL */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                3. INTEREST RATE MODEL
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                The Company lends money to its customer mainly through digital platforms through fixed interest 
                rate loans and has various products to cater to the needs of different category of customers.
              </p>
              <p className="text-sm text-gray-700 mb-3">
                The interest rate under each product is decided from time to time, giving due consideration to the 
                following factors:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>1. Cost of Funds:</strong> The cost of funds, including the cost of borrowings and other associated costs.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>2. Credit Risk:</strong> The credit risk profile of the Customer, including their credit history, repayment 
                  capacity, and overall financial stability.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>3. Nature of lending:</strong> The nature of lending, the associated principal / tenure.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>4. Loan Tenure:</strong> The duration of the loan, with different rates applicable for different loan tenures.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>5. Market Conditions:</strong> Prevailing market conditions, including interest rates in the banking and 
                  financial sectors.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>6. Operating Costs:</strong> Administrative and operational costs associated with the loan.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>7. Regulatory Requirements:</strong> Compliance with RBI guidelines and other statutory requirements.
                </li>
              </ul>
            </section>

            {/* Section 4: FIXED INTEREST RATE */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                4. FIXED INTEREST RATE
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                The Company offers standard interest rate to the Borrowers of 0.1% per day. This interest rate shall 
                be applied proportionately for the loan tenure.
              </p>
            </section>

            {/* Section 5: PRODUCT WISE FEES AND CHARGES */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                5. PRODUCT WISE FEES AND CHARGES
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                Besides interest, other financial charges like processing fees which can range from 10-15% on the 
                sanctioned loan amount, documentation fees, late payment charges, technology charges, pre-
                payment / foreclosure charges, and other cess at the rates as applicable from time to time) etc., 
                would be levied by the company. A mention of such charges will be included in the Loan 
                Agreement/Key Fact Statement (KFS) to be executed with the customer. Besides the above charges, 
                stamp duty, service tax, GST and other cess would be collected at applicable rates from time to time.
              </p>
            </section>

            {/* Section 6: OVERDUE CHARGES */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                6. OVERDUE CHARGES
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                Company shall collect delayed / late payment charges for any delay or default in making payments of 
                any dues. These delayed / late payment charges for different products or facilities would be decided 
                by the Company from time to time.
              </p>
              
              <h3 className="text-lg font-medium mb-3 mt-4" style={{ color: '#1E2A3B' }}>
                i. Key Principles
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                In compliance with the referred circular and Directions issued by RBI, the key principles based on 
                which the terms and conditions for penal charges have been framed are as follows:
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li className="text-sm text-gray-700">
                  The intent of levying penal charges is essentially to inculcate a sense of credit discipline and such 
                  charges are not meant to be used as a revenue enhancement tool over and above the contracted 
                  rate of interest.
                </li>
                <li className="text-sm text-gray-700">
                  Penalty, if charged, for non-compliance of material terms and conditions of loan contract by the 
                  borrower shall be treated as 'penal charges' and shall not be levied in the form of 'penal interest'.
                </li>
                <li className="text-sm text-gray-700">
                  There shall be no capitalisation of penal charges i.e., no further interest computed on such charges.
                </li>
                <li className="text-sm text-gray-700">
                  No additional component shall be added to the rate of interest.
                </li>
                <li className="text-sm text-gray-700">
                  The quantum of penal charges shall be reasonable and commensurate with the noncompliance of 
                  material terms and conditions of loan contract without being discriminatory within a particular loan / 
                  product category.
                </li>
              </ul>

              <h3 className="text-lg font-medium mb-3 mt-4" style={{ color: '#1E2A3B' }}>
                ii. Structure of Penal Charges
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Currently, penal charges are only to be levied if repayments are not made by the respective due date 
                and penal charges are not envisaged for any other non-compliances related to other terms and 
                conditions of the loan.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                Further, the quantum and reason for penal charges shall be clearly disclosed to the customers in the 
                loan agreement and most important terms & conditions / Key Fact Statement (KFS), in addition to 
                being disclosed on the Company website (pursuant to RBI Guidelines on Digital Lending dated 
                September 02, 2022 and RBI Circular dated April 15, 2024 on Key Fact Statements for Loans and 
                Advances) and the loan agreement. In addition to reminders sent to borrowers for non-compliance 
                of material terms and conditions of loan, the Borrowers shall also be communicated about the 
                applicable penal charges alongwith the instance of levy of penal charges and the reason thereof.
              </p>
            </section>

            {/* Section 7: ANNUAL PERCENTAGE RATE (APR) */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                7. ANNUAL PERCENTAGE RATE (APR)
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                The Company shall disclose the Annual Percentage Rate (APR) to all borrowers at the time of sanction 
                and in the loan agreement. The APR represents the total cost of borrowing on an annualized basis, 
                including interest and other charges.
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