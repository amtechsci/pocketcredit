/**
 * UNIFIED ONBOARDING PROGRESS ENGINE
 * 
 * This is the SINGLE SOURCE OF TRUTH for determining:
 * - Which onboarding step a user should be on
 * - What the next pending step is
 * - Whether a user can access a specific step
 * 
 * Business Flow Order:
 * 1. KYC verification
 * 2. PAN verification (checked after KYC)
 * 3. Account Aggregator (AA) consent
 * 4. Bank account linking
 * 5. Other personal details (employment details)
 * 6. References
 * 7. Review/summary (steps page)
 */

import { apiService } from '../services/api';

export type OnboardingStep = 
  | 'application'           // Step 1: Create loan application
  | 'kyc-verification'      // Step 2: Complete KYC verification (Digilocker)
  | 'pan-verification'      // Step 2.5: PAN verification (after KYC)
  | 'aa-consent'            // Step 3: Account Aggregator consent
  | 'credit-analytics'      // Step 4: Credit analytics check (auto-fetches credit report)
  | 'employment-details'    // Step 5: Enter company details, salary, etc.
  | 'bank-statement'        // Step 6: Upload bank statement (via AA or manual)
  | 'bank-details'          // Step 7: Link salary bank account
  | 'references'            // Step 8: Add references
  | 'upload-documents'      // Step 9: Upload any additional documents
  | 'steps';                // Step 10: Final completion

export interface OnboardingPrerequisites {
  kycVerified: boolean;
  rekycRequired: boolean; // Admin triggered re-KYC
  panVerified: boolean;
  aaConsentGiven: boolean;
  creditAnalyticsCompleted: boolean;
  employmentCompleted: boolean;
  bankStatementCompleted: boolean;
  bankStatementReset: boolean; // Admin reset bank statement
  bankDetailsCompleted: boolean;
  referencesCompleted: boolean;
  documentsNeeded: boolean;
}

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  nextStep: OnboardingStep | null;
  prerequisites: OnboardingPrerequisites;
  applicationId: number | null;
  canProceed: boolean;
}

export const STEP_ORDER: OnboardingStep[] = [
  'application',           // Step 1: Create loan application
  'kyc-verification',      // Step 2: Complete KYC verification
  'pan-verification',      // Step 2.5: PAN verification (after KYC)
  'aa-consent',            // Step 3: Account Aggregator consent
  'credit-analytics',      // Step 4: Credit analytics check
  'employment-details',    // Step 5: Employment details
  'bank-statement',        // Step 6: Bank statement upload
  'bank-details',          // Step 7: Bank account linking
  'references',           // Step 8: References
  'upload-documents',      // Step 9: Additional documents
  'steps'                  // Step 10: Final completion
];

export const STEP_ROUTES: Record<OnboardingStep, string> = {
  'application': '/application',
  'kyc-verification': '/loan-application/kyc-verification',
  'pan-verification': '/loan-application/kyc-verification', // PAN is handled on KYC page
  'aa-consent': '/loan-application/aa-flow',
  'credit-analytics': '/loan-application/credit-analytics',
  'employment-details': '/loan-application/employment-details',
  'bank-statement': '/loan-application/bank-statement',
  'bank-details': '/link-salary-bank-account', // Onboarding flow uses link-salary-bank-account
  'references': '/user-references',
  'upload-documents': '/loan-application/upload-documents',
  'steps': '/loan-application/steps'
};

/**
 * Check all prerequisites for onboarding
 */
export async function checkAllPrerequisites(
  applicationId: number | null
): Promise<OnboardingPrerequisites> {
  const prerequisites: OnboardingPrerequisites = {
    kycVerified: false,
    rekycRequired: false,
    panVerified: false,
    aaConsentGiven: false,
    creditAnalyticsCompleted: false,
    employmentCompleted: false,
    bankStatementCompleted: false,
    bankStatementReset: false,
    bankDetailsCompleted: false,
    referencesCompleted: false,
    documentsNeeded: false
  };

  try {
    // 1. Check KYC status (user-level, not application-level)
    // Also check for ReKYC requirement (admin-triggered reset)
    try {
      const kycResponse = await apiService.getKYCStatus(applicationId || '0');
      if (kycResponse.success && kycResponse.data) {
        prerequisites.kycVerified = kycResponse.data.kyc_status === 'verified';
        
        // Check for ReKYC requirement (admin triggered re-KYC)
        if (kycResponse.data.verification_data) {
          let verificationData = kycResponse.data.verification_data;
          // Parse if it's a string
          if (typeof verificationData === 'string') {
            try {
              verificationData = JSON.parse(verificationData);
            } catch (e) {
              // Ignore parsing errors
            }
          }
          prerequisites.rekycRequired = verificationData?.rekyc_required === true;
          
          // If ReKYC is required, KYC is considered not verified
          if (prerequisites.rekycRequired) {
            prerequisites.kycVerified = false;
            console.log('[ProgressEngine] 🔄 ReKYC required by admin - KYC must be redone');
          }
        }
      }
    } catch (error) {
      console.error('[ProgressEngine] Error checking KYC:', error);
    }

    // 2. Check PAN verification (after KYC)
    if (prerequisites.kycVerified && applicationId) {
      try {
        const panResponse = await apiService.checkPanDocument(String(applicationId));
        if (panResponse.success && panResponse.data) {
          prerequisites.panVerified = panResponse.data.hasPanDocument === true;
        }
      } catch (error) {
        console.error('[ProgressEngine] Error checking PAN:', error);
      }
    }

    // 3. Check Account Aggregator consent status
    // NOTE: AA consent might be tracked via bank statement completion
    // If AA endpoint fails, we'll check bank statement status instead
    if (applicationId) {
      try {
        const aaResponse = await apiService.getAccountAggregatorStatus(applicationId);
        if (aaResponse.success && aaResponse.data) {
          // AA consent is given if status is 'approved' or we have a consent_id
          prerequisites.aaConsentGiven = 
            aaResponse.data.status === 'approved' || 
            !!aaResponse.data.consent_id ||
            aaResponse.data.hasStatement === true;
        }
      } catch (error: any) {
        // If endpoint doesn't exist (404) or fails, don't block - AA might be optional
        // or tracked via bank statement completion
        if (error?.response?.status !== 404) {
          console.warn('[ProgressEngine] AA status check failed:', error);
        }
        // Don't set aaConsentGiven = false here - let bank statement check handle it
      }
    }
    
    // If AA consent not explicitly given, check if bank statement is completed
    // (AA consent might be implicit if bank statement exists)
    if (!prerequisites.aaConsentGiven) {
      // Will be checked later in bank statement check
      // For now, assume AA is not required if bank statement can be uploaded manually
      prerequisites.aaConsentGiven = false; // Explicitly set to false
    }

    // 4. Check credit analytics completion
    try {
      const creditResponse = await apiService.getCreditAnalyticsData();
      if (creditResponse.status === 'success' && creditResponse.data) {
        const creditScore = creditResponse.data.credit_score;
        const score = typeof creditScore === 'number' ? creditScore : parseInt(creditScore) || 0;
        prerequisites.creditAnalyticsCompleted = score > 450;
      }
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.error('[ProgressEngine] Error checking credit analytics:', error);
      }
    }

    // 5. Check employment details completion
    try {
      const employmentResponse = await apiService.getEmploymentDetailsStatus();
      prerequisites.employmentCompleted = 
        employmentResponse.status === 'success' && 
        employmentResponse.data?.completed === true;
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.error('[ProgressEngine] Error checking employment:', error);
      }
    }

    // 6. Check bank statement completion and admin resets
    try {
      const bankStatementResponse = await apiService.getUserBankStatementStatus();
      if (bankStatementResponse.success && bankStatementResponse.data) {
        const data = bankStatementResponse.data as any;
        const status = data.status;
        const verificationStatus = data.verificationStatus || data.verification_status;
        const userStatus = data.userStatus;
        
        // Check if bank statement was reset by admin
        // Admin reset sets: status='pending', verificationStatus='not_started', userStatus=null
        const isResetByAdmin = (
          status === 'pending' &&
          (verificationStatus === 'not_started' || verificationStatus === null) &&
          (userStatus === null || userStatus === undefined)
        );
        
        if (isResetByAdmin) {
          prerequisites.bankStatementReset = true;
          prerequisites.bankStatementCompleted = false;
          console.log('[ProgressEngine] 🔄 Bank statement reset by admin - user must upload again');
        } else {
          prerequisites.bankStatementCompleted = 
            status === 'completed' || 
            userStatus === 'uploaded' || 
            userStatus === 'under_review' || 
            userStatus === 'verified';
        }
      }
    } catch (error) {
      console.error('[ProgressEngine] Error checking bank statement:', error);
    }

    // 7. Check bank details completion
    if (applicationId) {
      try {
        const appResponse = await apiService.getLoanApplicationById(applicationId);
        if ((appResponse.success || appResponse.status === 'success') && appResponse.data?.application) {
          const userBankId = (appResponse.data.application as any).user_bank_id;
          prerequisites.bankDetailsCompleted = !!userBankId;
          console.log(`[ProgressEngine] Bank details check: user_bank_id=${userBankId}, completed=${prerequisites.bankDetailsCompleted}`);
        } else {
          console.log(`[ProgressEngine] Bank details check: No application data in response`);
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error('[ProgressEngine] Error checking bank details:', error);
        }
      }
    }

    // 8. Check references completion
    try {
      const refsResponse = await apiService.getUserReferences();
      if (refsResponse.success && refsResponse.data) {
        const referencesList = refsResponse.data.references || [];
        const alternateData = refsResponse.data.alternate_data;
        const hasReferences = Array.isArray(referencesList) && referencesList.length >= 3;
        const hasAlternateMobile = alternateData?.alternate_mobile ? true : false;
        prerequisites.referencesCompleted = hasReferences && hasAlternateMobile;
      }
    } catch (error) {
      console.error('[ProgressEngine] Error checking references:', error);
    }

    // 9. Check if documents are needed
    if (applicationId) {
      try {
        const docResponse = await (apiService as any).request(
          'GET', 
          `/validation/user/history?loanApplicationId=${applicationId}`, 
          {}
        );
        if ((docResponse.success || docResponse.status === 'success') && Array.isArray(docResponse.data)) {
          const documentActions = docResponse.data.filter(
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
                  
                  prerequisites.documentsNeeded = !allUploaded;
                }
              } catch (docsError) {
                console.error('[ProgressEngine] Error checking uploaded documents:', docsError);
                prerequisites.documentsNeeded = docs.length > 0;
              }
            }
          }
        }
      } catch (error) {
        console.error('[ProgressEngine] Error checking document request:', error);
      }
    }
  } catch (error) {
    console.error('[ProgressEngine] Error checking prerequisites:', error);
  }

  return prerequisites;
}

/**
 * Determine the current step based on prerequisites
 * This is the CORE LOGIC - first incomplete step = current step
 */
export function determineCurrentStep(
  prerequisites: OnboardingPrerequisites
): OnboardingStep {
  // Priority 1: Documents needed (admin requested)
  if (prerequisites.documentsNeeded) {
    return 'upload-documents';
  }

  // Priority 2: KYC verification (including ReKYC)
  // If ReKYC is required OR KYC is not verified, user must complete KYC
  if (!prerequisites.kycVerified || prerequisites.rekycRequired) {
    return 'kyc-verification';
  }

  // Priority 3: PAN verification (after KYC)
  if (!prerequisites.panVerified) {
    return 'pan-verification';
  }

  // Priority 4: Account Aggregator consent (optional - can skip if bank statement can be uploaded manually)
  // NOTE: AA consent is checked but if it fails, we don't block - user can upload bank statement manually
  // Only block if AA is explicitly required by business logic
  // For now, we skip AA check and move to credit analytics
  // if (!prerequisites.aaConsentGiven) {
  //   return 'aa-consent';
  // }

  // Priority 5: Credit analytics
  if (!prerequisites.creditAnalyticsCompleted) {
    return 'credit-analytics';
  }

  // Priority 6: Employment details
  if (!prerequisites.employmentCompleted) {
    return 'employment-details';
  }

  // Priority 7: Bank statement (including admin resets)
  // If bank statement was reset by admin OR not completed, user must upload
  if (!prerequisites.bankStatementCompleted || prerequisites.bankStatementReset) {
    return 'bank-statement';
  }

  // Priority 8: Bank details (account linking)
  if (!prerequisites.bankDetailsCompleted) {
    return 'bank-details';
  }

  // Priority 9: References
  if (!prerequisites.referencesCompleted) {
    return 'references';
  }

  // All steps complete
  return 'steps';
}

/**
 * Get the next step after current step
 */
export function getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}

/**
 * Check if user can access a specific step
 */
export function canAccessStep(
  targetStep: OnboardingStep,
  prerequisites: OnboardingPrerequisites
): boolean {
  const currentStep = determineCurrentStep(prerequisites);
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const targetIndex = STEP_ORDER.indexOf(targetStep);

  if (currentIndex === -1 || targetIndex === -1) {
    return false;
  }

  // User can access current step or any previous step
  return targetIndex <= currentIndex;
}

/**
 * Get complete onboarding progress
 * This is the MAIN FUNCTION to call from components
 * 
 * @param applicationId - The loan application ID (can be null for new users)
 * @returns OnboardingProgress with current step, next step, and all prerequisites
 * 
 * @throws Never throws - always returns a valid progress object, even on error
 */
export async function getOnboardingProgress(
  applicationId: number | null,
  forceRefresh: boolean = false
): Promise<OnboardingProgress> {
  const startTime = Date.now();
  console.log('[ProgressEngine] 🚀 Starting progress check', {
    applicationId,
    timestamp: new Date().toISOString(),
    forceRefresh
  });
  
  // If forceRefresh is true, clear cache for loan application
  if (forceRefresh && applicationId) {
    apiService.clearCache(`/loan-applications/${applicationId}`);
    apiService.clearCache('/loan-applications');
  }
  
  try {
    // Check application status FIRST - if it's in review/submitted, don't allow going back to incomplete steps
    // Always fetch fresh status (no cache) for critical status checks
    let applicationStatus = null;
    
    if (applicationId) {
      try {
        // Clear cache first
        apiService.clearCache(`/loan-applications/${applicationId}`);
        apiService.clearCache('/loan-applications');
        
        // Fetch application with NO CACHE - bypass cache for critical status check
        const appResponse = await apiService.getLoanApplicationById(applicationId, { cache: false, skipDeduplication: true });
        
        console.log('[ProgressEngine] 🔍 Status check response:', {
          hasSuccess: 'success' in appResponse,
          hasStatus: 'status' in appResponse,
          success: appResponse.success,
          status: appResponse.status,
          hasData: !!appResponse.data,
          dataKeys: appResponse.data ? Object.keys(appResponse.data) : []
        });
        
        // Handle both response formats: {success: true, data: {...}} or {status: 'success', data: {...}}
        const isSuccess = appResponse.success === true || appResponse.status === 'success';
        
        if (isSuccess && appResponse.data) {
          // Try to get application from nested structure or direct
          const app = appResponse.data.application || appResponse.data;
          if (app && app.status) {
            applicationStatus = app.status;
            console.log('[ProgressEngine] ✅ Application status:', applicationStatus, 'for app', applicationId);
          } else {
            console.warn('[ProgressEngine] ⚠️ Status not found. App keys:', app ? Object.keys(app) : 'no app');
          }
        } else {
          console.warn('[ProgressEngine] ⚠️ Response not successful:', { isSuccess, hasData: !!appResponse.data });
        }
      } catch (error) {
        console.warn('[ProgressEngine] ⚠️ Error fetching application status:', error);
      }
    }
    
    // If application is in final review states, return 'steps' to prevent going back to incomplete steps
    const finalStatuses = ['under_review', 'submitted', 'approved', 'disbursed', 'disbursal', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'repeat_disbursal'];
    if (applicationStatus && finalStatuses.includes(applicationStatus)) {
      console.log('[ProgressEngine] 🚫 Application is in final status (' + applicationStatus + '), preventing step navigation - returning steps');
      // Return steps immediately - don't check prerequisites to avoid unnecessary API calls
      return {
        currentStep: 'steps',
        nextStep: null,
        prerequisites: {
          kycVerified: true,
          rekycRequired: false,
          panVerified: true,
          creditAnalyticsCompleted: true,
          employmentCompleted: true,
          bankStatementCompleted: true,
          bankStatementReset: false,
          bankDetailsCompleted: true,
          referencesCompleted: true,
          documentsNeeded: false
        },
        applicationId,
        canProceed: true
      };
    }
    
    // Normal flow - check prerequisites and determine step
    const prerequisites = await checkAllPrerequisites(applicationId);
    const duration = Date.now() - startTime;
    
    console.log('[ProgressEngine] ✅ Prerequisites checked', {
      applicationId,
      duration: `${duration}ms`,
      prerequisites: {
        kycVerified: prerequisites.kycVerified,
        rekycRequired: prerequisites.rekycRequired,
        panVerified: prerequisites.panVerified,
        creditAnalyticsCompleted: prerequisites.creditAnalyticsCompleted,
        employmentCompleted: prerequisites.employmentCompleted,
        bankStatementCompleted: prerequisites.bankStatementCompleted,
        bankStatementReset: prerequisites.bankStatementReset,
        bankDetailsCompleted: prerequisites.bankDetailsCompleted,
        referencesCompleted: prerequisites.referencesCompleted,
        documentsNeeded: prerequisites.documentsNeeded
      }
    });
    
    const currentStep = determineCurrentStep(prerequisites);
    const nextStep = getNextStep(currentStep);
    
    console.log('[ProgressEngine] 📍 Step determination', {
      applicationId,
      currentStep,
      nextStep,
      reason: getStepReason(prerequisites, currentStep)
    });

    const progress: OnboardingProgress = {
      currentStep,
      nextStep,
      prerequisites,
      applicationId,
      canProceed: currentStep === 'steps'
    };
    
    console.log('[ProgressEngine] ✅ Progress result', {
      applicationId,
      currentStep,
      nextStep,
      canProceed: progress.canProceed,
      totalDuration: `${Date.now() - startTime}ms`
    });
    
    return progress;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[ProgressEngine] ❌ Error getting progress', {
      applicationId,
      error: error?.message || String(error),
      stack: error?.stack,
      duration: `${duration}ms`
    });
    
    // Return a safe default - KYC verification
    // This ensures the app never crashes and user can always proceed
    const fallbackProgress: OnboardingProgress = {
      currentStep: 'kyc-verification',
      nextStep: 'pan-verification',
      prerequisites: {
        kycVerified: false,
        rekycRequired: false,
        panVerified: false,
        aaConsentGiven: false,
        creditAnalyticsCompleted: false,
        employmentCompleted: false,
        bankStatementCompleted: false,
        bankStatementReset: false,
        bankDetailsCompleted: false,
        referencesCompleted: false,
        documentsNeeded: false
      },
      applicationId,
      canProceed: false
    };
    
    console.log('[ProgressEngine] 🔄 Returning fallback progress', {
      applicationId,
      fallbackStep: fallbackProgress.currentStep
    });
    
    return fallbackProgress;
  }
}

/**
 * Get human-readable reason for why a step was determined
 * Useful for debugging and logging
 */
function getStepReason(prerequisites: OnboardingPrerequisites, step: OnboardingStep): string {
  switch (step) {
    case 'upload-documents':
      return 'Admin requested documents';
    case 'kyc-verification':
      if (prerequisites.rekycRequired) {
        return 'ReKYC required by admin';
      }
      return 'KYC not verified';
    case 'pan-verification':
      return 'PAN not verified';
    case 'aa-consent':
      return 'AA consent not given';
    case 'credit-analytics':
      return 'Credit analytics not completed';
    case 'employment-details':
      return 'Employment details not completed';
    case 'bank-statement':
      if (prerequisites.bankStatementReset) {
        return 'Bank statement reset by admin';
      }
      return 'Bank statement not completed';
    case 'bank-details':
      return 'Bank details not linked';
    case 'references':
      return 'References not completed';
    case 'steps':
      return 'All steps completed';
    case 'application':
      return 'No application created';
    default:
      return 'Unknown reason';
  }
}

/**
 * Get the route for a specific step
 */
export function getStepRoute(step: OnboardingStep, applicationId?: number | null): string {
  const baseRoute = STEP_ROUTES[step];
  if (!baseRoute) {
    return '/dashboard';
  }

  // Add applicationId as query param if provided
  if (applicationId) {
    const separator = baseRoute.includes('?') ? '&' : '?';
    return `${baseRoute}${separator}applicationId=${applicationId}`;
  }

  return baseRoute;
}
