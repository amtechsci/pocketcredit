import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export const CreditAnalyticsPage = () => {
  const navigate = useNavigate();
  
  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [performingCheck, setPerformingCheck] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);

  // Auto-fetch credit analytics data on mount, and if no data exists, auto-perform credit check
  useEffect(() => {
    const initializeCreditCheck = async () => {
      // First, try to fetch existing credit data
      try {
        setLoading(true);
        const response = await apiService.getCreditAnalyticsData();
        if (response.status === 'success' && response.data) {
          // Data exists, use it
          setCreditData(response.data);
          setDataFetched(true);
          setLoading(false);
        } else {
          // No data exists, auto-perform credit check
          setDataFetched(false);
          setPerformingCheck(true);
          try {
            const checkResponse = await apiService.performCreditCheck();
            if (checkResponse.status === 'success') {
              // Check if user is on hold due to BRE conditions
              if (checkResponse.data?.on_hold) {
                const holdReason = checkResponse.data.hold_reason || 'Application held due to credit evaluation';
                const breReasons = checkResponse.data.bre_evaluation?.reasons || [];
                
                toast.error(holdReason);
                
                // Show detailed BRE rejection reasons
                if (breReasons.length > 0) {
                  setTimeout(() => {
                    toast.error(`BRE Rejection Reasons: ${breReasons.join(', ')}`, { duration: 10000 });
                  }, 2000);
                }
                
                // Redirect to hold status page
                setTimeout(() => {
                  navigate('/hold-status', { replace: true });
                }, 3000);
                return;
              }
              
              // Fetch the newly created credit data
              const dataResponse = await apiService.getCreditAnalyticsData();
              if (dataResponse.status === 'success' && dataResponse.data) {
                setCreditData(dataResponse.data);
                setDataFetched(true);
              } else {
                setCreditData(null);
                setDataFetched(true);
              }
            } else {
              toast.error(checkResponse.message || 'Failed to perform credit check');
              setCreditData(null);
              setDataFetched(true);
            }
          } catch (checkError: any) {
            console.error('Error performing credit check:', checkError);
            toast.error(checkError.message || 'Failed to perform credit check');
            setCreditData(null);
            setDataFetched(true);
          } finally {
            setPerformingCheck(false);
            setLoading(false);
          }
        }
      } catch (error: any) {
        console.error('Error fetching credit analytics:', error);
        setCreditData(null);
        setDataFetched(true);
        setLoading(false);
      }
    };

    initializeCreditCheck();
  }, []);

  // Handle redirect based on credit score
  useEffect(() => {
    if (!creditData || loading || performingCheck) return;

    const creditScore = creditData.credit_score;
    const score = typeof creditScore === 'number' ? creditScore : parseInt(creditScore) || 0;

    // If score > 580: Eligible, redirect to employment-details after 5 seconds
    // Add a small delay to ensure backend has updated the loan application step
    if (score > 580) {
      // Wait 1 second for backend to update step, then start 5-second countdown (total 6 seconds)
      let redirectTimer: NodeJS.Timeout;
      const delayTimer = setTimeout(() => {
        redirectTimer = setTimeout(() => {
          navigate('/loan-application/employment-details', { replace: true });
        }, 5000);
      }, 1000);

      return () => {
        clearTimeout(delayTimer);
        if (redirectTimer) clearTimeout(redirectTimer);
      };
    } else {
      // If score <= 580: Not eligible, user should be on hold, redirect to hold-status
      // Backend should have already set user to on_hold
      const timer = setTimeout(() => {
        navigate('/hold-status', { replace: true });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [creditData, loading, performingCheck, navigate]);

  // Show loading/checking state
  if (loading || performingCheck) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Credit Analytics</h2>
            <p className="text-gray-600 text-lg">Checking credit...</p>
            <p className="text-sm text-gray-500 mt-2">This may take 10-15 seconds</p>
          </div>
        </Card>
      </div>
    );
  }

  // If no data after checking, show error state
  if (!creditData && dataFetched) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-2xl">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Credit Check Failed</h2>
            <p className="text-gray-600 mb-6">Unable to fetch your credit report. Please try again later.</p>
            <p className="text-sm text-gray-500">Redirecting to hold status...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!creditData) return null;

  const creditScore = creditData.credit_score;
  const score = typeof creditScore === 'number' ? creditScore : parseInt(creditScore) || 0;
  const isEligible = score > 580;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="p-8 w-full max-w-2xl">
        <div className="text-center">
          {isEligible ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-green-600 mb-4">You are Eligible</h2>
              <p className="text-lg text-gray-700 mb-2">Your Experian Credit Score: <span className="font-bold">{score}</span></p>
              <p className="text-gray-600 mb-6">Redirecting to employment details in 5 seconds...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full transition-all duration-5000"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-red-600 mb-4">Not Eligible</h2>
              <p className="text-lg text-gray-700 mb-2">Your Experian Credit Score: <span className="font-bold">{score}</span></p>
              <p className="text-gray-600 mb-6">Your credit score is below the required threshold (580).</p>
              <p className="text-sm text-gray-500">Redirecting to hold status...</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
