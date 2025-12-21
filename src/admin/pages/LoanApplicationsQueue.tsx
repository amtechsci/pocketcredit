import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  MoreHorizontal,
  UserPlus
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';


interface LoanApplication {
  id: string;
  loanId?: string; // Full application number
  shortLoanId?: string; // Short format: PLL + 4 digits
  applicantName: string;
  mobile: string;
  email: string;
  loanAmount: number;
  loanType: 'personal' | 'business';
  status: 'applied' | 'under_review' | 'follow_up' | 'disbursal' | 'account_manager' | 'cleared' | 'rejected' | 'pending_documents';
  applicationDate: string;
  assignedManager: string;
  recoveryOfficer: string;
  cibilScore: number;
  monthlyIncome: number;
  employment: string;
  company: string;
  processingFee?: number;
  processingFeePercent?: number;
  feesBreakdown?: Array<{
    name: string;
    percent: number;
    application_method: string;
    amount: number;
  }>;
  disbursalAmount?: number;
  totalInterest?: number;
  totalRepayable?: number;
  city: string;
  state: string;
  pincode: string;
}



export function LoanApplicationsQueue() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('applicationDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { canApproveLoans, canRejectLoans } = useAdmin();

  // Real data state
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState(0);

  // Initialize status filter from URL parameters
  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (statusFromUrl && ['all', 'submitted', 'under_review', 'follow_up', 'disbursal', 'account_manager', 'cleared', 'rejected'].includes(statusFromUrl)) {
      setStatusFilter(statusFromUrl);
    }
  }, [searchParams]);

  // Memoized callbacks to prevent re-renders
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortBy, sortOrder]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const handleSelectApplication = useCallback((applicationId: string) => {
    setSelectedApplications(prev => 
      prev.includes(applicationId) 
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const apps = applications.length > 0 ? applications : mockApplications;
    if (selectedApplications.length === apps.length) {
      setSelectedApplications([]);
    } else {
      setSelectedApplications(apps.map(app => app.id));
    }
  }, [selectedApplications.length, applications]);

  // Fetch applications data
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await adminApiService.getApplications({
          page: currentPage,
          limit: pageSize,
          status: statusFilter,
          search: searchTerm,
          sortBy,
          sortOrder
        });
        
        if (response.status === 'success') {
          setApplications(response.data.applications);
          setPagination(response.data.pagination);
        } else {
          console.error('❌ API Error:', response.message);
          setError(response.message || 'Failed to fetch applications');
        }
      } catch (err) {
        console.error('❌ Error fetching applications:', err);
        setError('Failed to fetch applications');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder]);

  // Debounced search effect with countdown
  useEffect(() => {
    // Show searching indicator when user starts typing
    if (searchInput !== searchTerm) {
      setIsSearching(true);
      setSearchCountdown(3);
      
      // Start countdown
      const countdownInterval = setInterval(() => {
        setSearchCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const timeoutId = setTimeout(() => {
        // Only update search term if it's different from current value
        if (searchInput !== searchTerm) {
          setSearchTerm(searchInput);
          setIsSearching(false);
          setSearchCountdown(0);
        }
        clearInterval(countdownInterval);
      }, 3000); // 3 second delay

      return () => {
        clearTimeout(timeoutId);
        clearInterval(countdownInterval);
      };
    }
  }, [searchInput, searchTerm]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApiService.getApplicationStats();
        if (response.status === 'success') {
          setStats(response.data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    fetchStats();
  }, []);

  // No mock data - using real database only
  const mockApplications: LoanApplication[] = [];

  const statusColors = {
    applied: 'bg-blue-100 text-blue-800',
    submitted: 'bg-blue-100 text-blue-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    follow_up: 'bg-green-100 text-green-800',
    disbursal: 'bg-teal-100 text-teal-800',
    ready_for_disbursement: 'bg-indigo-100 text-indigo-800',
    account_manager: 'bg-purple-100 text-purple-800',
    cleared: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800',
    disbursed: 'bg-purple-100 text-purple-800',
    pending_documents: 'bg-orange-100 text-orange-800'
  };

  const getStatusLabel = (status: string) => {
    const statusLabels = {
      applied: 'Applied',
      submitted: 'Submitted',
      under_review: 'Under Review',
      follow_up: 'Follow Up',
      disbursal: 'Disbursal',
      ready_for_disbursement: 'Ready for Disbursement',
      account_manager: 'Account Manager',
      cleared: 'Cleared',
      rejected: 'Rejected',
      disbursed: 'Disbursed',
      pending_documents: 'Pending Documents'
    };
    return statusLabels[status] || status.replace('_', ' ').toUpperCase();
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

  // Use real data with fallback to mock data
  const currentApplications = applications.length > 0 ? applications : mockApplications;
  const filteredApplications = currentApplications;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Applications</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
    try {
      const response = await adminApiService.updateApplicationStatus(applicationId, newStatus);
      
      if (response.status === 'success') {
        // Refresh the applications list
        const refreshResponse = await adminApiService.getApplications({
          page: currentPage,
          limit: pageSize,
          status: statusFilter,
          search: searchTerm,
          sortBy,
          sortOrder
        });
        
        if (refreshResponse.status === 'success') {
          setApplications(refreshResponse.data.applications);
          setPagination(refreshResponse.data.pagination);
        }
        
        // Show success message
        alert(`Application ${applicationId} status updated to ${newStatus} successfully!`);
      } else {
        alert(`Failed to update application: ${response.message}`);
      }
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('Failed to update application status. Please try again.');
    }
  };

  const handleViewDetails = (application: any) => {
    navigate(`/admin/user-profile/${application.userId}`);
  };

  const handleAssignApplication = (applicationId: string) => {
    // TODO: Implement assign application modal
    alert(`Assign application ${applicationId} - Feature coming soon!`);
  };


  const handleBulkApprove = async () => {
    if (selectedApplications.length === 0) return;
    
    try {
      const promises = selectedApplications.map(id => 
        adminApiService.updateApplicationStatus(id, 'approved')
      );
      
      await Promise.all(promises);
      
      // Refresh the applications list
      const refreshResponse = await adminApiService.getApplications({
        page: currentPage,
        limit: pageSize,
        status: statusFilter,
        search: searchTerm,
        sortBy,
        sortOrder
      });
      
      if (refreshResponse.status === 'success') {
        setApplications(refreshResponse.data.applications);
        setPagination(refreshResponse.data.pagination);
      }
      
      setSelectedApplications([]);
      alert(`Successfully approved ${selectedApplications.length} applications!`);
    } catch (error) {
      console.error('Error bulk approving applications:', error);
      alert('Failed to approve applications. Please try again.');
    }
  };

  const handleBulkReject = async () => {
    if (selectedApplications.length === 0) return;
    
    try {
      const promises = selectedApplications.map(id => 
        adminApiService.updateApplicationStatus(id, 'rejected')
      );
      
      await Promise.all(promises);
      
      // Refresh the applications list
      const refreshResponse = await adminApiService.getApplications({
        page: currentPage,
        limit: pageSize,
        status: statusFilter,
        search: searchTerm,
        sortBy,
        sortOrder
      });
      
      if (refreshResponse.status === 'success') {
        setApplications(refreshResponse.data.applications);
        setPagination(refreshResponse.data.pagination);
      }
      
      setSelectedApplications([]);
      alert(`Successfully rejected ${selectedApplications.length} applications!`);
    } catch (error) {
      console.error('Error bulk rejecting applications:', error);
      alert('Failed to reject applications. Please try again.');
    }
  };

  const handleBulkExport = () => {
    if (selectedApplications.length === 0) {
      alert('Please select applications to export.');
      return;
    }
    alert(`Exporting ${selectedApplications.length} selected applications - Feature coming soon!`);
  };

  const handleBulkAssign = () => {
    if (selectedApplications.length === 0) {
      alert('Please select applications to assign.');
      return;
    }
    alert(`Assigning ${selectedApplications.length} selected applications - Feature coming soon!`);
  };


  return (
    <div className="p-6 space-y-6">

      {/* Search and Status Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, ID, mobile, or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-xs text-gray-500">
                    {searchCountdown > 0 ? `Searching in ${searchCountdown}s...` : 'Searching...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleStatusFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              All <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs">{pagination?.totalApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('submitted')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'submitted'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Submitted <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'submitted' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.submittedApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('under_review')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'under_review'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Under Review <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'under_review' ? 'bg-orange-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.pendingApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('follow_up')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'follow_up'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Follow Up <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'follow_up' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.followUpApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('disbursal')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'disbursal'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Disbursal <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'disbursal' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.disbursalApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('ready_for_disbursement')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'ready_for_disbursement'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Ready for Disbursement <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'ready_for_disbursement' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.readyForDisbursementApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('account_manager')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'account_manager'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Account Manager <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'account_manager' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.accountManagerApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('cleared')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'cleared'
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Cleared <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'cleared' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.clearedApplications || 0}</span>
            </button>
            <button
              onClick={() => handleStatusFilter('rejected')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Rejected <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'rejected' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.rejectedApplications || 0}</span>
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Applications</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalApplications || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+{stats?.newApplications || 0} new applications</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.pendingApplications || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Awaiting approval</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats?.approvedApplications || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Ready for disbursement</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats?.rejectedApplications || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Requires review</span>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Applications
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
              <button
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedApplications.length === currentApplications.length && currentApplications.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('id')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Loan ID
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('applicantName')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
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
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('cibilScore')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    CIBIL
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('applicationDate')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.map((application) => (
                <tr key={application.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedApplications.includes(application.id)}
                      onChange={() => handleSelectApplication(application.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewDetails(application)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {(() => {
                        // Use shortLoanId if available, otherwise generate it from id or loanId
                        if (application.shortLoanId) {
                          return application.shortLoanId;
                        }
                        // Generate short format: PLL + last 4 digits
                        const sourceId = application.loanId || application.id;
                        if (sourceId) {
                          const last4 = sourceId.slice(-4);
                          return `PLL${last4}`;
                        }
                        // Fallback: use id padded to 4 digits
                        return `PLL${String(application.id).padStart(4, '0').slice(-4)}`;
                      })()}
                    </button>
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
                    {application.disbursalAmount && application.disbursalAmount !== application.loanAmount && (
                    <div className="text-xs text-gray-500">
                        Disbursal: {formatCurrency(application.disbursalAmount)}
                      </div>
                    )}
                    {application.feesBreakdown && application.feesBreakdown.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {application.feesBreakdown.filter((f: any) => f.application_method === 'deduct_from_disbursal').map((f: any) => (
                          <div key={f.name}>{f.name}: {formatCurrency(f.amount)}</div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Income: {formatCurrency(application.monthlyIncome)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">{application.loanType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        application.cibilScore >= 750 ? 'bg-green-500' :
                        application.cibilScore >= 650 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className={`text-sm font-medium ${
                        application.cibilScore >= 750 ? 'text-green-700' :
                        application.cibilScore >= 650 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {application.cibilScore}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {application.cibilScore >= 750 ? 'Excellent' :
                       application.cibilScore >= 650 ? 'Good' : 'Poor'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[application.status]}`}>
                      {getStatusLabel(application.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Calendar className="w-3 h-3" />
                      {formatDate(application.applicationDate)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Enhanced Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalApplications)} of {pagination.totalApplications}
                </span>
                <span className="ml-2">applications</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4 rotate-90" />
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                          pageNum === pagination.currentPage
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'border-gray-300 hover:bg-white hover:border-gray-400'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowUpDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}