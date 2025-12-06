import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
// import { Checkbox } from '../ui/checkbox';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface LoanApplicationData {
  desiredAmount: number;
  purpose: string;
  selectedPlanId: number | null;
  agreeToTerms: boolean;
}

interface LoanPlan {
  id: number;
  plan_name: string;
  plan_code: string;
  total_duration_days: number;
}

interface PlanCalculation {
  plan: {
    id: number;
    name: string;
    duration_days: number;
  };
  loan_amount: number;
  processing_fee: number;
  interest: number;
  total_repayable: number;
  emi_details: {
    repayment_date?: string;
    schedule?: any[];
  };
  breakdown: {
    processing_fee_percent: number;
    interest_percent_per_day: number;
  };
}

const loanPurposes = [
  'Personal',
  'Business',
  'Education',
  'Medical',
  'Home Improvement',
  'Debt Consolidation',
  'Wedding',
  'Travel',
  'Other'
];

export function SimplifiedLoanApplicationPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [canApply, setCanApply] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [userLoanLimit, setUserLoanLimit] = useState<number>(100000); // Default 1L
  const [formData, setFormData] = useState<LoanApplicationData>({
    desiredAmount: 0,
    purpose: '',
    selectedPlanId: null,
    agreeToTerms: false
  });
  
  // Plan selection states
  const [availablePlans, setAvailablePlans] = useState<LoanPlan[]>([]);
  const [calculation, setCalculation] = useState<PlanCalculation | null>(null);

  // Check if user can apply for a new loan and fetch loan limit
  useEffect(() => {
    const checkLoanEligibility = async () => {
      try {
        const response = await apiService.getDashboardSummary();
        if (response.data && (response.data as any).loan_status) {
          const loanStatus = (response.data as any).loan_status;
          setCanApply(loanStatus.can_apply);
          
          // Get user's loan limit
          const limit = (response.data as any).user?.loan_limit || (response.data as any).summary?.available_credit || 100000;
          setUserLoanLimit(limit);
          console.log('User loan limit:', limit);
          
          if (!loanStatus.can_apply) {
            if (loanStatus.has_pending_application) {
              toast.error('You already have a pending loan application. Please complete it first.');
            } else if (loanStatus.active_loans_count > 0) {
              toast.error('You already have an active loan. Please complete it before applying for a new one.');
            }
            // Redirect to dashboard after showing message
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        }
      } catch (error) {
        console.error('Error checking loan eligibility:', error);
      } finally {
        setCheckingEligibility(false);
      }
    };

    if (isAuthenticated) {
      checkLoanEligibility();
    }
  }, [isAuthenticated, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  // Load available loan plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await apiService.getAvailableLoanPlans();
        if (response && (response as any).success && (response as any).data) {
          const plans = (response as any).data;
          setAvailablePlans(plans);
          
          // Auto-select if only one plan is available
          if (plans.length === 1) {
            console.log('Only one plan available, auto-selecting:', plans[0].plan_name);
            handleInputChange('selectedPlanId', plans[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading plans:', error);
        toast.error('Failed to load loan plans');
      }
    };

    if (isAuthenticated && !checkingEligibility) {
      loadPlans();
    }
  }, [isAuthenticated, checkingEligibility]);

  // Calculate plan when amount and plan are selected
  useEffect(() => {
    if (formData.desiredAmount >= 1000 && formData.selectedPlanId) {
      calculateLoanPlan();
    } else {
      setCalculation(null);
    }
  }, [formData.desiredAmount, formData.selectedPlanId]);

  const calculateLoanPlan = async () => {
    if (!formData.selectedPlanId || !formData.desiredAmount) return;

    try {
      const response = await apiService.calculateLoanPlan(
        formData.desiredAmount,
        formData.selectedPlanId
      );

      if (response && (response as any).success && (response as any).data) {
        setCalculation((response as any).data);
      }
    } catch (error) {
      console.error('Error calculating plan:', error);
      // Silently fail - calculation is just for confirmation page
    }
  };

  const handleInputChange = (field: keyof LoanApplicationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Generate loan amount options based on user's limit
  const generateLoanAmountOptions = (limit: number): number[] => {
    if (limit < 5000) {
      // For very small limits, just return the limit
      return [limit];
    }

    // Calculate base increment (limit / 5)
    const baseIncrement = limit / 5;
    
    // Round to nearest nice number from common increments
    const niceNumbers = [1000, 2000, 4000, 5000, 10000, 20000, 50000, 100000];
    const roundToNiceNumber = (num: number): number => {
      // Find the closest nice number
      let closest = niceNumbers[0];
      let minDiff = Math.abs(num - closest);
      
      for (const nice of niceNumbers) {
        const diff = Math.abs(num - nice);
        if (diff < minDiff) {
          minDiff = diff;
          closest = nice;
        }
      }
      
      // Special cases: prefer 5000 over 4000 when close, and 4000 over 2000 when close
      if (num >= 4500 && num <= 5500) return 5000;
      if (num >= 3500 && num <= 4500) return 4000;
      
      return closest;
    };

    const increment = roundToNiceNumber(baseIncrement);
    
    // Generate 4 options with the increment
    const options: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const amount = increment * i;
      if (amount < limit) {
        options.push(amount);
      }
    }
    
    // Always add the max limit as the last option
    options.push(limit);
    
    // Ensure we have at least 2 options and at most 5
    if (options.length < 2) {
      return [Math.min(increment, limit), limit];
    }
    
    return options.slice(0, 5);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.desiredAmount || formData.desiredAmount <= 0) {
      toast.error('Please enter a valid loan amount');
      return;
    }

    if (formData.desiredAmount < 1000) {
      toast.error('Minimum loan amount is ₹1,000');
      return;
    }

    if (formData.desiredAmount > userLoanLimit) {
      toast.error(`Loan amount cannot exceed your limit of ₹${userLoanLimit.toLocaleString()}`);
      return;
    }

    if (!formData.purpose) {
      toast.error('Please select a loan purpose');
      return;
    }

    if (!formData.selectedPlanId) {
      toast.error('Please select a repayment plan');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the Terms of Use and Privacy Policy');
      return;
    }

    // Submit loan application directly
    setLoading(true);
    try {
      // Prepare fees breakdown from calculation if available
      const calcData = calculation as any; // Type assertion for dynamic fees
      const feesBreakdown = calcData?.breakdown?.fees || [];
      const totalDeductFromDisbursal = calcData?.breakdown?.total_deduct_from_disbursal || 0;
      const totalAddToTotal = calcData?.breakdown?.total_add_to_total || 0;
      const disbursalAmount = calcData?.breakdown?.disbursal_amount || formData.desiredAmount;

      const response = await apiService.applyForLoan({
        loan_amount: formData.desiredAmount,
        tenure_months: Math.ceil((calcData?.plan?.duration_days || 15) / 30),
        loan_purpose: formData.purpose,
        plan_id: formData.selectedPlanId,
        plan_code: calcData?.plan?.code || null,
        plan_snapshot: calcData?.plan ? {
          plan_name: calcData.plan.name,
          plan_type: calcData.plan.type,
          duration_days: calcData.plan.duration_days
        } : null,
        // Legacy processing fee fields (for backward compatibility)
        processing_fee: calcData?.processing_fee || 0,
        processing_fee_percent: calcData?.breakdown?.processing_fee_percent || 0,
        // Dynamic fees
        fees_breakdown: feesBreakdown.length > 0 ? feesBreakdown : null,
        total_deduct_from_disbursal: totalDeductFromDisbursal,
        total_add_to_total: totalAddToTotal,
        disbursal_amount: disbursalAmount,
        // Interest and repayable
        total_interest: calcData?.interest || 0,
        interest_percent_per_day: calcData?.breakdown?.interest_percent_per_day || 0.001,
        total_repayable: calcData?.total_repayable || formData.desiredAmount,
        // EMI schedule if available
        emi_schedule: calcData?.emi_details?.schedule || null,
        late_fee_structure: calcData?.late_fee_structure || null
      } as any);

      if (response && (response as any).success && (response as any).data) {
        toast.success('Loan application submitted successfully!');
        
        const responseData = (response as any).data;
        const applicationId = responseData.application?.id || responseData.application_id;
        
        // Navigate directly to KYC verification (skip confirmation page)
        navigate('/loan-application/kyc-verification', {
          state: {
            applicationId: applicationId,
            calculation: calculation
          }
        });
      } else {
        toast.error((response as any).message || 'Failed to submit loan application');
      }
    } catch (error: any) {
      console.error('Loan application error:', error);
      toast.error(error.response?.data?.message || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || checkingEligibility) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {checkingEligibility ? 'Checking loan eligibility...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Block access if user can't apply
  if (!canApply) {
    return null; // Will be redirected by useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 p-0 h-auto text-gray-600 hover:text-gray-900"
          ><ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Apply for Loan</h1>
            <p className="text-gray-600">
              Complete your loan application in just a few simple steps
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Loan Amount */}
            <div className="space-y-2">
              <Label htmlFor="desiredAmount" className="text-base font-medium">
                Loan Amount (₹) *
                <span className="text-sm text-blue-600 ml-2 font-normal">
                  (Max: ₹{userLoanLimit.toLocaleString()})
                </span>
              </Label>
              <Select 
                value={formData.desiredAmount && formData.desiredAmount > 0 ? formData.desiredAmount.toString() : undefined} 
                onValueChange={(value) => handleInputChange('desiredAmount', parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select amount" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {generateLoanAmountOptions(userLoanLimit).map((amount) => (
                    <SelectItem key={amount} value={amount.toString()} className="cursor-pointer">
                      ₹{amount.toLocaleString('en-IN')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.desiredAmount && (
                <p className="text-xs text-gray-500 mt-1">Click to select a loan amount from the options</p>
              )}
            </div>

            {/* Loan Purpose */}
            <div className="space-y-2">
              <Label htmlFor="purpose" className="text-base font-medium">
                Loan Purpose *
              </Label>
              <Select 
                value={formData.purpose} 
                onValueChange={(value) => handleInputChange('purpose', value)}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select loan purpose" />
                </SelectTrigger>
                <SelectContent>
                  {loanPurposes.map(purpose => (
                    <SelectItem key={purpose} value={purpose}>
                      {purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Repayment Plan Selection - Only show if multiple plans available */}
            {availablePlans.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="plan" className="text-base font-medium">
                Choose Repayment Plan *
              </Label>
              <Select 
                value={formData.selectedPlanId?.toString() || ''} 
                onValueChange={(value) => handleInputChange('selectedPlanId', parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select repayment plan" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.plan_name} - {plan.total_duration_days} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {/* Disclaimer Section */}
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start gap-3">
                {/* <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" /> */}
                <div className="flex-1 text-sm text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong>Final tenure, loan amount, interest rate, and processing fee</strong> are subject to the credit risk assessment of the partnered NBFC.
                  </p>
                  <p className="mb-2">
                    Details of this assessment will be fully disclosed in the <strong>Key Facts Statement (KFS)</strong> and loan agreement prior to loan disbursement.
                  </p>
                </div>
              </div>
            </div>

            {/* Consent Checkbox */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="text-sm text-gray-700 leading-relaxed">
                  <label htmlFor="agreeToTerms" className="cursor-pointer">
                    I agree to pocketcredit.in{' '}
                    <a 
                      href="/terms-conditions" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                    >
                      Terms of Use
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}&{' '}
                    <a 
                      href="/privacy-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                    >
                      Privacy Policy
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={loading || !formData.agreeToTerms}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Submit Loan Application
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Your application will be reviewed by our partnered NBFCs. 
            You'll receive updates via SMS and email.
          </p>
        </div>
      </div>
    </div>
  );
}
