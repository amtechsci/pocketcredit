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
  FileText, 
  User, 
  Bell, 
  TrendingUp, 
  Calendar,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Phone,
  MessageCircle,
  Settings,
  LogOut,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  CreditCard as CreditCardIcon,
  Calculator,
  Home,
  FileSpreadsheet,
  HelpCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Shield
} from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';
import { ApplicationFlow } from '../ApplicationFlow';

// Types for dashboard data
interface DashboardData {
  user: {
    id: number;
    name: string;
    phone: string;
    email: string;
    member_since: string;
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
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLoanApplication, setShowLoanApplication] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getDashboardSummary();
      
      if (response.status === 'success' && response.data) {
        setDashboardData(response.data);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pending loan applications
  const fetchPendingApplications = useCallback(async () => {
    try {
      const response = await apiService.getPendingLoanApplications();
      
      if (response.status === 'success' || response.success === true) {
        setPendingApplications(response.data.applications);
      }
    } catch (error: any) {
      console.error('Error fetching pending applications:', error);
      
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
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Only load data if we don't have it yet or if it's the first load
    if (!dashboardData) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  // Fetch pending loan applications
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPendingApplications();
    }
  }, [isAuthenticated, user, fetchPendingApplications]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

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

  const { user: userData, summary, active_loans, upcoming_payments, notifications, alerts } = dashboardData;

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
          </div>
          
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Credit Score</p>
              </div>
              <p className="text-3xl font-bold">{summary.credit_score}</p>
              <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                {getCreditScoreCategory(summary.credit_score)} (+25 this month)
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Available Credit</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(summary.available_credit)}</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
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
          </div>
        </div>
      </div>

      {/* Mobile Welcome Section */}
      <div className="lg:hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Welcome back, {userData.name}!</h2>
              <p className="text-blue-100">Manage your loans and track payments</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-blue-100 text-sm">Credit Score</p>
              <p className="text-2xl font-bold">{summary.credit_score}</p>
              <p className={`text-xs ${getCreditScoreColor(summary.credit_score)}`}>
                {getCreditScoreCategory(summary.credit_score)}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-blue-100 text-sm">Available Credit</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.available_credit)}</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
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

      {/* Pending Loan Applications - Overview */}
      {pendingApplications.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">Pending Loan Applications</h3>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {pendingApplications.length} pending
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingApplications.map((application) => (
              <div key={application.id} className="bg-white rounded-lg p-4 border border-yellow-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{application.loan_purpose || 'Personal Loan'}</h4>
                    <p className="text-sm text-gray-600">App: {application.application_number}</p>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {application.status}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Amount</span>
                    <span className="font-semibold">₹{Number(application.loan_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Current Step</span>
                    <span className="text-sm font-medium capitalize">{application.current_step.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Applied</span>
                    <span className="text-sm">{formatDate(application.created_at)}</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button 
                    onClick={() => navigate(`/loan-application/steps?applicationId=${application.id}`)}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-md border-0 cursor-pointer transition-colors"
                    style={{ backgroundColor: '#D97706', color: 'white' }}
                  >
                    Continue Application
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Enhanced Layout */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Main Content */}
          <div className="col-span-8 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-blue-600" />
                <p className="text-3xl font-bold text-gray-900">{summary.total_loans}</p>
                <p className="text-sm text-gray-600">Total Loans</p>
                <div className="flex items-center justify-center mt-2 text-xs text-blue-600">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +1 this year
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 text-blue-600" />
                <p className="text-3xl font-bold text-gray-900">{summary.active_loans}</p>
                <p className="text-sm text-gray-600">Active Loans</p>
                <div className="flex items-center justify-center mt-2 text-xs text-blue-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  On track
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <IndianRupee className="w-10 h-10 mx-auto mb-3 text-orange-600" />
                <p className="text-3xl font-bold text-gray-900">
                  {upcoming_payments.length > 0 ? formatCurrency(upcoming_payments[0].emi_amount) : '₹0'}
                </p>
                <p className="text-sm text-gray-600">Next EMI</p>
                <div className="flex items-center justify-center mt-2 text-xs text-orange-600">
                  <Clock className="w-3 h-3 mr-1" />
                  {upcoming_payments.length > 0 ? 'Due soon' : 'No pending'}
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <Shield className="w-10 h-10 mx-auto mb-3 text-purple-600" />
                <p className="text-3xl font-bold text-gray-900">{summary.payment_score}%</p>
                <p className="text-sm text-gray-600">Payment Score</p>
                <div className="flex items-center justify-center mt-2 text-xs text-purple-600">
                  <Target className="w-3 h-3 mr-1" />
                  Excellent
                </div>
              </Card>
            </div>

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
                  <Button 
                    onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    Apply for a Loan
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Credit Score Widget */}
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
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Last updated:</span>
                  <span>{formatDate(new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-blue-600">Good</span>
                </div>
              </div>
            </Card>

            {/* Upcoming Payments */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                Upcoming Payments
              </h3>
              
              {upcoming_payments.length > 0 ? (
                upcoming_payments.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg mb-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{formatCurrency(payment.emi_amount)} EMI</p>
                        <p className="text-sm text-gray-600">Due: {formatDate(payment.next_emi_date)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-orange-300 text-orange-600">
                      {payment.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No upcoming payments</p>
                </div>
              )}
              
              {upcoming_payments.length > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/pay-emi')}
                >
                  Pay Now
                </Button>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button variant="ghost" className="w-full justify-start hover:bg-blue-50">
                  <Calculator className="w-4 h-4 mr-3 text-blue-600" />
                  EMI Calculator
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
                <Button variant="ghost" className="w-full justify-start hover:bg-blue-50">
                  <FileSpreadsheet className="w-4 h-4 mr-3 text-blue-600" />
                  Download Statement
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
                <Button variant="ghost" className="w-full justify-start hover:bg-blue-50">
                  <Settings className="w-4 h-4 mr-3 text-blue-600" />
                  Account Settings
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
                <Button variant="ghost" className="w-full justify-start hover:bg-blue-50">
                  <HelpCircle className="w-4 h-4 mr-3 text-blue-600" />
                  Support Center
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            </Card>

            {/* Quick Apply */}
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Need More Funds?</h3>
              <p className="text-gray-600 mb-4 text-sm">Get instant approval with your excellent credit score</p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                  className="w-full"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Apply Personal Loan
                </Button>
                <Button 
                  onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                  variant="outline" 
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Apply Business Loan
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-gray-900">{summary.total_loans}</p>
            <p className="text-sm text-gray-600">Total Loans</p>
          </Card>
          
          <Card className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-gray-900">{summary.active_loans}</p>
            <p className="text-sm text-gray-600">Active Loans</p>
          </Card>
          
          <Card className="p-4 text-center">
            <IndianRupee className="w-8 h-8 mx-auto mb-2 text-orange-600" />
            <p className="text-2xl font-bold text-gray-900">
              {upcoming_payments.length > 0 ? formatCurrency(upcoming_payments[0].emi_amount) : '₹0'}
            </p>
            <p className="text-sm text-gray-600">Next EMI</p>
          </Card>
          
          <Card className="p-4 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold text-gray-900">
              {upcoming_payments.length > 0 ? formatDate(upcoming_payments[0].next_emi_date) : 'No due'}
            </p>
            <p className="text-sm text-gray-600">Due Date</p>
          </Card>
        </div>


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
              <Button 
                onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                style={{ backgroundColor: '#0052FF' }}
              >
                Apply for a Loan
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
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
                onClick={() => setActiveTab('loans')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'loans' 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                My Loans
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'payments' 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Payments
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
            
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/pay-emi')}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Pay EMI
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/emi-calculator')}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  EMI Calculator
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Apply Loan
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Mobile Tab Navigation - Hidden on desktop */}
          <div className="lg:hidden bg-white border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 rounded-none border-0">
                <TabsTrigger value="overview" className="rounded-none">Overview</TabsTrigger>
                <TabsTrigger value="loans" className="rounded-none">Loans</TabsTrigger>
                <TabsTrigger value="payments" className="rounded-none">Payments</TabsTrigger>
                <TabsTrigger value="profile" className="rounded-none">Profile</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="container mx-auto px-4 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          
          <TabsContent value="overview">
            {renderOverview()}
          </TabsContent>
          
          <TabsContent value="loans">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">My Loans</h3>
                <Button 
                  onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Apply New Loan
                </Button>
              </div>

              {/* Pending Loan Applications */}
              {pendingApplications.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Pending Loan Applications</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {pendingApplications.map((application) => (
                      <Card key={application.id} className="p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-semibold">{application.loan_purpose || 'Personal Loan'}</h4>
                            <p className="text-gray-600">Application: {application.application_number}</p>
                          </div>
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            {application.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Loan Amount</p>
                            <p className="text-lg font-semibold">₹{Number(application.loan_amount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Step</p>
                            <p className="text-sm font-medium capitalize">{application.current_step.replace('_', ' ')}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500">
                            Applied: {formatDate(application.created_at)}
                          </p>
                          <Button 
                            onClick={() => {
                              console.log('Continue Application clicked for:', application.id);
                              navigate(`/loan-application/steps?applicationId=${application.id}`);
                            }}
                            style={{ backgroundColor: '#0052FF' }}
                            size="sm"
                          >
                            Continue Application
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending loan applications</p>
                </div>
              )}
              
              {active_loans.length > 0 ? (
                <div className="grid gap-6">
                  {active_loans.map((loan) => (
                    <Card key={loan.id} className="p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{loan.loan_purpose || 'Personal Loan'}</h4>
                          <p className="text-gray-600">Loan ID: {loan.loan_number}</p>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {loan.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                          <p className="text-sm text-gray-600">Progress</p>
                          <p className="text-xl font-semibold">{Math.round(loan.progress_percentage)}%</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => navigate(`/loan-details/${loan.id}`)}
                          style={{ backgroundColor: '#0052FF' }}
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate('/pay-emi')}
                        >
                          Pay EMI
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate('/payment-history')}
                        >
                          Payment History
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Loans</h3>
                  <p className="text-gray-600 mb-4">You don't have any active loans at the moment.</p>
                  <Button 
                    onClick={() => {
                      console.log('Apply for a Loan button clicked');
                      navigate('/application');
                    }}
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    Apply for a Loan
                  </Button>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="payments">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Payment History</h3>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/payment-history')}
                >
                  View All Payments
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(active_loans.reduce((sum, loan) => sum + (loan.emi_amount * loan.completed_tenure), 0))}
                  </p>
                  <p className="text-sm text-gray-600">Total Paid</p>
                </Card>
                
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {active_loans.reduce((sum, loan) => sum + loan.completed_tenure, 0)}
                  </p>
                  <p className="text-sm text-gray-600">EMIs Paid</p>
                </Card>
                
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {upcoming_payments.length > 0 ? formatCurrency(upcoming_payments[0].emi_amount) : '₹0'}
                  </p>
                  <p className="text-sm text-gray-600">Next EMI</p>
                </Card>
              </div>
              
              {upcoming_payments.length > 0 && (
                <Card className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Upcoming Payments</h4>
                  <div className="space-y-3">
                    {upcoming_payments.slice(0, 3).map((payment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold">{formatCurrency(payment.emi_amount)} EMI</p>
                          <p className="text-sm text-gray-600">Due: {formatDate(payment.next_emi_date)}</p>
                        </div>
                        <Badge variant="outline" className="border-orange-300 text-orange-600">
                          {payment.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="profile">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Profile Settings</h3>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/profile-completion')}
                >
                  Edit Profile
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Personal Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name</span>
                      <span className="font-semibold">{userData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone</span>
                      <span className="font-semibold">{userData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email</span>
                      <span className="font-semibold">{userData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Member Since</span>
                      <span className="font-semibold">{formatDate(userData.member_since)}</span>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Credit Information</h4>
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <TrendingUp className="w-10 h-10 text-blue-600" />
                    </div>
                    <p className={`text-4xl font-bold mb-2 ${getCreditScoreColor(summary.credit_score)}`}>
                      {summary.credit_score}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">Credit Score</p>
                    <Badge className="bg-blue-100 text-blue-800">
                      {getCreditScoreCategory(summary.credit_score)}
                    </Badge>
                  </div>
                </Card>
              </div>
              
              <Card className="p-6">
                <h4 className="text-lg font-semibold mb-4">Quick Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="h-20 flex-col gap-2"
                  >
                    <FileText className="w-6 h-6" />
                    Documents
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/payment-history')}
                    className="h-20 flex-col gap-2"
                  >
                    <Calendar className="w-6 h-6" />
                    Payment History
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="h-20 flex-col gap-2"
                  >
                    <CreditCard className="w-6 h-6" />
                    Loan Details
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleLogout}
                    className="h-20 flex-col gap-2 text-red-600 hover:text-red-700"
                  >
                    <LogOut className="w-6 h-6" />
                    Sign Out
                  </Button>
                </div>
              </Card>
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
