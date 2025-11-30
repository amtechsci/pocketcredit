import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, Clock, AlertCircle, ArrowRight, Info, Building2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const EmailVerificationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Personal Email State
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalOtp, setPersonalOtp] = useState('');
  const [personalOtpSent, setPersonalOtpSent] = useState(false);
  const [personalVerified, setPersonalVerified] = useState(false);
  const [personalSending, setPersonalSending] = useState(false);
  const [personalVerifying, setPersonalVerifying] = useState(false);
  const [personalTimer, setPersonalTimer] = useState(0);

  // Official Email State
  const [officialEmail, setOfficialEmail] = useState('');
  const [officialOtp, setOfficialOtp] = useState('');
  const [officialOtpSent, setOfficialOtpSent] = useState(false);
  const [officialVerified, setOfficialVerified] = useState(false);
  const [officialSending, setOfficialSending] = useState(false);
  const [officialVerifying, setOfficialVerifying] = useState(false);
  const [officialTimer, setOfficialTimer] = useState(0);
  const [skipOfficial, setSkipOfficial] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load existing verified emails if any
    if (user?.personal_email && user?.personal_email_verified) {
      setPersonalEmail(user.personal_email);
      setPersonalVerified(true);
    }
    if (user?.official_email && user?.official_email_verified) {
      setOfficialEmail(user.official_email);
      setOfficialVerified(true);
    }
  }, [user]);

  // Timer countdown for personal email
  useEffect(() => {
    if (personalTimer > 0) {
      const interval = setInterval(() => {
        setPersonalTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [personalTimer]);

  // Timer countdown for official email
  useEffect(() => {
    if (officialTimer > 0) {
      const interval = setInterval(() => {
        setOfficialTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [officialTimer]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendPersonalOtp = async () => {
    if (!personalEmail) {
      toast.error('Please enter your personal email address');
      return;
    }

    if (!validateEmail(personalEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setPersonalSending(true);
      const response = await apiService.sendEmailOtp(personalEmail, 'personal');
      
      if (response.success) {
        setPersonalOtpSent(true);
        setPersonalTimer(600); // 10 minutes
        toast.success('OTP sent to your personal email. Please check your inbox and spam folder.');
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Error sending personal email OTP:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setPersonalSending(false);
    }
  };

  const handleVerifyPersonalOtp = async () => {
    if (!personalOtp || personalOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setPersonalVerifying(true);
      const response = await apiService.verifyEmailOtp(personalEmail, personalOtp, 'personal');
      
      if (response.success) {
        setPersonalVerified(true);
        toast.success('Personal email verified successfully!');
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Error verifying personal email OTP:', error);
      toast.error(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setPersonalVerifying(false);
    }
  };

  const handleSendOfficialOtp = async () => {
    if (!officialEmail) {
      toast.error('Please enter your official email address');
      return;
    }

    if (!validateEmail(officialEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setOfficialSending(true);
      const response = await apiService.sendEmailOtp(officialEmail, 'official');
      
      if (response.success) {
        setOfficialOtpSent(true);
        setOfficialTimer(600); // 10 minutes
        toast.success('OTP sent to your official email. Please check your inbox and spam folder.');
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Error sending official email OTP:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOfficialSending(false);
    }
  };

  const handleVerifyOfficialOtp = async () => {
    if (!officialOtp || officialOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setOfficialVerifying(true);
      const response = await apiService.verifyEmailOtp(officialEmail, officialOtp, 'official');
      
      if (response.success) {
        setOfficialVerified(true);
        toast.success('Official email verified successfully!');
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Error verifying official email OTP:', error);
      toast.error(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setOfficialVerifying(false);
    }
  };

  const handleContinue = async () => {
    // Personal email is mandatory
    if (!personalVerified) {
      toast.error('Please verify your personal email address');
      return;
    }

    try {
      setSubmitting(true);
      // Navigate to residence address page
      toast.success('Email verification completed!');
      setTimeout(() => {
        navigate('/residence-address');
      }, 1500);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to proceed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 overflow-y-auto">
      {/* Header with Back Button */}
      <div className="bg-white border-b sticky top-0 z-10 mb-4 md:mb-6">
        <div className="max-w-3xl mx-auto px-4 py-3 md:py-4 flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">Email Verification</h1>
            <p className="text-gray-600 text-xs md:text-sm mt-1">Verify your email addresses to continue</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4">

        {/* Personal Email Section - Mandatory */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-xl flex items-center gap-2 flex-wrap">
              <Mail className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Enter personal mail id & validate via OTP
              <span className="text-red-500 text-sm md:text-base">*</span>
            </CardTitle>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              This is a mandatory field. Check your mail inbox & spam box also.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 pt-0">
            {!personalVerified ? (
              <>
                <div>
                  <Label htmlFor="personal_email" className="text-sm md:text-base">Personal Email Address</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      id="personal_email"
                      type="email"
                      value={personalEmail}
                      onChange={(e) => {
                        setPersonalEmail(e.target.value);
                        setPersonalOtpSent(false);
                        setPersonalOtp('');
                      }}
                      placeholder="Enter your personal email"
                      className="flex-1 text-sm md:text-base"
                      disabled={personalOtpSent}
                    />
                    {!personalOtpSent && (
                      <Button
                        onClick={handleSendPersonalOtp}
                        disabled={personalSending || !personalEmail}
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto whitespace-nowrap"
                      >
                        {personalSending ? 'Sending...' : 'Send OTP'}
                      </Button>
                    )}
                  </div>
                </div>

                {personalOtpSent && (
                  <>
                    <div>
                      <Label htmlFor="personal_otp" className="text-sm md:text-base">Enter OTP</Label>
                      <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <Input
                          id="personal_otp"
                          type="text"
                          value={personalOtp}
                          onChange={(e) => setPersonalOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          className="flex-1 text-sm md:text-base"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerifyPersonalOtp}
                          disabled={personalVerifying || personalOtp.length !== 6}
                          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto whitespace-nowrap"
                        >
                          {personalVerifying ? 'Verifying...' : 'Verify'}
                        </Button>
                      </div>
                      {personalTimer > 0 && (
                        <p className="text-xs md:text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          OTP expires in {formatTimer(personalTimer)}
                        </p>
                      )}
                      {personalTimer === 0 && personalOtpSent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSendPersonalOtp}
                          className="mt-2 text-xs md:text-sm"
                        >
                          Resend OTP
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="bg-green-50 border-l-4 border-green-400 p-3 md:p-4 rounded flex items-center gap-2 md:gap-3">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900 text-sm md:text-base">Personal Email Verified</p>
                  <p className="text-xs md:text-sm text-green-700">{personalEmail}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Official Email Section - Optional */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-xl flex items-center gap-2 flex-wrap">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Enter your official/company mail id & validate via OTP
            </CardTitle>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              This is optional, not mandatory.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 pt-0">
            {!skipOfficial && !officialVerified && (
              <>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 md:p-4 rounded mb-3 md:mb-4">
                  <p className="text-xs md:text-sm text-blue-800 flex items-start gap-2">
                    <Info className="w-3 h-3 md:w-4 md:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Note:</strong> By providing your official/company mail, you will get higher limits & your loan will be processed quickly
                    </span>
                  </p>
                </div>

                <div>
                  <Label htmlFor="official_email" className="text-sm md:text-base">Official/Company Email Address</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      id="official_email"
                      type="email"
                      value={officialEmail}
                      onChange={(e) => {
                        setOfficialEmail(e.target.value);
                        setOfficialOtpSent(false);
                        setOfficialOtp('');
                      }}
                      placeholder="Enter your official/company email"
                      className="flex-1 text-sm md:text-base"
                      disabled={officialOtpSent}
                    />
                    {!officialOtpSent && (
                      <Button
                        onClick={handleSendOfficialOtp}
                        disabled={officialSending || !officialEmail}
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto whitespace-nowrap"
                      >
                        {officialSending ? 'Sending...' : 'Send OTP'}
                      </Button>
                    )}
                  </div>
                </div>

                {officialOtpSent && (
                  <>
                    <div>
                      <Label htmlFor="official_otp" className="text-sm md:text-base">Enter OTP</Label>
                      <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <Input
                          id="official_otp"
                          type="text"
                          value={officialOtp}
                          onChange={(e) => setOfficialOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          className="flex-1 text-sm md:text-base"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerifyOfficialOtp}
                          disabled={officialVerifying || officialOtp.length !== 6}
                          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto whitespace-nowrap"
                        >
                          {officialVerifying ? 'Verifying...' : 'Verify'}
                        </Button>
                      </div>
                      {officialTimer > 0 && (
                        <p className="text-xs md:text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          OTP expires in {formatTimer(officialTimer)}
                        </p>
                      )}
                      {officialTimer === 0 && officialOtpSent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSendOfficialOtp}
                          className="mt-2 text-xs md:text-sm"
                        >
                          Resend OTP
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {officialVerified && (
              <div className="bg-green-50 border-l-4 border-green-400 p-3 md:p-4 rounded flex items-center gap-2 md:gap-3">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900 text-sm md:text-base">Official Email Verified</p>
                  <p className="text-xs md:text-sm text-green-700">{officialEmail}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="flex justify-end gap-3 md:gap-4 mt-4 md:mt-6 sticky bottom-0 bg-gray-50 pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:static">
          <Button
            onClick={handleContinue}
            disabled={submitting || !personalVerified}
            className="bg-blue-600 hover:bg-blue-700 min-w-[120px] w-full sm:w-auto"
          >
            {submitting ? 'Processing...' : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;

