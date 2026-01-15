import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { Info, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DashboardHeader } from '../DashboardHeader';

export function HoldStatusPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [holdInfo, setHoldInfo] = useState<{
    is_on_hold: boolean;
    hold_reason: string;
    hold_type: 'permanent' | 'cooling_period';
    status?: string;
    hold_until?: string;
    hold_until_formatted?: string;
    remaining_days?: number;
    is_expired?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('User');

  useEffect(() => {
    const fetchHoldInfo = async () => {
      try {
        // If user is not on hold, redirect to dashboard
        if (user?.status !== 'on_hold') {
          navigate('/dashboard', { replace: true });
          return;
        }

        // Set user name for header
        if (user?.first_name || user?.last_name) {
          setUserName(`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User');
        }

        // Fetch dashboard data to get hold information
        const response = await apiService.getDashboardSummary();
        
        if (response.status === 'success' && response.data?.hold_info) {
          setHoldInfo(response.data.hold_info);
        } else {
          // Fallback: create hold info from user status
          setHoldInfo({
            is_on_hold: true,
            hold_reason: 'Profile temporarily locked',
            hold_type: 'permanent',
            status: 'on_hold'
          });
        }
      } catch (error) {
        console.error('Error fetching hold info:', error);
        // Fallback: create hold info from user status
        setHoldInfo({
          is_on_hold: true,
          hold_reason: 'Profile temporarily locked',
          hold_type: 'permanent',
          status: 'on_hold'
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchHoldInfo();
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

  if (!holdInfo || !holdInfo.is_on_hold) {
    return null; // Will redirect
  }

  const isPermanent = holdInfo.hold_type === 'permanent' || !holdInfo.hold_until;
  const isCoolingPeriod = holdInfo.hold_type === 'cooling_period' || (holdInfo.hold_until && !isPermanent);
  const isExpired = holdInfo.is_expired || false;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={userName} />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {isPermanent ? (
              // Permanent Hold (Not Process)
              <div className="border border-blue-300 bg-blue-50/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Your profile is temporarily locked
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      We will update you if it is unlocked.
                    </p>
                    
                    {holdInfo.hold_reason && (
                      <div className="bg-white rounded-md border border-blue-200 p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1.5">Reason:</p>
                        <p className="text-sm text-gray-800">{holdInfo.hold_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : isCoolingPeriod && !isExpired ? (
              // Cooling Period (Re-process)
              <div className="border border-orange-300 bg-orange-50/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Your profile is under cooling period
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      We will let you know once you are eligible.
                    </p>
                    
                    {holdInfo.hold_until_formatted && (
                      <div className="bg-white rounded-md border border-orange-200 p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Eligible After:</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {holdInfo.hold_until_formatted}
                            </p>
                          </div>
                          {holdInfo.remaining_days !== undefined && (
                            <div className="text-right">
                              <p className="text-xs text-gray-600 mb-1">Remaining Days:</p>
                              <p className="text-2xl font-bold text-orange-600">
                                {holdInfo.remaining_days}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {holdInfo.hold_reason && (
                      <div className="bg-white rounded-md border border-orange-200 p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1.5">Reason:</p>
                        <p className="text-sm text-gray-800">{holdInfo.hold_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Expired Hold
              <div className="border border-green-300 bg-green-50/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Hold Period Expired
                    </h3>
                    <p className="text-sm text-gray-700">
                      Your hold period has expired. You can now continue with your application.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

