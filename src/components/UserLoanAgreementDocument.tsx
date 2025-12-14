import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Loader2, AlertCircle } from 'lucide-react';

interface LoanAgreementData {
  company: any;
  loan: any;
  borrower: any;
  interest: any;
  fees: any;
  calculations: any;
  repayment: any;
  penal_charges: any;
  grievance: any;
  digital_loan: any;
  bank_details: any;
  generated_at: string;
}

interface UserLoanAgreementDocumentProps {
  loanId: number;
}

export function UserLoanAgreementDocument({ loanId }: UserLoanAgreementDocumentProps) {
  const [agreementData, setAgreementData] = useState<LoanAgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loanId) {
      fetchAgreementData();
    }
  }, [loanId]);

  const fetchAgreementData = async () => {
    try {
      setLoading(true);
      // Use the same KFS endpoint as it contains all loan agreement data
      const response = await apiService.getKFS(loanId);
      if (response.success && response.data) {
        setAgreementData(response.data);
      } else {
        setError('Failed to load Loan Agreement data');
      }
    } catch (err: any) {
      console.error('Error fetching Loan Agreement:', err);
      setError(err.message || 'Failed to load Loan Agreement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatAddress = (address: any) => {
    if (typeof address === 'string') return address;
    if (!address) return 'N/A';

    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
      address.country
    ].filter(Boolean);

    return parts.join(', ') || 'N/A';
  };

  const maskAadhar = (aadhar: string) => {
    if (!aadhar || aadhar === 'N/A') return 'N/A';
    return 'XXXXXXXX' + aadhar.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading Loan Agreement...</p>
        </div>
      </div>
    );
  }

  if (error || !agreementData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error || 'Loan Agreement data not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loan-agreement-content bg-white" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <div className="p-12" style={{ fontSize: '8pt', lineHeight: '1.6' }}>
        {/* Header */}
        <div className="text-center mb-6">
          <strong>{agreementData.company.name}</strong><br />
          CIN: {agreementData.company.cin} | RBI Registration no: {agreementData.company.rbi_registration}<br />
          {agreementData.company.address}
        </div>
        <hr className="mb-6 border-black" />

        <h1 className="text-center font-bold mb-6" style={{ fontSize: '11pt' }}>
          {agreementData.company.name} - Loan Agreement<br />
          (hereinafter referred to as "Agreement")
        </h1>

        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          This Loan Agreement ("Agreement") has been executed on "{formatDate(agreementData.loan.created_at || agreementData.generated_at)}" by and between,
        </p>

        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          <strong>{agreementData.company.name}</strong> incorporated under the Companies Act 1956 having CIN- {agreementData.company.cin}, having its registered office at {agreementData.company.registered_office || agreementData.company.address} and corporate office at {agreementData.company.address} (hereinafter referred as "<strong>Lender</strong>" unless it be repugnant to the context or meaning thereof, be deemed to mean and include authorized representatives, heirs, successors, executors, administrators, nominees, and permitted assignees, as the case may be).
        </p>

        <p className="text-center font-bold my-4">AND</p>

        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          {agreementData.borrower.name} with PAN Number: {agreementData.borrower.pan || agreementData.borrower.pan_number || 'N/A'} and whose additional details are mentioned in Annexure -1 Borrower Details (hereinafter referred to as the "<strong>Borrower</strong>", unless repugnant to the context or meaning thereof, be deemed to mean and include the Borrower's authorized representatives, heirs, successors, executors, administrators, and nominees, as the case may be).
        </p>

        <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          BACKGROUND
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Lender is a Non-Banking Financial Company registered with the Reserve Bank of India engaged in the business of extending financial assistance.</li>
          <li className="mb-2">The Borrower has voluntarily approached the Lender to request and avail the loan facility and has agreed to be bound by all terms and conditions as prescribed by the Lender and set forth in this Agreement.</li>
          <li className="mb-2">The Borrower confirms that they have read, understood, and accepted the terms of this Agreement, along with the Lender's Privacy Policy and Terms and Conditions, and agrees to comply with all provisions therein in consideration of availing the loan facility.</li>
          <li className="mb-2">Relying on the representations and information provided by the Borrower, the Lender has agreed to sanction the Loan for the purpose specified herein, subject to the terms and conditions contained in this Agreement.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <p className="font-bold mb-4">NOW THIS LOAN AGREEMENT WITNESSETH AS FOLLOWS:</p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          1. AMOUNT OF LOAN, DISBURSEMENT AND INTEREST
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Lender agrees to extend, and the Borrower agrees to accept, a loan facility for an amount not exceeding {formatCurrency(agreementData.loan.sanctioned_amount)}/-, for the purpose specified in this Agreement, and subject to the terms and conditions set forth herein. The said amount shall hereinafter be referred to as the "<strong>Loan</strong>."</li>
          <li className="mb-2">The disbursement of the Loan by the Lender shall take place after execution of this Agreement. The Lender shall disburse an amount of {formatCurrency(agreementData.calculations.disbursed_amount || agreementData.loan.disbursal_amount || (agreementData.loan.sanctioned_amount - agreementData.fees.processing_fee - agreementData.fees.gst))}/- (after deduction of applicable fees and charges as detailed in the Key Facts Statement) from its designated bank account to the Borrower's bank account, as provided in the digital lending application of the Lender. In the event that the Borrower requests to change the designated bank account, the Borrower shall submit a formal written application via registered mail to the Lender. Upon receipt of such application, the Lender shall issue a response regarding its decision to the Borrower.</li>
          <li className="mb-2">Post acceptance of the Loan application by the Lender, the Borrower shall have the right to request the cancellation of the loan within 12 hours of such acceptance, before the Loan is disbursed to the Borrower.</li>
          <li className="mb-2">Borrower shall pay Interest at the rate specified which may be changed prospectively by the Lender by providing prior notice to the Borrower. The Interest shall be calculated as on the principal amount as mentioned in the Key Facts Statement ("KFS"). The Interest shall begin to accrue from the date of disbursement of the Loan to the Borrower till the repayment due dates mentioned in the Loan agreement and KFS. The Lender may, at its sole discretion, and, subject to applicable laws, alter such due dates.</li>
          <li className="mb-2">Each payment made by the Borrower under the terms of this Agreement shall be made on or before the respective due date, as mentioned in the Loan Agreement and KFS.</li>
          <li className="mb-2">Borrower shall make the Loan repayment along with the interest and other applicable charges to the Lender in accordance with the terms mentioned in this Agreement.</li>
          <li className="mb-2">Without prejudice to any other rights under this Agreement, the Lender shall be entitled to levy Penal Charges from the Borrower on the occurrence of an Event of Default under these Terms. The Borrower hereby acknowledges that all sums payable under these Terms of this agreement by way of Penal Charges are reasonable and that they represent genuine pre-estimates of the loss incurred by the Lender in the event of occurrence of any default.</li>
          <li className="mb-2">Lender may withhold or cancel the disbursement of the Loan or any installment thereof in the event of a breach of this Agreement or any applicable law by the Borrower.</li>
          <li className="mb-2">The Lender will decide on the grant of the Loan based on the merits of the application, at its sole discretion.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={10} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Lender may engage agencies to recover the loan amount from the Borrower. Details of these agencies shall be mentioned in the Key Fact Statement provided to the Borrower.</li>
          <li className="mb-2">Lender reserves the right to share the Borrower's loan information, including credit history and defaults, with its affiliates, the Reserve Bank of India, banks, financial institutions, credit bureaus, statutory bodies, tax authorities, the Central Information Bureau, research merchants, third party service providers and other organizations the Lender deems appropriate in pursuance to the Loan facility.</li>
          <li className="mb-2">The Loan details for this loan facility are mentioned in Annexure-II Loan Facility.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          2. DEFINITIONS AND INTERPRETATION
        </h2>
        <h3 className="font-normal italic mb-2">2.1 Definitions</h3>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          In this Agreement, the following capitalized words shall have the following meanings:
        </p>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">"<strong>Agreement</strong>" means this Loan Agreement together with the Schedules and Annexures attached hereto as may be amended from time to time in accordance with its terms.</li>
          <li className="mb-2">"<strong>Annexure</strong>" means the Annexure(s) or Schedule(s) to this Agreement.</li>
          <li className="mb-2">"<strong>Borrower</strong>" means a person who has approached the Lender for credit facility as the context may require.</li>
          <li className="mb-2">"<strong>Business Day</strong>" means:
            <ol type="a" style={{ paddingLeft: '20px' }}>
              <li>for determining when a notice, consent or other communication is given, a day that is not a Saturday, Sunday or public holiday in the place to which the notice, consent or other communication is sent; and</li>
              <li>for any other purpose, a day (other than a Saturday, Sunday or public holiday) on which banks are open for general banking business in {agreementData.company.jurisdiction || 'Bengaluru'}.</li>
            </ol>
          </li>
          <li className="mb-2">"<strong>Cooling Off Period</strong>" means period as determined by the Lender wherein the Borrower can exercise option for foreclosure of loan without penalty and payment of only proportionate charges.</li>
          <li className="mb-2">"<strong>Loan</strong>" means the principal amount sanctioned and disbursed to the Borrower by the Lender under this Agreement.</li>
          <li className="mb-2">"<strong>Outstanding Amount</strong>" means the amount outstanding to be repaid under the Loan which amount shall include the principal, interest and such other expenses as are agreed to be borne by the Borrower under this Agreement.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={8} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">"<strong>Parties</strong>" means the Lender and the Borrower.</li>
          <li className="mb-2">"<strong>Foreclosure</strong>" means premature repayment as per the terms and conditions laid down by the Lender in that behalf and in force at the time of prepayment.</li>
        </ol>

        <h3 className="font-normal italic mb-2 mt-4">2.2 Other terms may be defined elsewhere in the text of this Agreement and, unless otherwise indicated, shall have such meaning throughout this Agreement.</h3>

        <h3 className="font-normal italic mb-2">2.3 Interpretation</h3>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Wherever the context so requires, any reference to the singular includes the plural and any reference to the plural includes the singular respectively;</li>
          <li className="mb-2">Words of any gender are deemed to include the other gender;</li>
          <li className="mb-2">The arrangement of clauses shall have no bearing on their interpretation;</li>
          <li className="mb-2">Words denoting a person shall include an individual, corporation, company, partnership trust or other entity; provided however that clause specifically applicable to a company or body corporate shall not apply to any other entity;</li>
          <li className="mb-2">Heading and bold typeface are only for convenience and shall be ignored for the purposes of interpretation;</li>
          <li className="mb-2">Reference to the word "include" or "including" shall be construed without limitation;</li>
          <li className="mb-2">Schedules, sub-schedules and Annexure to this Agreement shall form an integral part hereof.</li>
          <li className="mb-2">The terms and expressions not herein defined shall where the interpretation and meaning have been assigned to them in terms of the General Clauses Act, 1897, have that interpretation and meaning.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          3. REPAYMENT
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          It is mutually agreed between the parties, that 'time shall be the essence of this agreement' and the Borrower shall repay the amounts availed under Loan by following repayment methods, as specified by the Lender in the Sanction Letter ("Repayment Method"):
        </p>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Repayment Method and corresponding due dates as detailed under the Annexure -II shall be specified in the Loan agreement and KFS and the Borrower undertakes to make regular repayments in accordance with the Annexure -1.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={2} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Without prejudice to any other rights that the Lender may have under law, in the case of Event of Default, the Borrower shall pay additional Penal Charges at such rate as provided in this agreement and the Key Fact Statement.</li>
          <li className="mb-2">The Lender may, without prejudice to any other rights that the Lender may have under law, with assigning any reason, cancel in full or in part the Loan and demand repayment thereof. Upon such notice, the said dues shall become forthwith due and payable by the Borrower.</li>
          <li className="mb-2">In the event of any suspension/ withdrawal of the facility / recall of the Loan due to any kind of improper repayment behaviour, the Borrower agrees that the Lender shall not be obligated to refund any fee paid by the Borrower.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          4. PRE-PAYMENT OF THE LOAN
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Notwithstanding the applicable Annexure-ll and repayment method, the Borrower may prepay the full Loan ("Foreclosure"). The Lender, at its sole discretion, will grant such foreclosure subject to such terms and conditions as it deems appropriate, including without limitation, the payment of foreclosure charges if any or part thereof (except in the event of foreclosure during cooling-off period), as may be stipulated by the Lender.</li>
          <li className="mb-2">In pursuance of request by the Borrower to foreclose the Loan during the cooling-off period, the Borrower shall be liable to pay proportionate charges for the Loan. For foreclosures made after the cooling-off period, the Borrower shall be liable to pay the entire applicable loan charges, as determined by the Lender.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          5. BORROWER COVENANTS
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Borrower shall utilize the entire Loan for the purposes specified in this Loan Agreement and unless otherwise agreed to by the Lender in writing for no other purpose whatsoever.</li>
          <li className="mb-2">The Borrower shall duly and punctually comply with all the terms and conditions this Agreement. The Borrower affirms that they are legally competent and possess the necessary legal authority to enter into, execute, and fulfill the obligations outlined in this Agreement. Borrower warrants that obtaining the Loan, complying with the terms and conditions of this Agreement, and executing this Agreement do not and will not violate any applicable laws or the Borrower's contractual obligations. Furthermore, the Borrower fully understands the terms of this Agreement and is both financially and legally competent of entering into this arrangement and performing all obligations stipulated herein.</li>
          <li className="mb-2">The Borrower shall be solely and unconditionally liable for the repayment of all amounts due and will make payments regardless of any reminders, demands, or notices issued. Borrower shall not withhold payment Lender under these terms and conditions, and agrees to receive updates, messages, or other communications with reference to the Loan on the designated mobile number or email address.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={4} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Borrower undertakes that the amount repaid by the Borrower shall be appropriated first towards principal amount, interest, penal charges and any other costs.</li>
          <li className="mb-2">The Borrower undertakes to keep the Lender updated immediately about any changes in the information provided to the Lender from time to time.</li>
          <li className="mb-2">Borrower shall not assign, sell, or transfer any rights or obligations under these terms and conditions to any other person without the prior approval of Lender;</li>
          <li className="mb-2">The Borrower undertakes to always act in good faith in all his / her dealings in relation to the Loan and the Lender.</li>
          <li className="mb-2">The Borrower agrees and authorises the Lender to use his / her Aadhaar Number to update all of his / her other loan facilities availed from the Lender (if any), for KYC purpose and/or for any other purpose and / or as may be required by the RBI Master Directions - Know Your Customer Directions (as amended from time to time) or any other applicable law.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          6. BORROWER WARRANTIES
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Borrower confirms the accuracy of the information given in his loan application made to the Lender and any prior or subsequent information or explanation given to the Lender in this behalf and such information shall be deemed to form part of the representations and warranties on the basis of which the lender has sanctioned the Loan.</li>
          <li className="mb-2">Borrower confirms that he has an annual household income exceeding Rs. 3,00,000 (Rupees Three Lakhs), where the term "household" refers to a single family unit, consisting of the Borrower, their spouse, and their unmarried children above the age of 18 years.</li>
          <li className="mb-2">The Borrower confirms that his/her name does not appear in the list of defaulters or wilful defaulters maintained by the Reserve Bank of India (RBI), the Credit Information Companies (CICs), or any caution/advisory list maintained by the Export Credit Guarantee Corporation (ECGC). The Borrower further declares that he/she is not listed on any sanctions or watchlists issued by competent authorities including the United Nations Security Council (UNSC), the Financial Action Task Force (FATF), or any government agency in connection with anti-money laundering (AML), combating financing of terrorism (CFT), or related regulatory frameworks. The Borrower neither has / had any insolvency proceedings against him / her, nor has ever been adjudicated insolvent by any court or other authority.</li>
          <li className="mb-2">The Borrower understands and acknowledges that the Lender shall have absolute discretion, without assigning any reason to reject his / her Application Form and that the Lender shall not be responsible/liable in any manner whatsoever for such rejection.</li>
          <li className="mb-2">The Borrower hereby consents to the verification of the Know Your Customer (KYC) details by the Lender or their authorized representatives or agents.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={6} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Borrower hereby consents to the recording of any telephonic conversations between the Borrower and the Lender or their authorized representatives, for the purposes of verification and record-keeping.</li>
          <li className="mb-2">The Borrower hereby agrees to mandatorily submit a copy of their required documents to the Lender, as required for the processing and verification of the loan.</li>
          <li className="mb-2">The Borrower hereby consents to the Lender sending communications via WhatsApp, email, SMS, telephone, or any other electronic medium for the purpose of informing the Borrower regarding the loan status, including but not limited to reminders for loan closure.</li>
          <li className="mb-2">The Borrower hereby agrees that he/she has understood the terms of this agreement and also agrees that they shall request the Lender for the agreement in vernacular language if needed.</li>
        </ol>
        <p style={{ textAlign: 'justify', marginBottom: '10px', marginTop: '10px' }}>
          Any violation of the covenants and warranties set forth herein shall constitute a breach of material term of this Agreement and will result in any action deemed appropriate at the sole discretion of the Lender.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          7. TERM OF THE LOAN AND TERMINATION
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">The Agreement shall become binding on and from the date of execution hereof unless terminated earlier in pursuance to event of default. It shall be in force till all the monies due and payable to the Lender under this Agreement are fully paid.</li>
          <li className="mb-2">The Lender may at its sole discretion and with assigning any reason and upon written notice mailed or delivered to the Borrower terminate the Loan in full or part.</li>
          <li className="mb-2">Upon such termination, the Lender shall have the right to demand repayment of the total outstanding amount and upon such demand the total outstanding amount shall become forthwith due and payable by the Borrower to the Lender.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          8. EVENT OF DEFAULT
        </h2>
        <h3 className="font-normal italic mb-2">8.1 Each of the following events or circumstances would constitute events of default under the terms of the Facility Documents ("Event of Default"):</h3>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Default shall have occurred in the performance of any of the covenants, conditions or agreements on the part of the Borrower under this Agreement in respect of the Loan and such default shall have continued over a period of 30 days after notice thereof shall have been given by the Lender to the Borrower, or if the Borrower fails to inform the Lender of the happening of event of default.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <ol type="i" start={2} style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Any information given by the Borrower in his loan application to the Lender for the Loan is found to be misleading or incorrect in any material respect or any covenant or warranty is found to be incorrect.</li>
          <li className="mb-2">The Borrower is in breach of any of the covenants provided in Covenants and Undertakings.</li>
          <li className="mb-2">The Borrower is found to be in breach of any of the representations made by the Borrower as provided in Representations and Warranties.</li>
          <li className="mb-2">The Borrower has or there is a reasonable apprehension (in the sole opinion of the Lender) that the Borrower would voluntarily become the subject of proceedings under any bankruptcy or insolvency law.</li>
          <li className="mb-2">The Borrower has failed to furnish information/ documents as required by the Lender.</li>
          <li className="mb-2">Failure to make repayment on the repayment due dates.</li>
        </ol>

        <h3 className="font-normal italic mb-2 mt-4">8.2 On the occurrence of any Event of Default, the Lender is entitled to undertake any or all of the following:</h3>
        <ol type="a" style={{ textAlign: 'justify', paddingLeft: '40px', listStyleType: 'lower-alpha' }}>
          <li className="mb-2">terminate this Agreement with immediate effect and/or as the case may be;</li>
          <li className="mb-2">call upon the Borrower to pay forthwith all the outstanding balance in respect of Loan together with Interest, principal amount, penal charges, and all other sums payable as per the loan application Documents</li>
          <li className="mb-2">impose applicable penal charges and/or as the case may be;</li>
          <li className="mb-2">exercise any other right or remedy available under law or contractual agreements, including but not limited to initiating proceedings under Section 138 and/or Section 141 of the Negotiable Instruments Act, 1881, and Section 25 of the Payment and Settlement Systems Act, 2007</li>
          <li className="mb-2">In addition to the above, so long as there shall be an Event of Default, the Borrower shall pay the Penal Charges (as provided in the Loan Agreement and KFS) until such Event(s) of Default is/are rectified to the satisfaction of the Lender, without any prejudice to the remedies available to the Lender or the consequences of Events of Default.</li>
          <li className="mb-2">The Borrower acknowledges that the Lender may enforce payment of all outstanding amounts under this Agreement against the Borrower's estate and assets, and that this Agreement shall remain binding on the Borrower's heirs, executors, legal representatives, and administrators.</li>
          <li className="mb-2">Without prejudice to any other rights available to the Lender under this Agreement, the Lender shall have the right to initiate criminal proceedings or take any other appropriate legal action against the Borrower if, at its sole discretion, it has reasonable grounds to believe that the Borrower has provided any false information, misrepresented facts, or submitted forged documents or fabricated data. Further, if the Borrower becomes untraceable, the Lender reserves the right to contact the Borrower's family members, referees, or friends to ascertain the Borrower's whereabouts.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          9. WAIVER
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          No delay in exercising or omission to exercise, any right, power or remedy accruing to the Lender, shall impair any such right, power or remedy or shall be construed to be a waiver thereof or any acquiescence by it in any default; nor shall the action or inaction of the Lender in respect of any default or any acquiescence by it in any default affect or impair any right, power or remedy of the Lender in respect of any other default.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          10. SEVERABILITY
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          If any provision of this Agreement is invalid, unenforceable or prohibited by law, this Agreement shall be considered divisible as to such provision and such provision, shall be inoperative and shall not be part of the consideration moving from either Party hereto to the other, and the remainder of this Agreement shall be valid, binding and of like effect as though such provision was not included herein.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          11. INDEMNIFICATION
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          Borrower hereto indemnifies and agrees to defend and hold the Lender harmless from and against all liabilities, obligations, losses, expenses, costs, claims and damages (including all legal costs), whether direct or indirect, asserted against, imposed upon or incurred by such party by reason of or resulting from any breach or inaccuracy of any representation, warranty or covenant of either party set forth in this Agreement and/or any breach of any provisions of this Agreement by the Borrower. The indemnification rights of each party under this clause are independent of, and in addition to, such rights and remedies that Lender may have at law or in equity or otherwise, including the right to seek specific performance, rescission, restitution or other injunctive relief, none of which rights or remedies shall be affected or diminished thereby.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          12. GRIEVANCE REDRESSAL
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          The Lender has established an adequate grievance redressal policy to address any complaints or grievances from the Borrower with relation to the credit facility, which the Borrower may refer to on the Lender's website.
        </p>

        <div style={{ pageBreakBefore: 'always' }} />

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          13. GOVERNING LAW
        </h2>
        <ol type="i" style={{ textAlign: 'justify', paddingLeft: '40px' }}>
          <li className="mb-2">Any dispute, difference, or claim arising out of or relating to this Agreement shall be referred to and resolved through arbitration by a sole arbitrator, appointed and nominated by the Lender. The arbitration proceedings shall be governed by the Arbitration and Conciliation Act, 1996, along with any amendments thereto. The venue for arbitration shall be {agreementData.company.jurisdiction || 'Bangalore'}, and the language of the proceedings shall be English.</li>
          <li className="mb-2">The award rendered by the arbitrator shall be final and binding on both parties. In the event of the death or incapacity of the initially appointed arbitrator, the Lender shall appoint a replacement, who will be entitled to continue the arbitration from the point where the previous arbitrator left off.</li>
          <li className="mb-2">This Agreement shall be subject to the exclusive jurisdiction of the courts in {agreementData.company.jurisdiction || 'Bangalore'}.</li>
        </ol>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          14. DATA AND PRIVACY
        </h2>
        <ol type="a" style={{ textAlign: 'justify', paddingLeft: '40px', listStyleType: 'lower-alpha' }}>
          <li className="mb-2">The Borrower's information will be collected and used only in accordance with the terms of this Agreement, the privacy policy on the Lender (for information usage), and applicable laws.</li>
          <li className="mb-2">All loan documents, agreements, sanction letters, and KFS statements shall be digitally stored and maintained by the Lender for record-keeping and future reference.</li>
          <li className="mb-2">The Lender may share the Borrower's loan information, including credit history and defaults, with its affiliates, the Reserve Bank of India (RBI), and other organizations deemed appropriate by the Lender, including for purposes such as fraud checks, performance data submission to bureaus, and self-regulatory organizations;</li>
          <li className="mb-2">The Lender may request credit reports, loan history, and other relevant information about the Borrower from credit bureaus, statutory bodies, tax authorities, the Central Information Bureau, research merchants, or any other organizations the Lender deems necessary;</li>
          <li className="mb-2">The Lender may share and disclose the Borrower's information with credit bureaus, lending service providers, and third-party service providers for purposes related to this Agreement and in accordance with applicable laws;</li>
          <li className="mb-2">The Borrower shall not hold the Lender liable for the use of this information or for conducting any background checks and verifications;</li>
          <li className="mb-2">The Borrower grants the Lender consent to collect, store, process and utilise information and data about the Borrower as outlined in the Privacy Policy and Terms and Conditions of the Lender.</li>
        </ol>

        <div style={{ pageBreakBefore: 'always' }} />

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          15. ASSIGNMENT
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          Lender may assign or delegate any or all of its rights, powers, and functions under this Agreement to one or more third parties. The Borrower hereby provides their unqualified consent to such assignment or delegation.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          16. NOTICE
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          Any notice or other communication to be given by one Party to any other Party under, or in connection with, this Agreement shall be made in writing and signed by or on behalf of the Party giving it. It shall be served by letter or facsimile transmission (save as otherwise provided herein) and shall be deemed to be duly given or made when delivered (in the case of personal delivery), at the time of transmission (in the case of facsimile transmission, provided that the sender has received a receipt indicating proper transmission and a hard copy of such notice or communication is forthwith sent by prepaid post to the relevant address set out below) or five days after being dispatched in the post, postage prepaid, by the most efficient form of mail available and by registered mail if available (in the case of a letter) to such party at its address or facsimile number specified below, or at such other address or facsimile number as such Party may hereafter specify for such purpose to the other Parties hereto by notice in writing. The Parties understand that some confidential information may be transmitted over electronic mail and there are risks associated with the use of electronic mail, which can include the risk of interception, breach of confidentiality, alteration, loss or a delay in transmission, and that information sent by this means may be susceptible to forgery or distortion and agree to accept the risks of distribution by electronic mail.
        </p>
        <p className="font-bold" style={{ marginBottom: '10px' }}>
          Lender designated Mail id: {agreementData.company.email}
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          17. VARIATION
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          No variation of this Agreement shall be binding on any Party unless, and to the extent that such variation is recorded in a written document executed by such Party, but where any such document exists and is so signed such Party shall not allege that such document is not binding by virtue of an absence of consideration.
        </p>

        <div style={{ pageBreakBefore: 'always' }} />

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          18. FORCE MAJEURE
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          Any circumstance beyond the reasonable control of a Party, such as natural disasters, acts of war, strikes, pandemics, or governmental actions, which impedes a Party's ability to fulfill its obligations. The affected Party must notify the other within ten business days and may suspend its performance for the duration of the event. Obligation deadlines will extend accordingly. If the disruption persists beyond thirty days, either Party may terminate the Agreement without liability. Notably, under no circumstances the Pledgor's obligation to make payments shall be suspended during a Force Majeure Event.
        </p>

        <h2 className="font-bold mt-5 mb-3" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          19. ENTIRE AGREEMENT
        </h2>
        <p style={{ textAlign: 'justify', marginBottom: '10px' }}>
          Agreement, Privacy Policy and Terms and Conditions of Lender (including Borrower's consent for use of information) shall constitute the entire Agreement between the parties.
        </p>

        {/* Signatures */}
        <div className="mt-12">
          <p className="font-bold mb-8">For and on behalf of Lender ({agreementData.company.name})</p>
          <div style={{ width: '200px', height: '50px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', marginBottom: '10px' }}>
            Digital Signature
          </div>
          <p style={{ marginBottom: '30px' }}>Reason: Loan Agreement</p>

          <p className="font-bold mb-8">I HAVE ACCEPTED THE LOAN AGREEMENT WITH THE TERMS AND CONDITIONS THEREIN</p>
          <div style={{ width: '200px', height: '50px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', marginBottom: '10px' }}>
            Borrower Signature
          </div>
        </div>

        <div style={{ pageBreakBefore: 'always' }} />

        <h2 className="font-bold mb-4" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          ANNEXURE I (Borrower Details)
        </h2>
        <table className="w-full border-collapse" style={{ border: '1px solid #000' }}>
          <thead>
            <tr>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '10%' }}>Sl. No.</th>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '40%' }}>Borrower Information</th>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '50%' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">1.</td>
              <td className="border border-black p-2">Name</td>
              <td className="border border-black p-2">{agreementData.borrower.name}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">2.</td>
              <td className="border border-black p-2">Aadhar number</td>
              <td className="border border-black p-2">{maskAadhar(agreementData.borrower.aadhar || agreementData.borrower.aadhar_number || 'N/A')}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">3.</td>
              <td className="border border-black p-2">Address</td>
              <td className="border border-black p-2">{formatAddress(agreementData.borrower.address)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">4.</td>
              <td className="border border-black p-2">Phone Number</td>
              <td className="border border-black p-2">{agreementData.borrower.phone}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">5.</td>
              <td className="border border-black p-2">Email ID</td>
              <td className="border border-black p-2">{agreementData.borrower.email}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">6.</td>
              <td className="border border-black p-2">Bank Name & IFSC</td>
              <td className="border border-black p-2">{agreementData.bank_details?.bank_name || 'N/A'} / {agreementData.bank_details?.ifsc_code || 'N/A'}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">7.</td>
              <td className="border border-black p-2">Bank Account Number</td>
              <td className="border border-black p-2">{agreementData.bank_details?.account_number || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-bold mt-8 mb-4" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          ANNEXURE II – Loan Facility Summary
        </h2>

        {/* Loan Summary Table */}
        <table className="w-full border-collapse mb-4" style={{ border: '1px solid #000' }}>
          <thead>
            <tr>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '5%' }}>Sr.</th>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '55%' }}>Particulars</th>
              <th className="border border-black p-2 bg-gray-100 font-bold" style={{ width: '40%' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">1</td>
              <td className="border border-black p-2">Sanctioned Loan Amount</td>
              <td className="border border-black p-2">{formatCurrency(agreementData.loan.sanctioned_amount)}</td>
            </tr>
            {/* Dynamic Fees - Deducted from Disbursal */}
            {agreementData.fees?.fees_breakdown && agreementData.fees.fees_breakdown
              .filter((fee: any) => fee.application_method === 'deduct_from_disbursal')
              .map((fee: any, index: number) => (
                <tr key={`deduct-${index}`}>
                  <td className="border border-black p-2">{index + 2}</td>
                  <td className="border border-black p-2">{fee.fee_name || 'Processing Fee'}</td>
                  <td className="border border-black p-2">-{formatCurrency(parseFloat(fee.amount || 0))}</td>
                </tr>
              ))}
            {/* GST on deducted fees */}
            {agreementData.fees?.gst > 0 && (
              <tr>
                <td className="border border-black p-2">
                  {agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'deduct_from_disbursal').length + 2 || 2}
                </td>
                <td className="border border-black p-2">GST on Fees (18%)</td>
                <td className="border border-black p-2">-{formatCurrency(agreementData.fees.gst)}</td>
              </tr>
            )}
            {/* Fallback to legacy processing fee if no dynamic fees */}
            {(!agreementData.fees?.fees_breakdown || agreementData.fees.fees_breakdown.length === 0) && (
              <>
                <tr>
                  <td className="border border-black p-2">2</td>
                  <td className="border border-black p-2">Processing Fee</td>
                  <td className="border border-black p-2">-{formatCurrency(agreementData.fees.processing_fee)}</td>
                </tr>
                {agreementData.fees?.gst > 0 && (
                  <tr>
                    <td className="border border-black p-2">3</td>
                    <td className="border border-black p-2">GST on Processing Fee (18%)</td>
                    <td className="border border-black p-2">-{formatCurrency(agreementData.fees.gst)}</td>
                  </tr>
                )}
              </>
            )}
            <tr className="font-bold">
              <td className="border border-black p-2">
                {(() => {
                  const deductFees = agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'deduct_from_disbursal').length || 0;
                  return deductFees + (agreementData.fees?.gst > 0 ? 2 : 1) + 1;
                })()}
              </td>
              <td className="border border-black p-2">Net Disbursal Amount</td>
              <td className="border border-black p-2">{formatCurrency(agreementData.calculations.disbursed_amount || agreementData.loan.disbursal_amount || (agreementData.loan.sanctioned_amount - agreementData.fees.processing_fee - agreementData.fees.gst))}</td>
            </tr>
            {/* Dynamic Fees - Added to Total */}
            {agreementData.fees?.fees_breakdown && agreementData.fees.fees_breakdown
              .filter((fee: any) => fee.application_method === 'add_to_total')
              .map((fee: any, index: number) => (
                <tr key={`add-${index}`}>
                  <td className="border border-black p-2">
                    {(() => {
                      const deductFees = agreementData.fees.fees_breakdown.filter((f: any) => f.application_method === 'deduct_from_disbursal').length || 0;
                      return deductFees + (agreementData.fees?.gst > 0 ? 2 : 1) + index + 2;
                    })()}
                  </td>
                  <td className="border border-black p-2">{fee.fee_name || 'Service Fee'} (payable at repayment)</td>
                  <td className="border border-black p-2">+{formatCurrency(parseFloat(fee.amount || 0))}</td>
                </tr>
              ))}
            <tr>
              <td className="border border-black p-2">
                {(() => {
                  const deductFees = agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'deduct_from_disbursal').length || 0;
                  const addFees = agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'add_to_total').length || 0;
                  return deductFees + addFees + (agreementData.fees?.gst > 0 ? 2 : 1) + 2;
                })()}
              </td>
              <td className="border border-black p-2">Interest ({((agreementData.interest.rate_per_day || 0) * 100).toFixed(2)}% per day for {agreementData.loan.loan_term_days} days)</td>
              <td className="border border-black p-2">+{formatCurrency(agreementData.calculations.interest)}</td>
            </tr>
            <tr className="font-bold bg-gray-50">
              <td className="border border-black p-2">
                {(() => {
                  const deductFees = agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'deduct_from_disbursal').length || 0;
                  const addFees = agreementData.fees?.fees_breakdown?.filter((f: any) => f.application_method === 'add_to_total').length || 0;
                  return deductFees + addFees + (agreementData.fees?.gst > 0 ? 2 : 1) + 3;
                })()}
              </td>
              <td className="border border-black p-2">Total Amount Repayable</td>
              <td className="border border-black p-2">{formatCurrency(agreementData.calculations.total_amount || agreementData.calculations.total_repayable || (agreementData.loan.sanctioned_amount + agreementData.calculations.interest))}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-bold mt-6 mb-4" style={{ fontSize: '9pt', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
          ANNEXURE III – Key Facts Statement (KFS)
        </h2>
        <p style={{ textAlign: 'justify' }}>
          Please refer to the attached Key Facts Statement (KFS) document for complete details of the loan facility including interest rates, fees, charges, repayment schedule, and other terms and conditions.
        </p>

      </div>
    </div>
  );
}

