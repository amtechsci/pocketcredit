import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/dashboard' }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      // User is already logged in, redirect to dashboard
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, user, navigate, redirectTo]);

  // If user is authenticated, don't render the children (auth page)
  if (isAuthenticated && user) {
    return null; // or a loading spinner
  }

  // If user is not authenticated, show the auth page
  return <>{children}</>;
}

// Reverse protected route - only allows access if NOT authenticated
export function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      // User is already logged in, redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is authenticated, don't render the children (auth page)
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show the auth page
  return <>{children}</>;
}
