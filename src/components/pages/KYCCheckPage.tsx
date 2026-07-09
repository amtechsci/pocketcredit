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

        const response = await apiService.request('GET', `/digilocker/kyc-status/${applicationId}`, {});

        console.log('📊 KYC Status Response:', response);

        if (response.success && response.data) {
          const kycStatus = response.data.kyc_status;

          if (kycStatus === 'verified') {
            // Webhook already fetches and persists KYC docs — skip redundant get-details/list-docs
            toast.success('KYC verification successful!');
            navigate(`/loan-application/employment-verification?applicationId=${applicationId}`, {
              replace: true
            });
            return;
          } else if (kycStatus === 'failed') {
            setStatus('failed');
            toast.error('KYC verification failed');

            setTimeout(() => {
              navigate('/loan-application/kyc-verification', {
                state: { applicationId }
              });
            }, 2000);
          } else if (kycStatus === 'pending') {
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
              <p className="text-sm text-gray-600">Redirecting to employment verification...</p>
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
