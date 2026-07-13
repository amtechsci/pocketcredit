import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

function isEmploymentVerifiedResponse(response: any): boolean {
  const data = response?.data;
  return response?.success === true && data?.verified === true;
}

function needsEmploymentVerificationResponse(response: any): boolean {
  if (!response) return false;
  if (response.employment_verification_required === true) return true;
  if (response.response?.employment_verification_required === true) return true;
  const message =
    typeof response.message === 'string'
      ? response.message
      : typeof response.response?.message === 'string'
        ? response.response.message
        : '';
  return (
    response.status === 'error' &&
    message.toLowerCase().includes('employment verification')
  );
}

export const CreditAnalyticsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationIdParam = searchParams.get('applicationId');

  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [performingCheck, setPerformingCheck] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [redirectingToEmployment, setRedirectingToEmployment] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditMobile, setCreditMobile] = useState('');
  const [creditPan, setCreditPan] = useState('');

  const redirectToEmploymentVerification = (appId?: string | null) => {
    setRedirectingToEmployment(true);
    const id = appId || applicationIdParam;
    const route = id
      ? `/loan-application/employment-verification?applicationId=${id}`
      : '/loan-application/employment-verification';
    navigate(route, { replace: true });
  };

  const processCreditCheckResponse = (checkResponse: any) => {
    if (needsEmploymentVerificationResponse(checkResponse)) {
      toast.info('Please complete employment verification first');
      redirectToEmploymentVerification(applicationIdParam);
      return false;
    }

    if (checkResponse.status !== 'success') {
      toast.error(checkResponse.message || 'Failed to perform credit check');
      setCreditData(null);
      setDataFetched(true);
      setShowCreditForm(true);
      return false;
    }

    const isEligible =
      checkResponse.data?.is_eligible === true ||
      (typeof checkResponse.data?.is_eligible === 'number' && checkResponse.data?.is_eligible === 1);
    const onHold =
      checkResponse.data?.on_hold === true ||
      (typeof checkResponse.data?.on_hold === 'number' && checkResponse.data?.on_hold === 1);

    if (onHold || !isEligible) {
      const holdReason = checkResponse.data?.hold_reason || 'Application held due to credit evaluation';
      const breReasons = checkResponse.data?.bre_evaluation?.reasons || [];
      toast.error(holdReason);
      if (breReasons.length > 0) {
        setTimeout(() => {
          toast.error(`BRE Rejection Reasons: ${breReasons.join(', ')}`, { duration: 10000 });
        }, 2000);
      }
      setTimeout(() => navigate('/hold-status', { replace: true }), 3000);
      return false;
    }

    setCreditData({
      credit_score: checkResponse.data.credit_score,
      is_eligible: isEligible,
      completed: true,
      checked_at: new Date().toISOString(),
      ...checkResponse.data
    });
    setDataFetched(true);
    setShowCreditForm(false);
    return true;
  };

  const handleRunCreditCheck = async () => {
    const mobile = creditMobile.trim();
    const pan = creditPan.trim().toUpperCase();

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit Aadhaar-linked mobile number');
      return;
    }
    if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      toast.error('Please enter a valid PAN number');
      return;
    }

    setPerformingCheck(true);
    try {
      const checkResponse = await apiService.performCreditCheck({
        mobile_no: mobile,
        pan
      });
      processCreditCheckResponse(checkResponse);
    } catch (checkError: any) {
      const errPayload = checkError?.response?.data ?? checkError;
      if (needsEmploymentVerificationResponse(errPayload)) {
        toast.info('Please complete employment verification first');
        redirectToEmploymentVerification(applicationIdParam);
        return;
      }
      toast.error(checkError.message || 'Failed to perform credit check');
      setCreditData(null);
      setDataFetched(true);
      setShowCreditForm(true);
    } finally {
      setPerformingCheck(false);
    }
  };

  useEffect(() => {
    const initializeCreditCheck = async () => {
      try {
        const evStatus = await apiService.getEmploymentVerificationStatus(
          applicationIdParam || undefined,
          { cache: false, skipDeduplication: true }
        );
        if (!isEmploymentVerifiedResponse(evStatus)) {
          toast.info('Please complete employment verification first');
          redirectToEmploymentVerification(applicationIdParam);
          return;
        }
      } catch (error) {
        redirectToEmploymentVerification(applicationIdParam);
        return;
      }

      try {
        setLoading(true);
        const response = await apiService.getCreditAnalyticsData();
        if (response.status === 'success' && response.data) {
          setCreditData(response.data);
          setDataFetched(true);
        } else {
          const profile = await apiService.getUserProfile();
          const user = profile.data?.user;
          setCreditMobile(user?.aadhar_linked_mobile || '');
          setCreditPan((user?.pan_number || '').toUpperCase());
          setShowCreditForm(true);
          setDataFetched(false);
        }
      } catch (error: any) {
        console.error('Error fetching credit analytics:', error);
        try {
          const profile = await apiService.getUserProfile();
          const user = profile.data?.user;
          setCreditMobile(user?.aadhar_linked_mobile || '');
          setCreditPan((user?.pan_number || '').toUpperCase());
          setShowCreditForm(true);
        } catch {
          setShowCreditForm(true);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeCreditCheck();
  }, [applicationIdParam, navigate]);

  useEffect(() => {
    if (!creditData || loading || performingCheck) {
      return;
    }

    const creditScore = creditData.credit_score;
    const score = typeof creditScore === 'number' ? creditScore : parseInt(String(creditScore)) || 0;

    if (score > 450) {
      const eligibleScore = score;
      setRedirectCountdown(5);

      let countdownTimer: NodeJS.Timeout | null = null;
      const delayTimer = setTimeout(() => {
        let countdown = 5;
        countdownTimer = setInterval(() => {
          countdown -= 1;
          setRedirectCountdown(countdown);
          if (countdown <= 0) {
            if (countdownTimer) clearInterval(countdownTimer);
            setRedirectCountdown(null);
          }
        }, 1000);

        setTimeout(async () => {
          if (countdownTimer) clearInterval(countdownTimer);
          setRedirectCountdown(null);

          const urlParams = new URLSearchParams(window.location.search);
          const appIdParam = urlParams.get('applicationId');
          const applicationId = appIdParam ? parseInt(appIdParam) : null;

          apiService.clearCache('/credit-analytics/data');
          apiService.clearCache('/credit-analytics/check');

          try {
            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
            const progress = await getOnboardingProgress(applicationId, true);
            const nextRoute = getStepRoute(progress.currentStep, applicationId);

            if (progress.currentStep === 'credit-analytics' && eligibleScore > 450) {
              const directRoute = applicationId
                ? `/loan-application/employment-details?applicationId=${applicationId}`
                : '/loan-application/employment-details';
              navigate(directRoute, { replace: true });
            } else {
              navigate(nextRoute, { replace: true });
            }
          } catch {
            const fallbackRoute = applicationId
              ? `/loan-application/employment-details?applicationId=${applicationId}`
              : '/loan-application/employment-details';
            navigate(fallbackRoute, { replace: true });
          }
        }, 5000);
      }, 1000);

      return () => clearTimeout(delayTimer);
    }

    const timer = setTimeout(() => navigate('/hold-status', { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [creditData, loading, performingCheck, navigate]);

  const handleContinue = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const appIdParam = urlParams.get('applicationId');
    const applicationId = appIdParam ? parseInt(appIdParam) : null;

    apiService.clearCache('/credit-analytics/data');
    apiService.clearCache('/credit-analytics/check');

    try {
      const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
      const progress = await getOnboardingProgress(applicationId, true);
      const nextRoute = getStepRoute(progress.currentStep, applicationId);
      const creditScore = creditData?.credit_score;
      const score = typeof creditScore === 'number' ? creditScore : parseInt(String(creditScore)) || 0;
      if (progress.currentStep === 'credit-analytics' && score > 450) {
        const directRoute = applicationId
          ? `/loan-application/employment-details?applicationId=${applicationId}`
          : '/loan-application/employment-details';
        navigate(directRoute, { replace: true });
      } else {
        navigate(nextRoute, { replace: true });
      }
    } catch {
      const fallbackRoute = applicationId
        ? `/loan-application/employment-details?applicationId=${applicationId}`
        : '/loan-application/employment-details';
      navigate(fallbackRoute, { replace: true });
    }
  };

  if (loading || performingCheck || redirectingToEmployment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {redirectingToEmployment ? 'Employment Verification Required' : 'Credit Analytics'}
            </h2>
            <p className="text-gray-600 text-lg">
              {redirectingToEmployment
                ? 'Redirecting to employment verification...'
                : 'Checking credit...'}
            </p>
            {!redirectingToEmployment && (
              <p className="text-sm text-gray-500 mt-2">This may take 10-15 seconds</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (showCreditForm && !creditData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Credit Check</h2>
            <p className="text-gray-600">
              Verify your Aadhaar-linked mobile and PAN before fetching your Experian credit report.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="credit_mobile">Aadhaar-linked Mobile Number</Label>
              <Input
                id="credit_mobile"
                type="tel"
                value={creditMobile}
                onChange={(e) => setCreditMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="credit_pan">PAN Number</Label>
              <Input
                id="credit_pan"
                value={creditPan}
                onChange={(e) => setCreditPan(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="mt-1 uppercase"
              />
            </div>
            <Button onClick={handleRunCreditCheck} className="w-full">
              Run Credit Check
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!creditData && dataFetched) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-2xl">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Credit Check Unavailable</h2>
            <p className="text-gray-600 mb-6">
              We could not fetch your credit report right now. Please try again in a few minutes.
            </p>
            <Button variant="outline" onClick={() => setShowCreditForm(true)}>
              Try Again
            </Button>
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
              <p className="text-lg text-gray-700 mb-2">
                Your Experian Credit Score: <span className="font-bold">{score}</span>
              </p>
              {redirectCountdown !== null && redirectCountdown > 0 ? (
                <p className="text-gray-600 mb-4">
                  Redirecting to employment details in {redirectCountdown} seconds...
                </p>
              ) : (
                <p className="text-gray-600 mb-4">Preparing to redirect...</p>
              )}
              <Button onClick={handleContinue} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
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
              <p className="text-lg text-gray-700 mb-2">
                Your Experian Credit Score: <span className="font-bold">{score}</span>
              </p>
              <p className="text-gray-600 mb-6">Your credit score is below the required threshold (450).</p>
              <p className="text-sm text-gray-500">Redirecting to hold status...</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
