import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  Calendar,
  Download,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export const RepaymentSchedulePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [loanData, setLoanData] = useState<any>(null);
  const [kfsData, setKfsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const appId = searchParams.get('applicationId');
    if (appId) {
      setApplicationId(parseInt(appId));
      fetchLoanData(parseInt(appId));
    } else {
      // Try to find loan with account_manager status
      fetchUserLoan();
    }
  }, [isAuthenticated, searchParams, navigate]);

  const fetchUserLoan = async () => {
    try {
      const response = await apiService.getPendingLoanApplications();
      if (response.success && response.data?.applications) {
        const accountManagerLoan = response.data.applications.find(
          (app: any) => app.status === 'account_manager'
        );
        if (accountManagerLoan) {
          setApplicationId(accountManagerLoan.id);
          fetchLoanData(accountManagerLoan.id);
        } else {
          // Check if there's a ready_for_disbursement loan
          const readyLoan = response.data.applications.find(
            (app: any) => app.status === 'ready_for_disbursement'
          );
          if (readyLoan) {
            setError('Your loan is ready for disbursement. Please wait for the transaction to be processed. You will be able to view your repayment schedule once the funds are disbursed.');
          } else {
            setError('No active loan found with account manager status');
          }
          setLoading(false);
        }
      } else {
        setError('No active loan found');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching user loan:', err);
      setError(err.message || 'Failed to load loan data');
      setLoading(false);
    }
  };

  const fetchLoanData = async (loanId: number) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch KFS data which contains all loan calculation details
      const kfsResponse = await apiService.getKFS(loanId);
      if (kfsResponse && (kfsResponse.success || kfsResponse.status === 'success') && kfsResponse.data) {
        setKfsData(kfsResponse.data);
        setLoanData(kfsResponse.data.loan);
      } else {
        setError('Failed to load loan data. Please try again later.');
      }
    } catch (err: any) {
      console.error('Error fetching loan data:', err);
      setError(err.message || 'Failed to load loan data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Repayment Schedule Not Available</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4 text-left max-w-md mx-auto">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  What's happening?
                </p>
                <p className="text-sm text-gray-600">
                  Your loan application has been processed and is ready for disbursement. 
                  Once the admin processes the transaction, you will be able to view your repayment schedule here.
                </p>
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!loanData || !kfsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">No loan data available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const repayment = kfsData.repayment || {};
  const calculations = kfsData.calculations || {};
  const interest = kfsData.interest || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 p-2 h-auto text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              Repayment Schedule
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your loan repayment details and schedule
            </p>
          </div>
        </div>

        {/* Loan Summary Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Loan Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(calculations.principal || loanData.sanctioned_amount || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Repayable</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(calculations.total_repayable || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Interest Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {interest.annual_rate ? `${interest.annual_rate}% p.a.` : `${(interest.rate_per_day * 365).toFixed(2)}% p.a.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repayment Details */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Repayment Details
            </h2>
            
            {repayment.emi_amount && repayment.total_emis ? (
              // Multi-EMI Plan
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">EMI Amount</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {formatCurrency(repayment.emi_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total EMIs</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {repayment.total_emis}
                      </p>
                    </div>
                  </div>
                </div>

                {/* EMI Schedule Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          EMI #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.from({ length: repayment.total_emis || 0 }).map((_, index) => {
                        const emiNumber = index + 1;
                        const isLastEmi = emiNumber === repayment.total_emis;
                        const emiAmount = isLastEmi && repayment.last_emi_amount 
                          ? repayment.last_emi_amount 
                          : repayment.emi_amount;
                        
                        // Calculate due date (simplified - would need actual schedule from backend)
                        const firstDueDate = repayment.first_due_date 
                          ? new Date(repayment.first_due_date) 
                          : new Date();
                        const dueDate = new Date(firstDueDate);
                        // Assuming monthly EMIs
                        dueDate.setMonth(dueDate.getMonth() + index);
                        
                        return (
                          <tr key={emiNumber} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {emiNumber}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatDate(dueDate.toISOString())}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(emiAmount)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Clock className="w-3 h-3 inline mr-1" />
                                Pending
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Single Payment Plan
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Repayment Date</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {formatDate(repayment.first_due_date || kfsData.repayment?.last_due_date || 'N/A')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Amount Due</p>
                      <p className="text-xl font-semibold text-blue-600">
                        {formatCurrency(calculations.total_repayable || 0)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Loan Term</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {loanData.loan_term_days || kfsData.loan?.loan_term_days || 0} days
                    {loanData.loan_term_months && ` (${loanData.loan_term_months} months)`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loan Breakdown */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Loan Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">Principal Amount</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(calculations.principal || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">Interest</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(calculations.interest || 0)}
                </span>
              </div>
              {kfsData.fees && kfsData.fees.processing_fee > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Processing Fee</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(kfsData.fees.processing_fee || 0)}
                  </span>
                </div>
              )}
              {kfsData.fees && kfsData.fees.gst > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">GST</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(kfsData.fees.gst || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 border-t-2 border-gray-300 mt-2">
                <span className="text-lg font-semibold text-gray-900">Total Repayable</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(calculations.total_repayable || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button
            onClick={() => {
              toast.info('Download feature coming soon');
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};

