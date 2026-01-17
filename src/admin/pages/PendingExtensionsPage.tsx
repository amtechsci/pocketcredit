import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Calendar,
  IndianRupee,
  ArrowLeft,
  AlertCircle,
  FileText
} from 'lucide-react';
import { adminApiService } from '../../services/adminApi';
import { toast } from 'sonner';

interface PendingExtension {
  id: number;
  loan_application_id: number;
  loan_application_number: string;
  extension_number: number;
  requested_at: string;
  original_due_date: string;
  new_due_date: string;
  extension_fee: number;
  gst_amount: number;
  interest_till_date: number;
  total_extension_amount: number;
  extension_period_days: number;
  outstanding_balance_before: number;
  status: string;
  user_id: number;
  user_name: string;
  phone: string;
  email: string;
}

export function PendingExtensionsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [extensions, setExtensions] = useState<PendingExtension[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedExtension, setSelectedExtension] = useState<PendingExtension | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingExtensions();
  }, [currentPage]);

  const fetchPendingExtensions = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching pending extensions, page:', currentPage, 'limit:', pageSize);
      const response = await adminApiService.getPendingExtensions(currentPage, pageSize);
      console.log('📊 Pending Extensions Response:', response);
      console.log('📊 Response type:', typeof response);
      console.log('📊 Response keys:', Object.keys(response || {}));
      
      // Backend returns { success: true, data: {...} } or { status: 'success', data: {...} }
      if (response && (response.success === true || response.status === 'success')) {
        if (response.data) {
          setExtensions(response.data.extensions || []);
          setPagination(response.data.pagination);
          console.log('✅ Loaded extensions:', response.data.extensions?.length || 0);
          console.log('✅ Extensions data:', response.data.extensions);
        } else {
          console.error('❌ Response has success but no data:', response);
          setExtensions([]);
        }
      } else {
        console.error('❌ Invalid response format:', response);
        console.error('❌ Response.success:', response?.success);
        console.error('❌ Response.status:', response?.status);
        setExtensions([]);
        if (response?.message) {
          toast.error(response.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching pending extensions:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error data:', error.response?.data);
      setExtensions([]);
      toast.error(error.message || 'Failed to load pending extensions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedExtension) return;

    try {
      const response = await adminApiService.approveExtension(
        selectedExtension.id,
        referenceNumber || undefined
      );

      if (response.status === 'success' || response.success === true) {
        toast.success('Extension approved successfully! Transaction created automatically.');
        setShowApproveModal(false);
        setSelectedExtension(null);
        setReferenceNumber('');
        fetchPendingExtensions();
      } else {
        const errorMsg = response.message || 'Failed to approve extension';
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error approving extension:', error);
      toast.error(error.message || 'Failed to approve extension');
    }
  };

  const handleReject = async () => {
    if (!selectedExtension) return;

    try {
      const response = await adminApiService.rejectExtension(
        selectedExtension.id,
        rejectionReason || undefined
      );

      if (response.status === 'success') {
        toast.success('Extension rejected');
        setShowRejectModal(false);
        setSelectedExtension(null);
        setRejectionReason('');
        fetchPendingExtensions();
      } else {
        toast.error(response.message || 'Failed to reject extension');
      }
    } catch (error: any) {
      console.error('Error rejecting extension:', error);
      toast.error(error.message || 'Failed to reject extension');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      // Handle JSON array format for multi-EMI
      if (dateString.startsWith('[')) {
        const dates = JSON.parse(dateString);
        return dates.map((d: string) => new Date(d).toLocaleDateString('en-IN')).join(', ');
      }
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getShortLoanId = (applicationNumber: string) => {
    if (!applicationNumber) return 'N/A';
    const last4 = applicationNumber.slice(-4);
    return `PLL${last4}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/stpl/applications')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pending Extension Requests</h1>
              <p className="text-sm text-gray-600 mt-1">
                Review and approve/reject loan extension requests
              </p>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        {pagination && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-gray-600">Total Pending</p>
                <p className="text-2xl font-bold text-orange-600">{pagination.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Page</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pagination.page} of {pagination.total_pages}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Extensions List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-gray-400 animate-spin mb-4" />
            <p className="text-gray-600">Loading pending extensions...</p>
          </div>
        ) : extensions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-gray-600 text-lg">No pending extension requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {extensions.map((extension) => (
              <div
                key={extension.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {getShortLoanId(extension.loan_application_number)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Extension #{extension.extension_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        Pending
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Borrower</p>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{extension.user_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{extension.phone}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Original Due Date</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{formatDate(extension.original_due_date)}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">New Due Date</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-green-600">
                            {formatDate(extension.new_due_date)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Extension Period</p>
                        <span className="font-medium">{extension.extension_period_days} days</span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Outstanding Balance</p>
                        <div className="flex items-center gap-2">
                          <IndianRupee className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {formatCurrency(extension.outstanding_balance_before)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Requested At</p>
                        <span className="text-sm text-gray-600">
                          {new Date(extension.requested_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <p className="text-xs text-gray-500 mb-2">Extension Payment Details</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Extension Fee</p>
                          <p className="font-medium">{formatCurrency(extension.extension_fee)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">GST</p>
                          <p className="font-medium">{formatCurrency(extension.gst_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Interest Till Date</p>
                          <p className="font-medium">{formatCurrency(extension.interest_till_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Amount</p>
                          <p className="font-medium text-orange-600">
                            {formatCurrency(extension.total_extension_amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => {
                        setSelectedExtension(extension);
                        setShowApproveModal(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExtension(extension);
                        setShowRejectModal(true);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => navigate(`/admin/user-profile/${extension.user_id}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Loan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pagination.total_pages, p + 1))}
              disabled={currentPage === pagination.total_pages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedExtension && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Approve Extension Request</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Loan: <span className="font-medium">{getShortLoanId(selectedExtension.loan_application_number)}</span>
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Borrower: <span className="font-medium">{selectedExtension.user_name}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Total Extension Amount: <span className="font-medium text-orange-600">
                    {formatCurrency(selectedExtension.total_extension_amount)}
                  </span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UTR / Reference Number (Optional)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter UTR/Reference number (optional)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A transaction will be automatically created when you approve. You can optionally enter a UTR/Reference number for the payment.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedExtension(null);
                    setReferenceNumber('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedExtension && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Reject Extension Request</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Loan: <span className="font-medium">{getShortLoanId(selectedExtension.loan_application_number)}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Borrower: <span className="font-medium">{selectedExtension.user_name}</span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Enter reason for rejection..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedExtension(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

