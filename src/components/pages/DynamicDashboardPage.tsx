import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
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
  Wallet,
  CreditCard as CreditCardIcon,
  Home,
  Phone,
  Mail,
  Headphones,
  ChevronRight,
  Share2,
  Info,
  FileText,
  ShieldCheck,
  Star,
  X
} from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';
import { ApplicationFlow } from '../ApplicationFlow';
import { HoldBanner } from '../HoldBanner';
import { GraduationUpsellCard } from '../GraduationUpsellCard';

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
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<any>(null);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Priority-based routing: Check applications in priority order
      try {
        const applicationsResponse = await apiService.getLoanApplications();
        if (applicationsResponse.success && applicationsResponse.data && applicationsResponse.data.applications) {
          const applications = applicationsResponse.data.applications;

          // PRIORITY 1: Check for pending documents (need_document action)
          // Check if any application has pending documents requested by admin
          for (const app of applications) {
            try {
              // Check validation history for need_document actions
              const validationResponse = await apiService.request('GET', `/validation/user/history?loanApplicationId=${app.id}`, {});
              if (validationResponse.status === 'success' && validationResponse.data) {
                const documentActions = validationResponse.data.filter(
                  (action: any) => action.action_type === 'need_document' && action.loan_application_id === app.id
                );
                
                if (documentActions.length > 0) {
                  const latestAction = documentActions[0];
                  const documents = latestAction.action_details?.documents || [];
                  
                  // Check if all documents are uploaded
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
                      
                      if (!allUploaded) {
                        console.log('📄 Found pending documents, redirecting to upload page');
                        navigate(`/loan-application/upload-documents?applicationId=${app.id}`);
                        return;
                      }
                    }
                  }
                }
              }
            } catch (valError) {
              console.error('Error checking validation history:', valError);
              // Continue to next check
            }
          }

          // PRIORITY 2: Check for pre-disbursal statuses (follow_up, ready_for_disbursement, etc.)
          const preDisbursalApp = applications.find(
            (app: any) => ['follow_up', 'ready_for_disbursement'].includes(app.status)
          );
          if (preDisbursalApp) {
            // Check if it has pending documents first
            try {
              const validationResponse = await apiService.request('GET', `/validation/user/history?loanApplicationId=${preDisbursalApp.id}`, {});
              if (validationResponse.status === 'success' && validationResponse.data) {
                const documentActions = validationResponse.data.filter(
                  (action: any) => action.action_type === 'need_document' && action.loan_application_id === preDisbursalApp.id
                );
                if (documentActions.length > 0) {
                  const latestAction = documentActions[0];
                  const documents = latestAction.action_details?.documents || [];
                  if (documents.length > 0) {
                    // Check if all uploaded
                    const docsResponse = await apiService.getLoanDocuments(preDisbursalApp.id);
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
                      if (!allUploaded) {
                        navigate(`/loan-application/upload-documents?applicationId=${preDisbursalApp.id}`);
                        return;
                      }
                    }
                  }
                }
              }
            } catch (err) {
              // Continue
            }
            // If no pending documents, show under review or appropriate page
            if (preDisbursalApp.status === 'follow_up') {
              navigate('/application-under-review');
              return;
            }
          }

          // PRIORITY 3: Check for post-disbursal (disbursal status)
          const disbursalApp = applications.find(
            (app: any) => app.status === 'disbursal'
          );
          if (disbursalApp) {
            navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
            return;
          }

          // PRIORITY 4: Check for account_manager status - redirect to repayment schedule
          const accountManagerApp = applications.find(
            (app: any) => app.status === 'account_manager'
          );
          if (accountManagerApp) {
            console.log('🔄 Found account_manager loan, redirecting to repayment schedule');
            navigate(`/repayment-schedule?applicationId=${accountManagerApp.id}`);
            return;
          }

          // PRIORITY 5: Check for under_review or submitted status
          const underReviewApp = applications.find(
            (app: any) => app.status === 'under_review' || app.status === 'submitted'
          );
          if (underReviewApp) {
            navigate('/application-under-review');
            return;
          }
        }
      } catch (appError) {
        console.error('Error checking applications:', appError);
        // Continue to load dashboard
      }

      const response = await apiService.getDashboardSummary();

      if (response.status === 'success' && response.data) {
        // Check if user is deleted
        if ((response.data as any).deleted) {
          // Show deleted message and prevent any actions
          setDashboardData({
            ...response.data,
            user: (response.data as any).user || {}
          } as DashboardData);
          setCanApplyForLoan(false);
          return;
        }
        
        setDashboardData(response.data);

        // Check if user can apply for new loan
        if ((response.data as any).loan_status) {
          setCanApplyForLoan((response.data as any).loan_status.can_apply);
        }
      } else if (response.status === 'profile_incomplete') {
        const incompleteData = response.data as any;
        console.log('Profile incomplete, redirecting to completion:', incompleteData);

        // If the backend says profile is incomplete, we should generally respect it
        // especially for Step 1 (Employment Check) which is critical.
        // For Step 2, our backend fix (profile_completed=1) should have prevented this status.
        // So if we are here, it's either a new user or the fix didn't apply.
        // Safe fallback is to redirect.
        navigate('/profile-completion');
        return;
      } else {
        setError('Failed to load dashboard data');
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

        // Check for account_manager status - redirect to repayment schedule
        // But don't redirect if the loan is already cleared
        const accountManagerApp = uniqueApplications.find((app: any) =>
          app.status === 'account_manager'
        );

        if (accountManagerApp) {
          navigate(`/repayment-schedule?applicationId=${accountManagerApp.id}`);
          return;
        }

        // If loan is cleared, keep user on dashboard (don't redirect)
        const clearedApp = uniqueApplications.find((app: any) =>
          app.status === 'cleared'
        );
        // Cleared loans stay on dashboard - user can apply for new loan

        // Check for ready_for_disbursement status - show waiting message (admin needs to add transaction)
        const readyForDisbursementApp = uniqueApplications.find((app: any) =>
          app.status === 'ready_for_disbursement'
        );

        if (readyForDisbursementApp) {
          // Don't redirect - just show the dashboard with a message
          // The loan will appear in "Running Loans" section
          // Once admin adds transaction, status will change to account_manager and user will see repayment schedule
        }

        // Check for disbursal status - redirect to post-disbursal flow
        // But check if user has already completed all steps first
        const disbursalApp = uniqueApplications.find((app: any) =>
          app.status === 'disbursal'
        );

        if (disbursalApp) {
          // Check if user has completed step 6 (agreement signed)
          // If yes, redirect to post-disbursal to show "You will get funds shortly" message
          try {
            const progressResponse = await apiService.getPostDisbursalProgress(disbursalApp.id);
            if (progressResponse.success && progressResponse.data) {
              const progress = progressResponse.data;
              // If step 6 completed and agreement signed, redirect to show confirmation
              if ((progress.current_step >= 6 && progress.agreement_signed) || progress.current_step >= 7) {
                console.log('✅ Post-disbursal completed, redirecting to confirmation page...');
                // Redirect to post-disbursal to show "You will get funds shortly" message
                navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
                return;
              } else {
                // User hasn't completed all steps - redirect to post-disbursal
                navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
                return;
              }
            } else {
              // Can't determine progress - redirect to post-disbursal
              navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
              return;
            }
          } catch (error) {
            console.error('Error checking progress:', error);
            // On error, redirect to post-disbursal
            navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
            return;
          }
        }

        // Split applications into applied loans and running loans
        // Applied: Pre-disbursal statuses (submitted, under_review, follow_up, ready_for_disbursement)
        const applied = uniqueApplications.filter((app: any) =>
          ['submitted', 'under_review', 'follow_up', 'ready_for_disbursement'].includes(app.status)
        );

        // Running loans: Only active loans with account manager (NOT cleared, NOT ready_for_disbursement)
        const running = uniqueApplications.filter((app: any) =>
          app.status === 'account_manager'
        );

        // All loans includes everything (for My Loans history tab, including cleared loans)
        const all = uniqueApplications;

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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Load all dashboard data in one go
    if (!dashboardData) {
      loadDashboardData();
    }

    // Fetch pending applications
    if (user) {
      fetchPendingApplications();
    }
  }, [isAuthenticated, user]);

  // Refresh pending applications when component mounts (in case user deleted an application)
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPendingApplications();
    }
  }, []); // Empty dependency array means this runs once when component mounts

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

  // Format application number to short format (PLL + last 4 digits)
  const formatAppNumber = (appNumber: string) => {
    if (!appNumber) return 'N/A';
    const last4 = appNumber.slice(-4);
    return `PLL${last4}`;
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

  const { user: userData, summary, active_loans,  alerts } = dashboardData;

  // Check if user has any active or pending loans
  const hasActiveOrPendingLoans = () => {
    const hasActiveLoans = active_loans && active_loans.length > 0;
    // Filter out cleared loans from pendingApplications when checking if user can apply
    const activePendingApps = pendingApplications?.filter((app: any) => app.status !== 'cleared') || [];
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
                  <p className="text-blue-100 text-sm">Credit Score</p>
                </div>
                <p className="text-3xl font-bold">{summary.credit_score}</p>
                <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                  {getCreditScoreCategory(summary.credit_score)} (+25 this month)
                </p>
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
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Available Credit</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(summary.available_credit)}</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
            {dashboardData?.financial?.salary_range_display && userData.employment_type !== 'student' && (
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-blue-100 text-sm">Salary Range</p>
                </div>
                <p className="text-3xl font-bold">{dashboardData.financial.salary_range_display}</p>
                <p className="text-xs text-blue-200">Monthly Income</p>
              </div>
            )}
            {/* Hide loan stats for students */}
            {userData.employment_type !== 'student' && (
              <>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCardIcon className="w-5 h-5" />
                    <p className="text-blue-100 text-sm">Active Loans</p>
                  </div>
                  <p className="text-3xl font-bold">{summary.active_loans}</p>
                  <p className="text-xs text-blue-200">{formatCurrency(summary.outstanding_amount)} outstanding</p>
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
                <p className="text-blue-100 text-xs">Credit Score</p>
                <p className="text-xl font-bold">{summary.credit_score}</p>
                <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                  {getCreditScoreCategory(summary.credit_score)}
                </p>
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
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-blue-100 text-xs">Available Credit</p>
              <p className="text-xl font-bold">{formatCurrency(summary.available_credit)}</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
            {dashboardData?.financial?.salary_range_display && (
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-blue-100 text-xs">Salary Range</p>
                <p className="text-xl font-bold">{dashboardData.financial.salary_range_display}</p>
                <p className="text-xs text-blue-200">Monthly Income</p>
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

      {/* Running Loans - Overview */}
      {runningLoans.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Loans with Account Manager</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {runningLoans.length} active
            </Badge>
          </div>

          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              You have {runningLoans.length} loan{runningLoans.length !== 1 ? 's' : ''} with account manager.
            </p>
            <Button
              onClick={() => setActiveTab('loans')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              View My Loans
            </Button>
          </div>
        </div>
      )}

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

              {appliedLoans.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {appliedLoans.map((loan) => (
                    <Card key={loan.id} className="p-3 lg:p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm lg:text-lg font-semibold truncate">{loan.loan_purpose || 'Personal Loan'}</h4>
                          <p className="text-gray-600 text-xs lg:text-sm truncate">App: {formatAppNumber(loan.application_number)}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] lg:text-xs px-1.5 lg:px-2.5 py-0.5 ${
                            loan.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            loan.status === 'under_review' ? 'bg-purple-100 text-purple-800' :
                            loan.status === 'follow_up' ? 'bg-yellow-100 text-yellow-800' :
                            loan.status === 'ready_for_disbursement' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {loan.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-3 lg:mb-4">
                        <div>
                          <p className="text-xs lg:text-sm text-gray-500">Loan Amount</p>
                          <p className="text-sm lg:text-lg font-semibold">₹{Number(loan.loan_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs lg:text-sm text-gray-500">Applied On</p>
                          <p className="text-xs lg:text-sm font-medium">{formatDate(loan.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row justify-between lg:items-center pt-3 lg:pt-4 border-t gap-2">
                        <p className="text-[10px] lg:text-xs text-gray-500">
                          {loan.status === 'submitted' && 'Application submitted'}
                          {loan.status === 'under_review' && 'Under review'}
                          {loan.status === 'follow_up' && 'Info required'}
                          {loan.status === 'ready_for_disbursement' && 'Ready for disbursal'}
                        </p>
                        <Button
                          onClick={() => {
                            console.log('View Details clicked for:', loan.id);
                            if (loan.status === 'follow_up') {
                              navigate('/loan-application/upload-documents', {
                                state: { applicationId: loan.id }
                              });
                            } else {
                              navigate('/loan-application/kyc-verification', {
                                state: { applicationId: loan.id }
                              });
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs lg:text-sm whitespace-nowrap"
                        >
                          {loan.status === 'follow_up' ? 'Upload Documents' : 'View'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
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
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Graduation Upsell Card for Students OR Credit Score Widget for Others */}
            {userData.employment_type === 'student' &&
              userData.graduation_status === 'not_graduated' &&
              userData.loan_limit ? (
              <GraduationUpsellCard
                currentLoanLimit={userData.loan_limit}
                onSuccess={() => {
                  fetchDashboard();
                }}
              />
            ) : userData.employment_type !== 'student' ? (
              <Card className="p-6 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-blue-600" />
                </div>
                <p className={`text-4xl font-bold mb-2 ${getCreditScoreColor(summary.credit_score)}`}>
                  {summary.credit_score}
                </p>
                <p className="text-sm text-gray-600 mb-4">Credit Score</p>
                <div className="flex justify-center mb-4">
                  <Badge className="bg-blue-100 text-blue-800">
                    {getCreditScoreCategory(summary.credit_score)}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <div className="flex justify-between">
                    <span>Last updated:</span>
                    <span>{formatDate(new Date().toISOString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-blue-600">Good</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-gray-700 leading-relaxed text-center">
                      For any dispute related concerns please reach out to{' '}
                      <a
                        href="https://consumer.experian.in/ECSINDIA-DCE/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                      >
                        Experian Customer Dispute Portal
                      </a>
                    </p>
                  </div>
                </div>
              </Card>
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

          {appliedLoans.length > 0 ? (
            <div className="space-y-3">
              {appliedLoans.map((loan) => (
                <Card key={loan.id} className="p-3 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{loan.loan_purpose || 'Personal Loan'}</h4>
                      <p className="text-gray-600 text-xs truncate">App: {formatAppNumber(loan.application_number)}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0.5 ${
                        loan.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        loan.status === 'under_review' ? 'bg-purple-100 text-purple-800' :
                        loan.status === 'follow_up' ? 'bg-yellow-100 text-yellow-800' :
                        loan.status === 'ready_for_disbursement' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {loan.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Loan Amount</p>
                      <p className="text-sm font-semibold">₹{Number(loan.loan_amount).toLocaleString()}</p>
                    </div>
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
                    </p>
                    <Button
                      onClick={() => {
                        console.log('View Details clicked for:', loan.id);
                        if (loan.status === 'follow_up') {
                          navigate('/loan-application/upload-documents', {
                            state: { applicationId: loan.id }
                          });
                        } else {
                          navigate('/loan-application/kyc-verification', {
                            state: { applicationId: loan.id }
                          });
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs whitespace-nowrap w-full"
                    >
                      {loan.status === 'follow_up' ? 'Upload Documents' : 'View'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
                        const isActive = loan.status === 'account_manager';
                        const isApplied = ['submitted', 'under_review', 'follow_up'].includes(loan.status);
                        
                        return (
                          <Card key={loan.id} className={`p-4 hover:shadow-md transition-shadow ${
                            isCleared ? 'border-l-4 border-l-green-500 bg-green-50' : 
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
                                    App: {formatAppNumber(loan.application_number)}
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

                              {/* Amount */}
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Loan Amount</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  ₹{loan.loan_amount?.toLocaleString('en-IN') || '0'}
                                </p>
                              </div>

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
                              <div className="flex gap-2 pt-2 border-t">
                                {isActive && (
                                  <Button
                                    onClick={() => navigate(`/repayment-schedule?applicationId=${loan.id}`)}
                                    size="sm"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                  >
                                    View Repayment
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
                          onClick={() => navigate('/loan-application')}
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
                            <p className="font-medium text-white truncate text-xs">{userData.email || 'N/A'}</p>
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
                        onClick={() => window.location.href = 'mailto:support@pocketcredit.in'}
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

                      {/* Help Desk */}
                      <button
                        onClick={() => navigate('/contact')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Headphones className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Help Desk</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

                      {/* Change Mobile Number */}
                      <button
                        onClick={() => navigate('/profile-completion')}
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

                      {/* Change Email ID */}
                      <button
                        onClick={() => navigate('/profile-completion')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Change Email ID</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* App Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">App</h3>

                    <div className="space-y-2">
                      {/* Rate Us */}
                      <button
                        onClick={() => {
                          // Open app store/play store for rating
                          const userAgent = navigator.userAgent || navigator.vendor;
                          if (/android/i.test(userAgent)) {
                            window.open('https://play.google.com/store/apps/details?id=com.pocketcredit', '_blank');
                          } else if (/iPad|iPhone|iPod/.test(userAgent)) {
                            window.open('https://apps.apple.com/app/pocketcredit', '_blank');
                          }
                        }}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <Star className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">Rate Us</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>

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

                      {/* App Security */}
                      <button
                        onClick={() => navigate('/profile-completion')}
                        className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-base font-medium text-gray-900">App Security</span>
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
                        onClick={() => navigate('/terms-conditions')}
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
                        onClick={() => navigate('/privacy-policy')}
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
                <p className="text-blue-100 text-sm">{formatAppNumber(selectedLoanDetails.application_number)}</p>
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
                  className={`text-base px-6 py-2 ${
                    selectedLoanDetails.status === 'cleared' ? 'bg-green-500 text-white' : 
                    selectedLoanDetails.status === 'account_manager' ? 'bg-blue-500 text-white' : 
                    'bg-yellow-500 text-white'
                  }`}
                >
                  {selectedLoanDetails.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {/* Loan Amount Card */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-gray-600 mb-2">Loan Amount</p>
                  <p className="text-4xl font-bold text-blue-700">
                    ₹{selectedLoanDetails.loan_amount?.toLocaleString('en-IN') || '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{selectedLoanDetails.loan_purpose || 'Personal'} Loan</p>
                </CardContent>
              </Card>

              {/* Loan Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">Application Number</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatAppNumber(selectedLoanDetails.application_number)}
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
                {selectedLoanDetails.status === 'account_manager' && selectedLoanDetails.disbursed_at && (
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

              {selectedLoanDetails.status === 'account_manager' && (
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
                {selectedLoanDetails.status === 'account_manager' && (
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
    </div>
  );
}
