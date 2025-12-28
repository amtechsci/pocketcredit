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
  const digitapCalledRef = useRef(false);

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
    date_of_birth: '',
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
  const [showManualForm, setShowManualForm] = useState(false); // Control manual form visibility

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
      const newStep = user.profile_completion_step;
      if (newStep !== currentStep && !stepUpdatedRef.current) {
        stepUpdatedRef.current = true;
        setCurrentStep(newStep);
        setTimeout(() => { stepUpdatedRef.current = false; }, 100);
      }
    }
  }, [user?.profile_completion_step, user?.profile_completed]);

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
        // Convert backend format (YYYY-MM-DD) to display format (DD/MM/YYYY)
        formattedDOB = convertYYYYMMDDtoDDMMYYYY(user.date_of_birth);
      }

      setBasicFormData({
        full_name: fullName,
        pan_number: user.pan_number || '',
        gender: user.gender ? user.gender.toLowerCase() : '',
        latitude: lat,
        longitude: lng,
        date_of_birth: formattedDOB,
      });

      // Also initialize employment quick check data if it exists
      if (user.date_of_birth) {
        setEmploymentQuickCheckData(prev => ({
          ...prev,
          date_of_birth: convertYYYYMMDDtoDDMMYYYY(user.date_of_birth)
        }));
      }

      // Initialize student form data if it exists
      if (user.employment_type === 'student' && user.date_of_birth) {
        setStudentFormData(prev => ({
          ...prev,
          date_of_birth: convertYYYYMMDDtoDDMMYYYY(user.date_of_birth)
        }));
      }
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
    const profileComplete = user?.profile_completed;

    console.log('Digitap trigger check:', {
      currentStep,
      userEmploymentType: user?.employment_type,
      formEmploymentType: employmentQuickCheckData.employment_type,
      isSalaried,
      profileComplete,
      digitapCalled: digitapCalled,
      digitapCalledRef: digitapCalledRef.current
    });

    // Don't call Digitap if profile is already complete or if it's already been called
    if (currentStep === 2 && isSalaried && !digitapCalled && !digitapCalledRef.current && !profileComplete) {
      console.log('✅ Triggering Digitap API call... SKIPPED BY USER REQUEST');
      // digitapCalledRef.current = true; // Set ref immediately to prevent multiple calls
      // fetchDigitapData();

      // Force redirect if somehow we end up here
      window.location.href = '/dashboard';

      // Safety: Show manual form after 20 seconds if Digitap hasn't responded
      // const timeoutId = setTimeout(() => {
      //   if (!showPrefillConfirm && !showManualForm && !loading) {
      //     console.log('⏰ Digitap timeout - showing manual form');
      //     setShowManualForm(true);
      //     toast.info('Taking too long? You can enter details manually');
      //   }
      // }, 20000); // 20 seconds

      // return () => clearTimeout(timeoutId);
      return;
    }
  }, [currentStep, user?.employment_type, employmentQuickCheckData.employment_type, digitapCalled, user?.profile_completed]);

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

  const fetchDigitapData = async () => {
    setDigitapCalled(true);
    setFetchingPrefill(true);

    try {
      console.log('Fetching Digitap prefill data...');
      const response = await apiService.fetchDigitapPrefill();

      if (response && response.data) {
        console.log('Digitap data received:', response.data);

        // Show confirmation dialog with the fetched data
        setDigitapData(response.data);
        toast.success('We found your details automatically! Saving and redirecting...');

        // Auto-save and redirect
        try {
          console.log('Auto-saving Digitap data...');
          const saveResponse = await apiService.saveDigitapPrefill({
            name: response.data.name || '',
            dob: response.data.dob || '',
            pan: response.data.pan || '',
            gender: response.data.gender ? response.data.gender.toLowerCase() : '',
            email: response.data.email || '',
            address: response.data.address || []
          });

          if (saveResponse && saveResponse.status === 'success') {
            console.log('Digitap data saved automatically');
            // Allow a moment for the toast to be seen
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1000);
          } else {
            console.error('Failed to auto-save, redirecting anyway');
            window.location.href = '/dashboard';
          }
        } catch (saveError) {
          console.error('Auto-save error:', saveError);
          window.location.href = '/dashboard';
        }
      } else if ((response as any)?.hold_applied) {
        // Credit score too low - hold applied
        const creditScore = (response as any).credit_score;
        const holdDays = (response as any).hold_days || 60;

        console.log(`❌ Credit score (${creditScore}) below 630 - applying ${holdDays}-day hold`);

        // Show detailed error message
        toast.error(
          (response as any).message ||
          `Your credit score (${creditScore}) is below our minimum requirement of 630. You can reapply after ${holdDays} days.`,
          { duration: 6000 }
        );

        // Wait a bit then redirect to dashboard where hold banner will be shown
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 4000);
      } else {
        // API failed or returned no data - SKIP manual entry and go to Dashboard
        console.log('Digitap API failed or no data, skipping manual entry...');
        // setShowManualForm(true); // OLD: Show manual form when Digitap fails
        toast.info('Skipping manual entry, redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      }
    } catch (error) {
      console.error('Digitap fetch error:', error);
      // setShowManualForm(true); // OLD: Show manual form on error
      toast.info('Skipping manual entry, redirecting to dashboard...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
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
        name: digitapData.name || '',
        dob: digitapData.dob || '',
        pan: digitapData.pan || '',
        gender: digitapData.gender ? digitapData.gender.toLowerCase() : '',
        email: digitapData.email || '',
        address: digitapData.address || []
      });

      if (saveResponse && saveResponse.status === 'success') {
        console.log('Digitap data saved to database');
        toast.success('Profile completed! Redirecting to dashboard...');

        // Use window.location.href for a hard redirect to avoid React state timing issues
        console.log('✅ Redirecting to dashboard with full page reload...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
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
    setShowManualForm(true); // Show manual form when user rejects Digitap data
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

        // Convert DD/MM/YYYY to YYYY-MM-DD for age calculation
        const dobFormatted = convertDDMMYYYYtoYYYYMMDD(employmentQuickCheckData.date_of_birth);
        const dob = new Date(dobFormatted);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear() -
          ((today.getMonth() < dob.getMonth() ||
            (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0);

        if (age > 45) {
          toast.error('Sorry, applicants above 45 years of age are not eligible at this time.');
          setLoading(false);
          return;
        }

        submitData.income_range = employmentQuickCheckData.income_range;
        submitData.eligible_loan_amount = employmentQuickCheckData.eligible_loan_amount;
        submitData.payment_mode = employmentQuickCheckData.payment_mode;
        submitData.date_of_birth = dobFormatted; // Send in YYYY-MM-DD format to backend
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

    if (!basicFormData.pan_number || basicFormData.pan_number.length !== 10) {
      toast.error('Please enter a valid PAN number (10 characters)');
      return;
    }

    // Validate PAN format
    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panPattern.test(basicFormData.pan_number.toUpperCase())) {
      toast.error('Invalid PAN format. Please enter a valid PAN number (e.g., ABCDE1234F)');
      return;
    }

    setLoading(true);
    try {
      // Call PAN validation API
      console.log('Validating PAN:', basicFormData.pan_number);
      const response = await apiService.validatePAN(basicFormData.pan_number.toUpperCase());

      if (response.status === 'success' && response.data) {
        console.log('PAN validated successfully, data saved:', response.data);

        toast.success('PAN validated! Your details have been saved automatically.');

        // Refresh user data
        await refreshUser();

        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        toast.error(response.message || 'Failed to validate PAN. Please try again.');
      }
    } catch (error: any) {
      console.error('Error validating PAN:', error);
      toast.error(error.response?.data?.message || 'Failed to validate PAN. Please try again.');
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
                  <>
                    <div className="mb-4 p-4 sm:p-6 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3 mb-4">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-green-900 mb-3">
                            We found your details!
                          </h3>
                          <div className="space-y-1.5 sm:space-y-2 text-sm text-gray-700 mb-4">
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
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              type="button"
                              onClick={handlePrefillConfirm}
                              disabled={loading}
                              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                            >
                              {loading ? 'Saving...' : 'Use These Details'}
                            </Button>
                            <Button
                              type="button"
                              onClick={handlePrefillReject}
                              variant="outline"
                              className="w-full sm:w-auto border-gray-300 text-gray-700"
                              disabled={loading}
                            >
                              Enter Manually
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Security Message */}
                    <div className="mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-green-700">
                        Your information is secured with 256-bit encryption
                      </p>
                    </div>
                  </>
                )}

                {/* Manual Form - Only show when Digitap fails or user clicks "Enter Manually" */}
                {showManualForm && (
                  <form onSubmit={handleBasicProfileSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pan_number">PAN Number *</Label>
                      <Input
                        id="pan_number"
                        value={basicFormData.pan_number}
                        onChange={(e) => setBasicFormData(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                        placeholder="Enter PAN number (e.g., ABCDE1234F)"
                        className="uppercase h-11"
                        maxLength={10}
                        pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                        required
                      />
                      <p className="text-xs text-gray-500">
                        We'll fetch your details automatically using your PAN number
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 h-11 w-full md:w-auto"
                      >
                        {loading ? 'Validating PAN...' : 'Continue'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </form>
                )}
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
