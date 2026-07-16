import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApiService } from '../../services/adminApi';
import {
  Search,
  Eye,
  User,
  Phone,
  FileText,
  CheckSquare,
  Loader2,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface DocsVerifyRecord {
  record_id: number;
  user_id: number;
  loan_application_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  application_number: string;
  loan_amount: number;
  loan_purpose?: string;
  loan_status?: string;
  application_date?: string;
  employment_type?: string;
  company_name?: string;
  verify_user_name?: string | null;
  follow_up_user_name?: string | null;
  acc_manager_name?: string | null;
  recovery_officer_name?: string | null;
  payslip_url: string | null;
  company_id_url: string | null;
  updated_at: string;
  ev_status?: string;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  follow_up: 'bg-green-100 text-green-800',
  disbursal: 'bg-teal-100 text-teal-800',
  account_manager: 'bg-purple-100 text-purple-800',
  overdue: 'bg-red-100 text-red-800',
  ready_for_disbursement: 'bg-indigo-100 text-indigo-800',
  ready_to_repeat_disbursal: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  cleared: 'bg-gray-100 text-gray-800'
};

function statusLabel(status?: string) {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocsVerifyPage() {
  const [records, setRecords] = useState<DocsVerifyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [approving, setApproving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminApiService.getDocsVerifyList(currentPage, pageSize, searchTerm);

      if (response.status === 'success' && response.data) {
        setRecords(response.data.records || []);
        setTotalRecords(response.data.total || 0);
        setLastUpdated(new Date());
        const currentIds = new Set((response.data.records || []).map((r: DocsVerifyRecord) => r.record_id));
        setSelectedRecordIds((prev) => prev.filter((id) => currentIds.has(id)));
      } else {
        toast.error(response.message || 'Failed to fetch docs verify list');
        setRecords([]);
        setTotalRecords(0);
        setSelectedRecordIds([]);
      }
    } catch (error) {
      console.error('Error fetching docs verify list:', error);
      toast.error('Failed to fetch docs verify list');
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Debounce search like Applications queue
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSelect = (recordId: number) => {
    setSelectedRecordIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(records.map((r) => r.record_id));
    }
  };

  const handleApproveSelected = async () => {
    if (selectedRecordIds.length === 0) {
      toast.error('Please select at least one profile');
      return;
    }
    setApproving(true);
    try {
      const response = await adminApiService.approveDocsVerifySelected(selectedRecordIds);
      if (response.status === 'success') {
        toast.success(response.message || `Approved ${selectedRecordIds.length} profile(s)`);
        setSelectedRecordIds([]);
        fetchRecords();
      } else {
        toast.error(response.message || 'Failed to approve profiles');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve selected profiles');
    } finally {
      setApproving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    const n = Number(amount) || 0;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const allSelected = records.length > 0 && selectedRecordIds.length === records.length;

  const pageLabel = useMemo(
    () => `Showing ${records.length} of ${totalRecords} pending`,
    [records.length, totalRecords]
  );

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header — same pattern as Applications */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Docs Verify</h1>
          <p className="text-sm text-gray-600 mt-1">
            Employment documents pending manual review ({totalRecords})
          </p>
        </div>
        <button
          onClick={handleApproveSelected}
          disabled={approving || selectedRecordIds.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {approving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckSquare className="w-4 h-4" />
              Approve Selected ({selectedRecordIds.length})
            </>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, loan ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {selectedRecordIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-amber-900">
              {selectedRecordIds.length} profile(s) selected for document approval
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRecordIds([])}
                className="px-4 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-md hover:bg-amber-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApproveSelected}
                disabled={approving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
              >
                {approving ? 'Approving…' : `Approve (${selectedRecordIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table card — Applications layout */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Applications</h2>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{pageLabel}</span>
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <button
                type="button"
                onClick={() => fetchRecords()}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No profiles pending document verification</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applicant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sub-Admins
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => {
                  const loanId = record.loan_application_id
                    ? `PLL${record.loan_application_id}`
                    : 'PLL—';
                  const name = `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Unknown';
                  const loanType = (record.loan_purpose || 'personal').toLowerCase();
                  const loanStatus = record.loan_status || 'submitted';

                  return (
                    <tr key={record.record_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.includes(record.record_id)}
                          onChange={() => toggleSelect(record.record_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => window.open(`/stpl/user-profile/${record.user_id}`, '_blank')}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                          >
                            {loanId}
                          </button>
                          <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                            Docs Verify
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{name}</div>
                            <div className="text-sm text-gray-500 capitalize">
                              {record.employment_type || 'Salaried'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center gap-1 mb-1">
                            <Phone className="w-3 h-3" />
                            {record.phone || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{record.email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(record.loan_amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{loanType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              STATUS_COLORS[loanStatus] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {statusLabel(loanStatus)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Calendar className="w-3 h-3" />
                          {formatDate(record.application_date || record.updated_at)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Docs: {formatDate(record.updated_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {record.payslip_url ? (
                            <a
                              href={record.payslip_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            >
                              <FileText className="w-3 h-3" />
                              Payslip
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No payslip</span>
                          )}
                          {record.company_id_url ? (
                            <a
                              href={record.company_id_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            >
                              <FileText className="w-3 h-3" />
                              Company ID
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No company ID</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-700 space-y-0.5 font-mono">
                          <div>Verify user: {record.verify_user_name || 'N/A'}</div>
                          <div>Follow up user: {record.follow_up_user_name || 'N/A'}</div>
                          <div>ACC Manager: {record.acc_manager_name || 'N/A'}</div>
                          <div>Recovery officer: {record.recovery_officer_name || 'N/A'}</div>
                          <div>Agency: NO</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => window.open(`/stpl/user-profile/${record.user_id}`, '_blank')}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalRecords > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} · {totalRecords} total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocsVerifyPage;
