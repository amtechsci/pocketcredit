import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import {
  CreditCard,
  User,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  CreditCard as CreditCardIcon,
  Home,
  Phone,
  Mail,
  ChevronRight,
  Share2,
  Info,
  FileText,
  ShieldCheck,
  Star,
  X,
  Loader2
} from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';
import { ApplicationFlow } from '../ApplicationFlow';
import { HoldBanner } from '../HoldBanner';
import { GraduationUpsellCard } from '../GraduationUpsellCard';
import { CreditLimitIncreaseModal } from '../modals/CreditLimitIncreaseModal';

// Types for dashboard data
interface DashboardData {
  user: {
    id: number;
    name: string;
    phone: string;
    eligibility_status?: 'eligible' | 'not_eligible' | 'pending';
    eligibility_reason?: string;
    eligibility_retry_date?: string;
    email: string;
    member_since: string;
    employment_type?: string;
    graduation_status?: 'graduated' | 'not_graduated';
    loan_limit?: number;
  };
  hold_info?: {
    is_on_hold: boolean;
    hold_type: 'permanent' | 'temporary';
    hold_reason: string;
    hold_until?: string;
    hold_until_formatted?: string;
    remaining_days?: number;
    is_expired?: boolean;
  } | null;
  financial?: {
    monthly_income?: number;
    salary_range_display?: string;
    income_range?: string;
    tier_info?: {
      tier_name: string;
      min_salary: number;
      max_salary: number | null;
      loan_limit: number;
    };
  };
  summary: {
    credit_score: number;
    experian_score: number | null;
    available_credit: number;
    total_loans: number;
    active_loans: number;
    total_loan_amount: number;
    outstanding_amount: number;
    payment_score: number;
  };
  active_loans: Array<{
    id: number;
    loan_number: string;
    loan_amount: number;
    interest_rate: number;
    tenure_months: number;
    emi_amount: number;
    status: string;
    disbursed_at: string;
    first_emi_date: string;
    loan_purpose: string;
    days_since_disbursement: number;
    completed_months: number;
    outstanding_amount: number;
    completed_tenure: number;
    progress_percentage: number;
  }>;
  upcoming_payments: Array<{
    loan_id: number;
    loan_number: string;
    emi_amount: number;
    next_emi_date: string;
    status: string;
  }>;
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    notification_type: string;
    created_at: string;
  }>;
  alerts: Array<{
    type: string;
    title: string;
    message: string;
    icon: string;
  }>;
}

export function DynamicDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLoanApplication, setShowLoanApplication] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [appliedLoans, setAppliedLoans] = useState<any[]>([]);
  const [runningLoans, setRunningLoans] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]); // All loans including cleared
  const [canApplyForLoan, setCanApplyForLoan] = useState(true);
  const [isInCoolingPeriod, setIsInCoolingPeriod] = useState(false);
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<any>(null);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);
  const [loanDocumentStatus, setLoanDocumentStatus] = useState<{ [loanId: number]: { allUploaded: boolean; hasPending: boolean } }>({});
  const [pendingCreditLimit, setPendingCreditLimit] = useState<any>(null);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [downloadingNOC, setDownloadingNOC] = useState<number | null>(null);

  // Combine applied loans (pre-disbursal) and running loans (account_manager) for "Active Loans" display
  // This ensures all in-progress loans are visible to the user
  // MUST be declared here (before any conditional returns) to satisfy Rules of Hooks
  const activeLoansForDisplay = useMemo(() => {
    const combined = [...appliedLoans, ...runningLoans];
    console.log('📊 Active Loans for Display:', {
      appliedCount: appliedLoans.length,
      runningCount: runningLoans.length,
      combinedCount: combined.length,
      statuses: combined.map(l => ({ id: l.id, status: l.status, purpose: l.loan_purpose }))
    });
    return combined;
  }, [appliedLoans, runningLoans]);

  // Calculate total outstanding amount from active loans for display
  // Only count outstanding amounts for disbursed loans (account_manager status)
  const totalOutstandingAmount = useMemo(() => {
    return activeLoansForDisplay.reduce((total, loan) => {
      // Only count outstanding amount for loans that have been disbursed (account_manager status)
      if (loan.status === 'account_manager' || loan.status === 'overdue') {
        const outstanding = loan.outstanding_amount || loan.total_outstanding || 0;
        return total + (typeof outstanding === 'number' ? outstanding : parseFloat(String(outstanding)) || 0);
      }
      // Pre-disbursal loans (applied loans) have no outstanding amount yet
      return total;
    }, 0);
  }, [activeLoansForDisplay]);

  // Load dashboard data - consolidated to fetch all data in one flow
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Note: Status-based redirects (on_hold, deleted) are now handled by StatusGuard in App.tsx
      // No need to check here - StatusGuard will redirect before this component renders

      // Clear dashboard cache and fetch fresh data to get accurate profile status
      apiService.clearCache('/dashboard');
      
      // Fetch with cache bypass to ensure fresh profile status
      const response = await apiService.getDashboardSummary({ cache: false, skipDeduplication: true });

      if (response.status === 'success' && response.data) {
        setDashboardData(response.data);
        const data = response.data as any;
        if (data.loan_status) {
          // Also check loan_limit from user data as additional safety check
          const userLoanLimit = parseFloat(data.user?.loan_limit) || 0;
          const isLimitAboveThreshold = userLoanLimit >= 45600;
          // User cannot apply if limit >= ₹45,600 OR if loan_status says they can't
          setCanApplyForLoan(data.loan_status.can_apply && !isLimitAboveThreshold);
          // Set cooling period flag for display
          setIsInCoolingPeriod(isLimitAboveThreshold || (data.hold_info?.is_on_hold && data.hold_info?.hold_type === 'cooling_period'));
        }
      } else if (response.status === 'profile_incomplete') {
        const incompleteData = response.data as any;
        console.log('Profile incomplete:', incompleteData);
        
        // Only redirect if we're actually on the dashboard page
        // Don't redirect if already on profile-completion or other pages
        if (location.pathname !== '/profile-completion') {
          // Check if we're in a redirect loop
          const redirectCount = parseInt(sessionStorage.getItem('profileRedirectCount') || '0', 10);
          const lastRedirectTime = parseInt(sessionStorage.getItem('profileRedirectTime') || '0', 10);
          const now = Date.now();
          
          // Reset counter if more than 10 seconds have passed (give more time)
          if (now - lastRedirectTime > 10000) {
            sessionStorage.setItem('profileRedirectCount', '1');
            sessionStorage.setItem('profileRedirectTime', now.toString());
            console.log('Redirecting to profile-completion (first time or after timeout)');
            navigate('/profile-completion', { replace: true });
          } else if (redirectCount < 3) {
            // Allow up to 3 redirects within 10 seconds
            sessionStorage.setItem('profileRedirectCount', (redirectCount + 1).toString());
            console.log(`Redirecting to profile-completion (attempt ${redirectCount + 1})`);
            navigate('/profile-completion', { replace: true });
          } else {
            // Too many redirects - show error and stay on dashboard
            console.error('Redirect loop detected, staying on dashboard');
            setError('Profile setup incomplete. Please complete your profile to continue.');
            sessionStorage.removeItem('profileRedirectCount');
            sessionStorage.removeItem('profileRedirectTime');
          }
        } else {
          // Already on profile-completion page, just show error
          console.log('Already on profile-completion page, not redirecting');
          setError('Please complete your profile to continue.');
        }
        return;
      } else {
        setError('Failed to load dashboard data');
      }

      // Check for pending credit limit increase
      try {
        const creditLimitResponse = await apiService.getPendingCreditLimit();
        console.log('📊 Pending credit limit response:', creditLimitResponse);
        if ((creditLimitResponse.status === 'success' || creditLimitResponse.success === true) &&
          (creditLimitResponse as any).hasPendingLimit &&
          creditLimitResponse.data) {
          console.log('✅ Found pending credit limit:', creditLimitResponse.data);
          setPendingCreditLimit(creditLimitResponse.data);
          setShowCreditLimitModal(true);
        } else {
          console.log('ℹ️ No pending credit limit found:', {
            status: creditLimitResponse.status,
            success: creditLimitResponse.success,
            hasPendingLimit: (creditLimitResponse as any).hasPendingLimit,
            hasData: !!creditLimitResponse.data
          });
        }
      } catch (creditLimitError) {
        console.error('Error fetching pending credit limit:', creditLimitError);
        // Don't block dashboard if this fails
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fetch pending loan applications and split them into applied and running loans
  const fetchPendingApplications = useCallback(async () => {
    try {
      console.log('🔄 Fetching pending applications...');
      const response = await apiService.getPendingLoanApplications();

      console.log('📊 Pending applications response:', response);

      if (response.status === 'success' || response.success === true) {
        const applications = response.data?.applications || [];
        console.log('📋 Raw applications:', applications);

        // Remove duplicates based on application ID
        const uniqueApplications = applications.filter((app: any, index: number, self: any[]) =>
          index === self.findIndex((a: any) => a.id === app.id)
        );

        console.log('✅ Unique applications:', uniqueApplications);

        // Split applications into applied loans and running loans
        // Applied: Pre-disbursal statuses (submitted, under_review, follow_up, ready_for_disbursement, ready_to_repeat_disbursal, qa_verification)
        const applied = uniqueApplications.filter((app: any) =>
          ['submitted', 'under_review', 'follow_up', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'qa_verification'].includes(app.status)
        );

        // Running loans: Only active loans with account manager (NOT cleared, NOT ready_for_disbursement)
        const running = uniqueApplications.filter((app: any) =>
          app.status === 'account_manager'
        );

        // All loans includes everything (for My Loans history tab, including cleared loans)
        const all = uniqueApplications;

        // Check document status for follow_up loans
        const documentStatusChecks = applied
          .filter((app: any) => app.status === 'follow_up')
          .map(async (app: any) => {
            try {
              const validationResponse = await apiService.request<any>('GET', `/validation/user/history?loanApplicationId=${app.id}`, {});
              if (validationResponse.status === 'success' && validationResponse.data) {
                const documentActions = validationResponse.data.filter(
                  (action: any) => action.action_type === 'need_document' && action.loan_application_id === app.id
                );

                if (documentActions.length > 0) {
                  const latestAction = documentActions[0];
                  const documents = latestAction.action_details?.documents || [];

                  if (documents.length > 0) {
                    const docsResponse = await apiService.getLoanDocuments(app.id);
                    if (docsResponse.success || docsResponse.status === 'success') {
                      const uploadedDocs = docsResponse.data?.documents || [];
                      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

                      const allUploaded = documents.every((doc: string) => {
                        const normalizedDoc = normalize(doc);
                        return uploadedDocs.some((uploaded: any) => {
                          const normalizedUploaded = normalize(uploaded.document_name || '');
                          return normalizedDoc === normalizedUploaded ||
                            normalizedDoc.includes(normalizedUploaded) ||
                            normalizedUploaded.includes(normalizedDoc);
                        });
                      });

                      setLoanDocumentStatus(prev => ({
                        ...prev,
                        [app.id]: { allUploaded, hasPending: true }
                      }));
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Error checking document status for loan ${app.id}:`, error);
            }
          });

        // Run document status checks in parallel (don't await - let it run in background)
        Promise.all(documentStatusChecks).catch(err => console.error('Error checking document statuses:', err));

        console.log('🔍 Loan Categorization:', {
          total: uniqueApplications.length,
          applied: applied.length,
          running: running.length,
          allStatuses: uniqueApplications.map(a => ({ id: a.id, status: a.status })),
          appliedStatuses: applied.map(a => ({ id: a.id, status: a.status })),
          runningStatuses: running.map(a => ({ id: a.id, status: a.status }))
        });

        setPendingApplications(uniqueApplications);
        setAppliedLoans(applied);
        setRunningLoans(running);
        setAllLoans(all);
      } else {
        console.log('❌ Response not successful:', response);
        setPendingApplications([]);
        setAppliedLoans([]);
        setRunningLoans([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching pending applications:', error);

      // Handle timeout errors specifically
      if (error.message?.includes('timeout')) {
        console.warn('API timeout - this might be a server issue. Retrying in 5 seconds...');
        // Retry after 5 seconds
        setTimeout(() => {
          fetchPendingApplications();
        }, 5000);
      }

      // Set empty array to prevent UI issues
      setPendingApplications([]);
      setAppliedLoans([]);
      setRunningLoans([]);
      setAllLoans([]);
    }
  }, []);

  // Consolidated effect: Load dashboard data and pending applications together
  // Only runs when user changes (not on every render) to prevent duplicate API calls
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth');
      return;
    }

    // Load dashboard data only if not already loaded
    if (!dashboardData) {
      loadDashboardData();
    }

    // Fetch pending applications - this is separate data that may need refreshing
    fetchPendingApplications();
  }, [isAuthenticated, user?.id]); // Only depend on user.id to prevent unnecessary re-fetches

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(0)}K`;
    } else {
      return `₹${amount}`;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Loan ID: PLL + loan_application.id (unique)
  const formatLoanId = (loanId: number | string | null | undefined) => {
    if (loanId == null || loanId === '') return 'N/A';
    const id = typeof loanId === 'string' ? parseInt(loanId, 10) : loanId;
    if (isNaN(id)) return 'N/A';
    return `PLL${id}`;
  };

  // Handle NOC PDF download
  const handleDownloadNOC = async (loanId: number, applicationNumber: string) => {
    try {
      setDownloadingNOC(loanId);

      // Try to download PDF directly (backend will check if PDF exists in S3)
      // If it doesn't exist, backend will generate it automatically
      const blob = await apiService.downloadNOCPDF(loanId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `No_Dues_Certificate_${applicationNumber || loanId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('No Dues Certificate downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading NOC:', error);
      toast.error(error.message || 'Failed to download No Dues Certificate');
    } finally {
      setDownloadingNOC(null);
    }
  };

  // Get credit score category
  const getCreditScoreCategory = (score: number) => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    return 'Poor';
  };

  // Get credit score color
  const getCreditScoreColor = (score: number) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 700) return 'text-blue-600';
    if (score >= 650) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData} style={{ backgroundColor: '#0052FF' }}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  const { user: userData, summary, active_loans, alerts } = dashboardData;

  // Check if user has any active or pending loans
  const hasActiveOrPendingLoans = () => {
    const hasActiveLoans = active_loans && active_loans.length > 0;
    // Filter out cleared and cancelled loans from pendingApplications when checking if user can apply
    const activePendingApps = pendingApplications?.filter((app: any) =>
      app.status !== 'cleared' && app.status !== 'cancelled'
    ) || [];
    const hasPendingApplications = activePendingApps.length > 0;


    return hasActiveLoans || hasPendingApplications;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Desktop Welcome Section */}
      <div className="hidden lg:block">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Welcome back, {userData.name}!</h1>
                <p className="text-blue-100">Manage your loans and track payments</p>
              </div>
            </div>
            {canApplyForLoan && !hasActiveOrPendingLoans() && (
              <Button
                onClick={() => {
                  console.log('Apply for a Loan button clicked');
                  navigate('/application');
                }}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                variant="outline"
                type="button"
              >
                Apply New Loan
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Hide Credit Score for students */}
            {userData.employment_type !== 'student' && (
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-blue-100 text-sm">Pocket Credit Score</p>
                </div>
                <p className="text-3xl font-bold">{summary.credit_score}</p>
                <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                  {getCreditScoreCategory(summary.credit_score)} (+25 this month)
                </p>
                {summary.experian_score !== null && summary.experian_score !== undefined && summary.experian_score !== '' ? (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-blue-100 text-xs mb-1">Experian Score</p>
                    <p className="text-lg font-semibold">{summary.experian_score}</p>
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-blue-100 text-xs mb-1">Experian Score</p>
                    <p className="text-lg font-semibold text-blue-200">N/A</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-[10px] text-blue-100 leading-tight">
                    For any dispute related concerns please reach out to{' '}
                    <a
                      href="https://consumer.experian.in/ECSINDIA-DCE/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-blue-200 hover:underline font-semibold"
                    >
                      Experian Customer Dispute Portal
                    </a>
                  </p>
                </div>
              </div>
            )}
            {/* Hide loan stats for students */}
            {userData.employment_type !== 'student' && activeLoansForDisplay.length > 0 && (
              <>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCardIcon className="w-5 h-5" />
                    <p className="text-blue-100 text-sm">Active Loans</p>
                  </div>
                  <p className="text-3xl font-bold">{activeLoansForDisplay.length}</p>
                  <p className="text-xs text-blue-200">{formatCurrency(totalOutstandingAmount)} outstanding</p>
                </div>

              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Welcome Section */}
      <div className="lg:hidden w-full">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold truncate">Welcome back, {userData.name}!</h2>
              <p className="text-blue-100 text-xs">Manage your loans and track payments</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Hide Credit Score for students */}
            {userData.employment_type !== 'student' && (
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-blue-100 text-xs">Pocket Credit Score</p>
                <p className="text-xl font-bold">{summary.credit_score}</p>
                <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                  {getCreditScoreCategory(summary.credit_score)}
                </p>
                {summary.experian_score !== null && summary.experian_score !== undefined && summary.experian_score !== '' ? (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-blue-100 text-[10px] mb-1">Experian Score</p>
                    <p className="text-base font-semibold">{summary.experian_score}</p>
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-blue-100 text-[10px] mb-1">Experian Score</p>
                    <p className="text-base font-semibold text-blue-200">N/A</p>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-white/20">
                  <p className="text-[10px] text-blue-100 leading-tight">
                    For any dispute related concerns please reach out to{' '}
                    <a
                      href="https://consumer.experian.in/ECSINDIA-DCE/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-blue-200 hover:underline font-semibold"
                    >
                      Experian Customer Dispute Portal
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts/Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alerts.map((alert, index) => (
          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">{alert.title}</p>
              <p className="text-xs text-blue-700">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>



      {/* Desktop Enhanced Layout */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Main Content */}
          <div className="col-span-8 space-y-6">

            {/* Active Loan Details */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  Active Loans
                </h3>
              </div>

              {activeLoansForDisplay.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activeLoansForDisplay.map((loan) => (
                    <Card key={loan.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold truncate">{loan.loan_purpose || 'Personal Loan'}</h4>
                          <p className="text-gray-600 text-xs truncate">App: {formatLoanId(loan.id)}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0.5 ${loan.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            loan.status === 'under_review' ? 'bg-purple-100 text-purple-800' :
                              loan.status === 'follow_up' ? 'bg-yellow-100 text-yellow-800' :
                                loan.status === 'ready_for_disbursement' ? 'bg-green-100 text-green-800' :
                                  loan.status === 'ready_to_repeat_disbursal' ? 'bg-green-100 text-green-800' :
                                    loan.status === 'repeat_disbursal' ? 'bg-orange-100 text-orange-800' :
                                      loan.status === 'account_manager' ? 'bg-emerald-100 text-emerald-800' :
                                        loan.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                          'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {loan.status === 'account_manager' ? 'Active' :
                            loan.status === 'overdue' ? 'Overdue' :
                              loan.status === 'repeat_disbursal' ? 'Repeat Disbursal' :
                                loan.status === 'ready_to_repeat_disbursal' ? 'Ready for Repeat Disbursal' :
                                  loan.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Applied On</p>
                          <p className="text-xs font-medium">{formatDate(loan.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between pt-3 border-t gap-2">
                        <p className="text-[10px] text-gray-500">
                          {loan.status === 'submitted' && 'Application submitted'}
                          {loan.status === 'under_review' && 'Under review'}
                          {loan.status === 'follow_up' && 'Info required'}
                          {loan.status === 'ready_for_disbursement' && 'Ready for disbursal'}
                          {loan.status === 'ready_to_repeat_disbursal' && 'Ready for repeat disbursal'}
                          {loan.status === 'repeat_disbursal' && 'Repeat disbursal in progress'}
                          {loan.status === 'account_manager' && 'Loan is active'}
                          {loan.status === 'overdue' && 'Loan is overdue'}
                        </p>
                        <Button
                          onClick={async () => {
                            console.log('View Details clicked for:', loan.id);
                            if (loan.status === 'account_manager' || loan.status === 'overdue') {
                              navigate(`/repayment-schedule?applicationId=${loan.id}`);
                            } else if (loan.status === 'repeat_disbursal' || loan.status === 'ready_to_repeat_disbursal' || loan.status === 'ready_for_disbursement') {
                              // Check progress engine first - ReKYC might be required
                              try {
                                const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                                const progress = await getOnboardingProgress(loan.id, true); // Force refresh to check ReKYC
                                console.log(`📊 [View Status] Progress for ${loan.status}:`, progress.currentStep, 'ReKYC:', progress.prerequisites.rekycRequired);
                                
                                // If ReKYC is required or KYC is not verified, redirect to KYC page
                                if (progress.prerequisites.rekycRequired || !progress.prerequisites.kycVerified) {
                                  const kycRoute = getStepRoute('kyc-verification', loan.id);
                                  console.log(`🔄 [View Status] ReKYC required or KYC not verified, redirecting to: ${kycRoute}`);
                                  navigate(kycRoute, { replace: true });
                                  return;
                                }
                                
                                // If there's a pending onboarding step, redirect to it
                                if (progress.currentStep !== 'steps') {
                                  const route = getStepRoute(progress.currentStep, loan.id);
                                  console.log(`📊 [View Status] Pending step found, redirecting to: ${route}`);
                                  navigate(route, { replace: true });
                                  return;
                                }
                              } catch (progressError) {
                                console.error('❌ [View Status] Error checking progress for post-disbursal:', progressError);
                                // Fallback to post-disbursal if progress check fails
                              }
                              // All prerequisites complete - go to post-disbursal
                              navigate(`/post-disbursal?applicationId=${loan.id}`);
                            } else if (loan.status === 'follow_up' || loan.status === 'under_review' || loan.status === 'submitted' || loan.status === 'pending') {
                              // Use unified progress engine to determine next step for all in-progress/review statuses
                              try {
                                const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                                const progress = await getOnboardingProgress(loan.id);
                                console.log(`📊 [View Status] Progress for ${loan.status}:`, progress.currentStep);

                                // All steps complete - go to under review page
                                if (progress.currentStep === 'steps') {
                                  console.log('✅ [View Status] All steps complete, showing status page');
                                  navigate('/application-under-review');
                                  return;
                                }

                                // Otherwise go to the current pending step
                                const route = getStepRoute(progress.currentStep, loan.id);
                                console.log(`📊 [View Status] Redirecting to: ${route}`);
                                navigate(route, { replace: true });
                              } catch (progressError) {
                                console.error('❌ [View Status] Error checking progress:', progressError);
                                // Fallback: try to guess or go to status page
                                navigate('/application-under-review');
                              }
                            } else {
                              // Catch-all for other statuses
                              try {
                                const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                                const progress = await getOnboardingProgress(loan.id);
                                const route = getStepRoute(progress.currentStep, loan.id);
                                navigate(route, { replace: true });
                              } catch (e) {
                                navigate('/dashboard');
                              }
                            }

                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs whitespace-nowrap w-full"
                        >
                          {loan.status === 'account_manager'
                            ? 'View Loan'
                            : loan.status === 'repeat_disbursal' || loan.status === 'ready_to_repeat_disbursal'
                              ? 'Continue'
                              : loan.status === 'follow_up'
                                ? (loanDocumentStatus[loan.id]?.allUploaded ? 'View' : 'Upload Documents')
                                : loan.status === 'under_review' || loan.status === 'submitted'
                                  ? 'View Status'
                                  : 'View'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  {isInCoolingPeriod ? (
                    <>
                      <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Under Cooling Period</h3>
                      <div className="space-y-2">
                        <p className="text-gray-600">
                          Your profile is under cooling period. We will let you know if a new loan offer is available.
                        </p>
                        <p className="text-gray-500 text-sm">
                          You can check the status after 30 days.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Loans</h3>
                      <p className="text-gray-600 mb-4">You don't have any active loans at the moment.</p>
                      {canApplyForLoan && !hasActiveOrPendingLoans() && (
                        <Button
                          onClick={() => {
                            console.log('Apply for a Loan button clicked');
                            navigate('/application');
                          }}
                          style={{ backgroundColor: '#0052FF' }}
                        >
                          Apply for a Loan
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Graduation Upsell Card for Students */}
            {userData.employment_type === 'student' &&
              userData.graduation_status === 'not_graduated' &&
              userData.loan_limit ? (
              <GraduationUpsellCard
                currentLoanLimit={userData.loan_limit}
                onSuccess={() => {
                  fetchDashboard();
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-6">
        {/* Active Loans */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Active Loans
          </h3>

          {activeLoansForDisplay.length > 0 ? (
            <div className="space-y-3">
              {activeLoansForDisplay.map((loan) => (
                <Card key={loan.id} className="p-3 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{loan.loan_purpose || 'Personal Loan'}</h4>
                      <p className="text-gray-600 text-xs truncate">App: {formatLoanId(loan.id)}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0.5 ${loan.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        loan.status === 'under_review' ? 'bg-purple-100 text-purple-800' :
                          loan.status === 'follow_up' ? 'bg-yellow-100 text-yellow-800' :
                            loan.status === 'ready_for_disbursement' ? 'bg-green-100 text-green-800' :
                              loan.status === 'ready_to_repeat_disbursal' ? 'bg-green-100 text-green-800' :
                                loan.status === 'repeat_disbursal' ? 'bg-orange-100 text-orange-800' :
                                  loan.status === 'account_manager' ? 'bg-emerald-100 text-emerald-800' :
                                    'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {loan.status === 'account_manager' ? 'Active' :
                        loan.status === 'repeat_disbursal' ? 'Repeat Disbursal' :
                          loan.status === 'ready_to_repeat_disbursal' ? 'Ready for Repeat Disbursal' :
                            loan.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Applied On</p>
                      <p className="text-xs font-medium">{formatDate(loan.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between pt-3 border-t gap-2">
                    <p className="text-[10px] text-gray-500">
                      {loan.status === 'submitted' && 'Application submitted'}
                      {loan.status === 'under_review' && 'Under review'}
                      {loan.status === 'follow_up' && 'Info required'}
                      {loan.status === 'ready_for_disbursement' && 'Ready for disbursal'}
                      {loan.status === 'ready_to_repeat_disbursal' && 'Ready for repeat disbursal'}
                      {loan.status === 'repeat_disbursal' && 'Repeat disbursal in progress'}
                      {loan.status === 'account_manager' && 'Loan is active'}
                    </p>
                    <Button
                      onClick={async () => {
                        console.log('View Details clicked for:', loan.id);
                        if (loan.status === 'account_manager' || loan.status === 'overdue') {
                          navigate(`/repayment-schedule?applicationId=${loan.id}`);
                        } else if (loan.status === 'repeat_disbursal' || loan.status === 'ready_to_repeat_disbursal') {
                          // Check progress engine first - ReKYC might be required
                          try {
                            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                            const progress = await getOnboardingProgress(loan.id, true); // Force refresh to check ReKYC
                            console.log(`📊 [View Status] Progress for ${loan.status}:`, progress.currentStep, 'ReKYC:', progress.prerequisites.rekycRequired);
                            
                            // If ReKYC is required or KYC is not verified, redirect to KYC page
                            if (progress.prerequisites.rekycRequired || !progress.prerequisites.kycVerified) {
                              const kycRoute = getStepRoute('kyc-verification', loan.id);
                              console.log(`🔄 [View Status] ReKYC required or KYC not verified, redirecting to: ${kycRoute}`);
                              navigate(kycRoute, { replace: true });
                              return;
                            }
                            
                            // If there's a pending onboarding step, redirect to it
                            if (progress.currentStep !== 'steps') {
                              const route = getStepRoute(progress.currentStep, loan.id);
                              console.log(`📊 [View Status] Pending step found, redirecting to: ${route}`);
                              navigate(route, { replace: true });
                              return;
                            }
                          } catch (progressError) {
                            console.error('❌ [View Status] Error checking progress for post-disbursal:', progressError);
                            // Fallback to post-disbursal if progress check fails
                          }
                          // All prerequisites complete - go to post-disbursal
                          navigate(`/post-disbursal?applicationId=${loan.id}`);
                        } else if (loan.status === 'follow_up') {
                          navigate('/loan-application/upload-documents', {
                            state: { applicationId: loan.id }
                          });
                        } else if (loan.status === 'under_review' || loan.status === 'submitted') {
                          // Use unified progress engine to determine next step
                          try {
                            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                            const progress = await getOnboardingProgress(loan.id);
                            console.log('📊 [View Status] Onboarding progress:', progress);

                            // If there's a pending step, redirect to it
                            if (progress.currentStep !== 'steps') {
                              const route = getStepRoute(progress.currentStep, loan.id);
                              console.log(`📊 [View Status] Redirecting to next pending step: ${progress.currentStep} -> ${route}`);
                              navigate(route, { replace: true });
                              return;
                            }

                            // All steps complete - go to under review page
                            console.log('✅ [View Status] All steps complete, showing under review page');
                            navigate('/application-under-review');
                          } catch (progressError) {
                            console.error('❌ [View Status] Error checking progress, falling back to references check:', progressError);
                            // Fallback: Check references only
                            try {
                              const refsResponse = await apiService.getUserReferences();
                              const referencesList = refsResponse.data?.references || [];
                              const alternateData = refsResponse.data?.alternate_data;
                              const hasReferences = Array.isArray(referencesList) && referencesList.length >= 3;
                              const hasAlternateMobile = alternateData?.alternate_mobile ? true : false;

                              if (!hasReferences || !hasAlternateMobile) {
                                console.log('📋 [View Status] References pending, redirecting to references page');
                                navigate('/user-references');
                                return;
                              }
                            } catch (refError) {
                              console.error('Error checking references:', refError);
                            }
                            // References complete - go to under review page
                            navigate('/application-under-review');
                          }
                        } else if (loan.status === 'ready_for_disbursement') {
                          // Check progress engine first - ReKYC might be required
                          try {
                            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                            const progress = await getOnboardingProgress(loan.id, true); // Force refresh to check ReKYC
                            console.log(`📊 [View Status] Progress for ${loan.status}:`, progress.currentStep, 'ReKYC:', progress.prerequisites.rekycRequired);
                            
                            // If ReKYC is required or KYC is not verified, redirect to KYC page
                            if (progress.prerequisites.rekycRequired || !progress.prerequisites.kycVerified) {
                              const kycRoute = getStepRoute('kyc-verification', loan.id);
                              console.log(`🔄 [View Status] ReKYC required or KYC not verified, redirecting to: ${kycRoute}`);
                              navigate(kycRoute, { replace: true });
                              return;
                            }
                            
                            // If there's a pending onboarding step, redirect to it
                            if (progress.currentStep !== 'steps') {
                              const route = getStepRoute(progress.currentStep, loan.id);
                              console.log(`📊 [View Status] Pending step found, redirecting to: ${route}`);
                              navigate(route, { replace: true });
                              return;
                            }
                          } catch (progressError) {
                            console.error('❌ [View Status] Error checking progress for post-disbursal:', progressError);
                            // Fallback to post-disbursal if progress check fails
                          }
                          // All prerequisites complete - navigate to post-disbursal flow
                          console.log('✅ Loan ready for disbursement, navigating to post-disbursal flow');
                          navigate(`/post-disbursal?applicationId=${loan.id}`);
                        } else {
                          // Use unified progress engine to determine next step
                          try {
                            const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                            const progress = await getOnboardingProgress(loan.id);
                            console.log('📊 [View Status] Onboarding progress:', progress);
                            const route = getStepRoute(progress.currentStep, loan.id);
                            console.log(`📊 [View Status] Redirecting to next pending step: ${progress.currentStep} -> ${route}`);
                            navigate(route, { replace: true });
                          } catch (progressError) {
                            console.error('❌ [View Status] Error checking progress, defaulting to KYC:', progressError);
                            // Fallback: Default to KYC
                            navigate('/loan-application/kyc-verification', {
                              state: { applicationId: loan.id }
                            });
                          }
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs whitespace-nowrap w-full"
                    >
                      {loan.status === 'account_manager' || loan.status === 'overdue' ? 'View Loan' :
                        loan.status === 'repeat_disbursal' || loan.status === 'ready_to_repeat_disbursal' ? 'Continue' :
                          loan.status === 'follow_up' ? 'Upload Documents' :
                            loan.status === 'under_review' || loan.status === 'submitted' ? 'View Status' : 'View'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              {isInCoolingPeriod ? (
                <>
                  <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Under Cooling Period</h3>
                  <div className="space-y-2">
                    <p className="text-gray-600">
                      Your profile is under cooling period. We will let you know if a new loan offer is available.
                    </p>
                    <p className="text-gray-500 text-sm">
                      You can check the status after 30 days.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Loans</h3>
                  <p className="text-gray-600 mb-4">You don't have any active loans at the moment.</p>
                  {canApplyForLoan && (
                    <Button
                      onClick={() => {
                        console.log('Apply for a Loan button clicked');
                        navigate('/application');
                      }}
                      style={{ backgroundColor: '#0052FF' }}
                    >
                      Apply for a Loan
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <DashboardHeader userName={userData.name} />

      <div className="flex">
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className="hidden lg:block w-64 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Navigation</h2>
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <Home className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('my-loans')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === 'my-loans'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <CreditCard className="w-5 h-5" />
                My Loans
                {allLoans.length > 0 && (
                  <Badge className="ml-auto bg-blue-500 text-white">{allLoans.length}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === 'profile'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <User className="w-5 h-5" />
                Profile
              </button>
            </nav>

          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Mobile Tab Navigation - Hidden on desktop */}
          <div className="lg:hidden bg-white border-b overflow-x-auto scrollbar-hide">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex w-full rounded-none border-0 bg-transparent h-11 overflow-x-auto">
                <TabsTrigger value="overview" className="rounded-none whitespace-nowrap flex-1 text-xs px-2">Overview</TabsTrigger>
                <TabsTrigger value="my-loans" className="rounded-none whitespace-nowrap flex-1 text-xs px-2">My Loans</TabsTrigger>
                <TabsTrigger value="profile" className="rounded-none whitespace-nowrap flex-1 text-xs px-2">Profile</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="w-full max-w-7xl mx-auto px-3 py-4">
            {/* Hold Status Banner */}
            {dashboardData.hold_info && <HoldBanner holdInfo={dashboardData.hold_info} />}

            {/* Eligibility Status Check */}
            {dashboardData.user?.eligibility_status === 'not_eligible' && (
              <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-6 h-6 text-red-600 mt-1 mr-3" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">
                      You are not eligible for loans at this time
                    </h3>
                    <p className="text-red-700 mb-3">
                      {userData.eligibility_reason || 'Your current profile does not meet our eligibility criteria.'}
                    </p>
                    {userData.eligibility_retry_date && (
                      <p className="text-sm text-red-600">
                        You can reapply after: {formatDate(userData.eligibility_retry_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

              <TabsContent value="overview">
                {renderOverview()}
              </TabsContent>

              <TabsContent value="my-loans">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">My Loan History</h3>
                      <p className="text-sm text-gray-600 mt-1">View all your loans and their details</p>
                    </div>
                  </div>

                  {/* All Loans History */}
                  {allLoans.length > 0 ? (
                    <div className="grid gap-4">
                      {allLoans.map((loan) => {
                        const isCleared = loan.status === 'cleared';
                        const isActive = loan.status === 'account_manager' || loan.status === 'overdue';
                        const isApplied = ['submitted', 'under_review', 'follow_up', 'qa_verification'].includes(loan.status);

                        return (
                          <Card key={loan.id} className={`p-4 hover:shadow-md transition-shadow ${isCleared ? 'border-l-4 border-l-green-500 bg-green-50' :
                            isActive ? 'border-l-4 border-l-blue-500' :
                              'border-l-4 border-l-yellow-500'
                            }`}>
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold text-base text-gray-900 mb-1">
                                    {loan.loan_purpose || 'Personal'} Loan
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    App: {formatLoanId(loan.id)}
                                  </p>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={
                                    isCleared ? 'bg-green-100 text-green-800' :
                                      isActive ? 'bg-blue-100 text-blue-800' :
                                        'bg-yellow-100 text-yellow-800'
                                  }
                                >
                                  {loan.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </div>

                              {/* Amount - Only show for account_manager and cleared loans */}
                              {(isActive || isCleared) && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-600 mb-1">Loan Amount</p>
                                  <p className="text-2xl font-bold text-gray-900">
                                    ₹{loan.loan_amount?.toLocaleString('en-IN') || '0'}
                                  </p>
                                </div>
                              )}

                              {/* Dates */}
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-gray-600 mb-1">Applied On</p>
                                  <p className="font-medium text-gray-900">{formatDate(loan.created_at)}</p>
                                </div>
                                {isCleared && (
                                  <div>
                                    <p className="text-gray-600 mb-1">Cleared On</p>
                                    <p className="font-medium text-green-700">{formatDate(loan.updated_at)}</p>
                                  </div>
                                )}
                                {isActive && (
                                  <div>
                                    <p className="text-gray-600 mb-1">Disbursed On</p>
                                    <p className="font-medium text-blue-700">
                                      {loan.disbursed_at ? formatDate(loan.disbursed_at) : 'Pending'}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-2 border-t flex-wrap">
                                {isActive && (
                                  <Button
                                    onClick={() => navigate(`/repayment-schedule?applicationId=${loan.id}`)}
                                    size="sm"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                  >
                                    View Repayment
                                  </Button>
                                )}
                                {isCleared && (
                                  <Button
                                    onClick={() => handleDownloadNOC(loan.id, loan.application_number)}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs flex items-center gap-1"
                                    disabled={downloadingNOC === loan.id}
                                  >
                                    {downloadingNOC === loan.id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Downloading...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-3 h-3" />
                                        No Dues Certificate
                                      </>
                                    )}
                                  </Button>
                                )}
                                {isApplied && (
                                  <Button
                                    onClick={() => navigate('/application-under-review')}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs"
                                  >
                                    Track Application
                                  </Button>
                                )}
                                <Button
                                  onClick={() => {
                                    setSelectedLoanDetails(loan);
                                    setShowLoanDetailsModal(true);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-xs"
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Loan History</h3>
                      <p className="text-gray-600 mb-4">You haven't applied for any loans yet.</p>
                      {canApplyForLoan && (
                        <Button
                          onClick={() => navigate('/application')}
                          style={{ backgroundColor: '#0052FF' }}
                          className="text-white hover:opacity-90"
                        >
                          Apply for Your First Loan
                        </Button>
                      )}
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="profile">
                <div className="space-y-6">
                  {/* Profile Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                        {userData.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold mb-0.5">{userData.name || 'User'}</h2>
                        <p className="text-blue-100 text-xs">Member since {formatDate(userData.member_since)}</p>
                      </div>
                    </div>

                    {/* User Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-blue-100 text-[10px] mb-0.5">Phone Number</p>
                            <p className="font-medium text-white truncate text-sm">{userData.phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-blue-100 text-[10px] mb-0.5">Email Address</p>
                            <p className="font-medium text-white truncate text-xs">
                              {userData.email || userData.personal_email || userData.official_email || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Us Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Us</h3>

                    <div className="space-y-2">
                      {/* Send E-mail */}
                      <button
                        onClick={() => navigate('/send-email')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Send E-mail</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Change Mobile Number */}
                      <button
                        onClick={() => navigate('/change-mobile-number')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Phone className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Change Mobile Number</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Delete Account */}
                      <button
                        onClick={() => {
                          alert('Write a mail to support@pocketcredit.in');
                        }}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                            <X className="w-5 h-5 text-red-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Delete Account</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Cancel E-mandate / Auto-debit */}
                      <button
                        onClick={() => {
                          alert('Write a mail to support@pocketcredit.in');
                        }}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-orange-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Cancel E-mandate / Auto-debit</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Coupons & Rewards */}
                      <button
                        onClick={() => {
                          alert('Coming Soon');
                        }}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                            <Star className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Coupons & Rewards</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* App Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">App</h3>

                    <div className="space-y-2">
                      {/* Share App */}
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: 'Pocket Credit',
                              text: 'Check out Pocket Credit - Quick and easy loans!',
                              url: window.location.origin
                            }).catch(() => { });
                          } else {
                            // Fallback for desktop
                            navigator.clipboard.writeText(window.location.origin);
                            alert('App link copied to clipboard!');
                          }
                        }}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Share2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Share App</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Legal Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal</h3>

                    <div className="space-y-2">
                      {/* About Us */}
                      <button
                        onClick={() => navigate('/about')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Info className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">About Us</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Terms & Conditions */}
                      <button
                        onClick={() => navigate('/terms')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Terms & Conditions</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Privacy Policy */}
                      <button
                        onClick={() => navigate('/privacy')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Privacy Policy</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Loan Application Modal */}
      {showLoanApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ApplicationFlow onClose={() => setShowLoanApplication(false)} />
          </div>
        </div>
      )}

      {/* Loan Details Modal */}
      {showLoanDetailsModal && selectedLoanDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Loan Details</h2>
                <p className="text-blue-100 text-sm">{formatLoanId(selectedLoanDetails.id)}</p>
              </div>
              <button
                onClick={() => setShowLoanDetailsModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex justify-center">
                <Badge
                  className={`text-base px-6 py-2 ${selectedLoanDetails.status === 'cleared' ? 'bg-green-500 text-white' :
                    selectedLoanDetails.status === 'account_manager' ? 'bg-blue-500 text-white' :
                      selectedLoanDetails.status === 'overdue' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-white'
                    }`}
                >
                  {selectedLoanDetails.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {/* Loan Amount Card - Only show for account_manager and cleared loans */}
              {(selectedLoanDetails.status === 'account_manager' || selectedLoanDetails.status === 'overdue' || selectedLoanDetails.status === 'cleared') && (
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-gray-600 mb-2">Loan Amount</p>
                    <p className="text-4xl font-bold text-blue-700">
                      ₹{selectedLoanDetails.loan_amount?.toLocaleString('en-IN') || '0'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">{selectedLoanDetails.loan_purpose || 'Personal'} Loan</p>
                  </CardContent>
                </Card>
              )}

              {/* Loan Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">Application Number</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatLoanId(selectedLoanDetails.id)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">Loan ID</p>
                  <p className="text-sm font-semibold text-gray-900">#{selectedLoanDetails.id}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">Applied On</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(selectedLoanDetails.created_at)}
                  </p>
                </div>
                {selectedLoanDetails.status === 'cleared' && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-700 mb-1">Cleared On</p>
                    <p className="text-sm font-semibold text-green-900">
                      {formatDate(selectedLoanDetails.updated_at)}
                    </p>
                  </div>
                )}
                {(selectedLoanDetails.status === 'account_manager' || selectedLoanDetails.status === 'overdue') && selectedLoanDetails.disbursed_at && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-700 mb-1">Disbursed On</p>
                    <p className="text-sm font-semibold text-blue-900">
                      {formatDate(selectedLoanDetails.disbursed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {selectedLoanDetails.status === 'cleared' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-900 mb-1">Loan Cleared</p>
                      <p className="text-xs text-green-700">
                        This loan has been fully paid and closed. You can now apply for a higher loan amount.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedLoanDetails.status === 'account_manager' || selectedLoanDetails.status === 'overdue') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Active Loan</p>
                      <p className="text-xs text-blue-700">
                        This loan is currently active. Make timely payments to maintain a good credit score.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {['submitted', 'under_review', 'follow_up'].includes(selectedLoanDetails.status) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-900 mb-1">Application Pending</p>
                      <p className="text-xs text-yellow-700">
                        Your application is under review. We'll notify you once it's processed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                {(selectedLoanDetails.status === 'account_manager' || selectedLoanDetails.status === 'overdue') && (
                  <Button
                    onClick={() => {
                      setShowLoanDetailsModal(false);
                      navigate(`/repayment-schedule?applicationId=${selectedLoanDetails.id}`);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    View Repayment
                  </Button>
                )}
                <Button
                  onClick={() => setShowLoanDetailsModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit Increase Modal */}
      {pendingCreditLimit && (
        <CreditLimitIncreaseModal
          isOpen={showCreditLimitModal}
          onClose={() => setShowCreditLimitModal(false)}
          pendingLimit={pendingCreditLimit}
          onAccept={async () => {
            // Refresh dashboard data after accepting
            await loadDashboardData();
            setPendingCreditLimit(null);
          }}
        />
      )}
    </div>
  );
}
