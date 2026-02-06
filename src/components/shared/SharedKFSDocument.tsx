/**
 * SharedKFSDocument - Pure KFS rendering component
 * Used by both admin and user interfaces
 */

interface KFSData {
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
    additional: any;
    generated_at: string;
}

interface SharedKFSDocumentProps {
    kfsData: KFSData;
}

export function SharedKFSDocument({ kfsData }: SharedKFSDocumentProps) {
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
            // Fallback to Date object parsing (may have timezone issues, but better than nothing)
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

    const calculateAPR = () => {
        if (!kfsData) return '0.00';

        // Use backend-calculated APR (all calculations are done in backend)
        if (kfsData.calculations?.apr !== undefined && kfsData.calculations.apr !== null) {
            return kfsData.calculations.apr.toFixed(2);
        }

        // If backend didn't provide APR, return 0 (should not happen)
        console.warn('⚠️ APR not provided by backend');
        return '0.00';
    };

    // Get fees grouped by application method
    const getFeesByMethod = (method: string) => {
        if (!kfsData?.fees?.fees_breakdown || !Array.isArray(kfsData.fees.fees_breakdown)) {
            return [];
        }
        return kfsData.fees.fees_breakdown.filter((fee: any) => fee.application_method === method);
    };

    const deductFromDisbursalFees = getFeesByMethod('deduct_from_disbursal');
    const addToTotalFees = getFeesByMethod('add_to_total');

    return (
        <div className="kfs-document-content bg-white" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>
            {/* PAGE 1 - PART A */}
            <div className="p-8">
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
                    <p className="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
                    <p className="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
                </div>
                <hr className="mb-4 border-gray-400" />

                {/* Part A Title */}
                <div className="text-center mb-3">
                    <p className="font-bold text-sm">PART A - Key Facts Statement</p>
                    <p className="font-bold text-sm">Annex A</p>
                    <p className="font-bold text-sm">Part 1 (Interest rate and fees/charges)</p>
                </div>

                {/* Main Table */}
                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}>1</td>
                            <td className="border border-black p-2" style={{ width: '40%' }}>Loan proposal/account No.</td>
                            <td className="border border-black p-2" style={{ width: '20%' }}>
                                {kfsData.loan.id != null ? `PLL${kfsData.loan.id}` : (kfsData.loan.application_number || '')}
                            </td>
                            <td className="border border-black p-2" style={{ width: '15%' }}>Type of Loan</td>
                            <td className="border border-black p-2" style={{ width: '20%' }}>{kfsData.loan.type}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">2</td>
                            <td className="border border-black p-2">Sanctioned Loan amount (in Rupees)</td>
                            <td className="border border-black p-2">{formatCurrency(kfsData.loan.sanctioned_amount)}</td>
                            <td className="border border-black p-2" colSpan={2} rowSpan={2}></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">3</td>
                            <td className="border border-black p-2">Disbursal schedule</td>
                            <td className="border border-black p-2">100% upfront</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2" colSpan={2}>(i) Disbursement in stages or 100% upfront.</td>
                            <td className="border border-black p-2" colSpan={2}></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">4</td>
                            <td className="border border-black p-2">Loan term (year/months/days)</td>
                            <td className="border border-black p-2" colSpan={3}>
                                {(() => {
                                    const emiCount = kfsData.loan.emi_count;
                                    if (emiCount && emiCount > 1) {
                                        // EMI loan: calculate days based on EMI count
                                        // Formula: 165 + (emi_count - 1) * 30
                                        // 1 EMI: 165 days, 2 EMI: 195 days, 3 EMI: 225 days, 4 EMI: 255 days, etc.
                                        const days = 165 + (emiCount - 1) * 30;
                                        return `Up to ${days} days`;
                                    }
                                    // Single payment loan: always show 165 days (base + 4 extensions possible)
                                    return `Up to 165 days`;
                                })()}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">5</td>
                            <td className="border border-black p-2">Instalment details</td>
                            <td className="border border-black p-2" colSpan={3}></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">Type of instalments</td>
                            <td className="border border-black p-2">Number of EPIs</td>
                            <td className="border border-black p-2">EPI (₹)</td>
                            <td className="border border-black p-2">Commencement of repayment, post sanction</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">
                                {(() => {
                                    // For Multi-EMI plans, show all EMI dates comma-separated
                                    if (kfsData.repayment.all_emi_dates && kfsData.repayment.all_emi_dates.length > 1) {
                                        return kfsData.repayment.all_emi_dates.map((date: string) => formatDate(date)).join(', ');
                                    }
                                    return formatDate(kfsData.repayment.first_due_date);
                                })()}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">6</td>
                            <td className="border border-black p-2">Interest rate (%) and type (fixed or floating or hybrid)</td>
                            <td className="border border-black p-2" colSpan={3}>{((kfsData.interest.rate_per_day || 0) * 100).toFixed(2)}% per day (fixed)</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">7</td>
                            <td className="border border-black p-2">Additional Information in case of Floating rate of interest</td>
                            <td className="border border-black p-2" colSpan={3}></td>
                        </tr>
                    </tbody>
                </table>

                {/* Floating Rate Table */}
                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}></td>
                            <td className="border border-black p-2" style={{ width: '15%' }}>Reference Benchmark</td>
                            <td className="border border-black p-2" style={{ width: '10%' }}>Benchmark rate (%) (B)</td>
                            <td className="border border-black p-2" style={{ width: '10%' }}>Spread (%) (S)</td>
                            <td className="border border-black p-2" style={{ width: '10%' }}>Final rate (%) R = (B)+(S)</td>
                            <td className="border border-black p-2" style={{ width: '10%' }}>Reset periodicity (Months)</td>
                            <td className="border border-black p-2" colSpan={3}>Impact of change in the reference benchmark (for 25 bps change in 'R', change in ₹)</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">B</td>
                            <td className="border border-black p-2">S</td>
                            <td className="border border-black p-2">EPI (₹)</td>
                            <td className="border border-black p-2">No. of EPIs</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                    </tbody>
                </table>

                {/* Fees/Charges Table */}
                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}>8</td>
                            <td className="border border-black p-2" colSpan={5}>Fee/Charges</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black border-r-0 p-2" colSpan={2}>Payable to the RE (A)</td>
                            <td className="border border-black border-l-0 p-2 text-right" colSpan={3}>Payable to a third party through RE (B)</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">One-time/ Recurring</td>
                            <td className="border border-black p-2">Amount (in ₹) or Percentage (%) as applicable</td>
                            <td className="border border-black p-2">One time/ Recurring</td>
                            <td className="border border-black p-2">Amount (in ₹) or Percentage (%) as applicable</td>
                        </tr>
                        {/* Dynamic fees - Deduct from disbursal */}
                        {deductFromDisbursalFees.length > 0 ? (
                            deductFromDisbursalFees.map((fee: any, index: number) => (
                                <tr key={`deduct-${index}`}>
                                    <td className="border border-black p-2"></td>
                                    <td className="border border-black p-2">
                                        ({index + 1}) {fee.fee_name || 'Processing fees'}
                                    </td>
                                    <td className="border border-black p-2">Onetime</td>
                                    <td className="border border-black p-2">{formatCurrency(parseFloat(fee.fee_amount || fee.amount || 0))}</td>
                                    <td className="border border-black p-2">N/A</td>
                                    <td className="border border-black p-2">N/A</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2">(i) Processing fees</td>
                                <td className="border border-black p-2">Onetime</td>
                                <td className="border border-black p-2">{formatCurrency(kfsData.fees.processing_fee)}</td>
                                <td className="border border-black p-2">N/A</td>
                                <td className="border border-black p-2">N/A</td>
                            </tr>
                        )}
                        {/* Fees added to total - Now show in left columns only */}
                        {addToTotalFees.length > 0 && (
                            addToTotalFees.map((fee: any, index: number) => (
                                <tr key={`add-${index}`}>
                                    <td className="border border-black p-2"></td>
                                    <td className="border border-black p-2">
                                        ({deductFromDisbursalFees.length + index + 1}) {fee.fee_name || 'Service fees'}
                                    </td>
                                    <td className="border border-black p-2">Onetime</td>
                                    <td className="border border-black p-2">{formatCurrency(parseFloat(fee.fee_amount || fee.amount || 0))}</td>
                                    <td className="border border-black p-2">N/A</td>
                                    <td className="border border-black p-2">N/A</td>
                                </tr>
                            ))
                        )}
                        {/* Combined GST on all fees */}
                        {(kfsData.fees.gst > 0 || (kfsData.fees.gst_on_deduct_from_disbursal > 0) || (kfsData.fees.gst_on_add_to_total > 0)) && (
                            <tr>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2">
                                    ({deductFromDisbursalFees.length + addToTotalFees.length + 1}) GST (18%)
                                </td>
                                <td className="border border-black p-2">Onetime</td>
                                <td className="border border-black p-2">
                                    {formatCurrency(
                                        (kfsData.fees.gst_on_deduct_from_disbursal || 0) +
                                        (kfsData.fees.gst_on_add_to_total || 0) ||
                                        kfsData.fees.gst
                                    )}
                                </td>
                                <td className="border border-black p-2">N/A</td>
                                <td className="border border-black p-2">N/A</td>
                            </tr>
                        )}
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">
                                ({deductFromDisbursalFees.length + addToTotalFees.length + (kfsData.fees.gst > 0 ? 1 : 0) + 1}) Insurance charges
                            </td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">
                                ({deductFromDisbursalFees.length + addToTotalFees.length + (kfsData.fees.gst > 0 ? 1 : 0) + 2}) Valuation fees
                            </td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                    </tbody>
                </table>

                {/* APR and Contingent Charges */}
                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}>9</td>
                            <td className="border border-black p-2" style={{ width: '30%' }}>Annual Percentage Rate (APR) (%)</td>
                            <td className="border border-black p-2" style={{ width: '65%' }}>{calculateAPR()}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">10</td>
                            <td className="border border-black p-2" colSpan={2}>Details of Contingent Charges (in ₹ or %, as applicable)</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(i) Penal charges, if any, in case of delayed payment</td>
                            <td className="border border-black p-2">
                                <p className="mb-2"><strong>a) Late Payment Fees / Penal charges:</strong></p>
                                <p className="mb-1">If you miss a loan repayment:</p>
                                <ul className="list-disc ml-5 mb-2">
                                    <li>On the first day after the due date: You'll be charged a one-time penalty of 5% of the overdue principal amount.</li>
                                    <li>From 2nd day after due date to 10th day after due date: you'll be charged 1% per day of the overdue principal amount.</li>
                                    <li>From 11th day after due date to 120th day after due date: you'll be charged 0.6% per day of the overdue principal amount.</li>
                                    <li>Above 120 days it's "0"</li>
                                </ul>
                                <p className="mb-2"><strong>Clarification:</strong> For the avoidance of doubt, it is hereby clarified that the Penal Charges will be calculated on the principal overdue amount only and shall be levied distinctly and separately from the components of the principal overdue amount and the loan interest. These charges are not added to the rate of interest against which the loan has been advanced and are also not subject to any further interest. Please note that these charges are calculated in a manner so as to be commensurate to the default and are levied in a non-discriminatory manner for this loan product.</p>
                                <p><strong>b) Annualized Rate of Interest post-due date:</strong></p>
                                <p>In case of loan repayment overdue, basic interest charges shall continue to accrue at the same rate at {((kfsData.interest.rate_per_day || 0) * 100).toFixed(2)}% per day on the Principal overdue amount from the First Overdue Day to Till the Loan is closed.</p>
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(ii) Other penal charges, if any</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(iii) Foreclosure charges, if applicable</td>
                            <td className="border border-black p-2">Zero Foreclosure charges</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(iv) Charges for switching of loans from floating to fixed rate and vice versa</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(v) Any other charges (please specify)</td>
                            <td className="border border-black p-2">
                                Loan Tenure Extension 1: 21% of (2) + GST<br />
                                Loan Tenure Extension 2: 21% of (2) + GST<br />
                                Loan Tenure Extension 3: 21% of (2) + GST<br />
                                Loan Tenure Extension 4: 21% of (2) + GST
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* PAGE 2 - PART 2 */}
            <div className="p-8" style={{ pageBreakBefore: 'always' }}>
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
                    <p className="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
                    <p className="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
                </div>
                <hr className="mb-4 border-gray-400" />

                <div className="text-center mb-3">
                    <p className="font-bold text-sm">Part 2 (Other qualitative information)</p>
                </div>

                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}>1</td>
                            <td className="border border-black p-2" style={{ width: '70%' }}>Clause of Loan agreement relating to engagement of recovery agents</td>
                            <td className="border border-black p-2" style={{ width: '25%' }}>7</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">2</td>
                            <td className="border border-black p-2">Clause of Loan agreement which details grievance redressal mechanism</td>
                            <td className="border border-black p-2">8.3</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">3</td>
                            <td className="border border-black p-2">Phone number and email id of the nodal grievance redressal officer</td>
                            <td className="border border-black p-2">
                                Name: {'Mr.Kiran'}<br />
                                Number: {'+91 9573794121'}<br />
                                Mail ID: {'Kiran@pocketcredit.in'}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">4</td>
                            <td className="border border-black p-2">Whether the loan is, or in future maybe, subject to transfer to other REs or securitisation (Yes/No)</td>
                            <td className="border border-black p-2">Yes</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">5</td>
                            <td className="border border-black p-2" colSpan={2}>In case of lending under collaborative lending arrangements (e.g., co-lending/ outsourcing), following additional details may be furnished:</td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}></td>
                            <td className="border border-black p-2 font-bold" style={{ width: '31%' }}>Name of the originating RE, along with its funding proportion</td>
                            <td className="border border-black p-2 font-bold" style={{ width: '32%' }}>Name of the partner RE along with its proportion of funding</td>
                            <td className="border border-black p-2 font-bold" style={{ width: '32%' }}>Blended rate of interest</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2" style={{ width: '5%' }}>6</td>
                            <td className="border border-black p-2" colSpan={2}>In case of digital loans, following specific disclosures may be furnished:</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2" style={{ width: '70%' }}>(i) Cooling off/look-up period, in terms of RE's board approved policy, during which borrower shall not be charged any penalty on prepayment of loan</td>
                            <td className="border border-black p-2" style={{ width: '25%' }}>3 days</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">(ii) Details of LSP acting as recovery agent and authorized to approach the borrower</td>
                            <td className="border border-black p-2">Refer to: List of LSPs</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* PAGE 3 - ANNEX B */}
            <div className="p-8" style={{ pageBreakBefore: 'always' }}>
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
                    <p className="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
                    <p className="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
                </div>
                <hr className="mb-4 border-gray-400" />

                <div className="text-center mb-3">
                    <p className="font-bold text-sm">Annex B</p>
                    <p className="font-bold text-sm">computation of APR</p>
                </div>

                <table className="w-full border-collapse text-xs mb-3" style={{ border: '1px solid #000' }}>
                    <thead>
                        <tr>
                            <th className="border border-black p-2 bg-gray-100" style={{ width: '5%' }}>Sr. No.</th>
                            <th className="border border-black p-2 bg-gray-100" style={{ width: '60%' }}>Parameter</th>
                            <th className="border border-black p-2 bg-gray-100" style={{ width: '35%' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2">1</td>
                            <td className="border border-black p-2">Sanctioned Loan amount (in Rupees)</td>
                            <td className="border border-black p-2">{formatCurrency(kfsData.loan.sanctioned_amount)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">2</td>
                            <td className="border border-black p-2">Loan Term (in years/ months/ days)</td>
                            <td className="border border-black p-2">
                                {(() => {
                                    const emiCount = kfsData.loan.emi_count;
                                    if (emiCount && emiCount > 1) {
                                        // EMI loan: calculate days based on EMI count
                                        // Formula: 165 + (emi_count - 1) * 30
                                        // 1 EMI: 165 days, 2 EMI: 195 days, 3 EMI: 225 days, 4 EMI: 255 days, etc.
                                        const days = 165 + (emiCount - 1) * 30;
                                        return `Up to ${days} days`;
                                    }
                                    // Single payment loan: always show 165 days (base + 4 extensions possible)
                                    return `Up to 165 days`;
                                })()}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">a) No. of instalments for payment of principal, in case of non- equated periodic loans</td>
                            <td className="border border-black p-2">
                                {kfsData.loan.emi_count || kfsData.repayment?.number_of_instalments || (kfsData.repayment?.all_emi_dates?.length || 1)}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">b) Type of EPI<br />Amount of each EPI (in Rupees) and<br />nos. of EPIs (e.g., no. of EMIs in case of monthly instalments)</td>
                            <td className="border border-black p-2">N/A<br />N/A<br />N/A</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">c) No. of instalments for payment of capitalised interest, if any</td>
                            <td className="border border-black p-2">N/A</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">d) Commencement of repayment, post sanction</td>
                            <td className="border border-black p-2">
                                {(() => {
                                    // For Multi-EMI plans, show all EMI dates comma-separated
                                    if (kfsData.repayment.all_emi_dates && kfsData.repayment.all_emi_dates.length > 1) {
                                        return kfsData.repayment.all_emi_dates.map((date: string) => formatDate(date)).join(', ');
                                    }
                                    return formatDate(kfsData.repayment.first_due_date);
                                })()}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">3</td>
                            <td className="border border-black p-2">Interest rate type (fixed or floating or hybrid)</td>
                            <td className="border border-black p-2">Fixed</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">4</td>
                            <td className="border border-black p-2">Rate of Interest</td>
                            <td className="border border-black p-2">{((kfsData.interest.rate_per_day || 0) * 100).toFixed(2)}% per day</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">5</td>
                            <td className="border border-black p-2">Total Interest Amount to be charged during the entire tenor of the loan as per the rate prevailing on sanction date (in Rupees)</td>
                            <td className="border border-black p-2">{formatCurrency(kfsData.interest?.total_interest || kfsData.calculations?.interest || 0)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">6</td>
                            <td className="border border-black p-2">Fee/ Charges payable (in Rupees)</td>
                            <td className="border border-black p-2">
                                {(
                                    kfsData.fees.processing_fee +
                                    kfsData.fees.gst +
                                    (kfsData.fees.total_add_to_total || 0)
                                ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">A Payable to the RE</td>
                            <td className="border border-black p-2">
                                {(
                                    kfsData.fees.processing_fee +
                                    kfsData.fees.gst +
                                    (kfsData.fees.total_add_to_total || 0)
                                ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2">B Payable to third-party routed through RE</td>
                            <td className="border border-black p-2">NA</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">7</td>
                            <td className="border border-black p-2">Net disbursed amount (in Rupees)</td>
                            <td className="border border-black p-2">{formatCurrency(kfsData.calculations.disbursed_amount)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">8</td>
                            <td className="border border-black p-2">Total amount to be paid by the borrower (in Rupees)</td>
                            <td className="border border-black p-2">{formatCurrency(kfsData.calculations?.total_repayable || 0)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">9</td>
                            <td className="border border-black p-2">Annual Percentage rate- Effective annualized interest rate (in percentage)</td>
                            <td className="border border-black p-2">{calculateAPR()}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">10</td>
                            <td className="border border-black p-2">Schedule of disbursement as per terms and conditions</td>
                            <td className="border border-black p-2">100% upfront</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2">11</td>
                            <td className="border border-black p-2">Due date of payment of instalment and interest</td>
                            <td className="border border-black p-2">
                                {(() => {
                                    // For Multi-EMI plans, show all EMI dates comma-separated
                                    if (kfsData.repayment.all_emi_dates && kfsData.repayment.all_emi_dates.length > 1) {
                                        return kfsData.repayment.all_emi_dates.map((date: string) => formatDate(date)).join(', ');
                                    }
                                    return formatDate(kfsData.repayment.first_due_date);
                                })()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* PAGE 4 - ANNEX C & PART B */}
            <div className="p-8" style={{ pageBreakBefore: 'always' }}>
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold mb-2">SPHEETI FINTECH PRIVATE LIMITED</h1>
                    <p className="text-xs">CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361</p>
                    <p className="text-xs">Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001</p>
                </div>
                <hr className="mb-4 border-gray-400" />

                <div className="text-center mb-3">
                    <p className="font-bold text-sm">Annex C</p>
                    <p className="font-bold text-sm">Repayment Schedule</p>
                </div>

                <table className="w-full border-collapse text-xs mb-4" style={{ border: '1px solid #000' }}>
                    <thead>
                        <tr>
                            <th className="border border-black p-2 bg-gray-100">Instalment No.</th>
                            <th className="border border-black p-2 bg-gray-100">Outstanding Principal (in Rupees)</th>
                            <th className="border border-black p-2 bg-gray-100">Principal (in Rupees)</th>
                            <th className="border border-black p-2 bg-gray-100">Interest + post service fee inclusive GST (in Rupees)</th>
                            <th className="border border-black p-2 bg-gray-100">Instalment (in Rupees)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            // Use backend-calculated schedule if available (avoids timezone issues)
                            if (kfsData.repayment?.schedule && Array.isArray(kfsData.repayment.schedule) && kfsData.repayment.schedule.length > 0) {
                                return kfsData.repayment.schedule.map((emi: any, index: number) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center">{emi.instalment_no || (index + 1)}</td>
                                        <td className="border border-black p-2">{formatCurrency(emi.outstanding_principal || 0)}</td>
                                        <td className="border border-black p-2">{formatCurrency(emi.principal || 0)}</td>
                                        <td className="border border-black p-2">
                                            {(emi.interest || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+{((emi.post_service_fee || 0) + (emi.gst_on_post_service_fee || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="border border-black p-2">{formatCurrency(emi.instalment_amount || 0)}</td>
                                    </tr>
                                ));
                            }

                            // Fallback: Single payment loan using backend values
                            const principal = kfsData.loan.sanctioned_amount || kfsData.calculations.principal || 0;
                            const totalInterest = kfsData.calculations.interest || 0;
                            const postServiceFee = kfsData.fees.total_add_to_total || 0;
                            const postServiceFeeGST = Math.round(postServiceFee * 0.18 * 100) / 100;
                            const postServiceFeeWithGST = postServiceFee + postServiceFeeGST;
                            const instalmentAmount = principal + totalInterest + postServiceFee + postServiceFeeGST;

                            return (
                                <tr>
                                    <td className="border border-black p-2 text-center">1</td>
                                    <td className="border border-black p-2">{formatCurrency(principal)}</td>
                                    <td className="border border-black p-2">{formatCurrency(principal)}</td>
                                    <td className="border border-black p-2">
                                        {totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+{postServiceFeeWithGST.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="border border-black p-2">{formatCurrency(instalmentAmount)}</td>
                                </tr>
                            );
                        })()}
                    </tbody>
                </table>

                <div className="text-center mb-3">
                    <p className="font-bold text-sm">PART B- SANCTION LETTER</p>
                </div>

                <div className="mb-3 text-xs">
                    <p>Dear {kfsData.borrower.name},</p>
                    <p>Date: {formatDate(kfsData.generated_at)}</p>
                    <p>Sub: SANCTION LETTER</p>
                </div>

                <div className="mb-3 text-xs leading-relaxed">
                    <p className="mb-2">With reference to your application for availing a loan we are pleased to sanction the same subject to the terms and conditions as mentioned above in Key Facts Statement in PART A and in the loan agreement to be executed. Payable in the manner as mentioned in the Key Facts Statement (KFS) above & in the loan agreement to be executed.</p>

                    <p className="mb-2">The Borrower understands that the Lender has adopted risk-based pricing which is arrived by considering broad parameters like the borrower's financial and credit risk profile. Hence the rates of Interest will be different for different categories of borrowers based on the internal credit risk algorithms.</p>

                    <p className="mb-2">Please note that this communication should not be construed as giving rise to any obligation on the part of LSP/DLA/RE unless the loan agreement and the other documents relating to the above assistance are executed by you in such form and manner as may be required by LSP/DLA/RE.</p>

                    <p className="mb-3">We look forward to your availing of the sanctioned loan and assure you our best service always.</p>
                </div>

                <div className="mb-3">
                    <p className="font-bold text-sm mb-2">TERMS & CONDITIONS OF RECOVERY MECHANISM</p>
                    <p className="text-xs mb-2">The lender undertakes the recovery practices considering the following terms:</p>
                    <ul className="list-disc ml-5 text-xs mb-2">
                        <li>In-house/Outsource Recovery</li>
                        <li>Digital Recovery</li>
                        <li>Reminder Communication</li>
                        <li>Field Collection (if required)</li>
                    </ul>
                    <p className="text-xs mb-2">Where the Lender has failed to recover the money from the borrower it will rely upon the following legal recovery:</p>
                    <ul className="list-disc ml-5 text-xs mb-2">
                        <li>Legal Notice</li>
                        <li>Arbitration & Conciliation</li>
                    </ul>
                    <p className="text-xs mb-2">For the purpose of undertaking collection and recovery the Lender may either on its own or through the Lending service provider (including its debt recovery agents etc.) undertake collection or recovery from the Borrower.</p>
                    <p className="text-xs mb-3">All loans are to be paid to the lender only through the digital lending app or payment link generated and shared with the borrowers by the Lender.</p>
                </div>

                <div className="mb-3">
                    <p className="font-bold text-sm mb-2">Other Disclosures:</p>
                    <ul className="list-disc ml-5 text-xs">
                        <li>The lender will not be responsible for any payments made to any individual or entity in their bank accounts.</li>
                        <li>As per the RBI regulations information related to all borrowings and payments against those borrowings are reported to Credit Information Companies on a regular basis with in the stipulated timelines.</li>
                        <li>Payment of Loans after the due date may impact your credit scores maintained by the Credit Information Companies.</li>
                    </ul>
                </div>
            </div>
        </div >
    );
}
