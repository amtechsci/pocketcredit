import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Scale, FileText } from 'lucide-react';

export function FairPracticeCodePage() {
    const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Scale className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#1E2A3B' }}>
              Fair Practice <span style={{ color: '#0052FF' }}>Code</span>
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
                spheeti fintech private Limited ("Company" or "pocketcredit") is a Non Banking Financial Company 
                registered with Reserve Bank of India (RBI). The Company endeavours to review and follow the 
                policy guidelines laid down by RBI to set up fair business practices while dealing with its borrowers.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                Accordingly, this Fair Practice Code ("FPC" or "Code") has been amended pursuant to the Master 
                Direction – Reserve Bank of India (Non-Banking Financial Company –Scale Based Regulation) 
                Directions, Hence, in compliance with the said directions, this Code has been framed, approved, and 
                reviewed by Board of the Company from time to time. The Company shall always adopt the best 
                business practices from time to time and make appropriate modifications, as necessary to this Code.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                This has reference to RBI Circular No. RBI/2015-16/16 DNBR (PD) CC.No.054/03.10.119/2015-16 
                dated 01st July 2015, wherein the Reserve Bank of India (RBI) has issued the guidelines on Fair 
                Practices Code for NBFCs to implement the same. All of this was consolidated in the Master Direction 
                - Non-Banking Financial Company – Non-Systemically Important Non-Deposit taking Company 
                (Reserve Bank) Directions, 2016 which is replaced by Master Direction – Reserve Bank of India (Non-
                Banking Financial Company- Scale Based Regulation) Directions, 2023 dated 19th October 2023 as 
                amended from time to time.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                The Fair Practices Code, as mentioned herein below, is in conformity with these Guidelines/ 
                Directions on Fair Practices Code for NBFCs as contained in the aforesaid RBI Circular/ Direction. This 
                sets minimum Fair Practice standards for the Company to follow when dealing with borrowers. It 
                provides information to borrowers and explains how the Company is expected to deal with them on 
                a day-to-day basis.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                spheeti fintech private Limited is committed to dealing with its borrowers in a fair and transparent 
                manner. As a Non-Banking Financial Company (NBFC), the Company has put in place a Fair Practice 
                Code.
              </p>
            </section>

            {/* Section 2: OBJECTIVE OF THE CODE */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                2. OBJECTIVE OF THE CODE
              </h2>
              <p className="text-sm text-gray-700 mb-3">
                Primary objectives behind development of this code are:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>(A)</strong> Promote good, fair and trustworthy practices in dealing with the borrowers;
                </li>
                <li className="text-sm text-gray-700">
                  <strong>(B)</strong> Increase transparency to enable the borrowers to have a better understanding of what they can 
                  reasonably expect of the services.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>(C)</strong> Encourage market forces, through competition, to achieve higher operating standards;
                </li>
                <li className="text-sm text-gray-700">
                  <strong>(D)</strong> Promote a fair and cordial relationship between the borrowers and the Company.
                </li>
                  </ul>
            </section>

            {/* Section 3: COMPANY'S KEY COMMITMENTS AND DECLARATIONS */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                3. COMPANY'S KEY COMMITMENTS AND DECLARATIONS
              </h2>
              <ul className="list-none space-y-3 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>i.</strong> To act honestly, fairly and reasonably in conducting financial activities and to deal our borrowers on 
                  the ethical principles of integrity and transparency.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>ii.</strong> To not discriminate against clients on the basis of gender, race, caste, religion or language and to 
                  treat all the clients consistently and fairly.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>iii.</strong> To prominently display the Fair Practice Code on the notice board at Registered Office of company 
                  and put systems in place to ensure compliance. Moreover, company always welcomes new ideas and 
                  suggestions from its clients.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>iv.</strong> To ensure transparency in the maintenance of books of accounts and disclosure of financial 
                  statements by qualified auditor/s.
                </li>
                  </ul>
              <p className="text-sm text-gray-700 mt-4">
                The Board of Directors and the management team of pocketcredit are responsible for implementing the FPC 
                and also to ensure that its operations reflect its strong commitment to all the stakeholders for 
                offering in a fair and equitable manner, the various financial services and products including lending 
                as pocketcredit may provide from time to time and that all pocketcredit employees/representatives shall be aware 
                of this commitment.
              </p>
            </section>

            {/* Section 4: APPLICATIONS FOR AVAILING LOANS AND THEIR PROCESSING */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                4. APPLICATIONS FOR AVAILING LOANS AND THEIR PROCESSING
              </h2>
              <ul className="list-none space-y-3 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>a)</strong> All communications to the borrower shall be provided in the vernacular language upon request.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>b)</strong> All the Loan agreements shall contain all necessary information, especially the Rate of interest, 
                  Processing Charges, insurance charges, Penal Charges and such other charges which affects the 
                  interest of the borrower, so that he can make a meaningful comparison with the terms and 
                  conditions offered by other NBFCs so that an informed decision can be taken by the borrower. The 
                  loan application form shall indicate the documents required to be submitted with the application 
                  form.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>c)</strong> pocketcredit will offer credit to eligible qualified applicants who express their need to borrow through 
                  their loan request.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>d)</strong> Company shall give acknowledgement for receipt of loan applications and other documents. The 
                  Company shall inform the party about the pendency of any information and document for processing 
                  the Loan application. The decision on loan application shall be taken not later than 30 days from the 
                  date of receipt of completed loan application. Loan application will be considered as complete, once 
                  all information has been duly received and filled in and required documents have been submitted 
                  and found acceptable. The Loan application and acknowledgment shall contain the time frame within 
                  which loan applications will be disposed of.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>e)</strong> The applicant will be given the contact numbers on the application from whom he can enquire 
                  about developments in the loan process.
                </li>
                  </ul>
            </section>

            {/* Section 5: LOAN APPRAISAL AND TERMS/CONDITIONS */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                5. LOAN APPRAISAL AND TERMS/CONDITIONS
              </h2>
              <ul className="list-none space-y-3 ml-4">
                <li className="text-sm text-gray-700">
                  <strong>i.</strong> The company shall convey in writing to the borrower as understood by the borrower by means of 
                  sanction letter, loan agreement, Key Facts Statement(KFS) or otherwise, the amount of annualized 
                  rate of interest, Annual Percentage Rate (APR) and method of application thereof and keep the 
                  acceptance of these terms and conditions by the borrower on its record. Company shall mention the 
                  penal charges charged for late repayment in bold in the loan agreement.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>ii.</strong> The Company shall disclose all the contingent charges separately in their sanction letter.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>iii.</strong> Company shall furnish a copy of the loan agreement along with the enclosures if any, preferably in 
                  the vernacular language if requested by the borrower along with a copy each of all enclosures 
                  quoted in the loan agreement to all the borrowers at the time of sanction / disbursement of loans.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>iv.</strong> To reinforce the understanding, company shall reiterate the terms and conditions, and 
                  responsibilities at the time of application, sanction and disbursement.
                </li>
                <li className="text-sm text-gray-700">
                  <strong>v.</strong> The terms and conditions explained to the borrower include, but are not limited to the following:
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>The manner of repayment of the loan</li>
                    <li>The loan amount and tenure, rate of interest, Annual Percentage Rate, Processing fees method of calculation</li>
                    <li>All applicable charges and fees</li>
                    <li>Penal charges for late payment</li>
                    <li>Prepayment charges if any</li>
                    <li>Terms and conditions for foreclosure</li>
                  </ul>
                </li>
                  </ul>
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
