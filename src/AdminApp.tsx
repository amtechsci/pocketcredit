import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, Settings, LogOut, ChevronDown } from 'lucide-react';
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
import { AdminPartnersPage } from './admin/pages/AdminPartnersPage';
import { CoolingPeriodPage } from './admin/pages/CoolingPeriodPage';
import { RegisteredPage } from './admin/pages/RegisteredPage';
import { ApprovedPage } from './admin/pages/ApprovedPage';
import { QAVerificationPage } from './admin/pages/QAVerificationPage';
import { AccountManagerPage } from './admin/pages/AccountManagerPage';
import { OverduePage } from './admin/pages/OverduePage';
import { AdminProvider } from './admin/context/AdminContext';
import { Logo } from './components/Logo';
import { useAdminAutoLogout } from './admin/hooks/useAdminAutoLogout';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from './components/ui/avatar';

export type AdminRole = 'superadmin' | 'manager' | 'officer' | 'super_admin' | 'master_admin' | 'nbfc_admin' | 'sub_admin';
export type SubAdminCategory = 'verify_user' | 'qa_user' | 'account_manager' | 'recovery_officer' | 'debt_agency';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminRole;
  department?: string;
  sub_admin_category?: SubAdminCategory | null;
  permissions: string[];
}

// Base path is always /stpl
const BASE_PATH = '/stpl';

// Admin Layout Component
function AdminLayout({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    setCurrentUser(null);
    navigate(`${BASE_PATH}/login`);
  }, [navigate]);

  // Listen for session warnings from backend (logout is handled by backend middleware)
  useAdminAutoLogout({
    enabled: !!currentUser
  });

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin';
  const subCat = currentUser?.sub_admin_category;
  const navByRole: { path: string; label: string; color: string }[] = [];
  if (currentUser?.role === 'sub_admin') {
    if (subCat === 'verify_user') {
      navByRole.push({ path: `${BASE_PATH}/applications`, label: 'Applications', color: 'blue' });
    } else if (subCat === 'qa_user') {
      navByRole.push({ path: `${BASE_PATH}/qa-verification`, label: 'QA Verification', color: 'cyan' });
    } else if (subCat === 'account_manager') {
      navByRole.push({ path: `${BASE_PATH}/account-manager`, label: 'Account Manager', color: 'purple' });
      navByRole.push({ path: `${BASE_PATH}/applications`, label: 'Applications', color: 'blue' });
    } else if (subCat === 'recovery_officer' || subCat === 'debt_agency') {
      navByRole.push({ path: `${BASE_PATH}/overdue`, label: 'Over Due', color: 'red' });
    }
  } else if (currentUser?.role === 'nbfc_admin') {
    navByRole.push(
      { path: `${BASE_PATH}/overdue`, label: 'Over Due', color: 'red' },
      { path: `${BASE_PATH}/applications`, label: 'Applications', color: 'blue' }
    );
  } else {
    navByRole.push(
      { path: `${BASE_PATH}/dashboard`, label: 'Dashboard', color: 'blue' },
      { path: `${BASE_PATH}/applications`, label: 'Applications', color: 'blue' },
      { path: `${BASE_PATH}/account-manager`, label: 'Account Manager', color: 'purple' },
      { path: `${BASE_PATH}/users`, label: 'Users', color: 'blue' },
      { path: `${BASE_PATH}/registered`, label: 'Registered', color: 'blue' },
      { path: `${BASE_PATH}/approved`, label: 'Approved', color: 'green' },
      { path: `${BASE_PATH}/cooling-period`, label: 'Cooling Period', color: 'orange' },
      { path: `${BASE_PATH}/qa-verification`, label: 'QA Verification', color: 'cyan' },
      { path: `${BASE_PATH}/reports`, label: 'Reports', color: 'blue' }
    );
    if (isSuperAdmin) {
      navByRole.push(
        { path: `${BASE_PATH}/partners`, label: 'Partners', color: 'blue' },
        { path: `${BASE_PATH}/team-management`, label: 'Team Management', color: 'blue' }
      );
    }
  }
  const navigationItems = navByRole;
  const showSearch = isSuperAdmin || currentUser?.role === 'manager' || currentUser?.role === 'officer' || currentUser?.role === 'master_admin'
    || (currentUser?.role === 'sub_admin' && ['verify_user', 'qa_user', 'account_manager', 'recovery_officer'].includes(subCat || ''))
    || currentUser?.role === 'nbfc_admin';

  const getActiveClasses = (path: string, color: string) => {
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700',
      cyan: 'bg-cyan-100 text-cyan-700',
      purple: 'bg-purple-100 text-purple-700',
      red: 'bg-red-100 text-red-700'
    };
    return isActive(path)
      ? (colorClasses[color] || 'bg-blue-100 text-blue-700')
      : 'text-gray-600 hover:text-gray-900';
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
        <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2">
                <Logo size="sm" variant="default" />
              </div>
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-4 lg:gap-6">
                {navigationItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-2 lg:px-3 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors ${getActiveClasses(item.path, item.color)}`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {showSearch && (
                <>
                  <button
                    onClick={() => {
                      window.open(`${BASE_PATH}/search`, '_blank');
                    }}
                    className="hidden md:flex items-center gap-2 px-3 lg:px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden lg:inline">Search</span>
                  </button>
                  <button
                    onClick={() => {
                      window.open(`${BASE_PATH}/search`, '_blank');
                    }}
                    className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </>
              )}
              {/* Admin user dropdown: name click opens Settings & Logout */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 transition-colors outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                    aria-label="Open admin menu"
                  >
                    <Avatar className="h-8 w-8 border border-gray-200">
                      <AvatarFallback className="bg-gray-200 text-gray-700 text-xs font-medium">
                        {currentUser?.name?.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium text-gray-900">{currentUser?.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{currentUser?.role}</div>
                    </div>
                    <div className="sm:hidden text-left">
                      <div className="text-xs font-medium text-gray-900 truncate max-w-[80px]">{currentUser?.name}</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{currentUser?.name}</p>
                      {currentUser?.email && (
                        <p className="text-xs text-gray-500">{currentUser.email}</p>
                      )}
                      <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {currentUser?.role === 'superadmin' && (
                    <DropdownMenuItem
                      onClick={() => navigate(`${BASE_PATH}/settings`)}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Menu Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
            <SheetHeader className="px-6 py-4 border-b border-gray-200">
              <SheetTitle className="text-left">Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-4 space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${getActiveClasses(item.path, item.color)} hover:bg-gray-50`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-900">{currentUser?.name}</div>
                <div className="text-xs text-gray-500 capitalize">{currentUser?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          </SheetContent>
        </Sheet>

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
        <Route path="account-manager" element={
          <ProtectedRoute>
            <AccountManagerPage />
          </ProtectedRoute>
        } />
        <Route path="overdue" element={
          <ProtectedRoute>
            <OverduePage />
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
        <Route path="partners" element={
          <ProtectedRoute>
            <AdminPartnersPage />
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