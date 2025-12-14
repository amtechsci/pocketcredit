import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';

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

export function KFSDocument() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const [kfsData, setKfsData] = useState<KFSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');

    if (!adminToken && !adminUser) {
      navigate('/admin/login');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (loanId) {
      fetchKFSData();
    }
  }, [loanId]);

  const fetchKFSData = async () => {
    try {
      setLoading(true);
      const response = await adminApiService.getKFS(parseInt(loanId!));
      if (response.success && response.data) {
        setKfsData(response.data);
      } else {
        setError('Failed to load KFS data');
      }
    } catch (err: any) {
      console.error('Error fetching KFS:', err);
      setError(err.message || 'Failed to load KFS');
    } finally {
      setLoading(false);
    }
  };

  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const kfsElement = document.querySelector('.kfs-document-content');
      if (!kfsElement) {
        alert('KFS content not found');
        return;
      }

      const htmlContent = kfsElement.outerHTML;
      const pdfBlob = await adminApiService.generateKFSPDF(parseInt(loanId!), htmlContent);

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `KFS_${kfsData?.loan.application_number || loanId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ PDF downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleEmail = async () => {
    try {
      const confirmed = window.confirm(
        `Send KFS PDF to ${kfsData?.borrower.email}?\n\nThe borrower will receive an email with the KFS document attached.`
      );

      if (!confirmed) return;

      setEmailing(true);

      const kfsElement = document.querySelector('.kfs-document-content');
      if (!kfsElement) {
        alert('KFS content not found');
        return;
      }

      const htmlContent = kfsElement.outerHTML;

      const response = await adminApiService.emailKFSPDF(
        parseInt(loanId!),
        htmlContent,
        kfsData?.borrower.email,
        kfsData?.borrower.name
      );

      if (response.success) {
        alert(`✅ KFS PDF sent successfully to ${response.data.recipientEmail}`);
      } else {
        alert('Failed to send email: ' + response.message);
      }

    } catch (error: any) {
      console.error('Error emailing PDF:', error);
      alert('Failed to send email: ' + (error.message || 'Unknown error'));
    } finally {
      setEmailing(false);
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
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateAPR = () => {
    if (!kfsData) return 0;
    // Include all fees: processing fee, GST, fees added to total, and interest
    const totalCharges = kfsData.fees.processing_fee + kfsData.fees.gst +
      (kfsData.fees.total_add_to_total || 0) + kfsData.calculations.interest;
    const principal = kfsData.loan.sanctioned_amount;
    const days = kfsData.loan.loan_term_days;
    return ((totalCharges / principal) / days * 36500).toFixed(2);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading KFS...</p>
        </div>
      </div>
    );
  }

  if (error || !kfsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'KFS data not found'}</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Bar */}
      <div className="bg-white border-b border-gray-200 p-4 print:hidden sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={handleEmail}
              disabled={emailing}
            >
              <Mail className="w-4 h-4 mr-2" />
              {emailing ? 'Sending...' : 'Email PDF'}
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* KFS Document */}
      <div className="kfs-document-content max-w-[210mm] mx-auto bg-white my-8 print:my-0 shadow-lg print:shadow-none" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>

        {/* PAGE 1 - PART A */}
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold mb-2">{kfsData.company.name}</h1>
            <p className="text-xs">CIN: {kfsData.company.cin} | RBI Registration no: {kfsData.company.rbi_registration}</p>
            <p className="text-xs">{kfsData.company.address}</p>
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
                <td className="border border-black p-2" style={{ width: '20%' }}>{kfsData.loan.application_number}</td>
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
                <td className="border border-black p-2" colSpan={3}>{kfsData.loan.loan_term_days} days</td>
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
                <td className="border border-black p-2">{formatDate(kfsData.repayment.first_due_date)}</td>
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
                <td className="border border-black p-2" colSpan={3}>Impact of change in the reference benchmark (for 25 bps change in 'R', change in ³)</td>
              </tr>
              <tr>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2">B</td>
                <td className="border border-black p-2">S</td>
                <td className="border border-black p-2">EPI ()</td>
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
                <td className="border border-black p-2" colSpan={2}>Payable to the RE (A)</td>
                <td className="border border-black p-2" colSpan={3}>Payable to a third party through RE (B)</td>
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
                      {index === 0 ? '(i) ' : ''}{fee.fee_name || 'Processing fees'}
                    </td>
                    <td className="border border-black p-2">Onetime</td>
                    <td className="border border-black p-2">{formatCurrency(parseFloat(fee.amount || 0))}</td>
                    <td className="border border-black p-2">N/A</td>
                    <td className="border border-black p-2">N/A</td>
                  </tr>
                ))
              ) : (
                // Fallback to legacy processing fee
                <tr>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2">(i) Processing fees</td>
                  <td className="border border-black p-2">Onetime</td>
                  <td className="border border-black p-2">{formatCurrency(kfsData.fees.processing_fee)}</td>
                  <td className="border border-black p-2">N/A</td>
                  <td className="border border-black p-2">N/A</td>
                </tr>
              )}
              {/* GST on fees deducted from disbursal */}
              {kfsData.fees.gst > 0 && (
                <tr>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2">
                    ({deductFromDisbursalFees.length > 0 ? deductFromDisbursalFees.length + 1 : 'ii'}) GST
                  </td>
                  <td className="border border-black p-2">Onetime</td>
                  <td className="border border-black p-2">{formatCurrency(kfsData.fees.gst)}</td>
                  <td className="border border-black p-2">N/A</td>
                  <td className="border border-black p-2">N/A</td>
                </tr>
              )}
              {/* Fees added to total (shown in third party column as they're added to repayment) */}
              {addToTotalFees.length > 0 && (
                addToTotalFees.map((fee: any, index: number) => (
                  <tr key={`add-${index}`}>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2">
                      ({deductFromDisbursalFees.length + (kfsData.fees.gst > 0 ? 1 : 0) + index + 1}) {fee.fee_name || 'Service fees'}
                    </td>
                    <td className="border border-black p-2">N/A</td>
                    <td className="border border-black p-2">N/A</td>
                    <td className="border border-black p-2">Onetime</td>
                    <td className="border border-black p-2">{formatCurrency(parseFloat(fee.amount || 0))}</td>
                  </tr>
                ))
              )}
              {/* Insurance charges */}
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
              {/* Valuation fees */}
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
                    <li>On the first day after the due date: You'll be charged a one-time penalty of 4% of the overdue principal amount.</li>
                    <li>From the second day until the loan is fully repaid: You'll be charged a daily penalty of 0.2% of the overdue principal each day.</li>
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
                <td className="border border-black p-2">N/A</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PAGE 2 - PART 2 */}
        <div className="p-8 page-break-before">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold mb-2">{kfsData.company.name}</h1>
            <p className="text-xs">CIN: {kfsData.company.cin} | RBI Registration no: {kfsData.company.rbi_registration}</p>
            <p className="text-xs">{kfsData.company.address}</p>
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
                <td className="border border-black p-2" style={{ width: '25%' }}>1 (X)</td>
              </tr>
              <tr>
                <td className="border border-black p-2">2</td>
                <td className="border border-black p-2">Clause of Loan agreement which details grievance redressal mechanism</td>
                <td className="border border-black p-2">12</td>
              </tr>
              <tr>
                <td className="border border-black p-2">3</td>
                <td className="border border-black p-2">Phone number and email id of the nodal grievance redressal officer</td>
                <td className="border border-black p-2">
                  Name: {kfsData.grievance.nodal_officer?.name || 'N/A'}<br />
                  Number: {kfsData.grievance.nodal_officer?.phone || 'N/A'}<br />
                  Mail ID: {kfsData.grievance.nodal_officer?.email || 'N/A'}
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
        <div className="p-8 page-break-before">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold mb-2">{kfsData.company.name}</h1>
            <p className="text-xs">CIN: {kfsData.company.cin} | RBI Registration no: {kfsData.company.rbi_registration}</p>
            <p className="text-xs">{kfsData.company.address}</p>
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
                <td className="border border-black p-2">{kfsData.loan.loan_term_days} days</td>
              </tr>
              <tr>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2">a) No. of instalments for payment of principal, in case of non- equated periodic loans</td>
                <td className="border border-black p-2">1</td>
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
                <td className="border border-black p-2">{formatDate(kfsData.repayment.first_due_date)}</td>
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
                <td className="border border-black p-2">{formatCurrency(kfsData.calculations.interest)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">6</td>
                <td className="border border-black p-2">Fee/ Charges payable (in Rupees)</td>
                <td className="border border-black p-2">
                  {formatCurrency(
                    kfsData.fees.processing_fee +
                    kfsData.fees.gst +
                    (kfsData.fees.total_add_to_total || 0)
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2">A Payable to the RE</td>
                <td className="border border-black p-2">
                  {formatCurrency(kfsData.fees.processing_fee + kfsData.fees.gst)}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2">B Payable to third-party routed through RE</td>
                <td className="border border-black p-2">
                  {kfsData.fees.total_add_to_total > 0
                    ? formatCurrency(kfsData.fees.total_add_to_total)
                    : 'N/A'}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2">7</td>
                <td className="border border-black p-2">Net disbursed amount (1-6) (in Rupees)</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.calculations.disbursed_amount)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">8</td>
                <td className="border border-black p-2">Total amount to be paid by the borrower (sum of 1 and 5) (in Rupees)</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.calculations.total_repayable)}</td>
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
                <td className="border border-black p-2">{formatDate(kfsData.repayment.first_due_date)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PAGE 4 - ANNEX C & PART B */}
        <div className="p-8 page-break-before">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold mb-2">{kfsData.company.name}</h1>
            <p className="text-xs">CIN: {kfsData.company.cin} | RBI Registration no: {kfsData.company.rbi_registration}</p>
            <p className="text-xs">{kfsData.company.address}</p>
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
                <th className="border border-black p-2 bg-gray-100">Interest (in Rupees)</th>
                <th className="border border-black p-2 bg-gray-100">Instalment (in Rupees)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 text-center">1</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.loan.sanctioned_amount)}</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.loan.sanctioned_amount)}</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.calculations.interest)}</td>
                <td className="border border-black p-2">{formatCurrency(kfsData.loan.sanctioned_amount + kfsData.calculations.interest)}</td>
              </tr>
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

      </div>
    </div>
  );
}
