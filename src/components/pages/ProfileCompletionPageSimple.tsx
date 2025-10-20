import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  ArrowRight,
  Shield,
  Mail
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { DocumentUpload } from '../DocumentUpload';
import { AdditionalDetailsStep } from './AdditionalDetailsStep';

interface BasicProfileForm {
  full_name: string;
  pan_number: string;
  gender: string;
  latitude: number | null;
  longitude: number | null;
  date_of_birth: string;
}

interface EmploymentQuickCheckForm {
  employment_type: string;
  income_range: string;
  eligible_loan_amount: number;
  payment_mode: string;
  designation: string;
}

interface StudentForm {
  date_of_birth: string;
  college_name: string;
  graduation_status: string;
}

const ProfileCompletionPageSimple = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const stepUpdatedRef = useRef(false);

  const [basicFormData, setBasicFormData] = useState<BasicProfileForm>({
    full_name: '',
    pan_number: '',
    gender: '',
    latitude: null,
    longitude: null,
    date_of_birth: '',
  });

  const [employmentQuickCheckData, setEmploymentQuickCheckData] = useState<EmploymentQuickCheckForm>({
    employment_type: '',
    income_range: '',
    eligible_loan_amount: 0,
    payment_mode: '',
    designation: '',
  });

  const [studentFormData, setStudentFormData] = useState<StudentForm>({
    date_of_birth: '',
    college_name: '',
    graduation_status: 'not_graduated',
  });

  // Digitap pre-fill states
  const [digitapData, setDigitapData] = useState<any>(null);
  const [showPrefillConfirm, setShowPrefillConfirm] = useState(false);
  const [fetchingPrefill, setFetchingPrefill] = useState(false);
  const [digitapCalled, setDigitapCalled] = useState(false);

  // Student document upload states
  const [uploadedDocs, setUploadedDocs] = useState<{
    college_id_front?: any;
    college_id_back?: any;
    marks_memo?: any;
  }>({});

  // Initialize current step from user data
  useEffect(() => {
    if (user && user.profile_completion_step) {
      const newStep = user.profile_completion_step;
      if (newStep !== currentStep && !stepUpdatedRef.current) {
        stepUpdatedRef.current = true;
        setCurrentStep(newStep);
        setTimeout(() => { stepUpdatedRef.current = false; }, 100);
      }
    }
  }, [user?.profile_completion_step]);

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      const fullName = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}`.trim() : user.first_name || '';
      let lat = null; 
      let lng = null;
      if (user.latlong) {
        const [latitude, longitude] = user.latlong.split(',');
        lat = parseFloat(latitude) || null; 
        lng = parseFloat(longitude) || null;
      }

      let formattedDOB = '';
      if (user.date_of_birth) {
        const dobDate = new Date(user.date_of_birth);
        if (!isNaN(dobDate.getTime())) {
          formattedDOB = dobDate.toISOString().split('T')[0];
        }
      }

      setBasicFormData({
        full_name: fullName,
        pan_number: user.pan_number || '',
        gender: user.gender ? user.gender.toLowerCase() : '',
        latitude: lat,
        longitude: lng,
        date_of_birth: formattedDOB,
      });
    }
  }, [user?.id]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (user && user.profile_completed) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Auto-capture GPS location when Step 2 is reached (only for salaried)
  useEffect(() => {
    const isSalaried = user?.employment_type === 'salaried' || employmentQuickCheckData.employment_type === 'salaried';
    
    if (currentStep === 2 && isSalaried && !basicFormData.latitude && !basicFormData.longitude) {
      console.log('📍 Auto-capturing location for salaried user...');
      captureLocation();
    }
  }, [currentStep, user?.employment_type, employmentQuickCheckData.employment_type, basicFormData.latitude, basicFormData.longitude]);

  // Auto-call Digitap API when Step 2 is reached (only for salaried)
  useEffect(() => {
    const isSalaried = user?.employment_type === 'salaried' || employmentQuickCheckData.employment_type === 'salaried';
    
    console.log('Digitap trigger check:', {
      currentStep,
      userEmploymentType: user?.employment_type,
      formEmploymentType: employmentQuickCheckData.employment_type,
      isSalaried,
      digitapCalled
    });
    
    if (currentStep === 2 && isSalaried && !digitapCalled) {
      console.log('✅ Triggering Digitap API call...');
      fetchDigitapData();
    }
  }, [currentStep, user?.employment_type, employmentQuickCheckData.employment_type, digitapCalled]);
  
  // Skip Step 2 for students - go directly to Step 3
  useEffect(() => {
    if (currentStep === 2 && user?.employment_type === 'student') {
      console.log('Student detected, skipping to Step 3 (College Information)');
      setCurrentStep(3);
    }
  }, [currentStep, user?.employment_type]);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBasicFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        console.log('Location captured:', position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        const errorMessage = error.message || 'Failed to get location';
        console.error('Location error:', errorMessage);
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const calculateLoanAmount = (incomeRange: string): number => {
    switch(incomeRange) {
      case '1k-15k':
        return 6000;
      case '15k-25k':
        return 10000;
      case '25k-35k':
        return 15000;
      case 'above-35k':
        return 50000;
      default:
        return 0;
    }
  };

  const fetchDigitapData = async () => {
    setDigitapCalled(true);
    setFetchingPrefill(true);
    
    try {
      console.log('Fetching Digitap prefill data...');
      const response = await apiService.fetchDigitapPrefill();
      
      if (response && response.data) {
        console.log('Digitap data received:', response.data);
        setDigitapData(response.data);
        setShowPrefillConfirm(true);
        toast.success('We found your details automatically!');
      } else if ((response as any)?.hold_applied) {
        // Credit score too low - hold applied
        toast.error((response as any).message || 'Application on hold due to credit score');
        // Wait a bit then redirect
        setTimeout(() => navigate('/dashboard'), 3000);
      } else {
        // API failed or returned no data - allow manual entry
        console.log('Digitap API failed or no data, proceeding with manual entry');
        toast.info('Please enter your details manually');
      }
    } catch (error) {
      console.error('Digitap fetch error:', error);
      toast.info('Please enter your details manually');
    } finally {
      setFetchingPrefill(false);
    }
  };

  const handlePrefillConfirm = async () => {
    if (!digitapData) return;
    
    setLoading(true);
    try {
      // Save Digitap prefill data to database
      const saveResponse = await apiService.saveDigitapPrefill({
        name: digitapData.name,
        dob: digitapData.dob,
        pan: digitapData.pan,
        gender: digitapData.gender ? digitapData.gender.toLowerCase() : '',
        email: digitapData.email,
        address: digitapData.address
      });

      // Check if save was successful
      if (saveResponse && saveResponse.data) {
        console.log('Digitap data saved to database');
        
        // Pre-fill the form with Digitap data
        setBasicFormData(prev => ({
          ...prev,
          full_name: digitapData.name || prev.full_name,
          pan_number: digitapData.pan || prev.pan_number,
          date_of_birth: digitapData.dob || prev.date_of_birth,
          gender: digitapData.gender ? digitapData.gender.toLowerCase() : prev.gender
        }));
        
        setShowPrefillConfirm(false);
        toast.success('Details saved and filled automatically!');
      } else {
        console.error('Save prefill response:', saveResponse);
        toast.error('Failed to save details');
      }
    } catch (error) {
      console.error('Error saving prefill data:', error);
      toast.error('Failed to save details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrefillReject = () => {
    setShowPrefillConfirm(false);
    toast.info('Please enter your details manually');
  };

  const handleEmploymentQuickCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData: any = {
        employment_type: employmentQuickCheckData.employment_type
      };

      if (employmentQuickCheckData.employment_type === 'salaried') {
        submitData.income_range = employmentQuickCheckData.income_range;
        submitData.eligible_loan_amount = employmentQuickCheckData.eligible_loan_amount;
        submitData.payment_mode = employmentQuickCheckData.payment_mode;
        submitData.designation = employmentQuickCheckData.designation;
      }

      const response = await apiService.saveEmploymentQuickCheck(submitData);

      if (response && response.data) {
        if (response.data.eligible) {
          toast.success('Eligibility verified! Please continue with your profile.');
          await refreshUser();
          
          // For salaried users, pre-fetch Digitap data for next step
          if (employmentQuickCheckData.employment_type === 'salaried' && !digitapCalled) {
            console.log('🔄 Pre-fetching Digitap data after employment verification...');
            // Don't await this - let it run in background
            setTimeout(() => {
              if (currentStep === 2 && !digitapCalled) {
                fetchDigitapData();
              }
            }, 500);
          }
        } else {
          toast.error(response.data.message || 'You are not eligible at this time.');
        }
      } else {
        toast.error('Failed to verify eligibility');
      }
    } catch (error: any) {
      console.error('Employment quick check error:', error);
      toast.error(error.message || 'Failed to verify eligibility');
    } finally {
      setLoading(false);
    }
  };

  const handleBasicProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!basicFormData.latitude || !basicFormData.longitude) {
      toast.error('Capturing your location... Please wait and try again.');
      return;
    }

    setLoading(true);
    try {
      // Split full name into first and last name
      const nameParts = basicFormData.full_name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

      // Prepare data for API
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        email: user?.email || '',
        date_of_birth: basicFormData.date_of_birth,
        gender: basicFormData.gender,
        pan_number: basicFormData.pan_number,
        latitude: basicFormData.latitude,
        longitude: basicFormData.longitude
      };

      const response = await apiService.updateBasicProfile(profileData);
      
      if (response.status === 'success' && response.data) {
        // Check if hold was applied
        if (response.data.hold_permanent || response.data.hold_until) {
          // Age restriction hold applied
          const holdMessage = response.data.hold_reason || response.message;
          toast.error(holdMessage);
          
          // Redirect to dashboard where they can see the hold banner
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }
        
        updateUser(response.data.user);
        toast.success(response.message || 'Profile updated successfully!');
        
        if (response.data.next_step === 'dashboard') {
          navigate('/dashboard');
        } else if (response.data.next_step === 'college_details') {
          setCurrentStep(3);
        }
      } else {
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required documents are uploaded
    if (!uploadedDocs.college_id_front) {
      toast.error('Please upload the front side of your college ID card');
      return;
    }
    if (!uploadedDocs.college_id_back) {
      toast.error('Please upload the back side of your college ID card');
      return;
    }
    if (!uploadedDocs.marks_memo) {
      toast.error('Please upload your marks memo or educational certificate');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateStudentProfile(studentFormData);
      
      if (response.status === 'success' && response.data) {
        // Check if hold was applied due to age
        if (response.data.hold_permanent || response.data.hold_until) {
          const holdMessage = response.data.hold_reason || response.message;
          toast.error(holdMessage);
          
          // Redirect to dashboard where they can see the hold banner
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }
        
        updateUser(response.data.user);
        toast.success('Student profile completed successfully!');
        navigate('/dashboard');
      } else {
        toast.error(response.message || 'Failed to save student profile');
      }
    } catch (error: any) {
      console.error('Student profile submission error:', error);
      toast.error(error.message || 'Failed to save student profile');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Employment Type Selection';
      case 2: return 'Basic Information';
      case 3: 
        if (user?.employment_type === 'salaried') {
          return 'Additional Details';
        }
        return 'College Information';
      default: return 'Profile Completion';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Please select your employment type to proceed';
      case 2: return 'Please provide your basic information';
      case 3:
        if (user?.employment_type === 'salaried') {
          return 'Verify your contact details and provide additional information';
        }
        return 'Please provide your personal and college information';
      default: return 'Complete your profile';
    }
  };

  if (loading && !user) {
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentStep === 1 && <Shield className="w-5 h-5" />}
              {currentStep === 2 && <User className="w-5 h-5" />}
              {currentStep === 3 && user?.employment_type === 'salaried' && <Mail className="w-5 h-5" />}
              {currentStep === 3 && user?.employment_type === 'student' && <MapPin className="w-5 h-5" />}
              {getStepTitle()}
            </CardTitle>
            <CardDescription>
              {getStepDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Employment Type Selection */}
            {currentStep === 1 && (
              <form onSubmit={handleEmploymentQuickCheckSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Type of Employment *</Label>
                    <select
                      id="employment_type"
                      value={employmentQuickCheckData.employment_type}
                      onChange={(e) => setEmploymentQuickCheckData(prev => ({ ...prev, employment_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select employment type</option>
                      <option value="salaried">Salaried</option>
                      <option value="student">Student</option>
                      <option value="self_employed">Self-employed (Hold)</option>
                      <option value="part_time">Part-time (Hold)</option>
                      <option value="freelancer">Freelancer (Hold)</option>
                      <option value="homemaker">Homemaker (Hold)</option>
                      <option value="retired">Retired (Hold)</option>
                      <option value="no_job">Don't have Job (Hold)</option>
                      <option value="others">Others (Hold)</option>
                    </select>
                  </div>

                  {employmentQuickCheckData.employment_type === 'salaried' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="income_range">Gross Monthly Income *</Label>
                        <select
                          id="income_range"
                          value={employmentQuickCheckData.income_range}
                          onChange={(e) => {
                            const range = e.target.value;
                            const loanAmount = calculateLoanAmount(range);
                            setEmploymentQuickCheckData(prev => ({ 
                              ...prev, 
                              income_range: range,
                              eligible_loan_amount: loanAmount
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select income range</option>
                          <option value="1k-15k">₹1,000 to ₹15,000</option>
                          <option value="15k-25k">₹15,000 to ₹25,000</option>
                          <option value="25k-35k">₹25,000 to ₹35,000</option>
                          <option value="above-35k">Above ₹35,000</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment_mode">Salary Payment Mode *</Label>
                        <select
                          id="payment_mode"
                          value={employmentQuickCheckData.payment_mode}
                          onChange={(e) => setEmploymentQuickCheckData(prev => ({ ...prev, payment_mode: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select payment mode</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="cheque">Cheque</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="designation">Designation *</Label>
                        <Input
                          id="designation"
                          type="text"
                          value={employmentQuickCheckData.designation}
                          onChange={(e) => setEmploymentQuickCheckData(prev => ({ ...prev, designation: e.target.value }))}
                          placeholder="Enter your designation"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="submit" disabled={loading} className="w-full md:w-auto">
                    {loading ? 'Verifying...' : 'Continue'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 2: Basic Information */}
            {currentStep === 2 && (
              <>
                {/* Loading State for Digitap API */}
                {fetchingPrefill && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <p className="text-blue-600 font-medium">Fetching your details automatically...</p>
                    </div>
                  </div>
                )}

                {/* Prefill Confirmation Dialog */}
                {showPrefillConfirm && digitapData && !fetchingPrefill && (
                  <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-green-900 mb-2">
                          We found your details!
                        </h3>
                        <div className="space-y-2 text-sm text-gray-700 mb-4">
                          <p><strong>Name:</strong> {digitapData.name}</p>
                          <p><strong>PAN:</strong> {digitapData.pan}</p>
                          <p><strong>DOB:</strong> {digitapData.dob}</p>
                          {digitapData.gender && (
                            <p><strong>Gender:</strong> {digitapData.gender}</p>
                          )}
                          {digitapData.credit_score && (
                            <p><strong>Credit Score:</strong> {digitapData.credit_score}</p>
                          )}
                        </div>
                        <div className="flex space-x-3">
                          <Button
                            type="button"
                            onClick={handlePrefillConfirm}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Use These Details
                          </Button>
                          <Button
                            type="button"
                            onClick={handlePrefillReject}
                            variant="outline"
                            className="border-gray-300"
                          >
                            Enter Manually
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleBasicProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name as per PAN Card *</Label>
                    <Input
                      id="full_name"
                      value={basicFormData.full_name}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Enter your full name"
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pan_number">PAN Number *</Label>
                    <Input
                      id="pan_number"
                      value={basicFormData.pan_number}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                      placeholder="Enter PAN number"
                      className="uppercase h-11"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <select
                      id="gender"
                      value={basicFormData.gender}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={basicFormData.date_of_birth}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      min={new Date(new Date().setFullYear(new Date().getFullYear() - 65)).toISOString().split('T')[0]}
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500">Age must be between 18 and 65 years</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 h-11 w-full md:w-auto"
                  >
                    {loading ? 'Saving...' : 'Continue'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
              </>
            )}

            {/* Step 3: Additional Details (for salaried users) */}
            {currentStep === 3 && user?.employment_type === 'salaried' && (
              <AdditionalDetailsStep
                onComplete={() => {
                  setCurrentStep(4);
                  refreshUser();
                }}
                loading={loading}
                setLoading={setLoading}
              />
            )}

            {/* Step 3: Student Information (for students) */}
            {currentStep === 3 && user?.employment_type === 'student' && (
              <form onSubmit={handleStudentCollegeSubmit} className="space-y-6">
                {/* Date of Birth - First for Age Validation */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Personal Information *</h3>
                  <div className="space-y-2">
                    <Label htmlFor="student_dob">Date of Birth *</Label>
                    <Input
                      id="student_dob"
                      type="date"
                      value={studentFormData.date_of_birth}
                      onChange={(e) => setStudentFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      min={new Date(new Date().setFullYear(new Date().getFullYear() - 30)).toISOString().split('T')[0]}
                      required
                      className="h-11 w-full"
                    />
                    <p className="text-xs text-gray-600">
                      You must be at least 19 years old to apply as a student
                    </p>
                  </div>
                </div>

                {/* College Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">College Information *</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="college_name">Full College Name *</Label>
                      <Input
                        id="college_name"
                        value={studentFormData.college_name}
                        onChange={(e) => setStudentFormData(prev => ({ ...prev, college_name: e.target.value }))}
                        placeholder="Enter your college full name"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="graduation_status">Graduation Status *</Label>
                      <select
                        id="graduation_status"
                        value={studentFormData.graduation_status}
                        onChange={(e) => setStudentFormData(prev => ({ ...prev, graduation_status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="not_graduated">Not Graduated</option>
                        <option value="graduated">Graduated</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Required Documents *</h3>
                  <div className="space-y-4">
                    <DocumentUpload
                      documentType="college_id_front"
                      label="College ID Card - Front"
                      description="Upload the front side of your college ID card (JPG, PNG, PDF)"
                      onUploadSuccess={(doc) => setUploadedDocs(prev => ({ ...prev, college_id_front: doc }))}
                      existingFile={uploadedDocs.college_id_front}
                    />

                    <DocumentUpload
                      documentType="college_id_back"
                      label="College ID Card - Back"
                      description="Upload the back side of your college ID card (JPG, PNG, PDF)"
                      onUploadSuccess={(doc) => setUploadedDocs(prev => ({ ...prev, college_id_back: doc }))}
                      existingFile={uploadedDocs.college_id_back}
                    />

                    <DocumentUpload
                      documentType="marks_memo"
                      label="Marks Memo / Educational Certificate"
                      description="Upload your latest marks memo or educational certificate (JPG, PNG, PDF)"
                      onUploadSuccess={(doc) => setUploadedDocs(prev => ({ ...prev, marks_memo: doc }))}
                      existingFile={uploadedDocs.marks_memo}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 h-11 w-full md:w-auto"
                  >
                    {loading ? 'Saving...' : 'Complete Profile'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

          </CardContent>
        </Card>

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
};

export default ProfileCompletionPageSimple;
