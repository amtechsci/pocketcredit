import { useState, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * LoanStatusGuard - Consolidates application-status-based redirects
 * - Handles redirects to /post-disbursal, /application-under-review, etc.
 * - Ensures user is on the correct page based on their latest application status
 */
export function LoanStatusGuard({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { isAuthenticated, user, isLoading: authLoading } = useAuth();
    const [isChecking, setIsChecking] = useState(true);
    const [redirectPath, setRedirectPath] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !isAuthenticated || !user) {
            if (!authLoading) setIsChecking(false);
            return;
        }

        const checkLoanStatus = async () => {
            try {
                setIsChecking(true);
                const response = await apiService.getLoanApplications();

                if ((response.success || response.status === 'success') && response.data?.applications) {
                    const applications = response.data.applications;

                    // PRIORITY 0: Check for admin-requested actions (Re-KYC, Bank Statement Reset) via Progress Engine
                    const activeApp = applications.find((app: any) =>
                        !['cleared', 'cancelled'].includes(app.status)
                    );

                    if (activeApp) {
                        try {
                            const { getOnboardingProgress, getStepRoute } = await import('../utils/onboardingProgressEngine');
                            const progress = await getOnboardingProgress(activeApp.id);

                            // If engine says we are NOT at 'steps' (completed), and we have a reset-style prerequisite,
                            // redirect to the current pending step.
                            if (progress.currentStep !== 'steps' && (progress.prerequisites.rekycRequired || progress.prerequisites.bankStatementReset)) {
                                const route = getStepRoute(progress.currentStep, activeApp.id);
                                if (!location.pathname.includes(route.split('?')[0])) {
                                    console.log(`[LoanStatusGuard] 🔄 Admin reset detected (${progress.currentStep}), redirecting to: ${route}`);
                                    setRedirectPath(route);
                                    setIsChecking(false);
                                    return;
                                }
                            }
                        } catch (engineError) {
                            console.error('Error checking progress engine in Guard:', engineError);
                        }
                    }


                    // 1. Check for ready_for_disbursement -> /post-disbursal
                    // NOTE: Allow dashboard access for ready_for_disbursement - users can view their loan and click "View" to see waiting page
                    // Only redirect if they're NOT on dashboard (let them access dashboard freely)
                    // BUT: Skip this if admin actions above require redirect
                    const readyApp = applications.find((app: any) =>
                        app.status === 'ready_for_disbursement' || app.status === 'ready_to_repeat_disbursal'
                    );
                    if (readyApp && !location.pathname.includes('/post-disbursal') && !location.pathname.includes('/dashboard')) {
                        // Don't redirect from dashboard - allow users to see their loans and click "View" button
                        // Only redirect from other pages
                        setRedirectPath(`/post-disbursal?applicationId=${readyApp.id}`);
                        setIsChecking(false);
                        return;
                    }

                    // 2. Check for disbursal/repeat_disbursal -> /post-disbursal
                    const disbursalApp = applications.find((app: any) =>
                        app.status === 'disbursal' || app.status === 'repeat_disbursal'
                    );
                    if (disbursalApp && !location.pathname.includes('/post-disbursal')) {
                        // Further check if they need to sign the agreement
                        try {
                            const progress = await apiService.getPostDisbursalProgress(disbursalApp.id);
                            if (progress.success && progress.data) {
                                const p = progress.data;
                                // If not signed yet, they MUST go to post-disbursal
                                if (!(p.current_step >= 6 && p.agreement_signed) && p.current_step < 7) {
                                    setRedirectPath(`/post-disbursal?applicationId=${disbursalApp.id}`);
                                    setIsChecking(false);
                                    return;
                                }
                            }
                        } catch (e) {
                            setRedirectPath(`/post-disbursal?applicationId=${disbursalApp.id}`);
                            setIsChecking(false);
                            return;
                        }
                    }

                    // 3. Check for under_review/qa_verification -> /application-under-review
                    // Only redirect if current_step is 'complete' (all steps done) or status is 'qa_verification'
                    // Don't redirect if current_step is null/undefined (steps still pending)
                    const reviewApp = applications.find((app: any) => {
                        const hasReviewStatus = app.status === 'under_review' || app.status === 'submitted' || app.status === 'qa_verification' || app.status === 'follow_up';
                        const stepsComplete = app.current_step === 'complete';
                        const isQAVerification = app.status === 'qa_verification';
                        // Only redirect if status matches AND (steps are complete OR it's qa_verification status)
                        return hasReviewStatus && (stepsComplete || isQAVerification);
                    });
                    // Note: If they have pending documents, DocumentRequiredGuard will handle it.
                    // This only applies if they are waiting for admin review.
                    if (reviewApp && !location.pathname.includes('/application-under-review') && !location.pathname.includes('/loan-application/upload-documents')) {
                        setRedirectPath('/application-under-review');
                        setIsChecking(false);
                        return;
                    }
                }
            } catch (error) {
                console.error('LoanStatusGuard check failed:', error);
            } finally {
                setIsChecking(false);
            }
        };

        checkLoanStatus();
    }, [isAuthenticated, user, location.pathname, authLoading]);

    if (authLoading || isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Checking application status...</p>
                </div>
            </div>
        );
    }

    if (redirectPath) {
        return <Navigate to={redirectPath} replace />;
    }

    return <>{children}</>;
}
