import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
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
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  pan_number: string;
}

export function ProfileCompletionPage() {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(2); // Start with step 2 (Basic Details)

  // Initialize forms at the top level - always call hooks
  const basicForm = useForm<BasicProfileForm>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      date_of_birth: '',
      gender: '',
      marital_status: '',
    }
  });

  const additionalForm = useForm<AdditionalProfileForm>({
    defaultValues: {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      pan_number: '',
    }
  });

  // Initialize current step based on user's profile completion step
  useEffect(() => {
    if (user) {
      setCurrentStep(user.profile_completion_step || 2);
    }
  }, [user]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (user && user.profile_completion_step >= 4) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      basicForm.reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        date_of_birth: user.date_of_birth || '',
        gender: user.gender || '',
        marital_status: user.marital_status || '',
      });
    }
  }, [user, basicForm]);

  const handleBasicProfileSubmit = async (data: BasicProfileForm) => {
    setLoading(true);
    try {
      const response = await apiService.updateBasicProfile(data);
      
      if (response.status === 'success' && response.data) {
        // Update user context with new data
        updateUser(response.data.user);
        
        toast.success('Basic profile updated successfully!');
        
        // Move to next step
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

  const handleAdditionalProfileSubmit = async (data: AdditionalProfileForm) => {
    setLoading(true);
    try {
      // Map form data to API expected format
      const apiData = {
        current_address_line1: data.address_line1,
        current_address_line2: data.address_line2,
        current_city: data.city,
        current_state: data.state,
        current_pincode: data.pincode,
        current_country: data.country || 'India',
        permanent_address_line1: data.address_line1, // Using same address for both
        permanent_address_line2: data.address_line2,
        permanent_city: data.city,
        permanent_state: data.state,
        permanent_pincode: data.pincode,
        permanent_country: data.country || 'India',
        pan_number: data.pan_number,
      };
      
      const response = await apiService.updateAdditionalProfile(apiData);
      
      if (response.status === 'success' && response.data) {
        // Update user context with new data
        updateUser(response.data.user);
        
        toast.success('Profile completed successfully!');
        
        // Refresh user data to get latest state
        await refreshUser();
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        toast.error(response.message || 'Failed to complete profile');
      }
    } catch (error: any) {
      console.error('Additional profile update error:', error);
      toast.error(error.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    switch (currentStep) {
      case 2: return 33;
      case 3: return 66;
      case 4: return 100;
      default: return 0;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 2: return 'Basic Information';
      case 3: return 'Additional Details';
      case 4: return 'Profile Complete';
      default: return 'Profile Setup';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 2: return 'Please provide your basic personal information';
      case 3: return 'Add your address and identification details';
      case 4: return 'Your profile is now complete!';
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
            {[2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step}
                </div>
                {step < 4 && (
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
              {currentStep === 4 && <CheckCircle className="w-5 h-5 text-green-600" />}
              {getStepTitle()}
            </CardTitle>
            <CardDescription>
              {getStepDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {currentStep === 2 && (
              <form onSubmit={basicForm.handleSubmit(handleBasicProfileSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <span className="text-xs text-gray-500 font-normal">Name as per PAN Card</span>
                    </div>
                    <Input
                      id="first_name"
                      {...basicForm.register('first_name', { required: 'First name is required' })}
                      placeholder="Enter your first name"
                    />
                    {basicForm.formState.errors.first_name && (
                      <p className="text-sm text-red-600">{basicForm.formState.errors.first_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <span className="text-xs text-gray-500 font-normal">Name as per PAN Card</span>
                    </div>
                    <Input
                      id="last_name"
                      {...basicForm.register('last_name', { required: 'Last name is required' })}
                      placeholder="Enter your last name"
                    />
                    {basicForm.formState.errors.last_name && (
                      <p className="text-sm text-red-600">{basicForm.formState.errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...basicForm.register('email', { 
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    placeholder="Enter your email address"
                  />
                  {basicForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{basicForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    {...basicForm.register('date_of_birth', { required: 'Date of birth is required' })}
                  />
                  {basicForm.formState.errors.date_of_birth && (
                    <p className="text-sm text-red-600">{basicForm.formState.errors.date_of_birth.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value: string) => basicForm.setValue('gender', value)}>
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
                    <Select onValueChange={(value: string) => basicForm.setValue('marital_status', value)}>
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
              <form onSubmit={additionalForm.handleSubmit(handleAdditionalProfileSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="address_line1">Address Line 1 *</Label>
                  <Input
                    id="address_line1"
                    {...additionalForm.register('address_line1', { required: 'Address is required' })}
                    placeholder="Enter your address"
                  />
                  {additionalForm.formState.errors.address_line1 && (
                    <p className="text-sm text-red-600">{additionalForm.formState.errors.address_line1.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    {...additionalForm.register('address_line2')}
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      {...additionalForm.register('city', { required: 'City is required' })}
                      placeholder="Enter city"
                    />
                    {additionalForm.formState.errors.city && (
                      <p className="text-sm text-red-600">{additionalForm.formState.errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      {...additionalForm.register('state', { required: 'State is required' })}
                      placeholder="Enter state"
                    />
                    {additionalForm.formState.errors.state && (
                      <p className="text-sm text-red-600">{additionalForm.formState.errors.state.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      {...additionalForm.register('pincode', { 
                        required: 'Pincode is required',
                        pattern: {
                          value: /^[1-9][0-9]{5}$/,
                          message: 'Invalid pincode'
                        }
                      })}
                      placeholder="Enter pincode"
                    />
                    {additionalForm.formState.errors.pincode && (
                      <p className="text-sm text-red-600">{additionalForm.formState.errors.pincode.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number *</Label>
                  <Input
                    id="pan_number"
                    {...additionalForm.register('pan_number', { 
                      required: 'PAN number is required',
                      pattern: {
                        value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                        message: 'Invalid PAN number format'
                      }
                    })}
                    placeholder="Enter PAN number"
                    className="uppercase"
                  />
                  {additionalForm.formState.errors.pan_number && (
                    <p className="text-sm text-red-600">{additionalForm.formState.errors.pan_number.message}</p>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    disabled={loading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? 'Completing...' : 'Complete Profile'}
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Disclaimer />
                </div>
              </form>
            )}

            {currentStep === 4 && (
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