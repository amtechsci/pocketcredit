/**
 * SharedNOCDocument - Pure No Dues Certificate (NOC) rendering component
 * Used by both admin and user interfaces
 * Design matches the official NOC format
 */

interface NOCData {
    company: any;
    loan: any;
    borrower: any;
    generated_at: string;
}

interface SharedNOCDocumentProps {
    nocData: NOCData;
}

export function SharedNOCDocument({ nocData }: SharedNOCDocumentProps) {
    const formatDate = (dateString: string) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        try {
            // Handle YYYY-MM-DD format (from backend) - parse without timezone conversion
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                const [year, month, day] = dateString.split('-');
                return `${day}-${month}-${year}`;
            }
            // Handle ISO datetime strings - extract date part and parse without timezone conversion
            if (typeof dateString === 'string' && dateString.includes('T')) {
                const datePart = dateString.split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}-${month}-${year}`;
                }
            }
            // Handle MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            if (typeof dateString === 'string' && dateString.includes(' ')) {
                const datePart = dateString.split(' ')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}-${month}-${year}`;
                }
            }
            // Fallback to Date object parsing
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateString;
        }
    };

    const borrowerName = nocData.borrower?.name || 
        `${nocData.borrower?.first_name || ''} ${nocData.borrower?.last_name || ''}`.trim() || 
        'N/A';
    
    // Loan ID: PLL + loan_application.id (unique)
    const shortLoanId = nocData.loan?.id != null ? `PLL${nocData.loan.id}` : 'PLLXXX';
    
    // Get today's date for the certificate
    const todayDate = formatDate(nocData.generated_at || new Date().toISOString());

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
                        NO DUES CERTIFICATE
                    </h1>
                </div>

                {/* Date - Left Aligned */}
                <div className="mb-4">
                    <p className="text-sm">
                        <strong>Date :</strong> {todayDate}
                    </p>
                </div>

                {/* Customer Name - Left Aligned */}
                <div className="mb-4">
                    <p className="text-sm">
                        <strong>Name of the Customer:</strong> {borrowerName}
                    </p>
                </div>

                {/* Subject - Left Aligned */}
                <div className="mb-4">
                    <p className="text-sm">
                        <strong>Sub: No Dues Certificate for Loan ID - {shortLoanId}</strong>
                    </p>
                </div>

                {/* Salutation */}
                <div className="mb-4">
                    <p className="font-bold">Dear Sir/Madam,</p>
                </div>

                {/* Body of the Certificate - Justified */}
                <div className="mb-6 text-justify">
                    <p>
                        This letter is to confirm that Spheeti Fintech Private Limited has received payment for the aforesaid loan ID and no amount is outstanding and payable by you to the Company under the aforesaid loan ID.
                    </p>
                </div>

                {/* Closing */}
                <div className="mt-8">
                    <p className="mb-1 font-bold">Thanking you,</p>
                    <p className="font-bold">On behalf of Spheeti Fintech Private Limited</p>
                </div>
            </div>
        </div>
    );
}

