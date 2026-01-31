import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuthenticatedRedirect } from '../utils/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute - Only allows access if NOT authenticated
 * Used for public pages like login/auth that should redirect if user is already logged in
 */
export function ProtectedRoute({ children, redirectTo }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is authenticated, redirect using centralized navigation logic
  if (isAuthenticated && user) {
    const redirectPath = redirectTo || getAuthenticatedRedirect(user);
    return <Navigate to={redirectPath} replace />;
  }

  // If user is not authenticated, show the auth page
  return <>{children}</>;
}

/**
 * AuthOnlyRoute - Only allows access if NOT authenticated
 * Alias for ProtectedRoute for backward compatibility
 */
export function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
