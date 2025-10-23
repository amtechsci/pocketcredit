import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';

interface EligibilityCheckerProps {
  onApply: () => void;
}

export function EligibilityChecker({ onApply }: EligibilityCheckerProps) {
  const [formData, setFormData] = useState({
    monthlyIncome: '',
    employmentType: '',
    loanAmount: '',
  });
  const [result, setResult] = useState<{
    eligible: boolean;
    preApprovedAmount?: number;
    interestRate?: number;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (result) setResult(null); // Reset result when form changes
  };

  const checkEligibility = async () => {
    if (!formData.monthlyIncome || !formData.employmentType || !formData.loanAmount) {
      return;
    }

    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const income = parseInt(formData.monthlyIncome);
    const requestedAmount = parseInt(formData.loanAmount);
    
    // Simple eligibility logic
    const minIncome = formData.employmentType === 'salaried' ? 25000 : 30000;
    const maxLoanMultiplier = formData.employmentType === 'salaried' ? 20 : 15;
    const maxEligibleAmount = income * maxLoanMultiplier;
    
    if (income >= minIncome) {
      const approvedAmount = Math.min(requestedAmount, maxEligibleAmount, 1000000); // Max 10 lakhs
      const interestRate = formData.employmentType === 'salaried' ? 14 : 16;
      
      setResult({
        eligible: true,
        preApprovedAmount: approvedAmount,
        interestRate: interestRate,
        message: `Congratulations! You're eligible for a loan up to ₹${approvedAmount.toLocaleString()}.`
      });
    } else {
      setResult({
        eligible: false,
        message: `Based on your income, you don't meet our minimum eligibility criteria. Minimum income required: ₹${minIncome.toLocaleString()}/month.`
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h3 className="mobile-text-lg sm:text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>
          Check Your Loan Eligibility
        </h3>
        <p className="text-gray-600 mobile-text-sm sm:text-base">Get instant pre-approval in seconds</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="income">Monthly Income (₹)</Label>
          <Input
            id="income"
            type="number"
            placeholder="50,000"
            value={formData.monthlyIncome}
            onChange={(e) => handleInputChange('monthlyIncome', e.target.value)}
            className="input-mobile touch-manipulation"
          />
        </div>

        <div className="space-y-2">
          <Label>Employment Type</Label>
          <Select value={formData.employmentType} onValueChange={(value) => handleInputChange('employmentType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select employment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salaried">Salaried</SelectItem>
              <SelectItem value="self-employed">Self-Employed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="amount">Desired Loan Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="5,00,000"
            value={formData.loanAmount}
            onChange={(e) => handleInputChange('loanAmount', e.target.value)}
          />
        </div>
      </div>

      {result && (
        <Card className={`border-2 ${result.eligible ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {result.eligible ? (
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${result.eligible ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </p>
                {result.eligible && result.preApprovedAmount && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <div>
                      <p className="text-sm text-green-700">Pre-approved Amount</p>
                      <p className="text-lg font-semibold text-green-800">
                        ₹{result.preApprovedAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={checkEligibility}
          disabled={loading || !formData.monthlyIncome || !formData.employmentType || !formData.loanAmount}
          style={{ backgroundColor: '#0052FF' }}
          className="flex-1"
        >
          {loading ? 'Checking...' : 'Check Eligibility'}
        </Button>
        
        {result?.eligible && (
          <Button
            onClick={onApply}
            style={{ backgroundColor: '#00C49A' }}
            className="flex-1 text-white hover:opacity-90"
          >
            Apply Now
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        *This is a preliminary check. Final approval depends on detailed verification.
      </p>
    </div>
  );
}