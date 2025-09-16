import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Upload, FileText, Shield, CreditCard, User, MapPin, Phone, Mail, Calendar, Building, Smartphone, Camera, PenTool, Zap, Banknote } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService, EligibilityCheck } from '../services/api';

interface ApplicationFlowProps {
  onNavigate?: (page: Page) => void;
}

interface ApplicationData {
  // Step 1 data
  panNumber: string;
  monthlyIncome: string;
  employmentType: string;
  loanAmount: string;
  loanPurpose: string;
  
  // Step 2 data
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  companyName: string;
  designation: string;
  workExperience: string;
  documents: {
    panCard: File | null;
    aadhaarCard: File | null;
    salarySlips: File | null;
    bankStatements: File | null;
  };
}

export function ApplicationFlow({ onNavigate }: ApplicationFlowProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [eligibilityData, setEligibilityData] = useState<EligibilityCheck | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
  }, [isAuthenticated, navigate]);

  const [applicationData, setApplicationData] = useState<ApplicationData>({
    panNumber: '',
    monthlyIncome: '',
    employmentType: '',
    loanAmount: '',
    loanPurpose: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    companyName: '',
    designation: '',
    workExperience: '',
    documents: {
      panCard: null,
      aadhaarCard: null,
      salarySlips: null,
      bankStatements: null,
    }
  });

  const [finalOffer, setFinalOffer] = useState({
    approvedAmount: 0,
    interestRate: 0,
    tenure: 0,
    emi: 0,
    processingFee: 0,
  });

  const updateApplicationData = (field: string, value: any) => {
    setApplicationData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (docType: string, file: File | null) => {
    setApplicationData(prev => ({
      ...prev,
      documents: { ...prev.documents, [docType]: file }
    }));
  };

  const validateStep1 = () => {
    return applicationData.panNumber && 
           applicationData.monthlyIncome && 
           applicationData.employmentType && 
           applicationData.loanAmount &&
           applicationData.loanPurpose;
  };

  const validateStep2 = () => {
    return applicationData.firstName && 
           applicationData.lastName && 
           applicationData.email && 
           applicationData.mobile &&
           applicationData.dateOfBirth &&
           applicationData.address &&
           applicationData.city &&
           applicationData.pincode &&
           applicationData.documents.panCard &&
           applicationData.documents.aadhaarCard;
  };

  const processStep1 = async () => {
    if (!validateStep1()) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate preliminary offer
    const income = parseInt(applicationData.monthlyIncome);
    const requestedAmount = parseInt(applicationData.loanAmount);
    const maxEligible = income * (applicationData.employmentType === 'salaried' ? 20 : 15);
    const approvedAmount = Math.min(requestedAmount, maxEligible, 1000000);
    const interestRate = applicationData.employmentType === 'salaried' ? 14 : 16;
    
    toast.success('Congratulations! You are pre-approved.');
    setLoading(false);
    setCurrentStep(2);
  };

  const processStep2 = async () => {
    if (!validateStep2()) {
      toast.error('Please complete all required fields and upload documents');
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate final offer
    const income = parseInt(applicationData.monthlyIncome);
    const requestedAmount = parseInt(applicationData.loanAmount);
    const maxEligible = income * (applicationData.employmentType === 'salaried' ? 20 : 15);
    const approvedAmount = Math.min(requestedAmount, maxEligible, 1000000);
    const interestRate = applicationData.employmentType === 'salaried' ? 14.5 : 16.5;
    const tenure = 24; // Default 2 years
    const monthlyRate = interestRate / 12 / 100;
    const emi = (approvedAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
    const processingFee = Math.min(approvedAmount * 0.02, 5999);

    setFinalOffer({
      approvedAmount,
      interestRate,
      tenure,
      emi: Math.round(emi),
      processingFee: Math.round(processingFee),
    });

    setLoading(false);
    setCurrentStep(3);
    toast.success('Your final loan offer is ready!');
  };

  const acceptOffer = () => {
    setCurrentStep(4);
    toast.success('Offer accepted! Proceeding to agreement.');
  };

  const completeApplication = async () => {
    setLoading(true);
    try {
      const loanData = {
        loan_amount: parseFloat(applicationData.loanAmount),
        loan_purpose: applicationData.loanPurpose,
        loan_tenure_days: 30, // Default to 30 days
      };

      const response = await apiService.applyForLoan(loanData);
      
      if (response.success) {
        toast.success('Loan application submitted successfully!');
        navigate('/dashboard');
      } else {
        toast.error(response.message || 'Failed to submit loan application');
      }
    } catch (error) {
      console.error('Loan application error:', error);
      toast.error('Failed to submit loan application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: 'Basic Info', icon: User },
      { number: 2, title: 'Auto Verify', icon: Zap },
      { number: 3, title: 'Loan Details', icon: CreditCard },
      { number: 4, title: 'Video KYC', icon: Camera },
      { number: 5, title: 'Digital Sign', icon: PenTool },
      { number: 6, title: 'Auto Disburse', icon: Banknote },
    ];

    return (
      <div className="w-full px-4 mb-6 sm:mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between relative">
            {/* Progress line background */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
            
            {/* Progress line filled */}
            <div 
              className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out"
              style={{ 
                backgroundColor: '#0052FF',
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
              }}
            />
            
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex flex-col items-center relative z-10">
                  <div 
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted 
                        ? 'text-white scale-110' 
                        : isActive 
                          ? 'text-white scale-110' 
                          : 'text-gray-400 bg-white border-2 border-gray-200'
                    }`}
                    style={{ 
                      backgroundColor: isCompleted || isActive ? '#0052FF' : undefined,
                      borderColor: isCompleted || isActive ? '#0052FF' : undefined
                    }}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                  <span 
                    className={`text-xs sm:text-sm mt-1 sm:mt-2 text-center max-w-16 leading-tight ${
                      isActive ? 'font-semibold' : 'font-normal'
                    }`} 
                    style={{ color: isActive ? '#0052FF' : '#6B7280' }}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="mx-4 sm:mx-0">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <User className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
            Step 1: Basic Information Collection
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">We'll automatically verify your details using DigiLocker and other APIs</p>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pan" className="text-sm sm:text-base">PAN Number *</Label>
              <Input
                id="pan"
                placeholder="ABCDE1234F"
                value={applicationData.panNumber}
                onChange={(e) => updateApplicationData('panNumber', e.target.value.toUpperCase())}
                maxLength={10}
                className="input-mobile touch-manipulation h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income" className="text-sm sm:text-base">Monthly Income (₹) *</Label>
              <Input
                id="income"
                type="number"
                placeholder="50,000"
                value={applicationData.monthlyIncome}
                onChange={(e) => updateApplicationData('monthlyIncome', e.target.value)}
                className="input-mobile touch-manipulation h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Employment Type *</Label>
              <Select value={applicationData.employmentType} onValueChange={(value) => updateApplicationData('employmentType', value)}>
                <SelectTrigger className="touch-manipulation h-12">
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="self-employed">Self-Employed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm sm:text-base">Desired Loan Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="5,00,000"
                value={applicationData.loanAmount}
                onChange={(e) => updateApplicationData('loanAmount', e.target.value)}
                className="input-mobile touch-manipulation h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Loan Purpose *</Label>
              <Select value={applicationData.loanPurpose} onValueChange={(value) => updateApplicationData('loanPurpose', value)}>
                <SelectTrigger className="touch-manipulation h-12">
                  <SelectValue placeholder="Select loan purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal-expenses">Personal Expenses</SelectItem>
                  <SelectItem value="medical-emergency">Medical Emergency</SelectItem>
                  <SelectItem value="home-renovation">Home Renovation</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="debt-consolidation">Debt Consolidation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={processStep1}
              disabled={loading || !validateStep1()}
              style={{ backgroundColor: '#0052FF' }}
              className="btn-mobile touch-manipulation w-full sm:w-auto"
            >
              {loading ? 'Checking...' : 'Check Eligibility'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="mx-4 sm:mx-0">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
            Step 2: Automated Verification
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">We're automatically verifying your details through multiple sources</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium">DigiLocker KYC Verification</p>
                <p className="text-sm text-gray-600">Verifying your Aadhaar and PAN details</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium">Phone & Email Verification</p>
                <p className="text-sm text-gray-600">OTP sent and verified automatically</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium">Bank Account Verification</p>
                <p className="text-sm text-gray-600">Validating your bank account details</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-medium">Credit Score Check</p>
                <p className="text-sm text-gray-600">Fetching your credit score from bureaus</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Automated Process:</strong> All verifications are happening in real-time using government APIs and financial institutions. No manual document uploads required!
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setCurrentStep(3)}
              style={{ backgroundColor: '#0052FF' }}
              className="btn-mobile touch-manipulation w-full sm:w-auto"
            >
              Continue to Loan Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep3 = () => (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="mx-4 sm:mx-0">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
            Step 3: Loan Details & Auto-Approval
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">Based on your verified details, here's your personalized loan offer</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center mb-6">
            <div className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#06B6D4' }}>
              🎉 Auto-Approved!
            </div>
            <p className="text-sm sm:text-base text-gray-600">Your loan has been automatically approved based on your verified details</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Approved Amount</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: '#0052FF' }}>
                  ₹5,00,000
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Interest Rate</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: '#06B6D4' }}>
                  0.1% per day
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Processing Fee</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                  13%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Member Tier</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-700">
                  Regular Member
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-700">
              <strong>Automated Approval:</strong> Your loan has been approved instantly based on your verified KYC, credit score, and income details. No manual review required!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="btn-mobile touch-manipulation order-2 sm:order-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              style={{ backgroundColor: '#0052FF' }}
              className="btn-mobile touch-manipulation order-1 sm:order-2 flex-1"
            >
              Continue to Video KYC
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );


  const renderStep4 = () => (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="mx-4 sm:mx-0">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
            Step 4: e-Agreement & e-NACH Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center mb-6">
            <div className="text-xl sm:text-2xl font-bold mb-2" style={{ color: '#1E2A3B' }}>
              Final Step: Digital Agreement
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Complete the loan agreement digitally and set up automatic EMI deduction
            </p>
          </div>

          <div className="space-y-4">
            <Card className="border-2 border-blue-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
                  <h4 className="font-semibold text-sm sm:text-base">e-Sign Loan Agreement</h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Digitally sign your loan agreement using Aadhaar OTP verification. 
                  This is legally binding and secure.
                </p>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs sm:text-sm text-blue-700">
                    ✓ Document verified and ready for signing
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#06B6D4' }} />
                  <h4 className="font-semibold text-sm sm:text-base">e-NACH Mandate</h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Set up automatic EMI deduction from your bank account. 
                  Ensures timely payments and no late fees.
                </p>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs sm:text-sm text-blue-700">
                    ℹ Bank account ending in ****{applicationData.mobile.slice(-4)} will be used
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 sm:p-6 rounded-lg">
            <h4 className="font-semibold mb-2 text-yellow-800 text-sm sm:text-base">Important Notes:</h4>
            <ul className="text-xs sm:text-sm text-yellow-700 space-y-1">
              <li>• Ensure sufficient balance in your account for EMI deduction</li>
              <li>• You will receive loan amount within 24 hours of completion</li>
              <li>• All documents will be sent to your registered email</li>
              <li>• SMS notifications will be sent for all EMI deductions</li>
            </ul>
          </div>

          <div className="text-center">
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              By proceeding, you agree to the loan terms and authorize EMI deduction
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="btn-mobile touch-manipulation order-2 sm:order-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={completeApplication}
              disabled={loading}
              style={{ backgroundColor: '#0052FF' }}
              className="text-white hover:opacity-90 btn-mobile touch-manipulation order-1 sm:order-2 flex-1"
            >
              {loading ? 'Processing...' : 'Complete Application'}
              <Shield className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen mobile-safe-area" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 px-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2" style={{ color: '#1E2A3B' }}>
            Loan Application
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Complete your loan application in 4 simple steps
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Current Step Content */}
        <div className="px-0 sm:px-4">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && (
            <div className="w-full max-w-2xl mx-auto">
              <Card className="mx-4 sm:mx-0">
                <CardHeader className="pb-4 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
                    Step 4: Video KYC Verification
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">Complete your identity verification with a quick video recording</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Video KYC Process</h3>
                    <p className="text-sm text-gray-600">Record a short video to complete your identity verification</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                      <div>
                        <p className="font-medium">Position your face in the frame</p>
                        <p className="text-sm text-gray-600">Ensure good lighting and clear visibility</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                      <div>
                        <p className="font-medium">State your name and loan purpose</p>
                        <p className="text-sm text-gray-600">Say: "My name is [Your Name] and I'm applying for a personal loan"</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                      <div>
                        <p className="font-medium">Show your Aadhaar card</p>
                        <p className="text-sm text-gray-600">Hold your Aadhaar card clearly in front of the camera</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      <strong>Note:</strong> Your video will be automatically processed using AI verification. This process typically takes 30-60 seconds.
                    </p>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={() => setCurrentStep(5)}
                      style={{ backgroundColor: '#0052FF' }}
                      className="btn-mobile touch-manipulation w-full sm:w-auto px-8"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Start Video Recording
                    </Button>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      className="btn-mobile touch-manipulation"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {currentStep === 5 && (
            <div className="w-full max-w-2xl mx-auto">
              <Card className="mx-4 sm:mx-0">
                <CardHeader className="pb-4 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <PenTool className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
                    Step 5: Digital Signature
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">Provide your digital signature for the loan agreement</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <PenTool className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Digital Signature</h3>
                    <p className="text-sm text-gray-600">Sign the loan agreement digitally using Aadhaar OTP</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Secure Process:</strong> Your signature will be verified using Aadhaar OTP and stored securely for legal compliance.
                    </p>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={() => setCurrentStep(6)}
                      style={{ backgroundColor: '#0052FF' }}
                      className="btn-mobile touch-manipulation w-full sm:w-auto px-8"
                    >
                      <PenTool className="mr-2 h-4 w-4" />
                      Sign with Aadhaar OTP
                    </Button>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(4)}
                      className="btn-mobile touch-manipulation"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {currentStep === 6 && (
            <div className="w-full max-w-2xl mx-auto">
              <Card className="mx-4 sm:mx-0">
                <CardHeader className="pb-4 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Banknote className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0052FF' }} />
                    Step 6: Auto Disbursal
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">Your loan will be automatically disbursed to your verified bank account</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">🎉 Loan Approved & Disbursed!</h3>
                    <p className="text-sm text-gray-600">Your loan has been automatically processed and disbursed</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Loan Amount</p>
                        <p className="text-xl font-bold text-green-600">₹5,00,000</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Disbursed To</p>
                        <p className="text-sm font-bold text-blue-600">****1234</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-700">
                      <strong>Auto Disbursal Complete:</strong> Your loan amount has been automatically transferred to your verified bank account. You will receive SMS and email confirmation shortly.
                    </p>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={() => navigate('/dashboard')}
                      style={{ backgroundColor: '#0052FF' }}
                      className="btn-mobile touch-manipulation w-full sm:w-auto px-8"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}