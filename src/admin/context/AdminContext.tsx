import { createContext, useContext, ReactNode } from 'react';
import type { AdminUser, SubAdminCategory } from '../../AdminApp';

interface AdminContextType {
  currentUser: AdminUser | null;
  hasPermission: (permission: string) => boolean;
  canApproveLoans: boolean;
  canRejectLoans: boolean;
  canEditUsers: boolean;
  /** Reference table: edit name/phone/relation, note, delete - available to all admins including sub-admins */
  canEditReferences: boolean;
  canManageTeam: boolean;
  /** Hide Transaction sub-tab in profile for verify/QA/account manager/recovery/debt_agency */
  shouldHideTransactionTab: boolean;
  /** Debt Agency: restricted profile (personal read-only + mask PAN, limited tabs, loans only overdue) */
  isDebtAgency: boolean;
  /** NBFC Admin: mask mobile in ready for disbursement / repeat ready; show full mobile in overdue */
  isNbfcAdmin: boolean;
  /** Mask mobile numbers in profile/list (e.g. NBFC in certain views, Debt Agency) */
  shouldMaskMobile: (context?: 'overdue' | 'ready_disbursement' | 'profile') => boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

interface AdminProviderProps {
  children: ReactNode;
  currentUser: AdminUser | null;
}

const SUB_ADMINS_HIDE_TRANSACTION: SubAdminCategory[] = ['verify_user', 'qa_user', 'account_manager', 'recovery_officer', 'debt_agency'];

export function AdminProvider({ children, currentUser }: AdminProviderProps) {
  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    return currentUser.permissions.includes(permission) || currentUser.permissions?.includes('*') || currentUser.role === 'superadmin' || currentUser.role === 'super_admin';
  };

  const canApproveLoans = hasPermission('approve_loans') || ['superadmin', 'super_admin', 'manager', 'master_admin'].includes(currentUser?.role || '');
  const canRejectLoans = hasPermission('reject_loans') || ['superadmin', 'super_admin', 'manager', 'master_admin'].includes(currentUser?.role || '');
  const canEditUsers = hasPermission('edit_users') || currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin';
  const canEditReferences = !!currentUser; // All admins (including sub-admins) can edit references
  const canManageTeam = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin';

  const subCat = currentUser?.sub_admin_category;
  const shouldHideTransactionTab = !!(currentUser?.role === 'sub_admin' && subCat && SUB_ADMINS_HIDE_TRANSACTION.includes(subCat));
  const isDebtAgency = currentUser?.role === 'sub_admin' && subCat === 'debt_agency';
  const isNbfcAdmin = currentUser?.role === 'nbfc_admin';

  const shouldMaskMobile = (context?: 'overdue' | 'ready_disbursement' | 'profile'): boolean => {
    if (isNbfcAdmin) {
      if (context === 'overdue') return false;
      if (context === 'ready_disbursement' || context === 'profile') return true;
      return true;
    }
    if (isDebtAgency) return true;
    return false;
  };

  const value: AdminContextType = {
    currentUser,
    hasPermission,
    canApproveLoans,
    canRejectLoans,
    canEditUsers,
    canEditReferences,
    canManageTeam,
    shouldHideTransactionTab,
    isDebtAgency,
    isNbfcAdmin,
    shouldMaskMobile,
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