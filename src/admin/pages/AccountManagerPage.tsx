import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import { Search, Eye, ArrowLeft, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface AccountManagerUser {
  slno: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  alternate_mobile?: string | null;
  total_loans: number;
  principal_amount: number;
  exhausted_days: number;
  dpd: number;
  outstanding_amount: number;
  emi_breakdown?: { emi_number: number; due_date: string | null; amount: number; status: string }[];
  loan_application_id: number;
  application_number: string;
  salary_date?: number | null;
  loan_limit?: number | null;
  monthly_net_income?: number | null;
  cst_response: string;
  cst_responses?: string[];
  commitment_date: string;
  updates: string;
  loan_status: string;
  disbursed_at?: string;
  updated_at: string;
}

export function AccountManagerPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AccountManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminApiService.getAccountManagerUsers(currentPage, pageSize, searchTerm);

      if (response.status === 'success' && response.data) {
        setUsers(response.data.users || []);
        setTotalUsers(response.data.total || 0);
      } else {
        toast.error(response.message || 'Failed to fetch Account Manager users');
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (error: any) {
      console.error('Error fetching Account Manager users:', error);
      toast.error('Failed to fetch Account Manager users');
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, decimals = 2) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const getLoanStatusBadge = (loanStatus: string) => {
    if (loanStatus === 'overdue') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Briefcase className="w-3 h-3 mr-1" />
          Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Briefcase className="w-3 h-3 mr-1" />
        Account Manager
      </span>
    );
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Manager</h1>
              <p className="text-gray-600">
                Disbursed loans in Account Manager or Overdue status
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{totalUsers}</div>
              <div className="text-sm text-gray-600">Total Loans</div>
            </div>
          </div>
        </div>
        {/* Search Bar - same card */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, email, phone, alt number, application number..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Account Manager loans...</p>
            </div>
          </div>
        ) : users.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SL No</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name (User ID)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Loans</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Principal</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exhausted Days</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DPD</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Limit vs Salary</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loan ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Salary Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CST Response</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commitment Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updates</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((row) => (
                    <tr key={`${row.user_id}-${row.loan_application_id}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{row.slno}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                        </div>
                        <div className="text-xs text-gray-500">ID: {row.user_id}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <div>{row.phone || '—'}</div>
                        {row.alternate_mobile && (
                          <div className="text-xs text-gray-500">Alt: {row.alternate_mobile}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{row.total_loans}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatCurrency(row.principal_amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{row.exhausted_days}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <span className={row.dpd > 0 ? 'text-orange-600 font-medium' : ''}>{row.dpd}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {row.emi_breakdown && row.emi_breakdown.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {row.emi_breakdown.map((emi) => (
                              <div key={emi.emi_number}>Total: {formatCurrency(emi.amount)}</div>
                            ))}
                            <div className="font-semibold border-t border-gray-200 pt-1 mt-1">Total: {formatCurrency(row.outstanding_amount)}</div>
                          </div>
                        ) : (
                          formatCurrency(row.outstanding_amount)
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {row.loan_limit != null && row.monthly_net_income != null && Number(row.monthly_net_income) > 0
                          ? `${((Number(row.loan_limit) / Number(row.monthly_net_income)) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-mono">PLL{row.loan_application_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {row.salary_date != null ? String(row.salary_date) : '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-[220px]">
                        {row.cst_responses && row.cst_responses.length > 0 ? (
                          <div className="flex flex-col gap-0.5" title={row.cst_responses.join('\n')}>
                            {row.cst_responses.map((r, i) => (
                              <span key={i} className="line-clamp-1">{r || '—'}</span>
                            ))}
                          </div>
                        ) : (
                          row.cst_response || '—'
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {row.commitment_date ? (row.commitment_date.slice(0, 10)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 max-w-[180px] whitespace-nowrap" title={row.updates}>
                        {row.updates || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => window.open(`/stpl/user-profile/${row.user_id}`, '_blank')}
                          className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * pageSize, totalUsers)}</span> of{' '}
                      <span className="font-medium">{totalUsers}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return pageNum;
                      }).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === page
                            ? 'z-10 bg-purple-50 border-purple-500 text-purple-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No loans in Account Manager</h3>
            <p className="text-gray-600">There are currently no disbursed loans in Account Manager or Overdue status.</p>
          </div>
        )}
    </div>
  );
}
