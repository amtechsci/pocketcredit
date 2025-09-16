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

      if (response.status === 'success') {
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

    // Validation
    if (!referenceDetails.name1 || !referenceDetails.phone1 || !referenceDetails.relation1 ||
        !referenceDetails.name2 || !referenceDetails.phone2 || !referenceDetails.relation2 ||
        !referenceDetails.name3 || !referenceDetails.phone3 || !referenceDetails.relation3) {
      toast.error('Please fill in all reference fields');
      return;
    }

    // Validate phone numbers
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(referenceDetails.phone1) || !phoneRegex.test(referenceDetails.phone2) || !phoneRegex.test(referenceDetails.phone3)) {
      toast.error('Please enter valid 10-digit mobile numbers starting with 6-9');
      return;
    }

    // Check for duplicate phone numbers
    const phones = [referenceDetails.phone1, referenceDetails.phone2, referenceDetails.phone3];
    const uniquePhones = [...new Set(phones)];
    if (uniquePhones.length !== phones.length) {
      toast.error('All reference phone numbers must be different');
      return;
    }

    if (!referenceDetails.confirmReferences) {
      toast.error('Please confirm the reference details');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.saveReferenceDetails({
        application_id: parseInt(applicationId),
        references: [
          {
            name: referenceDetails.name1,
            phone: referenceDetails.phone1,
            relation: referenceDetails.relation1
          },
          {
            name: referenceDetails.name2,
            phone: referenceDetails.phone2,
            relation: referenceDetails.relation2
          },
          {
            name: referenceDetails.name3,
            phone: referenceDetails.phone3,
            relation: referenceDetails.relation3
          }
        ]
      });

      if (response.status === 'success') {
        toast.success('Reference details saved successfully!');
        // Refresh loan application to get updated step
        await fetchLoanApplication(applicationId);
      } else {
        toast.error(response.message || 'Failed to save reference details');
      }
    } catch (error: any) {
      console.error('Reference details error:', error);
      toast.error(error.message || 'Failed to save reference details');
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
        <p className="text-gray-600">Please provide 3 reference contact numbers (family/friends for quick verification)</p>
      </div>

      <div className="p-6">
        <form onSubmit={handleReferenceDetailsSubmit} className="space-y-6">
        {/* Reference 1 */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">1</span>
            </div>
            <h4 className="text-base font-semibold text-gray-900">Reference 1</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name1" className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                id="name1"
                type="text"
                value={referenceDetails.name1}
                onChange={(e) => handleReferenceDetailsChange('name1', e.target.value)}
                placeholder="Enter full name"
                className="h-10 bg-white"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone1" className="text-sm font-medium text-gray-700">Mobile Number *</Label>
              <div className="flex">
                <div className="flex items-center px-3 bg-white border border-gray-300 border-r-0 rounded-l-md">
                  <span className="text-gray-700 font-medium text-sm">+91</span>
                </div>
                <Input
                  id="phone1"
                  type="tel"
                  value={referenceDetails.phone1}
                  onChange={(e) => handleReferenceDetailsChange('phone1', e.target.value)}
                  placeholder="Enter mobile number"
                  className="h-10 rounded-l-none bg-white"
                  maxLength={10}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="relation1" className="text-sm font-medium text-gray-700">Relation *</Label>
              <Select
                value={referenceDetails.relation1}
                onValueChange={(value) => handleReferenceDetailsChange('relation1', value)}
              >
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Select relation" />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Reference 2 */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">2</span>
            </div>
            <h4 className="text-base font-semibold text-gray-900">Reference 2</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name2" className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                id="name2"
                type="text"
                value={referenceDetails.name2}
                onChange={(e) => handleReferenceDetailsChange('name2', e.target.value)}
                placeholder="Enter full name"
                className="h-10 bg-white"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone2" className="text-sm font-medium text-gray-700">Mobile Number *</Label>
              <div className="flex">
                <div className="flex items-center px-3 bg-white border border-gray-300 border-r-0 rounded-l-md">
                  <span className="text-gray-700 font-medium text-sm">+91</span>
                </div>
                <Input
                  id="phone2"
                  type="tel"
                  value={referenceDetails.phone2}
                  onChange={(e) => handleReferenceDetailsChange('phone2', e.target.value)}
                  placeholder="Enter mobile number"
                  className="h-10 rounded-l-none bg-white"
                  maxLength={10}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="relation2" className="text-sm font-medium text-gray-700">Relation *</Label>
              <Select
                value={referenceDetails.relation2}
                onValueChange={(value) => handleReferenceDetailsChange('relation2', value)}
              >
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Select relation" />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Reference 3 */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">3</span>
            </div>
            <h4 className="text-base font-semibold text-gray-900">Reference 3</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name3" className="text-sm font-medium text-gray-700">Name *</Label>
              <Input
                id="name3"
                type="text"
                value={referenceDetails.name3}
                onChange={(e) => handleReferenceDetailsChange('name3', e.target.value)}
                placeholder="Enter full name"
                className="h-10 bg-white"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone3" className="text-sm font-medium text-gray-700">Mobile Number *</Label>
              <div className="flex">
                <div className="flex items-center px-3 bg-white border border-gray-300 border-r-0 rounded-l-md">
                  <span className="text-gray-700 font-medium text-sm">+91</span>
                </div>
                <Input
                  id="phone3"
                  type="tel"
                  value={referenceDetails.phone3}
                  onChange={(e) => handleReferenceDetailsChange('phone3', e.target.value)}
                  placeholder="Enter mobile number"
                  className="h-10 rounded-l-none bg-white"
                  maxLength={10}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="relation3" className="text-sm font-medium text-gray-700">Relation *</Label>
              <Select
                value={referenceDetails.relation3}
                onValueChange={(value) => handleReferenceDetailsChange('relation3', value)}
              >
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Select relation" />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

          {/* Confirmation Checkbox */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="confirmReferences"
                checked={referenceDetails.confirmReferences}
                onChange={(e) => handleReferenceDetailsChange('confirmReferences', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="text-sm text-gray-700 leading-relaxed">
                <label htmlFor="confirmReferences" className="cursor-pointer">
                  I confirm that the reference contact numbers provided are correct and belong to people 
                  who can verify my identity. I understand that these references may be contacted for 
                  verification purposes.
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <Button
              type="submit"
              disabled={loading || !referenceDetails.confirmReferences}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving References...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Save Reference Details
                </>
              )}
            </Button>
          </div>
        </form>
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
