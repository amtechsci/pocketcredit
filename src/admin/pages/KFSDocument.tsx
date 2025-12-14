import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SharedKFSDocument } from '../../components/shared/SharedKFSDocument';

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

      {/* KFS Document - Now using shared component */}
      <div className="max-w-[210mm] mx-auto my-8 print:my-0 shadow-lg print:shadow-none">
        <SharedKFSDocument kfsData={kfsData} />
      </div>
    </div>
  );
}
