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
  UserPlus,
  MessageSquare
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { maskMobileLast4 } from '../utils/mask';
import { adminApiService } from '../../services/adminApi';
import { toast } from 'sonner';


interface LoanApplication {
  id: string;
  loanId?: string; // Full application number
  shortLoanId?: string; // Short format: PLL + 4 digits
  applicantName: string;
  mobile: string;
  email: string;
  userId?: string; // User ID for fetching comments
  loanAmount: number;
  loanType: 'personal' | 'business';
  status: 'applied' | 'submitted' | 'under_review' | 'follow_up' | 'disbursal' | 'account_manager' | 'overdue' | 'cleared' | 'rejected' | 'pending_documents' | 'ready_for_disbursement' | 'ready_to_repeat_disbursal';
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
  extension_status?: 'none' | 'pending' | 'approved' | 'rejected';
  extension_count?: number;
  totalRepayable?: number;
  city: string;
  state: string;
  pincode: string;
  /** For sub-admin: 'primary' = my assign, 'temp' = temp assign (covering for someone on leave) */
  assignmentType?: 'primary' | 'temp' | null;
  /** Sub-admin assignments (names) for display: verify user, acc manager, recovery officer, agency */
  subAdminAssignments?: {
    verifyUserName: string;
    accManagerName: string;
    recoveryOfficerName: string;
    isOverdue: boolean;
  };
}

interface ProfileComment {
  id: number;
  comment_type: 'qa_comments' | 'tvr_comments';
  comment_text: string;
  created_by: string;
  created_at: string;
  created_by_name?: string;
  created_by_email?: string;
}



interface LoanApplicationsQueueProps {
  /** When provided (e.g. from Overdue page), force this status and do not read from URL */
  initialStatus?: string;
}

// Per spec: which status tabs each sub-admin can see on Applications
const SUB_ADMIN_ALLOWED_STATUSES: Record<string, string[]> = {
  verify_user: ['all', 'submitted', 'under_review', 'follow_up', 'disbursal', 'ready_for_disbursement'],
  qa_user: ['all', 'disbursal', 'ready_for_disbursement'],
  account_manager: ['all', 'repeat_disbursal', 'ready_to_repeat_disbursal'],
  recovery_officer: ['all', 'overdue'],
  debt_agency: ['all', 'overdue'],
  // Follow-up user: only Submitted and Follow Up (no All, no Under Review)
  follow_up_user: ['submitted', 'follow_up'],
};
// NBFC Admin: Over Due (when on /overdue), Ready for Disbursement, Repeat Loan Ready for Disbursal
const NBFC_ADMIN_ALLOWED_STATUSES = ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal'];

export function LoanApplicationsQueue({ initialStatus }: LoanApplicationsQueueProps = {}) {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
  const [sortBy, setSortBy] = useState('applicationDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { canApproveLoans, canRejectLoans, currentUser, isNbfcAdmin, shouldMaskMobile } = useAdmin();

  const allowedStatuses: string[] | null =
    currentUser?.role === 'nbfc_admin'
      ? NBFC_ADMIN_ALLOWED_STATUSES
      : currentUser?.role === 'sub_admin' && currentUser?.sub_admin_category
        ? (SUB_ADMIN_ALLOWED_STATUSES[currentUser.sub_admin_category] ?? null)
        : null;
  const canShowStatus = (status: string) => !allowedStatuses || allowedStatuses.includes(status);
  const maskMobileInQueue = isNbfcAdmin && shouldMaskMobile('ready_disbursement') && (statusFilter === 'ready_for_disbursement' || statusFilter === 'ready_to_repeat_disbursal');


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
  const [processingPayouts, setProcessingPayouts] = useState<string[]>([]);
  const [payoutResults, setPayoutResults] = useState<{ success: string[]; failed: Array<{ id: string; error: string }> } | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState<string | null>(null);
  const [downloadingBankCsv, setDownloadingBankCsv] = useState<string | null>(null);
  const [userComments, setUserComments] = useState<{ [userId: string]: ProfileComment[] }>({});
  const [loadingComments, setLoadingComments] = useState<{ [userId: string]: boolean }>({});
  const [expandedComments, setExpandedComments] = useState<{ [userId: string]: boolean }>({});

  // Initialize status filter from URL parameters (ignore when initialStatus is set, e.g. Over Due page)
  useEffect(() => {
    if (initialStatus) return;
    const statusFromUrl = searchParams.get('status');
    const validStatuses = ['all', 'submitted', 'under_review', 'follow_up', 'disbursal', 'account_manager', 'overdue', 'cleared', 'rejected', 'ready_for_disbursement', 'repeat_disbursal', 'ready_to_repeat_disbursal'];
    if (statusFromUrl && validStatuses.includes(statusFromUrl)) {
      const allowed = currentUser?.role === 'nbfc_admin'
        ? NBFC_ADMIN_ALLOWED_STATUSES
        : currentUser?.role === 'sub_admin' && currentUser?.sub_admin_category
          ? (SUB_ADMIN_ALLOWED_STATUSES[currentUser.sub_admin_category] ?? null)
          : null;
      if (!allowed || allowed.includes(statusFromUrl)) {
        setStatusFilter(statusFromUrl);
      } else {
        setStatusFilter(allowed[0] || 'all');
      }
    }
  }, [searchParams, initialStatus, currentUser?.role, currentUser?.sub_admin_category]);

  // Enforce allowed status for sub-admins: if current filter is not allowed, reset (unless we're on initialStatus page e.g. Over Due)
  useEffect(() => {
    if (!allowedStatuses) return;
    if (initialStatus && statusFilter === initialStatus) return; // keep e.g. overdue when on Over Due page
    if (!allowedStatuses.includes(statusFilter)) {
      const defaultStatus = isNbfcAdmin ? 'ready_for_disbursement' : (allowedStatuses[0] || 'all');
      setStatusFilter(defaultStatus);
    }
  }, [allowedStatuses, statusFilter, initialStatus, isNbfcAdmin]);

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

  const handleSelectApplication = useCallback((applicationId: string, status: string) => {
    // Allow selection of ready_for_disbursement and ready_to_repeat_disbursal loans
    if (status !== 'ready_for_disbursement' && status !== 'ready_to_repeat_disbursal') {
      toast.warning('Only loans with "Ready for Disbursement" or "Repeat Ready for Disbursal" status can be selected for payout');
      return;
    }
    setSelectedApplications(prev => 
      prev.includes(applicationId) 
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const apps = applications.length > 0 ? applications : mockApplications;
    // Select ready_for_disbursement and ready_to_repeat_disbursal loans
    const readyLoans = apps.filter(app => app.status === 'ready_for_disbursement' || app.status === 'ready_to_repeat_disbursal');
    const readyLoanIds = readyLoans.map(app => app.id);
    
    // Check if all ready loans are selected
    const allReadySelected = readyLoanIds.every(id => selectedApplications.includes(id));
    
    if (allReadySelected) {
      // Deselect all ready loans
      setSelectedApplications(prev => prev.filter(id => !readyLoanIds.includes(id)));
    } else {
      // Select all ready loans
      setSelectedApplications(prev => {
        const newSelection = [...prev];
        readyLoanIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  }, [selectedApplications, applications]);

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

  // Fetch comments for applications with ready_for_disbursement or ready_to_repeat_disbursal status
  useEffect(() => {
    const fetchCommentsForReadyLoans = async () => {
      const readyLoans = applications.filter(app => 
        (app.status === 'ready_for_disbursement' || app.status === 'ready_to_repeat_disbursal') && 
        app.userId
      );
      
      for (const loan of readyLoans) {
        const userId = loan.userId!;
        if (!userComments[userId] && !loadingComments[userId]) {
          setLoadingComments(prev => ({ ...prev, [userId]: true }));
          try {
            const response = await adminApiService.getProfileComments(userId);
            if (response.status === 'success' && response.data) {
              setUserComments(prev => ({ ...prev, [userId]: response.data }));
            }
          } catch (error) {
            console.error(`Error fetching comments for user ${userId}:`, error);
          } finally {
            setLoadingComments(prev => ({ ...prev, [userId]: false }));
          }
        }
      }
    };
    
    if (applications.length > 0) {
      fetchCommentsForReadyLoans();
    }
  }, [applications]);

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

  // Handle Excel export
  const handleExportExcel = async (status: string) => {
    try {
      setDownloadingExcel(status);
      const filters: any = { status };
      const blob = await adminApiService.exportApplicationsExcel(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const statusLabel = status === 'all' ? 'All' : status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      link.download = `loan_applications_${statusLabel}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Excel file downloaded successfully for ${statusLabel}`);
    } catch (error: any) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel file: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadingExcel(null);
    }
  };

  const handleDownloadBankCsv = async (status: 'ready_for_disbursement' | 'ready_to_repeat_disbursal') => {
    try {
      setDownloadingBankCsv(status);

      // Use backend endpoint to generate Excel (.xlsx)
      const blob = await adminApiService.exportIdfcBankCsv(status);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const statusLabel =
        status === 'ready_for_disbursement'
          ? 'ready_for_disbursement'
          : 'ready_to_repeat_disbursal';

      // Use .xlsx extension for Excel file
      link.download = `idfc_payout_${statusLabel}_${new Date()
        .toISOString()
        .split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        `Bank Excel file downloaded successfully for ${statusLabel.replace(
          /_/g,
          ' '
        )}`
      );
    } catch (error: any) {
      console.error('Error downloading bank CSV:', error);
      toast.error(error.message || 'Failed to download bank CSV file');
    } finally {
      setDownloadingBankCsv(null);
    }
  };

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
      overdue: 'Overdue',
      cleared: 'Cleared',
      rejected: 'Rejected',
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
    if (!dateString) return 'N/A';
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
    window.open(`/stpl/user-profile/${application.userId}`, '_blank');
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

  const handleBulkPayout = async () => {
    const readyLoans = selectedApplications.filter(id => {
      const app = applications.find(a => a.id === id);
      return app && (app.status === 'ready_for_disbursement' || app.status === 'ready_to_repeat_disbursal');
    });

    if (readyLoans.length === 0) {
      toast.error('Please select loans with "Ready for Disbursement" or "Repeat Ready for Disbursal" status');
      return;
    }

    if (!confirm(`Are you sure you want to process payout for ${readyLoans.length} loan(s)? This action cannot be undone.`)) {
      return;
    }

    setProcessingPayouts(readyLoans);
    setPayoutResults(null);

    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>
    };

    // Process payouts sequentially to avoid overwhelming the API
    for (const loanId of readyLoans) {
      try {
        toast.loading(`Processing payout for loan ${loanId}...`, { id: `payout-${loanId}` });
        const response = await adminApiService.disburseLoan(loanId);
        
        if (response.success) {
          results.success.push(loanId);
          toast.success(`Loan ${loanId} disbursed successfully`, { id: `payout-${loanId}` });
        } else {
          results.failed.push({ id: loanId, error: response.message || 'Unknown error' });
          toast.error(`Failed to disburse loan ${loanId}: ${response.message}`, { id: `payout-${loanId}` });
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        results.failed.push({ id: loanId, error: errorMessage });
        toast.error(`Failed to disburse loan ${loanId}: ${errorMessage}`, { id: `payout-${loanId}` });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setProcessingPayouts([]);
    setPayoutResults(results);
    setSelectedApplications([]);

    // Show summary
    if (results.success.length > 0 && results.failed.length === 0) {
      toast.success(`Successfully processed ${results.success.length} payout(s)!`);
    } else if (results.success.length > 0 && results.failed.length > 0) {
      toast.warning(`Processed ${results.success.length} payout(s) successfully, ${results.failed.length} failed`);
    } else {
      toast.error(`Failed to process all ${results.failed.length} payout(s)`);
    }

    // Refresh applications list
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

    // Refresh stats
    const statsResponse = await adminApiService.getApplicationStats();
    if (statsResponse.status === 'success') {
      setStats(statsResponse.data);
    }
  };


  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">

      {/* Search and Status Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
        <div className="space-y-4">
          {/* Status Filter Buttons - First Row */}
          <div className="flex overflow-x-auto scrollbar-hide items-center gap-2 pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
            {canShowStatus('all') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs">{pagination?.totalApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('all')}
                disabled={downloadingExcel === 'all'}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'all' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('submitted') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('submitted')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'submitted'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Submitted <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'submitted' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.submittedApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('submitted')}
                disabled={downloadingExcel === 'submitted'}
                className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'submitted' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('under_review') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('under_review')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'under_review'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Under Review <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'under_review' ? 'bg-orange-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.pendingApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('under_review')}
                disabled={downloadingExcel === 'under_review'}
                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'under_review' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('follow_up') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('follow_up')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'follow_up'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Follow Up <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'follow_up' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.followUpApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('follow_up')}
                disabled={downloadingExcel === 'follow_up'}
                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'follow_up' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('disbursal') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('disbursal')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'disbursal'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Disbursal <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'disbursal' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.disbursalApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('disbursal')}
                disabled={downloadingExcel === 'disbursal'}
                className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'disbursal' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {/* NBFC on Over Due page: show Overdue tab first so it appears on top and is active */}
            {isNbfcAdmin && initialStatus === 'overdue' && canShowStatus('overdue') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('overdue')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'overdue'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Over Due <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'overdue' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.overdueApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('overdue')}
                disabled={downloadingExcel === 'overdue'}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'overdue' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('ready_for_disbursement') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('ready_for_disbursement')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'ready_for_disbursement'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Ready for Disbursement <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'ready_for_disbursement' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.readyForDisbursementApplications || 0}</span>
              </button>
              <button
                onClick={() => handleDownloadBankCsv('ready_for_disbursement')}
                disabled={downloadingBankCsv === 'ready_for_disbursement'}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Bank Excel"
              >
                <Download className={`w-4 h-4 ${downloadingBankCsv === 'ready_for_disbursement' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('repeat_disbursal') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('repeat_disbursal')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'repeat_disbursal'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Repeat Loan Disbursal <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'repeat_disbursal' ? 'bg-cyan-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.repeatDisbursalApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('repeat_disbursal')}
                disabled={downloadingExcel === 'repeat_disbursal'}
                className="p-2 text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'repeat_disbursal' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('ready_to_repeat_disbursal') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('ready_to_repeat_disbursal')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'ready_to_repeat_disbursal'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Repeat Loan Ready for Disbursal <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'ready_to_repeat_disbursal' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.readyToRepeatDisbursalApplications || 0}</span>
              </button>
              <button
                onClick={() => handleDownloadBankCsv('ready_to_repeat_disbursal')}
                disabled={downloadingBankCsv === 'ready_to_repeat_disbursal'}
                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Bank Excel"
              >
                <Download className={`w-4 h-4 ${downloadingBankCsv === 'ready_to_repeat_disbursal' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('account_manager') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('account_manager')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'account_manager'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Account Manager <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'account_manager' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.accountManagerApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('account_manager')}
                disabled={downloadingExcel === 'account_manager'}
                className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'account_manager' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('overdue') && !(isNbfcAdmin && initialStatus === 'overdue') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('overdue')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'overdue'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Overdue <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'overdue' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.overdueApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('overdue')}
                disabled={downloadingExcel === 'overdue'}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'overdue' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('cleared') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('cleared')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'cleared'
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Cleared <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'cleared' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.clearedApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('cleared')}
                disabled={downloadingExcel === 'cleared'}
                className="p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'cleared' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
            {canShowStatus('rejected') && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleStatusFilter('rejected')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'rejected'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Rejected <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${statusFilter === 'rejected' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-800'}`}>{stats?.rejectedApplications || 0}</span>
              </button>
              <button
                onClick={() => handleExportExcel('rejected')}
                disabled={downloadingExcel === 'rejected'}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Download Excel"
              >
                <Download className={`w-4 h-4 ${downloadingExcel === 'rejected' ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            )}
          </div>

          {/* Search Bar - Second Row */}
          <div className="flex items-center">
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
          </div>
        </div>
      </div>

      {/* Statistics Cards – hidden for sub-admins and NBFC admin; they only see status tabs */}
      {currentUser?.role !== 'sub_admin' && currentUser?.role !== 'nbfc_admin' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
      )}

      {/* Bulk Payout Action Bar */}
      {selectedApplications.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-900">
                {selectedApplications.length} loan(s) selected for payout
              </span>
              <span className="text-xs text-indigo-700">
                (Only loans with "Ready for Disbursement" status)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedApplications([])}
                className="px-4 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 border border-indigo-300 rounded-md hover:bg-indigo-100 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkPayout}
                disabled={processingPayouts.length > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingPayouts.length > 0 ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing {processingPayouts.length} payout(s)...
                  </>
                ) : (
                  `Process Payout (${selectedApplications.length})`
                )}
              </button>
            </div>
          </div>
          
          {/* Payout Results */}
          {payoutResults && (
            <div className="mt-4 pt-4 border-t border-indigo-200">
              {payoutResults.success.length > 0 && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-green-700">✓ Successfully processed: {payoutResults.success.length}</span>
                </div>
              )}
              {payoutResults.failed.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-red-700">✗ Failed: {payoutResults.failed.length}</span>
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                    {payoutResults.failed.map(({ id, error }) => (
                      <li key={id}>Loan {id}: {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                  {(() => {
                    const readyLoans = currentApplications.filter(app => app.status === 'ready_for_disbursement' || app.status === 'ready_to_repeat_disbursal');
                    const readyLoanIds = readyLoans.map(app => app.id);
                    const allReadySelected = readyLoanIds.length > 0 && readyLoanIds.every(id => selectedApplications.includes(id));
                    
                    return (
                      <input
                        type="checkbox"
                        checked={allReadySelected}
                        onChange={handleSelectAll}
                        disabled={readyLoans.length === 0}
                        title={readyLoans.length === 0 ? 'No loans ready for disbursement' : 'Select all ready for disbursement'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    );
                  })()}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sub-Admins
                </th>
                {(statusFilter === 'ready_for_disbursement' || statusFilter === 'ready_to_repeat_disbursal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comments
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.map((application) => {
                const isReadyForDisbursement = application.status === 'ready_for_disbursement' || application.status === 'ready_to_repeat_disbursal';
                const isSelected = selectedApplications.includes(application.id);
                const isProcessing = processingPayouts.includes(application.id);
                
                return (
                <tr key={application.id} className={`hover:bg-gray-50 ${isProcessing ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectApplication(application.id, application.status)}
                      disabled={!isReadyForDisbursement || isProcessing}
                      title={!isReadyForDisbursement ? 'Only loans with "Ready for Disbursement" or "Repeat Ready for Disbursal" status can be selected' : 'Select for payout'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewDetails(application)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {(() => {
                        // PLL + loan_application.id (unique)
                        if (application.shortLoanId) return application.shortLoanId;
                        if (application.id != null) return `PLL${application.id}`;
                        if (application.loanId) return `PLL${application.loanId}`;
                        return 'PLL—';
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
                        {maskMobileInQueue ? maskMobileLast4(application.mobile) : application.mobile}
                      </div>
                      <div className="text-xs text-gray-500">{application.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(application.loanAmount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">{application.loanType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {application.assignmentType && (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${application.assignmentType === 'primary' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                          {application.assignmentType === 'primary' ? 'My assign' : 'Temp assign'}
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[application.status] || 'bg-gray-100 text-gray-800'}`}>
                        {getStatusLabel(application.status)}
                      </span>
                      {application.extension_status === 'pending' && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Extension Requested
                        </span>
                      )}
                      {isReadyForDisbursement && (
                        <button
                          onClick={() => handleSelectApplication(application.id, application.status)}
                          disabled={isProcessing}
                          className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? 'Processing...' : isSelected ? 'Selected' : 'Payout'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Calendar className="w-3 h-3" />
                      {formatDate(application.applicationDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const s = application.subAdminAssignments;
                      const status = application.status;
                      const afterDisbursal = status === 'account_manager';
                      const overdue = status === 'overdue';
                      const verifyUser = s?.verifyUserName ?? 'N/A';
                      const accManager = (afterDisbursal || overdue) ? (s?.accManagerName ?? 'N/A') : 'N/A';
                      const recoveryOfficer = overdue ? (s?.recoveryOfficerName ?? 'N/A') : 'N/A';
                      const agency = overdue ? 'YES' : 'NO';
                      return (
                        <div className="text-xs text-gray-700 space-y-0.5 font-mono">
                          <div>Verify user: {verifyUser}</div>
                          <div>ACC Manager: {accManager}</div>
                          <div>Recovery officer: {recoveryOfficer}</div>
                          <div>Agency: {agency}</div>
                        </div>
                      );
                    })()}
                  </td>
                  {(statusFilter === 'ready_for_disbursement' || statusFilter === 'ready_to_repeat_disbursal') && application.userId && (
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {loadingComments[application.userId] ? (
                          <span className="text-gray-400 text-xs">Loading...</span>
                        ) : userComments[application.userId] && userComments[application.userId].length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-indigo-600" />
                              <span className="text-gray-700 text-xs">
                                QA: {userComments[application.userId].filter(c => c.comment_type === 'qa_comments').length} | 
                                TVR: {userComments[application.userId].filter(c => c.comment_type === 'tvr_comments').length}
                              </span>
                            </div>
                            {expandedComments[application.userId] && (
                              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs space-y-2 max-w-xs">
                                {userComments[application.userId].map((comment) => (
                                  <div key={comment.id} className="border-b border-gray-200 pb-2 last:border-0">
                                    <div className="font-semibold text-gray-700 mb-1">
                                      {comment.comment_type === 'qa_comments' ? 'QA' : 'TVR'} Comment
                                    </div>
                                    <div className="text-gray-600 mb-1">{comment.comment_text}</div>
                                    <div className="text-gray-400 text-xs">
                                      {comment.created_by_name || comment.created_by_email || 'Unknown'} • {formatDate(comment.created_at)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => setExpandedComments(prev => ({ ...prev, [application.userId!]: !prev[application.userId!] }))}
                              className="text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              {expandedComments[application.userId] ? 'Hide' : 'Show'} Comments
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No comments</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
              })}
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