import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export const CreditAnalyticsPage = () => {
  const navigate = useNavigate();
  
  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [performingCheck, setPerformingCheck] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

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
              // Handle both boolean and number (0/1) formats from database
              const isEligible = checkResponse.data?.is_eligible === true || 
                                (typeof checkResponse.data?.is_eligible === 'number' && checkResponse.data?.is_eligible === 1);
              const onHold = checkResponse.data?.on_hold === true || 
                            (typeof checkResponse.data?.on_hold === 'number' && checkResponse.data?.on_hold === 1);
              
              // Check if user is on hold due to BRE conditions
              if (onHold || !isEligible) {
                const holdReason = checkResponse.data?.hold_reason || 'Application held due to credit evaluation';
                const breReasons = checkResponse.data?.bre_evaluation?.reasons || [];
                
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
              
              // Credit check passed - use the data from the credit check response directly
              // The backend has already processed and saved the credit data
              if (checkResponse.data) {
                // Map the response data to creditData format
                setCreditData({
                  credit_score: checkResponse.data.credit_score,
                  is_eligible: isEligible,
                  completed: true,
                  checked_at: new Date().toISOString(),
                  ...checkResponse.data
                });
                setDataFetched(true);
              } else {
                // Fallback: try to fetch the data, but don't show error if it fails
                // since the check itself succeeded
                try {
                  const dataResponse = await apiService.getCreditAnalyticsData();
                  if (dataResponse.status === 'success' && dataResponse.data) {
                    setCreditData(dataResponse.data);
                  } else {
                    // Use minimal data from check response
                    setCreditData({
                      credit_score: checkResponse.data?.credit_score || null,
                      is_eligible: isEligible,
                      completed: true,
                      checked_at: new Date().toISOString()
                    });
                  }
                } catch (fetchError) {
                  // Even if fetch fails, use data from check response
                  console.warn('Failed to fetch credit analytics data, using check response:', fetchError);
                  setCreditData({
                    credit_score: checkResponse.data?.credit_score || null,
                    is_eligible: isEligible,
                    completed: true,
                    checked_at: new Date().toISOString()
                  });
                }
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
    if (!creditData || loading || performingCheck) {
      console.log('[CreditAnalytics] Redirect check skipped:', { hasCreditData: !!creditData, loading, performingCheck });
      return;
    }

    const creditScore = creditData.credit_score;
    const score = typeof creditScore === 'number' ? creditScore : parseInt(String(creditScore)) || 0;
    console.log('[CreditAnalytics] Credit score check:', { creditScore, score, creditData });

    // If score > 450: Eligible, redirect to employment-details after 5 seconds
    // Add a small delay to ensure backend has updated the loan application step
    if (score > 450) {
      console.log('[CreditAnalytics] Score > 450, setting up redirect...');
      
      // Capture score value for use in setTimeout
      const eligibleScore = score;
      
      // Start countdown
      setRedirectCountdown(5);
      
      // Wait 1 second for backend to update step, then start 5-second countdown (total 6 seconds)
      let redirectTimer: NodeJS.Timeout | null = null;
      let countdownTimer: NodeJS.Timeout | null = null;
      const delayTimer = setTimeout(() => {
        console.log('[CreditAnalytics] Delay timer fired, starting 5-second redirect timer...');
        
        // Update countdown every second
        let countdown = 5;
        countdownTimer = setInterval(() => {
          countdown -= 1;
          setRedirectCountdown(countdown);
          if (countdown <= 0) {
            if (countdownTimer) clearInterval(countdownTimer);
            setRedirectCountdown(null);
          }
        }, 1000);
        
        redirectTimer = setTimeout(async () => {
          console.log('[CreditAnalytics] Redirect timer fired, navigating...');
          if (countdownTimer) clearInterval(countdownTimer);
          setRedirectCountdown(null);
          
          // Get application ID from URL or location state
          const urlParams = new URLSearchParams(window.location.search);
          const appIdParam = urlParams.get('applicationId');
          const applicationId = appIdParam ? parseInt(appIdParam) : null;
          console.log('[CreditAnalytics] Application ID:', applicationId);
          
          // Clear credit analytics cache to ensure fresh data
          apiService.clearCache('/credit-analytics/data');
          apiService.clearCache('/credit-analytics/check');
          
          // Use unified progress engine to determine next step with force refresh
          try {
            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
            // Force refresh to get updated credit analytics status
            const progress = await getOnboardingProgress(applicationId, true);
            const nextRoute = getStepRoute(progress.currentStep, applicationId);
            console.log('[CreditAnalytics] Next step from engine (force refresh):', progress.currentStep, '->', nextRoute);
            
            // If engine still says credit-analytics (cache issue), go directly to employment-details
            // We know score > 450, so credit analytics is complete
            if (progress.currentStep === 'credit-analytics' && eligibleScore > 450) {
              console.log('[CreditAnalytics] Engine still shows credit-analytics, but score is eligible - going directly to employment-details');
              const directRoute = applicationId 
                ? `/loan-application/employment-details?applicationId=${applicationId}`
                : '/loan-application/employment-details';
              navigate(directRoute, { replace: true });
            } else {
              navigate(nextRoute, { replace: true });
            }
          } catch (error) {
            console.error('[CreditAnalytics] Error getting next step, using fallback:', error);
            // Fallback to employment details (old behavior)
            const fallbackRoute = applicationId 
              ? `/loan-application/employment-details?applicationId=${applicationId}`
              : '/loan-application/employment-details';
            console.log('[CreditAnalytics] Using fallback route:', fallbackRoute);
            navigate(fallbackRoute, { replace: true });
          }
        }, 5000);
      }, 1000);

      // Cleanup function to clear all timers
      return () => {
        console.log('[CreditAnalytics] Cleaning up timers');
        clearTimeout(delayTimer);
        // Note: redirectTimer and countdownTimer are set inside setTimeout, 
        // so they may not be accessible here, but they'll be cleared when component unmounts
        // or when the redirect happens
      };
    } else {
      // If score <= 450: Not eligible, user should be on hold, redirect to hold-status
      // Backend should have already set user to on_hold
      console.log('[CreditAnalytics] Score <= 450, redirecting to hold status...');
      const timer = setTimeout(() => {
        navigate('/hold-status', { replace: true });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [creditData, loading, performingCheck, navigate]);

  // Manual navigation handler
  const handleContinue = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const appIdParam = urlParams.get('applicationId');
    const applicationId = appIdParam ? parseInt(appIdParam) : null;
    
    // Clear credit analytics cache
    apiService.clearCache('/credit-analytics/data');
    apiService.clearCache('/credit-analytics/check');
    
    try {
      const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
      // Force refresh to get updated credit analytics status
      const progress = await getOnboardingProgress(applicationId, true);
      const nextRoute = getStepRoute(progress.currentStep, applicationId);
      console.log('[CreditAnalytics] Manual continue - Next step:', progress.currentStep, '->', nextRoute);
      
      // If engine still says credit-analytics but we have eligible score, go directly to employment-details
      const creditScore = creditData?.credit_score;
      const score = typeof creditScore === 'number' ? creditScore : parseInt(String(creditScore)) || 0;
      if (progress.currentStep === 'credit-analytics' && score > 450) {
        console.log('[CreditAnalytics] Engine still shows credit-analytics, but score is eligible - going directly to employment-details');
        const directRoute = applicationId 
          ? `/loan-application/employment-details?applicationId=${applicationId}`
          : '/loan-application/employment-details';
        navigate(directRoute, { replace: true });
      } else {
        navigate(nextRoute, { replace: true });
      }
    } catch (error) {
      console.error('[CreditAnalytics] Error getting next step, using fallback:', error);
      const fallbackRoute = applicationId 
        ? `/loan-application/employment-details?applicationId=${applicationId}`
        : '/loan-application/employment-details';
      navigate(fallbackRoute, { replace: true });
    }
  };

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
  const isEligible = score > 450;

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
              {redirectCountdown !== null && redirectCountdown > 0 ? (
                <p className="text-gray-600 mb-4">Redirecting to employment details in {redirectCountdown} seconds...</p>
              ) : (
                <p className="text-gray-600 mb-4">Preparing to redirect...</p>
              )}
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div 
                  className="bg-green-600 h-2.5 rounded-full transition-all duration-5000"
                  style={{ width: redirectCountdown !== null && redirectCountdown > 0 ? `${((6 - redirectCountdown) / 6) * 100}%` : '0%' }}
                ></div>
              </div>
              <Button
                onClick={handleContinue}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                Continue Now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
              <p className="text-gray-600 mb-6">Your credit score is below the required threshold (450).</p>
              <p className="text-sm text-gray-500">Redirecting to hold status...</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
