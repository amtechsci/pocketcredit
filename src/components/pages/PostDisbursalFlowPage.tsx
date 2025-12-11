import { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
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
    fetchApplicationAndProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate]);

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
        setApplicationId(appId);

        // check status immediately for this ID
        const redirected = await checkStatusAndRedirect(appId);
        if (redirected) return; // Stop if redirecting

      } else {
        // Fetch latest application with disbursal status OR account_manager status
        const response = await apiService.getLoanApplications();
        if (response.success && response.data?.applications) {
          // Check for account_manager first (prioritize redirected flow)
          const activeLoan = response.data.applications.find(
            (app: any) => app.status === 'account_manager'
          );

          if (activeLoan) {
            setRedirecting(true);
            navigate(`/repayment-schedule?applicationId=${activeLoan.id}`);
            return;
          }

          const disbursalApp = response.data.applications.find(
            (app: any) => app.status === 'disbursal'
          );
          if (disbursalApp) {
            appId = disbursalApp.id;
            setApplicationId(appId);
          }
        }
      }

      // Fetch progress immediately using the appId variable (not state)
      // This ensures we load progress even if applicationId state hasn't updated yet
      if (appId) {
        await fetchProgress(appId);
      }
    } catch (error) {
      console.error('Error fetching application:', error);
      toast.error('Failed to load application');
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
        const savedStep = progressData.current_step || (progressData as any).post_disbursal_step || 1;

        // If step 6 is completed (agreement_signed) OR step is 7 or higher (all steps done)
        if ((savedStep >= 6 && progressData.agreement_signed) || savedStep >= 7) {
          setCurrentStep(6);
          setLoading(false);
          return;
        }

        // Cap the step to max 6
        const validStep = Math.min(savedStep, 6);
        setCurrentStep(validStep);
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
    const saved = await saveProgress({
      ...stepData,
      current_step: stepNumber + 1
    });

    if (saved) {
      if (stepNumber < 6) {
        setCurrentStep(stepNumber + 1);
      } else if (stepNumber === 6) {
        setCurrentStep(6);
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
              />
            )}

            {currentStep === 6 && (
              <ConfirmationStep
                applicationId={applicationId}
                onComplete={() => { }}
                saving={saving}
              />
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
  const handleComplete = async () => {
    // Mock API call - will be replaced with actual Cashfree E-NACH API
    await new Promise(resolve => setTimeout(resolve, 1000));
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CreditCard className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">E-NACH Registration</h2>
        <p className="text-gray-600">
          Register for automatic loan repayment through E-NACH mandate
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> E-NACH allows us to automatically debit your loan EMI from your registered bank account on the due date.
        </p>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          onClick={handleComplete}
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Complete
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
const AgreementSignStep = ({ applicationId, onComplete, saving }: StepProps) => {
  const handleSign = async () => {
    // Mock e-signature - will be replaced with Cashfree Wrap API
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Loan agreement signed successfully');
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <PenTool className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Loan Agreement</h2>
        <p className="text-gray-600">
          Review and e-sign your loan agreement
        </p>
      </div>

      <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
        <UserLoanAgreementDocument loanId={applicationId} />
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Important:</strong> By signing this agreement, you agree to all terms and conditions. Please read carefully before proceeding.
        </p>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSign}
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          E-Sign Agreement
        </Button>
      </div>
    </div>
  );
};

// Step 6: Confirmation
const ConfirmationStep = ({ applicationId, onComplete, saving }: StepProps) => {
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
