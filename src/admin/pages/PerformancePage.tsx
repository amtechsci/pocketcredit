import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  BarChart3,
  Users,
  FileCheck,
  ClipboardCheck,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';

const PERFORMANCE_BASE = '/stpl/performance';

interface PerformanceData {
  from_date: string;
  to_date: string;
  fetch_time: string;
  followUp: {
    current: { submitted: number; follow_up: number; tvr: number };
    inRange: {
      movedSubmittedToUnderReview: number;
      movedSubmittedToUnderReviewWithLog: number;
      movedSubmittedToUnderReviewWithoutLog: number;
      movedFollowUpToUnderReview: number;
      movedTvrToQa: number;
    };
    zeroUpdateToday: { submitted: string[]; follow_up: string[]; tvr: string[] };
    hourly: { hour: number; label: string; count: number }[];
  } | null;
  verify: {
    current: { submitted: number };
    hourly: { hour: number; label: string; movedToTvr: number; movedToFollowUp: number; cancelled: number }[];
  } | null;
  qa: {
    current: { qa: number };
    hourly: { hour: number; label: string; movedToDisbursal: number; movedToFollowUp: number; cancelled: number }[];
  } | null;
}

interface DisbursalRow {
  account_manager_id: string | null;
  account_manager_name: string;
  ids_moved: number;
  total_principal: number;
}

interface FollowUpUserRow {
  admin_id: string;
  name: string;
  email: string;
  totalAssigned: number;
  submitted: number;
  follow_up: number;
  tvr: number;
  movedToUnderReviewWithLog: number;
  movedToUnderReviewWithoutLog: number;
  movedFollowUpToUnderReview: number;
  movedTvrToQa: number;
}

export function PerformancePage() {
  const { currentUser } = useAdmin();
  const [searchParams] = useSearchParams();
  const followUpUserId = searchParams.get('follow_up_user') || undefined;
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [followUpUsersReport, setFollowUpUsersReport] = useState<{ from_date: string; to_date: string; users: FollowUpUserRow[] } | null>(null);
  const [disbursal, setDisbursal] = useState<{ from_date: string; to_date: string; synergi: DisbursalRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = today;
  const defaultTo = today;

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = fromDate || defaultFrom;
      const to = toDate || defaultTo;
      const params: { from_date: string; to_date: string; follow_up_user?: string } = { from_date: from, to_date: to };
      if (followUpUserId) params.follow_up_user = followUpUserId;
      const res = await adminApiService.getPerformance(params);
      if (res.status === 'success' && res.data) setPerf(res.data as PerformanceData);
      else setError(res.message || 'Failed to load performance');
    } catch (e: any) {
      setError(e?.message || 'Failed to load performance');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, followUpUserId]);

  const fetchDisbursal = useCallback(async () => {
    setError(null);
    try {
      const from = fromDate || defaultFrom;
      const to = toDate || defaultTo;
      const res = await adminApiService.getDisbursalStatistics({ from_date: from, to_date: to });
      if (res.status === 'success' && res.data) setDisbursal(res.data as { from_date: string; to_date: string; synergi: DisbursalRow[] });
    } catch (e: any) {
      console.error('Disbursal stats:', e);
    }
  }, [fromDate, toDate]);

  const fetchFollowUpUsersReport = useCallback(async () => {
    try {
      const from = fromDate || defaultFrom;
      const to = toDate || defaultTo;
      const res = await adminApiService.getPerformanceFollowUpUsers({ from_date: from, to_date: to });
      if (res.status === 'success' && res.data) setFollowUpUsersReport(res.data);
    } catch (e: any) {
      console.error('Follow-up users report:', e);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  useEffect(() => {
    fetchDisbursal();
  }, [fetchDisbursal]);

  useEffect(() => {
    if (currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin') {
      fetchFollowUpUsersReport();
    }
  }, [currentUser?.role, fetchFollowUpUsersReport]);

  const handleRefresh = () => {
    fetchPerformance();
    fetchDisbursal();
    if (currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin') {
      fetchFollowUpUsersReport();
    }
  };

  const subCat = currentUser?.sub_admin_category;
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin';
  const showFollowUpSection = (subCat === 'follow_up_user' && perf?.followUp) || (isSuperAdmin && !!followUpUserId && perf?.followUp);
  const showVerify = subCat === 'verify_user' || isSuperAdmin;
  const showQA = subCat === 'qa_user' || isSuperAdmin;
  const viewingFollowUpUserName = isSuperAdmin && followUpUserId && followUpUsersReport?.users?.find((u) => u.admin_id === followUpUserId)?.name;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₹${(amount / 1000000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Role-based metrics and disbursal statistics. Data as of fetch time for current counts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* User-wise report: one row per follow-up user (superadmin only) */}
        {isSuperAdmin && followUpUsersReport && followUpUsersReport.users.length > 0 && (
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Follow-up users (user-wise report)</h2>
              <span className="text-sm text-gray-500 ml-2">
                {followUpUsersReport.from_date} to {followUpUsersReport.to_date} · Current counts as of fetch
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Follow-up user</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Total assigned</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Submitted</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Follow up</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">TVR</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Moved to U/R with log</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Moved to U/R no log</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Follow up → U/R</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-700">Moved to QA from TVR</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpUsersReport.users.map((row) => {
                    const q = new URLSearchParams({ follow_up_user: row.admin_id });
                    if (fromDate) q.set('from_date', fromDate);
                    if (toDate) q.set('to_date', toDate);
                    return (
                    <tr key={row.admin_id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">
                        <Link to={`${PERFORMANCE_BASE}?${q.toString()}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                          <div>{row.name}</div>
                          <div className="text-xs text-gray-500">{row.email}</div>
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{row.totalAssigned}</td>
                      <td className="py-2 px-3 text-right">{row.submitted}</td>
                      <td className="py-2 px-3 text-right">{row.follow_up}</td>
                      <td className="py-2 px-3 text-right">{row.tvr}</td>
                      <td className="py-2 px-3 text-right">{row.movedToUnderReviewWithLog}</td>
                      <td className="py-2 px-3 text-right">{row.movedToUnderReviewWithoutLog}</td>
                      <td className="py-2 px-3 text-right">{row.movedFollowUpToUnderReview}</td>
                      <td className="py-2 px-3 text-right">{row.movedTvrToQa}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {showFollowUpSection && (
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Follow-up user{viewingFollowUpUserName ? `: ${viewingFollowUpUserName}` : ''}
              </h2>
              {isSuperAdmin && followUpUserId && (
                <Link
                  to={PERFORMANCE_BASE}
                  className="inline-flex items-center gap-1 ml-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to user-wise report
                </Link>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Submitted</p>
                  <p className="text-2xl font-bold text-gray-900">{perf.followUp.current.submitted}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Follow up</p>
                  <p className="text-2xl font-bold text-gray-900">{perf.followUp.current.follow_up}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">TVR</p>
                  <p className="text-2xl font-bold text-gray-900">{perf.followUp.current.tvr}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Moved to U/R (with log)</p>
                  <p className="text-2xl font-bold text-blue-600">{perf.followUp.inRange.movedSubmittedToUnderReviewWithLog}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Moved to U/R (no log)</p>
                  <p className="text-2xl font-bold text-amber-600">{perf.followUp.inRange.movedSubmittedToUnderReviewWithoutLog}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Follow up → U/R</p>
                  <p className="text-2xl font-bold text-gray-900">{perf.followUp.inRange.movedFollowUpToUnderReview}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Moved to QA from TVR (in range)</p>
                  <p className="text-xl font-bold">{perf.followUp.inRange.movedTvrToQa}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Loan IDs with 0 follow-up updates today</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Submitted</p>
                    <p className="text-sm font-mono text-gray-800 break-all">
                      {perf.followUp.zeroUpdateToday.submitted.length ? perf.followUp.zeroUpdateToday.submitted.join(', ') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Follow up</p>
                    <p className="text-sm font-mono text-gray-800 break-all">
                      {perf.followUp.zeroUpdateToday.follow_up.length ? perf.followUp.zeroUpdateToday.follow_up.join(', ') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">TVR</p>
                    <p className="text-sm font-mono text-gray-800 break-all">
                      {perf.followUp.zeroUpdateToday.tvr.length ? perf.followUp.zeroUpdateToday.tvr.join(', ') : '—'}
                    </p>
                  </div>
                </div>
              </div>
              {perf.followUp.hourly && perf.followUp.hourly.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Hourly updates (follow tab + reference valid)
                  </p>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left py-2 px-2 font-medium">Time</th>
                          <th className="text-right py-2 px-2 font-medium">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perf.followUp.hourly.filter((h) => h.count > 0).map((h) => (
                          <tr key={h.hour} className="border-t border-gray-100">
                            <td className="py-1.5 px-2">{h.label}</td>
                            <td className="py-1.5 px-2 text-right font-medium">{h.count}</td>
                          </tr>
                        ))}
                        {perf.followUp.hourly.every((h) => h.count === 0) && (
                          <tr><td colSpan={2} className="py-4 text-center text-gray-500">No updates in range</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {showVerify && perf?.verify && (
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-cyan-600" />
              <h2 className="text-lg font-semibold text-gray-900">Verify user</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">IDs in submitted (as of fetch)</p>
                <p className="text-2xl font-bold text-gray-900">{perf.verify.current.submitted}</p>
              </div>
              {perf.verify.hourly && perf.verify.hourly.some((h) => h.movedToTvr > 0 || h.movedToFollowUp > 0 || h.cancelled > 0) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left py-2 px-2 font-medium">Time</th>
                        <th className="text-right py-2 px-2 font-medium">Moved to TVR</th>
                        <th className="text-right py-2 px-2 font-medium">Moved to follow up</th>
                        <th className="text-right py-2 px-2 font-medium">Cancelled / re-process</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.verify.hourly.filter((h) => h.movedToTvr > 0 || h.movedToFollowUp > 0 || h.cancelled > 0).map((h) => (
                        <tr key={h.hour} className="border-t border-gray-100">
                          <td className="py-1.5 px-2">{h.label}</td>
                          <td className="py-1.5 px-2 text-right">{h.movedToTvr}</td>
                          <td className="py-1.5 px-2 text-right">{h.movedToFollowUp}</td>
                          <td className="py-1.5 px-2 text-right">{h.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {showQA && perf?.qa && (
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">QA user</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">IDs in QA (as of fetch)</p>
                <p className="text-2xl font-bold text-gray-900">{perf.qa.current.qa}</p>
              </div>
              {perf.qa.hourly && perf.qa.hourly.some((h) => h.movedToDisbursal > 0 || h.movedToFollowUp > 0 || h.cancelled > 0) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left py-2 px-2 font-medium">Time</th>
                        <th className="text-right py-2 px-2 font-medium">Moved to disbursal</th>
                        <th className="text-right py-2 px-2 font-medium">Moved to follow up</th>
                        <th className="text-right py-2 px-2 font-medium">Cancelled / re-process</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.qa.hourly.filter((h) => h.movedToDisbursal > 0 || h.movedToFollowUp > 0 || h.cancelled > 0).map((h) => (
                        <tr key={h.hour} className="border-t border-gray-100">
                          <td className="py-1.5 px-2">{h.label}</td>
                          <td className="py-1.5 px-2 text-right">{h.movedToDisbursal}</td>
                          <td className="py-1.5 px-2 text-right">{h.movedToFollowUp}</td>
                          <td className="py-1.5 px-2 text-right">{h.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Disbursal statistics */}
        <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Disbursal statistics</h2>
            {disbursal && (
              <span className="text-sm text-gray-500 ml-2">
                {disbursal.from_date} to {disbursal.to_date}
              </span>
            )}
          </div>
          <div className="p-6 overflow-x-auto">
            {disbursal?.synergi && disbursal.synergi.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Account manager (Synergi)</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">No. of IDs moved to AM</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">Total principal amount</th>
                  </tr>
                </thead>
                <tbody>
                  {disbursal.synergi.map((row, idx) => (
                    <tr key={row.account_manager_id || idx} className="border-t border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.account_manager_name}</td>
                      <td className="py-2 px-3 text-right">{row.ids_moved}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(row.total_principal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-center py-8">No disbursal data for the selected date range.</p>
            )}
          </div>
        </section>

        {!showFollowUp && !showVerify && !showQA && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            No performance sections available for your role. Disbursal statistics are shown above.
          </div>
        )}
      </div>
    </div>
  );
}
