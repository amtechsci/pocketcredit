import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cloud, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const BankStatementUploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [uploadMethod, setUploadMethod] = useState<'online' | 'manual'>('online');
  const [onlineMethod, setOnlineMethod] = useState<'netbanking' | 'accountaggregator'>('accountaggregator');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [hasPendingUpload, setHasPendingUpload] = useState(false);
  const [pendingData, setPendingData] = useState<{
    digitapUrl: string;
    expiresAt: string;
    status: string;
  } | null>(null);

  // Set mobile number from user context on mount
  useEffect(() => {
    if (user?.phone) {
      setMobileNumber(user.phone);
    }
  }, [user]);

  // Check if bank statement already uploaded or pending
  useEffect(() => {
    const checkBankStatementStatus = async () => {
      try {
        const response = await apiService.getUserBankStatementStatus();
        
        if (!response.success || !response.data) {
          setCheckingStatus(false);
          return;
        }

        const { status, digitapUrl, expiresAt } = response.data as any;

        // Check if completed
        if (status === 'completed') {
          toast.success('Bank statement already uploaded! Proceeding to dashboard...');
          setTimeout(() => navigate('/dashboard'), 1500);
          return;
        }

        // Check if pending, InProgress, or failed (needs retry)
        if ((status === 'pending' || status === 'InProgress' || status === 'failed') && digitapUrl) {
          // Check if expired
          if (expiresAt && new Date(expiresAt) < new Date()) {
            // Expired - delete and show form
            toast.info('Previous session expired. Please start a new upload.');
            await handleDeletePending();
            setCheckingStatus(false);
          } else {
            // Not expired - show pending/retry message
            setPendingData({ digitapUrl, expiresAt, status });
            setHasPendingUpload(true);
            setCheckingStatus(false);
          }
        } else {
          // No pending upload - show form
          setCheckingStatus(false);
        }
      } catch (error) {
        console.error('Error checking bank statement status:', error);
        setCheckingStatus(false);
      }
    };

    checkBankStatementStatus();
  }, [navigate]);

  const handleContinuePending = () => {
    if (pendingData?.digitapUrl) {
      toast.info('Redirecting to your pending upload...');
      window.location.href = pendingData.digitapUrl;
    }
  };

  const handleDeletePending = async () => {
    try {
      const response = await apiService.deletePendingBankStatement();
      if (response.success) {
        toast.success('Starting fresh upload...');
        setHasPendingUpload(false);
        setPendingData(null);
      }
    } catch (error) {
      console.error('Error deleting pending upload:', error);
      toast.error('Could not reset. Please try again.');
    }
  };

  const handleOnlineUpload = async () => {
    // Validate mobile number for Account Aggregator
    if (onlineMethod === 'accountaggregator' && !mobileNumber) {
      toast.error('Please enter your mobile number');
      return;
    }

    // Validate mobile number format
    if (onlineMethod === 'accountaggregator' && !/^[6-9]\d{9}$/.test(mobileNumber)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.initiateUserBankStatement({
        mobile_number: mobileNumber || '',
        bank_name: '',
        destination: onlineMethod
      });

      if (response.success && response.data) {
        toast.success('Redirecting to bank verification...');
        // Redirect to Digitap's secure URL
        window.location.href = response.data.digitapUrl;
      } else {
        // Check if it's a demo mode error
        if (response.message && response.message.includes('demo credentials')) {
          toast.error('Online upload requires production credentials', {
            description: 'Please use Manual Upload option instead',
            duration: 5000
          });
          // Auto-switch to manual upload
          setUploadMethod('manual');
        } else {
          toast.error(response.message || 'Failed to initiate bank statement upload');
        }
      }
    } catch (error: any) {
      console.error('Bank statement initiation error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to connect to bank verification';
      
      // Check if demo mode error
      if (errorMessage.includes('demo credentials') || errorMessage.includes('unavailable')) {
        toast.error('Online upload not available', {
          description: 'Please switch to Manual Upload tab',
          duration: 5000
        });
        setUploadMethod('manual');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUpload = async () => {
    setIsLoading(true);

    try {
      // Manual also uses Digitap generateurl with destination: "statementupload"
      const response = await apiService.initiateUserBankStatement({
        mobile_number: '',
        bank_name: '',
        destination: 'statementupload'
      });

      if (response.success && response.data) {
        toast.success('Redirecting to upload page...');
        // Redirect to Digitap's upload page
        window.location.href = response.data.digitapUrl;
      } else {
        toast.error(response.message || 'Failed to initiate upload');
      }
    } catch (error: any) {
      console.error('Manual upload error:', error);
      toast.error(error.message || 'Failed to initiate upload');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking status
  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking bank statement status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Bank Statement Upload</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Pending/Failed Upload Message */}
        {hasPendingUpload && pendingData && (
          <Card className="p-6 border-2 border-yellow-400 bg-yellow-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  {pendingData.status === 'failed' 
                    ? 'Previous bank statement upload failed'
                    : 'You have a pending bank statement upload'
                  }
                </h3>
                <p className="text-sm text-yellow-800 mb-4">
                  {pendingData.status === 'failed'
                    ? 'Your previous upload attempt failed. You can try again with the same method or choose a different one.'
                    : 'You started an upload process but didn\'t complete it. You can continue where you left off or start fresh with a different method.'
                  }
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleContinuePending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {pendingData.status === 'failed' ? 'Try Again' : 'Continue Upload'}
                  </Button>
                  <Button
                    onClick={handleDeletePending}
                    variant="outline"
                    className="border-yellow-600 text-yellow-900 hover:bg-yellow-100"
                  >
                    Try Other Method
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Upload Method Tabs - Only show if no pending upload */}
        {!hasPendingUpload && (
          <>
            <div className="relative">
              <div className="flex gap-3">
                <button
                  onClick={() => setUploadMethod('online')}
                  className={`flex-1 relative py-3 px-4 rounded-lg font-medium transition-all ${
                    uploadMethod === 'online'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Online Upload
                  {uploadMethod === 'online' && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5">
                      For Faster Processing
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setUploadMethod('manual')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    uploadMethod === 'manual'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manual Upload
                </button>
              </div>
            </div>

            {/* Online Upload Section */}
            {uploadMethod === 'online' && (
              <>
                {/* Online Method Selection */}
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Choose Verification Method</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
                  style={{
                    borderColor: onlineMethod === 'accountaggregator' ? '#3b82f6' : '#e5e7eb',
                    backgroundColor: onlineMethod === 'accountaggregator' ? '#eff6ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="onlineMethod"
                    value="accountaggregator"
                    checked={onlineMethod === 'accountaggregator'}
                    onChange={(e) => setOnlineMethod(e.target.value as 'accountaggregator')}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">By Mobile (Account Aggregator)</div>
                    <div className="text-sm text-gray-600">Secure, RBI-approved method</div>
                  </div>
                </label>

                {/* Mobile Number Input - Only show when Account Aggregator is selected */}
                {onlineMethod === 'accountaggregator' && (
                  <Card className="p-4 bg-gray-50 border border-gray-200">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, ''); // Only numbers
                          if (value.length <= 10) {
                            setMobileNumber(value);
                          }
                        }}
                        placeholder="Enter your mobile number"
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={10}
                      />
                      {user?.phone && mobileNumber === user.phone && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Using your registered mobile number
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
                  style={{
                    borderColor: onlineMethod === 'netbanking' ? '#3b82f6' : '#e5e7eb',
                    backgroundColor: onlineMethod === 'netbanking' ? '#eff6ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="onlineMethod"
                    value="netbanking"
                    checked={onlineMethod === 'netbanking'}
                    onChange={(e) => setOnlineMethod(e.target.value as 'netbanking')}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Net Banking</div>
                    <div className="text-sm text-gray-600">Login to your bank directly</div>
                  </div>
                </label>
              </div>
            </Card>

            {/* Upload Button */}
            <Button
              onClick={handleOnlineUpload}
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <Cloud className="mr-2 h-5 w-5" />
              {isLoading ? 'Connecting...' : 'Continue'}
            </Button>
          </>
        )}

        {/* Manual Upload Section */}
        {uploadMethod === 'manual' && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex items-start gap-2">
                <h3 className="text-lg font-semibold flex-1">Manual Statement Upload</h3>
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">
                Upload last 6 months Bank Statement PDF through Digitap's secure platform
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium">
                  ℹ️ This method lets you upload your PDF statement for automatic analysis
                </p>
              </div>
            </Card>

            {/* Upload Button */}
            <Button
              onClick={handleManualUpload}
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="mr-2 h-5 w-5" />
              {isLoading ? 'Uploading...' : 'Continue to Upload'}
            </Button>
          </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

