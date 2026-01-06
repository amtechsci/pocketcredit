import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Phone, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export function ChangeMobileNumberPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const validateMobileNumber = (number: string) => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(number);
  };

  const sendOtp = async () => {
    if (!validateMobileNumber(newMobileNumber)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    // Check if new number is same as current number
    if (newMobileNumber === user?.phone) {
      toast.error('New mobile number must be different from your current number');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ mobile: newMobileNumber }),
      });

      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        setShowOtp(true);
        setTimer(60);
        toast.success('OTP sent successfully to your new mobile number');
        
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
        console.error('OTP send failed:', result.message);
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Failed to send OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndChangeMobile = async () => {
    if (otp.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/change-mobile-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          new_mobile: newMobileNumber,
          otp: otp 
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        toast.success('Mobile number changed successfully!');
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        console.error('Mobile number change failed:', result.message);
        toast.error(result.message || 'Failed to change mobile number');
      }
    } catch (error) {
      console.error('Failed to change mobile number:', error);
      toast.error('Failed to change mobile number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = () => {
    if (timer > 0) return;
    sendOtp();
  };

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="container mx-auto px-4 max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-0">
            <div className="flex items-center justify-start mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
            <CardTitle style={{ color: '#1E2A3B' }}>
              Change Mobile Number
            </CardTitle>
            <CardDescription className="text-base">
              {!showOtp 
                ? 'Enter your new mobile number' 
                : 'Enter the OTP sent to your new mobile number'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!showOtp ? (
              // Mobile Number Input
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="current-mobile" className="text-sm font-medium text-gray-700">
                    Current Mobile Number
                  </label>
                  <Input
                    id="current-mobile"
                    type="tel"
                    value={user?.phone || ''}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="new-mobile" className="text-sm font-medium text-gray-700">
                    New Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="new-mobile"
                      type="tel"
                      placeholder="Enter new mobile number"
                      value={newMobileNumber}
                      onChange={(e) => setNewMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-10 border-1 border-gray-300 rounded-md"
                      maxLength={10}
                    />
                  </div>
                </div>

                <Button
                  onClick={sendOtp}
                  disabled={loading || !validateMobileNumber(newMobileNumber)}
                  className="w-full"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </div>
            ) : (
              // OTP Input
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium text-gray-700">
                    Enter OTP
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 4-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="text-center text-2xl tracking-widest border-1 border-gray-300 rounded-md"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 text-center">
                    OTP sent to {newMobileNumber}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={verifyOtpAndChangeMobile}
                    disabled={loading || otp.length !== 4}
                    className="flex-1"
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    {loading ? 'Verifying...' : 'Verify & Change'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowOtp(false);
                      setOtp('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-sm text-gray-600">
                      Resend OTP in {timer} seconds
                    </p>
                  ) : (
                    <button
                      onClick={resendOtp}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

