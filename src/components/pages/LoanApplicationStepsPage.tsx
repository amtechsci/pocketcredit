import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Building2, Users, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

const RELATION_OPTIONS = [
  'Family',
  'Friend',
  'Colleague',
  'Relative',
  'Neighbor'
];

interface LoanApplication {
  id: number;
  application_number: string;
  loan_amount: number;
  loan_purpose: string;
  status: string;
  current_step: string;
  created_at: string;
}

interface BankDetailsData {
  accountNumber: string;
  ifscCode: string;
  confirmDetails: boolean;
}

interface ReferenceData {
  name1: string;
  phone1: string;
  relation1: string;
  name2: string;
  phone2: string;
  relation2: string;
  name3: string;
  phone3: string;
  relation3: string;
  confirmReferences: boolean;
}

export function LoanApplicationStepsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [loanApplication, setLoanApplication] = useState<LoanApplication | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  
  // Bank details form
  const [bankDetails, setBankDetails] = useState<BankDetailsData>({
    accountNumber: '',
    ifscCode: '',
    confirmDetails: false
  });

  // Reference details form
  const [referenceDetails, setReferenceDetails] = useState<ReferenceData>({
    name1: '',
    phone1: '',
    relation1: 'Family',
    name2: '',
    phone2: '',
    relation2: 'Family',
    name3: '',
    phone3: '',
    relation3: 'Friend',
    confirmReferences: false
  });

  // Get application ID from URL params
  useEffect(() => {
    console.log('LoanApplicationStepsPage: useEffect triggered');
    console.log('Search params:', searchParams.toString());
    const appId = searchParams.get('applicationId');
    console.log('Application ID from URL:', appId);
    if (appId) {
      setApplicationId(appId);
      fetchLoanApplication(appId);
    } else {
      console.log('No application ID found, redirecting to /application');
      navigate('/application');
    }
  }, [searchParams, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  const fetchLoanApplication = async (appId: string) => {
    try {
      console.log('Fetching loan application:', appId);
      const response = await apiService.getLoanApplication(appId);
      console.log('Loan application response:', response);
      console.log('Response status:', response.status);
      console.log('Response success:', response.success);
      console.log('Response data:', response.data);
      
      if (response.status === 'success' || response.success === true) {
        console.log('Setting loan application:', response.data);
        console.log('Setting current step:', response.data.current_step);
        setLoanApplication(response.data);
        const step = response.data.current_step || 'bank_details';
        console.log('Final step to set:', step);
        setCurrentStep(step);
      } else {
        console.log('Failed to fetch loan application:', response.message);
      }
    } catch (error) {
      console.error('Error fetching loan application:', error);
      toast.error('Failed to load loan application');
    }
  };

  const handleBankDetailsChange = (field: keyof BankDetailsData, value: any) => {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleReferenceDetailsChange = (field: keyof ReferenceData, value: any) => {
    setReferenceDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleBankDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    // Validation
    if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!bankDetails.confirmDetails) {
      toast.error('Please confirm the bank details');
      return;
    }

    // Basic IFSC code validation
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankDetails.ifscCode.toUpperCase())) {
      toast.error('Please enter a valid IFSC code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.saveBankDetails({
        application_id: parseInt(applicationId),
        account_number: bankDetails.accountNumber,
        ifsc_code: bankDetails.ifscCode
      });

      if (response.success === true) {
        toast.success('Bank details saved successfully!');
        // Refresh loan application to get updated step
        await fetchLoanApplication(applicationId);
      } else {
        toast.error(response.message || 'Failed to save bank details');
      }
    } catch (error: any) {
      console.error('Bank details error:', error);
      toast.error(error.message || 'Failed to save bank details');
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    // Check if user has references, if not redirect to manage them
    try {
      const response = await apiService.getUserReferences();
      
      if (!response.success || !response.data || response.data.length === 0) {
        toast.info('Please add your references first');
        navigate('/user-references');
        return;
      }
      
      // If user has references, mark this step as completed
      setLoading(true);
      
      // For now, we'll just mark the step as completed since references are user-level
      // In a real implementation, you might want to create a loan_references entry
      // that references the user's existing references
      toast.success('Reference details verified!');
      
      // Refresh loan application to get updated step
      await fetchLoanApplication(applicationId);
      
    } catch (error: any) {
      console.error('Error checking user references:', error);
      toast.error('Failed to verify reference details');
    } finally {
      setLoading(false);
    }
  };


  const renderBankDetailsForm = () => {
    console.log('Rendering bank details form');
    return (
      <Card className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Bank Details</h2>
          <p className="text-gray-600">Please provide your bank account details for loan disbursement</p>
        </div>

      <form onSubmit={handleBankDetailsSubmit} className="space-y-6">
        {/* Account Number */}
        <div className="space-y-2">
          <Label htmlFor="accountNumber" className="text-base font-medium">
            Account Number *
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              id="accountNumber"
              type="text"
              value={bankDetails.accountNumber}
              onChange={(e) => handleBankDetailsChange('accountNumber', e.target.value)}
              placeholder="Enter your account number"
              className="pl-10 h-12 text-base"
              required
            />
          </div>
        </div>

        {/* IFSC Code */}
        <div className="space-y-2">
          <Label htmlFor="ifscCode" className="text-base font-medium">
            IFSC Code *
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              id="ifscCode"
              type="text"
              value={bankDetails.ifscCode}
              onChange={(e) => handleBankDetailsChange('ifscCode', e.target.value.toUpperCase())}
              placeholder="Enter IFSC code (e.g., SBIN0001234)"
              className="pl-10 h-12 text-base uppercase"
              maxLength={11}
              required
            />
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="confirmDetails"
              checked={bankDetails.confirmDetails}
              onChange={(e) => handleBankDetailsChange('confirmDetails', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="text-sm text-gray-700 leading-relaxed">
              <label htmlFor="confirmDetails" className="cursor-pointer">
                I hereby confirm that the bank details are correct and that the account belongs only to me. 
                The loan amount, if approved, will be transferred to this account only. If the above information 
                proves to be incorrect, Creditlab and its Lending partners will not be held liable and the loan 
                will be deemed to have been disbursed to me and I will be responsible for repayment.
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={loading || !bankDetails.confirmDetails}
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving Bank Details...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 mr-2" />
                Save Bank Details
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
    );
  };

  const renderReferenceDetailsForm = () => (
    <Card className="shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Reference Details</h2>
        <p className="text-gray-600">Your personal references are required for loan verification</p>
      </div>

      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Your References</h3>
          <p className="text-gray-600 mb-6">
            You need to add up to 3 personal references for loan verification. 
            These references will be used for all your loan applications.
          </p>
          
          <div className="space-y-4">
            <Button
              onClick={() => navigate('/user-references')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Manage References
            </Button>
            
            <p className="text-sm text-gray-500">
              After adding your references, come back here to continue with your loan application.
            </p>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 mt-6">
          <Button
            onClick={handleReferenceDetailsSubmit}
            disabled={loading}
            className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Verifying...
              </>
            ) : (
              'Continue with Loan Application'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderCompletedStep = () => (
    <Card className="p-6 sm:p-8 text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Application Complete!</h2>
        <p className="text-gray-600">
          Your loan application has been submitted successfully. We'll review your application and get back to you soon.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Application Number</p>
          <p className="font-semibold text-gray-900">{loanApplication?.application_number}</p>
        </div>
        
        <Button
          onClick={() => navigate('/dashboard')}
          className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
        >
          Go to Dashboard
        </Button>
      </div>
    </Card>
  );

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Loan Application</h1>
            <p className="text-gray-600">
              Complete your loan application in a few simple steps
            </p>
          </div>
        </div>


        {/* Dynamic Content Based on Current Step */}
        {(() => {
          console.log('Current step for rendering:', currentStep);
          return null;
        })()}
        {currentStep === 'bank_details' && renderBankDetailsForm()}
        {currentStep === 'references' && renderReferenceDetailsForm()}
        {currentStep === 'completed' && renderCompletedStep()}
        {!currentStep && (
          <Card className="p-6 sm:p-8 text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan application details...</p>
          </Card>
        )}

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Your information is secure and will only be used for loan processing.
          </p>
        </div>
      </div>
    </div>
  );
}
