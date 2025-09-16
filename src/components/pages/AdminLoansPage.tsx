import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  Download,
  Phone,
  Mail,
  User,
  IndianRupee
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import type { Page } from '../../App';

interface AdminLoansPageProps {
  onNavigate: (page: Page) => void;
  onAdminLogout: () => void;
}

export function AdminLoansPage({ onNavigate, onAdminLogout }: AdminLoansPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  const applications = [
    {
      id: 'LA001234',
      customer: 'Rajesh Kumar',
      email: 'rajesh.kumar@email.com',
      phone: '+91 98765 43210',
      amount: 500000,
      type: 'Personal Loan',
      status: 'pending',
      date: '2025-01-09',
      income: 75000,
      cibilScore: 720,
      employment: 'Software Engineer',
      company: 'TCS Limited',
      documents: ['PAN Card', 'Aadhaar Card', 'Salary Slips', 'Bank Statements']
    },
    {
      id: 'LA001235',
      customer: 'Priya Sharma',
      email: 'priya.sharma@email.com',
      phone: '+91 87654 32109',
      amount: 350000,
      type: 'Personal Loan',
      status: 'approved',
      date: '2025-01-09',
      income: 60000,
      cibilScore: 780,
      employment: 'Marketing Manager',
      company: 'Infosys',
      documents: ['PAN Card', 'Aadhaar Card', 'Salary Slips', 'Bank Statements']
    },
    {
      id: 'LA001236',
      customer: 'Amit Patel',
      email: 'amit.patel@email.com',
      phone: '+91 76543 21098',
      amount: 1200000,
      type: 'Business Loan',
      status: 'under_review',
      date: '2025-01-08',
      income: 150000,
      cibilScore: 750,
      employment: 'Business Owner',
      company: 'Patel Trading Co.',
      documents: ['PAN Card', 'Aadhaar Card', 'ITR', 'Business Registration', 'Bank Statements']
    },
    {
      id: 'LA001237',
      customer: 'Sunita Verma',
      email: 'sunita.verma@email.com',
      phone: '+91 65432 10987',
      amount: 275000,
      type: 'Personal Loan',
      status: 'rejected',
      date: '2025-01-08',
      income: 35000,
      cibilScore: 620,
      employment: 'Teacher',
      company: 'Delhi Public School',
      documents: ['PAN Card', 'Aadhaar Card', 'Salary Slips']
    },
    {
      id: 'LA001238',
      customer: 'Vikram Singh',
      email: 'vikram.singh@email.com',
      phone: '+91 54321 09876',
      amount: 800000,
      type: 'Business Loan',
      status: 'approved',
      date: '2025-01-07',
      income: 120000,
      cibilScore: 790,
      employment: 'Restaurant Owner',
      company: 'Singh Foods Pvt Ltd',
      documents: ['PAN Card', 'Aadhaar Card', 'ITR', 'Business License', 'Bank Statements']
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'under_review':
        return <Badge className="bg-blue-100 text-blue-800">Under Review</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusUpdate = (applicationId: string, newStatus: string) => {
    // In a real app, this would make an API call
    console.log(`Updating application ${applicationId} to ${newStatus}`);
    // Show success message
    alert(`Application ${applicationId} ${newStatus} successfully!`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('admin-dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                Loan Applications
              </h1>
              <p className="text-gray-600">Manage and review loan applications</p>
            </div>
          </div>
          <Button
            onClick={onAdminLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Applications ({filteredApplications.length})</CardTitle>
            <CardDescription>
              Review and manage loan applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>CIBIL Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="font-mono text-sm">{application.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{application.customer}</div>
                          <div className="text-sm text-gray-500">{application.employment}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <Phone className="w-3 h-3" />
                            {application.phone}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {application.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold" style={{ color: '#0052FF' }}>
                        {formatCurrency(application.amount)}
                      </TableCell>
                      <TableCell>{application.type}</TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            application.cibilScore >= 750 
                              ? 'bg-green-100 text-green-800' 
                              : application.cibilScore >= 650 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {application.cibilScore}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell className="text-sm">{application.date}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedApplication(application)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>Application Details - {application.id}</DialogTitle>
                                <DialogDescription>
                                  Complete application information and documents
                                </DialogDescription>
                              </DialogHeader>
                              
                              {selectedApplication && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Customer Info */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Customer Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Name</label>
                                        <p className="font-semibold">{selectedApplication.customer}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Email</label>
                                        <p>{selectedApplication.email}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Phone</label>
                                        <p>{selectedApplication.phone}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Employment</label>
                                        <p>{selectedApplication.employment}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Company</label>
                                        <p>{selectedApplication.company}</p>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Loan Info */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2">
                                        <IndianRupee className="w-5 h-5" />
                                        Loan Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Loan Amount</label>
                                        <p className="font-semibold text-lg" style={{ color: '#0052FF' }}>
                                          {formatCurrency(selectedApplication.amount)}
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Loan Type</label>
                                        <p>{selectedApplication.type}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Monthly Income</label>
                                        <p>{formatCurrency(selectedApplication.income)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">CIBIL Score</label>
                                        <p>
                                          <Badge 
                                            className={
                                              selectedApplication.cibilScore >= 750 
                                                ? 'bg-green-100 text-green-800' 
                                                : selectedApplication.cibilScore >= 650 
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                            }
                                          >
                                            {selectedApplication.cibilScore}
                                          </Badge>
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Current Status</label>
                                        <p>{getStatusBadge(selectedApplication.status)}</p>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Documents */}
                                  <Card className="md:col-span-2">
                                    <CardHeader>
                                      <CardTitle>Submitted Documents</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {selectedApplication.documents.map((doc, index) => (
                                          <div key={index} className="p-3 border rounded-lg text-center">
                                            <div className="text-sm font-medium">{doc}</div>
                                            <Button size="sm" variant="outline" className="mt-2">
                                              View
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Actions */}
                                  {selectedApplication.status === 'pending' && (
                                    <div className="md:col-span-2 flex gap-4 justify-center pt-4">
                                      <Button
                                        onClick={() => handleStatusUpdate(selectedApplication.id, 'approved')}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Approve Application
                                      </Button>
                                      <Button
                                        onClick={() => handleStatusUpdate(selectedApplication.id, 'rejected')}
                                        variant="destructive"
                                      >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Reject Application
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          {application.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(application.id, 'approved')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleStatusUpdate(application.id, 'rejected')}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}