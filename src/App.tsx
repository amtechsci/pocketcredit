import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getAuthenticatedRedirect } from './utils/navigation';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/pages/HomePage';
import { PersonalLoanPage } from './components/pages/PersonalLoanPage';
import { BusinessLoanPage } from './components/pages/BusinessLoanPage';
import { AuthPage } from './components/pages/AuthPage';
import { AdminLoginPage } from './components/pages/AdminLoginPage';
import { ProfileCompletionPageSimple as ProfileCompletionPage } from './components/pages/ProfileCompletionPageSimple';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DynamicDashboardPage as DashboardPage } from './components/pages/DynamicDashboardPage';
import { AuthOnlyRoute, ProtectedRoute } from './components/ProtectedRoute';
import { PayEMIPage } from './components/pages/PayEMIPage';
import { DynamicLoanDetailsPage as LoanDetailsPage } from './components/pages/DynamicLoanDetailsPage';
import { DynamicPaymentHistoryPage as PaymentHistoryPage } from './components/pages/DynamicPaymentHistoryPage';
import { DynamicDocumentUploadPage as DocumentUploadPage } from './components/pages/DynamicDocumentUploadPage';
import { SimplifiedLoanApplicationPage } from './components/pages/SimplifiedLoanApplicationPage';
import { BankDetailsPage } from './components/pages/BankDetailsPage';
import { ReferenceDetailsPage } from './components/pages/ReferenceDetailsPage';
import { LoanApplicationStepsPage } from './components/pages/LoanApplicationStepsPage';
import { ApplicationFlow } from './components/ApplicationFlow';
import { CreditScorePage } from './components/pages/CreditScorePage';
import { ResourcesPage } from './components/pages/ResourcesPage';
import { ContactPage } from './components/pages/ContactPage';
import { PrivacyPolicyPage } from './components/pages/PrivacyPolicyPage';
import { TermsConditionsPage } from './components/pages/TermsConditionsPage';
import { FairPracticeCodePage } from './components/pages/FairPracticeCodePage';
import { ITPolicy } from './components/pages/ITPolicy';
import { FeesPolicy } from './components/pages/FeesPolicy';
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
                  Access the Pocket Credit Admin Panel to manage loans, users, and system operations.
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
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
                <ProfileCompletionPage />
              </ErrorBoundary>
            </DashboardLayout>
          ) : (
            <Navigate to="/auth" replace />
          )
        } />
        
        <Route path="/dashboard" element={
          isAuthenticated ? (
            user?.profile_completion_step >= 5 ? (
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
        
        <Route path="/upload-document" element={
          <DashboardLayout>
            <DocumentUploadPage />
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
        
        <Route path="/documents" element={
          <DashboardLayout>
            <DocumentUploadPage />
          </DashboardLayout>
        } />
        
        
        <Route path="/support" element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        } />
        
        <Route path="/emi-calculator" element={
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        } />
        
        {/* Admin Panel */}
        <Route path="/admin/*" element={<AdminApp />} />
        
        {/* 404 Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      <Toaster />
    </div>
  );
}