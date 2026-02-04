import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AdminLogin } from './admin/AdminLogin';
import { AdminDashboard } from './admin/pages/AdminDashboard';
import { LoanApplicationsQueue } from './admin/pages/LoanApplicationsQueue';
import { UserProfileDetail } from './admin/pages/UserProfileDetail';
import { AdminUsersPage } from './admin/pages/AdminUsersPage';
import { PendingExtensionsPage } from './admin/pages/PendingExtensionsPage';
import { ActivityLogsPage } from './admin/pages/ActivityLogsPage';
import { AdminTeamManagement } from './admin/pages/AdminTeamManagement';
import { AdminReports } from './admin/pages/AdminReports';
import { AdminSettings } from './admin/pages/AdminSettings';
import { SystemSettings } from './admin/pages/SystemSettings';
import { SmsTemplatesPage } from './admin/pages/SmsTemplatesPage';
import { KFSDocument } from './admin/pages/KFSDocument';
import { LoanAgreementDocument } from './admin/pages/LoanAgreementDocument';
import { ExtensionLetterDocument } from './admin/pages/ExtensionLetterDocument';
import { NOCDocument } from './admin/pages/NOCDocument';
import { SearchResultsPage } from './admin/pages/SearchResultsPage';
import { PoliciesManagement } from './admin/pages/PoliciesManagement';
import { CoolingPeriodPage } from './admin/pages/CoolingPeriodPage';
import { RegisteredPage } from './admin/pages/RegisteredPage';
import { ApprovedPage } from './admin/pages/ApprovedPage';
import { QAVerificationPage } from './admin/pages/QAVerificationPage';
import { AdminProvider } from './admin/context/AdminContext';
import { Logo } from './components/Logo';
import { useAdminAutoLogout } from './admin/hooks/useAdminAutoLogout';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'superadmin' | 'manager' | 'officer';
  department?: string;
  permissions: string[];
}

// Base path is always /stpl
const BASE_PATH = '/stpl';

// Admin Layout Component
function AdminLayout({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check if this is an internal call (for PDF generation)
  const searchParams = new URLSearchParams(location.search);
  const isInternalCall = searchParams.get('internal') === 'true';

  useEffect(() => {
    // Skip authentication for internal calls
    if (isInternalCall) {
      return;
    }

    // Check if user is authenticated
    const user = localStorage.getItem('adminUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      // Only redirect if not already on login page
      if (location.pathname !== '/stpl/login') {
        navigate(`${BASE_PATH}/login`);
      }
    }
  }, [navigate, location.pathname, isInternalCall]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    setCurrentUser(null);
    navigate(`${BASE_PATH}/login`);
  }, [navigate]);

  // Auto-logout after 20 minutes of inactivity
  useAdminAutoLogout({
    onLogout: handleLogout,
    enabled: !!currentUser
  });

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Allow rendering for internal calls even without authentication
  if (!currentUser && !isInternalCall) {
    return null; // Will redirect to login
  }

  // For internal calls, render children without layout
  if (isInternalCall) {
    return (
      <AdminProvider currentUser={currentUser || { id: 0, name: 'Internal', email: '', role: 'officer', permissions: [] }}>
        {children}
      </AdminProvider>
    );
  }

  return (
    <AdminProvider currentUser={currentUser || { id: 0, name: 'Internal', email: '', role: 'officer', permissions: [] }}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Logo size="sm" variant="default" />
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => navigate(`${BASE_PATH}/dashboard`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/dashboard`)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/applications`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/applications`)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Applications
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/users`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/users`)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Users
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/registered`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/registered`)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Registered
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/approved`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/approved`)
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/cooling-period`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/cooling-period`)
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Cooling Period
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/qa-verification`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/qa-verification`)
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  QA Verification
                </button>
                <button
                  onClick={() => navigate(`${BASE_PATH}/reports`)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/reports`)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Reports
                </button>
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => navigate(`${BASE_PATH}/team-management`)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/team-management`)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Team Management
                  </button>
                )}
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => navigate(`${BASE_PATH}/settings`)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(`${BASE_PATH}/settings`)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Settings
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {/* Search Button */}
              <button
                onClick={() => {
                  window.open(`${BASE_PATH}/search`, '_blank');
                }}
                className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{currentUser?.name}</div>
                <div className="text-xs text-gray-500 capitalize">{currentUser?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </AdminProvider>
  );
}

// Login Page Component
function AdminLoginPage() {
  const navigate = useNavigate();

  const handleLogin = (user: AdminUser) => {
    localStorage.setItem('adminUser', JSON.stringify(user));
    navigate(`${BASE_PATH}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminLogin onLogin={handleLogin} />
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if this is an internal call (for PDF generation)
  const searchParams = new URLSearchParams(location.search);
  const isInternalCall = searchParams.get('internal') === 'true';

  useEffect(() => {
    // Skip authentication for internal calls
    if (isInternalCall) {
      return;
    }

    const user = localStorage.getItem('adminUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      // Only redirect if not already on login page
      if (location.pathname !== '/stpl/login') {
        navigate(`${BASE_PATH}/login`);
      }
    }
  }, [navigate, location.pathname, isInternalCall]);

  // Allow rendering for internal calls even without authentication
  if (!currentUser && !isInternalCall) {
    return null; // Will redirect to login
  }

  return <AdminLayout>{children}</AdminLayout>;
}

// Component to redirect to login
function AdminRedirect() {
  return <Navigate to={`${BASE_PATH}/login`} replace />;
}

import { Toaster } from './components/ui/sonner';

export default function AdminApp() {
  return (
    <>
      <Routes>
        <Route path="/" element={<AdminRedirect />} />
        <Route path="login" element={<AdminLoginPage />} />
        <Route path="dashboard" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="applications" element={
          <ProtectedRoute>
            <LoanApplicationsQueue />
          </ProtectedRoute>
        } />
        <Route path="extensions" element={
          <ProtectedRoute>
            <PendingExtensionsPage />
          </ProtectedRoute>
        } />
        <Route path="user-profile/:userId" element={
          <ProtectedRoute>
            <UserProfileDetail />
          </ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute>
            <AdminUsersPage />
          </ProtectedRoute>
        } />
        <Route path="cooling-period" element={
          <ProtectedRoute>
            <CoolingPeriodPage />
          </ProtectedRoute>
        } />
        <Route path="registered" element={
          <ProtectedRoute>
            <RegisteredPage />
          </ProtectedRoute>
        } />
        <Route path="approved" element={
          <ProtectedRoute>
            <ApprovedPage />
          </ProtectedRoute>
        } />
        <Route path="qa-verification" element={
          <ProtectedRoute>
            <QAVerificationPage />
          </ProtectedRoute>
        } />
        <Route path="activity-logs" element={
          <ProtectedRoute>
            <ActivityLogsPage />
          </ProtectedRoute>
        } />
        <Route path="team-management" element={
          <ProtectedRoute>
            <AdminTeamManagement />
          </ProtectedRoute>
        } />
        <Route path="reports" element={
          <ProtectedRoute>
            <AdminReports />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="policies" element={
          <ProtectedRoute>
            <PoliciesManagement />
          </ProtectedRoute>
        } />
        <Route path="system-settings" element={
          <ProtectedRoute>
            <SystemSettings />
          </ProtectedRoute>
        } />
        <Route path="sms-templates" element={
          <ProtectedRoute>
            <SmsTemplatesPage />
          </ProtectedRoute>
        } />
        <Route path="kfs/:loanId" element={
          <ProtectedRoute>
            <KFSDocument />
          </ProtectedRoute>
        } />
        <Route path="loan-agreement/:loanId" element={
          <ProtectedRoute>
            <LoanAgreementDocument />
          </ProtectedRoute>
        } />
        <Route path="extension-letter/:loanId" element={
          <ProtectedRoute>
            <ExtensionLetterDocument />
          </ProtectedRoute>
        } />
        <Route path="noc/:loanId" element={
          <ProtectedRoute>
            <NOCDocument />
          </ProtectedRoute>
        } />
        <Route path="search" element={
          <ProtectedRoute>
            <SearchResultsPage />
          </ProtectedRoute>
        } />
        <Route path="users/:userId" element={
          <ProtectedRoute>
            <UserProfileDetail />
          </ProtectedRoute>
        } />
        <Route path="*" element={<AdminRedirect />} />
      </Routes>
      <Toaster />
    </>
  );
}