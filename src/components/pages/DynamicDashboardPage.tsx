import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { Card } from '../ui/card';
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
  Star
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
  const [canApplyForLoan, setCanApplyForLoan] = useState(true);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getDashboardSummary();
      
      if (response.status === 'success' && response.data) {
        setDashboardData(response.data);
        
        // Check if user can apply for new loan
        if ((response.data as any).loan_status) {
          setCanApplyForLoan((response.data as any).loan_status.can_apply);
        }
      } else if (response.status === 'profile_incomplete') {
        // User needs to complete their profile
        console.log('Profile incomplete, redirecting to profile completion:', response.data);
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
        
        // Split applications into applied loans and running loans
        const applied = uniqueApplications.filter((app: any) => 
          ['submitted', 'under_review', 'follow_up', 'disbursal'].includes(app.status)
        );
        
        const running = uniqueApplications.filter((app: any) => 
          ['account_manager', 'cleared'].includes(app.status)
        );
        
        console.log('📝 Applied loans:', applied);
        console.log('🏃 Running loans:', running);
        
        setPendingApplications(uniqueApplications);
        setAppliedLoans(applied);
        setRunningLoans(running);
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
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  const { user: userData, summary, active_loans, upcoming_payments, alerts } = dashboardData;

  // Check if user has any active or pending loans
  const hasActiveOrPendingLoans = () => {
    const hasActiveLoans = active_loans && active_loans.length > 0;
    const hasPendingApplications = pendingApplications && pendingApplications.length > 0;
    
    // Debug logging
    console.log('🔍 Loan Status Check:', {
      activeLoans: active_loans?.length || 0,
      pendingApplications: pendingApplications?.length || 0,
      hasActiveLoans,
      hasPendingApplications,
      result: hasActiveLoans || hasPendingApplications
    });
    
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
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5" />
                    <p className="text-blue-100 text-sm">Next EMI</p>
                  </div>
                  <p className="text-3xl font-bold">
                    {upcoming_payments.length > 0 ? formatCurrency(upcoming_payments[0].emi_amount) : '₹0'}
                  </p>
                  <p className="text-xs text-blue-200">
                    {upcoming_payments.length > 0 ? `Due ${formatDate(upcoming_payments[0].next_emi_date)}` : 'No pending'}
                  </p>
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

      {/* Applied Loan Applications - Overview */}
      {appliedLoans.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">Applied Loan Applications</h3>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {appliedLoans.length} in progress
            </Badge>
          </div>
          
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              You have {appliedLoans.length} loan application{appliedLoans.length !== 1 ? 's' : ''} in progress.
            </p>
            <Button 
              onClick={() => setActiveTab('applied-loans')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              View All Applications
            </Button>
          </div>
        </div>
      )}
      
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
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
              
              {active_loans.length > 0 ? (
                active_loans.map((loan) => (
                  <div key={loan.id} className="border rounded-lg p-6 mb-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold">{loan.loan_purpose || 'Personal Loan'}</h4>
                        <p className="text-gray-600">Loan ID: {loan.loan_number}</p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {loan.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-6 mb-6">
                      <div>
                        <p className="text-sm text-gray-600">Loan Amount</p>
                        <p className="text-xl font-semibold">{formatCurrency(loan.loan_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Outstanding</p>
                        <p className="text-xl font-semibold text-orange-600">{formatCurrency(loan.outstanding_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Monthly EMI</p>
                        <p className="text-xl font-semibold">{formatCurrency(loan.emi_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Next EMI Date</p>
                        <p className="text-xl font-semibold">{formatDate(loan.first_emi_date)}</p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress ({loan.completed_tenure}/{loan.tenure_months} months)</span>
                        <span>{Math.round(loan.progress_percentage)}%</span>
                      </div>
                      <Progress value={loan.progress_percentage} className="h-3" />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        className="px-6"
                        onClick={() => navigate('/pay-emi')}
                        style={{ backgroundColor: '#0052FF' }}
                      >
                        Pay EMI
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/loan-details/${loan.id}`)}
                      >
                        View Details
                      </Button>
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Statement
                      </Button>
                    </div>
                  </div>
                ))
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
          
          {active_loans.length > 0 ? (
            active_loans.map((loan) => (
              <div key={loan.id} className="border rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">{loan.loan_purpose || 'Personal Loan'}</h4>
                    <p className="text-sm text-gray-600">Loan ID: {loan.loan_number}</p>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {loan.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Loan Amount</p>
                    <p className="font-semibold">{formatCurrency(loan.loan_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Outstanding</p>
                    <p className="font-semibold text-orange-600">{formatCurrency(loan.outstanding_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly EMI</p>
                    <p className="font-semibold">{formatCurrency(loan.emi_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="font-semibold">{Math.round(loan.progress_percentage)}%</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => navigate('/pay-emi')}
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    Pay EMI
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate('/loan-details')}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'overview' 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Home className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('applied-loans')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'applied-loans' 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Clock className="w-5 h-5" />
                Applied Loans
                {appliedLoans.length > 0 && (
                  <Badge className="ml-auto bg-yellow-500 text-white">{appliedLoans.length}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab('loans')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'loans' 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Loans
                {runningLoans.length > 0 && (
                  <Badge className="ml-auto bg-blue-500 text-white">{runningLoans.length}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'profile' 
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
              <TabsList className="inline-flex w-full rounded-none border-0 bg-transparent h-11">
                <TabsTrigger value="overview" className="rounded-none whitespace-nowrap flex-1 text-xs px-2">Overview</TabsTrigger>
                <TabsTrigger value="applied-loans" className="rounded-none whitespace-nowrap flex-1 text-xs px-2 relative">
                  Applied
                  {appliedLoans.length > 0 && (
                    <span className="absolute top-1 right-1 bg-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                      {appliedLoans.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="loans" className="rounded-none whitespace-nowrap flex-1 text-xs px-2 relative">
                  Loans
                  {runningLoans.length > 0 && (
                    <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                      {runningLoans.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="profile" className="rounded-none whitespace-nowrap flex-1 text-xs px-2">Profile</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="w-full max-w-7xl mx-auto px-3 py-4">
            {/* Hold Status Banner */}
            {dashboardData.hold_info && <HoldBanner holdInfo={dashboardData.hold_info} />}
            
            {/* Eligibility Status Check */}
            {userData.eligibility_status === 'not_eligible' && (
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
          
          <TabsContent value="applied-loans">
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base lg:text-xl font-semibold">Applied Loans</h3>
                  <p className="text-xs lg:text-sm text-gray-600 mt-0.5 lg:mt-1">Track your loan applications</p>
                </div>
                {canApplyForLoan && !hasActiveOrPendingLoans() && (
                  <Button 
                    onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                    style={{ backgroundColor: '#0052FF' }}
                    className="text-xs lg:text-sm whitespace-nowrap"
                    size="sm"
                  >
                    Apply
                  </Button>
                )}
              </div>

              {/* Status Flow Indicator */}
              <Card className="p-3 lg:p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h4 className="text-xs lg:text-sm font-semibold text-gray-700 mb-3">Application Status Flow</h4>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 text-xs lg:text-sm">1</div>
                    <p className="text-[10px] lg:text-xs text-center font-medium">Submitted</p>
                  </div>
                  <div className="flex-1 h-0.5 lg:h-1 bg-blue-300 mx-1 lg:mx-2"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1 text-xs lg:text-sm">2</div>
                    <p className="text-[10px] lg:text-xs text-center font-medium">Review</p>
                  </div>
                  <div className="flex-1 h-0.5 lg:h-1 bg-blue-300 mx-1 lg:mx-2"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center mb-1 text-xs lg:text-sm">3</div>
                    <p className="text-[10px] lg:text-xs text-center font-medium">Follow Up</p>
                  </div>
                  <div className="flex-1 h-0.5 lg:h-1 bg-blue-300 mx-1 lg:mx-2"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-green-500 text-white flex items-center justify-center mb-1 text-xs lg:text-sm">4</div>
                    <p className="text-[10px] lg:text-xs text-center font-medium">Disbursal</p>
                  </div>
                </div>
              </Card>

              {/* Applied Loan Applications */}
              {appliedLoans.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {appliedLoans.map((application) => (
                    <Card key={application.id} className="p-3 lg:p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm lg:text-lg font-semibold truncate">{application.loan_purpose || 'Personal Loan'}</h4>
                          <p className="text-gray-600 text-xs lg:text-sm truncate">App: {application.application_number}</p>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] lg:text-xs px-1.5 lg:px-2.5 py-0.5 ${
                            application.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            application.status === 'under_review' ? 'bg-purple-100 text-purple-800' :
                            application.status === 'follow_up' ? 'bg-yellow-100 text-yellow-800' :
                            application.status === 'disbursal' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {application.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-3 lg:mb-4">
                        <div>
                          <p className="text-xs lg:text-sm text-gray-500">Loan Amount</p>
                          <p className="text-sm lg:text-lg font-semibold">₹{Number(application.loan_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs lg:text-sm text-gray-500">Applied On</p>
                          <p className="text-xs lg:text-sm font-medium">{formatDate(application.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col lg:flex-row justify-between lg:items-center pt-3 lg:pt-4 border-t gap-2">
                        <p className="text-[10px] lg:text-xs text-gray-500">
                          {application.status === 'submitted' && 'Application submitted'}
                          {application.status === 'under_review' && 'Under review'}
                          {application.status === 'follow_up' && 'Info required'}
                          {application.status === 'disbursal' && 'Processing disbursal'}
                        </p>
                        <Button 
                          onClick={() => {
                            console.log('View Details clicked for:', application.id);
                            navigate('/loan-application/kyc-verification', {
                              state: { applicationId: application.id }
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs lg:text-sm whitespace-nowrap"
                        >
                          View
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6 lg:p-8 text-center">
                  <Clock className="w-12 h-12 lg:w-16 lg:h-16 text-gray-400 mx-auto mb-3 lg:mb-4" />
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">No Applied Loans</h3>
                  <p className="text-xs lg:text-sm text-gray-600 mb-3 lg:mb-4">You don't have any loan applications in progress.</p>
                  {canApplyForLoan && (
                    <Button 
                      onClick={() => {
                        console.log('Apply for a Loan button clicked');
                        navigate('/application');
                      }}
                      style={{ backgroundColor: '#0052FF' }}
                      className="text-xs lg:text-sm"
                      size="sm"
                    >
                      Apply for a Loan
                    </Button>
                  )}
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="loans">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">My Loans</h3>
                  <p className="text-sm text-gray-600 mt-1">Manage your active loans with account manager</p>
                </div>
              </div>

              {/* Running Loans (Account Manager) */}
              {runningLoans.length > 0 ? (
                <div className="grid gap-6">
                  {runningLoans.map((loan) => (
                    <Card key={loan.id} className="p-6 hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{loan.loan_purpose || 'Personal Loan'}</h4>
                          <p className="text-gray-600 text-sm">Application: {loan.application_number}</p>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={
                            loan.status === 'account_manager' ? 'bg-green-100 text-green-800' :
                            loan.status === 'cleared' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {loan.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Loan Amount</p>
                          <p className="text-xl font-semibold">₹{Number(loan.loan_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Status</p>
                          <p className="text-sm font-medium capitalize">{loan.status.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Applied On</p>
                          <p className="text-sm font-medium">{formatDate(loan.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-semibold text-green-900">Loan with Account Manager</p>
                        </div>
                        <p className="text-xs text-green-700">
                          Your loan has been assigned to an account manager. They will contact you shortly to complete the process.
                        </p>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => {
                            console.log('View Details clicked for:', loan.id);
                            navigate('/loan-application/kyc-verification', {
                              state: { applicationId: loan.id }
                            });
                          }}
                          style={{ backgroundColor: '#0052FF' }}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate('/contact-support')}
                        >
                          Contact Support
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Running Loans</h3>
                  <p className="text-gray-600 mb-4">You don't have any loans with account manager at the moment.</p>
                  <p className="text-sm text-gray-500">Check the "Applied Loans" tab to track your applications in progress.</p>
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
                        }).catch(() => {});
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
    </div>
  );
}
