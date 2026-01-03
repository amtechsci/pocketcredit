import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { toast } from 'sonner';

export type LoanApplicationStep = 
  | 'application'           // Loan application creation
  | 'kyc-verification'      // KYC verification
  | 'employment-details'    // Employment details
  | 'bank-statement'        // Bank statement upload
  | 'bank-details'          // Bank details
  | 'references'            // References
  | 'upload-documents'      // Document upload
  | 'steps';                // Final steps/completion

export interface StepPrerequisites {
  kycVerified: boolean;
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
 * - After KYC verification, users MUST complete employment-details before bank-statement
 * - Employment details includes: company name, salary date, monthly income, etc.
 */
const STEP_ORDER: LoanApplicationStep[] = [
  'application',           // Step 1: Create loan application
  'kyc-verification',      // Step 2: Complete KYC verification (Digilocker)
  'employment-details',     // Step 3: Enter company details, salary, etc. (REQUIRED after KYC)
  'bank-statement',         // Step 4: Upload bank statement
  'bank-details',           // Step 5: Link salary bank account
  'references',             // Step 6: Add references
  'upload-documents',       // Step 7: Upload any additional documents
  'steps'                   // Step 8: Final completion
];

export const STEP_ROUTES: Record<LoanApplicationStep, string> = {
  'application': '/application', // Application creation page
  'kyc-verification': '/loan-application/kyc-verification',
  'employment-details': '/loan-application/employment-details',
  'bank-statement': '/loan-application/bank-statement',
  'bank-details': '/loan-application/bank-details',
  'references': '/loan-application/references',
  'upload-documents': '/loan-application/upload-documents',
  'steps': '/loan-application/steps'
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

  // Fetch latest application
  const fetchLatestApplication = useCallback(async () => {
    try {
      const response = await apiService.getLoanApplications();
      if (response.success && response.data && response.data.applications && response.data.applications.length > 0) {
        const latestApp = response.data.applications[0];
        return latestApp.id;
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
    return null;
  }, []);

  // Check KYC status
  const checkKYCStatus = useCallback(async (applicationId: number | string) => {
    try {
      const response = await apiService.getKYCStatus(applicationId);
      if (response.success && response.data) {
        return response.data.kyc_status === 'verified';
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    }
    return false;
  }, []);

  // Check employment details status (user-specific, no longer requires applicationId)
  const checkEmploymentStatus = useCallback(async (_applicationId: number) => {
    try {
      // Employment details is now user-specific, so we don't need applicationId
      const response = await apiService.getEmploymentDetailsStatus();
      console.log('📋 Employment status check response:', response);
      const isCompleted = response.status === 'success' && response.data?.completed === true;
      console.log('📋 Employment details completed?', isCompleted);
      return isCompleted;
    } catch (error: any) {
      // If 404, employment details don't exist - return false but don't log as error
      if (error?.response?.status === 404) {
        console.log('📋 No employment details found (404)');
        return false;
      }
      console.error('❌ Error checking employment status:', error);
      return false;
    }
  }, []);

  // Check bank statement status (applicationId kept for future use but not needed currently)
  const checkBankStatementStatus = useCallback(async (_applicationId: number) => {
    try {
      const response = await apiService.getUserBankStatementStatus();
      if (response.success && response.data) {
        const data = response.data as any;
        // Bank statement is considered complete if:
        // 1. status === 'completed' (online mode - Digitap verified)
        // 2. userStatus === 'uploaded' (manual upload - admin will verify later)
        // 3. userStatus === 'under_review' or 'verified' (admin is reviewing or has verified)
        return data.status === 'completed' || 
               data.userStatus === 'uploaded' || 
               data.userStatus === 'under_review' || 
               data.userStatus === 'verified';
      }
    } catch (error) {
      console.error('Error checking bank statement status:', error);
    }
    return false;
  }, []);

  // Check bank details status - check if application has bank details linked
  const checkBankDetailsStatus = useCallback(async (applicationId: number) => {
    try {
      const response = await apiService.getLoanApplicationById(applicationId);
      if ((response.success || response.status === 'success') && response.data?.application) {
        // Check if user_bank_id is set (indicates bank details are linked)
        return !!(response.data.application as any).user_bank_id;
      }
    } catch (error: any) {
      // If 404, application doesn't exist - return false silently
      if (error?.response?.status === 404) {
        return false;
      }
      // Only log non-404 errors
      console.error('Error checking bank details status:', error);
    }
    return false;
  }, []);

  // Check references status - check if application has references
  // (applicationId kept for future use but not needed currently)
  const checkReferencesStatus = useCallback(async (_applicationId: number) => {
    try {
      // You may need to create an API endpoint for this
      // For now, we'll assume it's checked via application status or a separate endpoint
      // Placeholder - implement based on your API structure
      return false;
    } catch (error) {
      console.error('Error checking references status:', error);
    }
    return false;
  }, []);

  // Check if admin requested document upload AND if documents are not yet uploaded
  const checkDocumentRequest = useCallback(async (applicationId: number) => {
    try {
      const response = await (apiService as any).request('GET', `/validation/user/history?loanApplicationId=${applicationId}`, {});
      if ((response.success || response.status === 'success') && Array.isArray(response.data)) {
        const documentActions = response.data.filter(
          (action: any) => action.action_type === 'need_document' && action.loan_application_id === applicationId
        );
        if (documentActions.length > 0) {
          const latestAction = documentActions[0];
          const docs = latestAction.action_details?.documents || [];
          
          if (docs.length > 0) {
            // Check if all documents are already uploaded
            try {
              const docsResponse = await apiService.getLoanDocuments(applicationId);
              if (docsResponse.success || docsResponse.status === 'success') {
                const uploadedDocs = docsResponse.data?.documents || [];
                const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                
                const allUploaded = docs.every((requiredDoc: string) => {
                  const normalizedRequired = normalize(requiredDoc);
                  return uploadedDocs.some((uploaded: any) => {
                    const normalizedUploaded = normalize(uploaded.document_name || '');
                    return normalizedRequired === normalizedUploaded ||
                           normalizedRequired.includes(normalizedUploaded) ||
                           normalizedUploaded.includes(normalizedRequired);
                  });
                });
                
                // Documents are needed only if NOT all uploaded
                return { needed: !allUploaded, documents: docs };
              }
            } catch (docsError) {
              console.error('Error checking uploaded documents:', docsError);
              // If we can't check, assume documents are needed
            }
          }
          
          return { needed: docs.length > 0, documents: docs };
        }
      }
    } catch (error) {
      console.error('Error checking document request:', error);
    }
    return { needed: false, documents: [] };
  }, []);

  // Determine current step based on prerequisites
  const determineCurrentStep = useCallback((prerequisites: StepPrerequisites): LoanApplicationStep => {
    if (prerequisites.documentsNeeded) {
      return 'upload-documents';
    }
    if (!prerequisites.kycVerified) {
      return 'kyc-verification';
    }
    if (!prerequisites.employmentCompleted) {
      return 'employment-details';
    }
    if (!prerequisites.bankStatementCompleted) {
      return 'bank-statement';
    }
    if (!prerequisites.bankDetailsCompleted) {
      return 'bank-details';
    }
    if (!prerequisites.referencesCompleted) {
      return 'references';
    }
    return 'steps';
  }, []);

  // Validate step access - use cached prerequisites if available to avoid duplicate API calls
  const validateStepAccess = useCallback(async (step: LoanApplicationStep, applicationId: number | null, cachedPrerequisites?: StepPrerequisites): Promise<boolean> => {
    if (!applicationId) {
      // No application - must start from application creation
      return step === 'application';
    }

    const stepIndex = STEP_ORDER.indexOf(step);
    if (stepIndex === -1) return false;

    // Use cached prerequisites if available, otherwise check them
    let prerequisites: StepPrerequisites;
    if (cachedPrerequisites) {
      prerequisites = cachedPrerequisites;
    } else {
      // Check prerequisites for each step
      prerequisites = {
        kycVerified: await checkKYCStatus(applicationId),
        employmentCompleted: applicationId ? await checkEmploymentStatus(applicationId) : false,
        bankStatementCompleted: applicationId ? await checkBankStatementStatus(applicationId) : false,
        bankDetailsCompleted: applicationId ? await checkBankDetailsStatus(applicationId) : false,
        referencesCompleted: applicationId ? await checkReferencesStatus(applicationId) : false,
        documentsNeeded: applicationId ? (await checkDocumentRequest(applicationId)).needed : false
      };
    }

    // Determine what step user should be on
    const currentStep = determineCurrentStep(prerequisites);
    const currentStepIndex = STEP_ORDER.indexOf(currentStep);

    // User can access current step or any previous step
    return stepIndex <= currentStepIndex;
  }, [checkKYCStatus, checkEmploymentStatus, checkBankStatementStatus, checkBankDetailsStatus, checkReferencesStatus, checkDocumentRequest, determineCurrentStep]);

  // Load step status
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
      let applicationId = getApplicationId();
      
      // If no applicationId, try to get latest application
      if (!applicationId) {
        applicationId = await fetchLatestApplication();
      }

      if (!applicationId) {
        // No application found - user should start from application creation
        setStatus({
          currentStep: 'application',
          applicationId: null,
          prerequisites: {
            kycVerified: false,
            employmentCompleted: false,
            bankStatementCompleted: false,
            bankDetailsCompleted: false,
            referencesCompleted: false,
            documentsNeeded: false
          },
          loading: false,
          error: null
        });
        
        // Redirect to application creation if not already there
        if (!skipRedirect && requiredStep && requiredStep !== 'application' && location.pathname !== STEP_ROUTES['application']) {
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            navigate(STEP_ROUTES['application'], { replace: true });
          }
        }
        isValidatingRef.current = false;
        return;
      }

      // First verify the application exists before checking prerequisites
      // FIX: Check both 'success' and 'status' fields since API can return either
      let applicationExists: boolean = false;
      try {
        const appCheck = await apiService.getLoanApplicationById(applicationId);
        // Check both success boolean and status string
        applicationExists = !!(appCheck.success || appCheck.status === 'success') && !!appCheck.data?.application;
      } catch (error: any) {
        // If 404, application doesn't exist
        if (error?.response?.status === 404) {
          applicationExists = false;
        } else {
          // Other errors - log but don't redirect, allow user to continue
          console.warn('Error checking application existence (non-404):', error);
          // Don't set applicationExists = false for non-404 errors
          // This allows the flow to continue even if there's a temporary API issue
          applicationExists = true; // Assume exists to prevent false redirects
        }
      }

      if (!applicationExists) {
        // Application doesn't exist - try to get the latest application instead
        console.log(`[StepGuard] Application ${applicationId} not found, trying to get latest application`);
        const latestAppId = await fetchLatestApplication();
        
        if (latestAppId) {
          // Found a latest application - use that instead
          console.log(`[StepGuard] Found latest application ${latestAppId}, using that instead`);
          applicationId = latestAppId;
          // Continue with the flow using the latest application
          // Don't return, let it continue to check prerequisites
        } else {
          // No application found at all - redirect to application creation
          setStatus({
            currentStep: 'application',
            applicationId: null,
            prerequisites: {
              kycVerified: false,
              employmentCompleted: false,
              bankStatementCompleted: false,
              bankDetailsCompleted: false,
              referencesCompleted: false,
              documentsNeeded: false
            },
            loading: false,
            error: null
          });
          
          // Only redirect if we're not already on application creation page
          const appRoute = STEP_ROUTES['application'];
          const isValidAppRoute = appRoute && 
                                 (appRoute.startsWith('/loan-application/') || appRoute === '/application') &&
                                 Object.values(STEP_ROUTES).includes(appRoute);
          
          if (!skipRedirect && 
              requiredStep && 
              requiredStep !== 'application' && 
              location.pathname !== appRoute &&
              isValidAppRoute) {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              console.log(`[StepGuard] No application found, redirecting to ${appRoute}`);
              navigate(appRoute, { replace: true });
            }
          }
          isValidatingRef.current = false;
          return;
        }
      }

      // Application exists - check all prerequisites
      const docStatus = await checkDocumentRequest(applicationId);
      const prerequisites: StepPrerequisites = {
        kycVerified: await checkKYCStatus(applicationId),
        employmentCompleted: await checkEmploymentStatus(applicationId),
        bankStatementCompleted: await checkBankStatementStatus(applicationId),
        bankDetailsCompleted: await checkBankDetailsStatus(applicationId),
        referencesCompleted: await checkReferencesStatus(applicationId),
        documentsNeeded: docStatus.needed
      };

      const currentStep = determineCurrentStep(prerequisites);

      // Only update status if something actually changed to prevent unnecessary re-renders
      setStatus(prev => {
        // Check if anything actually changed
        const hasChanged = 
          prev.currentStep !== currentStep ||
          prev.applicationId !== applicationId ||
          prev.prerequisites.kycVerified !== prerequisites.kycVerified ||
          prev.prerequisites.employmentCompleted !== prerequisites.employmentCompleted ||
          prev.prerequisites.bankStatementCompleted !== prerequisites.bankStatementCompleted ||
          prev.prerequisites.bankDetailsCompleted !== prerequisites.bankDetailsCompleted ||
          prev.prerequisites.referencesCompleted !== prerequisites.referencesCompleted ||
          prev.prerequisites.documentsNeeded !== prerequisites.documentsNeeded;
        
        // Only update if something changed or if we're loading
        if (!hasChanged && !prev.loading && skipRedirect) {
          return prev; // Return previous state to prevent re-render during polling
        }
        
        return {
          currentStep,
          applicationId,
          prerequisites,
          loading: false,
          error: null
        };
      });

      // If a required step is specified, validate access (but only redirect once)
      // Use cached prerequisites to avoid duplicate API calls
      if (requiredStep && !skipRedirect && !hasRedirectedRef.current && currentStep) {
        try {
            const hasAccess = await validateStepAccess(requiredStep, applicationId, prerequisites);
          
          console.log(`[StepGuard] Access check for ${requiredStep}:`, {
            hasAccess,
            currentStep,
            requiredStep,
            currentRoute: location.pathname,
            applicationId
          });
          
          // Only redirect if user doesn't have access AND we have a valid current step
          if (!hasAccess) {
            const redirectRoute = STEP_ROUTES[currentStep];
            const currentRoute = location.pathname;
            
            console.log(`[StepGuard] User doesn't have access. Current step: ${currentStep}, Redirect route: ${redirectRoute}`);
            
            // Always redirect if we have a valid currentStep and route
            // Don't over-validate - if currentStep is set, we should redirect there
            if (redirectRoute && currentRoute !== redirectRoute && requiredStep !== currentStep) {
              hasRedirectedRef.current = true;
              console.log(`[StepGuard] ✅ Redirecting from ${currentRoute} (${requiredStep}) to ${redirectRoute} (${currentStep})${applicationId ? ` for application ${applicationId}` : ' (no application)'}`);
              toast.error('You need to complete previous steps first');
              navigate(redirectRoute, {
                state: applicationId ? { applicationId } : undefined,
                replace: true
              });
            } else {
              console.warn('[StepGuard] ⚠️ Redirect skipped:', {
                redirectRoute,
                currentRoute,
                currentStep,
                requiredStep,
                routesMatch: currentRoute === redirectRoute,
                stepsMatch: requiredStep === currentStep
              });
            }
          } else {
            console.log(`[StepGuard] ✅ User has access to ${requiredStep}`);
          }
        } catch (accessError) {
          // If validation fails, don't redirect - just log and continue
          // This prevents broken redirects that could cause 404s
          console.error('[StepGuard] ❌ Error validating step access:', accessError);
          // Don't redirect on error - let the user stay on current page
        }
      }
    } catch (error: any) {
      console.error('Error loading step status:', error);
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
    checkKYCStatus,
    checkEmploymentStatus,
    checkBankStatementStatus,
    checkBankDetailsStatus,
    checkReferencesStatus,
    checkDocumentRequest,
    determineCurrentStep,
    validateStepAccess,
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
