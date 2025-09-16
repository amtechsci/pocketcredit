import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Calendar, TrendingUp, FileText, CreditCard, IndianRupee, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';

export function LoanDetailsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const userData = {
    name: 'Rajesh Kumar'
  };

  const loanData = {
    id: 'PL001',
    type: 'Personal Loan',
    status: 'Active',
    sanctionedAmount: 300000,
    disbursedAmount: 300000,
    outstandingAmount: 245000,
    principalOutstanding: 220000,
    interestOutstanding: 25000,
    emiAmount: 15000,
    interestRate: 12.5,
    tenure: 24,
    completedTenure: 4,
    nextEmiDate: '2024-01-15',
    disbursementDate: '2023-08-15',
    maturityDate: '2025-08-15',
    purpose: 'Home Renovation',
    processingFee: 2000,
    totalInterest: 60000,
    prepaymentCharges: '2% of outstanding principal'
  };

  const paymentHistory = [
    { date: '2023-12-15', amount: 15000, principal: 10500, interest: 4500, balance: 245000, status: 'Paid' },
    { date: '2023-11-15', amount: 15000, principal: 10300, interest: 4700, balance: 255500, status: 'Paid' },
    { date: '2023-10-15', amount: 15000, principal: 10100, interest: 4900, balance: 265800, status: 'Paid' },
    { date: '2023-09-15', amount: 15000, principal: 9900, interest: 5100, balance: 275900, status: 'Paid' },
  ];

  const upcomingPayments = [
    { date: '2024-01-15', amount: 15000, principal: 10700, interest: 4300 },
    { date: '2024-02-15', amount: 15000, principal: 10900, interest: 4100 },
    { date: '2024-03-15', amount: 15000, principal: 11100, interest: 3900 },
    { date: '2024-04-15', amount: 15000, principal: 11300, interest: 3700 },
  ];

  const documents = [
    { name: 'Loan Agreement', type: 'PDF', date: '2023-08-15', status: 'Available' },
    { name: 'Loan Sanction Letter', type: 'PDF', date: '2023-08-10', status: 'Available' },
    { name: 'Repayment Schedule', type: 'PDF', date: '2023-08-15', status: 'Available' },
    { name: 'Insurance Certificate', type: 'PDF', date: '2023-08-15', status: 'Available' },
  ];

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
              <p className="text-xl font-bold">₹{(loanData.sanctionedAmount / 100000).toFixed(1)}L</p>
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
              <p className="text-xl font-bold">₹{(loanData.outstandingAmount / 100000).toFixed(1)}L</p>
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
              <p className="text-xl font-bold">₹{(loanData.emiAmount / 1000).toFixed(0)}K</p>
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
              <p className="text-xl font-bold">{loanData.tenure - loanData.completedTenure}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loan Progress */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Loan Progress</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>EMIs Paid: {loanData.completedTenure} of {loanData.tenure}</span>
            <span>{Math.round((loanData.completedTenure / loanData.tenure) * 100)}% Complete</span>
          </div>
          <Progress value={(loanData.completedTenure / loanData.tenure) * 100} className="h-3" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loanData.completedTenure}</p>
              <p className="text-sm text-gray-600">EMIs Paid</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loanData.tenure - loanData.completedTenure}</p>
              <p className="text-sm text-gray-600">EMIs Remaining</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{loanData.interestRate}%</p>
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
              <span className="font-semibold">{loanData.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Loan Type</span>
              <span className="font-semibold">{loanData.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Purpose</span>
              <span className="font-semibold">{loanData.purpose}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Disbursement Date</span>
              <span className="font-semibold">{loanData.disbursementDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Maturity Date</span>
              <span className="font-semibold">{loanData.maturityDate}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Principal Outstanding</span>
              <span className="font-semibold">₹{loanData.principalOutstanding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Interest Outstanding</span>
              <span className="font-semibold">₹{loanData.interestOutstanding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Processing Fee Paid</span>
              <span className="font-semibold">₹{loanData.processingFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Interest</span>
              <span className="font-semibold">₹{loanData.totalInterest.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Prepayment Charges</span>
              <span className="font-semibold">{loanData.prepaymentCharges}</span>
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
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-right p-2">EMI Amount</th>
                <th className="text-right p-2">Principal</th>
                <th className="text-right p-2">Interest</th>
                <th className="text-right p-2">Balance</th>
                <th className="text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((payment, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-2">{payment.date}</td>
                  <td className="text-right p-2">₹{payment.amount.toLocaleString()}</td>
                  <td className="text-right p-2">₹{payment.principal.toLocaleString()}</td>
                  <td className="text-right p-2">₹{payment.interest.toLocaleString()}</td>
                  <td className="text-right p-2">₹{payment.balance.toLocaleString()}</td>
                  <td className="text-center p-2">
                    <Badge className="bg-green-100 text-green-800">{payment.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upcoming Payments */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Payments</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Due Date</th>
                <th className="text-right p-2">EMI Amount</th>
                <th className="text-right p-2">Principal</th>
                <th className="text-right p-2">Interest</th>
              </tr>
            </thead>
            <tbody>
              {upcomingPayments.map((payment, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-2">{payment.date}</td>
                  <td className="text-right p-2">₹{payment.amount.toLocaleString()}</td>
                  <td className="text-right p-2">₹{payment.principal.toLocaleString()}</td>
                  <td className="text-right p-2">₹{payment.interest.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderDocuments = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Loan Documents</h3>
      
      <div className="space-y-3">
        {documents.map((doc, index) => (
          <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-sm text-gray-600">Generated: {doc.date}</p>
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
        ))}
      </div>
    </Card>
  );

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">Loan Details</h1>
              <Badge className="bg-green-100 text-green-800">{loanData.status}</Badge>
            </div>
            <p className="text-gray-600">{loanData.type} - {loanData.id}</p>
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