import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const KYCCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const [status, setStatus] = useState<'checking' | 'verified' | 'failed'>('checking');

  useEffect(() => {
    if (!applicationId) {
      toast.error('Application ID is missing');
      navigate('/dashboard');
      return;
    }

    const checkKYCStatus = async () => {
      try {
        console.log('🔍 Checking KYC status for application:', applicationId);
        
        // Fetch actual KYC status from database
        const response = await apiService.request('GET', `/digilocker/kyc-status/${applicationId}`, {});

        console.log('📊 KYC Status Response:', response);

        if (response.success && response.data) {
          const kycStatus = response.data.kyc_status;

          if (kycStatus === 'verified') {
            try {
              // Try to fetch full KYC details once using stored transactionId
              const txn = response.data?.verification_data?.transactionId;
              if (txn) {
                await apiService.digilockerGetDetails(txn);
                // Optionally also fetch docs (PDF/XML links)
                await apiService.digilockerListDocs(txn);
              }
            } catch (e) {
              console.warn('KYC details/docs fetch warning:', e);
            }
            setStatus('verified');
            toast.success('KYC verification successful!');
            
            // Wait 2 seconds then proceed to employment details
            setTimeout(() => {
              navigate('/loan-application/employment-details', {
                state: { applicationId }
              });
            }, 2000);
          } else if (kycStatus === 'failed') {
            setStatus('failed');
            toast.error('KYC verification failed');
            
            // Wait 2 seconds then go back to KYC page
            setTimeout(() => {
              navigate('/loan-application/kyc-verification', {
                state: { applicationId }
              });
            }, 2000);
          } else if (kycStatus === 'pending') {
            // Still pending, wait and check again
            setTimeout(() => {
              checkKYCStatus();
            }, 2000);
          }
        } else {
          throw new Error('Failed to fetch KYC status');
        }
      } catch (error: any) {
        console.error('KYC status check error:', error);
        toast.error('Failed to verify KYC status');
        
        // Redirect back to KYC page after error
        setTimeout(() => {
          navigate('/loan-application/kyc-verification', {
            state: { applicationId }
          });
        }, 3000);
      }
    };

    checkKYCStatus();
  }, [applicationId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Verifying KYC Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'checking' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-16 h-16 mx-auto text-blue-600 animate-spin" />
              <p className="text-lg font-medium">Checking your KYC verification status...</p>
              <p className="text-sm text-gray-600">Please wait while we verify your details</p>
            </div>
          )}

          {status === 'verified' && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 mx-auto text-green-600" />
              <p className="text-lg font-medium text-green-900">KYC Verified Successfully!</p>
              <p className="text-sm text-gray-600">Redirecting to employment details...</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-red-600" />
              <p className="text-lg font-medium text-red-900">KYC Verification Failed</p>
              <p className="text-sm text-gray-600">Redirecting back to try again...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KYCCheckPage;

