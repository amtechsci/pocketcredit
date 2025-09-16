import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { Disclaimer } from '../Disclaimer';

interface BasicProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender?: string;
  marital_status?: string;
}

interface AdditionalProfileForm {
  // Current Address
  current_address_line1: string;
  current_address_line2?: string;
  current_city: string;
  current_state: string;
  current_pincode: string;
  current_country?: string;
  
  // Permanent Address
  permanent_address_line1: string;
  permanent_address_line2?: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pincode: string;
  permanent_country?: string;
  
  // PAN number
  pan_number: string;
}

interface EmploymentForm {
  monthly_income: string;
  employment_type: string;
  company_name: string;
  designation: string;
  salary_date: string;
}

export function ProfileCompletionPageSimple() {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(2);
  const [showConsentDetails, setShowConsentDetails] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  
  // Use simple state instead of react-hook-form
  const [basicFormData, setBasicFormData] = useState<BasicProfileForm>({
    first_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    gender: '',
    marital_status: '',
  });

  const [additionalFormData, setAdditionalFormData] = useState<AdditionalProfileForm>({
    // Current Address
    current_address_line1: '',
    current_address_line2: '',
    current_city: '',
    current_state: '',
    current_pincode: '',
    current_country: 'India',
    
    // Permanent Address
    permanent_address_line1: '',
    permanent_address_line2: '',
    permanent_city: '',
    permanent_state: '',
    permanent_pincode: '',
    permanent_country: 'India',
    
    // PAN number
    pan_number: '',
  });

  const [employmentFormData, setEmploymentFormData] = useState<EmploymentForm>({
    monthly_income: '',
    employment_type: '',
    company_name: '',
    designation: '',
    salary_date: '',
  });

  // Initialize current step based on user's profile completion step
  useEffect(() => {
    if (user) {
      setCurrentStep(user.profile_completion_step || 2);
      setBasicFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        date_of_birth: user.date_of_birth || '',
        gender: user.gender || '',
        marital_status: user.marital_status || '',
      });
    }
  }, [user]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (user && user.profile_completion_step >= 5) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleBasicProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiService.updateBasicProfile(basicFormData);
      
      if (response.status === 'success' && response.data) {
        updateUser(response.data.user);
        toast.success('Basic profile updated successfully!');
        setCurrentStep(3);
      } else {
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Basic profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Function to copy current address to permanent address
  const copyCurrentToPermanent = () => {
    setAdditionalFormData(prev => ({
      ...prev,
      permanent_address_line1: prev.current_address_line1,
      permanent_address_line2: prev.current_address_line2,
      permanent_city: prev.current_city,
      permanent_state: prev.current_state,
      permanent_pincode: prev.current_pincode,
      permanent_country: prev.current_country,
    }));
    toast.success('Current address copied to permanent address');
  };

  const handleAdditionalProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate consent checkbox
    if (!consentChecked) {
      toast.error('Please accept the authorization terms to continue');
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiService.updateAdditionalProfile(additionalFormData);
      
      if (response.status === 'success' && response.data) {
        updateUser(response.data.user);
        toast.success('Additional details saved successfully!');
        
        // Use backend response to determine next step
        if (response.data.next_step === 'employment_details') {
          setCurrentStep(4);
        } else if (response.data.profile_completed) {
          navigate('/dashboard');
        }
      } else {
        toast.error(response.message || 'Failed to save additional details');
      }
    } catch (error: any) {
      console.error('Additional profile update error:', error);
      toast.error(error.message || 'Failed to save additional details');
    } finally {
      setLoading(false);
    }
  };

  const handleEmploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiService.updateEmploymentDetails(employmentFormData);
      
      if (response.status === 'success' && response.data) {
        updateUser(response.data.user);
        toast.success('Profile completed successfully!');
        
        // Use backend response to determine next step
        if (response.data.next_step === 'dashboard' || response.data.profile_completed) {
          await refreshUser();
          navigate('/dashboard');
        }
      } else {
        toast.error(response.message || 'Failed to save employment details');
      }
    } catch (error: any) {
      console.error('Employment details update error:', error);
      toast.error(error.message || 'Failed to save employment details');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    switch (currentStep) {
      case 2: return 25;
      case 3: return 50;
      case 4: return 75;
      case 5: return 100;
      default: return 0;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 2: return 'Basic Information';
      case 3: return 'Additional Details';
      case 4: return 'Employment Details';
      case 5: return 'Profile Complete';
      default: return 'Profile Setup';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 2: return 'Please provide your basic personal information';
      case 3: return 'Add your address and identification details';
      case 4: return 'Tell us about your employment information';
      case 5: return 'Your profile is now complete!';
      default: return '';
    }
  };

  // Show loading state while user data is being fetched
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getStepTitle()}
          </h1>
          <p className="text-gray-600">
            {getStepDescription()}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{getProgressPercentage()}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step}
                </div>
                {step < 5 && (
                  <div className={`w-8 h-0.5 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentStep === 2 && <User className="w-5 h-5" />}
              {currentStep === 3 && <MapPin className="w-5 h-5" />}
              {currentStep === 4 && <Shield className="w-5 h-5" />}
              {currentStep === 5 && <CheckCircle className="w-5 h-5 text-green-600" />}
              {getStepTitle()}
            </CardTitle>
            <CardDescription>
              {getStepDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {currentStep === 2 && (
              <form onSubmit={handleBasicProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <span className="text-xs text-gray-500 font-normal">Name as per PAN Card</span>
                    </div>
                    <Input
                      id="first_name"
                      value={basicFormData.first_name}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="Enter your first name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <span className="text-xs text-gray-500 font-normal">Name as per PAN Card</span>
                    </div>
                    <Input
                      id="last_name"
                      value={basicFormData.last_name}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Enter your last name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={basicFormData.email}
                    onChange={(e) => setBasicFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={basicFormData.date_of_birth}
                    onChange={(e) => setBasicFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value: string) => setBasicFormData(prev => ({ ...prev, gender: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marital_status">Marital Status</Label>
                    <Select onValueChange={(value: string) => setBasicFormData(prev => ({ ...prev, marital_status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? 'Saving...' : 'Continue'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Disclaimer />
                </div>
              </form>
            )}

            {currentStep === 3 && (
              <form onSubmit={handleAdditionalProfileSubmit} className="space-y-6">
                {/* Current Address */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Current Address *</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current_address_line1">Address Line 1 *</Label>
                      <Input
                        id="current_address_line1"
                        value={additionalFormData.current_address_line1}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, current_address_line1: e.target.value }))}
                        placeholder="Enter your current address"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="current_address_line2">Address Line 2</Label>
                      <Input
                        id="current_address_line2"
                        value={additionalFormData.current_address_line2}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, current_address_line2: e.target.value }))}
                        placeholder="Apartment, suite, etc. (optional)"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="current_city">City *</Label>
                        <Input
                          id="current_city"
                          value={additionalFormData.current_city}
                          onChange={(e) => setAdditionalFormData(prev => ({ ...prev, current_city: e.target.value }))}
                          placeholder="Enter city"
                          required
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="current_state">State *</Label>
                        <Input
                          id="current_state"
                          value={additionalFormData.current_state}
                          onChange={(e) => setAdditionalFormData(prev => ({ ...prev, current_state: e.target.value }))}
                          placeholder="Enter state"
                          required
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="current_pincode">Pincode *</Label>
                      <Input
                        id="current_pincode"
                        value={additionalFormData.current_pincode}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, current_pincode: e.target.value }))}
                        placeholder="Enter pincode"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Permanent Address */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">Permanent Address *</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyCurrentToPermanent}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50 text-sm px-3 py-1 w-full sm:w-auto"
                    >
                      Copy from Current
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="permanent_address_line1">Address Line 1 *</Label>
                      <Input
                        id="permanent_address_line1"
                        value={additionalFormData.permanent_address_line1}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, permanent_address_line1: e.target.value }))}
                        placeholder="Enter your permanent address"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="permanent_address_line2">Address Line 2</Label>
                      <Input
                        id="permanent_address_line2"
                        value={additionalFormData.permanent_address_line2}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, permanent_address_line2: e.target.value }))}
                        placeholder="Apartment, suite, etc. (optional)"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="permanent_city">City *</Label>
                        <Input
                          id="permanent_city"
                          value={additionalFormData.permanent_city}
                          onChange={(e) => setAdditionalFormData(prev => ({ ...prev, permanent_city: e.target.value }))}
                          placeholder="Enter city"
                          required
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="permanent_state">State *</Label>
                        <Input
                          id="permanent_state"
                          value={additionalFormData.permanent_state}
                          onChange={(e) => setAdditionalFormData(prev => ({ ...prev, permanent_state: e.target.value }))}
                          placeholder="Enter state"
                          required
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="permanent_pincode">Pincode *</Label>
                      <Input
                        id="permanent_pincode"
                        value={additionalFormData.permanent_pincode}
                        onChange={(e) => setAdditionalFormData(prev => ({ ...prev, permanent_pincode: e.target.value }))}
                        placeholder="Enter pincode"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* PAN Number */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pan_number">PAN Number *</Label>
                    <span className="text-xs text-gray-500 font-normal">(subject to verification)</span>
                  </div>
                  <Input
                    id="pan_number"
                    value={additionalFormData.pan_number}
                    onChange={(e) => setAdditionalFormData(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                    placeholder="Enter PAN number"
                    className="uppercase w-full"
                    required
                  />
                </div>

                {/* Authorization Checkbox and Consent */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="consent_checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        required
                      />
                      <div className="flex-1">
                        <label htmlFor="consent_checkbox" className="text-sm text-gray-700 leading-relaxed">
                          I hereby appoint the lenders associated with pocketcredit.in as my authorised representative to receive my credit information from CIBIL / EXPERIAN / EQUIFAX & CRIF HIGH MARK (bureau).
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowConsentDetails(!showConsentDetails)}
                          className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          {showConsentDetails ? 'Hide' : 'View'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Consent Details */}
                    {showConsentDetails && (
                      <div className="ml-7 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 leading-relaxed space-y-3">
                          <p>
                            I hereby unconditionally consent to and instruct bureau to provide my credit information to the lenders associated with pocketcredit.in on a month to month basis as per their requirement. I understand that I shall have the option to opt out/unsubscribe from the service. By submitting this form, you hereby authorize pocketcredit.in/lender to do all of the following in connection with providing you the Services:
                          </p>
                          
                          <ol className="list-decimal list-inside space-y-2 ml-2">
                            <li>Verify your identity and share with our Credit bureaus required personal identifiable information about you;</li>
                            <li>Request and receive your Credit report, and credit score from our Credit bureaus, including but not limited to a copy of your consumer credit report and score, at any time for so long as you have not opted out or unsubscribed from this service;</li>
                            <li>Share your details with NBFC partners in order to assist you to rectify and remove negative observations from your credit information report and increase your chances of loan approval in future;</li>
                            <li>To provide you with customized recommendations and personalized offers of the products and services of pocketcredit.in and/or its business partners/affiliates;</li>
                            <li>To send you information / personalized offers via email, text, call or online display or other means of delivery in pocketcredit.in's reasonable sole discretion.</li>
                            <li>Retain a copy of your credit information, along with the other information you have given us access to under this Authorization, for use in accordance with Credit Score Terms of Use, Terms of Use and Privacy Policy.</li>
                          </ol>
                          
                          <p className="font-medium">
                            Your Personal Information is 100% secured with us. We do not share your data with any third party.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {loading ? 'Saving...' : 'Next'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Disclaimer />
                </div>
              </form>
            )}

            {currentStep === 4 && (
              <form onSubmit={handleEmploymentSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="monthly_income">Monthly Income (₹) *</Label>
                  <Input
                    id="monthly_income"
                    type="number"
                    value={employmentFormData.monthly_income}
                    onChange={(e) => setEmploymentFormData(prev => ({ ...prev, monthly_income: e.target.value }))}
                    placeholder="Enter your monthly income"
                    required
                    min="0"
                    step="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment Type *</Label>
                  <Select onValueChange={(value: string) => setEmploymentFormData(prev => ({ ...prev, employment_type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salaried">Salaried</SelectItem>
                      <SelectItem value="self_employed">Self-employed</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={employmentFormData.company_name}
                      onChange={(e) => setEmploymentFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Enter company name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      value={employmentFormData.designation}
                      onChange={(e) => setEmploymentFormData(prev => ({ ...prev, designation: e.target.value }))}
                      placeholder="Enter your designation"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary_date">Salary Date *</Label>
                  <Select onValueChange={(value: string) => setEmploymentFormData(prev => ({ ...prev, salary_date: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select salary date" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(3)}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {loading ? 'Saving...' : 'Complete Profile'}
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Disclaimer />
                </div>
              </form>
            )}

            {currentStep === 5 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Profile Complete!
                </h3>
                <p className="text-gray-600 mb-6">
                  Your profile has been successfully completed. You can now access all features.
                </p>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">
              Your information is secured with 256-bit encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
