import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  DollarSign, 
  CheckCircle,
  FileText,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const LoanApplicationConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loanAmount, loanPurpose, selectedPlan, calculation } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (!loanAmount || !selectedPlan || !calculation) {
    // Redirect back if required data is missing
    React.useEffect(() => {
      toast.error('Invalid loan application data');
      navigate('/loan-application');
    }, []);
    return null;
  }

  const handleSubmit = async () => {
    if (!agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      // Create complete snapshot of plan details at time of application
      const response = await apiService.createLoanApplication({
        desired_amount: loanAmount,
        purpose: loanPurpose,
        loan_plan_id: selectedPlan.id,
        plan_code: selectedPlan.plan_code,
        // Save complete calculation snapshot (so old loans don't change if plans change)
        plan_snapshot: {
          plan_name: selectedPlan.plan_name,
          plan_type: selectedPlan.plan_type,
          repayment_days: selectedPlan.repayment_days,
          emi_frequency: selectedPlan.emi_frequency,
          emi_count: selectedPlan.emi_count
        },
        processing_fee: calculation.processing_fee,
        processing_fee_percent: calculation.breakdown.processing_fee_percent,
        total_interest: calculation.interest,
        interest_percent_per_day: parseFloat(calculation.breakdown.interest_rate.match(/[\d.]+/)?.[0] || '0'),
        total_repayable: calculation.total_repayable,
        late_fee_structure: calculation.late_fee_structure,
        emi_schedule: calculation.emi_details?.schedule || null
      });

      if (response.status === 'success' || response.success === true) {
        toast.success('Loan application submitted successfully!');
        navigate(`/loan-application/steps?applicationId=${response.data.application_id}`);
      } else {
        toast.error(response.message || 'Failed to submit loan application');
      }
    } catch (error: any) {
      console.error('Loan application error:', error);
      toast.error(error.message || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/loan-application/select-plan', { state: { loanAmount, loanPurpose } })}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Change Plan
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900">Review Your Loan Application</h1>
          <p className="text-gray-600 mt-1">Please review the details below before submitting</p>
        </div>

        {/* Loan Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Loan Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Loan Amount</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(loanAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Purpose</p>
                <p className="text-lg font-semibold text-gray-900">{loanPurpose}</p>
              </div>
            </div>

            {/* Selected Plan */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Selected Plan</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{selectedPlan.plan_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedPlan.plan_type === 'single'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedPlan.plan_type === 'single' ? 'Single Payment' : 'Multi-EMI'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{selectedPlan.description}</p>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Principal Amount</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculation.breakdown.principal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Processing Fee ({calculation.breakdown.processing_fee_percent}%)
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculation.breakdown.processing_fee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Interest ({calculation.breakdown.interest_rate})</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculation.breakdown.interest)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Repayable</span>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(calculation.breakdown.total)}</span>
                </div>
              </div>
            </div>

            {/* Repayment Schedule */}
            {selectedPlan.plan_type === 'multi_emi' && calculation.emi_details?.schedule ? (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  EMI Schedule
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {calculation.emi_details.schedule.map((emi: any) => (
                    <div key={emi.emi_number} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        EMI {emi.emi_number} - {new Date(emi.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-semibold text-gray-900">{formatCurrency(emi.emi_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Repayment Date</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    Full repayment of <strong className="text-blue-600">{formatCurrency(calculation.total_repayable)}</strong> is due on{' '}
                    <strong>{new Date(calculation.emi_details.repayment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terms Agreement */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="agree" className="text-sm text-gray-700">
                I have read and agree to the{' '}
                <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                  Terms and Conditions
                </a>
                ,{' '}
                <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
                , and understand the repayment terms including late payment charges.
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/loan-application/select-plan', { state: { loanAmount, loanPurpose } })}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !agreed}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Important Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Loan approval is subject to verification of your documents</li>
                <li>Disbursement will be made to your registered bank account</li>
                <li>Ensure timely repayment to avoid late charges</li>
                <li>Your credit score may be affected by repayment behavior</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanApplicationConfirmation;

