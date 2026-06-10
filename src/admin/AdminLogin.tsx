import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Phone, Mail } from 'lucide-react';
import { adminApiService } from '../services/adminApi';
import type { AdminUser } from '../AdminApp';

interface AdminLoginProps {
  onLogin: (user: AdminUser) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [loginMethod, setLoginMethod] = useState<'email' | 'mobile'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const validateMobileNumber = (number: string) => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(number);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await adminApiService.login(email, password);
      
      if (response.status === 'success' && response.data) {
        onLogin(response.data.admin);
      } else {
        setError(response.message || 'Invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!validateMobileNumber(mobile)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await adminApiService.sendOTP(mobile);
      
      if (response.status === 'success') {
        setShowOtp(true);
        setTimer(60);
        setError('');
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      setError(error.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 4) {
      setError('Please enter a valid 4-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await adminApiService.verifyOTP(mobile, otp);
      
      if (response.status === 'success' && response.data) {
        onLogin(response.data.admin);
      } else {
        // Set clear error message
        const errorMsg = response.message || 'Invalid OTP';
        setError(errorMsg);
        // Keep error visible - don't clear it automatically
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      // Extract clear error message from response
      const errorMsg = error.response?.data?.message || 'OTP verification failed. Please try again.';
      setError(errorMsg);
      // Keep error visible - don't clear it automatically
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = () => {
    if (timer > 0) return;
    sendOtp();
  };

  const switchLoginMethod = (method: 'email' | 'mobile') => {
    setLoginMethod(method);
    setError('');
    setShowOtp(false);
    setOtp('');
    setMobile('');
    setEmail('');
    setPassword('');
    setTimer(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Admin & Staff Login</h2>
            <p className="text-sm text-gray-500">Access the administrative dashboard</p>
          </div>

          {/* Login Method Toggle */}
          <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => switchLoginMethod('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                loginMethod === 'email'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">Email</span>
            </button>
            <button
              type="button"
              onClick={() => switchLoginMethod('mobile')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                loginMethod === 'mobile'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm font-medium">Mobile</span>
            </button>
          </div>

          {/* Email/Password Login */}
          {loginMethod === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                    placeholder="admin@pocketcredit.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-400 rounded-md p-4">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  {error.includes('IP') && (
                    <p className="text-xs text-red-600 mt-1">Please contact your administrator to whitelist your IP address.</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Mobile OTP Login */}
          {loginMethod === 'mobile' && (
            <div className="space-y-6">
              {!showOtp ? (
                <>
                  <div>
                    <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="mobile"
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border-2 border-red-400 rounded-md p-4">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                      {error.includes('IP') && (
                        <p className="text-xs text-red-600 mt-1">Please contact your administrator to whitelist your IP address.</p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={isLoading || !validateMobileNumber(mobile)}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </>
              ) : (
                <form onSubmit={verifyOtp} className="space-y-6">
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                      Enter OTP
                    </label>
                    <div className="relative">
                      <input
                        id="otp"
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors text-center text-2xl tracking-widest"
                        placeholder="0000"
                        maxLength={4}
                        required
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      OTP sent to {mobile}
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 border-2 border-red-400 rounded-md p-4">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                      {error.includes('IP') && (
                        <p className="text-xs text-red-600 mt-1">Please contact your administrator to whitelist your IP address.</p>
                      )}
                      {error.includes('OTP') && !error.includes('expired') && (
                        <p className="text-xs text-red-600 mt-1">Please check the OTP sent to your mobile number and try again.</p>
                      )}
                      {error.includes('expired') && (
                        <p className="text-xs text-red-600 mt-1">Please request a new OTP.</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOtp(false);
                        setOtp('');
                        setError('');
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || otp.length !== 4}
                      className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                    >
                      {isLoading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={timer > 0 || isLoading}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
