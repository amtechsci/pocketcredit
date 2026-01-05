import { useState, useEffect } from 'react';
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
import { KFSDocument } from './admin/pages/KFSDocument';
import { LoanAgreementDocument } from './admin/pages/LoanAgreementDocument';
import { ExtensionLetterDocument } from './admin/pages/ExtensionLetterDocument';
import { SearchResultsPage } from './admin/pages/SearchResultsPage';
import { PoliciesManagement } from './admin/pages/PoliciesManagement';
import { PayoutPage } from './admin/pages/PayoutPage';
import { AdminProvider } from './admin/context/AdminContext';
import { Logo } from './components/Logo';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'manager' | 'officer';
  permissions: string[];
}

// Admin Layout Component
function AdminLayout({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const user = localStorage.getItem('adminUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      // Only redirect if not already on login page
      if (location.pathname !== '/admin/login') {
        navigate('/admin/login');
      }
    }
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    setCurrentUser(null);
    navigate('/admin/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (!currentUser) {
    return null; // Will redirect to login
  }

  return (
    <AdminProvider currentUser={currentUser}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Logo size="sm" variant="default" />
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/dashboard') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/admin/applications')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/applications') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Applications
                </button>
                <button
                  onClick={() => navigate('/admin/extensions')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/extensions') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Extensions
                </button>
                <button
                  onClick={() => navigate('/admin/payout')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/payout') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Payout
                </button>
                <button
                  onClick={() => navigate('/admin/users')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/users') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => navigate('/admin/users?status=on_hold')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.search === '?status=on_hold'
                      ? 'bg-red-100 text-red-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Hold
                </button>
                <button
                  onClick={() => navigate('/admin/users?status=deleted')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.search === '?status=deleted'
                      ? 'bg-gray-800 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Delete
                </button>
                <button
                  onClick={() => navigate('/admin/activity-logs')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/activity-logs') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Activity Logs
                </button>
                <button
                  onClick={() => navigate('/admin/reports')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/reports') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Reports
                </button>
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => navigate('/admin/team-management')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/admin/team-management') 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Team Management
                  </button>
                )}
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => navigate('/admin/policies')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/admin/policies') 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Policies
                  </button>
                )}
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => navigate('/admin/settings')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/admin/settings') 
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
                  window.open('/admin/search', '_blank');
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
    navigate('/admin/dashboard');
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

  useEffect(() => {
    const user = localStorage.getItem('adminUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      // Only redirect if not already on login page
      if (location.pathname !== '/admin/login') {
        navigate('/admin/login');
      }
    }
  }, [navigate, location.pathname]);

  if (!currentUser) {
    return null; // Will redirect to login
  }

  return <AdminLayout>{children}</AdminLayout>;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
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
      <Route path="payout" element={
        <ProtectedRoute>
          <PayoutPage />
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
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}