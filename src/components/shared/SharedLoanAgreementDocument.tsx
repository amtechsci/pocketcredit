/**
 * SharedLoanAgreementDocument - Pure Loan Agreement rendering component
 * Used by both admin and user interfaces
 * Includes embedded KFS at the end
 */

import { SharedKFSDocument } from './SharedKFSDocument';

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
    additional: any;
    generated_at: string;
    signature?: {
        signed_at?: string;
        ip?: string;
        signers_info?: Array<{
            fname?: string;
            lname?: string;
            status?: string;
            otp?: string;
            otpValue?: string;
            ip?: string;
        }>;
    };
}

interface SharedLoanAgreementDocumentProps {
    agreementData: LoanAgreementData;
}

export function SharedLoanAgreementDocument({ agreementData }: SharedLoanAgreementDocumentProps) {
    const formatAddress = (address: any) => {
        if (typeof address === 'string') return address;
        if (!address) return 'N/A';
        const parts = [address.line1, address.line2, address.city, address.state, address.pincode, address.country].filter(Boolean);
        return parts.join(', ') || 'N/A';
    };

    const maskAadhar = (aadhar: string) => {
        if (!aadhar || aadhar === 'N/A') return 'N/A';
        return 'XXXXXXXX' + aadhar.slice(-4);
    };

    const formatDate = (dateString: string) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return dateString;
        }
    };

    return (
        <div className="bg-white" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '10pt', lineHeight: '1.6' }}>
            <div className="p-8">
                {/* Company Header */}
                <div className="text-center mb-4" style={{ borderBottom: '1px solid #000', paddingBottom: '8px' }}>
                    <h2 className="font-bold mb-1" style={{ fontSize: '12pt' }}>
                        SPHEETI FINTECH PRIVATE LIMITED
                    </h2>
                    <p className="text-xs mb-1">
                        CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361
                    </p>
                    <p className="text-xs mb-2">
                        Address: Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001
                    </p>
                </div>

                {/* Header */}
                <h1 className="text-center font-bold mb-6" style={{ fontSize: '14pt' }}>
                    LOAN AGREEMENT
                </h1>

                <p className="text-justify mb-4">
                    This Loan Agreement is executed at the place and on the date stated in this Agreement, between:
                </p>

                <p className="text-justify mb-4">
                    The Borrower, being the undersigned applicant whose details appear in the Loan Application Form (hereinafter referred to as the "<strong>Borrower</strong>"),<br />
                    <strong>OF THE FIRST PART</strong>
                </p>

                <p className="text-center font-bold my-4">AND</p>

                <p className="text-justify mb-4">
                    <strong>SPHEETI FINTECH PRIVATE LIMITED</strong>, a company incorporated under the Companies Act, 1956, having its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar, Mumbai, Maharashtra – 421001 (hereinafter referred to as the "<strong>Company</strong>", which term shall include its successors-in-interest and permitted assigns),<br />
                    <strong>OF THE SECOND PART</strong>
                </p>

                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>WHEREAS</h2>
                <ol className="list-decimal ml-8 mb-6 text-justify">
                    <li className="mb-2">The Borrower has requested a loan for the purpose specified in the Loan Application Form and has submitted certain documents, declarations and representations. Relying upon these submissions, the Company has agreed to sanction a loan up to the maximum amount mentioned in Schedule (1), subject to the terms contained herein and in other loan documents.</li>
                    <li className="mb-2">In consideration of the Company agreeing to extend the Loan, the Borrower agrees to comply with the terms and conditions set forth in this Agreement.</li>
                </ol>

                <p className="font-bold mb-4">NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:</p>

                {/* Section 1: Definitions */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>1. DEFINITIONS</h2>
                <p className="mb-3">For the purposes of this Agreement:</p>

                <p className="mb-2"><strong>Applicable Law</strong> refers to any statute, rule, regulation, order, judgement, directive, guideline, policy, or governmental requirement issued by any competent authority, whether currently in force or enacted in the future.</p>

                <p className="mb-2"><strong>Loan Application Form (LAF)</strong> means the Borrower's loan application and all accompanying documents, declarations, information, clarifications or undertakings submitted to the Company.</p>

                <p className="mb-2"><strong>Due Date</strong> refers to the specific date(s) on which the Borrower must pay any amount due under this Agreement, including principal, interest, charges, and other obligations.</p>

                <p className="mb-2"><strong>Effective Date</strong> means the date on which the Borrower receives the first disbursement of the sanctioned Loan.</p>

                <p className="mb-2"><strong>eNACH / E-Mandate</strong> refers to automated recurring payment facilities introduced by the RBI and NPCI.</p>

                <p className="mb-2"><strong>Equated Monthly Instalment (EMI)</strong> means the fixed monthly payment comprising principal and interest payable over the loan tenure. EMI may be revised by the Company in case of changes in interest rate.</p>

                <p className="mb-2"><strong>Event of Default</strong> means any act, omission or occurrence defined as a default under this Agreement.</p>

                <p className="mb-2"><strong>Interest</strong> refers to the interest chargeable at the rate mentioned in Schedule (1).</p>

                <p className="mb-2"><strong>Loan</strong> means the financial assistance sanctioned by the Company as specified in Schedule (1).</p>

                <p className="mb-2"><strong>Loan Account</strong> means the account maintained by the Company recording all amounts payable by the Borrower.</p>

                <p className="mb-2"><strong>Upfront Charges / EMI Charges</strong> refer to non-refundable processing charges payable at disbursement or during the repayment tenure.</p>

                <p className="mb-4"><strong>Settlement</strong> means a mutually agreed arrangement for closing the Borrower's outstanding dues representing partial or full waiver at the discretion of the Company.</p>

                {/* Section 2: Interpretation */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>2. INTERPRETATION</h2>
                <p className="mb-2">Unless the context requires otherwise:</p>
                <ul className="list-disc ml-8 mb-4">
                    <li>Expressions not defined herein shall have the meaning assigned under the General Clauses Act, 1897.</li>
                    <li>Words such as "herein", "hereunder" or similar terms refer to this Agreement as a whole.</li>
                    <li>"Including" shall always mean "including but not limited to".</li>
                    <li>References to agreements shall include amendments permitted under this Agreement.</li>
                    <li>The Borrower confirms that all information provided in the Loan Application Form is true and complete, and that the documents submitted are genuine. The Company has relied upon such representations in entering this Agreement.</li>
                </ul>

                {/* Section 3: Terms & Conditions */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>3. TERMS & CONDITIONS</h2>
                <p className="mb-3">If the Company approves the Loan as per Schedule (1), the following terms shall apply:</p>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2">Based on the Borrower's representations, the Company agrees to sanction a Loan up to the amount stated in Schedule (1).</li>
                    <li className="mb-2">After submitting the Loan Application Form, the Borrower may request cancellation within 24 hours prior to disbursement.</li>
                    <li className="mb-2">The Company will disburse the Loan (full or partial) from its designated bank account to the Borrower's bank account.</li>
                    <li className="mb-2">The Borrower understands that interest is calculated on a daily principal balance and agrees to the EMI computation and annualised interest rate.</li>
                    <li className="mb-2">The Borrower acknowledges that interest rates are fair and based on multiple risk factors.</li>
                    <li className="mb-2">The Borrower agrees to pay EMI and all applicable charges as per the repayment schedule.</li>
                    <li className="mb-2">EMI may be paid through eNACH/E-Mandate. Borrower must ensure adequate balance and honour all payment mandates.</li>
                    <li className="mb-2">Revocation of eNACH/E-Mandate without prior Company approval constitutes an Event of Default.</li>
                    <li className="mb-2">The Borrower must pay interest and charges as per Schedule (1).</li>
                    <li className="mb-2">Any dispute regarding interest or EMI computation shall not permit the Borrower to withhold payment.</li>
                    <li className="mb-2">Delay in repayment will attract overdue charges as per Schedule (1).</li>
                    <li className="mb-2">Foreclosure is permitted subject to Company rules; upfront processing fee is non-refundable.</li>
                    <li className="mb-2">The Company may:
                        <ul className="list-disc ml-6 mt-1">
                            <li>withhold or cancel disbursement upon breach,</li>
                            <li>recall the Loan by giving notice,</li>
                            <li>accept partial payments and adjust them in the order: overdue → charges → interest → principal,</li>
                            <li>consider settlement at its discretion.</li>
                        </ul>
                    </li>
                    <li className="mb-2">The Company adheres to fair-practice standards, ensures transparency, prohibits harassment, and maintains proper grievance redressal.</li>
                    <li className="mb-2">The Borrower consents to the Company's collection, storage, and use of personal data in accordance with Privacy Policy and applicable law.</li>
                    <li className="mb-2">The Company may disclose Borrower information to credit bureaus, authorities, service providers, or agencies as permitted by law.</li>
                </ol>

                {/* Section 4: Representations & Warranties */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>4. REPRESENTATIONS & WARRANTIES</h2>
                <p className="mb-3">The Borrower represents and confirms that he/she:</p>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2">Fully understands this Agreement and is legally and financially capable of complying with it.</li>
                    <li className="mb-2">Is legally competent to execute this Agreement.</li>
                    <li className="mb-2">Has an annual household income exceeding ₹3,00,000.</li>
                    <li className="mb-2">Has provided accurate and truthful information.</li>
                    <li className="mb-2">Has read and understood the Agreement, Terms & Conditions and Privacy Policy.</li>
                    <li className="mb-2">Confirms that borrowing the Loan does not violate any laws or contractual obligations.</li>
                    <li className="mb-2">Will promptly notify the Company of any change in information.</li>
                    <li className="mb-2">Understands that the Company may conduct audits where necessary.</li>
                    <li className="mb-2">Will use the Loan only for the permitted purpose and not for:
                        <ul className="list-none ml-6 mt-1">
                            <li>o illegal activities</li>
                            <li>o speculative or stock-market activities</li>
                            <li>o money lending</li>
                            <li>o securities investment</li>
                            <li>o any unrelated or prohibited purpose</li>
                        </ul>
                    </li>
                    <li className="mb-2">Will repay only through approved payment modes.</li>
                    <li className="mb-2">Will comply with all Company rules and platform terms.</li>
                    <li className="mb-2">Has reviewed the Company's website and is aware of the policies.</li>
                </ol>

                {/* Section 5: Event of Default */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>5. EVENT OF DEFAULT</h2>
                <p className="mb-3">An Event of Default occurs if:</p>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2">The Borrower breaches any term of this Agreement.</li>
                    <li className="mb-2">The Borrower fails to adhere to the repayment schedule.</li>
                    <li className="mb-2">Any information or representation provided is found to be false or incomplete.</li>
                    <li className="mb-2">The Borrower faces insolvency, is declared insane, convicted of an offence, or experiences any situation that impairs repayment ability.</li>
                    <li className="mb-2">The Borrower withdraws eNACH/E-Mandate without Company approval.</li>
                </ol>

                <p className="mb-2">Upon an Event of Default, the Company may:</p>
                <ul className="list-disc ml-8 mb-2">
                    <li>terminate this Agreement; and/or</li>
                    <li>declare all outstanding amounts immediately due.</li>
                </ul>

                <p className="mb-2">If payment is not made within 7 days, the Company may:</p>
                <ul className="list-disc ml-8 mb-4">
                    <li>levy liquidated damages equal to unpaid dues; and/or</li>
                    <li>exercise other legal remedies after giving notice.</li>
                </ul>

                {/* Section 6: Term & Termination */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>6. TERM & TERMINATION</h2>
                <p className="mb-4">This Agreement remains valid from the disbursement date until full repayment, unless terminated earlier under an Event of Default or foreclosure.</p>

                {/* Section 7: Privacy */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>7. PRIVACY</h2>
                <p className="mb-2">Borrower information will be collected and used strictly as per this Agreement, the Privacy Policy and applicable laws. The Borrower agrees that:</p>
                <ul className="list-disc ml-8 mb-4">
                    <li className="mb-2">The Company may share loan-related information with regulators, service providers, credit bureaus, fraud-control agencies, or other authorised entities.</li>
                    <li className="mb-2">The Company may obtain credit reports or other data from authorised organisations.</li>
                    <li className="mb-2">The Company may appoint recovery agents and share necessary information with them.</li>
                    <li className="mb-2">The Borrower shall not hold the Company liable for lawful use of information.</li>
                </ul>

                {/* Section 8: General Provisions */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>8. GENERAL PROVISIONS</h2>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2">The Borrower shall indemnify the Company against losses arising from breach of this Agreement.</li>
                    <li className="mb-2">Courts in Mumbai, Maharashtra shall have exclusive jurisdiction.</li>
                    <li className="mb-2">Complaints will be handled as per the Company's grievance redressal mechanism.</li>
                    <li className="mb-2">The Company may assign its rights under this Agreement.</li>
                    <li className="mb-2">Any amendment shall be communicated to the Borrower.</li>
                    <li className="mb-2">Any invalid provision shall not affect the remainder of this Agreement.</li>
                    <li className="mb-2">The Borrower acknowledges availability of a vernacular version on request.</li>
                    <li className="mb-2">Communication shall be made to the addresses provided in the LAF or platform.</li>
                    <li className="mb-2">This Agreement, the Application Form and platform terms constitute the entire agreement.</li>
                </ol>

                {/* Loan Agreement Declaration */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>Loan Agreement Declaration</h2>
                <p className="mb-2">I hereby consent to the terms of this Loan Agreement. I understand that the Agreement becomes enforceable only upon approval of my Loan Application.</p>
                <p className="mb-2">I further acknowledge that upon approval, the Loan Application submitted via the Platform together with this consent shall constitute a binding contract, without the need for any further execution.</p>
                <p className="mb-4">I understand that the Company follows risk-based pricing based on financial and credit parameters.</p>

                {/* Schedule (1): Key Facts Statement */}
                <h2 className="font-bold mt-6 mb-4 force-page-break" style={{ fontSize: '12pt', textAlign: 'center' }}>
                    SCHEDULE (1): KEY FACT STATEMENT (KFS)
                </h2>

                {/* Include the full KFS document */}
                <div className="kfs-embedded">
                    <SharedKFSDocument kfsData={agreementData} />
                </div>

                {/* Loan Application Form (borrower details) */}
                <h2 className="font-bold mt-6 mb-4 force-page-break" style={{ fontSize: '12pt', textAlign: 'center' }}>
                    Loan Application Form (borrower details)
                </h2>

                <table className="w-full border-collapse text-xs mb-6" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '30%' }}><strong>Name</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.name || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>PAN Number</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.pan || agreementData.borrower.pan_number || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Aadhar Number</strong></td>
                            <td className="border border-black p-2">{maskAadhar(agreementData.borrower.aadhar || agreementData.borrower.aadhar_number || 'N/A')}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Address</strong></td>
                            <td className="border border-black p-2">{formatAddress(agreementData.borrower.address)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Phone Number</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.phone || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Email ID</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.email || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Bank Name & IFSC</strong></td>
                            <td className="border border-black p-2">{agreementData.bank_details?.bank_name || 'N/A'} / {agreementData.bank_details?.ifsc_code || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Bank Account Number</strong></td>
                            <td className="border border-black p-2">{agreementData.bank_details?.account_number || 'N/A'}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Applicant's Undertaking */}
                <h2 className="font-bold mt-6 mb-3 force-page-break" style={{ fontSize: '12pt' }}>APPLICANT'S UNDERTAKING</h2>
                <p className="mb-3">The Applicant hereby agrees, declares and confirms that:</p>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2">He/She understands that submitting the Loan Application Form (LAF) does not guarantee that the Company will sanction the Loan.</li>
                    <li className="mb-2">The Company will evaluate the application on its merits and may approve or reject the Loan at its sole and absolute discretion.</li>
                    <li className="mb-2">The Loan amount, if sanctioned, shall be utilized strictly for lawful and legitimate purposes only.</li>
                    <li className="mb-2">The bank account details provided in the LAF belong exclusively to the Applicant.</li>
                    <li className="mb-2">All information furnished in the LAF is true, complete and accurate. The Applicant shall immediately notify the Company of any changes to the information provided.</li>
                    <li className="mb-2">The Applicant has fully understood every term of the Loan and confirms that he/she is financially and legally eligible to avail the Loan. The Loan amount shall be credited only to the bank account specified by the Applicant.</li>
                    <li className="mb-2">The Company shall be entitled to share the Applicant's loan-related information, including credit history, repayment status and defaults, with the Reserve Bank of India, Banks, Financial Institutions, Credit Bureaus, Statutory Authorities, Tax Authorities, Central Information Bureau, Research Agencies and any other entities as the Company considers appropriate. The Applicant shall not hold the Company liable for any use of such information.</li>
                    <li className="mb-2">The Applicant shall remain solely, absolutely and unconditionally responsible for repayment of all Outstanding Dues at all times, and shall make timely payments regardless of any reminders, notices or communications issued by Spheeti Fintech Pvt. Ltd or its Service Provider.</li>
                    <li className="mb-2">The Applicant shall not, under any circumstances, withhold or delay payment of any amount due to Spheeti Fintech Pvt. Ltd under these Terms & Conditions. The Applicant also consents to receive updates, messages or any other communications from Spheeti Fintech Pvt. Ltd or the Service Provider on the registered mobile number and email address.</li>
                    <li className="mb-2">The Applicant shall not assign, sell, transfer or otherwise convey any of his/her rights or obligations under these Terms & Conditions to any third party without prior written approval of Spheeti Fintech Pvt. Ltd or the Service Provider.</li>
                    <li className="mb-2">The Company reserves the right to reject the LAF and retain the form along with the Applicant's photograph.</li>
                    <li className="mb-2">The Applicant confirms that he/she has not taken any credit facility from any lender other than those specifically disclosed in the LAF.</li>
                    <li className="mb-2">The Applicant shall submit any additional documents and undertake any acts or formalities that the Company may require in connection with this LAF.</li>
                    <li className="mb-2">The Applicant shall comply with all applicable laws, including anti-money laundering and anti-terrorism financing laws, with respect to the end use of the Loan.</li>
                </ol>

                <p className="mb-4 font-bold">I HEREBY CONFIRM THAT I HAVE READ AND UNDERSTOOD ALL PROVISIONS OF THE LAF, INCLUDING THE DECLARATIONS, TERMS & CONDITIONS, AND UNDERTAKINGS PROVIDED HEREIN, AND I AGREE TO BE BOUND BY THEM.</p>

            </div>
        </div>
    );
}
