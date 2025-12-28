import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Calendar, TrendingUp, FileText, CreditCard, IndianRupee, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface LoanDetails {
  loan: {
    id: number;
    loan_number: string;
    loan_amount: number;
    disbursed_amount: number;
    interest_rate: number;
    tenure_months: number;
    emi_amount: number;
    status: string;
    disbursed_at: string;
    first_emi_date: string;
    loan_purpose: string;
    outstanding_amount: number;
    completed_tenure: number;
    progress_percentage: number;
  };
  payments: Array<{
    id: number;
    amount: number;
    transaction_type: string;
    status: string;
    created_at: string;
    processed_at: string;
  }>;
}

export function DynamicLoanDetailsPage() {
  const navigate = useNavigate();
  const { loanId } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loanData, setLoanData] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load loan details
  const loadLoanDetails = useCallback(async () => {
    if (!loanId) {
      setError('Loan ID not provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getLoanDetails(parseInt(loanId));
      
      if (response.status === 'success' && response.data) {
        setLoanData(response.data);
      } else {
        setError('Failed to load loan details');
      }
    } catch (error: any) {
      console.error('Failed to load loan details:', error);
      setError(error.message || 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadLoanDetails();
  }, [loadLoanDetails]);

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

  // Calculate maturity date
  const getMaturityDate = (disbursedAt: string, tenureMonths: number) => {
    const disbursedDate = new Date(disbursedAt);
    const maturityDate = new Date(disbursedDate);
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);
    return maturityDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !loanData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Loan Details</h2>
          <p className="text-gray-600 mb-4">{error || 'No loan data available'}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { loan, payments } = loanData;
  const maturityDate = getMaturityDate(loan.disbursed_at, loan.tenure_months);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Loan Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sanctioned Amount</p>
              <p className="text-xl font-bold">{formatCurrency(loan.loan_amount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-xl font-bold">{formatCurrency(loan.outstanding_amount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly EMI</p>
              <p className="text-xl font-bold">{formatCurrency(loan.emi_amount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining Tenure</p>
              <p className="text-xl font-bold">{loan.tenure_months - loan.completed_tenure}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loan Progress */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Loan Progress</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>EMIs Paid: {loan.completed_tenure} of {loan.tenure_months}</span>
            <span>{Math.round(loan.progress_percentage)}% Complete</span>
          </div>
          <Progress value={loan.progress_percentage} className="h-3" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loan.completed_tenure}</p>
              <p className="text-sm text-gray-600">EMIs Paid</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loan.tenure_months - loan.completed_tenure}</p>
              <p className="text-sm text-gray-600">EMIs Remaining</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loan.interest_rate}%</p>
              <p className="text-sm text-gray-600">Interest Rate</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Loan Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Loan Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Loan ID</span>
              <span className="font-semibold">{loan.loan_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Loan Type</span>
              <span className="font-semibold">{loan.loan_purpose || 'Personal Loan'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Purpose</span>
              <span className="font-semibold">{loan.loan_purpose || 'Personal Loan'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Disbursement Date</span>
              <span className="font-semibold">{formatDate(loan.disbursed_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Maturity Date</span>
              <span className="font-semibold">{formatDate(maturityDate)}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Principal Outstanding</span>
              <span className="font-semibold">{formatCurrency(loan.outstanding_amount * 0.9)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Interest Outstanding</span>
              <span className="font-semibold">{formatCurrency(loan.outstanding_amount * 0.1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Processing Fee Paid</span>
              <span className="font-semibold">₹2,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Interest</span>
              <span className="font-semibold">{formatCurrency(loan.emi_amount * loan.tenure_months - loan.loan_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Prepayment Charges</span>
              <span className="font-semibold">2% of outstanding principal</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            className="bg-green-600 hover:bg-green-700"
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
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Statement
          </Button>
          <Button variant="outline">
            Foreclose Loan
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderPaymentSchedule = () => (
    <div className="space-y-6">
      {/* Payment History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Payment History</h3>
        
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-center p-2">Type</th>
                  <th className="text-center p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{formatDate(payment.created_at)}</td>
                    <td className="text-right p-2">₹{payment.amount.toLocaleString()}</td>
                    <td className="text-center p-2">{payment.transaction_type}</td>
                    <td className="text-center p-2">
                      <Badge className={payment.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment History</h3>
            <p className="text-gray-600">No payments have been made for this loan yet.</p>
          </div>
        )}
      </Card>

      {/* Upcoming Payments */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Payments</h3>
        
        <div className="text-center py-8">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming Payments</h3>
          <p className="text-gray-600">Next EMI details will be available soon.</p>
        </div>
      </Card>
    </div>
  );

  const renderDocuments = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Loan Documents</h3>
      
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">Loan Agreement - {loan.loan_number}</p>
              <p className="text-sm text-gray-600">Generated: {formatDate(loan.disbursed_at)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Eye className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">View</span>
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={user?.name || 'User'} 
      />
      
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">Loan Details</h1>
                <Badge className="bg-green-100 text-green-800">{loan.status}</Badge>
              </div>
              <p className="text-gray-600">{loan.loan_purpose || 'Personal Loan'} - {loan.loan_number}</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="schedule">Payment Schedule</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">{renderOverview()}</TabsContent>
            <TabsContent value="schedule">{renderPaymentSchedule()}</TabsContent>
            <TabsContent value="documents">{renderDocuments()}</TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
