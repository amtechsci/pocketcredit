import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Filter, Search, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface PaymentHistory {
  id: number;
  amount: number;
  transaction_type: string;
  status: string;
  created_at: string;
  processed_at: string;
  loan_id: number;
  loan_number: string;
  payment_method: string;
  transaction_id: string;
}

export function DynamicPaymentHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLoan, setFilterLoan] = useState('all');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load payment history
  const loadPaymentHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, we'll use the dashboard data to get payment history
      // In a real app, you'd have a dedicated payment history endpoint
      const response = await apiService.getDashboardSummary();
      
      if (response.status === 'success' && response.data) {
        // Create mock payment history from dashboard data
        const mockPayments: PaymentHistory[] = [];
        
        // Generate payment history for each active loan
        response.data.active_loans.forEach((loan: any) => {
          for (let i = 0; i < loan.completed_tenure; i++) {
            const paymentDate = new Date(loan.first_emi_date);
            paymentDate.setMonth(paymentDate.getMonth() + i);
            
            mockPayments.push({
              id: i + 1,
              amount: loan.emi_amount,
              transaction_type: 'emi_payment',
              status: 'success',
              created_at: paymentDate.toISOString(),
              processed_at: paymentDate.toISOString(),
              loan_id: loan.id,
              loan_number: loan.loan_number,
              payment_method: 'Auto Pay',
              transaction_id: `TXN${loan.id}${String(i + 1).padStart(3, '0')}`
            });
          }
        });
        
        setPaymentHistory(mockPayments);
      } else {
        setError('Failed to load payment history');
      }
    } catch (error: any) {
      console.error('Failed to load payment history:', error);
      setError(error.message || 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentHistory();
  }, [loadPaymentHistory]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Successful</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredPayments = paymentHistory.filter(payment => {
    const matchesSearch = 
      payment.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.payment_method.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || payment.status.toLowerCase() === filterStatus;
    const matchesLoan = filterLoan === 'all' || payment.loan_number === filterLoan;
    
    return matchesSearch && matchesStatus && matchesLoan;
  });

  const totalPaid = paymentHistory
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalInterest = paymentHistory
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + (p.amount * 0.3), 0); // Assuming 30% of EMI is interest

  const totalLateFees = 0; // No late fees in our mock data

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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Payment History</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-semibold">Payment History</h1>
              <p className="text-gray-600">View and download your payment records</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                <p className="text-sm text-gray-600">Total Paid</p>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{paymentHistory.filter(p => p.status === 'success').length}</p>
                <p className="text-sm text-gray-600">Successful Payments</p>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalInterest)}</p>
                <p className="text-sm text-gray-600">Interest Paid</p>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">₹{totalLateFees}</p>
                <p className="text-sm text-gray-600">Late Fees</p>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by transaction ID, loan ID, or payment method"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Successful</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterLoan} onValueChange={setFilterLoan}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Loan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loans</SelectItem>
                    {Array.from(new Set(paymentHistory.map(p => p.loan_number))).map(loanNumber => (
                      <SelectItem key={loanNumber} value={loanNumber}>{loanNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </Card>

          {/* Payment History Table */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Transaction History</h3>
              <p className="text-sm text-gray-600">{filteredPayments.length} transactions</p>
            </div>
            
            {/* Mobile View */}
            <div className="block lg:hidden space-y-4">
              {filteredPayments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">{payment.transaction_id}</p>
                      <p className="text-sm text-gray-600">{formatDate(payment.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loan ID</span>
                      <span>{payment.loan_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Method</span>
                      <span>{payment.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type</span>
                      <span>{payment.transaction_type}</span>
                    </div>
                  </div>
                  
                  <Button size="sm" variant="outline" className="w-full mt-3">
                    <Download className="w-4 h-4 mr-2" />
                    Download Receipt
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Transaction ID</th>
                    <th className="text-left p-3">Loan ID</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3">Type</th>
                    <th className="text-center p-3">Method</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{formatDate(payment.created_at)}</td>
                      <td className="p-3 font-mono text-sm">{payment.transaction_id}</td>
                      <td className="p-3">{payment.loan_number}</td>
                      <td className="text-right p-3 font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="text-center p-3 text-sm">{payment.transaction_type}</td>
                      <td className="text-center p-3 text-sm">{payment.payment_method}</td>
                      <td className="text-center p-3">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(payment.status)}
                          {getStatusBadge(payment.status)}
                        </div>
                      </td>
                      <td className="text-center p-3">
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPayments.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment History</h3>
                <p className="text-gray-600">No payments have been made yet.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
