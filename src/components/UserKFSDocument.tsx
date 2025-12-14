import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Loader2, AlertCircle } from 'lucide-react';
import { SharedKFSDocument } from './shared/SharedKFSDocument';

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

interface UserKFSDocumentProps {
  loanId: number;
}

export function UserKFSDocument({ loanId }: UserKFSDocumentProps) {
  const [kfsData, setKfsData] = useState<KFSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loanId) {
      fetchKFSData();
    }
  }, [loanId]);

  const fetchKFSData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getKFS(loanId);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading KFS...</p>
        </div>
      </div>
    );
  }

  if (error || !kfsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error || 'KFS data not found'}</p>
        </div>
      </div>
    );
  }

  return <SharedKFSDocument kfsData={kfsData} />;
}
