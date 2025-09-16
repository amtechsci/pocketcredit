import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Key } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../Logo';

export function AuthPage() {
  const navigate = useNavigate();
  const { loginWithOTP } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);


  const validateMobileNumber = (number: string) => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(number);
  };

  const sendOtp = async () => {
    if (!validateMobileNumber(mobileNumber)) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    if (!consentChecked) {
      toast.error('Please agree to the terms and conditions to continue');
      return;
    }

    // Set loading state immediately
    setLoading(true);
    
    try {
      // Call the API service directly to avoid context loading state conflicts
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for session management
        body: JSON.stringify({ mobile: mobileNumber }),
      });

      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        // On success, update the state IMMEDIATELY to show the OTP form
        setShowOtp(true);
        setTimer(60);
        toast.success('OTP sent successfully to your mobile number');
        
        // Timer countdown
        const interval = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Handle API errors
        console.error('OTP send failed:', result.message);
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (error) {
      // Handle network or other unexpected errors
      console.error('Failed to send OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      // This ALWAYS runs last, after the try or catch block
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithOTP(mobileNumber, otp);
      
      if (result.success) {
        toast.success('Login successful!');
        
        // Check if user needs to complete profile
        // The AuthContext will handle this based on profile_completion_step
        // For now, navigate to dashboard - the App component will handle routing
        navigate('/dashboard');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = () => {
    if (timer > 0) return;
    sendOtp();
  };

  const resetForm = () => {
    setMobileNumber('');
    setOtp('');
    setShowOtp(false);
    setTimer(0);
    setConsentChecked(false);
  };

  const switchAuthMode = (mode: 'signin' | 'signup' | 'forgot') => {
    setAuthMode(mode);
    resetForm();
  };

  const getTitle = () => {
    switch (authMode) {
      case 'signin': return 'Sign In to Your Account';
      case 'signup': return 'Create Your Account';
      case 'forgot': return 'Reset Your Password';
      default: return 'Authentication';
    }
  };

  const getDescription = () => {
    switch (authMode) {
      case 'signin': return 'Welcome back! Please sign in to continue.';
      case 'signup': return 'Join thousands of users who trust Pocket Credit for their financial needs.';
      case 'forgot': return 'Enter your mobile number to reset your password.';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="container mx-auto px-4 max-w-md">

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-6">
            {/* Logo */}
            <div className="flex items-center justify-center mb-4">
              <Logo size="lg" />
            </div>
            
            <CardTitle style={{ color: '#1E2A3B' }}>
              {getTitle()}
            </CardTitle>
            <CardDescription className="text-base">
              {getDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!showOtp ? (
              // Mobile Number Input
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <p className="text-xs text-gray-500">
                    Please enter phone number linked to your Aadhaar Card
                  </p>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-10"
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* Disclaimer and Consent */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="consent" className="text-xs text-gray-700 leading-relaxed" style={{ paddingLeft: '5px' }}>
                      By continuing, I hereby agree/authorize the following:
                    </label>
                  </div>
                  
                  <div className="ml-6 space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>1. PocketCredit{' '}
                      <button
                        onClick={() => window.open('/terms', '_blank')}
                        className="text-blue-600 hover:underline"
                      >
                        T&C
                      </button>
                      {' '}&{' '}
                      <button
                        onClick={() => window.open('/privacy', '_blank')}
                        className="text-blue-600 hover:underline"
                      >
                        privacy policy
                      </button>
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>2. I am an Indian citizen above 21 years of age.</p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>3. I give my explicit consent and authorize PocketCredit and its partners to contact me via calls, SMS, IVR, auto-calls, WhatsApp and email for transactional, service, and promotional purposes, even if I am registered on DND/NDNC. I confirm that I am applying for a financial product and this consent forms part of my application.</p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>4. I declare that I can read and understand English and agree to receive all documents/ correspondence in English.</p>
                  </div>
                </div>

                <Button
                  onClick={sendOtp}
                  disabled={loading || !validateMobileNumber(mobileNumber) || !consentChecked}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </div>
            ) : (
              // OTP Verification
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    OTP sent to <span className="font-medium">+91 {mobileNumber}</span>
                  </p>
                  <button
                    onClick={() => {
                      setShowOtp(false);
                      setOtp('');
                    }}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    Change number?
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="pl-10 text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 6-digit OTP sent to your mobile number
                  </p>
                </div>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend OTP in {timer} seconds
                    </p>
                  ) : (
                    <button
                      onClick={resendOtp}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <Button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full text-white hover:opacity-90"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
              </div>
            )}

            {/* Auth Mode Switcher */}
            {!showOtp && (
              <div className="space-y-4 pt-4 border-t">
                {authMode === 'signin' ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-600">
                      Don't have an account?{' '}
                      <button
                        onClick={() => switchAuthMode('signup')}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Sign Up
                      </button>
                    </p>
                    <button
                      onClick={() => switchAuthMode('forgot')}
                      className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                ) : authMode === 'signup' ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      Already have an account?{' '}
                      <button
                        onClick={() => switchAuthMode('signin')}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      Remember your password?{' '}
                      <button
                        onClick={() => switchAuthMode('signin')}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )}


            {/* Terms and Privacy */}
            <div className="text-center pt-4">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our{' '}
                <button
                  onClick={() => navigate('/terms')}
                  className="text-blue-600 hover:underline"
                >
                  Terms & Conditions
                </button>{' '}
                and{' '}
                <button
                  onClick={() => navigate('/privacy')}
                  className="text-blue-600 hover:underline"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700">
              Secured with 256-bit encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}