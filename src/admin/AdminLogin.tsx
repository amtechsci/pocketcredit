import { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Logo';
import type { AdminUser } from '../AdminApp';

interface AdminLoginProps {
  onLogin: (user: AdminUser) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo admin users
  const demoUsers: AdminUser[] = [
    {
      id: 'admin1',
      name: 'Sarah Johnson',
      email: 'admin@pocketcredit.com',
      role: 'superadmin',
      permissions: ['*']
    },
    {
      id: 'manager1',
      name: 'Raj Patel',
      email: 'manager@pocketcredit.com',
      role: 'manager',
      permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans']
    },
    {
      id: 'officer1',
      name: 'Priya Singh',
      email: 'officer@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes']
    }
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      const user = demoUsers.find(u => 
        u.email === email && 
        (password === 'admin123' || password === 'demo123')
      );

      if (user) {
        onLogin(user);
      } else {
        setError('Invalid credentials. Try admin@pocketcredit.com with admin123');
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="xl" variant="default" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Admin Dashboard
            </h1>
            <p className="text-gray-600">
              Management Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Demo Accounts:</h3>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <strong>Super Admin:</strong> admin@pocketcredit.com
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Manager:</strong> manager@pocketcredit.com
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Officer:</strong> officer@pocketcredit.com
              </div>
              <p className="text-gray-500 mt-2">Password: <code>admin123</code> or <code>demo123</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}