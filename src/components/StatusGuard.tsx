import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface StatusGuardProps {
  children: React.ReactNode;
  /**
   * If true, allows access to hold-status and deleted-status pages
   * even when user has those statuses (prevents redirect loops)
   */
  allowStatusPages?: boolean;
}

/**
 * StatusGuard component that handles high-level user status redirects
 * - Redirects users with 'on_hold' status to /hold-status
 * - Redirects users with 'deleted' status to /deleted-status
 * - Only applies to authenticated users
 */
export function StatusGuard({ children, allowStatusPages = false }: StatusGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Only apply status checks to authenticated users
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  // If allowStatusPages is true, don't redirect from status pages themselves
  // This prevents redirect loops when user is on /hold-status or /deleted-status
  if (allowStatusPages) {
    return <>{children}</>;
  }

  // Redirect based on user status
  if (user.status === 'deleted') {
    return <Navigate to="/deleted-status" replace />;
  }

  if (user.status === 'on_hold') {
    return <Navigate to="/hold-status" replace />;
  }

  // User has valid status, render children
  return <>{children}</>;
}
