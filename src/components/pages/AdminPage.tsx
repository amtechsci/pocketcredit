import { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { Page } from '../../App';

interface AdminPageProps {
  onNavigate: (page: Page) => void;
  onAdminLogin: () => void;
}

export function AdminPage({ onNavigate, onAdminLogin }: AdminPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Demo admin credentials
    if (email === 'admin@pocketcredit.com' && password === 'admin123') {
      setTimeout(() => {
        setIsLoading(false);
        onAdminLogin();
      }, 1000);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setError('Invalid credentials. Use admin@pocketcredit.com / admin123');
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="w-full max-w-md p-6">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0052FF' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                Admin Portal
              </CardTitle>
              <CardDescription className="text-gray-600">
                Pocket Credit Management System
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@pocketcredit.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-mobile"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-mobile pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full btn-mobile"
                style={{ backgroundColor: '#0052FF' }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In to Admin Portal'}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-gray-600 mb-2">Demo Credentials:</p>
              <p className="text-xs text-gray-500">
                Email: admin@pocketcredit.com<br />
                Password: admin123
              </p>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => onNavigate('home')}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                ← Back to Main Site
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}