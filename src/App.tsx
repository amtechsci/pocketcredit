import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import { AuthOnlyRoute, ProtectedRoute } from './components/ProtectedRoute';
import { PayEMIPage } from './components/pages/PayEMIPage';
import { DynamicLoanDetailsPage as LoanDetailsPage } from './components/pages/DynamicLoanDetailsPage';
import { DynamicPaymentHistoryPage as PaymentHistoryPage } from './components/pages/DynamicPaymentHistoryPage';
import { SimplifiedLoanApplicationPage } from './components/pages/SimplifiedLoanApplicationPage';
import LoanApplicationConfirmation from './components/pages/LoanApplicationConfirmation';
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
import { AccountAggregatorFlow } from './components/pages/AccountAggregatorFlow';
import { ApplicationFlow } from './components/ApplicationFlow';
import { CreditScorePage } from './components/pages/CreditScorePage';
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
import { Logo } from './components/Logo';
import AdminApp from './AdminApp';

import { Toaster } from './components/ui/sonner';

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
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      {children}
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
              href="/admin"
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
                <div className="mt-6 pt-4 border-t text-left">
                  <p className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>Super Admin: admin@pocketcredit.com</div>
                    <div>Manager: manager@pocketcredit.com</div>
                    <div>Officer: officer@pocketcredit.com</div>
                    <div className="mt-2">Password: <code className="bg-gray-100 px-1 rounded">admin123</code></div>
                  </div>
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
  return (
    <Routes>
      {/* Admin routes - no AuthProvider needed */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={<AdminApp />} />
      
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
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminLogin onLogin={handleLogin} />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, user, isLoading } = useAuth();

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
        
        <Route path="/admin/login" element={
          <LayoutWithHeaderFooter>
            <AdminLoginPage />
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
          <DashboardLayout>
            <BankDetailsPage />
          </DashboardLayout>
        } />
        
        <Route path="/loan-application/references" element={
          <DashboardLayout>
            <ReferenceDetailsPage />
          </DashboardLayout>
        } />
        
        <Route path="/user-references" element={
          <DashboardLayout>
            <EnhancedUserReferencesPage />
          </DashboardLayout>
        } />
        
        <Route path="/loan-application/kyc-verification" element={
          isAuthenticated ? (
            <DashboardLayout>
              <DigilockerKYCPage />
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
        
        <Route path="/loan-application/bank-statement" element={
          isAuthenticated ? (
            <DashboardLayout>
              <BankStatementUploadPage />
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
              <EmploymentDetailsPage />
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
            <DashboardLayout>
              <ErrorBoundary>
                <ProfileCompletionPageSimple />
              </ErrorBoundary>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />
        
        <Route path="/dashboard" element={
          isAuthenticated ? (
            user?.profile_completed ? (
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            ) : (
              <Navigate to="/profile-completion" replace />
            )
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