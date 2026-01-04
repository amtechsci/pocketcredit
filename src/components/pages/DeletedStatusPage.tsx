import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { XCircle } from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';

export function DeletedStatusPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('User');

  useEffect(() => {
    const checkDeletedStatus = async () => {
      try {
        // If user is not deleted, redirect to dashboard
        if (user?.status !== 'deleted') {
          navigate('/dashboard', { replace: true });
          return;
        }

        // Set user name for header
        if (user?.first_name || user?.last_name) {
          setUserName(`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User');
        } else {
          setUserName('User');
        }

        // Try to fetch dashboard data to confirm deleted status
        try {
          const response = await apiService.getDashboardSummary();
          if (response.status === 'success' && response.data?.deleted) {
            // User is confirmed deleted
          }
        } catch (error) {
          // Even if API fails, if user status is deleted, show the page
          console.log('Dashboard fetch failed, but user status is deleted');
        }
      } catch (error) {
        console.error('Error checking deleted status:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkDeletedStatus();
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userName={userName} />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (user?.status !== 'deleted') {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={userName} />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="border border-gray-300 bg-gray-50/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <XCircle className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Your profile has been purged from our system. Thank you.
                  </h3>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                If you have any questions, please contact our support team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

