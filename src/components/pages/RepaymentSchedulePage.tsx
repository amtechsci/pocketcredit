import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
// @ts-ignore - Cashfree SDK doesn't have TypeScript definitions
import { load } from '@cashfreepayments/cashfree-js';

export const RepaymentSchedulePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loanData, setLoanData] = useState<any>(null);
  const [kfsData, setKfsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const appId = searchParams.get('applicationId');
    if (appId) {
      fetchLoanData(parseInt(appId));
    } else {
      // Try to find loan with account_manager status
      fetchUserLoan();
    }
  }, [isAuthenticated, searchParams, navigate]);

  const fetchUserLoan = async () => {
    try {
      const response = await apiService.getPendingLoanApplications();
      if (response.success && response.data?.applications) {
        const accountManagerLoan = response.data.applications.find(
          (app: any) => app.status === 'account_manager'
        );
        if (accountManagerLoan) {
          fetchLoanData(accountManagerLoan.id);
        } else {
          // Check if there's a ready_for_disbursement loan
          const readyLoan = response.data.applications.find(
            (app: any) => app.status === 'ready_for_disbursement'
          );
          if (readyLoan) {
            setError('Your loan is ready for disbursement. Please wait for the transaction to be processed.');
          } else {
            setError('No active loan found with account manager status');
          }
          setLoading(false);
        }
      } else {
        setError('No active loan found');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching user loan:', err);
      setError(err.message || 'Failed to load loan data');
      setLoading(false);
    }
  };

  const fetchLoanData = async (loanId: number) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch KFS data which contains all loan calculation details
      // Use useActualDays=true for repayment schedule to calculate interest based on actual exhausted days
      const kfsResponse = await apiService.getKFS(loanId, true);
      if (kfsResponse && (kfsResponse.success || kfsResponse.status === 'success') && kfsResponse.data) {
        setKfsData(kfsResponse.data);
        setLoanData(kfsResponse.data.loan);
      } else {
        setError('Failed to load loan data. Please try again later.');
      }
    } catch (err: any) {
      console.error('Error fetching loan data:', err);
      setError(err.message || 'Failed to load loan data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Repayment Schedule Not Available</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4 text-left max-w-md mx-auto">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  What's happening?
                </p>
                <p className="text-sm text-gray-600">
                  Your loan application has been processed and is ready for disbursement.
                  Once the admin processes the transaction, you will be able to view your repayment schedule here.
                </p>
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!loanData || !kfsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">No loan data available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const calculations = kfsData.calculations || {};

  // Calculate derived values
  const disbursedDate = loanData.disbursed_at ? new Date(loanData.disbursed_at) : new Date();
  const currentDate = new Date(); // Use current date

  // Exhausted Days Calculation - match backend calculation exactly
  // Set both dates to midnight for accurate day calculation
  const disbursedDateMidnight = new Date(disbursedDate);
  disbursedDateMidnight.setHours(0, 0, 0, 0);
  const currentDateMidnight = new Date(currentDate);
  currentDateMidnight.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(currentDateMidnight.getTime() - disbursedDateMidnight.getTime());
  let exhaustedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // Ensure at least 1 day if loan was disbursed today
  if (exhaustedDays === 0) {
    exhaustedDays = 1;
  }

  // Determine Due Date
  // Logic: Disbursement Date + Loan Term
  const termDays = loanData.loan_term_days || 30; // Default or fetch from backend
  const dueDate = new Date(disbursedDateMidnight); // Use midnight-normalized date
  dueDate.setDate(dueDate.getDate() + termDays);
  // Ensure due date is also at midnight for accurate comparison
  dueDate.setHours(0, 0, 0, 0);

  // Check default status - compare dates normalized to midnight
  // Loan is defaulted only if current date (at midnight) is AFTER due date (at midnight)
  const isDefaulted = currentDateMidnight > dueDate;
  const daysDelayed = isDefaulted ? Math.ceil((currentDateMidnight.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Tenure extension logic: D-5 to D+15
  // TODO: Uncomment when tenure extension feature is ready
  // Normalize due date to midnight for accurate day-based comparison
  // (currentDateMidnight already calculated above for exhausted days)
  // const dueDateMidnight = new Date(dueDate);
  // dueDateMidnight.setHours(0, 0, 0, 0);
  // const dMinus5 = new Date(dueDateMidnight);
  // dMinus5.setDate(dMinus5.getDate() - 5);
  // const dPlus15 = new Date(dueDateMidnight);
  // dPlus15.setDate(dPlus15.getDate() + 15);
  // const canExtend = currentDateMidnight >= dMinus5 && currentDateMidnight <= dPlus15;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-12">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Main Repayment Card */}
        <Card className="bg-white shadow-xl rounded-xl overflow-hidden mb-6 border-2 border-blue-100">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Loan ID: {loanData.loan_id || loanData.application_number || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm mb-1">Exhausted days</p>
                <p className="text-2xl font-bold">{exhaustedDays} days</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Total Outstanding - Prominent Display */}
            <div className="text-center py-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-2 font-medium">Total Outstanding till today</p>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                {formatCurrency(calculations.total_repayable || 0)}
              </h1>
              <p className="text-xs text-gray-500">
                Due date: {formatDate(dueDate.toISOString())}
              </p>
            </div>

            {/* Default Status */}
            {isDefaulted && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-pulse">
                <p className="text-red-600 font-bold text-lg uppercase tracking-wide">
                  ⚠ DEFAULTED ({daysDelayed} days delayed)
                </p>
                <p className="text-sm text-red-500 mt-1">Immediate action required</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <Button
                className="w-full h-14 text-lg font-bold shadow-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all transform hover:scale-[1.02]"
                onClick={async () => {
                  try {
                    toast.loading('Creating payment order...');

                    // Get loan ID - try multiple sources
                    const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                    const amount = calculations.total_repayable;

                    console.log('💳 Payment Data:', { loanId, amount });

                    if (!loanId || !amount) {
                      toast.error('Unable to process payment');
                      return;
                    }

                    // Create payment order
                    const response = await apiService.createPaymentOrder(loanId, amount);

                    if (response.success && response.data?.paymentSessionId) {
                      console.log('💳 Payment order created:', {
                        orderId: response.data.orderId,
                        paymentSessionId: response.data.paymentSessionId
                      });
                      
                      toast.success('Opening payment gateway...');

                      try {
                        // Determine environment based on the checkout URL or use sandbox by default
                        // Check if we're using production or sandbox
                        const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                           !response.data.checkoutUrl?.includes('payments-test');
                        
                        // Load Cashfree SDK
                        const cashfree = await load({ 
                          mode: isProduction ? "production" : "sandbox"
                        });

                        if (cashfree) {
                          console.log('✅ Cashfree SDK loaded, opening checkout...');
                          
                          // Open Cashfree checkout using the SDK (recommended method)
                          cashfree.checkout({
                            paymentSessionId: response.data.paymentSessionId
                          });
                        } else {
                          throw new Error('Failed to load Cashfree SDK');
                        }
                      } catch (sdkError: any) {
                        console.error('Cashfree SDK error:', sdkError);
                        toast.error('Failed to open payment gateway. Please try again.');
                        
                        // Fallback: Try direct URL redirect as backup
                        if (response.data.checkoutUrl) {
                          console.log('🔄 Falling back to direct URL redirect');
                          window.location.href = response.data.checkoutUrl;
                        } else {
                          throw new Error('No payment session available');
                        }
                      }
                    } else {
                      toast.error(response.message || 'Failed to create payment order');
                    }
                  } catch (error: any) {
                    console.error('Payment error:', error);
                    toast.error(error.message || 'Failed to initiate payment');
                  }
                }}
              >
                Repay Now
              </Button>

              {/* Extend button - hidden until feature is ready */}
              {/* TODO: Uncomment when tenure extension feature is ready
              {canExtend && (
                <Button
                  variant="outline"
                  className="w-full h-12 border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    toast.info('Tenure extension feature coming soon');
                  }}
                >
                  Extend your loan tenure
                </Button>
              )}
              */}
            </div>
          </CardContent>
        </Card>

        {/* Loan Information Card */}
        <Card className="bg-white shadow-lg rounded-xl mb-6">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Loan Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Loan Term</p>
                <p className="font-semibold text-gray-900">
                  {loanData.loan_term_days || 0} days
                  {loanData.loan_term_months && ` (${loanData.loan_term_months} months)`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Disbursed Date</p>
                <p className="font-semibold text-gray-900">
                  {formatDate(loanData.disbursed_at || loanData.created_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Due Date</p>
                <p className="font-semibold text-gray-900">
                  {formatDate(dueDate.toISOString())}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Days Remaining</p>
                <p className="font-semibold text-gray-900">
                  {Math.max(0, Math.ceil((dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)))} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Important Bullet Points */}
        <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-xl">
          <CardContent className="p-5">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Important Information
            </h3>
            <ul className="space-y-3">
              {[
                "Timely repayment helps improve CIBIL / Experian / CRIF / Equifax scores",
                "Get higher loan limits & faster approvals on your next loan",
                "Build your Pocket Credit Score & Trust Quotient",
                "Avoid penalty, late fee & recovery actions",
                "Prevent E-NACH bounce charges & bank penalties",
                "Stay stress-free — no calls, no follow-ups"
              ].map((point, index) => (
                <li key={index} className="flex gap-3 text-sm text-blue-800 items-start">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
