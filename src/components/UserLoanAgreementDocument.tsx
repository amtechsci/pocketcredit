import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Loader2, AlertCircle } from 'lucide-react';
import { SharedLoanAgreementDocument } from './shared/SharedLoanAgreementDocument';

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
  onLoaded?: () => void;
}

export function UserLoanAgreementDocument({ loanId, onLoaded }: UserLoanAgreementDocumentProps) {
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
      setError(null);
      const response = await apiService.getKFS(loanId);
      if (response.success && response.data) {
        setAgreementData(response.data);
        // Notify parent that agreement is loaded
        if (onLoaded) {
          onLoaded();
        }
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

  return <SharedLoanAgreementDocument agreementData={agreementData} loanId={loanId} />;
}
