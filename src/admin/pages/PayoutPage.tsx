import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/adminApi';
import {
  DollarSign,
  User,
  Building2,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowRight
} from 'lucide-react';

interface ReadyForDisbursementLoan {
  id: string;
  applicationNumber: string;
  loanAmount: number;
  loanPurpose: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
  };
  bank: {
    id: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    accountHolderName: string;
    isPrimary: boolean;
  } | null;
}

export function PayoutPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<ReadyForDisbursementLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchReadyForDisbursementLoans();
  }, []);

  const fetchReadyForDisbursementLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApiService.getReadyForDisbursementLoans();
      
      if (response.success && response.data) {
        setLoans(response.data);
      } else {
        setError(response.message || 'Failed to fetch loans');
      }
    } catch (err: any) {
      console.error('Error fetching loans:', err);
      setError(err.message || 'Failed to fetch loans ready for disbursement');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async (loanId: string) => {
    if (!confirm('Are you sure you want to disburse this loan? This action cannot be undone.')) {
      return;
    }

    try {
      setDisbursingId(loanId);
      setError(null);
      setSuccessMessage(null);

      const response = await adminApiService.disburseLoan(loanId);

      if (response.success) {
        setSuccessMessage(`Loan ${response.data?.transferId || loanId} disbursed successfully!`);
        
        // Remove the loan from the list after successful disbursement
        setLoans(prevLoans => prevLoans.filter(loan => loan.id !== loanId));
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);
      } else {
        setError(response.message || 'Failed to disburse loan');
      }
    } catch (err: any) {
      console.error('Error disbursing loan:', err);
      setError(err.response?.data?.message || err.message || 'Failed to disburse loan');
    } finally {
      setDisbursingId(null);
    }
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (!accountNumber) return 'N/A';
    if (accountNumber.length <= 4) return accountNumber;
    return `****${accountNumber.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading loans ready for disbursement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-blue-600" />
              Loan Payout Management
            </h1>
            <p className="text-gray-600 mt-1">
              Disburse loans that are ready for payout via Cashfree
            </p>
          </div>
          <button
            onClick={fetchReadyForDisbursementLoans}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Card */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total Ready</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{loans.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(loans.reduce((sum, loan) => sum + loan.loanAmount, 0))}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">With Bank Details</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {loans.filter(loan => loan.bank !== null).length}
          </div>
        </div>
      </div>

      {/* Loans List */}
      {loans.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Loans Ready for Disbursement</h3>
          <p className="text-gray-600">All loans have been disbursed or are not yet ready.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Loan Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {loan.applicationNumber || `Loan #${loan.id}`}
                        </h3>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded">
                          Ready for Disbursement
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{loan.loanPurpose}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(loan.loanAmount)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(loan.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* User Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {loan.user.fullName}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {loan.user.email}
                        </div>
                        <div className="text-xs text-gray-600">
                          {loan.user.phone}
                        </div>
                        <button
                          onClick={() => navigate(`/admin/user-profile/${loan.user.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View Profile
                        </button>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${loan.bank ? 'bg-green-50' : 'bg-red-50'}`}>
                        <Building2 className={`w-5 h-5 ${loan.bank ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="flex-1">
                        {loan.bank ? (
                          <>
                            <div className="text-sm font-medium text-gray-900">
                              {loan.bank.bankName || 'Bank Account'}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Account: {maskAccountNumber(loan.bank.accountNumber)}
                            </div>
                            <div className="text-xs text-gray-600">
                              IFSC: {loan.bank.ifscCode}
                            </div>
                            <div className="text-xs text-gray-600">
                              {loan.bank.accountHolderName}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-red-900">
                              No Bank Details
                            </div>
                            <div className="text-xs text-red-600 mt-1">
                              User must add bank details before disbursement
                            </div>
                            <button
                              onClick={() => navigate(`/admin/user-profile/${loan.user.id}`)}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                            >
                              Add Bank Details
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="ml-6 flex flex-col gap-2">
                  {loan.bank ? (
                    <button
                      onClick={() => handleDisburse(loan.id)}
                      disabled={disbursingId === loan.id}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 min-w-[140px] ${
                        disbursingId === loan.id
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {disbursingId === loan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Disburse
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="px-6 py-3 rounded-lg bg-gray-100 text-gray-600 text-sm text-center min-w-[140px]">
                      Cannot Disburse
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/admin/user-profile/${loan.user.id}?loanId=${loan.id}`)}
                    className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

