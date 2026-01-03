import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const BankStatementSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsCompletion, setNeedsCompletion] = useState(false);
  const [digitapUrl, setDigitapUrl] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    checkBankStatementStatus();
  }, []);

  useEffect(() => {
    if (redirecting) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [redirecting, navigate]);

  const checkBankStatementStatus = async () => {
    try {
      // First, check URL parameters for cancellation/error indicators
      const urlParams = new URLSearchParams(location.search);
      const urlError = urlParams.get('error');
      const urlStatus = urlParams.get('status');
      const urlSuccess = urlParams.get('success');
      
      // Check if user cancelled or there was an error
      if (urlError === 'true' || urlStatus === 'failed' || urlStatus === 'cancelled' || urlStatus === 'Failure' || urlSuccess === 'false') {
        setChecking(false);
        toast.error('Bank statement upload was cancelled or failed. Please try again.');
        setTimeout(() => {
          navigate('/loan-application/bank-statement', { replace: true });
        }, 2000);
        return;
      }

      const response = await apiService.getUserBankStatementStatus();
      
      if (!response.success || !response.data) {
        setChecking(false);
        return;
      }

      const { status, digitapUrl: savedUrl, expiresAt, reportJustFetched, hasReport } = response.data as any;
      
      // Check if status indicates failure or cancellation
      if (status === 'failed' || status === 'cancelled' || status === 'Failure' || status === 'Failed') {
        setChecking(false);
        toast.error('Bank statement upload was cancelled or failed. Please try again.');
        setTimeout(() => {
          navigate('/loan-application/bank-statement', { replace: true });
        }, 2000);
        return;
      }
      
      // If report was just fetched, show success message
      if (reportJustFetched && hasReport) {
        toast.success('Bank statement report fetched successfully!');
      }

      // Check if transaction is InProgress (user didn't complete)
      if (status === 'InProgress' || status === 'pending') {
        // Check if URL expired
        if (expiresAt && new Date(expiresAt) < new Date()) {
          toast.error('Session expired. Please start again.');
          setTimeout(() => navigate('/loan-application/bank-statement', { replace: true }), 2000);
          return;
        }

        // URL not expired, user needs to complete
        if (savedUrl) {
          setNeedsCompletion(true);
          setDigitapUrl(savedUrl);
          setChecking(false);
          toast.warning('Please complete the bank statement upload process');
          return;
        }
      }

      // Transaction completed
      if (status === 'completed') {
        toast.success('Bank statement submitted successfully!');
        setChecking(false);
        
        // Check if e-NACH is already registered
        try {
          const enachStatusResponse = await apiService.getEnachStatus();
          if (enachStatusResponse.success && enachStatusResponse.data?.registered) {
            // e-NACH already registered, skip to email verification
            setTimeout(() => {
              navigate('/email-verification');
            }, 1500);
            return;
          }
        } catch (enachError) {
          console.error('Error checking e-NACH status:', enachError);
          // Continue to e-NACH page if check fails
        }
        
        // Get active loan application ID before redirecting
        try {
          const applicationsResponse = await apiService.getLoanApplications();
          const isSuccess = applicationsResponse.success || applicationsResponse.status === 'success';
          if (isSuccess && applicationsResponse.data?.applications) {
            const applications = applicationsResponse.data.applications;
            const activeApplication = applications.find((app: any) => 
              ['submitted', 'under_review', 'follow_up', 'disbursal'].includes(app.status)
            );
            
            if (activeApplication) {
              // Redirect to link salary bank account
              setTimeout(() => {
                navigate('/link-salary-bank-account');
              }, 1500);
              return;
            }
          }
        } catch (appError) {
          console.error('Error fetching loan applications:', appError);
        }
        
        // Fallback: Redirect without application ID (page will fetch it)
        setTimeout(() => {
          navigate('/link-salary-bank-account');
        }, 1500);
      } else {
        // Still processing or unknown state - DON'T redirect to next step
        // Only redirect if status is explicitly "completed"
        setChecking(false);
        
        // If status is InProgress or pending, show completion message
        if (status === 'InProgress' || status === 'pending') {
          toast.info('Your bank statement upload is in progress. Please complete the process.');
          // Don't redirect - let user go back to complete
          return;
        }
        
        // For any other unknown status, don't assume success - redirect back to bank statement page
        toast.warning('Unable to determine bank statement status. Please try again.');
        setTimeout(() => {
          navigate('/loan-application/bank-statement', { replace: true });
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setChecking(false);
      
      // On error, don't assume success - redirect back to bank statement page
      toast.error('Unable to verify bank statement status. Please try again.');
      setTimeout(() => {
        navigate('/loan-application/bank-statement', { replace: true });
      }, 2000);
    }
  };

  // Show loading while checking
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Checking bank statement status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show completion required message
  if (needsCompletion && digitapUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-yellow-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-gray-900">
              Complete Bank Statement Upload
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Info Message */}
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Your bank statement upload process is not yet complete.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please click the button below to return to the upload page and complete the process
                </p>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => window.location.href = digitapUrl}
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
            >
              Continue to Bank Statement Upload
            </Button>

            <div className="text-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Skip for now, go to dashboard
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success message
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-900">
            Bank Statement Submitted
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Success Message */}
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Your bank statement has been submitted successfully and is being analyzed.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✓ We will notify you once the analysis is complete
              </p>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Your bank statement is being processed</li>
              <li>• Analysis typically takes 2-5 minutes</li>
              <li>• You can start applying for loans once complete</li>
            </ul>
          </div>

          {/* Redirect Message */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting to dashboard...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankStatementSuccessPage;


