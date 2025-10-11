import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  Clock,
  Shield,
  AlertCircle,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

interface LoanPlan {
  id: number;
  plan_name: string;
  plan_code: string;
  plan_type: 'single' | 'multi_emi';
  repayment_days: number | null;
  emi_frequency: string | null;
  emi_count: number | null;
  total_duration_days: number;
  description: string | null;
}

interface PlanCalculation {
  plan: {
    id: number;
    name: string;
    code: string;
    type: string;
    duration_days: number;
  };
  loan_amount: number;
  processing_fee: number;
  interest: number;
  total_repayable: number;
  emi_details: any;
  late_fee_structure: any[];
  breakdown: {
    principal: number;
    processing_fee: number;
    processing_fee_percent: number;
    interest: number;
    interest_rate: string;
    total: number;
  };
}

export const LoanPlanSelection: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loanAmount, loanPurpose } = location.state || {};

  const [plans, setPlans] = useState<LoanPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<LoanPlan | null>(null);
  const [calculatedPlans, setCalculatedPlans] = useState<Map<number, PlanCalculation>>(new Map());
  const [calculating, setCalculating] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!loanAmount) {
      toast.error('Please select a loan amount first');
      navigate('/loan-application');
      return;
    }

    loadAvailablePlans();
  }, []);

  const loadAvailablePlans = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAvailableLoanPlans();
      
      console.log('Loan plans response:', response);
      
      if (response.success && response.data) {
        console.log('Plans loaded:', response.data.length);
        console.log('Debug info:', (response as any).debug);
        
        setPlans(response.data);
        
        // Auto-calculate the first plan
        if (response.data.length > 0) {
          calculatePlan(response.data[0]);
        } else {
          // Show debug info if no plans available
          const debug = (response as any).debug;
          if (debug) {
            console.warn('No eligible plans. User info:', debug.user_info);
            console.warn('Total plans in system:', debug.total_plans);
            toast.error(`No plans available. Your employment type: ${debug.user_info.employment_type || 'Not set'}. Please complete your profile.`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load loan plans');
    } finally {
      setLoading(false);
    }
  };

  const calculatePlan = async (plan: LoanPlan) => {
    if (calculatedPlans.has(plan.id)) return; // Already calculated

    setCalculating(prev => new Set(prev).add(plan.id));

    try {
      const response = await apiService.calculateLoanPlan(loanAmount, plan.id);
      
      if (response.success && response.data) {
        setCalculatedPlans(prev => new Map(prev).set(plan.id, response.data));
      }
    } catch (error: any) {
      console.error('Error calculating plan:', error);
      toast.error(`Failed to calculate ${plan.plan_name}`);
    } finally {
      setCalculating(prev => {
        const next = new Set(prev);
        next.delete(plan.id);
        return next;
      });
    }
  };

  const handlePlanSelect = (plan: LoanPlan) => {
    const calculation = calculatedPlans.get(plan.id);
    
    if (!calculation) {
      toast.error('Please wait for plan calculation to complete');
      return;
    }

    setSelectedPlan(plan);
    
    // Navigate to loan application confirmation with plan details
    navigate('/loan-application/confirm', {
      state: {
        loanAmount,
        loanPurpose,
        selectedPlan: plan,
        calculation
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getPlanIcon = (type: string) => {
    return type === 'single' ? <Clock className="w-5 h-5" /> : <Calendar className="w-5 h-5" />;
  };

  const getPlanBadgeColor = (type: string) => {
    return type === 'single' 
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading loan plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/loan-application')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Loan Application
          </button>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Repayment Plan</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Loan Amount: <strong className="text-gray-900">{formatCurrency(loanAmount)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Purpose: <strong className="text-gray-900">{loanPurpose}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Plans List */}
        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No loan plans available at this time.</p>
              <p className="text-sm text-gray-500 mt-2">Please contact support for assistance.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {plans.map((plan, index) => {
              const calculation = calculatedPlans.get(plan.id);
              const isCalculating = calculating.has(plan.id);
              const isRecommended = index === 0; // First plan is recommended

              // Calculate plan on hover if not already calculated
              const handleMouseEnter = () => {
                if (!calculation && !isCalculating) {
                  calculatePlan(plan);
                }
              };

              return (
                <Card 
                  key={plan.id} 
                  className={`hover:shadow-lg transition-shadow cursor-pointer ${
                    isRecommended ? 'border-2 border-blue-500' : ''
                  }`}
                  onMouseEnter={handleMouseEnter}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${plan.plan_type === 'single' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                          {getPlanIcon(plan.plan_type)}
                        </div>
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            {plan.plan_name}
                            {isRecommended && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal">
                                RECOMMENDED
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {plan.description || 'Flexible repayment option'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getPlanBadgeColor(plan.plan_type)}`}>
                        {plan.plan_type === 'single' ? 'Single Payment' : 'Multi-EMI'}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isCalculating ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Calculating...</span>
                      </div>
                    ) : calculation ? (
                      <div className="space-y-4">
                        {/* Plan Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Duration</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {plan.plan_type === 'single' 
                                ? `${plan.repayment_days} days`
                                : `${plan.emi_count} months`
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Processing Fee</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(calculation.processing_fee)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Interest</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(calculation.interest)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Repayable</p>
                            <p className="text-lg font-bold text-blue-600">
                              {formatCurrency(calculation.total_repayable)}
                            </p>
                          </div>
                        </div>

                        {/* EMI Schedule or Repayment Date */}
                        {plan.plan_type === 'multi_emi' && calculation.emi_details?.schedule ? (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              EMI Schedule
                            </p>
                            <div className="space-y-2">
                              {calculation.emi_details.schedule.map((emi: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">
                                    EMI {emi.emi_number} - {new Date(emi.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    {formatCurrency(emi.emi_amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Repayment Date
                            </p>
                            <p className="text-sm text-gray-600">
                              Pay <strong className="text-blue-600">{formatCurrency(calculation.total_repayable)}</strong> by{' '}
                              <strong>{new Date(calculation.emi_details.repayment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                            </p>
                          </div>
                        )}

                        {/* Late Fee Info */}
                        {calculation.late_fee_structure && calculation.late_fee_structure.length > 0 && (
                          <div className="border-t border-gray-200 pt-4">
                            <details className="group">
                              <summary className="cursor-pointer text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Late Payment Charges
                                <span className="text-xs text-gray-500 ml-auto">(Click to expand)</span>
                              </summary>
                              <div className="mt-3 text-xs text-gray-600 space-y-1 ml-6">
                                {calculation.late_fee_structure.map((fee: any, idx: number) => (
                                  <div key={idx}>
                                    • {fee.tier_name}: {fee.fee_value}% {fee.days_overdue_end ? `(Days ${fee.days_overdue_start}-${fee.days_overdue_end})` : `(Day ${fee.days_overdue_start}+)`}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Select Plan Button */}
                        <div className="pt-2">
                          <Button
                            onClick={() => handlePlanSelect(plan)}
                            className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                          >
                            Select This Plan
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <button
                          onClick={() => calculatePlan(plan)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Click to view plan details
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">How to Choose:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Single Payment Plans:</strong> Best for short-term needs. Repay everything in one go.</li>
                <li><strong>Multi-EMI Plans:</strong> Spread payments over months. Lower monthly burden.</li>
                <li>Interest and fees are based on your member tier.</li>
                <li>Late payment charges apply if you miss due dates.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanPlanSelection;

