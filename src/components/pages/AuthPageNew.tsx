import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Key, Eye, EyeOff, Mail, User, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [loading, setLoading] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration form state
  const [regData, setRegData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: ''
  });

  const validateMobileNumber = (number: string) => {
    const mobileRegex = /^\+91[6-9]\d{9}$/;
    return mobileRegex.test(number);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(loginEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (loginPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const result = await login(loginEmail, loginPassword);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(regData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!validateMobileNumber(regData.phone)) {
      toast.error('Please enter a valid mobile number with +91 prefix');
      return;
    }

    if (regData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (regData.password !== regData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!regData.first_name || !regData.last_name) {
      toast.error('Please enter your full name');
      return;
    }

    if (!regData.date_of_birth) {
      toast.error('Please enter your date of birth');
      return;
    }

    if (!regData.gender) {
      toast.error('Please select your gender');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...userData } = regData;
      const result = await register(userData);
      if (result.success) {
        toast.success('Registration successful!');
        navigate('/dashboard');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
      case 'forgot': return 'Enter your email to reset your password.';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="container mx-auto px-4 max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/home')}
          className="mb-6 p-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-6">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#0052FF' }}
              >
                <span className="text-white font-bold text-xl">PC</span>
              </div>
              <span className="text-2xl font-semibold" style={{ color: '#1E2A3B' }}>
                Pocket Credit
              </span>
            </div>
            
            <CardTitle style={{ color: '#1E2A3B' }}>
              {getTitle()}
            </CardTitle>
            <CardDescription className="text-base">
              {getDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {authMode === 'signin' ? (
              // Login Form
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || isLoading}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full"
                >
                  {(loading || isLoading) ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            ) : authMode === 'signup' ? (
              // Registration Form
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="first-name"
                        type="text"
                        placeholder="First name"
                        value={regData.first_name}
                        onChange={(e) => setRegData({...regData, first_name: e.target.value})}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      placeholder="Last name"
                      value={regData.last_name}
                      onChange={(e) => setRegData({...regData, last_name: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={regData.email}
                      onChange={(e) => setRegData({...regData, email: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={regData.phone}
                      onChange={(e) => setRegData({...regData, phone: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Include +91 prefix (e.g., +919876543210)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date-of-birth">Date of Birth</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="date-of-birth"
                        type="date"
                        value={regData.date_of_birth}
                        onChange={(e) => setRegData({...regData, date_of_birth: e.target.value})}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={regData.gender} onValueChange={(value) => setRegData({...regData, gender: value})}>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={regData.password}
                      onChange={(e) => setRegData({...regData, password: e.target.value})}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={regData.confirmPassword}
                      onChange={(e) => setRegData({...regData, confirmPassword: e.target.value})}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || isLoading}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full"
                >
                  {(loading || isLoading) ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            ) : (
              // Forgot Password Form
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  disabled={loading}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full"
                >
                  {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                </Button>
              </div>
            )}

            {/* Auth Mode Toggle */}
            <div className="text-center pt-4 border-t">
              {authMode === 'signin' ? (
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setAuthMode('signup')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </p>
              ) : authMode === 'signup' ? (
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => setAuthMode('signin')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Remember your password?{' '}
                  <button
                    onClick={() => setAuthMode('signin')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>

            {/* Forgot Password Link */}
            {authMode === 'signin' && (
              <div className="text-center">
                <button
                  onClick={() => setAuthMode('forgot')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
