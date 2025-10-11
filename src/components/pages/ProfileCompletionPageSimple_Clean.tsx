import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Upload
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface BasicProfileForm {
  full_name: string;
  pan_number: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  date_of_birth: string;
}

interface EmploymentQuickCheckForm {
  employment_type: string;
  monthly_salary: string;
  payment_mode: string;
  designation: string;
}

interface StudentForm {
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
    pincode: '',
    latitude: null,
    longitude: null,
    date_of_birth: '',
  });

  const [employmentQuickCheckData, setEmploymentQuickCheckData] = useState<EmploymentQuickCheckForm>({
    employment_type: '',
    monthly_salary: '',
    payment_mode: '',
    designation: '',
  });

  const [studentFormData, setStudentFormData] = useState<StudentForm>({
    college_name: '',
    graduation_status: 'not_graduated',
  });

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
        pincode: user.pincode || '',
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

  // Auto-capture GPS location when Step 2 is reached
  useEffect(() => {
    if (currentStep === 2 && !basicFormData.latitude && !basicFormData.longitude) {
      captureLocation();
    }
  }, [currentStep, basicFormData.latitude, basicFormData.longitude]);

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

  const handleEmploymentQuickCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData: any = {
        employment_type: employmentQuickCheckData.employment_type
      };

      if (employmentQuickCheckData.employment_type === 'salaried') {
        submitData.monthly_salary = parseFloat(employmentQuickCheckData.monthly_salary);
        submitData.payment_mode = employmentQuickCheckData.payment_mode;
        submitData.designation = employmentQuickCheckData.designation;
      }

      const response = await apiService.saveEmploymentQuickCheck(submitData);

      if (response.success) {
        if (response.data.eligible) {
          toast.success('Eligibility verified! Please continue with your profile.');
          await refreshUser();
        } else {
          toast.error(response.data.message || 'You are not eligible at this time.');
        }
      } else {
        toast.error(response.message || 'Failed to verify eligibility');
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
      const response = await apiService.updateBasicProfile(basicFormData);
      
      if (response.status === 'success' && response.data) {
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
    setLoading(true);
    try {
      const response = await apiService.updateStudentProfile(studentFormData);
      
      if (response.status === 'success' && response.data) {
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
      case 3: return 'College Information';
      default: return 'Profile Completion';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Please select your employment type to proceed';
      case 2: return 'Please provide your basic information';
      case 3: return 'Please provide your college details';
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
              {currentStep === 3 && <MapPin className="w-5 h-5" />}
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
                        <Label htmlFor="monthly_salary">Monthly Net Salary *</Label>
                        <Input
                          id="monthly_salary"
                          type="number"
                          value={employmentQuickCheckData.monthly_salary}
                          onChange={(e) => setEmploymentQuickCheckData(prev => ({ ...prev, monthly_salary: e.target.value }))}
                          placeholder="Enter monthly salary"
                          required
                          min="1"
                        />
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
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      value={basicFormData.pincode}
                      onChange={(e) => setBasicFormData(prev => ({ ...prev, pincode: e.target.value }))}
                      placeholder="Enter pincode"
                      required
                      className="h-11"
                      maxLength={6}
                    />
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
            )}

            {/* Step 3: Student College Information */}
            {currentStep === 3 && user?.employment_type === 'student' && (
              <form onSubmit={handleStudentCollegeSubmit} className="space-y-6">
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
                    <div className="space-y-2">
                      <Label>College ID Card (Front & Back) *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Upload front and back of your college ID card</p>
                        <p className="text-xs text-gray-500 mt-1">Supported formats: JPG, PNG, PDF (Max 5MB each)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Marks Memo / Educational Certificate *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Upload your latest marks memo or educational certificate</p>
                        <p className="text-xs text-gray-500 mt-1">Supported formats: JPG, PNG, PDF (Max 5MB each)</p>
                      </div>
                    </div>
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

            {currentStep === 3 && user?.employment_type !== 'student' && (
              <div className="text-center py-8">
                <p className="text-gray-600">This step is only required for students.</p>
              </div>
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
