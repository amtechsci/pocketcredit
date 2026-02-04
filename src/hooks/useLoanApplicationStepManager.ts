import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { toast } from 'sonner';
import {
  getOnboardingProgress,
  getStepRoute as getEngineStepRoute,
  canAccessStep,
  OnboardingStep as EngineStep,
  OnboardingPrerequisites as EnginePrerequisites
} from '../utils/onboardingProgressEngine';

/**
 * Map between hook's LoanApplicationStep and engine's OnboardingStep
 * The hook uses a subset of steps, so we map them appropriately
 */
function mapEngineStepToHookStep(engineStep: EngineStep): LoanApplicationStep {
  // Most steps map 1:1
  if (engineStep === 'application' ||
    engineStep === 'kyc-verification' ||
    engineStep === 'credit-analytics' ||
    engineStep === 'employment-details' ||
    engineStep === 'bank-statement' ||
    engineStep === 'bank-details' ||
    engineStep === 'references' ||
    engineStep === 'upload-documents' ||
    engineStep === 'steps') {
    return engineStep as LoanApplicationStep;
  }

  // PAN verification maps to kyc-verification (handled on same page)
  if (engineStep === 'pan-verification') {
    return 'kyc-verification';
  }

  // AA consent maps to bank-statement (optional, can skip)
  if (engineStep === 'aa-consent') {
    return 'bank-statement';
  }

  // Default fallback
  return 'kyc-verification';
}

/**
 * Map hook's prerequisites to engine's prerequisites
 */
function mapEnginePrerequisitesToHook(enginePrereqs: EnginePrerequisites): StepPrerequisites {
  return {
    kycVerified: enginePrereqs.kycVerified && !enginePrereqs.rekycRequired,
    creditAnalyticsCompleted: enginePrereqs.creditAnalyticsCompleted,
    employmentCompleted: enginePrereqs.employmentCompleted,
    bankStatementCompleted: enginePrereqs.bankStatementCompleted && !enginePrereqs.bankStatementReset,
    bankDetailsCompleted: enginePrereqs.bankDetailsCompleted,
    referencesCompleted: enginePrereqs.referencesCompleted,
    documentsNeeded: enginePrereqs.documentsNeeded
  };
}

export type LoanApplicationStep =
  | 'application'           // Loan application creation
  | 'kyc-verification'      // KYC verification
  | 'credit-analytics'      // Credit analytics check
  | 'employment-details'    // Employment details
  | 'bank-statement'        // Bank statement upload
  | 'bank-details'          // Bank details
  | 'references'            // References
  | 'aa-consent'            // Account Aggregator consent
  | 'upload-documents'      // Document upload
  | 'steps';                // Final steps/completion

export interface StepPrerequisites {
  kycVerified: boolean;
  creditAnalyticsCompleted: boolean;
  employmentCompleted: boolean;
  bankStatementCompleted: boolean;
  bankDetailsCompleted: boolean;
  referencesCompleted: boolean;
  documentsNeeded: boolean;
}

export interface StepStatus {
  currentStep: LoanApplicationStep | null;
  applicationId: number | null;
  prerequisites: StepPrerequisites;
  loading: boolean;
  error: string | null;
}

/**
 * Step order for loan application flow
 * IMPORTANT: This order determines the sequence users must complete
 * - After KYC verification, users go to credit-analytics, then employment-details
 * - Employment details includes: company name, salary date, monthly income, etc.
 */
const STEP_ORDER: LoanApplicationStep[] = [
  'application',           // Step 1: Create loan application
  'kyc-verification',      // Step 2: Complete KYC verification (Digilocker)
  'credit-analytics',      // Step 3: Credit analytics check (auto-fetches credit report)
  'employment-details',     // Step 4: Enter company details, salary, etc. (REQUIRED after credit check)
  'bank-statement',         // Step 5: Upload bank statement
  'bank-details',           // Step 6: Link salary bank account
  'references',             // Step 7: Add references
  'aa-consent',             // Step 8: Account Aggregator consent
  'upload-documents',       // Step 9: Upload any additional documents
  'steps'                   // Step 10: Final completion
];

export const STEP_ROUTES: Record<LoanApplicationStep, string> = {
  'application': '/application', // Application creation page
  'kyc-verification': '/loan-application/kyc-verification',
  'credit-analytics': '/loan-application/credit-analytics',
  'employment-details': '/loan-application/employment-details',
  'bank-statement': '/loan-application/bank-statement',
  'bank-details': '/link-salary-bank-account', // Onboarding flow uses link-salary-bank-account
  'references': '/user-references',
  'aa-consent': '/loan-application/aa-flow',
  'upload-documents': '/loan-application/upload-documents',
  'steps': '/application-under-review'
};

/**
 * Centralized hook to manage loan application step validation and navigation
 */
export const useLoanApplicationStepManager = (requiredStep?: LoanApplicationStep) => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);
  const isValidatingRef = useRef(false);
  const [status, setStatus] = useState<StepStatus>({
    currentStep: null,
    applicationId: null,
    prerequisites: {
      kycVerified: false,
      creditAnalyticsCompleted: false,
      employmentCompleted: false,
      bankStatementCompleted: false,
      bankDetailsCompleted: false,
      referencesCompleted: false,
      documentsNeeded: false
    },
    loading: true,
    error: null
  });

  // Get applicationId from location state or URL params
  const getApplicationId = useCallback(() => {
    const stateId = (location.state as any)?.applicationId;
    if (stateId) return typeof stateId === 'string' ? parseInt(stateId) : stateId;

    const urlParams = new URLSearchParams(location.search);
    const paramId = urlParams.get('applicationId');
    if (paramId) return parseInt(paramId);

    return null;
  }, [location]);

  // Restored helper function to fetch latest application if none provided
  const fetchLatestApplication = useCallback(async () => {
    try {
      const response = await apiService.getLoanApplications();
      const isSuccess = response.success === true || response.status === 'success';
      if (isSuccess && response.data?.applications && response.data.applications.length > 0) {
        const applications = response.data.applications;
        const activeApp = applications.find((app: any) =>
          !['cleared', 'cancelled', 'rejected'].includes(app.status)
        );
        return activeApp?.id || applications[0].id;
      }
    } catch (error) {
      console.error('[StepGuard] Error fetching applications:', error);
    }
    return null;
  }, []);


  // Load step status - NOW USES UNIFIED PROGRESS ENGINE
  const loadStepStatus = useCallback(async (skipRedirect = false) => {
    // Prevent concurrent calls
    if (isValidatingRef.current) {
      console.log('[StepGuard] Already validating, skipping duplicate call');
      return;
    }
    isValidatingRef.current = true;

    // Only set loading state if not skipping redirect (to avoid UI flicker during polling)
    if (!skipRedirect) {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      // USE UNIFIED PROGRESS ENGINE
      let applicationId = getApplicationId();

      // If no applicationId, try to get latest application
      if (!applicationId) {
        applicationId = await fetchLatestApplication();
      }

      // Get progress from unified engine
      // Use forceRefresh when skipRedirect is true (polling) to get fresh data
      const progress = await getOnboardingProgress(applicationId, skipRedirect);

      // Map engine step to hook step
      const currentStep = mapEngineStepToHookStep(progress.currentStep);
      const hookPrerequisites = mapEnginePrerequisitesToHook(progress.prerequisites);

      console.log('[StepGuard] Progress from engine:', {
        engineStep: progress.currentStep,
        hookStep: currentStep,
        applicationId: progress.applicationId
      });

      // Update status
      setStatus({
        currentStep,
        applicationId: progress.applicationId,
        prerequisites: hookPrerequisites,
        loading: false,
        error: null
      });

      // If a required step is specified, validate access using engine
      if (requiredStep && !skipRedirect && !hasRedirectedRef.current) {
        // Map required step to engine step
        const engineRequiredStep = requiredStep as EngineStep;
        const hasAccess = canAccessStep(engineRequiredStep, progress.prerequisites);

        console.log('[StepGuard] Access check:', {
          requiredStep,
          currentStep: progress.currentStep,
          hasAccess
        });

        if (!hasAccess) {
          const redirectRoute = getEngineStepRoute(progress.currentStep, progress.applicationId);
          const currentRoute = location.pathname;

          if (redirectRoute && currentRoute !== redirectRoute && requiredStep !== currentStep) {
            hasRedirectedRef.current = true;
            console.log(`[StepGuard] ✅ Redirecting from ${currentRoute} to ${redirectRoute}`);
            toast.error('You need to complete previous steps first');
            navigate(redirectRoute, { replace: true });
          }
        }
      }

      isValidatingRef.current = false;
    } catch (error: any) {
      console.error('[StepGuard] Error loading step status:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load step status'
      }));
    } finally {
      isValidatingRef.current = false;
    }
  }, [
    getApplicationId,
    fetchLatestApplication,
    requiredStep,
    navigate,
    location.pathname
  ]);

  // Reset redirect flag when route changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [location.pathname]);

  // Monitor for changes (e.g., KYC cancellation) - initial load
  useEffect(() => {
    loadStepStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredStep]); // Only reload when requiredStep changes

  // Poll for changes only if user is NOT on the current required step
  // This prevents re-rendering while user is actively completing a step
  useEffect(() => {
    if (!requiredStep || !status.applicationId || !status.currentStep) return;

    // Only poll if user is on a different step than the current required step
    // This means they might be on a later step and we need to check if admin changed something
    // If they're on the current step, they're actively working on it - don't interrupt
    const isOnCurrentStep = requiredStep === status.currentStep;

    if (isOnCurrentStep) {
      // User is on the correct step - don't poll, let them work without interruptions
      return;
    }

    // Only poll if user is on a different step (e.g., admin cancelled KYC while on employment page)
    // Poll less frequently - every 30 seconds instead of 10
    const interval = setInterval(() => {
      // Skip redirect on polling to prevent loops
      loadStepStatus(true);
    }, 30000); // 30 seconds - less frequent polling

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredStep, status.applicationId, status.currentStep]); // Added currentStep to deps

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    if (!status.currentStep) return;

    const currentIndex = STEP_ORDER.indexOf(status.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[currentIndex + 1];
      const nextRoute = STEP_ROUTES[nextStep];

      navigate(nextRoute, {
        state: { applicationId: status.applicationId },
        replace: true
      });
    }
  }, [status.currentStep, status.applicationId, navigate]);

  // Navigate to specific step
  const goToStep = useCallback((step: LoanApplicationStep) => {
    const route = STEP_ROUTES[step];
    if (route) {
      navigate(route, {
        state: { applicationId: status.applicationId },
        replace: true
      });
    }
  }, [status.applicationId, navigate]);

  return {
    ...status,
    goToNextStep,
    goToStep,
    refresh: loadStepStatus,
    STEP_ROUTES,
    STEP_ORDER
  };
};
