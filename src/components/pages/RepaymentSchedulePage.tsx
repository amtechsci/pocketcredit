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
import { ExtensionLetterModal } from '../modals/ExtensionLetterModal';
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
  const [extensionEligibility, setExtensionEligibility] = useState<any>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const appId = searchParams.get('applicationId');
    
    // Check if we're returning from payment gateway (has orderId, payment_status, or refresh param)
    const orderId = searchParams.get('orderId');
    const paymentStatus = searchParams.get('payment_status');
    const refreshParam = searchParams.get('refresh');
    const isPaymentReturn = orderId || paymentStatus || refreshParam;
    
    if (appId) {
      // If returning from payment, force refresh
      if (isPaymentReturn) {
        console.log('🔄 Returning from payment gateway, forcing refresh of loan data...');
        // Remove payment-related params from URL to prevent re-triggering on subsequent renders
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('orderId');
        newSearchParams.delete('payment_status');
        newSearchParams.delete('refresh');
        window.history.replaceState({}, '', `${window.location.pathname}?${newSearchParams.toString()}`);
        // Force refresh - add small delay to ensure backend has processed payment
        setTimeout(() => {
          fetchLoanData(parseInt(appId), true);
        }, 1000);
      } else {
        fetchLoanData(parseInt(appId), false);
      }
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

  const fetchLoanData = async (loanId: number, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch KFS data which contains all loan calculation details
      // Use useActualDays=true for repayment schedule to calculate interest based on actual exhausted days
      // When forceRefresh is true, fetch fresh data (API should handle this, but we'll ensure state is cleared)
      if (forceRefresh) {
        // Clear existing state to force re-render with fresh data
        setKfsData(null);
        setLoanData(null);
        console.log('🔄 Force refreshing loan data after payment return...');
      }
      
      const kfsResponse = await apiService.getKFS(loanId, true);
      console.log('📊 KFS Response:', kfsResponse);
      console.log('📊 Loan Data:', kfsResponse?.data?.loan);
      console.log('📊 Loan Status:', kfsResponse?.data?.loan?.status);
      
      // Fetch loan calculation using unified API (same as admin)
      let calculationResponse = null;
      try {
        calculationResponse = await apiService.getLoanCalculation(loanId);
        console.log('📊 Calculation Response:', calculationResponse);
      } catch (calcError) {
        console.error('Error fetching loan calculation:', calcError);
        // Continue with KFS data if calculation API fails
      }
      
      if (kfsResponse && (kfsResponse.success || kfsResponse.status === 'success') && kfsResponse.data) {
        // Override calculations with unified API response if available (more accurate)
        if (calculationResponse && calculationResponse.success && calculationResponse.data) {
          // Use calculation API data which has correct date handling - this is the source of truth
          kfsResponse.data.calculations = calculationResponse.data;
          
          // Also merge repayment schedule from calculation API if available
          if (calculationResponse.data.repayment?.schedule) {
            if (!kfsResponse.data.repayment) {
              kfsResponse.data.repayment = {};
            }
            kfsResponse.data.repayment.schedule = calculationResponse.data.repayment.schedule;
            // Also set first_due_date from schedule if available
            if (calculationResponse.data.repayment.schedule.length > 0) {
              kfsResponse.data.repayment.first_due_date = calculationResponse.data.repayment.schedule[0].due_date;
            }
            console.log('✅ Merged repayment schedule from calculation API:', kfsResponse.data.repayment.schedule);
          } else {
            console.log('⚠️ No repayment schedule in calculation API response');
          }
          
          console.log('✅ Using calculation API data (correct date handling):', calculationResponse.data);
          console.log('📊 Final KFS repayment data:', kfsResponse.data.repayment);
        } else {
          console.log('⚠️ Using KFS calculations (may have date issues):', kfsResponse.data.calculations);
        }
        
        setKfsData(kfsResponse.data);
        setLoanData(kfsResponse.data.loan);
        
        // If loan is cleared, redirect to dashboard after a short delay
        if (kfsResponse.data.loan?.status === 'cleared') {
          console.log('✅ Loan is CLEARED, will redirect to dashboard in 3 seconds...');
          setTimeout(() => {
            console.log('🔄 Redirecting to dashboard now...');
            navigate('/dashboard');
          }, 3000); // 3 second delay to show success message
        } else {
          console.log('ℹ️ Loan status is:', kfsResponse.data.loan?.status, '(not cleared)');
        }
      } else {
        setError('Failed to load loan data. Please try again later.');
      }

      // Fetch extension eligibility
      try {
        const eligibilityResponse = await apiService.checkExtensionEligibility(loanId);
        if (eligibilityResponse.success && eligibilityResponse.data) {
          setExtensionEligibility(eligibilityResponse.data);
          console.log('📊 Extension Eligibility:', eligibilityResponse.data);
        }
      } catch (eligibilityError) {
        console.error('Error fetching extension eligibility:', eligibilityError);
        // Continue without eligibility data
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
  console.log('🔍 KFS Data Debug:', {
    planData,
    loanData: loanData,
    repayment: kfsData.repayment,
    planType: planData.plan_type,
    loanPlanType: loanData.plan_type,
    hasRepaymentSchedule: !!kfsData.repayment?.schedule,
    scheduleLength: kfsData.repayment?.schedule?.length,
    scheduleData: kfsData.repayment?.schedule
  });
  
  // Check multiple possible locations for plan_type
  const planType = planData.plan_type || 
                   loanData.plan_type || 
                   loanData.plan_snapshot?.plan_type ||
                   (kfsData.repayment?.schedule && kfsData.repayment.schedule.length > 1 ? 'multi_emi' : null) ||
                   'single';
  const isMultiEmi = planType === 'multi_emi';
  const repaymentSchedule = kfsData.repayment?.schedule || [];
  
  console.log('🔍 Schedule Debug:', {
    planType,
    isMultiEmi,
    repaymentScheduleLength: repaymentSchedule.length,
    repaymentSchedule: repaymentSchedule,
    shouldShowMultiEmi: isMultiEmi || repaymentSchedule.length > 1
  });
  
  // Also check if we have multiple EMIs in schedule (fallback detection)
  const hasMultipleEmis = repaymentSchedule.length > 1;
  const shouldShowMultiEmi = isMultiEmi || hasMultipleEmis;
  
  // Check if loan is cleared (fully paid)
  const isLoanCleared = loanData?.status === 'cleared';
  console.log('🔍 Is Loan Cleared?', isLoanCleared, '| Loan Status:', loanData?.status);

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

  // Exhausted Days Calculation - Priority: last_extension_date + 1 day, Fallback: processed_at
  // Per rulebook: Use inclusive counting - Math.ceil((end - start) / msPerDay) + 1
  // First, try to use exhaustedDays from API response (calculated with last_extension_date priority)
  let exhaustedDays = calculations?.interest?.exhaustedDays || 1;
  
  // If API didn't provide exhaustedDays, calculate locally with priority logic
  if (!calculations?.interest?.exhaustedDays || exhaustedDays === 1) {
    // PRIORITY 1: Use last_extension_date + 1 day (next day after extension) if extension exists
    if (loanData.last_extension_date && loanData.extension_count > 0) {
      const lastExtensionDateStr = loanData.last_extension_date.split('T')[0]; // Get YYYY-MM-DD part
      const lastExtensionDate = new Date(lastExtensionDateStr + 'T00:00:00');
      lastExtensionDate.setHours(0, 0, 0, 0);
      
      // Add 1 day to get "next day" after extension
      const nextDayAfterExtension = new Date(lastExtensionDate);
      nextDayAfterExtension.setDate(nextDayAfterExtension.getDate() + 1);
      nextDayAfterExtension.setHours(0, 0, 0, 0);
      
      // Calculate days from next day after extension to today
      const diffTime = currentDateMidnight.getTime() - nextDayAfterExtension.getTime();
      const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      exhaustedDays = Math.max(1, daysDiff);
      
      console.log('Exhausted Days Calculation (using last_extension_date + 1 day):', {
        last_extension_date: loanData.last_extension_date,
        lastExtensionDateStr,
        nextDayAfterExtension: nextDayAfterExtension.toISOString().split('T')[0],
        currentDate: currentDate.toISOString().split('T')[0],
        calculatedDays: exhaustedDays
      });
    } 
    // FALLBACK: Use processed_at if no extension or last_extension_date not available
    else if (processedDateMidnight) {
      // Calculate difference in days using inclusive counting
      // Formula: Math.ceil((end - start) / msPerDay) + 1
      const diffTime = currentDateMidnight.getTime() - processedDateMidnight.getTime();
      const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      // Exhausted days should be at least 1 if loan was processed today or in the past
      exhaustedDays = Math.max(1, daysDiff);
      
      console.log('Exhausted Days Calculation (using processed_at as fallback):', {
        processed_at: loanData.processed_at,
        processedDateStr: processedDateMidnight ? loanData.processed_at.split('T')[0] : 'N/A',
        calculatedDays: exhaustedDays
      });
    }
  } else {
    console.log('Using exhaustedDays from API response (with last_extension_date priority):', exhaustedDays);
  }
  
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

  // Calculate loan progression stages based on percentage system (8%, 11%, 15.2%, etc.)
  // Get user's current loan limit
  const currentLimit = (user as any)?.loan_limit || loanData.sanctioned_amount || loanData.loan_amount || 0;
  
  // Get user's monthly salary
  // Priority: monthly_net_income from user object, then calculate backwards from current limit
  let monthlySalary = (user as any)?.monthly_net_income || 0;
  
  // If salary not available, try to calculate backwards from current limit and percentage
  // Percentage multipliers: [8, 11, 15.2, 20.9, 28, 32.1]
  const percentageMultipliers = [8, 11, 15.2, 20.9, 28, 32.1];
  
  // Determine current loan number (completed + 1 for current loan)
  const currentLoanNumber = completedLoansCount + 1; // 1st loan, 2nd loan, 3rd loan, etc.
  
  // If salary not available, estimate from current limit and current loan number
  if (!monthlySalary || monthlySalary <= 0) {
    // Try to reverse calculate from current limit
    // Current limit should be approximately: salary * percentageMultipliers[currentLoanNumber - 1]
    if (currentLimit > 0 && currentLoanNumber > 0 && currentLoanNumber <= percentageMultipliers.length) {
      const currentPercentage = percentageMultipliers[currentLoanNumber - 1];
      monthlySalary = Math.round((currentLimit * 100) / currentPercentage);
      console.log(`[Stages] Estimated salary from current limit: ₹${monthlySalary} (limit: ₹${currentLimit}, percentage: ${currentPercentage}%)`);
    } else {
      // Fallback: use a default salary estimate
      monthlySalary = 30000; // Default fallback
      console.warn(`[Stages] Could not determine salary, using default: ₹${monthlySalary}`);
    }
  }
  
  // Calculate limits for each percentage tier
  // NOTE: Stages show percentage-based limits WITHOUT cap (backend caps at 45600, but stages show theoretical limits)
  const calculateLimitForPercentage = (percentage: number) => {
    // Round down to nearest 1000 (e.g., 11055 -> 11000, 11555 -> 11000)
    const calculatedLimit = Math.floor((monthlySalary * percentage) / 1000) * 1000;
    // DO NOT apply cap here - stages show theoretical percentage-based limits
    return calculatedLimit;
  };
  
  // Determine current stage percentage index (0-based)
  // currentLoanNumber = 1 means 1st loan (8%), 2 means 2nd loan (11%), etc.
  const currentStageIndex = Math.min(currentLoanNumber - 1, percentageMultipliers.length - 1);
  const currentPercentage = percentageMultipliers[currentStageIndex];
  const currentStageLimit = calculateLimitForPercentage(currentPercentage);
  
  // Calculate next stage (what they'll get after completing current loan)
  // Next stage is the next percentage tier
  const nextStageIndex = Math.min(currentLoanNumber, percentageMultipliers.length - 1);
  const nextPercentage = nextStageIndex < percentageMultipliers.length ? percentageMultipliers[nextStageIndex] : null;
  
  // Calculate next limit for display (stages show percentage-based limits, not capped)
  // Round down to nearest 1000 for display (e.g., 11055 -> 11000)
  const nextStageLimitUncapped = nextPercentage ? Math.floor((monthlySalary * nextPercentage) / 1000) * 1000 : null;
  // For stages, show the uncapped limit (backend will cap at 45600, but stages show theoretical)
  const nextStageLimit = nextStageLimitUncapped;
  
  // Premium limit (₹1,50,000) - shown as ultimate stage
  const premiumLimit = 150000;
  
  // Check if premium limit should be shown
  // Show premium if: current percentage is max (32.1%), or next limit (before cap) would exceed ₹45,600, or we're at the last tier
  const isMaxPercentageReached = currentPercentage >= 32.1;
  const wouldCrossMaxLimit = nextStageLimitUncapped ? nextStageLimitUncapped > 45600 : false;
  const isLastTier = currentLoanNumber >= percentageMultipliers.length;
  const shouldShowPremium = isMaxPercentageReached || wouldCrossMaxLimit || isLastTier;
  
  // Calculate limit to show in "Get upto" header message
  // Always show premium limit (₹1,50,000) as the ultimate goal
  const headerLimit = 150000; // Always show ₹1,50,000

  // Generate short loan ID format: PLL + last 4 digits
  const getShortLoanId = () => {
    // Try multiple sources: loanData, kfsData.loan, or URL parameter
    const sourceLoan = loanData || kfsData?.loan;
    const appId = searchParams.get('applicationId');
    
    const appNumber = sourceLoan?.application_number 
      || sourceLoan?.loan_id 
      || sourceLoan?.id 
      || kfsData?.loan?.application_number
      || kfsData?.loan?.loan_id
      || kfsData?.loan?.id
      || appId
      || '';
      
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
          <h5 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Get upto ₹{formatCurrency(headerLimit).replace('₹', '')}
          </h5>
          <p className="text-xs sm:text-sm text-gray-500"> by closing this loan. Clear your loan fast to unlock higher limits</p>
        </div>

        {/* Loan Cleared Success Message */}
        {isLoanCleared && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-green-200">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-green-700 mb-2">
                    🎉 Loan Cleared Successfully!
                  </h2>
                  <p className="text-base sm:text-lg text-green-600 mb-4">
                    Congratulations! You have successfully paid off this loan.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 mb-2">
                    You can now apply for a higher loan amount with better terms.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 italic">
                    Redirecting to dashboard in 3 seconds...
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-base sm:text-lg font-semibold"
                >
                  Go to Dashboard Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Single Payment Plan - Current Page */}
        {!shouldShowMultiEmi && !isLoanCleared && (() => {
          // Hide preclose option if first loan is already cleared
          // If completedLoansCount > 0, user has cleared at least one loan, so hide preclose
          if (completedLoansCount > 0) {
            return null;
          }
          
          // Calculate DPD (Days Past Due Date) to determine if Pre-close button should be shown
          // Pre-close button shall be available till DPD = -6 only (6 days before due date)
          const dueDate = kfsData.repayment?.first_due_date || loanData.processed_due_date;
          let dpd = null;
          let canShowPreClose = false;
          
          if (dueDate) {
            const dueDateObj = new Date(dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDateObj.setHours(0, 0, 0, 0);
            // DPD = today - due_date (negative means before due date, positive means after)
            dpd = Math.ceil((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
            // Show Pre-close only if DPD <= -6 (at least 6 days before due date)
            canShowPreClose = dpd <= -6;
          }
          
          // If DPD condition not met, don't show Pre-close section
          if (!canShowPreClose) {
            return null;
          }
          
          return (
            <>
            <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
              <CardContent className="p-4 sm:p-6">
                {/* Preclose Section - Single Row Layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Preclose it today</h3>
                    {shortLoanId !== 'N/A' && (
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        Loan ID: {shortLoanId}
                      </span>
                    )}
                  </div>
                
                {/* Calculate preclose amount */}
                {(() => {
                  const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                  
                  // Calculate interest till today for preclose
                  // Priority: Use interestTillToday from API (calculated with last_extension_date priority)
                  let interestTillToday = calculations?.interest?.interestTillToday || 0;
                  let interestRatePerDay = planData.interest_percent_per_day || 
                                      calculations.interest?.rate_per_day ||
                                      (calculations.interest?.amount && calculations.interest?.days && principal > 0
                                        ? calculations.interest.amount / (calculations.interest.days * principal)
                                        : 0.001); // Default 0.1% per day
                  
                  // If API didn't provide interestTillToday, calculate locally using exhaustedDays
                  // exhaustedDays is already calculated with last_extension_date priority above
                  if (!interestTillToday || interestTillToday === 0) {
                    // Calculate interest based on exhaustedDays (which uses last_extension_date + 1 day as priority)
                    interestTillToday = principal * interestRatePerDay * exhaustedDays;
                    
                    console.log('Calculating interestTillToday locally for single payment preclose:', {
                      principal,
                      interestRatePerDay,
                      exhaustedDays,
                      interestTillToday,
                      baseDate: loanData.last_extension_date && loanData.extension_count > 0
                        ? `last_extension_date (${loanData.last_extension_date.split('T')[0]}) + 1 day`
                        : loanData.processed_at 
                          ? `processed_at (${loanData.processed_at.split('T')[0]})`
                          : 'disbursed_at'
                    });
                  } else {
                    console.log('Using interestTillToday from API (with last_extension_date priority) for single payment preclose:', interestTillToday);
                  }
                  
                  // Pre-close fee: 10% of principal + 18% GST (NO post service fee for pre-close)
                  const preCloseFeePercent = 10;
                  const preCloseFee = Math.round((principal * preCloseFeePercent) / 100 * 100) / 100;
                  const preCloseFeeGST = Math.round(preCloseFee * 0.18 * 100) / 100;
                  
                  const precloseAmount = principal + interestTillToday + preCloseFee + preCloseFeeGST;
                  
                  // Get due date for display
                  let dueDateObj = null;
                  let daysRemaining = 0;
                  let isOverdue = false;
                  let isDueToday = false;
                  
                  if (dueDate) {
                    dueDateObj = new Date(dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDateObj.setHours(0, 0, 0, 0);
                    daysRemaining = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    isOverdue = daysRemaining < 0;
                    isDueToday = daysRemaining === 0;
                  }
                
                // Calculate last available date (DPD = -6 means 6 days before due date)
                // So last available date = due_date - 6 days
                let lastAvailableDate = null;
                let lastAvailableDateFormatted = '';
                if (dueDateObj) {
                  lastAvailableDate = new Date(dueDateObj);
                  lastAvailableDate.setDate(lastAvailableDate.getDate() - 6);
                  lastAvailableDateFormatted = lastAvailableDate.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  });
                }

                return (
                  <>
                    {/* Single Row Layout: Amount | Due Date | Button */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200">
                      {/* Column 1: Preclose Amount with message */}
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">
                          Now & save interest: {formatCurrency(precloseAmount)}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 italic">
                          (Available till {lastAvailableDateFormatted || 'N/A'} only)
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
                          {formatCurrency(precloseAmount)}
                        </h2>
                      </div>
                      
                      {/* Column 2: Due Date */}
                      {dueDateObj && (
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">Due Date</p>
                          <p className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                            {dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className={`text-xs text-gray-600 ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-600' : ''}`}>
                            {isOverdue ? `Overdue by ${Math.abs(daysRemaining)} days` : isDueToday ? 'Due Today!' : `Due in ${daysRemaining} days`}
                          </p>
                        </div>
                      )}
                      
                      {/* Column 3: Repay Now Button */}
                      <div className="flex-shrink-0 w-full md:w-auto">
                        <Button
                          className="w-full md:w-auto h-12 text-base font-semibold shadow-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all"
                          onClick={async () => {
                            try {
                              toast.loading('Creating payment order...');

                              const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                              const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                              
                              // Calculate interest till today
                              let interestTillToday = 0;
                              let interestRatePerDay = planData.interest_percent_per_day || 
                                                  calculations.interest?.rate_per_day ||
                                                  (calculations.interest?.amount && calculations.interest?.days && principal > 0
                                                    ? calculations.interest.amount / (calculations.interest.days * principal)
                                                    : 0.001);
                              
                              if (loanData.processed_at && loanData.processed_interest !== null && loanData.processed_interest !== undefined) {
                                interestTillToday = parseFloat(loanData.processed_interest || 0);
                              } else {
                                interestTillToday = principal * interestRatePerDay * exhaustedDays;
                              }
                              
                              const preCloseFeePercent = 10;
                              const preCloseFee = Math.round((principal * preCloseFeePercent) / 100 * 100) / 100;
                              const preCloseFeeGST = Math.round(preCloseFee * 0.18 * 100) / 100;
                              const precloseAmount = principal + interestTillToday + preCloseFee + preCloseFeeGST;

                              if (!loanId || !precloseAmount) {
                                toast.error('Unable to process payment');
                                return;
                              }

                              const response = await apiService.createPaymentOrder(loanId, precloseAmount, 'pre-close');

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
                      </div>
                    </div>

                    {/* Default Status */}
                    {isDefaulted && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-pulse mt-4">
                        <p className="text-red-600 font-bold text-base sm:text-lg uppercase tracking-wide">
                          ⚠ DEFAULTED ({daysDelayed} days delayed)
                        </p>
                        <p className="text-xs sm:text-sm text-red-500 mt-1">Immediate action required</p>
                      </div>
                    )}

                    {/* Extend Loan Tenure Button */}
                    {canExtend && (
                      <div className="mt-4">
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
                      </div>
                    )}
                  </>
                );
              })()}
              </CardContent>
            </Card>
            </>
          );
        })()}

        {/* Single Payment Plan - Pay on Due Date */}
        {!shouldShowMultiEmi && !isLoanCleared && (() => {
          // Check if extension button should be shown for single payment loan (D-5 to D+15)
          const dueDate = kfsData.repayment?.first_due_date || loanData.processed_due_date;
          let canShowExtension = false;
          if (dueDate) {
            // Parse due date correctly (handle both string and Date formats)
            const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate + 'T00:00:00') : new Date(dueDate);
            dueDateObj.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // DPD = today - due_date (negative means before due date, positive means after)
            const dpd = Math.ceil((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
            // Show extension button if DPD is between -5 and +15 (5 days before to 15 days after)
            const isWithinDpdWindow = dpd >= -5 && dpd <= 15;
            // Also check backend eligibility - only show if backend says it's eligible
            // OR if there's a pending_payment extension (user needs to check payment status)
            // If eligibility data is not loaded yet, don't show the button
            const isBackendEligible = extensionEligibility 
              ? (extensionEligibility.can_extend === true || extensionEligibility.is_eligible === true)
              : false;
            const hasPendingPayment = extensionEligibility?.has_pending_request && 
                                     extensionEligibility?.pending_extension?.status === 'pending_payment';
            canShowExtension = isWithinDpdWindow && (isBackendEligible || hasPendingPayment);
            console.log('🔍 Extension Button Check (Single Payment):', {
              dueDate,
              dpd,
              isWithinDpdWindow,
              isBackendEligible,
              hasPendingPayment,
              canShowExtension,
              extensionEligibility,
              extensionStatus: loanData?.extension_status,
              extensionCount: loanData?.extension_count,
              today: today.toISOString().split('T')[0],
              dueDateStr: dueDateObj.toISOString().split('T')[0]
            });
            
            // If button is not showing, log the reason
            if (!canShowExtension) {
              console.warn('⚠️ Extension button NOT showing because:');
              if (!isWithinDpdWindow) {
                console.warn('  - Outside DPD window (current DPD:', dpd, ', need -5 to +15)');
              }
              if (!isBackendEligible && !hasPendingPayment) {
                console.warn('  - Backend eligibility check failed');
                console.warn('  - extensionEligibility:', extensionEligibility);
              }
            }
          }
          
          return (
            <>
              <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-green-100">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Pay on Due Date</h3>
              
              {(() => {
                // Replicate exact calculation logic from Admin User Profile Detail page
                const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                
                // Check if loan is processed
                const isProcessed = loanData.processed_at || loanData.processedDate;
                const disbursedDate = loanData.disbursed_at || loanData.disbursedDate;
                
                // PRIORITY 1: Use calculation API value (most accurate, uses correct date handling)
                // PRIORITY 2: Use database total_repayable (may be outdated if calculated before date fix)
                // PRIORITY 3: Calculate manually as fallback
                let totalAmount = 0;
                const calcTotalAmount = calculations.total?.repayable || calculations.total_amount || calculations.total_repayable || 0;
                const dbTotalRepayable = loanData.total_repayable ? parseFloat(loanData.total_repayable) : 0;
                
                // Use calculation API value first (most accurate), then database value, then calculate
                if (calcTotalAmount && calcTotalAmount > principal) {
                  totalAmount = calcTotalAmount;
                  console.log('✅ Using calculation API total:', calcTotalAmount);
                } else if (dbTotalRepayable && dbTotalRepayable > principal) {
                  totalAmount = dbTotalRepayable;
                  console.log('⚠️ Using database total (may be outdated):', dbTotalRepayable);
                } else {
                  // PRIORITY 2: Fallback to calculation if backend value not available
                  // Post service fee - use processed value if available, otherwise calculate
                  const postServiceFee = isProcessed && loanData.processed_post_service_fee !== null && loanData.processed_post_service_fee !== undefined
                    ? parseFloat(loanData.processed_post_service_fee) || 0
                    : (calculations.totals?.repayableFee || 0);
                  const postServiceFeeGST = calculations.totals?.repayableFeeGST || 0;
                  
                  // Get due date
                  const dueDate = isProcessed && loanData.processed_due_date
                    ? loanData.processed_due_date
                    : (calculations.interest?.repayment_date || null);
                  
                  // Calculate DPD (Days Past Due) for penalty calculation
                  let dpd = 0;
                  if (dueDate && disbursedDate) {
                    const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate + 'T00:00:00') : new Date(dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDateObj.setHours(0, 0, 0, 0);
                    const diff = Math.ceil((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
                    dpd = diff > 0 ? diff : 0;
                  }
                  
                  // Penalty calculation - use processed value if available, otherwise calculate
                  let penaltyTotal = 0;
                  if (isProcessed && loanData.processed_penalty !== null && loanData.processed_penalty !== undefined) {
                    penaltyTotal = parseFloat(loanData.processed_penalty) || 0;
                  } else if (dpd > 0) {
                    // Calculate penalty based on DPD
                    let penaltyPercent = 0;
                    if (dpd === 1) {
                      penaltyPercent = 5; // 5% on first day
                    } else if (dpd >= 2 && dpd <= 10) {
                      penaltyPercent = 1 * (dpd - 1); // 1% per day from day 2-10
                    } else if (dpd >= 11 && dpd <= 120) {
                      penaltyPercent = 9 + (0.6 * (dpd - 10)); // 9% (days 2-10) + 0.6% per day from day 11-120
                    }
                    penaltyTotal = Math.round((principal * penaltyPercent) / 100 * 100) / 100;
                  }
                  
                  // Calculate interest for full tenure (till due date, not till today)
                  // For multi-EMI loans, sum interest from schedule; for single payment, use calculation.interest.amount
                  let interestTillDate = 0;
                  if (kfsData.repayment?.schedule && Array.isArray(kfsData.repayment.schedule) && kfsData.repayment.schedule.length > 1) {
                    // Multi-EMI loan: Sum interest from all EMI periods in the schedule
                    interestTillDate = kfsData.repayment.schedule.reduce((sum: number, emi: any) => sum + (emi.interest || 0), 0);
                  } else {
                    // Single payment loan: Use the full tenure interest from calculation
                    // Use processed_interest if available, otherwise use calculation
                    if (isProcessed && loanData.processed_interest !== null && loanData.processed_interest !== undefined) {
                      interestTillDate = parseFloat(loanData.processed_interest) || 0;
                    } else {
                      interestTillDate = calculations?.interest?.amount || 0;
                    }
                  }
                  
                  // Calculate total amount: principal + post service fee + gst on post service fee + interest balance till due date + penalty if any
                  // This matches the exact formula from Admin User Profile Detail page (line 4698)
                  totalAmount = principal + postServiceFee + postServiceFeeGST + interestTillDate + penaltyTotal;
                }
                
                // Get due date for display
                const dueDate = isProcessed && loanData.processed_due_date
                  ? loanData.processed_due_date
                  : (calculations.interest?.repayment_date || null);
                
                // Parse due date and calculate days remaining for display
                let dueDateObj = null;
                let daysRemaining = 0;
                let isOverdue = false;
                let isDueToday = false;
                
                if (dueDate) {
                  dueDateObj = typeof dueDate === 'string' ? new Date(dueDate + 'T00:00:00') : new Date(dueDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  dueDateObj.setHours(0, 0, 0, 0);
                  daysRemaining = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  isOverdue = daysRemaining < 0;
                  isDueToday = daysRemaining === 0;
                }
                
                return (
                  <>
                    {/* Single Row Layout: Amount | Due Date | Button */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-green-50 rounded-xl border-2 border-green-200">
                      {/* Column 1: Total Amount */}
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">Total Amount</p>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                          {formatCurrency(totalAmount)}
                        </h2>
                      </div>
                      
                      {/* Column 2: Due Date */}
                      {dueDateObj && (
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">Due Date</p>
                          <p className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                            {dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className={`text-xs text-gray-600 ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-600' : ''}`}>
                            {isOverdue ? `Overdue by ${Math.abs(daysRemaining)} days` : isDueToday ? 'Due Today!' : `Due in ${daysRemaining} days`}
                          </p>
                        </div>
                      )}
                      
                      {/* Column 3: Pay Full Amount Button */}
                      <div className="flex-shrink-0 w-full md:w-auto">
                        <Button
                          className="w-full md:w-auto h-12 text-base font-semibold shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all"
                          onClick={async () => {
                            try {
                              toast.loading('Creating payment order...');

                              const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');

                              if (!loanId || !totalAmount) {
                                toast.error('Unable to process payment');
                                return;
                              }

                              // For single payment loans, use 'full_payment' which will clear immediately
                              const response = await apiService.createPaymentOrder(loanId, totalAmount, 'full_payment');

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
                          Pay Full Amount
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
                </CardContent>
              </Card>
              
              {/* Extension Button for Single Payment Loan */}
              {canShowExtension && (
                <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-orange-100">
                  <CardContent className="p-4 sm:p-6">
                    {extensionEligibility?.has_pending_request ? (
                      extensionEligibility?.pending_extension?.status === 'pending_payment' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                            <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                            <span className="text-orange-700 font-semibold">
                              Extension Payment Pending
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full h-12 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold"
                            onClick={async () => {
                              const extensionId = extensionEligibility?.pending_extension?.id;
                              if (extensionId) {
                                try {
                                  toast.loading('Checking payment status...');
                                  const response = await apiService.checkExtensionPayment(extensionId);
                                  toast.dismiss();
                                  
                                  if (response.success) {
                                    if (response.data.status === 'completed') {
                                      toast.success(response.data.message || 'Extension payment verified and extension approved successfully!');
                                      // Refresh loan data and eligibility
                                      const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                      if (loanId) {
                                        await fetchLoanData(loanId);
                                        const eligibilityResponse = await apiService.checkExtensionEligibility(loanId);
                                        if (eligibilityResponse.success) {
                                          setExtensionEligibility(eligibilityResponse.data);
                                        }
                                      }
                                    } else if (response.data.status === 'pending') {
                                      // Check if we should use SDK, redirect, or create new order
                                      if (response.data.paymentSessionId || response.data.useSdk) {
                                        // Use Cashfree SDK (same as EMI payments)
                                        toast.success('Opening payment gateway...');
                                        try {
                                          const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                             !response.data.checkoutUrl?.includes('payments-test');
                                          
                                          const cashfree = await load({ 
                                            mode: isProduction ? "production" : "sandbox"
                                          });

                                          if (cashfree && response.data.paymentSessionId) {
                                            cashfree.checkout({
                                              paymentSessionId: response.data.paymentSessionId
                                            });
                                          } else {
                                            throw new Error('Failed to load Cashfree SDK');
                                          }
                                        } catch (sdkError: any) {
                                          console.error('Cashfree SDK error:', sdkError);
                                          toast.error('Failed to open payment gateway. Please try again.');
                                          
                                          // Fallback to URL redirect if SDK fails
                                          if (response.data.checkoutUrl) {
                                            window.location.href = response.data.checkoutUrl;
                                          } else {
                                            toast.error('No payment session available');
                                          }
                                        }
                                      } else if (response.data.redirectToPayment && response.data.checkoutUrl) {
                                        // Fallback: Redirect to payment gateway
                                        window.location.href = response.data.checkoutUrl;
                                      } else if (response.data.createNewOrder) {
                                        // Create new payment order
                                        toast.info('Creating new payment order...');
                                        const extensionId = extensionEligibility?.pending_extension?.id;
                                        if (extensionId) {
                                          try {
                                            const paymentResponse = await apiService.createExtensionPayment(extensionId);
                                            if (paymentResponse.success && paymentResponse.data.paymentSessionId) {
                                              // Use SDK
                                              const isProduction = paymentResponse.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                                 !paymentResponse.data.checkoutUrl?.includes('payments-test');
                                              const cashfree = await load({ 
                                                mode: isProduction ? "production" : "sandbox"
                                              });
                                              if (cashfree) {
                                                cashfree.checkout({
                                                  paymentSessionId: paymentResponse.data.paymentSessionId
                                                });
                                              }
                                            } else if (paymentResponse.success && paymentResponse.data.checkoutUrl) {
                                              window.location.href = paymentResponse.data.checkoutUrl;
                                            } else {
                                              toast.error('Failed to create payment order. Please try again.');
                                            }
                                          } catch (error: any) {
                                            toast.error(error.message || 'Failed to create payment order');
                                          }
                                        }
                                      } else {
                                        toast.info(response.data.message || 'Your payment transaction is still pending. Please wait for payment confirmation.');
                                      }
                                    } else if (response.data.status === 'expired' || response.data.status === 'failed') {
                                      // Order expired or failed, create new one
                                      if (response.data.createNewOrder) {
                                        toast.info('Payment order expired. Creating new payment order...');
                                        const extensionId = extensionEligibility?.pending_extension?.id;
                                        if (extensionId) {
                                          try {
                                            const paymentResponse = await apiService.createExtensionPayment(extensionId);
                                            if (paymentResponse.success && paymentResponse.data.paymentSessionId) {
                                              // Use SDK
                                              const isProduction = paymentResponse.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                                 !paymentResponse.data.checkoutUrl?.includes('payments-test');
                                              const cashfree = await load({ 
                                                mode: isProduction ? "production" : "sandbox"
                                              });
                                              if (cashfree) {
                                                cashfree.checkout({
                                                  paymentSessionId: paymentResponse.data.paymentSessionId
                                                });
                                              }
                                            } else if (paymentResponse.success && paymentResponse.data.checkoutUrl) {
                                              window.location.href = paymentResponse.data.checkoutUrl;
                                            } else {
                                              toast.error('Failed to create payment order. Please try again.');
                                            }
                                          } catch (error: any) {
                                            toast.error(error.message || 'Failed to create payment order');
                                          }
                                        }
                                      } else {
                                        toast.error(response.data.message || 'Payment transaction has failed. Please create a new payment order.');
                                      }
                                    } else {
                                      toast.info(response.data.message || 'Payment status checked.');
                                    }
                                  } else {
                                    toast.error(response.message || 'Failed to check payment status');
                                  }
                                } catch (error: any) {
                                  console.error('Error checking extension payment:', error);
                                  toast.error(error.message || 'Failed to check payment status');
                                }
                              }
                            }}
                          >
                            <Loader2 className="w-4 h-4 mr-2" />
                            Check Payment Status
                          </Button>
                          <p className="text-xs text-gray-500 text-center">
                            Your payment transaction is being processed. Click to check the latest status.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                          <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                          <span className="text-orange-700 font-semibold">
                            Extension Request Pending Approval
                          </span>
                        </div>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold"
                        onClick={async () => {
                          const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                          if (loanId) {
                            try {
                              toast.loading('Submitting extension request...');
                              // Create extension request first (status: 'pending')
                              const response = await apiService.requestLoanExtension(loanId, 'Requesting loan tenure extension');
                              if (response.success) {
                                toast.success('Extension request submitted successfully');
                                // Show modal with agreement
                                setShowExtensionModal(true);
                              } else {
                                toast.error(response.message || 'Failed to submit extension request');
                              }
                            } catch (error: any) {
                              console.error('Error submitting extension request:', error);
                              toast.error(error.message || 'Failed to submit extension request');
                            }
                          }
                        }}
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Extend Loan Tenure
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}

        {/* Multi-EMI Plan - Preclose Section */}
        {shouldShowMultiEmi && !isLoanCleared && (() => {
          // Hide preclose option if first loan is already cleared
          // If completedLoansCount > 0, user has cleared at least one loan, so hide preclose
          if (completedLoansCount > 0) {
            return null;
          }
          
          // Calculate DPD (Days Past Due Date) using first EMI's due date
          // Pre-close button shall be available till DPD = -6 only (6 days before first EMI due date)
          const firstEmiDueDate = kfsData.repayment?.first_due_date 
            || (kfsData.repayment?.schedule && kfsData.repayment.schedule.length > 0 
              ? kfsData.repayment.schedule[0].due_date 
              : null)
            || loanData.processed_due_date;
          let dpd = null;
          let canShowPreClose = false;
          
          if (firstEmiDueDate) {
            const dueDateObj = new Date(firstEmiDueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDateObj.setHours(0, 0, 0, 0);
            // DPD = today - due_date (negative means before due date, positive means after)
            dpd = Math.ceil((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
            // Show Pre-close only if DPD <= -6 (at least 6 days before first EMI due date)
            canShowPreClose = dpd <= -6;
          }
          
          // If DPD condition not met, don't show Pre-close section
          if (!canShowPreClose) {
            return null;
          }
          
          return (
            <>
              <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Preclose it today</h3>
                    {shortLoanId !== 'N/A' && (
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        Loan ID: {shortLoanId}
                      </span>
                    )}
                  </div>
                  
                  {/* Calculate preclose amount: principal + interest till today + post service fee (1 time) + gst */}
                  {(() => {
                    const principal = calculations.principal || loanData.sanctioned_amount || loanData.principal_amount || loanData.loan_amount || 0;
                    
                    // Calculate interest till today for preclose
                    // Priority: Use interestTillToday from API (calculated with last_extension_date priority)
                    let interestTillToday = calculations?.interest?.interestTillToday || 0;
                    let interestDays = exhaustedDays; // Use exhaustedDays (already calculated with last_extension_date priority)
                    let interestRatePerDay = planData.interest_percent_per_day || 
                                        calculations.interest?.rate_per_day ||
                                        (calculations.interest?.amount && calculations.interest?.days && principal > 0
                                          ? calculations.interest.amount / (calculations.interest.days * principal)
                                          : 0.001); // Default 0.1% per day
                    
                    // If API didn't provide interestTillToday, calculate locally using exhaustedDays
                    // exhaustedDays is already calculated with last_extension_date priority above
                    if (!interestTillToday) {
                      // Calculate interest based on exhaustedDays (which uses last_extension_date + 1 day as priority)
                      interestTillToday = principal * interestRatePerDay * exhaustedDays;
                      
                      console.log('Calculating interestTillToday locally for multi-EMI:', {
                        principal,
                        interestRatePerDay,
                        exhaustedDays,
                        interestTillToday,
                        baseDate: loanData.last_extension_date 
                          ? `last_extension_date (${loanData.last_extension_date.split('T')[0]}) + 1 day`
                          : loanData.processed_at 
                            ? `processed_at (${loanData.processed_at.split('T')[0]})`
                            : 'disbursed_at'
                      });
                    } else {
                      console.log('Using interestTillToday from API (with last_extension_date priority) for multi-EMI:', interestTillToday);
                    }
                    
                    // Pre-close fee: 10% of principal + 18% GST (NO post service fee for pre-close)
                    const preCloseFeePercent = 10;
                    const preCloseFee = Math.round((principal * preCloseFeePercent) / 100 * 100) / 100;
                    const preCloseFeeGST = Math.round(preCloseFee * 0.18 * 100) / 100;
                    
                    const precloseAmount = principal + interestTillToday + preCloseFee + preCloseFeeGST;
                    
                    // Calculate total of all remaining EMIs to show interest saved
                    let totalEmiAmount = 0;
                    let interestSaved = 0;
                    if (repaymentSchedule && repaymentSchedule.length > 0) {
                      totalEmiAmount = repaymentSchedule.reduce((sum: number, emi: any) => sum + (emi.instalment_amount || 0), 0);
                      interestSaved = Math.round((totalEmiAmount - precloseAmount) * 100) / 100;
                    }
                    
                    // Debug logging
                    console.log('Preclose Calculation:', {
                      principal,
                      interestRatePerDay,
                      exhaustedDays,
                      interestTillToday,
                      preCloseFee,
                      preCloseFeeGST,
                      precloseAmount,
                      totalEmiAmount,
                      interestSaved
                    });
                    
                    // Get due date for display (first EMI due date)
                    const dueDate = firstEmiDueDate;
                  let dueDateObj = null;
                  let daysRemaining = 0;
                  let isOverdue = false;
                  let isDueToday = false;
                  
                  if (dueDate) {
                    dueDateObj = new Date(dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDateObj.setHours(0, 0, 0, 0);
                    daysRemaining = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    isOverdue = daysRemaining < 0;
                    isDueToday = daysRemaining === 0;
                  }
                  
                  // Calculate last available date (DPD = -6 means 6 days before due date)
                  // So last available date = due_date - 6 days
                  let lastAvailableDate = null;
                  let lastAvailableDateFormatted = '';
                  if (dueDateObj) {
                    lastAvailableDate = new Date(dueDateObj);
                    lastAvailableDate.setDate(lastAvailableDate.getDate() - 6);
                    lastAvailableDateFormatted = lastAvailableDate.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    });
                  }

                  return (
                    <>
                      {/* Single Row Layout: Amount | Due Date | Button */}
                      <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200">
                        {/* Column 1: Preclose Amount with message */}
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">
                            {interestSaved > 0 ? (
                              <>Now & save interest: {formatCurrency(interestSaved)}</>
                            ) : (
                              <>Now & save interest: {formatCurrency(precloseAmount)}</>
                            )}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500 italic">
                            (Available till {lastAvailableDateFormatted || 'N/A'} only)
                          </p>
                          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
                            {formatCurrency(precloseAmount)}
                          </h2>
                        </div>
                        
                        {/* Column 2: Due Date */}
                        {dueDateObj && (
                          <div className="flex-1">
                            <p className="text-xs sm:text-sm text-gray-600 mb-1 font-medium">Due Date</p>
                            <p className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                              {dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className={`text-xs text-gray-600 ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-600' : ''}`}>
                              {isOverdue ? `Overdue by ${Math.abs(daysRemaining)} days` : isDueToday ? 'Due Today!' : `Due in ${daysRemaining} days`}
                            </p>
                          </div>
                        )}
                        
                        {/* Column 3: Repay Now Button */}
                        <div className="flex-shrink-0 w-full md:w-auto">
                          <Button
                            className="w-full md:w-auto h-12 text-base font-semibold shadow-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all"
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
                        </div>
                      </div>
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            </>
          );
        })()}

        {/* Multi-EMI Plan - EMI Schedule Section (Always show if schedule exists) */}
        {shouldShowMultiEmi && !isLoanCleared && (() => {
          console.log('🔍 Rendering EMI Schedule - shouldShowMultiEmi:', shouldShowMultiEmi, 'repaymentSchedule.length:', repaymentSchedule.length, 'repaymentSchedule:', repaymentSchedule);
          if (repaymentSchedule.length === 0) {
            console.log('⚠️ Repayment schedule is empty, not rendering EMI Schedule section');
            return null;
          }
          
          // Check if extension button should be shown (only for first EMI, D-5 to D+15)
          const firstEmi = repaymentSchedule[0];
          let canShowExtension = false;
          if (firstEmi && firstEmi.due_date) {
            const firstEmiDate = new Date(firstEmi.due_date);
            firstEmiDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // DPD = today - due_date (negative means before due date, positive means after)
            const dpd = Math.ceil((today.getTime() - firstEmiDate.getTime()) / (1000 * 60 * 60 * 24));
            // Show extension button if DPD is between -5 and +15 (5 days before to 15 days after)
            const isWithinDpdWindow = dpd >= -5 && dpd <= 15;
            // Also check backend eligibility - only show if backend says it's eligible
            // OR if there's a pending_payment extension (user needs to check payment status)
            // If eligibility data is not loaded yet, don't show the button
            const isBackendEligible = extensionEligibility 
              ? (extensionEligibility.can_extend === true || extensionEligibility.is_eligible === true)
              : false;
            const hasPendingPayment = extensionEligibility?.has_pending_request && 
                                     extensionEligibility?.pending_extension?.status === 'pending_payment';
            canShowExtension = isWithinDpdWindow && (isBackendEligible || hasPendingPayment);
            console.log('🔍 Extension Button Check (Multi-EMI):', {
              firstEmiDueDate: firstEmi.due_date,
              dpd,
              isWithinDpdWindow,
              isBackendEligible,
              hasPendingPayment,
              canShowExtension,
              extensionEligibility,
              extensionStatus: loanData?.extension_status,
              extensionCount: loanData?.extension_count,
              today: today.toISOString().split('T')[0],
              dueDate: firstEmiDate.toISOString().split('T')[0]
            });
            
            // If button is not showing, log the reason
            if (!canShowExtension) {
              console.warn('⚠️ Extension button NOT showing because:');
              if (!isWithinDpdWindow) {
                console.warn('  - Outside DPD window (current DPD:', dpd, ', need -5 to +15)');
              }
              if (!isBackendEligible && !hasPendingPayment) {
                console.warn('  - Backend eligibility check failed');
                console.warn('  - extensionEligibility:', extensionEligibility);
              }
            }
          }
          
          return (
            <>
            <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-blue-100">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">EMI Schedule</h3>
                    {shortLoanId !== 'N/A' && (
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        Loan ID: {shortLoanId}
                      </span>
                    )}
                  </div>
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
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="text-base sm:text-lg font-bold text-gray-900">
                                  {getOrdinal(emi.instalment_no || index + 1)} EMI
                                </span>
                                {emi.status === 'paid' ? (
                                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Paid
                                  </span>
                                ) : (
                                  <>
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
                                    {!isOverdue && !isDueToday && (
                                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                        Pending
                                      </span>
                                    )}
                                  </>
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
                              {emi.status !== 'paid' ? (
                              <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={async () => {
                                  const loadingToastId = toast.loading('Creating payment order...');
                                  
                                  try {
                                    const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                    const amount = emi.instalment_amount || 0;
                                    
                                    // Determine payment type based on EMI number (1st, 2nd, 3rd, 4th)
                                    const emiNumber = emi.instalment_no || index + 1;
                                    let paymentType = 'emi_1st';
                                    if (emiNumber === 1) paymentType = 'emi_1st';
                                    else if (emiNumber === 2) paymentType = 'emi_2nd';
                                    else if (emiNumber === 3) paymentType = 'emi_3rd';
                                    else if (emiNumber === 4) paymentType = 'emi_4th';

                                    if (!loanId || !amount) {
                                      toast.dismiss(loadingToastId);
                                      toast.error('Unable to process payment');
                                      return;
                                    }

                                    const response = await apiService.createPaymentOrder(loanId, amount, paymentType);
                                    
                                    toast.dismiss(loadingToastId);

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
                                  } finally {
                                    toast.dismiss();
                                  }
                                }}
                              >
                                Pay Now
                              </Button>
                              ) : (
                                <span className="text-sm font-semibold text-green-600 bg-green-100 px-3 py-2 rounded">
                                  Paid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
            </Card>
            
            {/* Extension Button for Multi-EMI (only for first EMI) */}
            {canShowExtension && (
              <Card className="bg-white shadow-xl rounded-2xl overflow-hidden mb-6 border-2 border-orange-100">
                <CardContent className="p-4 sm:p-6">
                  {extensionEligibility?.has_pending_request ? (
                    extensionEligibility?.pending_extension?.status === 'pending_payment' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                          <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                          <span className="text-orange-700 font-semibold">
                            Extension Payment Pending
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full h-12 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold"
                          onClick={async () => {
                            const extensionId = extensionEligibility?.pending_extension?.id;
                            if (extensionId) {
                              try {
                                toast.loading('Checking payment status...');
                                const response = await apiService.checkExtensionPayment(extensionId);
                                toast.dismiss();
                                
                                if (response.success) {
                                  if (response.data.status === 'completed') {
                                    toast.success(response.data.message || 'Extension payment verified and extension approved successfully!');
                                    // Refresh loan data and eligibility
                                    const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                    if (loanId) {
                                      await fetchLoanData(loanId);
                                      const eligibilityResponse = await apiService.checkExtensionEligibility(loanId);
                                      if (eligibilityResponse.success) {
                                        setExtensionEligibility(eligibilityResponse.data);
                                      }
                                    }
                                  } else if (response.data.status === 'pending') {
                                    // Check if we should use SDK, redirect, or create new order
                                    if (response.data.paymentSessionId || response.data.useSdk) {
                                      // Use Cashfree SDK (same as EMI payments)
                                      toast.success('Opening payment gateway...');
                                      try {
                                        const isProduction = response.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                           !response.data.checkoutUrl?.includes('payments-test');
                                        
                                        const cashfree = await load({ 
                                          mode: isProduction ? "production" : "sandbox"
                                        });

                                        if (cashfree && response.data.paymentSessionId) {
                                          cashfree.checkout({
                                            paymentSessionId: response.data.paymentSessionId
                                          });
                                        } else {
                                          throw new Error('Failed to load Cashfree SDK');
                                        }
                                      } catch (sdkError: any) {
                                        console.error('Cashfree SDK error:', sdkError);
                                        toast.error('Failed to open payment gateway. Please try again.');
                                        
                                        // Fallback to URL redirect if SDK fails
                                        if (response.data.checkoutUrl) {
                                          window.location.href = response.data.checkoutUrl;
                                        } else {
                                          toast.error('No payment session available');
                                        }
                                      }
                                    } else if (response.data.redirectToPayment && response.data.checkoutUrl) {
                                      // Fallback: Redirect to payment gateway
                                      window.location.href = response.data.checkoutUrl;
                                    } else if (response.data.create_new_order) {
                                      // Create new payment order
                                      toast.info('Creating new payment order...');
                                      const extensionId = extensionEligibility?.pending_extension?.id;
                                      if (extensionId) {
                                        try {
                                          const paymentResponse = await apiService.createExtensionPayment(extensionId);
                                          if (paymentResponse.success && paymentResponse.data.paymentSessionId) {
                                            // Use SDK
                                            const isProduction = paymentResponse.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                               !paymentResponse.data.checkoutUrl?.includes('payments-test');
                                            const cashfree = await load({ 
                                              mode: isProduction ? "production" : "sandbox"
                                            });
                                            if (cashfree) {
                                              cashfree.checkout({
                                                paymentSessionId: paymentResponse.data.paymentSessionId
                                              });
                                            }
                                          } else if (paymentResponse.success && paymentResponse.data.checkoutUrl) {
                                            window.location.href = paymentResponse.data.checkoutUrl;
                                          } else {
                                            toast.error('Failed to create payment order. Please try again.');
                                          }
                                        } catch (error: any) {
                                          toast.error(error.message || 'Failed to create payment order');
                                        }
                                      }
                                    } else {
                                      toast.info(response.data.message || 'Your payment transaction is still pending. Please wait for payment confirmation.');
                                    }
                                  } else if (response.data.status === 'expired' || response.data.status === 'failed') {
                                    // Order expired or failed, create new one
                                    if (response.data.create_new_order) {
                                      toast.info('Payment order expired. Creating new payment order...');
                                      const extensionId = extensionEligibility?.pending_extension?.id;
                                      if (extensionId) {
                                        try {
                                          const paymentResponse = await apiService.createExtensionPayment(extensionId);
                                          if (paymentResponse.success && paymentResponse.data.paymentSessionId) {
                                            // Use SDK
                                            const isProduction = paymentResponse.data.checkoutUrl?.includes('payments.cashfree.com') && 
                                                               !paymentResponse.data.checkoutUrl?.includes('payments-test');
                                            const cashfree = await load({ 
                                              mode: isProduction ? "production" : "sandbox"
                                            });
                                            if (cashfree) {
                                              cashfree.checkout({
                                                paymentSessionId: paymentResponse.data.paymentSessionId
                                              });
                                            }
                                          } else if (paymentResponse.success && paymentResponse.data.checkoutUrl) {
                                            window.location.href = paymentResponse.data.checkoutUrl;
                                          } else {
                                            toast.error('Failed to create payment order. Please try again.');
                                          }
                                        } catch (error: any) {
                                          toast.error(error.message || 'Failed to create payment order');
                                        }
                                      }
                                    } else {
                                      toast.error(response.data.message || 'Payment transaction has failed. Please create a new payment order.');
                                    }
                                  } else {
                                    toast.info(response.data.message || 'Payment status checked.');
                                  }
                                } else {
                                  // If payment order not found, show extension letter again
                                  if (response.message?.includes('Payment order not found')) {
                                    toast.info('No payment found. Opening extension letter to retry payment...');
                                    const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                    if (loanId) {
                                      setShowExtensionModal(true);
                                    }
                                  } else {
                                    toast.error(response.message || 'Failed to check payment status');
                                  }
                                }
                              } catch (error: any) {
                                console.error('Error checking extension payment:', error);
                                // If payment order not found, show extension letter again
                                if (error.message?.includes('Payment order not found')) {
                                  toast.info('No payment found. Opening extension letter to retry payment...');
                                  const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                                  if (loanId) {
                                    setShowExtensionModal(true);
                                  }
                                } else {
                                  toast.error(error.message || 'Failed to check payment status');
                                }
                              }
                            }
                          }}
                        >
                          <Loader2 className="w-4 h-4 mr-2" />
                          Check Payment Status
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          Your payment transaction is being processed. Click to check the latest status.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                        <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                        <span className="text-orange-700 font-semibold">
                          Extension Request Pending Approval
                        </span>
                      </div>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-12 border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold"
                      onClick={async () => {
                        try {
                          const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
                          if (!loanId) {
                            toast.error('Unable to process extension request');
                            return;
                          }

                          toast.loading('Requesting loan extension...');

                          const response = await apiService.requestLoanExtension(loanId, 'Requesting loan tenure extension');

                          if (response.success) {
                            toast.success('Extension request submitted successfully!');
                            // Show modal with agreement
                            setShowExtensionModal(true);
                            // Refresh loan data and eligibility to show updated extension status
                            await fetchLoanData(loanId);
                            const eligibilityResponse = await apiService.checkExtensionEligibility(loanId);
                            if (eligibilityResponse.success && eligibilityResponse.data) {
                              setExtensionEligibility(eligibilityResponse.data);
                            }
                          } else {
                            toast.error(response.message || 'Failed to submit extension request');
                          }
                        } catch (error: any) {
                          console.error('Extension request error:', error);
                          toast.error(error.message || 'Failed to submit extension request');
                        }
                      }}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Extend Loan Tenure
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            </>
          );
        })()}

        {/* Loan Progression Stages - Percentage-Based */}
        <Card className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          <CardContent className="p-3 sm:p-5">
            <div className="space-y-3">
              {(() => {
                // Define stages to show: current, next, and ultimate (premium)
                const stagesToShow: Array<{index: number, percentage: number, limit: number, isPremium: boolean}> = [];
                
                // Always show current stage
                stagesToShow.push({
                  index: currentStageIndex,
                  percentage: currentPercentage,
                  limit: currentStageLimit,
                  isPremium: false
                });
                
                // Show next stage if it exists and is not premium
                if (nextPercentage && nextStageLimit && !shouldShowPremium) {
                  stagesToShow.push({
                    index: nextStageIndex,
                    percentage: nextPercentage,
                    limit: nextStageLimit,
                    isPremium: false
                  });
                }
                
                // Always show premium/ultimate stage
                stagesToShow.push({
                  index: percentageMultipliers.length, // Use length as index for premium
                  percentage: 0, // Premium doesn't have a percentage
                  limit: premiumLimit,
                  isPremium: true
                });
                
                return stagesToShow.map((stage, idx) => {
                  const isCurrentStage = idx === 0;
                  const isUltimateStage = stage.isPremium;
                  const isNextStage = idx === 1 && !isUltimateStage;
                  const stageNumber = stage.index + 1; // Display as 1-based
                
                return (
                  <div key={`${stage.index}-${stage.isPremium}`} className="relative">
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
                                {isUltimateStage ? 'Stage Premium' : `Stage ${String(stageNumber).padStart(2, '0')}`}
                              </span>
                              {isCurrentStage && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                                  <Sparkles className="w-3 h-3" />
                                  You are Here
                                </span>
                              )}
                              {!isCurrentStage && !isUltimateStage && (
                                <span className="text-[10px] font-medium text-gray-500">Next</span>
                              )}
                              {isUltimateStage && !isCurrentStage && (
                                <span className="text-[10px] font-medium text-gray-500">Ultimate</span>
                              )}
                            </div>
                            <div className={`text-xl sm:text-2xl font-bold mb-0.5 ${
                              isCurrentStage ? 'text-white' : 'text-gray-900'
                            }`}>
                              {formatCurrency(stage.limit).replace('.00', '')}
                            </div>
                            <div className={`text-xs ${
                              isCurrentStage ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {isCurrentStage 
                                ? `Your Current limit (${stage.percentage}% of salary)` 
                                : isUltimateStage 
                                ? 'Your Ultimate limit (Premium)' 
                                : isNextStage
                                ? `Your Next limit (${stage.percentage}% of salary)`
                                : 'Your Ultimate limit'}
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
                    {!isUltimateStage && (
                      <div className="flex justify-start pl-8 sm:pl-10 py-2">
                        <div className="w-0.5 h-4 bg-gray-300"></div>
                      </div>
                    )}
                  </div>
                );
                });
              })()}
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

      {/* Extension Letter Modal */}
      {loanData && (
        <ExtensionLetterModal
          loanId={loanData.id || parseInt(searchParams.get('applicationId') || '0')}
          isOpen={showExtensionModal}
          onClose={() => {
            setShowExtensionModal(false);
            // Refresh loan data and eligibility after modal closes
            const loanId = loanData.id || parseInt(searchParams.get('applicationId') || '0');
            if (loanId) {
              fetchLoanData(loanId);
            }
          }}
          onAccept={async () => {
            // This is now handled inside ExtensionLetterModal
            // The modal will handle the extension request and payment flow
            // This function is kept for compatibility but won't be called
            // as the modal handles everything internally
          }}
        />
      )}
    </div>
  );
};
