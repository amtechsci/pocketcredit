import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SharedExtensionLetterDocument } from '../../components/shared/SharedExtensionLetterDocument';

interface ExtensionLetterData {
  company: any;
  loan: any;
  borrower: any;
  extension: {
    extension_number: number;
    extension_availed_date: string;
    extension_period_till: string;
    extension_fee: number;
    interest_till_date: number;
    penalty: number;
    total_amount: number;
    original_due_date: string;
    new_due_date: string;
  };
  generated_at: string;
}

export function ExtensionLetterDocument() {
  const { loanId } = useParams<{ loanId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [extensionData, setExtensionData] = useState<ExtensionLetterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const transactionId = searchParams.get('transactionId');
  const extensionNumber = searchParams.get('extensionNumber');

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
      fetchExtensionLetterData();
    }
  }, [loanId, transactionId, extensionNumber]);

  const fetchExtensionLetterData = async () => {
    try {
      setLoading(true);
      
      if (!loanId) {
        setError('Loan ID is required');
        return;
      }
      
      // Clean loanId - remove any ':' prefix that might be in the route parameter
      const cleanLoanId = loanId.replace(/^:/, '');
      const loanIdNum = parseInt(cleanLoanId);
      
      if (!loanIdNum || isNaN(loanIdNum)) {
        setError(`Invalid loan ID: ${loanId}`);
        return;
      }
      
      const response = await adminApiService.getExtensionLetter(
        loanIdNum,
        transactionId ? parseInt(transactionId) : undefined,
        extensionNumber ? parseInt(extensionNumber) : undefined
      );
      if (response.success && response.data) {
        setExtensionData(response.data);
      } else {
        setError('Failed to load Extension Letter data');
      }
    } catch (err: any) {
      console.error('Error fetching Extension Letter:', err);
      setError(err.message || 'Failed to load Extension Letter');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const extensionElement = document.querySelector('.extension-letter-content');
      if (!extensionElement) {
        alert('Extension Letter content not found');
        return;
      }

      if (!loanId) {
        alert('Loan ID is required');
        return;
      }
      
      // Clean loanId - remove any ':' prefix
      const cleanLoanId = loanId.replace(/^:/, '');
      const loanIdNum = parseInt(cleanLoanId);
      
      if (!loanIdNum || isNaN(loanIdNum)) {
        alert(`Invalid loan ID: ${loanId}`);
        return;
      }

      const htmlContent = extensionElement.outerHTML;
      const pdfBlob = await adminApiService.generateExtensionLetterPDF(
        loanIdNum,
        htmlContent,
        transactionId ? parseInt(transactionId) : undefined,
        extensionNumber ? parseInt(extensionNumber) : undefined
      );

      const ordinals = ['', '1st', '2nd', '3rd', '4th'];
      const extNum = extensionData?.extension.extension_number || 1;
      const filename = `Loan_Tenure_Extension_${ordinals[extNum] || extNum}_${extensionData?.loan.application_number || loanId}.pdf`;

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
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
        `Send Extension Letter PDF to ${extensionData?.borrower.email}?\n\nThe borrower will receive an email with the Extension Letter document attached.`
      );

      if (!confirmed) return;

      setEmailing(true);

      const extensionElement = document.querySelector('.extension-letter-content');
      if (!extensionElement) {
        alert('Extension Letter content not found');
        return;
      }

      const htmlContent = extensionElement.outerHTML;

      // Note: Email functionality can be added later if needed
      alert('Email functionality for Extension Letter will be available soon.');

    } catch (error: any) {
      console.error('Error emailing PDF:', error);
      alert('Failed to send email: ' + (error.message || 'Unknown error'));
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Extension Letter...</p>
        </div>
      </div>
    );
  }

  if (error || !extensionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Extension Letter data not found'}</p>
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

      {/* Extension Letter Document */}
      <div className="extension-letter-content max-w-[210mm] mx-auto my-8 print:my-0 shadow-lg print:shadow-none">
        <SharedExtensionLetterDocument extensionData={extensionData} />
      </div>
    </div>
  );
}

