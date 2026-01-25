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

interface EmploymentQuickCheckForm {
  employment_type: string;
  income_range: string;
  eligible_loan_amount: number;
  payment_mode: string;
  date_of_birth: string;
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

  // Helper functions to convert date formats
  const convertDDMMYYYYtoYYYYMMDD = (ddmmyyyy: string): string => {
    // Input format: DD/MM/YYYY
    // Output format: YYYY-MM-DD
    if (!ddmmyyyy) return '';
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const convertYYYYMMDDtoDDMMYYYY = (yyyymmdd: string): string => {
    // Input format: YYYY-MM-DD
    // Output format: DD/MM/YYYY
    if (!yyyymmdd) return '';
    const parts = yyyymmdd.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const validateDateFormat = (date: string): { valid: boolean; error: string } => {
    // Validate DD/MM/YYYY format
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(date)) {
      return { valid: false, error: 'Please enter date in DD/MM/YYYY format' };
    }
    
    const [day, month, year] = date.split('/').map(Number);
    
    // Check valid ranges
    if (month < 1 || month > 12) {
      return { valid: false, error: 'Month must be between 01 and 12' };
    }
    
    if (day < 1 || day > 31) {
      return { valid: false, error: 'Day must be between 01 and 31' };
    }
    
    if (year < 1900 || year > new Date().getFullYear()) {
      return { valid: false, error: 'Please enter a valid year' };
    }
    
    // Check if date is valid (handles things like 31/02/2024)
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || 
        dateObj.getMonth() !== month - 1 || 
        dateObj.getDate() !== day) {
      return { valid: false, error: 'This date does not exist in the calendar' };
    }
    
    return { valid: true, error: '' };
  };

  const formatDateInput = (input: string): string => {
    // Remove all non-numeric characters
    const numbers = input.replace(/\D/g, '');
    
    // Limit to 8 digits (DDMMYYYY)
    const limited = numbers.slice(0, 8);
    
    // Add slashes automatically
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2); // DD
      if (limited.length >= 3) {
        formatted += '/' + limited.slice(2, 4); // MM
      }
      if (limited.length >= 5) {
        formatted += '/' + limited.slice(4, 8); // YYYY
      }
    }
    
    return formatted;
  };

  const handleEmploymentDOBChange = (value: string) => {
    const formatted = formatDateInput(value);
    setEmploymentQuickCheckData(prev => ({ ...prev, date_of_birth: formatted }));
    
    // Only validate if user has entered the full format
    if (formatted.length === 10) {
      const validation = validateDateFormat(formatted);
      setDobError(validation.error);
    } else if (formatted.length > 0 && formatted.length < 10) {
      setDobError('Please complete the date (DD/MM/YYYY)');
    } else {
      setDobError('');
    }
  };

  const handleStudentDOBChange = (value: string) => {
    const formatted = formatDateInput(value);
    setStudentFormData(prev => ({ ...prev, date_of_birth: formatted }));
    
    // Only validate if user has entered the full format
    if (formatted.length === 10) {
      const validation = validateDateFormat(formatted);
      setStudentDobError(validation.error);
    } else if (formatted.length > 0 && formatted.length < 10) {
      setStudentDobError('Please complete the date (DD/MM/YYYY)');
    } else {
      setStudentDobError('');
    }
  };

  const [employmentQuickCheckData, setEmploymentQuickCheckData] = useState<EmploymentQuickCheckForm>({
    employment_type: '',
    income_range: '',
    eligible_loan_amount: 0,
    payment_mode: '',
    date_of_birth: '',
  });

  const [studentFormData, setStudentFormData] = useState<StudentForm>({
    date_of_birth: '',
    college_name: '',
    graduation_status: 'not_graduated',
  });


  // Student document upload states
  const [uploadedDocs, setUploadedDocs] = useState<{
    college_id_front?: any;
    college_id_back?: any;
    marks_memo?: any;
  }>({});

  // Income ranges from database
  const [incomeRanges, setIncomeRanges] = useState<Array<{
    value: string;
    label: string;
    min_salary: number;
    max_salary: number | null;
    loan_limit: number;
    hold_permanent: boolean;
    tier_name: string;
  }>>([]);
  const [loadingIncomeRanges, setLoadingIncomeRanges] = useState(false);

  // Date validation error states
  const [dobError, setDobError] = useState('');
  const [studentDobError, setStudentDobError] = useState('');

  // Initialize current step from user data
  useEffect(() => {
    // Don't reset step if profile is already completed
    if (user && user.profile_completion_step && !user.profile_completed) {
      // If user doesn't have employment_type, they need to complete step 1 first
      // This handles the case where user was put on hold at step 1 and admin unholds them
      if (!user.employment_type) {
        setCurrentStep(1);
        return;
      }
      
      // Step 2 (Basic Information) is removed - skip to step 3 for students, or redirect to dashboard for salaried
      let newStep = user.profile_completion_step;
      if (newStep === 2) {
        // If profile_completion_step is 2 but profile is completed, redirect to dashboard
        if (user.profile_completed) {
          navigate('/dashboard', { replace: true });
          return;
        }
        // For students, step 2 was skipped, so go to step 3
        if (user.employment_type === 'student') {
          newStep = 3;
        } else {
          // For salaried users, if step 2 is set but not completed, redirect to dashboard
          navigate('/dashboard', { replace: true });
          return;
        }
      }
      
      if (newStep !== currentStep && !stepUpdatedRef.current) {
        stepUpdatedRef.current = true;
        setCurrentStep(newStep);
        setTimeout(() => { stepUpdatedRef.current = false; }, 100);
      }
    }
  }, [user?.profile_completion_step, user?.profile_completed, user?.employment_type, navigate]);

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      // Initialize employment quick check data if it exists
      if (user.date_of_birth) {
        setEmploymentQuickCheckData(prev => ({
          ...prev,
          date_of_birth: convertYYYYMMDDtoDDMMYYYY(user.date_of_birth || '')
        }));
      }

      // Initialize student form data if it exists
      if (user.employment_type === 'student' && user.date_of_birth) {
        setStudentFormData(prev => ({
          ...prev,
          date_of_birth: convertYYYYMMDDtoDDMMYYYY(user.date_of_birth || '')
        }));
      }
    }
  }, [user?.id]);

  // Redirect if user is on hold
  useEffect(() => {
    if (user && user.status === 'on_hold') {
      navigate('/hold-status', { replace: true });
    }
  }, [user, navigate]);

  // Redirect if user is active and has completed employment quick check (step 2) AND profile is completed
  // If user was on hold at step 1 and admin unholds, profile_completed will be false,
  // so they'll stay on profile completion to complete step 1 again
  useEffect(() => {
    if (user && user.status === 'active' && user.profile_completion_step >= 2 && user.profile_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (user && user.profile_completed && user.status !== 'on_hold') {
      navigate('/dashboard');
    }
  }, [user, navigate]);


  // Redirect to dashboard if somehow user ends up on step 2 (which is removed)
  useEffect(() => {
    if (currentStep === 2) {
      console.log('Step 2 is removed, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [currentStep, navigate]);

  // Fetch income ranges from API
  useEffect(() => {
    const fetchIncomeRanges = async () => {
      setLoadingIncomeRanges(true);
      try {
        console.log('Fetching income ranges from API...');
        const response = await fetch('/api/employment-quick-check/income-ranges');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Income ranges API response:', result);

        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          console.log('Setting income ranges:', result.data);
          setIncomeRanges(result.data);
        } else {
          console.warn('No income ranges found in response, using fallback');
          // Fallback to default ranges if API returns empty or invalid data
          setIncomeRanges([
            { value: '1k-20k', label: '₹1,000 to ₹20,000', min_salary: 1000, max_salary: 20000, loan_limit: 10000, hold_permanent: true, tier_name: 'Basic' },
            { value: '20k-30k', label: '₹20,000 to ₹30,000', min_salary: 20000, max_salary: 30000, loan_limit: 15000, hold_permanent: false, tier_name: 'Standard' },
            { value: '30k-40k', label: '₹30,000 to ₹40,000', min_salary: 30000, max_salary: 40000, loan_limit: 25000, hold_permanent: false, tier_name: 'Premium' },
            { value: 'above-40k', label: 'Above ₹40,000', min_salary: 40000, max_salary: null, loan_limit: 50000, hold_permanent: false, tier_name: 'Elite' }
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch income ranges:', error);
        // Fallback to default ranges if API fails
        setIncomeRanges([
          { value: '1k-20k', label: '₹1,000 to ₹20,000', min_salary: 1000, max_salary: 20000, loan_limit: 10000, hold_permanent: true, tier_name: 'Basic' },
          { value: '20k-30k', label: '₹20,000 to ₹30,000', min_salary: 20000, max_salary: 30000, loan_limit: 15000, hold_permanent: false, tier_name: 'Standard' },
          { value: '30k-40k', label: '₹30,000 to ₹40,000', min_salary: 30000, max_salary: 40000, loan_limit: 25000, hold_permanent: false, tier_name: 'Premium' },
          { value: 'above-40k', label: 'Above ₹40,000', min_salary: 40000, max_salary: null, loan_limit: 50000, hold_permanent: false, tier_name: 'Elite' }
        ]);
      } finally {
        setLoadingIncomeRanges(false);
      }
    };

    fetchIncomeRanges();
  }, []);

  const calculateLoanAmount = (incomeRange: string): number => {
    const range = incomeRanges.find(r => r.value === incomeRange);
    return range ? range.loan_limit : 0;
  };

  const handleEmploymentQuickCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData: any = {
        employment_type: employmentQuickCheckData.employment_type
      };

      if (employmentQuickCheckData.employment_type === 'salaried') {
        // Age validation for salaried employees
        if (!employmentQuickCheckData.date_of_birth) {
          toast.error('Please enter your date of birth');
          setLoading(false);
          return;
        }

        // Validate date format
        const dobValidation = validateDateFormat(employmentQuickCheckData.date_of_birth);
        if (!dobValidation.valid) {
          toast.error(dobValidation.error);
          setDobError(dobValidation.error);
          setLoading(false);
          return;
        }

        // Convert DD/MM/YYYY to YYYY-MM-DD for backend
        const dobFormatted = convertDDMMYYYYtoYYYYMMDD(employmentQuickCheckData.date_of_birth);

        submitData.income_range = employmentQuickCheckData.income_range;
        submitData.eligible_loan_amount = employmentQuickCheckData.eligible_loan_amount;
        submitData.payment_mode = employmentQuickCheckData.payment_mode;
        submitData.date_of_birth = dobFormatted; // Send in YYYY-MM-DD format to backend
        // Note: Age validation (> 45) is handled by backend, which will put user on hold
      }

      const response = await apiService.saveEmploymentQuickCheck(submitData);

      if (response && response.data) {
        if (response.data.eligible) {
          toast.success('Eligibility verified! Please continue with your profile.');
          await refreshUser();

          // OLD: For salaried users, pre-fetch Digitap data for next step
          /*
          if (employmentQuickCheckData.employment_type === 'salaried' && !digitapCalled) {
            console.log('🔄 Pre-fetching Digitap data after employment verification...');
            // Don't await this - let it run in background
            setTimeout(() => {
              if (currentStep === 2 && !digitapCalled) {
                fetchDigitapData();
              }
            }, 500);
          }
          */

          // NEW: Skip everything and go to dashboard
          console.log('Skipping API calls, redirecting to dashboard...');
          toast.success('Eligibility verified! Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          // Handle hold status - check for hold indicators in response
          const responseData = response.data as any;
          if (responseData.hold_permanent || responseData.hold_reason) {
            toast.error(responseData.message || 'Application has been placed on hold.');
            // Refresh user data to get updated status
            await refreshUser();
            // Redirect to hold status page
            setTimeout(() => {
              navigate('/hold-status', { replace: true });
            }, 1000);
          } else {
            toast.error(responseData.message || 'You are not eligible at this time.');
          }
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

  const handleStudentCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate date format
    const dobValidation = validateDateFormat(studentFormData.date_of_birth);
    if (!dobValidation.valid) {
      toast.error(dobValidation.error);
      setStudentDobError(dobValidation.error);
      return;
    }

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
      // Convert date format before sending to backend
      const formattedData = {
        ...studentFormData,
        date_of_birth: convertDDMMYYYYtoYYYYMMDD(studentFormData.date_of_birth)
      };
      const response = await apiService.updateStudentProfile(formattedData);

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
                      <option value="self_employed">Self-employed</option>
                      <option value="part_time">Part-time</option>
                      <option value="freelancer">Freelancer</option>
                      <option value="homemaker">Homemaker</option>
                      <option value="retired">Retired</option>
                      <option value="no_job">Don't have Job</option>
                      <option value="others">Others</option>
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
                          disabled={loadingIncomeRanges}
                        >
                          <option value="">
                            {loadingIncomeRanges ? 'Loading income ranges...' : 'Select income range'}
                          </option>
                          {incomeRanges.map((range) => (
                            <option key={range.value} value={range.value}>
                              {range.label}
                            </option>
                          ))}
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
                        <Label htmlFor="date_of_birth">Date of Birth *</Label>
                        <Input
                          id="date_of_birth"
                          type="text"
                          placeholder="dd/mm/yyyy"
                          value={employmentQuickCheckData.date_of_birth}
                          onChange={(e) => handleEmploymentDOBChange(e.target.value)}
                          required
                          className={`h-11 ${dobError ? 'border-red-500' : ''}`}
                        />
                        {dobError ? (
                          <p className="text-xs text-red-600">{dobError}</p>
                        ) : (
                          <p className="text-xs text-gray-500">You must be at least 18 years old</p>
                        )}
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
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={studentFormData.date_of_birth}
                      onChange={(e) => handleStudentDOBChange(e.target.value)}
                      required
                      className={`h-11 w-full ${studentDobError ? 'border-red-500' : ''}`}
                    />
                    {studentDobError ? (
                      <p className="text-xs text-red-600">{studentDobError}</p>
                    ) : (
                      <p className="text-xs text-gray-600">
                        You must be at least 19 years old to apply as a student
                      </p>
                    )}
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
