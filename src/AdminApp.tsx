import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AdminLogin } from './admin/AdminLogin';
import { AdminDashboard } from './admin/pages/AdminDashboard';
import { LoanApplicationsQueue } from './admin/pages/LoanApplicationsQueue';
import { UserProfileDetail } from './admin/pages/UserProfileDetail';
import { AdminTeamManagement } from './admin/pages/AdminTeamManagement';
import { AdminReports } from './admin/pages/AdminReports';
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
      navigate('/admin/login');
    }
  }, [navigate]);

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
                <span className="font-semibold text-gray-900">Pocket Credit Admin</span>
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
              </nav>
            </div>
            <div className="flex items-center gap-4">
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

  useEffect(() => {
    const user = localStorage.getItem('adminUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    } else {
      navigate('/admin/login');
    }
  }, [navigate]);

  if (!currentUser) {
    return null; // Will redirect to login
  }

  return <AdminLayout>{children}</AdminLayout>;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="login" replace />} />
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
      <Route path="user-profile/:userId" element={
        <ProtectedRoute>
          <UserProfileDetail />
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
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}