import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const AdditionalInformationPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [maritalStatus, setMaritalStatus] = useState<string>('');
  const [spokenLanguage, setSpokenLanguage] = useState<string[]>([]);
  const [workExperience, setWorkExperience] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    checkCompletionAndLoad();
  }, [user?.id, refreshUser, navigate]);

  const checkCompletionAndLoad = async () => {
    if (!user?.id) {
      setCheckingStatus(false);
      return;
    }

    try {
      // Fetch latest user profile to check if additional info is already saved
      const profileResponse = await apiService.getUserProfile();
      const latestUser = profileResponse.status === 'success' && profileResponse.data?.user 
        ? profileResponse.data.user 
        : user;

      console.log('🔍 Checking additional information:', {
        marital_status: latestUser?.marital_status,
        spoken_language: latestUser?.spoken_language,
        work_experience_range: latestUser?.work_experience_range
      });

      // Check if all required fields are already set
      if (latestUser?.marital_status && latestUser?.spoken_language && latestUser?.work_experience_range) {
        console.log('✅ Additional information already completed, redirecting to application under review');
        navigate('/application-under-review', { replace: true });
        return;
      }

      // Load existing data if partially filled
      if (latestUser?.marital_status) {
        setMaritalStatus(latestUser.marital_status);
      }
      if (latestUser?.spoken_language) {
        setSpokenLanguage(latestUser.spoken_language.split(',').filter(Boolean));
      }
      if (latestUser?.work_experience_range) {
        setWorkExperience(latestUser.work_experience_range);
      }

      setCheckingStatus(false);
    } catch (error) {
      console.error('Error checking additional information status:', error);
      setCheckingStatus(false);
    }
  };

  const handleLanguageToggle = (language: string) => {
    setSpokenLanguage(prev => {
      if (prev.includes(language)) {
        return prev.filter(l => l !== language);
      } else {
        return [...prev, language];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!maritalStatus) {
      toast.error('Please select your marital status');
      return;
    }

    if (spokenLanguage.length === 0) {
      toast.error('Please select at least one spoken language');
      return;
    }

    if (!workExperience) {
      toast.error('Please select your work experience');
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiService.saveAdditionalInformation({
        marital_status: maritalStatus,
        spoken_language: spokenLanguage.join(','),
        work_experience: workExperience
      });

      if (response.success) {
        toast.success('Information saved successfully');
        // Refresh user context to update additional info fields
        await refreshUser();
        setTimeout(() => {
          navigate('/application-under-review');
        }, 1500);
      } else {
        toast.error(response.message || 'Failed to save information');
      }
    } catch (error: any) {
      console.error('Error saving additional information:', error);
      toast.error(error.message || 'Failed to save information. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while checking completion status
  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 pb-20 md:pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/residence-address')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Back</span>
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-12">
        <Card className="shadow-xl border-0">
          <CardContent className="p-4 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
              {/* Header */}
              <div className="text-center mb-6 md:mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                  </div>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  Additional Information
                </h1>
                <p className="text-sm md:text-base text-gray-600">
                  Please provide the following details to complete your application
                </p>
              </div>

              {/* Marital Status */}
              <div className="space-y-3">
                <Label className="text-base md:text-lg font-semibold text-gray-900">
                  Marital Status <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {['single', 'married', 'divorced', 'widow'].map((status) => (
                    <label
                      key={status}
                      className={`flex items-center justify-center p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        maritalStatus === status
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="maritalStatus"
                        value={status}
                        checked={maritalStatus === status}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-sm md:text-base font-medium capitalize">
                        {status === 'widow' ? 'Widow' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-6 md:my-8"></div>

              {/* Spoken Language */}
              <div className="space-y-3">
                <Label className="text-base md:text-lg font-semibold text-gray-900">
                  Spoken Language <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {['English', 'Hindi'].map((language) => (
                    <label
                      key={language}
                      className={`flex items-center justify-center p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        spokenLanguage.includes(language.toLowerCase())
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={spokenLanguage.includes(language.toLowerCase())}
                        onChange={() => handleLanguageToggle(language.toLowerCase())}
                        className="sr-only"
                      />
                      <span className="text-sm md:text-base font-medium">{language}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-6 md:my-8"></div>

              {/* Work Experience */}
              <div className="space-y-3">
                <Label className="text-base md:text-lg font-semibold text-gray-900">
                  Work Experience <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {[
                    { value: '0-2', label: '0-2 years' },
                    { value: '2-5', label: '2-5 years' },
                    { value: '5-8', label: '5-8 years' },
                    { value: '8+', label: 'More than 8 years' }
                  ].map((exp) => (
                    <label
                      key={exp.value}
                      className={`flex items-center justify-center p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        workExperience === exp.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="workExperience"
                        value={exp.value}
                        checked={workExperience === exp.value}
                        onChange={(e) => setWorkExperience(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-sm md:text-base font-medium text-center">
                        {exp.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Button - Hidden on mobile, shown on desktop */}
              <div className="hidden md:flex justify-center pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-w-[200px]"
                  size="lg"
                >
                  {submitting ? 'Submitting...' : 'Continue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Button for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-10 shadow-lg">
        <form onSubmit={handleSubmit}>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? 'Submitting...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdditionalInformationPage;

