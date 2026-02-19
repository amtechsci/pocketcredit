import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartner } from '../../contexts/PartnerContext';
import { partnerApiService, PartnerLead, PartnerStats } from '../../services/partnerApi';
import {
  TrendingUp,
  Users,
  CreditCard,
  IndianRupee,
  LogOut,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Eye,
  Search,
} from 'lucide-react';

export function PartnerDashboardPage() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = usePartner();
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    user_status: '',
    loan_status: '',
    start_date: '',
    end_date: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/partner/login');
      return;
    }
    loadDashboardData();
  }, [isAuthenticated, navigate, page, filters]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, leadsResponse] = await Promise.all([
        partnerApiService.getStats(),
        partnerApiService.getLeads({
          page,
          limit: 50,
          ...(filters.user_status && { user_status: filters.user_status }),
          ...(filters.loan_status && { loan_status: filters.loan_status }),
          ...(filters.start_date && { start_date: filters.start_date }),
          ...(filters.end_date && { end_date: filters.end_date }),
        }),
      ]);

      if (statsResponse.status && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (leadsResponse.status && leadsResponse.data) {
        setLeads(leadsResponse.data.leads);
        setTotalPages(leadsResponse.data.pagination.total_pages);
      }
    } catch (error: any) {
      if (error?.message === 'PARTNER_SESSION_EXPIRED') {
        logout();
        navigate('/partner/login', { replace: true });
        return;
      }
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setLeadsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/partner/login');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatLoanStatus = (status: string | null) => {
    if (!status) return 'N/A';
    if (status === 'on_hold') return 'Hold';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      fresh_lead: { color: 'bg-green-100 text-green-800', label: 'Fresh Lead' },
      registered_user: { color: 'bg-blue-100 text-blue-800', label: 'Registered' },
      active_user: { color: 'bg-orange-100 text-orange-800', label: 'Active User' },
    };
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Combined user status badge for table – prefer loan / attribution info
  const getUserStatusBadge = (lead: PartnerLead) => {
    // If user is registered but not via this partner, show attribution info
    // (user_id is linked, but user_registered_at is null for this partner_leads row)
    if (lead.user_id && !lead.user_registered_at) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          Joined by another partner
        </span>
      );
    }

    // If user has an application, surface key loan states instead of generic "Active User"
    if (lead.loan_status) {
      const loanStatus = (lead.loan_status || '').toLowerCase();

      if (loanStatus === 'qa_verification') {
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
            QA Verification
          </span>
        );
      }

      if (['submitted', 'under_review', 'follow_up', 'approved', 'ready_for_disbursement', 'disbursal', 'account_manager'].includes(loanStatus)) {
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            Loan Applied
          </span>
        );
      }
    }

    // Fallback to lead-level dedupe status (Fresh/Registered/Active)
    return getStatusBadge(lead.dedupe_status);
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.first_name?.toLowerCase().includes(query) ||
      lead.last_name?.toLowerCase().includes(query) ||
      lead.mobile_number?.includes(query) ||
      lead.pan_number?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Partner Dashboard</h1>
              <p className="text-sm text-gray-600">Track your leads and performance</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_leads}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Fresh Leads</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{stats.fresh_leads}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Disbursed Loans</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{stats.disbursed_loans}</p>
                </div>
                <CreditCard className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Payout</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {formatCurrency(stats.total_payout_amount)}
                  </p>
                </div>
                <IndianRupee className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              value={filters.user_status}
              onChange={(e) => { setFilters({ ...filters, user_status: e.target.value }); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All User Status</option>
              <option value="active">Active</option>
              <option value="on_hold">Hold</option>
            </select>

            <select
              value={filters.loan_status}
              onChange={(e) => { setFilters({ ...filters, loan_status: e.target.value }); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Loan Status</option>
              <option value="none">N/A (No application)</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="follow_up">Follow Up</option>
              <option value="qa_verification">QA Verification</option>
              <option value="approved">Approved</option>
              <option value="ready_for_disbursement">Ready for Disbursement</option>
              <option value="disbursal">Disbursal</option>
              <option value="account_manager">Disbursed</option>
              <option value="overdue">Overdue</option>
              <option value="cleared">Cleared</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => { setFilters({ ...filters, start_date: e.target.value }); setPage(1); }}
              placeholder="Start Date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => { setFilters({ ...filters, end_date: e.target.value }); setPage(1); }}
              placeholder="End Date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
          </div>

          {leadsLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No leads found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shared Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Loan Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Disbursal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payout
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {lead.first_name} {lead.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{lead.mobile_number}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getUserStatusBadge(lead)}
                            {lead.user_status === 'on_hold' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title="User is on hold">
                                Hold
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(lead.lead_shared_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {lead.user_id && !lead.user_registered_at ? (
                            <span className="text-gray-400 italic" title="User joined via another partner">
                              Joined by another partner
                            </span>
                          ) : lead.loan_status && !lead.loan_application_id ? (
                            <span className="text-gray-400 italic" title="User joined via another partner">
                              Joined by another partner
                            </span>
                          ) : (
                            formatLoanStatus(lead.loan_status)
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {lead.disbursed_at ? formatDate(lead.disbursed_at) : 'N/A'}
                          </div>
                          {lead.disbursal_amount && (
                            <div className="text-sm text-gray-500">{formatCurrency(lead.disbursal_amount)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lead.payout_eligible ? (
                            <div>
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(lead.payout_amount)}
                              </div>
                              <div className="text-xs text-gray-500">Grade: {lead.payout_grade}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Not Eligible</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => navigate(`/partner/lead/${lead.id}`)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
