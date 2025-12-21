import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

/**
 * eNACH Completion Page
 * 
 * This page is shown when eNACH subscription is created but authorization link
 * is sent via SMS/Email instead of being available for direct redirect.
 * 
 * Features:
 * - Shows instructions to check SMS/Email
 * - Polls subscription status in background
 * - Auto-advances when mandate is approved
 * - Manual refresh button
 */
export const EnachCompletionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('INITIALIZED');
  const [polling, setPolling] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const MAX_POLL_ATTEMPTS = 60; // Poll for up to 5 minutes (60 * 5 seconds)
  const POLL_INTERVAL = 5000; // Check every 5 seconds

  useEffect(() => {
    // Get subscription ID and application ID from URL params or sessionStorage
    const urlSubscriptionId = searchParams.get('subscription_id');
    const urlApplicationId = searchParams.get('applicationId');
    
    const sessionSubscriptionId = sessionStorage.getItem('enach_subscription_id');
    const sessionApplicationId = sessionStorage.getItem('enach_application_id');

    const subId = urlSubscriptionId || sessionSubscriptionId;
    const appId = urlApplicationId ? parseInt(urlApplicationId) : 
                  sessionApplicationId ? parseInt(sessionApplicationId) : null;

    if (subId) {
      setSubscriptionId(subId);
    }
    if (appId) {
      setApplicationId(appId);
    }

    // If no subscription ID found, redirect back
    if (!subId && !appId) {
      toast.error('Missing subscription information. Redirecting...');
      setTimeout(() => {
        navigate('/post-disbursal');
      }, 2000);
      return;
    }

    // Start polling immediately
    checkStatus();
  }, []);

  // Polling effect
  useEffect(() => {
    if (!polling || !subscriptionId) return;

    const interval = setInterval(() => {
      checkStatus();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [polling, subscriptionId]);

  const checkStatus = async () => {
    if (!subscriptionId) {
      // If no subscription ID but we have application ID, try to get subscription
      if (applicationId) {
        try {
          const subResponse = await apiService.getEnachSubscription(applicationId);
          if (subResponse.success && subResponse.data?.subscription_id) {
            setSubscriptionId(subResponse.data.subscription_id);
            // Check status with the found subscription ID
            await checkStatusWithId(subResponse.data.subscription_id);
            return;
          }
        } catch (err) {
          console.error('Error fetching subscription:', err);
        }
      }
      return;
    }

    await checkStatusWithId(subscriptionId);
  };

  const checkStatusWithId = async (subId: string) => {
    try {
      setLastChecked(new Date());
      const response = await apiService.getEnachSubscriptionStatus(subId);
      
      if (response.success && response.data) {
        const subscriptionStatus = response.data.subscription_status || response.data.status;
        const mandateStatus = response.data.authorization_details?.authorization_status;
        
        setStatus(subscriptionStatus);
        setPollAttempts(prev => prev + 1);

        console.log(`[eNACH Status Check] Status: ${subscriptionStatus}, Mandate: ${mandateStatus}, Attempt: ${pollAttempts + 1}`);

        // Check if mandate is approved/active
        if (
          subscriptionStatus === 'ACTIVE' ||
          subscriptionStatus === 'AUTHENTICATED' ||
          mandateStatus === 'APPROVED' ||
          mandateStatus === 'SUCCESS'
        ) {
          // Success! Stop polling and redirect
          setPolling(false);
          toast.success('✅ eNACH mandate approved! Redirecting...');
          
          // Store success in session
          sessionStorage.setItem('enach_completed', 'true');
          
          // Redirect to post-disbursal flow
          setTimeout(() => {
            if (applicationId) {
              navigate(`/post-disbursal?applicationId=${applicationId}&enach=complete&subscription_id=${subId}`);
            } else {
              navigate('/post-disbursal');
            }
          }, 1500);
          return;
        }

        // Check if mandate failed
        if (
          subscriptionStatus === 'CANCELLED' ||
          subscriptionStatus === 'FAILED' ||
          mandateStatus === 'REJECTED' ||
          mandateStatus === 'FAILED'
        ) {
          setPolling(false);
          toast.error('eNACH mandate was rejected. Please try again.');
          return;
        }

        // Stop polling if max attempts reached
        if (pollAttempts >= MAX_POLL_ATTEMPTS) {
          setPolling(false);
          toast.info('Status check timeout. Please refresh manually or check your SMS/Email.');
        }
      }
    } catch (error: any) {
      console.error('Error checking eNACH status:', error);
      // Don't stop polling on error - might be temporary
      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        setPolling(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    await checkStatus();
    setLoading(false);
    toast.info('Status refreshed');
  };

  const getStatusIcon = () => {
    if (status === 'ACTIVE' || status === 'AUTHENTICATED') {
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    }
    if (status === 'CANCELLED' || status === 'FAILED') {
      return <XCircle className="h-6 w-6 text-red-500" />;
    }
    return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
  };

  const getStatusText = () => {
    switch (status) {
      case 'ACTIVE':
      case 'AUTHENTICATED':
        return 'Mandate Approved';
      case 'CANCELLED':
      case 'FAILED':
        return 'Mandate Rejected';
      case 'INITIALIZED':
      case 'PENDING':
        return 'Waiting for Authorization';
      default:
        return `Status: ${status}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Complete Your eNACH Registration
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Check Your SMS</h3>
                <p className="text-sm text-blue-800">
                  We've sent an eNACH authorization link to your registered mobile number. 
                  Please check your SMS and click on the link to authorize the mandate.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Check Your Email</h3>
                <p className="text-sm text-blue-800">
                  The authorization link has also been sent to your registered email address. 
                  Please check your inbox (and spam folder) for the email from Cashfree.
                </p>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Current Status:</span>
              <span className="text-sm font-semibold text-gray-900">{getStatusText()}</span>
            </div>
            
            {polling && (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="text-xs text-gray-600">
                  Checking status automatically... (Attempt {pollAttempts}/{MAX_POLL_ATTEMPTS})
                </span>
              </div>
            )}
            
            {lastChecked && (
              <p className="text-xs text-gray-500 mt-2">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleManualRefresh}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </>
              )}
            </Button>
            
            {applicationId && (
              <Button
                onClick={() => navigate(`/post-disbursal?applicationId=${applicationId}`)}
                variant="outline"
              >
                Back to Flow
              </Button>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Once you click the authorization link from SMS/Email and complete 
              the mandate, this page will automatically detect the approval and redirect you to the next step. 
              You don't need to refresh manually - we're checking in the background!
            </p>
          </div>

          {/* Subscription Info (for debugging) */}
          {subscriptionId && (
            <div className="text-xs text-gray-500 text-center">
              Subscription ID: {subscriptionId.substring(0, 20)}...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

