import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/pages/HomePage';
import { PersonalLoanPage } from './components/pages/PersonalLoanPage';
import { BusinessLoanPage } from './components/pages/BusinessLoanPage';
import { AuthPage } from './components/pages/AuthPage';
import { AdminLogin } from './admin/AdminLogin';
import ProfileCompletionPageSimple from './components/pages/ProfileCompletionPageSimple';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DynamicDashboardPage as DashboardPage } from './components/pages/DynamicDashboardPage';
import { HoldStatusPage } from './components/pages/HoldStatusPage';
import { DeletedStatusPage } from './components/pages/DeletedStatusPage';
import { AuthOnlyRoute } from './components/ProtectedRoute';
import { PayEMIPage } from './components/pages/PayEMIPage';
import { DynamicLoanDetailsPage as LoanDetailsPage } from './components/pages/DynamicLoanDetailsPage';
import { DynamicPaymentHistoryPage as PaymentHistoryPage } from './components/pages/DynamicPaymentHistoryPage';
import { SimplifiedLoanApplicationPage } from './components/pages/SimplifiedLoanApplicationPage';
import LoanApplicationConfirmation from './components/pages/LoanApplicationConfirmation';
import { LoanDocumentUploadPage } from './components/pages/LoanDocumentUploadPage';
import { EnhancedUserReferencesPage } from './components/pages/EnhancedUserReferencesPage';
import { DigilockerKYCPage } from './components/pages/DigilockerKYCPage';
import { KYCCheckPage } from './components/pages/KYCCheckPage';
import { CreditAnalyticsPage } from './components/pages/CreditAnalyticsPage';
import { EmploymentDetailsPage } from './components/pages/EmploymentDetailsPage';
import { CreditCheckPage } from './components/pages/CreditCheckPage';
import { BankStatementUploadPage } from './components/pages/BankStatementUploadPage';
import { BankStatementSuccessPage } from './components/pages/BankStatementSuccessPage';
import { LinkSalaryBankAccountPage } from './components/pages/LinkSalaryBankAccountPage';
import { EmailVerificationPage } from './components/pages/EmailVerificationPage';
import { ResidenceAddressPage } from './components/pages/ResidenceAddressPage';
import { AdditionalInformationPage } from './components/pages/AdditionalInformationPage';
import { ApplicationUnderReviewPage } from './components/pages/ApplicationUnderReviewPage';
import { PostDisbursalFlowPage } from './components/pages/PostDisbursalFlowPage';
import { RepaymentSchedulePage } from './components/pages/RepaymentSchedulePage';
import { PaymentReturnPage } from './components/pages/PaymentReturnPage';
import { EnachCompletionPage } from './components/pages/EnachCompletionPage';
import { AccountAggregatorFlow } from './components/pages/AccountAggregatorFlow';
import { CreditScorePage } from './components/pages/CreditScorePage';
import { StepGuard } from './components/loan-application/StepGuard';
import { StatusGuard } from './components/StatusGuard';
import { LoanStatusGuard } from './components/LoanStatusGuard';
import { ResourcesPage } from './components/pages/ResourcesPage';
import { ContactPage } from './components/pages/ContactPage';
import { PrivacyPolicyPage } from './components/pages/PrivacyPolicyPage';
import { TermsConditionsPage } from './components/pages/TermsConditionsPage';
import { FairPracticeCodePage } from './components/pages/FairPracticeCodePage';
import { ITPolicyNew as ITPolicy } from './components/pages/ITPolicyNew';
import { FeesPolicyPage as FeesPolicy } from './components/pages/FeesPolicyPage';
import { RefundCancellationPolicyPage } from './components/pages/RefundCancellationPolicyPage';
import { PartnersPage } from './components/pages/PartnersPage';
import { MediaPage } from './components/pages/MediaPage';
import { CareersPage } from './components/pages/CareersPage';
import { GrievanceRedressalPage } from './components/pages/GrievanceRedressalPage';
import { DisclaimerPage } from './components/pages/DisclaimerPage';
import { AboutPage } from './components/pages/AboutPage';
import { ChangeMobileNumberPage } from './components/pages/ChangeMobileNumberPage';
import { Logo } from './components/Logo';
import AdminApp from './AdminApp';
import PartnerApp from './PartnerApp';

import { Toaster } from './components/ui/sonner';
import { PendingDocumentNotification } from './components/PendingDocumentNotification';
import { DocumentRequiredGuard } from './components/DocumentRequiredGuard';
import { initializeUTMTracking } from './utils/utmTracker';

// Layout component for pages with header and footer
function LayoutWithHeaderFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}

// Layout component for dashboard pages (no header/footer)
// Enforces document upload requirement if admin has requested documents
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentRequiredGuard>
      <div className="min-h-screen w-full">
        <PendingDocumentNotification />
        {children}
      </div>
    </DocumentRequiredGuard>
  );
}

// Admin-as-user AA login page: accepts a short-lived token and creates a user session
function AaAdminLoginPage() {
  const { refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    // Store token and mark AA impersonation mode
    localStorage.setItem('pocket_user_token', token);
    localStorage.setItem('pocket_admin_aa_mode', '1');

    // Refresh user profile and then go to AA step
    (async () => {
      try {
        await refreshUser();
      } catch (err) {
        console.error('AA admin login refresh error:', err);
      } finally {
        navigate('/link-salary-bank-account', { replace: true });
      }
    })();
  }, [location.search, navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Preparing Account Aggregator view…</p>
      </div>
    </div>
  );
}

// Admin Access Page Component
function AdminAccessPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="text-center p-8 w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <Logo size="xl" variant="default" />
          </div>
          <h1 className="text-2xl mb-4 font-bold" style={{ color: '#1E2A3B' }}>Admin Access</h1>
          <p className="mb-6 text-gray-600">
            Access the Admin Panel to manage loans, users, and system operations.
          </p>
          <div className="space-y-4">
            <a
              href="https://pkk.pocketcredit.in/stpl"
              className="w-full px-6 py-3 rounded-lg transition-colors btn-mobile touch-manipulation font-medium inline-block"
              style={{ backgroundColor: '#0052FF', color: 'white' }}
            >
              Open Admin Panel
            </a>
            <a
              href="/"
              className="w-full px-6 py-2 rounded-lg transition-colors touch-manipulation border border-gray-300 text-gray-700 hover:bg-gray-50 inline-block"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// 404 Not Found Page
function NotFoundPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="text-center p-8 w-full max-w-md mx-auto">
        <h1 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>404 - Page Not Found</h1>
        <p className="mb-4" style={{ color: '#1E2A3B' }}>The page you're looking for doesn't exist.</p>
        <a
          href="/"
          className="px-6 py-2 rounded-lg transition-colors btn-mobile touch-manipulation"
          style={{ backgroundColor: '#0052FF', color: 'white' }}
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default function App() {
  // Check if /stpl is accessed on wrong domain and redirect
  const location = useLocation();
  const navigate = useNavigate();

  // Capture UTM params as early as possible (e.g. ?utm_source=PARTNER_UUID&utm_medium=partner_api)
  // so partner attribution works when user registers via partner link
  useEffect(() => {
    initializeUTMTracking();
  }, []);

  useEffect(() => {
    const hostname = window.location.hostname;
    // Only treat pkk.pocketcredit.in as admin subdomain, not localhost (for development)
    const isAdminSubdomain = hostname.includes('pkk.pocketcredit.in') || hostname === 'pkk.pocketcredit.in';
    const isLocalhost = hostname === 'localhost' || hostname.includes('127.0.0.1');

    // If on admin subdomain (not localhost), only allow /stpl paths
    if (isAdminSubdomain && !isLocalhost && !location.pathname.startsWith('/stpl')) {
      window.location.href = `https://pocketcredit.in${location.pathname}${location.search}`;
    }

    // If on main domain (not admin subdomain and not localhost), redirect /stpl to home
    if (!isAdminSubdomain && !isLocalhost && location.pathname.startsWith('/stpl')) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return (
    <Routes>
      {/* Admin routes - only /stpl path (no /admin) - only on subdomain */}
      <Route path="/stpl/login" element={<AdminLoginPage />} />
      <Route path="/stpl/*" element={<AdminApp />} />

      {/* Partner routes - separate from main app */}
      <Route path="/partner/*" element={<PartnerApp />} />

      {/* All other routes - wrapped with AuthProvider */}
      <Route path="*" element={
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      } />
    </Routes>
  );
}

// Admin Login Page Component
function AdminLoginPage() {
  const navigate = useNavigate();

  console.log('AdminLoginPage rendered - no AuthProvider');

  // Check if user is already logged in
  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    const adminToken = localStorage.getItem('adminToken');

    if (adminUser && adminToken) {
      // Already logged in, redirect to dashboard
      navigate('/stpl/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = (user: any) => {
    localStorage.setItem('adminUser', JSON.stringify(user));
    navigate('/stpl/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminLogin onLogin={handleLogin} />
    </div>
  );
}

// Redirect component for /loan-application/bank-details to /link-salary-bank-account
function BankDetailsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const applicationId = params.get('applicationId');
  const redirectUrl = applicationId 
    ? `/link-salary-bank-account?applicationId=${applicationId}`
    : '/link-salary-bank-account';
  return <Navigate to={redirectUrl} replace />;
}

function AppContent() {
  const { isAuthenticated, user, isLoading, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize UTM tracking on app load and whenever URL search (e.g. partner link) changes
  useEffect(() => {
    initializeUTMTracking();
  }, [location.search]);

  // AA-only admin-as-user guard: restrict routes when in AA impersonation mode
  useEffect(() => {
    const isAaMode = localStorage.getItem('pocket_admin_aa_mode') === '1';
    if (!isAaMode) return;

    const allowedPrefixes = [
      '/aa-admin-login',
      '/link-salary-bank-account',
      '/account-aggregator',
      '/account-aggregator-flow',
      '/user-references',
      '/application-under-review'
    ];

    const path = location.pathname || '';
    const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));

    if (!isAllowed) {
      navigate('/link-salary-bank-account', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Routes>
        {/* Admin-as-user AA login entry point */}
        <Route path="/aa-admin-login" element={
          <DashboardLayout>
            <AaAdminLoginPage />
          </DashboardLayout>
        } />
        {/* Public Pages with Header and Footer */}
        <Route path="/" element={
          <LayoutWithHeaderFooter>
            <HomePage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/home" element={
          <LayoutWithHeaderFooter>
            <HomePage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/personal-loan" element={
          <LayoutWithHeaderFooter>
            <PersonalLoanPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/business-loan" element={
          <LayoutWithHeaderFooter>
            <BusinessLoanPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/credit-score" element={
          <LayoutWithHeaderFooter>
            <CreditScorePage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/resources" element={
          <LayoutWithHeaderFooter>
            <ResourcesPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/contact" element={
          <LayoutWithHeaderFooter>
            <ContactPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/about" element={
          <LayoutWithHeaderFooter>
            <AboutPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/privacy" element={
          <LayoutWithHeaderFooter>
            <PrivacyPolicyPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/terms" element={
          <LayoutWithHeaderFooter>
            <TermsConditionsPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/fair-practice" element={
          <LayoutWithHeaderFooter>
            <FairPracticeCodePage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/it-policy" element={
          <LayoutWithHeaderFooter>
            <ITPolicy />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/fees-policy" element={
          <LayoutWithHeaderFooter>
            <FeesPolicy />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/refund-cancellation-policy" element={
          <LayoutWithHeaderFooter>
            <RefundCancellationPolicyPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/partners" element={
          <LayoutWithHeaderFooter>
            <PartnersPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/media" element={
          <LayoutWithHeaderFooter>
            <MediaPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/careers" element={
          <LayoutWithHeaderFooter>
            <CareersPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/grievance" element={
          <LayoutWithHeaderFooter>
            <GrievanceRedressalPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/it-fees-fair-practice-policy" element={
          <LayoutWithHeaderFooter>
            <DisclaimerPage />
          </LayoutWithHeaderFooter>
        } />

        <Route path="/auth" element={
          <LayoutWithHeaderFooter>
            <AuthOnlyRoute>
              <AuthPage />
            </AuthOnlyRoute>
          </LayoutWithHeaderFooter>
        } />


        <Route path="/application" element={
          <DashboardLayout>
            <SimplifiedLoanApplicationPage />
          </DashboardLayout>
        } />


        <Route path="/loan-application/confirm" element={
          <DashboardLayout>
            <LoanApplicationConfirmation />
          </DashboardLayout>
        } />

        <Route path="/loan-application/bank-details" element={
          isAuthenticated ? (
            <BankDetailsRedirect />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />


        <Route path="/user-references" element={
          <DashboardLayout>
            <EnhancedUserReferencesPage />
          </DashboardLayout>
        } />

        <Route path="/loan-application/kyc-verification" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="kyc-verification">
                <DigilockerKYCPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/credit-analytics" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="credit-analytics">
                <CreditAnalyticsPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/kyc-check" element={
          isAuthenticated ? (
            <DashboardLayout>
              <KYCCheckPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/upload-documents" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="upload-documents">
                <LoanDocumentUploadPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/post-disbursal" element={
          isAuthenticated ? (
            <DashboardLayout>
              <PostDisbursalFlowPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/repayment-schedule" element={
          isAuthenticated ? (
            <DashboardLayout>
              <RepaymentSchedulePage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/payment/return" element={
          isAuthenticated ? (
            <DashboardLayout>
              <PaymentReturnPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/enach-completion" element={
          isAuthenticated ? (
            <DashboardLayout>
              <EnachCompletionPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/bank-statement" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="bank-statement">
                <BankStatementUploadPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/bank-statement" element={
          isAuthenticated ? (
            <DashboardLayout>
              <BankStatementUploadPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/bank-statement-success" element={
          isAuthenticated ? (
            <BankStatementSuccessPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/link-salary-bank-account" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="bank-details">
                <LinkSalaryBankAccountPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/email-verification" element={
          isAuthenticated ? (
            <EmailVerificationPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/residence-address" element={
          isAuthenticated ? (
            <ResidenceAddressPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/additional-information" element={
          isAuthenticated ? (
            <AdditionalInformationPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/application-under-review" element={
          isAuthenticated ? (
            <ApplicationUnderReviewPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/aa-flow" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="aa-consent">
                <AccountAggregatorFlow />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/employment-details" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="employment-details">
                <EmploymentDetailsPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/credit-check" element={
          isAuthenticated ? (
            <DashboardLayout>
              <CreditCheckPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />


        <Route path="/admin-access" element={<AdminAccessPage />} />

        {/* Dashboard Pages (No Header/Footer) */}
        <Route path="/profile-completion" element={
          isAuthenticated ? (
            <StatusGuard>
              {user?.status === 'active' && user?.profile_completion_step >= 2 && user?.profile_completed ? (
                <Navigate to="/dashboard" replace />
              ) : user?.profile_completed ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <DashboardLayout>
                  <ErrorBoundary>
                    <ProfileCompletionPageSimple />
                  </ErrorBoundary>
                </DashboardLayout>
              )}
            </StatusGuard>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/hold-status" element={
          isAuthenticated ? (
            <StatusGuard allowStatusPages>
              <HoldStatusPage />
            </StatusGuard>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/deleted-status" element={
          isAuthenticated ? (
            <StatusGuard allowStatusPages>
              <DeletedStatusPage />
            </StatusGuard>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/dashboard" element={
          isAuthenticated ? (
            <StatusGuard>
              <LoanStatusGuard>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </LoanStatusGuard>
            </StatusGuard>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/change-mobile-number" element={
          isAuthenticated ? (
            <DashboardLayout>
              <ChangeMobileNumberPage />
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/pay-emi" element={
          <DashboardLayout>
            <PayEMIPage />
          </DashboardLayout>
        } />

        <Route path="/loan-details/:loanId" element={
          <DashboardLayout>
            <LoanDetailsPage />
          </DashboardLayout>
        } />

        <Route path="/payment-history" element={
          <DashboardLayout>
            <PaymentHistoryPage />
          </DashboardLayout>
        } />

        {/* Additional Dashboard Routes */}
        <Route path="/my-loans" element={
          <DashboardLayout>
            <LoanDetailsPage />
          </DashboardLayout>
        } />

        <Route path="/profile" element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        } />

        {/* Admin Panel - moved to top level routes */}

        {/* 404 Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Toaster />
    </div>
  );
}