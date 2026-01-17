import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getAuthenticatedRedirect } from './utils/navigation';
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
import { AuthOnlyRoute, ProtectedRoute } from './components/ProtectedRoute';
import { PayEMIPage } from './components/pages/PayEMIPage';
import { DynamicLoanDetailsPage as LoanDetailsPage } from './components/pages/DynamicLoanDetailsPage';
import { DynamicPaymentHistoryPage as PaymentHistoryPage } from './components/pages/DynamicPaymentHistoryPage';
import { SimplifiedLoanApplicationPage } from './components/pages/SimplifiedLoanApplicationPage';
import LoanApplicationConfirmation from './components/pages/LoanApplicationConfirmation';
import { LoanDocumentUploadPage } from './components/pages/LoanDocumentUploadPage';
import { BankDetailsPage } from './components/pages/BankDetailsPage';
import { ReferenceDetailsPage } from './components/pages/ReferenceDetailsPage';
import { EnhancedUserReferencesPage } from './components/pages/EnhancedUserReferencesPage';
import { LoanApplicationStepsPage } from './components/pages/LoanApplicationStepsPage';
import { DigilockerKYCPage } from './components/pages/DigilockerKYCPage';
import { KYCCheckPage } from './components/pages/KYCCheckPage';
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
import { ApplicationFlow } from './components/ApplicationFlow';
import { CreditScorePage } from './components/pages/CreditScorePage';
import { StepGuard } from './components/loan-application/StepGuard';
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
import { SendEmailPage } from './components/pages/SendEmailPage';
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
  
  useEffect(() => {
    const hostname = window.location.hostname;
    const isAdminSubdomain = hostname.includes('pkk.pocketcredit.in') || hostname === 'pkk.pocketcredit.in';
    
    // If on admin subdomain, only allow /stpl paths
    if (isAdminSubdomain && !location.pathname.startsWith('/stpl')) {
      window.location.href = `https://pocketcredit.in${location.pathname}${location.search}`;
      return;
    }
    
    // If on main domain, redirect /stpl to home
    if (!isAdminSubdomain && location.pathname.startsWith('/stpl')) {
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

function AppContent() {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Initialize UTM tracking on app load
  useEffect(() => {
    initializeUTMTracking();
  }, []);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Use centralized navigation utility
  const getRedirectPath = () => getAuthenticatedRedirect(user);

  return (
    <div className="min-h-screen">
      <Routes>
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
            <DashboardLayout>
              <StepGuard step="bank-details">
                <BankDetailsPage />
              </StepGuard>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/loan-application/references" element={
          isAuthenticated ? (
            <DashboardLayout>
              <StepGuard step="references">
                <ReferenceDetailsPage />
              </StepGuard>
            </DashboardLayout>
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
            <LinkSalaryBankAccountPage />
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
            <AccountAggregatorFlow />
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

        <Route path="/loan-application/steps" element={
          <DashboardLayout>
            <LoanApplicationStepsPage />
          </DashboardLayout>
        } />

        <Route path="/admin-access" element={<AdminAccessPage />} />

        {/* Dashboard Pages (No Header/Footer) */}
        <Route path="/profile-completion" element={
          isAuthenticated ? (
            user?.status === 'on_hold' ? (
              <Navigate to="/hold-status" replace />
            ) : user?.status === 'active' && user?.profile_completion_step >= 2 && user?.profile_completed ? (
              <Navigate to="/dashboard" replace />
            ) : user?.profile_completed ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <DashboardLayout>
                <ErrorBoundary>
                  <ProfileCompletionPageSimple />
                </ErrorBoundary>
              </DashboardLayout>
            )
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/hold-status" element={
          isAuthenticated ? (
            <HoldStatusPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/deleted-status" element={
          isAuthenticated ? (
            <DeletedStatusPage />
          ) : (
            <Navigate to="/auth" replace />
          )
        } />

        <Route path="/dashboard" element={
          isAuthenticated && user?.status === 'deleted' ? (
            <Navigate to="/deleted-status" replace />
          ) : isAuthenticated && user?.status === 'on_hold' ? (
            <Navigate to="/hold-status" replace />
          ) : isAuthenticated ? (
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
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

        <Route path="/send-email" element={
          isAuthenticated ? (
            <DashboardLayout>
              <SendEmailPage />
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