/**
 * SharedExtensionLetterDocument - Pure Loan Tenure Extension Letter rendering component
 * Used by both admin and user interfaces
 * Design matches the official extension letter format
 */

interface ExtensionLetterData {
    company: any;
    loan: any;
    borrower: any;
    extension: {
        extension_number: number; // 1st, 2nd, 3rd, 4th
        extension_availed_date: string;
        extension_period_till: string;
        extension_fee: number;
        gst_amount?: number;
        interest_till_date: number;
        penalty: number;
        total_amount?: number;
        total_extension_amount?: number;
        original_due_date: string;
        new_due_date: string;
        outstanding_loan_balance?: number;
        outstanding_loan_balance_after_extension?: number;
        total_tenure_days?: number;
        extension_period_days?: number; // Days added by this extension
        original_emi_dates?: string[]; // For multi-EMI loans
        new_emi_dates?: string[]; // For multi-EMI loans
        reason?: string;
    };
    generated_at: string;
}

interface SharedExtensionLetterDocumentProps {
    extensionData: ExtensionLetterData;
}

export function SharedExtensionLetterDocument({ extensionData }: SharedExtensionLetterDocumentProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const formatCurrencySimple = (amount: number) => {
        // Format as "Rs.xxx.xx" with 2 decimal places
        return `Rs.${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        try {
            // Handle YYYY-MM-DD format (from backend) - parse without timezone conversion
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                const [year, month, day] = dateString.split('-');
                return `${day}/${month}/${year}`;
            }
            // Handle ISO datetime strings - extract date part and parse without timezone conversion
            if (typeof dateString === 'string' && dateString.includes('T')) {
                const datePart = dateString.split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}/${month}/${year}`;
                }
            }
            // Handle MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            if (typeof dateString === 'string' && dateString.includes(' ')) {
                const datePart = dateString.split(' ')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}/${month}/${year}`;
                }
            }
            // Fallback to Date object parsing
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const borrowerName = extensionData.borrower?.name || 
        `${extensionData.borrower?.first_name || ''} ${extensionData.borrower?.last_name || ''}`.trim() || 
        'N/A';
    const loanAmount = extensionData.loan?.sanctioned_amount || extensionData.loan?.loan_amount || 0;
    // Loan ID: PLL + loan_application.id (unique)
    const shortLoanId = extensionData.loan?.id != null ? `PLL${extensionData.loan.id}` : 'N/A';
    const disbursementDate = extensionData.loan?.disbursed_at || extensionData.loan?.processed_at;
    
    // Get today's date for interest calculation
    const todayDate = formatDate(extensionData.extension.extension_availed_date || extensionData.generated_at);
    
    // Calculate values
    const extensionFee = extensionData.extension.extension_fee || 0;
    const gstAmount = extensionData.extension.gst_amount || 0;
    const interestTillDate = extensionData.extension.interest_till_date || 0;
    // Penalty: use penalty_base if available, otherwise use penalty (backward compatibility)
    const penaltyBase = extensionData.extension.penalty_base || extensionData.extension.penalty || 0;
    const penaltyGST = extensionData.extension.penalty_gst || 0;
    const penaltyTotal = extensionData.extension.penalty_total || extensionData.extension.penalty || 0;
    const totalExtensionAmount = extensionData.extension.total_extension_amount || (extensionFee + gstAmount + interestTillDate + penaltyTotal);
    const outstandingBalance = extensionData.extension.outstanding_loan_balance || loanAmount;
    // Outstanding balance after extension remains UNCHANGED (extension is date shift, not balance mutation)
    // Extension payment is a separate transactional charge, not added to outstanding balance
    const outstandingBalanceAfterExtension = extensionData.extension.outstanding_loan_balance_after_extension || outstandingBalance;
    const totalTenureDays = extensionData.extension.total_tenure_days || 0;

    return (
        <div className="bg-white" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt', lineHeight: '1.6' }}>
            <div className="p-8">
                {/* Company Header - Centered */}
                <div className="text-center mb-4" style={{ borderBottom: '1px solid #000', paddingBottom: '8px' }}>
                    <h2 className="font-bold mb-1" style={{ fontSize: '14pt' }}>
                        SPHEETI FINTECH PRIVATE LIMITED
                    </h2>
                    <p className="text-xs mb-1">
                        CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361
                    </p>
                    <p className="text-xs mb-2">
                        Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001
                    </p>
                </div>

                {/* Title - Centered, Bold, Uppercase */}
                <div className="text-center mb-6">
                    <h1 className="font-bold" style={{ fontSize: '13pt', textTransform: 'uppercase' }}>
                        LETTER FOR EXTENSION OF LOAN TENURE
                    </h1>
                </div>

                {/* Date - Right Aligned */}
                <div className="text-right mb-6">
                    <p className="text-sm">
                        <strong>Date:</strong> {todayDate}
                    </p>
                </div>

                {/* To - Left Aligned */}
                <div className="mb-2">
                    <p>To,</p>
                    <p className="font-bold">{borrowerName}</p>
                </div>

                {/* Subject - Left Aligned */}
                <div className="mb-4">
                    <p className="font-bold">
                        Subject: Extension of Loan Tenure with respect to Loan ID {shortLoanId}
                    </p>
                </div>

                {/* Salutation */}
                <div className="mb-4">
                    <p>Dear {borrowerName},</p>
                </div>

                {/* Opening Paragraph - Justified */}
                <div className="mb-4 text-justify">
                    <p>
                        This is with reference to the Loan Agreement dated <strong>{disbursementDate ? formatDate(disbursementDate) : '[DD/MM/YYYY]'}</strong> ("Main Agreement") executed between SPHEETI FINTECH PVT LTD, as the Lender, and <strong>{borrowerName}</strong>, as the Borrower, pursuant to which the Borrower availed a loan of <strong>{formatCurrency(loanAmount)}</strong> with loan ID: <strong>{shortLoanId}</strong> on <strong>{disbursementDate ? formatDate(disbursementDate) : '[Disbursement Date]'}</strong>.
                    </p>
                </div>

                {/* Approval Paragraph - Justified */}
                <div className="mb-6 text-justify">
                    <p>
                        We acknowledge receipt of your request seeking an extension of the loan tenure due to unforeseen circumstances affecting timely repayment. After due consideration, the Lender is pleased to inform you that your request has been approved, subject to the terms mentioned below.
                    </p>
                </div>

                {/* Section 1: Extension of Loan Tenure */}
                <div className="mb-4">
                    <p className="font-bold mb-2">1. Extension of Loan Tenure :</p>
                    <p className="text-justify">
                        {extensionData.extension.original_emi_dates && extensionData.extension.original_emi_dates.length > 0 ? (
                            // Multi-EMI loan: Show all EMI dates
                            <>
                                The loan tenure for Loan ID <strong>{shortLoanId}</strong> is extended from <strong>{extensionData.extension.original_emi_dates.map((date: string) => formatDate(date)).join(', ')}</strong> to <strong>{extensionData.extension.new_emi_dates ? extensionData.extension.new_emi_dates.map((date: string) => formatDate(date)).join(', ') : formatDate(extensionData.extension.new_due_date || extensionData.extension.extension_period_till)}</strong>.
                            </>
                        ) : (
                            // Single payment loan: Show single due date
                            <>
                                The loan tenure for Loan ID <strong>{shortLoanId}</strong> is extended from <strong>{formatDate(extensionData.extension.original_due_date)}</strong> to <strong>{formatDate(extensionData.extension.new_due_date || extensionData.extension.extension_period_till)}</strong>.
                            </>
                        )}
                    </p>
                    <p className="text-justify">
                        The revised total loan tenure shall be <strong>{totalTenureDays}</strong> days.
                    </p>
                </div>

                {/* Section 2: Extension Fee & interest till today */}
                <div className="mb-4">
                    <p className="font-bold mb-2">2. Extension Fee & interest till today :</p>
                    <p className="mb-2 text-justify">
                        <strong>A)</strong> A fixed extension fee of <strong>{formatCurrencySimple(extensionFee)}</strong> shall be applicable. This fee is administrative in nature and does not constitute interest or principal repayment.
                    </p>
                    {gstAmount > 0 && (
                        <p className="mb-2 text-justify">
                            <strong>B)</strong> GST on Extension Fee (18%): <strong>{formatCurrencySimple(gstAmount)}</strong>
                        </p>
                    )}
                    <p className="mb-2 text-justify">
                        <strong>{gstAmount > 0 ? 'C' : 'B'})</strong> Total Interest till <strong>{todayDate}</strong> ( Today's date ) : <strong>{formatCurrencySimple(interestTillDate)}</strong>
                    </p>
                    {penaltyBase > 0 && (
                        <p className="mb-2 text-justify">
                            <strong>{gstAmount > 0 ? 'D' : 'C'})</strong> Penalty for overdue payment (if applicable): <strong>{formatCurrencySimple(penaltyBase)}</strong>
                        </p>
                    )}
                    {penaltyBase > 0 && penaltyGST > 0 && (
                        <p className="mb-2 text-justify">
                            <strong>{gstAmount > 0 ? 'E' : 'D'})</strong> GST on Penalty (18%): <strong>{formatCurrencySimple(penaltyGST)}</strong>
                        </p>
                    )}
                    <p className="text-justify">
                        <strong>{gstAmount > 0 && penaltyBase > 0 ? (penaltyGST > 0 ? 'F' : 'E') : (gstAmount > 0 || penaltyBase > 0 ? 'D' : 'C')})</strong> Total Extension Payment (including all charges): <strong>{formatCurrencySimple(totalExtensionAmount)}</strong>
                    </p>
                </div>

                {/* Section 3: Revised Loan Details as Today */}
                <div className="mb-4">
                    <p className="font-bold mb-2">3. Revised Loan Details as Today :</p>
                    <div className="ml-4" style={{ lineHeight: '1.8' }}>
                        <p>Loan Amount: <strong>{formatCurrencySimple(loanAmount)}</strong></p>
                        <p>Outstanding Loan Balance: <strong>{formatCurrencySimple(outstandingBalance)}</strong></p>
                        <p>Extension Fee: <strong>{formatCurrencySimple(extensionFee)}</strong></p>
                        {gstAmount > 0 && (
                            <p>GST on Extension Fee: <strong>{formatCurrencySimple(gstAmount)}</strong></p>
                        )}
                        <p>Interest till Date: <strong>{formatCurrencySimple(interestTillDate)}</strong></p>
                        {penaltyBase > 0 && (
                            <p>Penalty (if applicable): <strong>{formatCurrencySimple(penaltyBase)}</strong></p>
                        )}
                        {penaltyBase > 0 && penaltyGST > 0 && (
                            <p>GST on Penalty (18%): <strong>{formatCurrencySimple(penaltyGST)}</strong></p>
                        )}
                        <p>Total Extension Payment (including all charges): <strong>{formatCurrencySimple(totalExtensionAmount)}</strong></p>
                        <p>Outstanding Loan Balance after extension: <strong>{formatCurrencySimple(outstandingBalanceAfterExtension)}</strong></p>
                        <p>Extension Start Date: <strong>{todayDate}</strong></p>
                        <p>Revised Repayment Due Date: <strong>{formatDate(extensionData.extension.new_due_date || extensionData.extension.extension_period_till)}</strong></p>
                    </div>
                </div>

                {/* Section 4: Continuity of Original Terms & Acceptance */}
                <div className="mb-6">
                    <p className="font-bold mb-2">4. Continuity of Original Terms & Acceptance :</p>
                    <p className="text-justify">
                        All other terms and conditions of the Main Agreement shall remain unchanged and enforceable & This extension forms an integral part of the Main Agreement upon acceptance. For any clarification, Reach us on Email: <a href="mailto:support@pocketcredit.in" className="text-blue-600 underline">support@pocketcredit.in</a>
                    </p>
                </div>

                {/* Signatory Information */}
                <div className="mt-8">
                    <p className="mb-1">Name: <strong>Karan Kamal Lalchadani</strong></p>
                    <p>Authorized Signatory</p>
                </div>
            </div>
        </div>
    );
}
