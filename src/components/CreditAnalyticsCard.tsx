import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download,
  FileText,
  Loader2,
  XCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'sonner';

interface CreditAnalyticsCardProps {
  userKycCompleted: boolean;
}

export function CreditAnalyticsCard({ userKycCompleted }: CreditAnalyticsCardProps) {
  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [performingCheck, setPerformingCheck] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);

  // Fetch credit analytics data
  const fetchCreditData = async () => {
    if (!userKycCompleted) return;
    
    try {
      setLoading(true);
      const response = await apiService.getCreditAnalyticsData();
      if (response.status === 'success' && response.data) {
        setCreditData(response.data);
      } else {
        setCreditData(null);
      }
    } catch (error: any) {
      console.error('Error fetching credit analytics:', error);
      setCreditData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount if KYC is completed
  useEffect(() => {
    if (userKycCompleted) {
      fetchCreditData();
    }
  }, [userKycCompleted]);

  // Perform credit check
  const handlePerformCreditCheck = async () => {
    if (!confirm('Are you sure you want to perform a credit check? This will fetch your credit report from Experian.')) {
      return;
    }

    try {
      setPerformingCheck(true);
      const response = await apiService.performCreditCheck();
      
      if (response.status === 'success') {
        const responseData = response.data as any;
        if (responseData?.already_checked) {
          toast.info('Credit check already performed. Refreshing data...');
        } else {
          toast.success(responseData?.is_eligible ? 'Credit check passed!' : 'Credit check completed');
        }
        // Refresh credit data
        await fetchCreditData();
      } else {
        toast.error(response.message || 'Failed to perform credit check');
      }
    } catch (error: any) {
      console.error('Error performing credit check:', error);
      toast.error(error.message || 'Failed to perform credit check');
    } finally {
      setPerformingCheck(false);
    }
  };

  // Don't show if KYC not completed
  if (!userKycCompleted) {
    return null;
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </Card>
    );
  }

  if (!creditData) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Credit Analytics</h3>
          <p className="text-gray-600 mb-4 text-sm">Get your Experian credit report and score</p>
          <Button
            onClick={handlePerformCreditCheck}
            disabled={performingCheck}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {performingCheck ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Get Credit Report
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  const { credit_score, is_eligible, rejection_reasons, full_report, pdf_url, checked_at, result_code, api_message } = creditData;

  // Check if result_code is 102 (mobile number mismatch)
  const actualResultCode = result_code || full_report?.result_code;
  const actualMessage = api_message || full_report?.message;

  // If result_code is 102, show mobile number mismatch error
  if (actualResultCode === 102 && actualMessage) {
    return (
      <Card className="p-6 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">Mobile Number Mismatch</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-red-900 mb-2">Mobile number did not match</p>
          <p className="text-xs text-gray-800">{actualMessage}</p>
        </div>
        {checked_at && (
          <p className="text-xs text-gray-500">Report Date: {new Date(checked_at).toLocaleDateString('en-GB')}</p>
        )}
      </Card>
    );
  }

  // Parse the full report to extract detailed information
  const reportData = full_report?.result?.result_json?.INProfileResponse || {};

  // Extract PDF URL
  let experianPdfUrl = pdf_url || null;
  if (!experianPdfUrl && full_report) {
    experianPdfUrl =
      full_report?.result?.result_pdf ||
      full_report?.result?.model?.pdf_url ||
      full_report?.result?.data?.pdf_url ||
      full_report?.result?.pdf_url ||
      null;
  }

  // Get credit score from report if not in database
  let displayScore = credit_score;
  if (!displayScore || displayScore === 'N/A' || displayScore === null) {
    displayScore = reportData.SCORE?.BureauScore || reportData?.BureauScore || 'N/A';
  }

  const accountSummary = reportData.CAIS_Account?.CAIS_Account_DETAILS || [];
  const enquirySummary = reportData.CAPS?.CAPS_Summary || {};

  // Debug: Log first account to see actual field names
  if (accountSummary.length > 0 && process.env.NODE_ENV === 'development') {
    console.log('🔍 First account structure:', {
      keys: Object.keys(accountSummary[0]),
      sampleAccount: accountSummary[0],
      overdueFields: {
        Amount_Overdue: accountSummary[0].Amount_Overdue,
        Overdue_Amount: accountSummary[0].Overdue_Amount,
        AmountOverdue: accountSummary[0].AmountOverdue,
        OverdueAmount: accountSummary[0].OverdueAmount,
        Current_Balance: accountSummary[0].Current_Balance,
        Subscriber_Name: accountSummary[0].Subscriber_Name
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Credit Analytics</h3>
        </div>
        {is_eligible ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Eligible
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Not Eligible
          </Badge>
        )}
      </div>

      {/* Credit Score */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Experian Credit Score</p>
            <p className="text-3xl font-bold text-gray-900">{displayScore}</p>
            {checked_at && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {new Date(checked_at).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
          {experianPdfUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(experianPdfUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              PDF Report
            </Button>
          )}
        </div>
      </div>

      {/* Rejection Reasons */}
      {!is_eligible && rejection_reasons && Array.isArray(rejection_reasons) && rejection_reasons.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-900">Rejection Reasons</p>
          </div>
          <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
            {rejection_reasons.map((reason: string, index: number) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Account Summary - Detailed Table */}
      {accountSummary.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Credit Account Details</p>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">#</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">Lender</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">Account Type</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">Account Status</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border border-gray-300">Sanction Amt</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border border-gray-300">Current Balance</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border border-gray-300">Amount Overdue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accountSummary.slice(0, 20).map((account: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 px-2 py-2 text-left">
                        {account.Subscriber_Name || account.Lender_Name || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-left">
                        {account.Account_Type || account.Type_of_Credit_Facility || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-left">
                        {account.Account_Status || account.Status || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        {account.Highest_Credit_or_Original_Loan_Amount ?
                          `₹${parseInt(account.Highest_Credit_or_Original_Loan_Amount).toLocaleString('en-IN')}` :
                          '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        {account.Current_Balance ?
                          `₹${parseInt(account.Current_Balance).toLocaleString('en-IN')}` :
                          '₹0'}
                      </td>
                      <td className={`border border-gray-300 px-2 py-2 text-right font-semibold ${
                        (() => {
                          // Check multiple possible field names for overdue amount
                          const overdueAmount = account.Amount_Overdue || 
                                                account.Overdue_Amount || 
                                                account.AmountOverdue || 
                                                account.OverdueAmount ||
                                                account.Amount_Overdue_Total ||
                                                account.Total_Overdue ||
                                                account.Overdue ||
                                                account.Overdue_Amt ||
                                                0;
                          const overdueValue = overdueAmount ? parseInt(overdueAmount) : 0;
                          return overdueValue > 0 ? 'text-red-600' : 'text-gray-600';
                        })()
                      }`}>
                        {(() => {
                          // Check multiple possible field names for overdue amount
                          const overdueAmount = account.Amount_Overdue || 
                                                account.Overdue_Amount || 
                                                account.AmountOverdue || 
                                                account.OverdueAmount ||
                                                account.Amount_Overdue_Total ||
                                                account.Total_Overdue ||
                                                account.Overdue ||
                                                account.Overdue_Amt ||
                                                null;
                          return overdueAmount && parseInt(overdueAmount) > 0
                            ? `₹${parseInt(overdueAmount).toLocaleString('en-IN')}`
                            : '₹0';
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accountSummary.length > 20 && (
              <p className="text-xs text-gray-500 mt-2 p-2 text-center bg-gray-50">
                Showing 20 of {accountSummary.length} accounts
              </p>
            )}
          </div>
        </div>
      )}

      {/* Enquiry Summary */}
      {enquirySummary && Object.keys(enquirySummary).length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Enquiry Summary</p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              Recent enquiries available in full report
            </p>
          </div>
        </div>
      )}

      {/* View Full Report Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowFullReport(!showFullReport)}
      >
        <FileText className="w-4 h-4 mr-2" />
        {showFullReport ? 'Hide' : 'View'} Full Report
      </Button>

      {/* Full Report JSON */}
      {showFullReport && full_report && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(full_report, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
