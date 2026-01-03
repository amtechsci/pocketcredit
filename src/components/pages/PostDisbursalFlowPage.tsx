import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  Camera,
  Users,
  FileText,
  PenTool,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Building2,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { SelfieCaptureStep } from './SelfieCaptureStep';
import { EnhancedUserReferencesPage } from './EnhancedUserReferencesPage';
import { UserKFSDocument } from '../UserKFSDocument';
import { UserLoanAgreementDocument } from '../UserLoanAgreementDocument';

interface PostDisbursalProgress {
  enach_done: boolean;
  selfie_captured: boolean;
  selfie_verified: boolean;
  references_completed: boolean;
  kfs_viewed: boolean;
  agreement_signed: boolean;
  current_step: number;
}

const TOTAL_STEPS = 6;

export const PostDisbursalFlowPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // Start at 0 to detect if not set
  const [redirecting, setRedirecting] = useState(false);
  const [progress, setProgress] = useState<PostDisbursalProgress>({
    enach_done: false,
    selfie_captured: false,
    selfie_verified: false,
    references_completed: false,
    kfs_viewed: false,
    agreement_signed: false,
    current_step: 1
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    // Check for Digitap ClickWrap callback (success or error)
    const clickwrapStatus = searchParams.get('clickwrap');
    const successParam = searchParams.get('success');
    const transactionId = searchParams.get('transactionId');
    const errorCode = searchParams.get('error_code');
    const errorMsg = searchParams.get('errorMsg');
    
    if (clickwrapStatus === 'success' || successParam === 'true') {
      // User returned from successful signing
      console.log('✅ ClickWrap signing successful, transactionId:', transactionId);
      
      // Get applicationId from URL params if not already set
      const appIdFromUrl = searchParams.get('applicationId');
      const appId = applicationId || (appIdFromUrl ? parseInt(appIdFromUrl) : null);
      
      if (appId) {
        // Wait a moment for webhook to process, then check status
        setTimeout(async () => {
          try {
            const statusResponse = await apiService.getPostDisbursalProgress(appId);
            if (statusResponse.success && statusResponse.data?.agreement_signed) {
              toast.success('Document signed successfully!');
              // Update progress state
              setProgress(prev => ({ ...prev, agreement_signed: true }));
              // Refresh to show signed state
              await fetchProgress(appId);
            } else {
              // Webhook might not have processed yet, show message and refresh
              toast.info('Please wait while we verify your signature...');
              await fetchProgress(appId);
            }
          } catch (error) {
            console.error('Error checking signing status:', error);
            toast.warning('Signing completed. Please wait while we verify...');
          }
        }, 2000);
      } else {
        toast.success('Document signed successfully!');
      }
      
      // Remove callback params from URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('clickwrap');
      newSearchParams.delete('success');
      newSearchParams.delete('transactionId');
      navigate(`/post-disbursal?${newSearchParams.toString()}`, { replace: true });
    } else if (clickwrapStatus === 'error' || errorCode) {
      // User returned from failed signing
      console.error('❌ ClickWrap signing failed:', { errorCode, errorMsg, transactionId });
      toast.error(errorMsg || `Signing failed (Error: ${errorCode})`);
      
      // Remove callback params from URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('clickwrap');
      newSearchParams.delete('error_code');
      newSearchParams.delete('errorMsg');
      newSearchParams.delete('transactionId');
      navigate(`/post-disbursal?${newSearchParams.toString()}`, { replace: true });
    }
    
    fetchApplicationAndProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, searchParams]);

  // Fetch progress when applicationId changes (for cases where it's set from URL params)
  useEffect(() => {
    if (applicationId && !loading) {
      fetchProgress(applicationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // Check status and redirect if needed
  const checkStatusAndRedirect = async (appId: number) => {
    try {
      console.log(`🔍 Checking status for App ID: ${appId} (Type: ${typeof appId})`);
      const response = await apiService.getLoanApplications();

      console.log('🔍 /loan-applications Response:', JSON.stringify(response));

      // Check success/status
      const isSuccess = response.success === true || response.status === 'success';

      if (isSuccess && response.data?.applications) {
        console.log(`📋 Found ${response.data.applications.length} applications`);

        // Use loose equality to handle string/number mismatch
        const app = response.data.applications.find((a: any) => a.id == appId);

        if (app) {
          console.log(`✅ Found App #${app.id}: Status='${app.status}'`);

          if ((app as any).status === 'account_manager') {
            console.log('🚀 Loan disbursed! Redirecting to repayment schedule...');
            setRedirecting(true);
            navigate(`/repayment-schedule?applicationId=${appId}`);
            return true;
          } else {
            console.log(`⏳ Status mismatch: Expected 'account_manager', got '${app.status}'`);
          }
        } else {
          console.warn(`❌ App #${appId} NOT found in applications list`, response.data.applications.map((a: any) => ({ id: a.id, status: a.status })));
        }
      } else {
        console.warn('❌ API returned unsuccesful or missing data:', response);
      }
      return false;
    } catch (error) {
      console.error('Error checking status:', error);
      return false;
    }
  };

  // Poll for status changes if on confirmation step
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (currentStep === 6 && applicationId) {
      // Check immediately
      checkStatusAndRedirect(applicationId);

      // Then poll every 5 seconds
      intervalId = setInterval(() => {
        checkStatusAndRedirect(applicationId);
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentStep, applicationId, navigate]);

  const fetchApplicationAndProgress = async () => {
    try {
      setLoading(true);
      // Get application ID from URL or fetch latest disbursal application
      const appIdParam = searchParams.get('applicationId');
      let appId: number | null = null;

      if (appIdParam) {
        appId = parseInt(appIdParam);
        
        // STRICT GUARD: Verify loan status before allowing access
        // Only 'disbursal' status loans can access this post-disbursal flow
        const response = await apiService.getLoanApplications();
        // Check both response.status === 'success' and response.success for compatibility
        const isSuccess = response.status === 'success' || response.success === true;
        if (isSuccess && response.data?.applications) {
          const app = response.data.applications.find((a: any) => a.id == appId);
          
          if (!app) {
            console.warn(`❌ Application ${appId} not found. Redirecting to dashboard.`);
            toast.error('Loan application not found');
            navigate('/dashboard');
            return;
          }

          console.log(`🔒 Status guard check for App ${appId}: status='${app.status}'`);

          // Only 'disbursal' status is allowed
          if (app.status !== 'disbursal') {
            console.warn(`⛔ Unauthorized access attempt: App ${appId} has status '${app.status}', not 'disbursal'`);
            
            // Redirect based on actual status
            if (app.status === 'account_manager') {
              console.log('➡️ Redirecting to repayment schedule (loan is in account_manager status)');
              toast.info('This loan is already active. Redirecting...');
              setRedirecting(true);
              navigate(`/repayment-schedule?applicationId=${appId}`);
              return;
            } else {
              console.log('➡️ Redirecting to dashboard (invalid status for post-disbursal flow)');
              toast.error('This loan is not ready for post-disbursal steps');
              navigate('/dashboard');
              return;
            }
          }

          // Status is valid - proceed
          console.log(`✅ Access granted: App ${appId} is in 'disbursal' status`);
          setApplicationId(appId);
        } else {
          console.error('Failed to fetch applications for status verification', { 
            response, 
            hasStatus: !!response.status, 
            hasSuccess: !!response.success,
            hasData: !!response.data,
            hasApplications: !!response.data?.applications 
          });
          toast.error('Unable to verify loan status');
          navigate('/dashboard');
          return;
        }

      } else {
        // No applicationId in URL - fetch latest disbursal application
        const response = await apiService.getLoanApplications();
        // Check both response.status === 'success' and response.success for compatibility
        const isSuccess = response.status === 'success' || response.success === true;
        if (isSuccess && response.data?.applications) {
          // Check for account_manager first (prioritize redirected flow)
          const activeLoan = response.data.applications.find(
            (app: any) => app.status === 'account_manager'
          );

          if (activeLoan) {
            console.log('➡️ Found account_manager loan, redirecting to repayment schedule');
            setRedirecting(true);
            navigate(`/repayment-schedule?applicationId=${activeLoan.id}`);
            return;
          }

          const disbursalApp = response.data.applications.find(
            (app: any) => app.status === 'disbursal'
          );
          if (disbursalApp) {
            console.log(`✅ Found disbursal loan ${disbursalApp.id}`);
            appId = disbursalApp.id;
            setApplicationId(appId);
          } else {
            console.log('ℹ️ No disbursal loans found');
          }
        }
      }

      // Fetch progress immediately using the appId variable (not state)
      // This ensures we load progress even if applicationId state hasn't updated yet
      if (appId) {
        await fetchProgress(appId);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching application:', error);
      toast.error('Failed to load application');
      navigate('/dashboard');
    } finally {
      // Only turn off loading if NOT redirecting
      if (!redirecting) {
        setLoading(false);
      }
    }
  };

  const fetchProgress = async (appId: number) => {
    try {
      const response = await apiService.getPostDisbursalProgress(appId);
      console.log('📊 Post-disbursal progress response:', response);

      const isSuccess = response.success === true || response.status === 'success';
      const progressData = response.data;

      if (isSuccess && progressData) {
        setProgress(progressData);
        
        // Determine step based on individual columns, NOT current_step
        // This allows admin to reset individual steps (e.g., enach_done = 0) without resetting all steps
        let determinedStep = 1;
        
        if (!progressData.enach_done) {
          determinedStep = 1; // Step 1: eNACH
        } else if (!progressData.selfie_captured) {
          determinedStep = 2; // Step 2: Selfie Capture
        } else if (!progressData.selfie_verified) {
          determinedStep = 2; // Still on selfie step if not verified
        } else if (!progressData.references_completed) {
          determinedStep = 3; // Step 3: References
        } else if (!progressData.kfs_viewed) {
          determinedStep = 4; // Step 4: KFS View
        } else if (!progressData.agreement_signed) {
          determinedStep = 5; // Step 5: Agreement Sign
        } else {
          determinedStep = 6; // Step 6: Confirmation (all done)
        }
        
        console.log('🎯 Determined step based on columns:', {
          enach_done: progressData.enach_done,
          selfie_captured: progressData.selfie_captured,
          selfie_verified: progressData.selfie_verified,
          references_completed: progressData.references_completed,
          kfs_viewed: progressData.kfs_viewed,
          agreement_signed: progressData.agreement_signed,
          determinedStep
        });
        
        setCurrentStep(determinedStep);
        setLoading(false);
      } else {
        setCurrentStep(1);
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error fetching progress:', error);
      setCurrentStep(1);
      setLoading(false);
    }
  };

  const saveProgress = async (stepData: Partial<PostDisbursalProgress>) => {
    if (!applicationId) return;

    try {
      setSaving(true);
      const updatedProgress = { ...progress, ...stepData };
      const response = await apiService.updatePostDisbursalProgress(applicationId, updatedProgress);

      if (response.success) {
        setProgress(updatedProgress);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('Failed to save progress');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStepComplete = async (stepNumber: number, stepData: Partial<PostDisbursalProgress>) => {
    // Save progress with the step data (don't increment current_step - we determine it from columns)
    const saved = await saveProgress(stepData);

    if (saved) {
      // Re-fetch progress to get updated step based on columns
      if (applicationId) {
        await fetchProgress(applicationId);
      } else if (stepNumber < 6) {
        // Fallback: manually advance if we can't fetch
        setCurrentStep(stepNumber + 1);
      }
    }
  };

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          {redirecting ? (
            <p className="text-gray-600">Redirecting to repayment schedule...</p>
          ) : (
            <p className="text-gray-600">Loading...</p>
          )}
        </div>
      </div>
    );
  }

  if (!applicationId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Application Found</h2>
            <p className="text-gray-600 mb-4">
              No loan application in disbursal status found.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <DashboardHeader userName={user?.first_name || 'User'} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <ENachStep
                applicationId={applicationId}
                onComplete={() => handleStepComplete(1, { enach_done: true })}
                saving={saving}
              />
            )}

            {currentStep === 2 && (
              <SelfieCaptureStep
                applicationId={applicationId}
                onComplete={(verified: boolean) =>
                  handleStepComplete(2, {
                    selfie_captured: true,
                    selfie_verified: verified
                  })
                }
                saving={saving}
                progress={progress}
              />
            )}

            {currentStep === 3 && (
              <ReferencesStep
                applicationId={applicationId}
                onComplete={() => handleStepComplete(3, { references_completed: true })}
                saving={saving}
              />
            )}

            {currentStep === 4 && (
              <KFSViewStep
                applicationId={applicationId}
                onComplete={() => handleStepComplete(4, { kfs_viewed: true })}
                saving={saving}
              />
            )}

            {currentStep === 5 && (
              <AgreementSignStep
                applicationId={applicationId}
                onComplete={() => handleStepComplete(5, { agreement_signed: true })}
                saving={saving}
                progress={progress}
              />
            )}

            {currentStep === 6 && (
              <ConfirmationStep />
            )}

            {/* Fallback if currentStep is not set or invalid */}
            {!currentStep || (currentStep < 1 || currentStep > 6) ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Loading Step...</h2>
                <p className="text-gray-600 mb-4">
                  Please wait while we load your progress.
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Step 1: E-NACH Registration
interface StepProps {
  applicationId: number;
  onComplete: (data?: any) => void;
  saving: boolean;
  progress?: any;
}

const ENachStep = ({ applicationId, onComplete, saving }: StepProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSubscription, setExistingSubscription] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  // Default authentication method: 'aadhaar' (Aadhaar Card is selected by default)
  const [authMode, setAuthMode] = useState<string>('aadhaar');

  useEffect(() => {
    // Check if subscription already exists for this loan
    checkExistingSubscription();
    // Fetch bank details
    fetchBankDetails();
  }, [applicationId]);

  const fetchBankDetails = async () => {
    try {
      setLoadingBank(true);
      // Assuming we have user from context - you might need to adjust this
      const userStr = localStorage.getItem('pocket_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const response = await apiService.getUserBankDetails(user.id);
        if (response.success && response.data && response.data.length > 0) {
          // Find primary bank or use the first one
          const primaryBank = response.data.find((bank: any) => bank.is_primary) || response.data[0];
          setBankDetails(primaryBank);
        }
      }
    } catch (err) {
      console.error('Error fetching bank details:', err);
    } finally {
      setLoadingBank(false);
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const response = await apiService.getEnachSubscription(applicationId);
      if (response.success && response.data) {
        setExistingSubscription(response.data);
        const subscription = response.data;

        // If subscription is already active or bank approval pending, auto-complete this step
        // BANK_APPROVAL_PENDING means user has approved, waiting for bank (24 hours)
        if (subscription.status === 'ACTIVE' || subscription.status === 'AUTHENTICATED' || 
            subscription.status === 'BANK_APPROVAL_PENDING' ||
            subscription.mandate_status === 'APPROVED') {
          console.log('✅ eNACH mandate already authorized or pending bank approval');
          if (subscription.status === 'BANK_APPROVAL_PENDING') {
            toast.success('eNACH mandate approved! Waiting for bank confirmation (24 hours).');
          } else {
            toast.success('eNACH mandate already authorized');
          }
          onComplete();
        } else if (subscription.authorization_url && 
                   (subscription.status === 'INITIALIZED' || subscription.status === 'PENDING')) {
          // If there's a pending subscription with authorization URL, user might need to complete it
          console.log('ℹ️ Existing pending eNACH subscription found');
          // Don't auto-redirect - let user click the button to continue
        }
      }
    } catch (err) {
      console.error('Error checking existing subscription:', err);
    }
  };

  const handleComplete = async () => {
    if (!bankDetails) {
      toast.error('Please add your bank account details first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create eNACH subscription via Cashfree
      const response = await apiService.createEnachSubscription(applicationId, authMode);

      if (response.success && response.data) {
        const { 
          authorization_url, 
          subscription_id, 
          sms_flow,
          redirect_action,
          redirect_method,
          redirect_payload
        } = response.data;

        // If SMS flow, redirect to completion page with status polling
        if (sms_flow || !authorization_url) {
          // Store subscription ID for status checking
          sessionStorage.setItem('enach_subscription_id', subscription_id);
          sessionStorage.setItem('enach_application_id', applicationId.toString());
          
          // Redirect to eNACH completion page with status polling
          navigate(`/enach-completion?subscription_id=${subscription_id}&applicationId=${applicationId}`);
          return;
        }

        // Store subscription ID and application ID in session for when user returns
        sessionStorage.setItem('enach_subscription_id', subscription_id);
        sessionStorage.setItem('enach_application_id', applicationId.toString());
        sessionStorage.setItem('enach_return_url', window.location.href);

        toast.success('Redirecting to eNACH authorization...');

        // Check if this is an NPCI eNACH URL (always requires POST)
        const isNpciUrl = authorization_url && authorization_url.includes('enach.npci.org.in');
        
        // Handle redirect based on method
        // NPCI URLs and explicit POST redirects need form submission
        if (redirect_method === 'post' || redirect_action === 'post' || isNpciUrl) {
          // Create a form and submit it with POST method
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = authorization_url;
          form.style.display = 'none';
          form.target = '_self'; // Submit in same window

          // Add payload fields if provided
          if (redirect_payload && typeof redirect_payload === 'object') {
            // Handle nested objects in payload
            Object.keys(redirect_payload).forEach((key) => {
              const value = redirect_payload[key];
              if (value === null || value === undefined) {
                return; // Skip null/undefined values
              }
              
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              
              if (typeof value === 'object' && !Array.isArray(value)) {
                // For nested objects, flatten or stringify based on NPCI requirements
                // NPCI typically expects flat form fields, so we stringify complex objects
                input.value = JSON.stringify(value);
              } else {
                input.value = String(value);
              }
              
              form.appendChild(input);
            });
          }

          document.body.appendChild(form);
          form.submit();
        } else {
          // For GET redirects, use window.location.href
          window.location.href = authorization_url;
        }
      } else {
        throw new Error(response.message || 'Failed to create eNACH subscription');
      }
    } catch (err: any) {
      console.error('Error creating eNACH subscription:', err);
      setError(err.message || 'Failed to create eNACH subscription. Please try again.');
      toast.error(err.message || 'Failed to create eNACH subscription');
      setLoading(false);
    }
    // Note: Don't set loading to false here since we're redirecting
  };

  // Check if returning from authorization (dashboard redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const enachComplete = urlParams.get('enach');
    const subscriptionIdParam = urlParams.get('subscription_id');
    const subscriptionId = subscriptionIdParam || sessionStorage.getItem('enach_subscription_id');
    const savedApplicationId = sessionStorage.getItem('enach_application_id');

    // Only process if we're returning from eNACH authorization
    if (enachComplete === 'complete' && subscriptionId) {
      console.log('🔄 User returned from eNACH authorization, checking status...');
      setLoading(true);
      
      // Verify application ID matches
      if (savedApplicationId && savedApplicationId !== applicationId.toString()) {
        console.warn('Application ID mismatch, using saved ID');
      }

      // Check authorization status with polling
      checkAuthorizationStatusWithPolling(subscriptionId);
      
      // Clean up session storage
      sessionStorage.removeItem('enach_subscription_id');
      sessionStorage.removeItem('enach_application_id');
      sessionStorage.removeItem('enach_return_url');
      
      // Remove query params
      const newUrl = window.location.pathname + `?applicationId=${applicationId}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [applicationId]);

  const checkAuthorizationStatusWithPolling = async (subscriptionId: string, attempt: number = 1, maxAttempts: number = 10) => {
    try {
      console.log(`[eNACH] Checking status (attempt ${attempt}/${maxAttempts})...`);
      const response = await apiService.getEnachSubscriptionStatus(subscriptionId);

      if (response.success && response.data) {
        const status = response.data.subscription_status;
        const mandateStatus = response.data.mandate_status;

        console.log(`[eNACH] Current status: ${status}, Mandate: ${mandateStatus}`);

        // Success states - mandate is authorized
        // BANK_APPROVAL_PENDING means user approved, waiting for bank (24 hours) - allow progression
        if (status === 'ACTIVE' || status === 'AUTHENTICATED' || status === 'BANK_APPROVAL_PENDING' || 
            mandateStatus === 'APPROVED') {
          if (status === 'BANK_APPROVAL_PENDING') {
            toast.success('eNACH mandate approved! Waiting for bank confirmation (24 hours). You can proceed to the next step.');
          } else {
            toast.success('eNACH mandate authorized successfully!');
          }
          setLoading(false);
          // Proceed to next step - user has approved, bank approval is pending
          onComplete();
          return;
        }

        // Failed states
        if (status === 'CANCELLED' || status === 'FAILED' || mandateStatus === 'REJECTED') {
          toast.error('eNACH authorization failed. Please try again.');
          setLoading(false);
          setError('eNACH mandate authorization was rejected. Please try again.');
          return;
        }

        // Still pending - poll again if within limit
        if ((status === 'INITIALIZED' || status === 'PENDING' || !mandateStatus) && attempt < maxAttempts) {
          // Wait 2 seconds before next check
          setTimeout(() => {
            checkAuthorizationStatusWithPolling(subscriptionId, attempt + 1, maxAttempts);
          }, 2000);
          return;
        }

        // Max attempts reached but still pending
        if (attempt >= maxAttempts) {
          toast.warning('eNACH authorization is taking longer than expected. We will notify you once it is confirmed.');
          setLoading(false);
          // Don't auto-complete - wait for webhook to update status
          // User can manually check status later
        }
      } else {
        throw new Error(response.message || 'Failed to fetch subscription status');
      }
    } catch (err: any) {
      console.error('Error checking authorization status:', err);
      
      // Retry if it's a network error and we haven't exceeded max attempts
      if (attempt < maxAttempts && (err.message?.includes('network') || err.message?.includes('timeout'))) {
        setTimeout(() => {
          checkAuthorizationStatusWithPolling(subscriptionId, attempt + 1, maxAttempts);
        }, 2000);
        return;
      }

      toast.error('Failed to verify eNACH authorization status. Please refresh the page.');
      setLoading(false);
      setError('Unable to verify authorization status. Please contact support if the issue persists.');
    }
  };

  const handleAddBankAccount = () => {
    // Navigate to bank linking page with allowEdit flag to bypass auto-redirect
    navigate('/link-salary-bank-account?allowEdit=true');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CreditCard className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">E-NACH Registration</h2>
        <p className="text-gray-600">
          Set up automatic loan repayment through E-NACH mandate
        </p>
      </div>

      {/* Bank Account Details Section */}
      <Card className="border-gray-300">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Your Bank Account
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddBankAccount}
              className="text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              {bankDetails ? 'Change Bank' : 'Add Bank'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBank ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading bank details...</span>
            </div>
          ) : bankDetails ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bank Name</p>
                  <p className="text-sm font-medium text-gray-900">{bankDetails.bank_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Account Number</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    ****{bankDetails.account_number?.slice(-4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">IFSC Code</p>
                  <p className="text-sm font-medium text-gray-900">{bankDetails.ifsc_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Account Type</p>
                  <p className="text-sm font-medium text-gray-900">
                    {bankDetails.account_type || 'Savings'}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-800">
                    This account will be used for automatic EMI deductions
                  </span>
                </div>
              </div>

              {/* Supported Banks Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3">
                <p className="text-xs font-medium text-blue-900 mb-1">Supported Banks:</p>
                <p className="text-xs text-blue-700">
                  HDFC Bank, ICICI Bank, State Bank of India, Axis Bank, Kotak Mahindra Bank,
                  Yes Bank, IndusInd Bank, and other major Indian banks
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-2">No Bank Account Found</p>
              <p className="text-xs text-gray-600 mb-4">
                Please add your bank account details to continue with eNACH registration
              </p>
              <Button onClick={handleAddBankAccount} className="mx-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Bank Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Show existing subscription status if any */}
      {existingSubscription && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Existing Subscription</p>
              <p className="text-xs text-blue-800 mt-1">
                Status: <span className="font-semibold">{existingSubscription.status}</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {existingSubscription.status === 'INITIALIZED' && 'Authorization pending - Click below to continue'}
                {existingSubscription.status === 'PENDING' && 'Waiting for bank verification'}
                {existingSubscription.status === 'BANK_APPROVAL_PENDING' && 'Mandate approved - Waiting for bank confirmation (24 hours). You can proceed to next step.'}
                {existingSubscription.status === 'ACTIVE' && 'Mandate is active'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-xs text-red-800 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* What is e-NACH Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            What is e-NACH / e-Mandate?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            e-NACH (Electronic National Automated Clearing House) is a secure digital payment authorization system that allows automatic deduction of your loan EMI from your bank account on the due date.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-gray-900">Automatic Payments</p>
                <p className="text-xs text-gray-600">Never miss a payment - EMI is auto-debited on due date</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-gray-900">Secure & RBI Approved</p>
                <p className="text-xs text-gray-600">Bank-grade security with Reserve Bank of India regulation</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-gray-900">No Manual Transfers</p>
                <p className="text-xs text-gray-600">Eliminate the hassle of remembering payment dates</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-gray-900">Full Control</p>
                <p className="text-xs text-gray-600">You can cancel or modify the mandate anytime through your bank</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900">Complete e-NACH Registration</p>
              <p className="text-xs text-gray-600">Authorize automatic deductions from your salary account</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900">Bank Verification</p>
              <p className="text-xs text-gray-600">Your bank will verify and activate the mandate (usually within 24-48 hours)</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900">Automatic Deductions</p>
              <p className="text-xs text-gray-600">EMI will be automatically deducted on your repayment date each month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Note */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900">Important Information</p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              <li>Ensure sufficient balance in your account on the EMI due date</li>
              <li>The mandate is specific to this loan and will auto-expire after final payment</li>
              <li>You will receive SMS/Email notifications before each deduction</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Authentication Mode Selection - Moved to end */}
      {bankDetails && (
        <Card className="border-gray-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Select Authentication Method
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Choose how you want to authenticate the e-NACH mandate
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Net Banking Option */}
              <label
                className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  authMode === 'net_banking'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="auth-mode"
                  value="net_banking"
                  checked={authMode === 'net_banking'}
                  onChange={(e) => setAuthMode(e.target.value)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Net Banking</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Authenticate using your bank's net banking credentials
                  </p>
                </div>
              </label>

              {/* Debit Card Option */}
              <label
                className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  authMode === 'debit_card'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="auth-mode"
                  value="debit_card"
                  checked={authMode === 'debit_card'}
                  onChange={(e) => setAuthMode(e.target.value)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Debit Card</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Authenticate using your debit card details
                  </p>
                </div>
              </label>

              {/* Aadhaar Option */}
              <label
                className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  authMode === 'aadhaar'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="auth-mode"
                  value="aadhaar"
                  checked={authMode === 'aadhaar'}
                  onChange={(e) => setAuthMode(e.target.value)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Aadhaar Card</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Authenticate using your Aadhaar number and OTP
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button
          onClick={handleComplete}
          disabled={loading || saving || !bankDetails || loadingBank}
          className="min-w-[200px]"
        >
          {(loading || saving) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? 'Creating Mandate...' : 'Proceed to e-NACH Registration'}
        </Button>
        
      </div>
    </div>
  );
};

// Step 2: Selfie Capture (imported)
// Step 3: References (reusing existing component)
const ReferencesStep = ({ applicationId, onComplete, saving }: StepProps) => {
  const [completed, setCompleted] = useState(false);

  const handleReferencesSaved = () => {
    setCompleted(true);
    onComplete();
  };

  return (
    <EnhancedUserReferencesPage
      onComplete={handleReferencesSaved}
      showBackButton={false}
      embedded={true}
    />
  );
};

// Step 4: KFS View
const KFSViewStep = ({ applicationId, onComplete, saving }: StepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Key Facts Statement</h2>
        <p className="text-gray-600">
          Please review your loan details and terms
        </p>
      </div>

      <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
        <UserKFSDocument loanId={applicationId} />
      </div>

      <div className="flex justify-end gap-4">
        <Button
          onClick={onComplete}
          disabled={saving}
          className="min-w-[120px]"
        >
          I've Reviewed
        </Button>
      </div>
    </div>
  );
};

// Step 5: Agreement Sign
const AgreementSignStep = ({ applicationId, onComplete, saving, progress }: StepProps) => {
  const [initiating, setInitiating] = useState(false);
  const [agreementLoaded, setAgreementLoaded] = useState(false);
  const [checkingSignedStatus, setCheckingSignedStatus] = useState(false);
  const [isAlreadySigned, setIsAlreadySigned] = useState(false);
  const agreementContentRef = useRef<HTMLDivElement>(null);

  // Check if agreement is already signed on mount and when progress changes
  useEffect(() => {
    const checkSignedStatus = async () => {
      try {
        setCheckingSignedStatus(true);
        const progressResponse = await apiService.getPostDisbursalProgress(applicationId);
        if (progressResponse.success && progressResponse.data) {
          setIsAlreadySigned(progressResponse.data.agreement_signed === true);
        }
      } catch (error) {
        console.error('Error checking agreement status:', error);
      } finally {
        setCheckingSignedStatus(false);
      }
    };

    // Check initial status from prop, otherwise fetch
    if (progress?.agreement_signed !== undefined) {
      setIsAlreadySigned(progress.agreement_signed === true);
    } else {
      checkSignedStatus();
    }
  }, [applicationId, progress?.agreement_signed]);

  // Handle agreement loaded callback
  const handleAgreementLoaded = () => {
    setAgreementLoaded(true);
  };

  // Extract HTML content from the agreement document
  const getAgreementHTML = (): string => {
    const agreementElement = document.getElementById('loan-agreement-content');
    if (!agreementElement) {
      throw new Error('Agreement content not found');
    }
    
    // Clone the element to avoid modifying the original
    const clonedElement = agreementElement.cloneNode(true) as HTMLElement;
    
    // Get the HTML content
    return clonedElement.innerHTML;
  };

  // Digitap signing URL format with redirect URLs
  // Production: https://sdk.digitap.ai/clickwrap/clickwrap.html?txnid={entTransactionId}&redirect_url={Success_url}&error_url={error_url}
  const getDigitapSigningUrl = (entTransactionId: string, applicationId: number): string => {
    // Build backend callback URLs - backend will handle PDF download, S3 upload, and email
    // Digitap requires absolute URLs, so we need to construct the full backend URL
    const hostname = window.location.hostname;
    const protocol = window.location.protocol; // 'http:' or 'https:'
    const isProduction = process.env.NODE_ENV === 'production';
    
    // In production, backend is on same host but different path, or use BACKEND_URL env var
    // In development, backend is on port 3002
    let backendBaseUrl: string;
    if (isProduction) {
      // Production: assume backend is at same origin with /api path, or construct from window.location
      backendBaseUrl = `${protocol}//${hostname}/api`;
    } else {
      // Development: backend is on port 3002
      backendBaseUrl = `http://${hostname}:3002/api`;
    }
    
    // Backend callback endpoint that handles all post-signing processing
    const successUrl = encodeURIComponent(`${backendBaseUrl}/clickwrap/callback?success=true&transactionId=${entTransactionId}&applicationId=${applicationId}`);
    const errorUrl = encodeURIComponent(`${backendBaseUrl}/clickwrap/callback?success=false&transactionId=${entTransactionId}&applicationId=${applicationId}`);
    
    // Production URL format (per Digitap docs v1.9)
    return `https://sdk.digitap.ai/clickwrap/clickwrap.html?txnid=${entTransactionId}&redirect_url=${successUrl}&error_url=${errorUrl}`;
  };

  const handleESign = async () => {
    try {
      setInitiating(true);

      // Check if user is authenticated and has token
      const token = localStorage.getItem('pocket_user_token');
      if (!token) {
        toast.error('Please login to continue');
        setInitiating(false);
        return;
      }
      console.log('🔑 Token found, length:', token.length);

      // Step 1: Extract HTML content from the agreement
      let htmlContent: string;
      try {
        htmlContent = getAgreementHTML();
        console.log('✅ Agreement HTML extracted, length:', htmlContent.length);
      } catch (error: any) {
        throw new Error('Failed to extract agreement content: ' + error.message);
      }

      // Step 2: Initiate ClickWrap with backend (or get existing transaction IDs)
      console.log('🔄 Initiating ClickWrap for application:', applicationId);
      const initiateResponse = await apiService.initiateClickWrap(applicationId, htmlContent);

      if (!initiateResponse.success || !initiateResponse.data) {
        // If backend says agreement already signed, check status and proceed
        if (initiateResponse.message && initiateResponse.message.includes('already been signed')) {
          toast.info('Agreement has already been signed');
          setIsAlreadySigned(true);
          setInitiating(false);
          // Refresh progress to get updated status
          const statusResponse = await apiService.getPostDisbursalProgress(applicationId);
          if (statusResponse.success && statusResponse.data?.agreement_signed) {
            onComplete();
          }
          return;
        }
        throw new Error(initiateResponse.message || 'Failed to initiate e-signature');
      }

      const { entTransactionId, docTransactionId, previewUrl } = initiateResponse.data;
      
      // Check if this is a new initiation or existing transaction
      if (initiateResponse.data.message && initiateResponse.data.message.includes('Existing')) {
        console.log('ℹ️ Using existing ClickWrap transaction:', { entTransactionId, docTransactionId });
      } else {
        console.log('✅ ClickWrap initiated:', { entTransactionId, docTransactionId });
      }

      // Step 3: Redirect to Digitap signing page with callback URLs
      // Digitap will redirect back to our app after signing completes/fails
      const signingUrl = getDigitapSigningUrl(entTransactionId, applicationId);
      console.log('🚀 Redirecting to Digitap signing page:', signingUrl);
      console.log('🔑 Using entTransactionId:', entTransactionId);
      
      // Redirect in current window
      toast.info('Redirecting to signing page...');
      
      // Small delay to ensure toast is visible before redirect
      setTimeout(() => {
        window.location.href = signingUrl;
      }, 500);
      
      // Note: After signing, Digitap will redirect back to:
      // Success: /post-disbursal?applicationId={id}&clickwrap=success&success=true&transactionId={txnId}
      // Error: /post-disbursal?applicationId={id}&clickwrap=error&error_code={code}&errorMsg={msg}&transactionId={txnId}
      // The useEffect hook will handle these callbacks and update the UI accordingly

    } catch (error: any) {
      console.error('Error initiating e-signature:', error);
      toast.error(error.message || 'Failed to initiate e-signature. Please try again.');
      setInitiating(false);
    }
  };

  // If already signed, show success message
  if (isAlreadySigned) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loan Agreement Signed</h2>
          <p className="text-gray-600">
            Your loan agreement has been successfully e-signed.
          </p>
        </div>

        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Agreement Status:</strong> Signed and verified
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Your application is ready for disbursement. You will receive your funds shortly.
          </p>
        </div>

        <div 
          className="border rounded-lg p-4 max-h-[600px] overflow-y-auto" 
          id="loan-agreement-content"
        >
          <UserLoanAgreementDocument 
            loanId={applicationId} 
            onLoaded={handleAgreementLoaded}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button
            onClick={onComplete}
            disabled={saving}
            className="min-w-[120px]"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <PenTool className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Loan Agreement</h2>
        <p className="text-gray-600">
          Review and e-sign your loan agreement
        </p>
      </div>

      <div 
        ref={agreementContentRef}
        className="border rounded-lg p-4 max-h-[600px] overflow-y-auto" 
        id="loan-agreement-content"
      >
        <UserLoanAgreementDocument 
          loanId={applicationId} 
          onLoaded={handleAgreementLoaded}
        />
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>E-Signature Process:</strong>
        </p>
        <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
          <li>Please review the loan agreement carefully</li>
          <li>Click "E-Sign Agreement" to proceed with digital signature</li>
          <li>You will receive an OTP on your registered mobile number</li>
          <li>Enter the OTP to complete the signing process</li>
        </ul>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Important:</strong> By signing this agreement, you agree to all terms and conditions. Please read carefully before proceeding.
        </p>
      </div>

      <div className="flex justify-end gap-4">
        {(!agreementLoaded || checkingSignedStatus) && (
          <p className="text-sm text-gray-500 mr-auto flex items-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {checkingSignedStatus ? 'Checking status...' : 'Loading agreement...'}
          </p>
        )}
        <Button
          onClick={handleESign}
          disabled={saving || initiating || !agreementLoaded || checkingSignedStatus}
          className="min-w-[150px]"
        >
          {(saving || initiating) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {initiating ? 'Initiating...' : 'E-Sign Agreement'}
        </Button>
      </div>
    </div>
  );
};

// Step 6: Confirmation
const ConfirmationStep = () => {
  return (
    <div className="space-y-6 text-center">
      <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
      <h2 className="text-2xl font-bold mb-2">You will get funds shortly</h2>
      <p className="text-gray-600 mb-6">
        Your loan application has been processed successfully. Funds will be disbursed to your registered bank account shortly.
      </p>
      {/* No Continue button - user just sees the confirmation message and stays on this page */}
    </div>
  );
};
