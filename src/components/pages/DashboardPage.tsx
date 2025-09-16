import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User as UserType, apiService } from '../../services/api';
import { Card } from '../ui/card';
import { LoanApplicationCard } from '../LoanApplicationCard';

// Local interface for user profile data
interface UserProfile {
  user: UserType;
  addresses?: any[];
  employment?: any;
  bankAccounts?: any[];
  kycStatus?: any;
}
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { 
  CreditCard, 
  FileText, 
  User, 
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
  Wallet,
  CreditCard as CreditCardIcon,
  Calculator,
  Home,
  FileSpreadsheet,
  HelpCircle,
  ChevronRight,
  ArrowUpRight,
  Target,
  Shield
} from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';
import { ApplicationFlow } from '../ApplicationFlow';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLoanApplication, setShowLoanApplication] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);

  // Create mock user profile from AuthContext user data (no API call needed)
  const createMockUserProfile = useCallback((user: UserType) => {
    return {
      user: user,
      addresses: [],
      employment: null,
      bankAccounts: [],
      kycStatus: {
        id: 1,
        user_id: user.id,
        overall_status: 'not_started' as const,
        completion_percentage: 0,
        pan_verified: false,
        aadhaar_verified: false,
        address_verified: false,
        bank_account_verified: false,
        employment_verified: false,
        video_kyc_verified: false,
        pan_score: 0,
        aadhaar_score: 0,
        address_score: 0,
        bank_score: 0,
        employment_score: 0,
        video_kyc_score: 0,
        overall_score: 0,
        risk_level: 'medium' as const,
        risk_score: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }, []);

  const fetchPendingApplications = useCallback(async () => {
    try {
      console.log('Fetching pending applications...');
      console.log('Current user:', user);
      console.log('User ID:', user?.id);
      const response = await apiService.getPendingLoanApplications();
      console.log('Pending applications response:', response);
      console.log('Response status:', response.status);
      console.log('Response success:', response.success);
      console.log('Response data:', response.data);
      
      if (response.status === 'success' || response.success === true) {
        console.log('Setting pending applications:', response.data.applications);
        setPendingApplications(response.data.applications);
      } else {
        console.log('API call failed or no data:', response.message);
      }
    } catch (error) {
      console.error('Error fetching pending applications:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Use user data from AuthContext instead of making API call
    if (user) {
      const mockProfile = createMockUserProfile(user);
      setUserProfile(mockProfile);
      setLoading(false);
    }
  }, [isAuthenticated, navigate, user, createMockUserProfile]);

  // Check if user needs to complete profile based on profile_completion_step
  useEffect(() => {
    if (user && user.profile_completion_step && user.profile_completion_step < 4) {
      navigate('/profile-completion');
      return;
    }
  }, [user, navigate]);

  // Fetch pending loan applications
  useEffect(() => {
    console.log('Dashboard: useEffect for fetchPendingApplications triggered');
    console.log('Dashboard: isAuthenticated:', isAuthenticated);
    console.log('Dashboard: user:', user);
    if (isAuthenticated && user) {
      console.log('Dashboard: Calling fetchPendingApplications');
      fetchPendingApplications();
    } else {
      console.log('Dashboard: Not authenticated or no user, skipping fetchPendingApplications');
    }
  }, [isAuthenticated, user, fetchPendingApplications]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load user data</p>
          <Button onClick={() => navigate('/auth')} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // User data from API
  const userData = {
    name: `${user.first_name} ${user.last_name}`,
    phone: user.phone,
    email: user.email,
    kycStatus: userProfile.kycStatus?.overall_status || 'not_started',
    creditScore: userProfile.kycStatus?.overall_score || 0,
    availableCredit: 500000,
    totalLoans: 2,
    activeLoans: 1
  };

  const activeLoans = [
    {
      id: 'PL001',
      type: 'Personal Loan',
      amount: 300000,
      disbursedAmount: 300000,
      outstandingAmount: 245000,
      emiAmount: 15000,
      nextEmiDate: '2024-01-15',
      tenure: 24,
      completedTenure: 4,
      interestRate: 12.5,
      status: 'active'
    }
  ];

  const completedLoans = [
    {
      id: 'BL001',
      type: 'Business Loan',
      amount: 500000,
      disbursedAmount: 500000,
      completedDate: '2023-12-20',
      status: 'completed'
    }
  ];

  const upcomingPayments = [
    {
      loanId: 'PL001',
      amount: 15000,
      dueDate: '2024-01-15',
      type: 'EMI',
      status: 'pending'
    }
  ];

  const documents = [
    { name: 'Loan Agreement - PL001', type: 'PDF', uploadDate: '2023-08-15', status: 'verified' },
    { name: 'Aadhaar Card', type: 'PDF', uploadDate: '2023-08-10', status: 'verified' },
    { name: 'PAN Card', type: 'PDF', uploadDate: '2023-08-10', status: 'verified' },
    { name: 'Bank Statement', type: 'PDF', uploadDate: '2023-08-12', status: 'verified' }
  ];

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
              onClick={() => setShowLoanApplication(true)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              variant="outline"
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
              <p className="text-3xl font-bold">{userData.creditScore}</p>
              <p className="text-xs" style={{ color: '#06B6D4' }}>Excellent (+25 this month)</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Available Credit</p>
              </div>
              <p className="text-3xl font-bold">₹{(userData.availableCredit / 100000).toFixed(1)}L</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCardIcon className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Active Loans</p>
              </div>
              <p className="text-3xl font-bold">{userData.activeLoans}</p>
              <p className="text-xs text-blue-200">₹2.45L outstanding</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5" />
                <p className="text-blue-100 text-sm">Next EMI</p>
              </div>
              <p className="text-3xl font-bold">₹15K</p>
              <p className="text-xs text-blue-200">Due Jan 15</p>
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
              <p className="text-2xl font-bold">{userData.creditScore}</p>
              <p className="text-xs" style={{ color: '#06B6D4' }}>Excellent</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-blue-100 text-sm">Available Credit</p>
              <p className="text-2xl font-bold">₹{(userData.availableCredit / 100000).toFixed(1)}L</p>
              <p className="text-xs text-blue-200">Pre-approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts/Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">EMI Auto-Pay Enabled</p>
            <p className="text-xs text-blue-700">Your next EMI will be auto-debited on Jan 15</p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Credit Score Improved!</p>
            <p className="text-xs text-blue-700">Your score increased by 25 points this month</p>
          </div>
        </div>
      </div>

      {/* Pending Loan Applications */}
      {(() => {
        console.log('Dashboard: pendingApplications.length:', pendingApplications.length);
        console.log('Dashboard: pendingApplications:', pendingApplications);
        return null;
      })()}
      {pendingApplications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Pending Loan Applications</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingApplications.map((application) => (
              <LoanApplicationCard key={application.id} application={application} />
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
                <p className="text-3xl font-bold text-gray-900">{userData.totalLoans}</p>
                <p className="text-sm text-gray-600">Total Loans</p>
                <div className="flex items-center justify-center mt-2 text-xs text-blue-600">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +1 this year
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 text-blue-600" />
                <p className="text-3xl font-bold text-gray-900">{userData.activeLoans}</p>
                <p className="text-sm text-gray-600">Active Loans</p>
                <div className="flex items-center justify-center mt-2 text-xs text-blue-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  On track
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <IndianRupee className="w-10 h-10 mx-auto mb-3 text-orange-600" />
                <p className="text-3xl font-bold text-gray-900">₹15K</p>
                <p className="text-sm text-gray-600">Next EMI</p>
                <div className="flex items-center justify-center mt-2 text-xs text-orange-600">
                  <Clock className="w-3 h-3 mr-1" />
                  5 days left
                </div>
              </Card>
              
              <Card className="p-6 text-center hover:shadow-md transition-shadow">
                <Shield className="w-10 h-10 mx-auto mb-3 text-purple-600" />
                <p className="text-3xl font-bold text-gray-900">98%</p>
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
              
              {activeLoans.map((loan) => (
                <div key={loan.id} className="border rounded-lg p-6 mb-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-semibold">{loan.type}</h4>
                      <p className="text-gray-600">Loan ID: {loan.id}</p>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {loan.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Loan Amount</p>
                      <p className="text-xl font-semibold">₹{(loan.amount / 100000).toFixed(1)}L</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Outstanding</p>
                      <p className="text-xl font-semibold text-orange-600">₹{(loan.outstandingAmount / 100000).toFixed(1)}L</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Monthly EMI</p>
                      <p className="text-xl font-semibold">₹{(loan.emiAmount / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Next EMI Date</p>
                      <p className="text-xl font-semibold">{loan.nextEmiDate}</p>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress ({loan.completedTenure}/{loan.tenure} months)</span>
                      <span>{Math.round((loan.completedTenure / loan.tenure) * 100)}%</span>
                    </div>
                    <Progress value={(loan.completedTenure / loan.tenure) * 100} className="h-3" />
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
                      onClick={() => navigate('/loan-details')}
                    >
                      View Details
                    </Button>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Statement
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-4 space-y-6">
            {/* Credit Score Widget */}
            <Card className="p-6 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <TrendingUp className="w-10 h-10 text-blue-600" />
              </div>
              <p className="text-4xl font-bold text-blue-600 mb-2">{userData.creditScore}</p>
              <p className="text-sm text-gray-600 mb-4">Credit Score</p>
              <div className="flex justify-center mb-4">
                <Badge className="bg-blue-100 text-blue-800">Excellent</Badge>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Last updated:</span>
                  <span>Dec 2023</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span className="text-blue-600">+25 points</span>
                </div>
              </div>
            </Card>

            {/* Upcoming Payments */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                Upcoming Payments
              </h3>
              
              {upcomingPayments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg mb-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold">₹{(payment.amount / 1000).toFixed(0)}K EMI</p>
                      <p className="text-sm text-gray-600">Due: {payment.dueDate}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-orange-300 text-orange-600">
                    {payment.status}
                  </Badge>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/pay-emi')}
              >
                Pay Now
              </Button>
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
                  onClick={() => setShowLoanApplication(true)}
                  className="w-full"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Apply Personal Loan
                </Button>
                <Button 
                  onClick={() => setShowLoanApplication(true)}
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
            <p className="text-2xl font-bold text-gray-900">{userData.totalLoans}</p>
            <p className="text-sm text-gray-600">Total Loans</p>
          </Card>
          
          <Card className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-gray-900">{userData.activeLoans}</p>
            <p className="text-sm text-gray-600">Active Loans</p>
          </Card>
          
          <Card className="p-4 text-center">
            <IndianRupee className="w-8 h-8 mx-auto mb-2 text-orange-600" />
            <p className="text-2xl font-bold text-gray-900">₹15K</p>
            <p className="text-sm text-gray-600">Next EMI</p>
          </Card>
          
          <Card className="p-4 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold text-gray-900">Jan 15</p>
            <p className="text-sm text-gray-600">Due Date</p>
          </Card>
        </div>

        {/* Active Loans */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Active Loans
          </h3>
          
          {activeLoans.map((loan) => (
            <div key={loan.id} className="border rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold">{loan.type}</h4>
                  <p className="text-sm text-gray-600">Loan ID: {loan.id}</p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {loan.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Loan Amount</p>
                  <p className="font-semibold">₹{(loan.amount / 100000).toFixed(1)}L</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="font-semibold">₹{(loan.outstandingAmount / 100000).toFixed(1)}L</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly EMI</p>
                  <p className="font-semibold">₹{(loan.emiAmount / 1000).toFixed(0)}K</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Next EMI Date</p>
                  <p className="font-semibold">{loan.nextEmiDate}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress ({loan.completedTenure}/{loan.tenure} months)</span>
                  <span>{Math.round((loan.completedTenure / loan.tenure) * 100)}%</span>
                </div>
                <Progress value={(loan.completedTenure / loan.tenure) * 100} className="h-2" />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate('/pay-emi')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Pay EMI
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/loan-details')}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </Card>

        {/* Upcoming Payments */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Upcoming Payments
          </h3>
          
          {upcomingPayments.map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded-lg mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold">₹{(payment.amount / 1000).toFixed(0)}K EMI</p>
                  <p className="text-sm text-gray-600">Due: {payment.dueDate}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-orange-300 text-orange-600">
                {payment.status}
              </Badge>
            </div>
          ))}
        </Card>

        {/* Quick Apply */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Need More Funds?</h3>
          <p className="text-gray-600 mb-4">Get instant approval with your excellent credit score</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={() => setShowLoanApplication(true)}
              style={{ backgroundColor: '#0052FF' }}
              className="text-white hover:opacity-90"
            >
              Apply Personal Loan
            </Button>
            <Button 
              onClick={() => setShowLoanApplication(true)}
              variant="outline" 
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Apply Business Loan
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderLoans = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold">My Loans</h2>
          <p className="text-gray-600">Manage and track your loan portfolio</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => navigate('/payment-history')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Payment History
          </Button>
          <Button 
            onClick={() => setShowLoanApplication(true)}
            style={{ backgroundColor: '#0052FF' }}
          >
            Apply New Loan
          </Button>
        </div>
      </div>

      {/* Active Loans Detailed View */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Loans</h3>
        
        {activeLoans.map((loan) => (
          <div key={loan.id} className="border rounded-lg p-6 mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-semibold">{loan.type}</h4>
                <p className="text-gray-600">Loan ID: {loan.id}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Sanctioned Amount</p>
                  <p className="text-xl font-semibold">₹{(loan.amount / 100000).toFixed(1)} Lakhs</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding Amount</p>
                  <p className="text-xl font-semibold text-orange-600">₹{(loan.outstandingAmount / 100000).toFixed(1)} Lakhs</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Monthly EMI</p>
                  <p className="text-xl font-semibold">₹{loan.emiAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Interest Rate</p>
                  <p className="text-xl font-semibold">{loan.interestRate}% p.a.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Next EMI Date</p>
                  <p className="text-xl font-semibold">{loan.nextEmiDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Remaining Tenure</p>
                  <p className="text-xl font-semibold">{loan.tenure - loan.completedTenure} months</p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Loan Progress</span>
                <span>{loan.completedTenure} of {loan.tenure} EMIs paid</span>
              </div>
              <Progress value={(loan.completedTenure / loan.tenure) * 100} className="h-3" />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                style={{ backgroundColor: '#0052FF' }}
                onClick={() => navigate('/pay-emi')}
              >
                Pay EMI
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Statement
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/payment-history')}
              >
                <Eye className="w-4 h-4 mr-2" />
                Payment History
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Completed Loans */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Completed Loans</h3>
        
        {completedLoans.map((loan) => (
          <div key={loan.id} className="border rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold">{loan.type}</h4>
                <p className="text-sm text-gray-600">Loan ID: {loan.id}</p>
                <p className="text-sm text-gray-600">Completed: {loan.completedDate}</p>
              </div>
              <div className="text-right">
                <Badge className="bg-blue-100 text-blue-800 mb-2">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
                <p className="text-sm font-semibold">₹{(loan.amount / 100000).toFixed(1)}L</p>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Full Name</label>
              <p className="font-semibold">{userData.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone Number</label>
              <p className="font-semibold">{userData.phone}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Email Address</label>
              <p className="font-semibold">{userData.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">KYC Status</label>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
            </div>
          </div>
          
          <Button variant="outline" className="mt-4">
            <Settings className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Credit Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center p-6 bg-blue-50 rounded-lg">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{userData.creditScore}</p>
            <p className="text-sm text-gray-600">Credit Score</p>
            <Badge className="mt-2 bg-blue-100 text-blue-800">Excellent</Badge>
          </div>
          
          <div className="text-center p-6 bg-blue-50 rounded-lg">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <IndianRupee className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">₹{(userData.availableCredit / 100000).toFixed(1)}L</p>
            <p className="text-sm text-gray-600">Available Credit</p>
            <Badge className="mt-2 bg-blue-100 text-blue-800">Pre-approved</Badge>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Documents</h2>
        <Button 
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => navigate('/upload-document')}
        >
          Upload Document
        </Button>
      </div>

      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>
        
        <div className="space-y-3">
          {documents.map((doc, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-sm text-gray-600">Uploaded: {doc.uploadDate}</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
                <Badge 
                  className={`${doc.status === 'verified' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'} whitespace-nowrap`}
                >
                  {doc.status === 'verified' ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Pending
                    </>
                  )}
                </Badge>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="flex-1 sm:flex-none"
                    onClick={() => navigate('/view-document')}
                  >
                    <Eye className="w-4 h-4 mr-1 sm:mr-0" />
                    <span className="sm:hidden">View</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="flex-1 sm:flex-none"
                  >
                    <Download className="w-4 h-4 mr-1 sm:mr-0" />
                    <span className="sm:hidden">Download</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Upload new document section */}
        <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 mb-3">Drag and drop files here or click to browse</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/upload-document')}
          >
            Choose Files
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-auto p-4 flex-col">
            <Phone className="w-8 h-8 mb-2 text-blue-600" />
            <span className="font-semibold">Call Support</span>
            <span className="text-sm text-gray-600">1800-XXX-XXXX</span>
          </Button>
          
          <Button variant="outline" className="h-auto p-4 flex-col">
            <MessageCircle className="w-8 h-8 mb-2 text-blue-600" />
            <span className="font-semibold">Live Chat</span>
            <span className="text-sm text-gray-600">Available 24/7</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        
        <div className="space-y-3">
          <Button variant="ghost" className="w-full justify-start">
            <FileText className="w-4 h-4 mr-3" />
            Download Loan Agreement
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <IndianRupee className="w-4 h-4 mr-3" />
            Payment History
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <AlertCircle className="w-4 h-4 mr-3" />
            Report an Issue
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="w-4 h-4 mr-3" />
            Account Settings
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-600">Sign Out</h3>
            <p className="text-sm text-gray-600">Securely sign out of your account</p>
          </div>
          <Button 
            variant="outline" 
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              navigate('/');
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home, path: '/dashboard' },
    { id: 'loans', label: 'My Loans', icon: CreditCard, path: '/my-loans' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'documents', label: 'Documents', icon: FileText, path: '/documents' },
    { id: 'support', label: 'Support', icon: MessageCircle, path: '/support' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={userData.name} 
      />
      
      {showLoanApplication ? (
        <ApplicationFlow />
      ) : (
        <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <div className="p-6">
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    window.location.pathname === item.path
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${window.location.pathname === item.path ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">{item.label}</span>
                  {window.location.pathname === item.path && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full ml-auto" />
                  )}
                </button>
              ))}
            </nav>
            
            {/* Quick Actions in Sidebar */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => navigate('/pay-emi')}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Pay EMI
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => navigate('/emi-calculator')}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  EMI Calculator
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => setShowLoanApplication(true)}
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
          {/* Mobile Tabs */}
          <div className="lg:hidden">
            <div className="container mx-auto px-4 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="bg-white rounded-lg p-1 shadow-sm">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm">
                      <Home className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="loans" className="text-xs sm:text-sm">
                      <CreditCard className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Loans</span>
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="text-xs sm:text-sm">
                      <User className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs sm:text-sm">
                      <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Documents</span>
                    </TabsTrigger>
                    <TabsTrigger value="support" className="text-xs sm:text-sm">
                      <MessageCircle className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Support</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview">{renderOverview()}</TabsContent>
                <TabsContent value="loans">{renderLoans()}</TabsContent>
                <TabsContent value="profile">{renderProfile()}</TabsContent>
                <TabsContent value="documents">{renderDocuments()}</TabsContent>
                <TabsContent value="support">{renderSupport()}</TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Desktop Content */}
          <div className="hidden lg:block">
            <div className="p-8">
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'loans' && renderLoans()}
              {activeTab === 'profile' && renderProfile()}
              {activeTab === 'documents' && renderDocuments()}
              {activeTab === 'support' && renderSupport()}
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}