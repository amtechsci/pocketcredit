import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Lock, ChevronRight, IndianRupee, User, FileText, Shield, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';

interface LoanApplicationData {
  // Step 1: Eligibility Check
  panNumber: string;
  monthlyIncome: number;
  employmentType: string;
  desiredLoanAmount: number;
  loanPurpose: string;
  
  // Step 2: Loan Amount Selection
  selectedLoanAmount: number;
  reasonForLoan: string;
  
  // Step 3: Personal Details
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  
  // Step 4: Address Details
  currentAddress: string;
  city: string;
  state: string;
  pincode: string;
  
  // Step 5: Bank Details
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  
  // Agreement
  agreeToTerms: boolean;
}

const steps = [
  { id: 'eligibility', title: 'Eligibility', icon: Check },
  { id: 'amount', title: 'Loan Amount', icon: DollarSign },
  { id: 'personal', title: 'Personal Details', icon: User },
  { id: 'address', title: 'Address', icon: FileText },
  { id: 'bank', title: 'Bank Details', icon: Shield },
  { id: 'agreement', title: 'Agreement', icon: FileText }
];

const employmentTypes = [
  'Salaried',
  'Self-Employed',
  'Business Owner',
  'Freelancer',
  'Retired'
];

const loanPurposes = [
  'Personal Expenses',
  'Home Renovation',
  'Medical Emergency',
  'Education',
  'Wedding',
  'Debt Consolidation',
  'Business Investment',
  'Other'
];

const genderOptions = [
  'Male',
  'Female',
  'Other'
];

const maritalStatusOptions = [
  'Single',
  'Married',
  'Divorced',
  'Widowed'
];

export function LoanApplicationPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<LoanApplicationData>({
    panNumber: '',
    monthlyIncome: 50000,
    employmentType: '',
    desiredLoanAmount: 500000,
    loanPurpose: '',
    selectedLoanAmount: 320000,
    reasonForLoan: 'Personal',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    currentAddress: '',
    city: '',
    state: '',
    pincode: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    agreeToTerms: false
  });

  const [loading, setLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);

  // Calculate progress
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleInputChange = (field: keyof LoanApplicationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSliderChange = (value: number[]) => {
    setFormData(prev => ({ ...prev, selectedLoanAmount: value[0] }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const checkEligibility = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setEligibilityResult({
        eligible: true,
        maxLoanAmount: 1000000,
        interestRate: 12.5,
        tenure: 24,
        emi: 47000
      });
      setLoading(false);
      nextStep();
    }, 2000);
  };

  const submitApplication = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard', { 
        state: { 
          message: 'Loan application submitted successfully!',
          type: 'success'
        }
      });
    }, 2000);
  };

  const renderStepIndicator = () => (
    <div className="w-full px-4 mb-6 sm:mb-8">
      <div className="max-w-4xl mx-auto">
        {/* Simple progress indicator - just show current step and progress */}
        <div className="text-center">
          <div className="text-sm sm:text-base text-gray-600 mb-2">
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            {Math.round(progress)}% Complete
          </div>
        </div>
      </div>
    </div>
  );

  const renderEligibilityStep = () => (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Check className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          <h2 className="text-lg sm:text-2xl font-semibold">Step 1: Eligibility Check</h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="panNumber" className="text-sm sm:text-base">PAN Number *</Label>
            <Input
              id="panNumber"
              value={formData.panNumber}
              onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="monthlyIncome" className="text-sm sm:text-base">Monthly Income (₹) *</Label>
            <Input
              id="monthlyIncome"
              type="number"
              value={formData.monthlyIncome}
              onChange={(e) => handleInputChange('monthlyIncome', parseInt(e.target.value) || 0)}
              placeholder="50,000"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="employmentType" className="text-sm sm:text-base">Employment Type *</Label>
            <Select value={formData.employmentType} onValueChange={(value) => handleInputChange('employmentType', value)}>
              <SelectTrigger className="mt-1 h-10 sm:h-11 text-base">
                <SelectValue placeholder="Select employment type" />
              </SelectTrigger>
              <SelectContent>
                {employmentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="desiredLoanAmount" className="text-sm sm:text-base">Desired Loan Amount (₹) *</Label>
            <Input
              id="desiredLoanAmount"
              type="number"
              value={formData.desiredLoanAmount}
              onChange={(e) => handleInputChange('desiredLoanAmount', parseInt(e.target.value) || 0)}
              placeholder="5,00,000"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="loanPurpose" className="text-sm sm:text-base">Loan Purpose *</Label>
            <Select value={formData.loanPurpose} onValueChange={(value) => handleInputChange('loanPurpose', value)}>
              <SelectTrigger className="mt-1 h-10 sm:h-11 text-base">
                <SelectValue placeholder="Select loan purpose" />
              </SelectTrigger>
              <SelectContent>
                {loanPurposes.map(purpose => (
                  <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={checkEligibility} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-10 sm:h-11 text-base"
            >
              {loading ? 'Checking...' : 'Check Eligibility'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderLoanAmountStep = () => (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">Loan Amount</h2>

        <div className="space-y-6 sm:space-y-8">
          {/* Loan Amount Slider */}
          <div>
            <Label className="text-base sm:text-lg font-medium">Select Loan Amount</Label>
            <div className="mt-4">
              <Slider
                value={[formData.selectedLoanAmount]}
                onValueChange={handleSliderChange}
                max={1000000}
                min={50000}
                step={10000}
                className="w-full"
              />
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mt-2">
                <span>₹50K</span>
                <span>₹10L</span>
              </div>
            </div>
            <div className="text-center mt-4">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                ₹{formData.selectedLoanAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Reason for Loan */}
          <div>
            <Label className="text-base sm:text-lg font-medium">Reason for loan</Label>
            <Select value={formData.reasonForLoan} onValueChange={(value) => handleInputChange('reasonForLoan', value)}>
              <SelectTrigger className="mt-2 h-10 sm:h-11 text-base">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Medical">Medical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loan Options */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Available Loan Options</h3>
            
            {/* 2 EMI Loan - Locked */}
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 sm:p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <h4 className="font-semibold text-sm sm:text-base">2 EMI Loan</h4>
                  <Badge variant="destructive" className="text-xs">Locked</Badge>
                </div>
                <div className="text-green-600 font-semibold text-base sm:text-lg">
                  ₹12,00,000
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Tenure: 65 days
                </div>
              </div>
              <div className="text-center ml-2">
                <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mx-auto mb-1" />
                <div className="text-xs text-red-600 text-center leading-tight">
                  increase creditlab score to unlock
                </div>
              </div>
            </div>

            {/* 3 EMI Loan - Locked */}
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 sm:p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <h4 className="font-semibold text-sm sm:text-base">3 EMI Loan</h4>
                  <Badge variant="destructive" className="text-xs">Locked</Badge>
                </div>
                <div className="text-green-600 font-semibold text-base sm:text-lg">
                  ₹16,00,000
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Tenure: 95 days
                </div>
              </div>
              <div className="text-center ml-2">
                <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mx-auto mb-1" />
                <div className="text-xs text-red-600 text-center leading-tight">
                  increase creditlab score to unlock
                </div>
              </div>
            </div>

            {/* Standard Loan - Available */}
            <div className="border border-green-200 bg-green-50 rounded-lg p-3 sm:p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <h4 className="font-semibold text-sm sm:text-base">Standard Personal Loan</h4>
                  <Badge className="bg-green-100 text-green-800 text-xs">Available</Badge>
                </div>
                <div className="text-green-600 font-semibold text-base sm:text-lg">
                  ₹{formData.selectedLoanAmount.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Tenure: 12-24 months
                </div>
              </div>
              <div className="text-center ml-2">
                <Check className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mx-auto mb-1" />
                <div className="text-xs text-green-600 text-center">
                  Eligible
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimers */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2 text-xs sm:text-sm text-gray-600">
            <p>• Final tenure, loan amount, interest rate, and processing fee are subject to the credit risk assessment of the partnered NBFC.</p>
            <p>• Details of this assessment will be fully disclosed in the Key Facts Statement (KFS) and loan agreement prior to loan disbursement.</p>
            <p>• Please note that "Creditlab" is just a facilitator/platform between borrowers & NBFC.</p>
          </div>

          {/* Agreement */}
          <div className="flex items-start gap-3">
            <Checkbox 
              id="agreeToTerms" 
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked)}
              className="mt-1"
            />
            <div className="text-xs sm:text-sm">
              <Label htmlFor="agreeToTerms" className="cursor-pointer">
                I agree to creditlab.in{' '}
                <a href="#" className="text-blue-600 underline">Terms of use & privacy policy</a>
              </Label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={nextStep}
              disabled={!formData.agreeToTerms}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-10 sm:h-11 text-base"
            >
              Apply
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderPersonalDetailsStep = () => (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">Personal Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <Label htmlFor="firstName" className="text-sm sm:text-base">First Name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="lastName" className="text-sm sm:text-base">Last Name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-sm sm:text-base">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="dateOfBirth" className="text-sm sm:text-base">Date of Birth *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="gender" className="text-sm sm:text-base">Gender *</Label>
            <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
              <SelectTrigger className="mt-1 h-10 sm:h-11 text-base">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {genderOptions.map(gender => (
                  <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="maritalStatus" className="text-sm sm:text-base">Marital Status *</Label>
            <Select value={formData.maritalStatus} onValueChange={(value) => handleInputChange('maritalStatus', value)}>
              <SelectTrigger className="mt-1 h-10 sm:h-11 text-base">
                <SelectValue placeholder="Select marital status" />
              </SelectTrigger>
              <SelectContent>
                {maritalStatusOptions.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
          <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto h-10 sm:h-11 text-base">
            Previous
          </Button>
          <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-10 sm:h-11 text-base">
            Next
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderAddressStep = () => (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">Address Details</h2>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="currentAddress" className="text-sm sm:text-base">Current Address *</Label>
            <Input
              id="currentAddress"
              value={formData.currentAddress}
              onChange={(e) => handleInputChange('currentAddress', e.target.value)}
              placeholder="Enter your current address"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <Label htmlFor="city" className="text-sm sm:text-base">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className="mt-1 h-10 sm:h-11 text-base"
              />
            </div>

            <div>
              <Label htmlFor="state" className="text-sm sm:text-base">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className="mt-1 h-10 sm:h-11 text-base"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pincode" className="text-sm sm:text-base">Pincode *</Label>
            <Input
              id="pincode"
              value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)}
              placeholder="Enter pincode"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
          <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto h-10 sm:h-11 text-base">
            Previous
          </Button>
          <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-10 sm:h-11 text-base">
            Next
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderBankDetailsStep = () => (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">Bank Details</h2>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="bankName" className="text-sm sm:text-base">Bank Name *</Label>
            <Input
              id="bankName"
              value={formData.bankName}
              onChange={(e) => handleInputChange('bankName', e.target.value)}
              placeholder="Enter bank name"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="accountNumber" className="text-sm sm:text-base">Account Number *</Label>
            <Input
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange('accountNumber', e.target.value)}
              placeholder="Enter account number"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="ifscCode" className="text-sm sm:text-base">IFSC Code *</Label>
            <Input
              id="ifscCode"
              value={formData.ifscCode}
              onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
              placeholder="Enter IFSC code"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>

          <div>
            <Label htmlFor="accountHolderName" className="text-sm sm:text-base">Account Holder Name *</Label>
            <Input
              id="accountHolderName"
              value={formData.accountHolderName}
              onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
              placeholder="Enter account holder name"
              className="mt-1 h-10 sm:h-11 text-base"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
          <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto h-10 sm:h-11 text-base">
            Previous
          </Button>
          <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-10 sm:h-11 text-base">
            Next
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderAgreementStep = () => (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0">
      <Card className="p-4 sm:p-8">
        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6">Final Agreement</h2>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-blue-50 rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Loan Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm sm:text-base">
                <span>Loan Amount:</span>
                <span className="font-semibold">₹{formData.selectedLoanAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span>Interest Rate:</span>
                <span className="font-semibold">12.5% p.a.</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span>Tenure:</span>
                <span className="font-semibold">24 months</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span>EMI:</span>
                <span className="font-semibold">₹{Math.round(formData.selectedLoanAmount * 0.09).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Terms & Conditions</h3>
            <div className="text-xs sm:text-sm text-gray-600 space-y-2">
              <p>• I confirm that all information provided is true and accurate.</p>
              <p>• I understand that the final loan approval is subject to credit assessment.</p>
              <p>• I agree to the terms and conditions of the loan agreement.</p>
              <p>• I authorize the bank to verify my information and credit history.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox 
              id="finalAgreement" 
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked)}
              className="mt-1"
            />
            <div className="text-xs sm:text-sm">
              <Label htmlFor="finalAgreement" className="cursor-pointer">
                I agree to all the terms and conditions and confirm that all information provided is accurate.
              </Label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
          <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto h-10 sm:h-11 text-base">
            Previous
          </Button>
          <Button 
            onClick={submitApplication}
            disabled={!formData.agreeToTerms || loading}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-10 sm:h-11 text-base"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderEligibilityStep();
      case 1:
        return renderLoanAmountStep();
      case 2:
        return renderPersonalDetailsStep();
      case 3:
        return renderAddressStep();
      case 4:
        return renderBankDetailsStep();
      case 5:
        return renderAgreementStep();
      default:
        return renderEligibilityStep();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={user?.name || 'User'} />
      
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-semibold">Apply for Loan</h1>
            <p className="text-sm sm:text-base text-gray-600">Complete your loan application in a few simple steps</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-2">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>


        {/* Current Step Content */}
        {renderCurrentStep()}
      </div>
    </div>
  );
}
