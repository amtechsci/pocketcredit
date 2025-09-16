import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Key, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Admin login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Admin login successful!');
        navigate('/admin/dashboard');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="container mx-auto px-4 max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/auth')}
          className="mb-6 p-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to User Login
        </Button>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-6">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#DC2626' }}
              >
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-semibold" style={{ color: '#1E2A3B' }}>
                Admin Portal
              </span>
            </div>
            
            <CardTitle style={{ color: '#1E2A3B' }}>
              Admin & Staff Login
            </CardTitle>
            <CardDescription className="text-base">
              Access the administrative dashboard with your credentials
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@pocketcredit.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                style={{ backgroundColor: '#DC2626' }}
                className="w-full hover:bg-red-700"
              >
                {(loading || isLoading) ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="pt-4 border-t">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Demo Credentials:</h4>
                <p className="text-sm text-blue-700 mb-1">
                  <strong>Email:</strong> admin@pocketcredit.com
                </p>
                <p className="text-sm text-blue-700">
                  <strong>Password:</strong> admin123
                </p>
              </div>
            </div>

            {/* Security Note */}
            <div className="text-center pt-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
                <Shield className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">
                  Admin access only - All activities are logged
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
