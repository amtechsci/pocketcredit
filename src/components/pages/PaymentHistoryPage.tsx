import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Filter, Search, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLoan, setFilterLoan] = useState('all');

  const userData = {
    name: 'Rajesh Kumar'
  };

  const paymentHistory = [
    {
      id: 'TXN001',
      date: '2023-12-15',
      loanId: 'PL001',
      loanType: 'Personal Loan',
      amount: 15000,
      principal: 10500,
      interest: 4500,
      lateFee: 0,
      paymentMethod: 'Auto Pay',
      status: 'Successful',
      transactionId: 'TXN2023121501',
      receiptUrl: '#'
    },
    {
      id: 'TXN002',
      date: '2023-11-15',
      loanId: 'PL001',
      loanType: 'Personal Loan',
      amount: 15000,
      principal: 10300,
      interest: 4700,
      lateFee: 0,
      paymentMethod: 'UPI',
      status: 'Successful',
      transactionId: 'TXN2023111501',
      receiptUrl: '#'
    },
    {
      id: 'TXN003',
      date: '2023-10-15',
      loanId: 'PL001',
      loanType: 'Personal Loan',
      amount: 15000,
      principal: 10100,
      interest: 4900,
      lateFee: 0,
      paymentMethod: 'Net Banking',
      status: 'Successful',
      transactionId: 'TXN2023101501',
      receiptUrl: '#'
    },
    {
      id: 'TXN004',
      date: '2023-09-18',
      loanId: 'PL001',
      loanType: 'Personal Loan',
      amount: 15500,
      principal: 9900,
      interest: 5100,
      lateFee: 500,
      paymentMethod: 'Debit Card',
      status: 'Successful',
      transactionId: 'TXN2023091801',
      receiptUrl: '#'
    },
    {
      id: 'TXN005',
      date: '2023-08-20',
      loanId: 'BL001',
      loanType: 'Business Loan',
      amount: 25000,
      principal: 18000,
      interest: 7000,
      lateFee: 0,
      paymentMethod: 'Auto Pay',
      status: 'Successful',
      transactionId: 'TXN2023082001',
      receiptUrl: '#'
    },
    {
      id: 'TXN006',
      date: '2023-08-15',
      loanId: 'PL001',
      loanType: 'Personal Loan',
      amount: 15000,
      principal: 9700,
      interest: 5300,
      lateFee: 0,
      paymentMethod: 'Auto Pay',
      status: 'Failed',
      transactionId: 'TXN2023081501',
      receiptUrl: null
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Successful':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'Pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Successful':
        return <Badge className="bg-green-100 text-green-800">Successful</Badge>;
      case 'Failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'Pending':
        return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredPayments = paymentHistory.filter(payment => {
    const matchesSearch = 
      payment.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.loanId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || payment.status.toLowerCase() === filterStatus;
    const matchesLoan = filterLoan === 'all' || payment.loanId === filterLoan;
    
    return matchesSearch && matchesStatus && matchesLoan;
  });

  const totalPaid = paymentHistory
    .filter(p => p.status === 'Successful')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalInterest = paymentHistory
    .filter(p => p.status === 'Successful')
    .reduce((sum, p) => sum + p.interest, 0);

  const totalLateFees = paymentHistory
    .filter(p => p.status === 'Successful')
    .reduce((sum, p) => sum + p.lateFee, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={userData.name} 
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
              <p className="text-2xl font-bold text-green-600">₹{(totalPaid / 100000).toFixed(1)}L</p>
              <p className="text-sm text-gray-600">Total Paid</p>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{paymentHistory.filter(p => p.status === 'Successful').length}</p>
              <p className="text-sm text-gray-600">Successful Payments</p>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">₹{(totalInterest / 1000).toFixed(0)}K</p>
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
                  <SelectItem value="successful">Successful</SelectItem>
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
                  <SelectItem value="PL001">PL001</SelectItem>
                  <SelectItem value="BL001">BL001</SelectItem>
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
                    <p className="font-semibold">{payment.transactionId}</p>
                    <p className="text-sm text-gray-600">{payment.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{payment.amount.toLocaleString()}</p>
                    {getStatusBadge(payment.status)}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan ID</span>
                    <span>{payment.loanId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method</span>
                    <span>{payment.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Principal</span>
                    <span>₹{payment.principal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interest</span>
                    <span>₹{payment.interest.toLocaleString()}</span>
                  </div>
                  {payment.lateFee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Late Fee</span>
                      <span>₹{payment.lateFee.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                
                {payment.receiptUrl && (
                  <Button size="sm" variant="outline" className="w-full mt-3">
                    <Download className="w-4 h-4 mr-2" />
                    Download Receipt
                  </Button>
                )}
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
                  <th className="text-right p-3">Principal</th>
                  <th className="text-right p-3">Interest</th>
                  <th className="text-center p-3">Method</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{payment.date}</td>
                    <td className="p-3 font-mono text-sm">{payment.transactionId}</td>
                    <td className="p-3">{payment.loanId}</td>
                    <td className="text-right p-3 font-semibold">
                      ₹{payment.amount.toLocaleString()}
                      {payment.lateFee > 0 && (
                        <span className="block text-xs text-red-600">
                          +₹{payment.lateFee} late fee
                        </span>
                      )}
                    </td>
                    <td className="text-right p-3">₹{payment.principal.toLocaleString()}</td>
                    <td className="text-right p-3">₹{payment.interest.toLocaleString()}</td>
                    <td className="text-center p-3 text-sm">{payment.paymentMethod}</td>
                    <td className="text-center p-3">
                      <div className="flex items-center justify-center gap-1">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                      </div>
                    </td>
                    <td className="text-center p-3">
                      {payment.receiptUrl ? (
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions found matching your criteria</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  </div>
  );
}