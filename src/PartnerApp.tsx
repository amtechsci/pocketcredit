import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PartnerProvider, usePartner } from './contexts/PartnerContext';
import { PartnerLoginPage } from './components/pages/PartnerLoginPage';
import { PartnerDashboardPage } from './components/pages/PartnerDashboardPage';
import { PartnerLeadDetailPage } from './components/pages/PartnerLeadDetailPage';

function PartnerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = usePartner();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/partner/login" replace />;
  }

  return <>{children}</>;
}

function PartnerAppContent() {
  return (
    <Routes>
      <Route path="login" element={<PartnerLoginPage />} />
      <Route
        path="dashboard"
        element={
          <PartnerProtectedRoute>
            <PartnerDashboardPage />
          </PartnerProtectedRoute>
        }
      />
      <Route
        path="lead/:leadId"
        element={
          <PartnerProtectedRoute>
            <PartnerLeadDetailPage />
          </PartnerProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/partner/dashboard" replace />} />
    </Routes>
  );
}

export default function PartnerApp() {
  return (
    <PartnerProvider>
      <PartnerAppContent />
    </PartnerProvider>
  );
}
