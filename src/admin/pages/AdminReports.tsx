import { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';

interface ReportStats {
  total_loans: number;
  active_loans: number;
  cleared_loans: number;
  settled_loans: number;
  default_loans: number;
  active_amount: number;
  cleared_amount: number;
}

type AmExportRow = {
  first_name?: string;
  last_name?: string;
  principal_amount?: number;
  processed_amount?: number | null;
  exhausted_days?: number;
  loan_application_id: number;
  emi_breakdown?: { emi_number?: number; due_date?: string | null; amount?: number; status?: string }[];
};

export function AdminReports() {
  const { isNbfcAdmin } = useAdmin();
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get API base URL
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3002';
      }
      return '';
    }
    return '';
  };

  // Fetch report statistics on mount (main admins only)
  useEffect(() => {
    if (!isNbfcAdmin) fetchStats();
  }, [isNbfcAdmin]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${getApiBaseUrl()}/api/admin/reports/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch report stats:', err);
    }
  };

  const handleDownloadReport = async (reportType: 'disbursal' | 'cleared' | 'settled' | 'default' | 'bs_repayment' | 'bs_disbursal') => {
    setDownloadingReport(reportType);
    setError(null);

    try {
      const token = localStorage.getItem('adminToken');
      let url = '';
      
      // Determine the correct endpoint based on report type
      if (reportType === 'bs_repayment' || reportType === 'bs_disbursal') {
        url = `${getApiBaseUrl()}/api/admin/reports/bs/${reportType.replace('bs_', '')}`;
      } else {
        url = `${getApiBaseUrl()}/api/admin/reports/cibil/${reportType}`;
      }

      // Add date parameters if provided
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download report');
      }

      // Get the CSV content
      const csvContent = await response.text();

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().split('T')[0];
      link.href = blobUrl;
      link.download = reportType.startsWith('bs_') 
        ? `${reportType}_${dateStr}.csv` 
        : `cibil_${reportType}_${dateStr}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download report');
    } finally {
      setDownloadingReport(null);
    }
  };

  const csvEscape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const formatCsvNumber = (value: number | string | null | undefined, decimals = 2) => {
    if (value == null || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toFixed(decimals);
  };

  const dpdFromDueDate = (dueDate: string | null | undefined) => {
    if (!dueDate) return '';
    const today = new Date();
    const due = new Date(dueDate);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  /** Account Manager CSV without phone / email columns (NBFC export). */
  const handleDownloadAccountManagerNbfc = async () => {
    setDownloadingReport('account_manager');
    setError(null);
    try {
      const fromQ = fromDate && toDate ? fromDate : undefined;
      const toQ = fromDate && toDate ? toDate : undefined;
      const response = await adminApiService.getAccountManagerUsers(1, 5000, '', fromQ, toQ);
      if (response.status !== 'success' || !response.data?.users) {
        throw new Error(response.message || 'Failed to download Account Manager report');
      }
      const rows = (response.data.users || []) as AmExportRow[];
      const headers = [
        'Name',
        'principal loan',
        'processed amount',
        'exhausted days',
        'EMI number',
        'EMI amount',
        'EMI DPD',
        'loan id'
      ];
      const csvRows: string[] = [];
      for (const row of rows) {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || '—';
        const basePrefix = [
          csvEscape(name),
          csvEscape(formatCsvNumber(row.principal_amount, 0)),
          csvEscape(formatCsvNumber(row.processed_amount ?? row.principal_amount, 2)),
          csvEscape(formatCsvNumber(row.exhausted_days, 0))
        ];
        const breakdown = Array.isArray(row.emi_breakdown) ? [...row.emi_breakdown] : [];
        breakdown.sort((a, b) => (a.emi_number ?? 0) - (b.emi_number ?? 0));
        const unpaidEmis = breakdown.filter((emi) => {
          const st = String(emi?.status ?? '').toLowerCase();
          return st !== 'paid';
        });
        const emiList = unpaidEmis.length > 0 ? unpaidEmis : [null];

        for (let i = 0; i < emiList.length; i++) {
          const emi = emiList[i];
          const emiNumber =
            emi?.emi_number != null ? emi.emi_number : emi ? i + 1 : '';
          const emiAmount =
            emi?.amount != null ? formatCsvNumber(emi.amount, 2) : '';
          const emiDpd = emi ? dpdFromDueDate(emi.due_date) : '';

          csvRows.push(
            [
              ...basePrefix,
              csvEscape(emiNumber === '' ? '' : emiNumber),
              csvEscape(emiAmount),
              csvEscape(emiDpd === '' ? '' : emiDpd),
              csvEscape(`PLL${row.loan_application_id}`)
            ].join(',')
          );
        }
      }

      const csv = [headers.map(csvEscape).join(','), ...csvRows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = `account_manager_${new Date().toISOString().split('T')[0]}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Account Manager download error:', err);
      setError(err.message || 'Failed to download report');
    } finally {
      setDownloadingReport(null);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)} K`;
    }
    return `₹${amount}`;
  };

  const reportTypes = [
    {
      id: 'disbursal',
      title: 'Disbursal Report',
      description: 'Active loans (disbursed, currently running)',
      icon: TrendingUp,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      count: stats?.active_loans || 0
    },
    {
      id: 'cleared',
      title: 'Cleared Report',
      description: 'Fully repaid loans closed successfully',
      icon: CheckCircle,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      count: stats?.cleared_loans || 0
    },
    {
      id: 'settled',
      title: 'Settled Report',
      description: 'Loans closed via settlement agreement',
      icon: FileText,
      color: 'purple',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      iconColor: 'text-purple-600',
      buttonColor: 'bg-purple-600 hover:bg-purple-700',
      count: stats?.settled_loans || 0
    },
    {
      id: 'default',
      title: 'Default Report',
      description: 'Overdue/defaulted loans for reporting',
      icon: XCircle,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      buttonColor: 'bg-red-600 hover:bg-red-700',
      count: stats?.default_loans || 0
    },
    {
      id: 'bs_disbursal',
      title: 'BS Disbursal Report',
      description: 'Loan disbursal data from transaction details',
      icon: FileSpreadsheet,
      color: 'orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      buttonColor: 'bg-orange-600 hover:bg-orange-700',
      count: 0
    },
    {
      id: 'bs_repayment',
      title: 'BS Repayment Report',
      description: 'Loan repayment data from transaction details',
      icon: FileSpreadsheet,
      color: 'indigo',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      iconColor: 'text-indigo-600',
      buttonColor: 'bg-indigo-600 hover:bg-indigo-700',
      count: 0
    }
  ];

  if (isNbfcAdmin) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
        <div className="bg-white border-b border-gray-200 px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">
              Choose a date range (optional), then download BS or Account Manager CSV exports
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-2xl">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-red-700">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">From date &amp; to date</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Optional for BS reports and Account Manager export (filters by payment / disbursal date where applicable).
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-600 mb-1">From date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">To date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Download</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleDownloadReport('bs_disbursal')}
                disabled={downloadingReport === 'bs_disbursal'}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg bg-orange-600 hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingReport === 'bs_disbursal' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                BS disbursal
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReport('bs_repayment')}
                disabled={downloadingReport === 'bs_repayment'}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingReport === 'bs_repayment' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                BS repayment
              </button>
              <button
                type="button"
                onClick={handleDownloadAccountManagerNbfc}
                disabled={downloadingReport === 'account_manager'}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingReport === 'account_manager' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Account manager
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Account manager CSV excludes mobile numbers and email columns.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">
              Download CIBIL-compliant and BS (Business Statement) CSV reports
            </p>
          </div>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_loans}</p>
                  <p className="text-sm text-gray-500">Total Loans</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.active_amount || 0)}</p>
                  <p className="text-sm text-gray-500">Active Portfolio</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.cleared_amount || 0)}</p>
                  <p className="text-sm text-gray-500">Cleared Amount</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.default_loans}</p>
                  <p className="text-sm text-gray-500">Default Cases</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Date Range Filter</h3>
            <span className="text-sm text-gray-500">(Optional - filters by disbursal/closure date)</span>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            const isDownloading = downloadingReport === report.id;

            return (
              <div
                key={report.id}
                className={`${report.bgColor} border ${report.borderColor} rounded-lg p-6 transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm`}>
                      <Icon className={`w-6 h-6 ${report.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full bg-white shadow-sm`}>
                    <span className={`text-lg font-bold ${report.iconColor}`}>{report.count}</span>
                    <span className="text-xs text-gray-500 ml-1">records</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>CIBIL Format CSV</span>
                  </div>
                  <button
                    onClick={() => handleDownloadReport(report.id as any)}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${report.buttonColor} transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download CSV
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* CIBIL Format Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">📋 CIBIL Report Format Information</h4>
          <p className="text-sm text-yellow-700 mb-3">
            All reports are generated in CIBIL-compliant CSV format with the following fields:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-yellow-700">
            <div>
              <strong>Consumer Info:</strong>
              <ul className="list-disc list-inside mt-1">
                <li>Consumer Name</li>
                <li>Date of Birth (DDMMYYYY)</li>
                <li>Gender Code</li>
                <li>PAN (Income Tax ID)</li>
              </ul>
            </div>
            <div>
              <strong>Contact & Address:</strong>
              <ul className="list-disc list-inside mt-1">
                <li>Mobile Number</li>
                <li>Email ID</li>
                <li>Address with State Code</li>
                <li>PIN Code</li>
              </ul>
            </div>
            <div>
              <strong>Account Details:</strong>
              <ul className="list-disc list-inside mt-1">
                <li>Account Number</li>
                <li>Account Type (69 = Personal Loan)</li>
                <li>Disbursement Date</li>
                <li>Current Balance & Asset Classification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}