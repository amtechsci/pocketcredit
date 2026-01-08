import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertCircle, Loader2, Upload, CheckCircle, Cloud } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const BankStatementUploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadMethod, setUploadMethod] = useState<'online' | 'manual'>('online');
  const [onlineMethod, setOnlineMethod] = useState<'netbanking' | 'accountaggregator'>('accountaggregator');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<'none' | 'uploaded' | 'under_review' | 'verified' | 'rejected'>('none');

  // Set mobile number from user context on mount
  useEffect(() => {
    if (user?.phone && !mobileNumber) {
      setMobileNumber(user.phone);
    }
  }, [user]);

  // Check if bank statement already uploaded
  useEffect(() => {
    const checkBankStatementStatus = async () => {
      try {
        const response = await apiService.getUserBankStatementStatus();
        
        if (response.success && response.data) {
          const { status, userStatus, digitapUrl, expiresAt } = response.data as any;
          
          // If status is 'completed' (online flow or manual upload), redirect to link-salary-bank-account
          // This matches the Account Aggregator flow behavior
          if (status === 'completed') {
            toast.success('Bank statement already uploaded! Redirecting...');
            
            // Get application ID for redirect
            try {
              const applicationsResponse = await apiService.getLoanApplications();
              const isSuccess = applicationsResponse.success || applicationsResponse.status === 'success';
              if (isSuccess && applicationsResponse.data?.applications) {
                const applications = applicationsResponse.data.applications;
                // Include ready_for_disbursement and repeat loan statuses as well
                const activeApplication = applications.find((app: any) => 
                  ['submitted', 'under_review', 'follow_up', 'disbursal', 'repeat_disbursal', 'ready_to_repeat_disbursal', 'pending', 'in_progress', 'ready_for_disbursement'].includes(app.status)
                );
                
                if (activeApplication) {
                  console.log('🟢 BankStatementUploadPage: Redirecting to link-salary-bank-account with applicationId:', activeApplication.id);
                  setTimeout(() => {
                    navigate(`/link-salary-bank-account?applicationId=${activeApplication.id}`, { replace: true });
                  }, 1500);
                  return;
                }
              }
            } catch (appError) {
              console.error('Error fetching loan applications:', appError);
            }
            
            // Fallback: Redirect without application ID
            console.log('🟢 BankStatementUploadPage: Redirecting to link-salary-bank-account (fallback)');
            setTimeout(() => {
              navigate('/link-salary-bank-account', { replace: true });
            }, 1500);
            return;
          }
          
          // If userStatus is 'verified' (admin verified), also redirect
          if (userStatus === 'verified') {
            toast.success('Bank statement already uploaded and verified! Redirecting...');
            setTimeout(() => navigate('/link-salary-bank-account', { replace: true }), 1500);
            return;
          } else if (userStatus === 'under_review') {
            setUploadStatus('under_review');
          } else if (userStatus === 'uploaded') {
            setUploadStatus('uploaded');
          } else if (userStatus === 'rejected') {
            setUploadStatus('rejected');
          }

          // Check for pending online upload
          if (digitapUrl && expiresAt && new Date(expiresAt) > new Date()) {
            // Has pending online upload - could show option to continue
          }
        }
      } catch (error) {
        console.error('Error checking bank statement status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkBankStatementStatus();
  }, [navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleOnlineUpload = async () => {
    // Validate mobile number for Account Aggregator
    if (onlineMethod === 'accountaggregator' && !mobileNumber) {
      toast.error('Please enter your mobile number');
      return;
    }

    // Validate mobile number format (10 digits starting with 6-9)
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
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('statement', selectedFile);

      const response = await apiService.uploadBankStatement(formData);

      if (response.success) {
        toast.success('Bank statement uploaded successfully! Redirecting...');
        setUploadStatus('uploaded');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Redirect to link-salary-bank-account page after successful upload
        // This matches the Account Aggregator flow behavior (see BankStatementSuccessPage.tsx)
        // Include applicationId in URL if available from response
        const applicationId = response.data?.applicationId;
        const redirectUrl = applicationId 
          ? `/link-salary-bank-account?applicationId=${applicationId}`
          : '/link-salary-bank-account';
        
        // Wait a bit to ensure backend step update is complete
        setTimeout(() => {
          navigate(redirectUrl, { replace: true });
        }, 1500);
      } else {
        toast.error(response.message || 'Failed to upload bank statement');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload bank statement');
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
        {/* Status Messages */}
        {uploadStatus === 'under_review' && (
          <Card className="p-6 border-2 border-blue-400 bg-blue-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Under Review</h3>
                <p className="text-sm text-blue-800">
                  Your bank statement is currently under review by our team. You will be notified once the review is complete.
                </p>
              </div>
            </div>
          </Card>
        )}

        {uploadStatus === 'rejected' && (
          <Card className="p-6 border-2 border-red-400 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Upload Rejected</h3>
                <p className="text-sm text-red-800">
                  Your bank statement was rejected. Please upload a new statement or contact support for assistance.
                </p>
              </div>
            </div>
          </Card>
        )}

        {uploadStatus === 'uploaded' && (
          <Card className="p-6 border-2 border-green-400 bg-green-50">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">Upload Successful</h3>
                <p className="text-sm text-green-800">
                  Your bank statement has been uploaded successfully. It is now under review by our team.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Upload Method Tabs */}
        {uploadStatus !== 'verified' && (
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
                {/* Important Instructions */}
                <Card className="p-4 bg-yellow-50 border-2 border-yellow-300">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-yellow-900">Important Instructions:</p>
                      <ul className="text-xs text-yellow-800 space-y-1 list-none">
                        <li>Please enter only the <strong>"mobile number"</strong> linked to your <strong>"salary bank account"</strong>.</li>
                        <li>Select only your <strong>"salary bank account"</strong> from the list.</li>
                      </ul>
                    </div>
                  </div>
                </Card>

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
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-medium">+91</span>
                            <input
                              type="tel"
                              value={mobileNumber}
                              onChange={(e) => {
                                // Only allow numbers
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 10) {
                                  setMobileNumber(value);
                                }
                              }}
                              placeholder="Enter your mobile number"
                              className="w-full h-12 pl-16 pr-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              maxLength={10}
                            />
                          </div>
                          {user?.phone && mobileNumber === user.phone && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Using your registered mobile number
                            </p>
                          )}
                        </div>
                      </Card>
                    )}

                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="text-sm text-gray-500 font-medium">or</span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>

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
                <Card className="p-6 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Upload Bank Statement</h2>
                    <p className="text-sm text-gray-600">
                      Please upload your last 6 months bank statement in PDF format (max 10MB)
                    </p>
                  </div>

                  {/* File Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Bank Statement PDF <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="bank-statement-file"
                      />
                      <label
                        htmlFor="bank-statement-file"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="w-10 h-10 text-gray-400" />
                        <div>
                          <span className="text-blue-600 font-medium">Click to upload</span>
                          <span className="text-gray-500"> or drag and drop</span>
                        </div>
                        <p className="text-xs text-gray-500">PDF only, max 10MB</p>
                      </label>
                    </div>
                    {selectedFile && (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-700 flex-1">{selectedFile.name}</span>
                        <span className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <Button
                    onClick={handleManualUpload}
                    disabled={!selectedFile || isLoading}
                    className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Upload Statement
                      </>
                    )}
                  </Button>

                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Important Instructions:</p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Upload statement from your salary account only</li>
                      <li>Statement should cover last 6 months</li>
                      <li>File must be in PDF format</li>
                      <li>Maximum file size: 10MB</li>
                    </ul>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

