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

                    // PRIORITY 0: Check for admin-requested actions (these take precedence over status-based redirects)
                    const activeApp = applications.find((app: any) => 
                        !['cleared', 'cancelled'].includes(app.status)
                    );

                    if (activeApp) {
                        // Check 1: ReKYC required
                        try {
                            const checkId = activeApp.id || '0';
                            const kycResponse = await apiService.getKYCStatus(checkId);
                            if (kycResponse.success && kycResponse.data) {
                                let verificationData = kycResponse.data.verification_data;
                                if (typeof verificationData === 'string') {
                                    try {
                                        verificationData = JSON.parse(verificationData);
                                    } catch (e) {
                                        // Ignore parse errors
                                    }
                                }
                                if (verificationData?.rekyc_required === true) {
                                    // ReKYC required - redirect to KYC page (even from dashboard)
                                    if (!location.pathname.includes('/loan-application/kyc-verification')) {
                                        setRedirectPath(`/loan-application/kyc-verification?applicationId=${activeApp.id}`);
                                        setIsChecking(false);
                                        return;
                                    }
                                }
                            }
                        } catch (kycError) {
                            console.error('Error checking ReKYC:', kycError);
                        }

                        // Check 2: Re-selfie required (selfie was reset by admin)
                        // This is checked in PostDisbursalFlowPage, but if user is on dashboard with ready_for_disbursement,
                        // they need to be redirected to post-disbursal to complete selfie
                        // Only check for post-disbursal statuses (ready_for_disbursement, disbursal, repeat_disbursal)
                        if (activeApp.status === 'ready_for_disbursement' || activeApp.status === 'disbursal' || activeApp.status === 'repeat_disbursal') {
                            try {
                                const progressResponse = await apiService.getPostDisbursalProgress(activeApp.id);
                                if (progressResponse.success && progressResponse.data) {
                                    const progress = progressResponse.data;
                                    // If selfie was reset by admin (captured=1 but verified=0), redirect to post-disbursal
                                    // This indicates admin reset the selfie verification
                                    if (progress.selfie_captured && !progress.selfie_verified && 
                                        !location.pathname.includes('/post-disbursal') && 
                                        !location.pathname.includes('/loan-application/kyc-verification')) {
                                        console.log('🔄 Re-selfie required - redirecting to post-disbursal');
                                        setRedirectPath(`/post-disbursal?applicationId=${activeApp.id}`);
                                        setIsChecking(false);
                                        return;
                                    }
                                }
                            } catch (progressError) {
                                console.error('Error checking post-disbursal progress:', progressError);
                            }
                        }

                        // Check 3: Bank Statement required (status reset to pending by admin via "Add New from User")
                        // When admin resets bank statement via "Add New from User", it sets:
                        // - status = 'pending'
                        // - verification_status = 'not_started'
                        // - user_status = NULL
                        // User needs to upload bank statement again
                        try {
                            const bankStatementResponse = await apiService.getUserBankStatementStatus();
                            if (bankStatementResponse.success && bankStatementResponse.data) {
                                const bsData = bankStatementResponse.data as any; // Use any to access dynamic fields that may not be in TypeScript type
                                // Check if bank statement was reset by admin:
                                // - status is 'pending' (admin reset it)
                                // - verificationStatus is 'not_started' (admin reset it) - note: backend returns camelCase
                                // - userStatus is null/undefined (not uploaded by user yet after reset)
                                // - User has active loan application (not cleared/cancelled)
                                // - User is not already on bank statement or other priority pages
                                const status = bsData.status;
                                const verificationStatus = (bsData as any).verificationStatus || (bsData as any).verification_status; // Backend returns camelCase
                                const userStatus = (bsData as any).userStatus;
                                
                                // Check if this looks like an admin reset:
                                // Status is pending AND verificationStatus is not_started AND no userStatus
                                const isResetByAdmin = (
                                    status === 'pending' && 
                                    verificationStatus === 'not_started' &&
                                    (!userStatus || userStatus === null) &&
                                    !location.pathname.includes('/loan-application/bank-statement') &&
                                    !location.pathname.includes('/loan-application/kyc-verification') &&
                                    !location.pathname.includes('/post-disbursal')
                                );
                                
                                if (isResetByAdmin) {
                                    // Bank statement was reset by admin - redirect to upload page
                                    console.log('🔄 Bank statement reset by admin - redirecting to bank statement upload page');
                                    setRedirectPath(`/loan-application/bank-statement?applicationId=${activeApp.id}`);
                                    setIsChecking(false);
                                    return;
                                }
                            }
                        } catch (bsError) {
                            console.error('Error checking bank statement status:', bsError);
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
