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
}

interface SharedLoanAgreementDocumentProps {
    agreementData: LoanAgreementData;
}

export function SharedLoanAgreementDocument({ agreementData }: SharedLoanAgreementDocumentProps) {
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
        const parts = [address.line1, address.line2, address.city, address.state, address.pincode, address.country].filter(Boolean);
        return parts.join(', ') || 'N/A';
    };

    const maskAadhar = (aadhar: string) => {
        if (!aadhar || aadhar === 'N/A') return 'N/A';
        return 'XXXXXXXX' + aadhar.slice(-4);
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
                    <strong>{agreementData.company.name.toUpperCase()}</strong>, a company incorporated under the Companies Act, 1956, having its registered office at {agreementData.company.registered_office || agreementData.company.address} (hereinafter referred to as the "<strong>Company</strong>", which term shall include its successors-in-interest and permitted assigns),<br />
                    <strong>OF THE SECOND PART</strong>
                </p>

                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>WHEREAS</h2>
                <ol className="list-decimal ml-8 mb-6 text-justify">
                    <li className="mb-2">The Borrower has requested a loan for the purpose specified in the Loan Application Form and has submitted certain documents, declarations and representations. Relying upon these submissions, the Company has agreed to sanction a loan up to the maximum amount mentioned in Schedule (1), subject to the terms contained herein and in other loan documents.</li>
                    <li className="mb-2">In consideration of the Company agreeing to extend the Loan, the Borrower agrees to comply with the terms and conditions set forth in this Agreement.</li>
                </ol>

                <p className="font-bold mb-4">NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:</p>

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Section 1: Definitions */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>1. DEFINITIONS</h2>
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

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Section 2: Interpretation */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>2. INTERPRETATION</h2>
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
                    <li className="mb-2">The Company may: withhold or cancel disbursement upon breach, recall the Loan by giving notice, accept partial payments and adjust them in the order: overdue → charges → interest → principal, consider settlement at its discretion.</li>
                    <li className="mb-2">The Company adheres to fair-practice standards, ensures transparency, prohibits harassment, and maintains proper grievance redressal.</li>
                    <li className="mb-2">The Borrower consents to the Company's collection, storage, and use of personal data in accordance with Privacy Policy and applicable law.</li>
                    <li className="mb-2">The Company may disclose Borrower information to credit bureaus, authorities, service providers, or agencies as permitted by law.</li>
                </ol>

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Section 4: Representations & Warranties */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>4. REPRESENTATIONS & WARRANTIES</h2>
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
                    <li className="mb-2">Will use the Loan only for the permitted purpose and not for: illegal activities, speculative or stock-market activities, money lending, securities investment, or any unrelated or prohibited purpose.</li>
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

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Section 6: Term & Termination */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>6. TERM & TERMINATION</h2>
                <p className="mb-2">This Agreement takes effect from the date the Borrower signs it and continues until all Loan-related obligations are fully discharged.</p>
                <p className="mb-4">Upon full repayment, the Company shall issue a No Dues Certificate if no other amounts are outstanding.</p>

                {/* Section 7: General Provisions */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>7. GENERAL PROVISIONS</h2>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2"><strong>No Waiver:</strong> Failure to exercise any right does not constitute waiver.</li>
                    <li className="mb-2"><strong>Notices:</strong> All notices shall be sent to the addresses recorded in Company's system.</li>
                    <li className="mb-2"><strong>Assignment:</strong> The Company may assign/transfer its rights without Borrower's consent. Borrower may not assign.</li>
                    <li className="mb-2"><strong>Severability:</strong> If any provision is invalid, others remain enforceable.</li>
                    <li className="mb-2"><strong>Entire Agreement:</strong> This Agreement supersedes all prior discussions.</li>
                    <li className="mb-2"><strong>Amendments:</strong> The Company may amend this Agreement after providing reasonable notice.</li>
                    <li className="mb-2"><strong>Governing Law:</strong> This Agreement is governed by the laws of India. Jurisdiction: {agreementData.company.jurisdiction || 'India'}.</li>
                    <li className="mb-2"><strong>Arbitration:</strong> Disputes shall be referred to a sole arbitrator appointed by the Company in accordance with the Arbitration and Conciliation Act, 1996. Arbitration venue: {agreementData.company.jurisdiction || 'India'}.</li>
                </ol>

                {/* Section 8: Loan Purpose */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>8. LOAN PURPOSE</h2>
                <p className="mb-4">The Loan shall be utilized only for the purpose specified in the Loan Application Form. Diversion of funds constitutes an Event of Default.</p>

                {/* Section 9: Collections & Recovery */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>9. COLLECTIONS & RECOVERY</h2>
                <p className="mb-2">For collecting overdue amounts, the Company may:</p>
                <ul className="list-disc ml-8 mb-4">
                    <li>Engage authorized recovery agents or lending service providers (LSPs).</li>
                    <li>Send reminders via SMS, email, calls, or WhatsApp.</li>
                    <li>Initiate legal proceedings if necessary.</li>
                    <li>Report defaults to credit bureaus.</li>
                </ul>
                <p className="mb-4">The Company ensures fair recovery practices and prohibits harassment.</p>

                {/* Section 10: Insurance */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>10. INSURANCE</h2>
                <p className="mb-4">The Company may offer or require insurance on the Loan. Premiums, if any, will be disclosed upfront.</p>

                {/* Section 11: Digital Loan Specific Terms */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>11. DIGITAL LOAN SPECIFIC TERMS</h2>
                <ol className="list-decimal ml-8 mb-4 text-justify">
                    <li className="mb-2"><strong>Cooling-Off Period:</strong> The Borrower may prepay the Loan within 3 days from disbursement without any foreclosure charges.</li>
                    <li className="mb-2"><strong>Electronic Communications:</strong> The Borrower consents to receive communications via email, SMS, app notifications, and WhatsApp.</li>
                    <li className="mb-2"><strong>Digital Signature:</strong> The Borrower's electronic/Aadhaar-based signature is binding.</li>
                    <li className="mb-2"><strong>Platform Terms:</strong> The Borrower agrees to the Company's app/website terms and conditions.</li>
                    <li className="mb-2"><strong>Third-Party Services:</strong> The Company may use LSPs, DLAs, or other service providers for processing or servicing.</li>
                </ol>

                {/* Section 12: Grievance Redressal */}
                <h2 className="font-bold mt-6 mb-3" style={{ fontSize: '12pt' }}>12. GRIEVANCE REDRESSAL</h2>
                <p className="mb-2">For any complaint or grievance, the Borrower may contact:</p>
                <p className="mb-2"><strong>Nodal Officer:</strong> {agreementData.grievance.nodal_officer?.name || 'N/A'}</p>
                <p className="mb-2"><strong>Email:</strong> {agreementData.grievance.nodal_officer?.email || 'N/A'}</p>
                <p className="mb-4"><strong>Phone:</strong> {agreementData.grievance.nodal_officer?.phone || 'N/A'}</p>
                <p className="mb-4">If unresolved within 30 days, the Borrower may escalate to the Reserve Bank of India's Ombudsman Scheme.</p>

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Borrower Details Table */}
                <h2 className="font-bold mt-6 mb-4" style={{ fontSize: '12pt', textAlign: 'center' }}>
                    BORROWER DETAILS
                </h2>

                <table className="w-full border-collapse text-xs mb-6" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '30%' }}><strong>Name</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.name}</td>
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
                            <td className="border border-black p-2">{agreementData.borrower.phone}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"><strong>Email ID</strong></td>
                            <td className="border border-black p-2">{agreementData.borrower.email}</td>
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

                <div style={{ pageBreakBefore: 'always' }} />

                {/* Schedule (1): Key Facts Statement */}
                <h2 className="font-bold mt-6 mb-4" style={{ fontSize: '12pt', textAlign: 'center' }}>
                    SCHEDULE (1): KEY FACTS STATEMENT (KFS)
                </h2>

                {/* Include the full KFS document */}
                <div className="kfs-embedded">
                    <SharedKFSDocument kfsData={agreementData} />
                </div>

            </div>
        </div>
    );
}
