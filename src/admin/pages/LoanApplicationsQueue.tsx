import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Phone,
  Calendar,
  IndianRupee,
  ArrowUpDown,
  MoreHorizontal
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';


interface LoanApplication {
  id: string;
  applicantName: string;
  mobile: string;
  email: string;
  loanAmount: number;
  loanType: 'personal' | 'business';
  status: 'applied' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'pending_documents';
  applicationDate: string;
  assignedManager: string;
  recoveryOfficer: string;
  cibilScore: number;
  monthlyIncome: number;
  employment: string;
  company: string;
  city: string;
  state: string;
  pincode: string;
}



export function LoanApplicationsQueue() {
    const navigate = useNavigate();
  const params = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('applicationDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { canApproveLoans, canRejectLoans } = useAdmin();

  const mockApplications: LoanApplication[] = [
    {
      id: 'CL250912',
      applicantName: 'Rajesh Kumar Singh',
      mobile: '+91 98765 43210',
      email: 'rajesh.kumar@email.com',
      loanAmount: 500000,
      loanType: 'personal',
      status: 'under_review',
      applicationDate: '2025-01-09T10:30:00Z',
      assignedManager: 'Raj Patel',
      recoveryOfficer: 'Amit Sharma',
      cibilScore: 720,
      monthlyIncome: 75000,
      employment: 'Software Engineer',
      company: 'TCS Limited',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001'
    },
    {
      id: 'CL250913',
      applicantName: 'Priya Sharma Verma',
      mobile: '+91 87654 32109',
      email: 'priya.sharma@email.com',
      loanAmount: 350000,
      loanType: 'personal',
      status: 'pending_documents',
      applicationDate: '2025-01-09T09:15:00Z',
      assignedManager: 'Sarah Johnson',
      recoveryOfficer: 'Vikram Singh',
      cibilScore: 680,
      monthlyIncome: 60000,
      employment: 'Marketing Manager',
      company: 'Infosys',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001'
    },
    {
      id: 'CL250914',
      applicantName: 'Amit Patel Shah',
      mobile: '+91 76543 21098',
      email: 'amit.patel@email.com',
      loanAmount: 1200000,
      loanType: 'business',
      status: 'applied',
      applicationDate: '2025-01-08T16:45:00Z',
      assignedManager: 'Raj Patel',
      recoveryOfficer: 'Priya Singh',
      cibilScore: 750,
      monthlyIncome: 150000,
      employment: 'Business Owner',
      company: 'Patel Trading Co.',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380001'
    }
  ];

  const statusColors = {
    applied: 'bg-blue-100 text-blue-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    disbursed: 'bg-purple-100 text-purple-800',
    pending_documents: 'bg-orange-100 text-orange-800'
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredApplications = mockApplications.filter(app => {
    const matchesSearch = app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.mobile.includes(searchTerm) ||
                         app.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesManager = managerFilter === 'all' || app.assignedManager === managerFilter;
    return matchesSearch && matchesStatus && matchesManager;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleStatusUpdate = (applicationId: string, newStatus: string) => {
    // In a real app, this would make an API call
    console.log(`Updating application ${applicationId} to ${newStatus}`);
    alert(`Application ${applicationId} status updated to ${newStatus}`);
  };

  const managers = ['Raj Patel', 'Sarah Johnson', 'Priya Singh'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Applications Queue</h1>
          <p className="text-gray-600">Manage and review all loan applications</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <Filter className="w-4 h-4" />
            Advanced Filter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="applied">Applied</option>
            <option value="under_review">Under Review</option>
            <option value="pending_documents">Pending Documents</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
          </select>

          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Managers</option>
            {managers.map(manager => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Applications ({filteredApplications.length})
            </h2>
            <div className="text-sm text-gray-500">
              Showing {filteredApplications.length} of {mockApplications.length} applications
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('id')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Loan ID
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('applicantName')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Applicant
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('loanAmount')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('applicationDate')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.map((application) => (
                <tr key={application.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{application.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{application.applicantName}</div>
                        <div className="text-sm text-gray-500">{application.employment}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center gap-1 mb-1">
                        <Phone className="w-3 h-3" />
                        {application.mobile}
                      </div>
                      <div className="text-xs text-gray-500">{application.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(application.loanAmount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Income: {formatCurrency(application.monthlyIncome)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">{application.loanType}</div>
                    <div className="text-xs text-gray-500">CIBIL: {application.cibilScore}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[application.status]}`}>
                      {application.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Calendar className="w-3 h-3" />
                      {formatDate(application.applicationDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{application.assignedManager}</div>
                    <div className="text-xs text-gray-500">Recovery: {application.recoveryOfficer}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/user-profile/${application.id}`)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canApproveLoans && application.status === 'under_review' && (
                        <button
                          onClick={() => handleStatusUpdate(application.id, 'approved')}
                          className="text-green-600 hover:text-green-900 p-1 rounded"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canRejectLoans && ['under_review', 'applied'].includes(application.status) && (
                        <button
                          onClick={() => handleStatusUpdate(application.id, 'rejected')}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button className="text-gray-400 hover:text-gray-600 p-1 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing 1 to {filteredApplications.length} of {mockApplications.length} results
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Previous
              </button>
              <button className="px-3 py-2 bg-blue-600 text-white rounded-md">1</button>
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">2</button>
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">3</button>
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}