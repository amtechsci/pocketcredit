import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, IndianRupee, FileText, Shield, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
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
  agreeToTerms: boolean;
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
  const [formData, setFormData] = useState<LoanApplicationData>({
    desiredAmount: 0,
    purpose: '',
    agreeToTerms: false
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (field: keyof LoanApplicationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.desiredAmount || formData.desiredAmount <= 0) {
      toast.error('Please enter a valid loan amount');
      return;
    }

    if (!formData.purpose) {
      toast.error('Please select a loan purpose');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the Terms of Use and Privacy Policy');
      return;
    }

    // Redirect to plan selection instead of submitting directly
    navigate('/loan-application/select-plan', {
      state: {
        loanAmount: formData.desiredAmount,
        loanPurpose: formData.purpose
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
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
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
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
                Desired Loan Amount (₹) *
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="desiredAmount"
                  type="number"
                  value={formData.desiredAmount || ''}
                  onChange={(e) => handleInputChange('desiredAmount', parseInt(e.target.value) || 0)}
                  placeholder="Enter loan amount"
                  className="pl-10 h-12 text-base"
                  min="1000"
                  step="1000"
                  required
                />
              </div>
              <p className="text-sm text-gray-500">
                Minimum amount: ₹1,000
              </p>
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

            {/* Disclaimer Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong>Final tenure, loan amount, interest rate, and processing fee</strong> are subject to the credit risk assessment of the partnered NBFC.
                  </p>
                  <p className="mb-2">
                    Details of this assessment will be fully disclosed in the <strong>Key Facts Statement (KFS)</strong> and loan agreement prior to loan disbursement.
                  </p>
                  <p>
                    Please note that <strong>"pocketcredit"</strong> is just a facilitator/platform between borrowers & NBFC.
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
