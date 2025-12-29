import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  TrendingUp,
  Sparkles
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

  const [completedLoansCount, setCompletedLoansCount] = useState(0);

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

      // Fetch user's completed loans count to determine current stage
      try {
        const loansResponse = await apiService.getPendingLoanApplications();
        if (loansResponse.success && loansResponse.data?.applications) {
          // Count loans that are cleared (completed)
          const clearedLoans = loansResponse.data.applications.filter(
            (app: any) => app.status === 'cleared'
          );
          setCompletedLoansCount(clearedLoans.length);
        }
      } catch (err) {
        console.error('Error fetching completed loans count:', err);
        // Continue with default 0 if error
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
  const planData = kfsData.plan || {};
  
  // Debug: Log to check data structure
  console.log('KFS Data:', {
    planData,
    loanData: loanData,
    repayment: kfsData.repayment,
    planType: planData.plan_type,
    loanPlanType: loanData.plan_type,
    hasRepaymentSchedule: !!kfsData.repayment?.schedule,
    scheduleLength: kfsData.repayment?.schedule?.length
  });
  
  // Check multiple possible locations for plan_type
  const planType = planData.plan_type || 
                   loanData.plan_type || 
                   loanData.plan_snapshot?.plan_type ||
                   (kfsData.repayment?.schedule && kfsData.repayment.schedule.length > 1 ? 'multi_emi' : null) ||
                   'single';
  const isMultiEmi = planType === 'multi_emi';
  const repaymentSchedule = kfsData.repayment?.schedule || [];
  
  // Also check if we have multiple EMIs in schedule (fallback detection)
  const hasMultipleEmis = repaymentSchedule.length > 1;
  const shouldShowMultiEmi = isMultiEmi || hasMultipleEmis;

  // Calculate derived values
  const currentDate = new Date(); // Use current date
  const currentDateMidnight = new Date(currentDate);
  currentDateMidnight.setHours(0, 0, 0, 0);
  
  // Use processed_at ONLY for exhausted days calculation
  // IMPORTANT: Extract date portion only (YYYY-MM-DD) to avoid timezone issues
  // Per rulebook: Server is in IST, calculate from date only, ignore time
  let processedDateMidnight = null;
  if (loanData.processed_at) {
    // Extract date portion from ISO string (e.g., "2025-12-25T23:19:50.000Z" -> "2025-12-25")
    const processedDateStr = loanData.processed_at.split('T')[0]; // Get YYYY-MM-DD part
    processedDateMidnight = new Date(processedDateStr + 'T00:00:00'); // Create date at midnight local time
    processedDateMidnight.setHours(0, 0, 0, 0); // Ensure it's exactly midnight
  }
  
  if (!loanData.processed_at) {
    console.warn('⚠️ processed_at is not available for loan, cannot calculate exhausted days accurately');
  }

  // Exhausted Days Calculation - based on processed_at only
  // Per rulebook: Use inclusive counting - Math.ceil((end - start) / msPerDay) + 1
  let exhaustedDays = 1; // Default to 1 if processed_at is not available
  
  if (processedDateMidnight) {
    // Calculate difference in days using inclusive counting
    // Formula: Math.ceil((end - start) / msPerDay) + 1
    const diffTime = currentDateMidnight.getTime() - processedDateMidnight.getTime();
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Exhausted days should be at least 1 if loan was processed today or in the past
    exhaustedDays = Math.max(1, daysDiff);
  }
  
  // Debug logging
  console.log('Exhausted Days Calculation (using processed_at only):', {
    processed_at: loanData.processed_at,
    processedDateStr: processedDateMidnight ? loanData.processed_at.split('T')[0] : 'N/A',
    processedDateMidnight: processedDateMidnight ? processedDateMidnight.toISOString().split('T')[0] : 'N/A',
    currentDate: currentDate.toISOString().split('T')[0],
    currentDateMidnight: currentDateMidnight.toISOString().split('T')[0],
    diffTime: processedDateMidnight ? (currentDateMidnight.getTime() - processedDateMidnight.getTime()) : 'N/A',
    diffDays: processedDateMidnight ? ((currentDateMidnight.getTime() - processedDateMidnight.getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
    calculatedDays: exhaustedDays,
    note: processedDateMidnight ? 'Calculated from processed_at (date only, ignoring time/timezone)' : 'Using default (1 day) - processed_at not available'
  });
  
  // For due date calculation, still use disbursed_at or processed_at
  const disbursedDate = processedDateMidnight || (loanData.disbursed_at ? new Date(loanData.disbursed_at.split('T')[0] + 'T00:00:00') : new Date());
  const disbursedDateMidnight = new Date(disbursedDate);
  disbursedDateMidnight.setHours(0, 0, 0, 0);

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
  const dueDateMidnight = new Date(dueDate);
  dueDateMidnight.setHours(0, 0, 0, 0);
  const dMinus5 = new Date(dueDateMidnight);
  dMinus5.setDate(dMinus5.getDate() - 5);
  const dPlus15 = new Date(dueDateMidnight);
  dPlus15.setDate(dPlus15.getDate() + 15);
  const canExtend = currentDateMidnight >= dMinus5 && currentDateMidnight <= dPlus15;

  // Calculate loan progression stages based on completed loans count
  // Get user's current loan limit
  const currentLimit = (user as any)?.loan_limit || loanData.sanctioned_amount || loanData.loan_amount || 0;
  
  // Determine current loan number (completed + 1 for current loan)
  const currentLoanNumber = completedLoansCount + 1; // 1st loan, 2nd loan, 3rd loan, etc.
  
  // Create stages starting from current loan number
  // For 1st loan: stages 1-10 (1x to 10x)
  // For 2nd loan: stages 2-10 (2x to 10x) 
  // For 3rd loan: stages 3-10 (3x to 10x)
  const totalStages = 10;
  const startStage = Math.min(currentLoanNumber, totalStages); // Cap at stage 10
  
  // Calculate next limit for header message (final stage limit)
  const nextLimit = currentLimit * totalStages; // Always show 10x for max potential

  // Generate short loan ID format: PLL + last 4 digits
  const getShortLoanId = () => {
    const appNumber = loanData.loan_id || loanData.application_number || loanData.id || '';
    if (appNumber) {
      const last4 = String(appNumber).slice(-4);
      return `PLL${last4}`;
    }
    return 'N/A';
  };

  const shortLoanId = getShortLoanId();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-12">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />

      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-5xl">
        {/* Header Message */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Get upto ₹{formatCurrency(nextLimit).replace('₹', '')} by closing this loan
          </h1>
          <p className="text-sm sm:text-base text-gray-600">Clear your loan fast to unlock higher limits</p>
        </div>

        {/* Single Payment Plan - Current Page */}
        {!shouldShowMultiEmi && (
          <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Preclose Section - Similar to Multi-EMI */}
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Preclose it today</h3>
              
              {/* Calculate preclose amount */}
              {(() => {
                const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                
                // Calculate interest till today
                let interestTillToday = 0;
                let interestDays = exhaustedDays;
                let interestRatePerDay = planData.interest_percent_per_day || 
                                    calculations.interest?.rate_per_day ||
                                    (calculations.interest?.amount && calculations.interest?.days && principal > 0
                                      ? calculations.interest.amount / (calculations.interest.days * principal)
                                      : 0.001); // Default 0.1% per day
                
                if (loanData.processed_at && loanData.processed_interest !== null && loanData.processed_interest !== undefined) {
                  // Use processed_interest from database
                  interestTillToday = parseFloat(loanData.processed_interest || 0);
                  const processedDateStr = loanData.processed_at.split('T')[0];
                  const processedDate = new Date(processedDateStr + 'T00:00:00');
                  processedDate.setHours(0, 0, 0, 0);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  interestDays = Math.ceil((today.getTime() - processedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                } else {
                  interestTillToday = principal * interestRatePerDay * exhaustedDays;
                }
                
                // Get post service fee and GST
                const postServiceFee = repaymentSchedule[0]?.post_service_fee || 
                                     calculations.fees?.post_service_fee || 
                                     (calculations.total_repayable - principal - interestTillToday - (calculations.fees?.gst || 0)) || 0;
                const gstOnPostServiceFee = repaymentSchedule[0]?.gst_on_post_service_fee || 
                                           (postServiceFee * 0.18) || 0;
                
                const precloseAmount = principal + interestTillToday + postServiceFee + gstOnPostServiceFee;
                
                return (
                  <>
                    <div className="text-center py-4 sm:py-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200">
                      <p className="text-xs sm:text-sm text-gray-600 mb-2 font-medium">Preclose Amount</p>
                      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-2">
                        {formatCurrency(precloseAmount)}
                      </h1>
                      <div className="text-xs sm:text-sm text-gray-600 space-y-1 mt-3">
                        <p>Principal: {formatCurrency(principal)}</p>
                        <p>Interest (till today, {interestDays} days @ {(interestRatePerDay * 100).toFixed(4)}%/day): {formatCurrency(interestTillToday)}</p>
                        <p>Post Service Fee (1 time): {formatCurrency(postServiceFee)}</p>
                        <p>GST on Post Service Fee: {formatCurrency(gstOnPostServiceFee)}</p>
                      </div>
                    </div>
                    
                    {/* Due Date Display */}
                    {(() => {
                      const dueDate = kfsData.repayment?.first_due_date || loanData.processed_due_date;
                      if (dueDate) {
                        const dueDateObj = new Date(dueDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        dueDateObj.setHours(0, 0, 0, 0);
                        const daysRemaining = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isOverdue = daysRemaining < 0;
                        const isDueToday = daysRemaining === 0;
                        
                        return (
                          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 mt-4">
                            <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">Due Date</p>
                            <p className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">
                              {dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className={`text-xs sm:text-sm font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-600' : 'text-blue-600'}`}>
                              {isOverdue ? `Overdue by ${Math.abs(daysRemaining)} days` : isDueToday ? 'Due Today!' : `Due in ${daysRemaining} days`}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                );
              })()}

              {/* Default Status */}
              {isDefaulted && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-pulse">
                  <p className="text-red-600 font-bold text-base sm:text-lg uppercase tracking-wide">
                    ⚠ DEFAULTED ({daysDelayed} days delayed)
                  </p>
                  <p className="text-xs sm:text-sm text-red-500 mt-1">Immediate action required</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <Button
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold shadow-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all transform hover:scale-[1.02]"
                  onClick={async () => {
                    try {
                      toast.loading('Creating payment order...');

                      const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                      const amount = calculations.total_repayable;

                      if (!loanId || !amount) {
                        toast.error('Unable to process payment');
                        return;
                      }

                      const response = await apiService.createPaymentOrder(loanId, amount);

                      if (response.success && response.data?.paymentSessionId) {
                        toast.success('Opening payment gateway...');

                        try {
                          const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                             !response.data.checkoutUrl?.includes('payments-test');
                          
                          const cashfree = await load({ 
                            mode: isProduction ? "production" : "sandbox"
                          });

                          if (cashfree) {
                            cashfree.checkout({
                              paymentSessionId: response.data.paymentSessionId
                            });
                          } else {
                            throw new Error('Failed to load Cashfree SDK');
                          }
                        } catch (sdkError: any) {
                          console.error('Cashfree SDK error:', sdkError);
                          toast.error('Failed to open payment gateway. Please try again.');
                          
                          if (response.data.checkoutUrl) {
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

                {/* Extend Loan Tenure Button */}
                {canExtend && (
                  <Button
                    variant="outline"
                    className="w-full h-12 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold"
                    onClick={() => {
                      toast.info('Tenure extension feature coming soon');
                    }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Extend your loan tenure
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Multi-EMI Plan - Preclose Section */}
        {shouldShowMultiEmi && (
          <>
            <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Preclose it today</h3>
                
                {/* Calculate preclose amount: principal + interest till today + post service fee (1 time) + gst */}
                {(() => {
                  const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                  
                  // For processed loans, use processed_interest from database (updated by cron)
                  // Per rulebook: Use processed_* values for processed loans, not recalculated values
                  let interestTillToday = 0;
                  let interestDays = exhaustedDays;
                  let interestRatePerDay = planData.interest_percent_per_day || 
                                      calculations.interest?.rate_per_day ||
                                      (calculations.interest?.amount && calculations.interest?.days && principal > 0
                                        ? calculations.interest.amount / (calculations.interest.days * principal)
                                        : 0.001); // Default 0.1% per day
                  
                  if (loanData.processed_at && loanData.processed_interest !== null && loanData.processed_interest !== undefined) {
                    // Use processed_interest from database (already calculated by cron)
                    interestTillToday = parseFloat(loanData.processed_interest || 0);
                    // Calculate days from processed_at to today for display
                    // Extract date portion only to avoid timezone issues
                    const processedDateStr = loanData.processed_at.split('T')[0]; // Get YYYY-MM-DD part
                    const processedDate = new Date(processedDateStr + 'T00:00:00');
                    processedDate.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    interestDays = Math.ceil((today.getTime() - processedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    console.log('Using processed_interest from database:', {
                      processed_interest: interestTillToday,
                      processed_at: loanData.processed_at,
                      processedDate: processedDate.toISOString().split('T')[0],
                      today: today.toISOString().split('T')[0],
                      interestDays: interestDays,
                      diffMs: today.getTime() - processedDate.getTime(),
                      diffDays: (today.getTime() - processedDate.getTime()) / (1000 * 60 * 60 * 24)
                    });
                  } else {
                    // Calculate interest till today based on exhausted days (for non-processed loans)
                    // But if loan is processed, use the same days calculation as above
                    if (loanData.processed_at) {
                      // For processed loans, recalculate days even if processed_interest is 0/null
                      // Extract date portion only to avoid timezone issues
                      const processedDateStr = loanData.processed_at.split('T')[0]; // Get YYYY-MM-DD part
                      const processedDate = new Date(processedDateStr + 'T00:00:00');
                      processedDate.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      interestDays = Math.ceil((today.getTime() - processedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      console.log('Recalculating days for processed loan (processed_interest is 0/null):', interestDays);
                    }
                    // Interest = Principal * Rate * Days
                    interestTillToday = principal * interestRatePerDay * interestDays;
                  }
                  
                  // For preclose, use post service fee ONCE (not multiplied by EMI count)
                  // Post Service Fee is 10% of principal (fixed)
                  const emiCount = planData.emi_count || 1;
                  const POST_SERVICE_FEE_PERCENT = 10; // 10% fixed
                  const GST_RATE = 0.18; // 18% GST
                  
                  let postServiceFeeBase = 0;
                  
                  // Try to get from first EMI in schedule (this is the base fee per EMI)
                  if (repaymentSchedule.length > 0 && repaymentSchedule[0].post_service_fee) {
                    postServiceFeeBase = repaymentSchedule[0].post_service_fee;
                  } else if (calculations.totals?.repayableFee) {
                    // If repayableFee is already multiplied by EMI count, divide it back
                    postServiceFeeBase = emiCount > 1 
                      ? calculations.totals.repayableFee / emiCount 
                      : calculations.totals.repayableFee;
                  }
                  
                  // If still 0, calculate as 10% of principal (fallback)
                  if (postServiceFeeBase === 0) {
                    postServiceFeeBase = (principal * POST_SERVICE_FEE_PERCENT) / 100;
                  }
                  
                  const postServiceFee = postServiceFeeBase;
                  
                  // Calculate GST on post service fee (18% of fee)
                  let gstOnPostServiceFee = 0;
                  if (repaymentSchedule.length > 0 && repaymentSchedule[0].gst_on_post_service_fee) {
                    gstOnPostServiceFee = repaymentSchedule[0].gst_on_post_service_fee;
                  } else if (calculations.totals?.repayableFeeGST) {
                    gstOnPostServiceFee = emiCount > 1
                      ? calculations.totals.repayableFeeGST / emiCount
                      : calculations.totals.repayableFeeGST;
                  }
                  
                  // If still 0, calculate as 18% of post service fee (fallback)
                  if (gstOnPostServiceFee === 0 && postServiceFee > 0) {
                    gstOnPostServiceFee = postServiceFee * GST_RATE;
                  }
                  
                  const precloseAmount = principal + interestTillToday + postServiceFee + gstOnPostServiceFee;
                  
                  // Debug logging
                  console.log('Preclose Calculation:', {
                    principal,
                    interestRatePerDay,
                    exhaustedDays,
                    interestTillToday,
                    postServiceFeeBase: calculations.totals?.repayableFee,
                    postServiceFee,
                    gstBase: calculations.totals?.repayableFeeGST,
                    gstOnPostServiceFee,
                    emiCount,
                    firstEmiFee: repaymentSchedule[0]?.post_service_fee,
                    precloseAmount
                  });
                  
                  return (
                    <>
                      <div className="text-center py-4 sm:py-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200">
                        <p className="text-xs sm:text-sm text-gray-600 mb-2 font-medium">Preclose Amount</p>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-2">
                          {formatCurrency(precloseAmount)}
                        </h1>
                        <div className="text-xs sm:text-sm text-gray-500 mt-2 space-y-1">
                          <p>Principal: {formatCurrency(principal)}</p>
                          <p>Interest (till today, {interestDays} days @ {(interestRatePerDay * 100).toFixed(4)}%/day): {formatCurrency(interestTillToday)}</p>
                          <p>Post Service Fee (1 time): {formatCurrency(postServiceFee)}</p>
                          <p>GST on Post Service Fee: {formatCurrency(gstOnPostServiceFee)}</p>
                        </div>
                      </div>

                      <Button
                        className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold shadow-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all transform hover:scale-[1.02]"
                        onClick={async () => {
                          try {
                            toast.loading('Creating payment order...');

                            const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');

                            if (!loanId || !precloseAmount) {
                              toast.error('Unable to process payment');
                              return;
                            }

                            const response = await apiService.createPaymentOrder(loanId, precloseAmount);

                            if (response.success && response.data?.paymentSessionId) {
                              toast.success('Opening payment gateway...');

                              try {
                                const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                   !response.data.checkoutUrl?.includes('payments-test');
                                
                                const cashfree = await load({ 
                                  mode: isProduction ? "production" : "sandbox"
                                });

                                if (cashfree) {
                                  cashfree.checkout({
                                    paymentSessionId: response.data.paymentSessionId
                                  });
                                } else {
                                  throw new Error('Failed to load Cashfree SDK');
                                }
                              } catch (sdkError: any) {
                                console.error('Cashfree SDK error:', sdkError);
                                toast.error('Failed to open payment gateway. Please try again.');
                                
                                if (response.data.checkoutUrl) {
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
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* EMI List */}
            {repaymentSchedule.length > 0 && (
              <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">EMI Schedule</h3>
                  <div className="space-y-3">
                    {repaymentSchedule.map((emi: any, index: number) => {
                      const emiDate = new Date(emi.due_date);
                      emiDate.setHours(0, 0, 0, 0);
                      const daysUntilDue = Math.ceil((emiDate.getTime() - currentDateMidnight.getTime()) / (1000 * 60 * 60 * 24));
                      const isOverdue = daysUntilDue < 0;
                      const isDueToday = daysUntilDue === 0;
                      
                      const getOrdinal = (n: number) => {
                        const s = ["th", "st", "nd", "rd"];
                        const v = n % 100;
                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                      };

                      return (
                        <div
                          key={emi.instalment_no || index}
                          className={`p-4 rounded-lg border-2 ${
                            isOverdue
                              ? 'bg-red-50 border-red-200'
                              : isDueToday
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-base sm:text-lg font-bold text-gray-900">
                                  {getOrdinal(emi.instalment_no || index + 1)} EMI
                                </span>
                                {isOverdue && (
                                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">
                                    Overdue
                                  </span>
                                )}
                                {isDueToday && (
                                  <span className="text-xs font-semibold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                                    Due Today
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-gray-500">EMI Date</p>
                                  <p className="font-semibold text-gray-900">{formatDate(emi.due_date)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Due in</p>
                                  <p className={`font-semibold ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-600' : 'text-gray-900'}`}>
                                    {isOverdue
                                      ? `${Math.abs(daysUntilDue)} days ago`
                                      : isDueToday
                                      ? 'Today'
                                      : `${daysUntilDue} days`}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-lg sm:text-xl font-bold text-gray-900 mr-2">
                                {formatCurrency(emi.instalment_amount || 0)}
                              </p>
                              <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={async () => {
                                  try {
                                    toast.loading('Creating payment order...');

                                    const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                    const amount = emi.instalment_amount || 0;

                                    if (!loanId || !amount) {
                                      toast.error('Unable to process payment');
                                      return;
                                    }

                                    const response = await apiService.createPaymentOrder(loanId, amount);

                                    if (response.success && response.data?.paymentSessionId) {
                                      toast.success('Opening payment gateway...');

                                      try {
                                        const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                           !response.data.checkoutUrl?.includes('payments-test');
                                        
                                        const cashfree = await load({ 
                                          mode: isProduction ? "production" : "sandbox"
                                        });

                                        if (cashfree) {
                                          cashfree.checkout({
                                            paymentSessionId: response.data.paymentSessionId
                                          });
                                        } else {
                                          throw new Error('Failed to load Cashfree SDK');
                                        }
                                      } catch (sdkError: any) {
                                        console.error('Cashfree SDK error:', sdkError);
                                        toast.error('Failed to open payment gateway. Please try again.');
                                        
                                        if (response.data.checkoutUrl) {
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
                                Pay Now
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Loan Progression Stages - Redesigned */}
        <Card className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          <CardContent className="p-3 sm:p-5">
            <div className="space-y-3">
              {Array.from({ length: totalStages - startStage + 1 }, (_, index) => {
                const stageNumber = startStage + index;
                const stageLimit = currentLimit * stageNumber;
                const isCurrentStage = index === 0;
                const isFinalStage = stageNumber === totalStages;
                
                return (
                  <div key={stageNumber} className="relative">
                    {/* Stage Card */}
                    <div className={`flex items-stretch gap-3 rounded-xl overflow-hidden transition-all ${
                      isCurrentStage 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-md' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}>
                      {/* Left: Stage Number Circle */}
                      <div className={`flex items-center justify-center w-16 sm:w-20 ${
                        isCurrentStage ? 'bg-blue-700' : 'bg-gray-200'
                      }`}>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
                          isCurrentStage 
                            ? 'bg-white text-blue-600' 
                            : 'bg-white text-gray-400'
                        }`}>
                          {isCurrentStage ? (
                            <span className="text-lg sm:text-xl font-bold">
                              {String(stageNumber).padStart(2, '0')}
                            </span>
                          ) : (
                            <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                          )}
                        </div>
                      </div>

                      {/* Right: Content */}
                      <div className={`flex-1 py-3 pr-3 ${isCurrentStage ? 'text-white' : 'text-gray-700'}`}>
                        <div className="flex items-start justify-between gap-2">
                          {/* Left Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold ${
                                isCurrentStage ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                Stage {String(stageNumber).padStart(2, '0')}
                              </span>
                              {isCurrentStage && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                                  <Sparkles className="w-3 h-3" />
                                  You are Here
                                </span>
                              )}
                              {!isCurrentStage && (
                                <span className="text-[10px] font-medium text-gray-500">Locked</span>
                              )}
                            </div>
                            <div className={`text-xl sm:text-2xl font-bold mb-0.5 ${
                              isCurrentStage ? 'text-white' : 'text-gray-900'
                            }`}>
                              {formatCurrency(stageLimit).replace('.00', '')}
                            </div>
                            <div className={`text-xs ${
                              isCurrentStage ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {isCurrentStage 
                                ? 'Your Current limit' 
                                : isFinalStage 
                                ? 'Your Ultimate limit' 
                                : 'Your Next limit'}
                            </div>
                          </div>

                          {/* Right Content */}
                          <div className="text-right flex-shrink-0">
                            {isCurrentStage ? (
                              <div className="space-y-2">
                                <div>
                                  <div className="text-[10px] text-blue-100 mb-0.5">Loan ID</div>
                                  <div className="text-sm font-bold">{shortLoanId}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-blue-100 mb-0.5">Exhausted days</div>
                                  <div className="text-lg font-bold">{exhaustedDays}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <div className="text-[10px] text-gray-500 mb-1">Disbursal in 2 min</div>
                                <div className="inline-flex items-center gap-1 bg-gray-300 text-gray-600 text-[10px] font-medium px-2 py-1 rounded-full">
                                  <Lock className="w-3 h-3" />
                                  Locked
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Connector Line */}
                    {!isFinalStage && (
                      <div className="flex justify-start pl-8 sm:pl-10 py-2">
                        <div className="w-0.5 h-4 bg-gray-300"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {/* Important Bullet Points */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg rounded-2xl">
          <CardContent className="p-5 sm:p-6">
            <h3 className="font-bold text-blue-900 mb-4 sm:mb-5 flex items-center gap-2 text-base sm:text-lg">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              Important Information
            </h3>
            <ul className="space-y-3 sm:space-y-4">
              {[
                "Timely repayment helps improve CIBIL / Experian / CRIF / Equifax scores",
                "Get higher loan limits & faster approvals on your next loan",
                "Build your Pocket Credit Score & Trust Quotient",
                "Avoid penalty, late fee & recovery actions",
                "Prevent E-NACH bounce charges & bank penalties",
                "Stay stress-free — no calls, no follow-ups"
              ].map((point, index) => (
                <li key={index} className="flex gap-3 text-xs sm:text-sm text-blue-800 items-start">
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
