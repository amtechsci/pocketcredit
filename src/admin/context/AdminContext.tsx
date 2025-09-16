import { createContext, useContext, ReactNode } from 'react';
import type { AdminUser } from '../../AdminApp';

interface AdminContextType {
  currentUser: AdminUser | null;
  hasPermission: (permission: string) => boolean;
  canApproveLoans: boolean;
  canRejectLoans: boolean;
  canEditUsers: boolean;
  canManageTeam: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

interface AdminProviderProps {
  children: ReactNode;
  currentUser: AdminUser | null;
}

export function AdminProvider({ children, currentUser }: AdminProviderProps) {
  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    return currentUser.permissions.includes(permission) || currentUser.role === 'superadmin';
  };

  const canApproveLoans = hasPermission('approve_loans') || ['superadmin', 'manager'].includes(currentUser?.role || '');
  const canRejectLoans = hasPermission('reject_loans') || ['superadmin', 'manager'].includes(currentUser?.role || '');
  const canEditUsers = hasPermission('edit_users') || currentUser?.role === 'superadmin';
  const canManageTeam = currentUser?.role === 'superadmin';

  const value: AdminContextType = {
    currentUser,
    hasPermission,
    canApproveLoans,
    canRejectLoans,
    canEditUsers,
    canManageTeam,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}