import { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '../../services/adminApi';
import { Search, Eye, User, Phone, Mail, FileText, CheckSquare, Loader2 } from 'lucide-react';
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
  payslip_url: string | null;
  company_id_url: string | null;
  updated_at: string;
}

export function DocsVerifyPage() {
  const [records, setRecords] = useState<DocsVerifyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [approving, setApproving] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminApiService.getDocsVerifyList(currentPage, pageSize, searchTerm);

      if (response.status === 'success' && response.data) {
        setRecords(response.data.records || []);
        setTotalRecords(response.data.total || 0);
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

  const formatDate = (dateString: string) => {
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

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, email, loan ID..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No profiles pending document verification</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && selectedRecordIds.length === records.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documents</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.record_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.record_id)}
                        onChange={() => toggleSelect(record.record_id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">PLL{record.loan_application_id}</span>
                      {record.application_number && (
                        <div className="text-xs text-gray-500">{record.application_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {record.first_name} {record.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {record.phone}
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                        <Mail className="w-3 h-3" />
                        {record.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.updated_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        {record.payslip_url && (
                          <a
                            href={record.payslip_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-3 h-3" />
                            Payslip
                          </a>
                        )}
                        {record.company_id_url && (
                          <a
                            href={record.company_id_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-3 h-3" />
                            Company ID
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => window.open(`/stpl/user-profile/${record.user_id}`, '_blank')}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
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
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default DocsVerifyPage;
