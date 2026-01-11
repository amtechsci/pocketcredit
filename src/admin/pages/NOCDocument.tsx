import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SharedNOCDocument } from '../../components/shared/SharedNOCDocument';

interface NOCData {
  company: any;
  loan: any;
  borrower: any;
  generated_at: string;
}

export function NOCDocument() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const [nocData, setNocData] = useState<NOCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

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
      fetchNOCData();
    }
  }, [loanId]);

  const fetchNOCData = async () => {
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
      
      const response = await adminApiService.getNOC(loanIdNum);
      if (response.success && response.data) {
        setNocData(response.data);
      } else {
        setError('Failed to load NOC data');
      }
    } catch (err: any) {
      console.error('Error fetching NOC:', err);
      setError(err.message || 'Failed to load NOC');
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

      const nocElement = document.querySelector('.noc-document-content');
      if (!nocElement) {
        alert('NOC content not found');
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

      const htmlContent = nocElement.outerHTML;
      const pdfBlob = await adminApiService.generateNOCPDF(loanIdNum, htmlContent);

      const filename = `No_Dues_Certificate_${nocData?.loan.application_number || loanId}.pdf`;

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
        `Send NOC PDF to ${nocData?.borrower.email}?\n\nThe borrower will receive an email with the No Dues Certificate document attached.`
      );

      if (!confirmed) return;

      setEmailing(true);

      const nocElement = document.querySelector('.noc-document-content');
      if (!nocElement) {
        alert('NOC content not found');
        return;
      }

      const htmlContent = nocElement.outerHTML;

      // Note: Email functionality can be added later if needed
      alert('Email functionality for NOC will be available soon.');

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
          <p className="mt-4 text-gray-600">Loading No Dues Certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !nocData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'NOC data not found'}</p>
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

      {/* NOC Document */}
      <div className="noc-document-content max-w-[210mm] mx-auto my-8 print:my-0 shadow-lg print:shadow-none">
        <SharedNOCDocument nocData={nocData} />
      </div>
    </div>
  );
}

