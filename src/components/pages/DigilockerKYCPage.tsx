import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Shield, CheckCircle, XCircle, Loader2, AlertCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const DigilockerKYCPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { applicationId: statePayloadId, showPanInput: stateShowPanInput } = location.state || {};
  
  // Get applicationId from URL query params or state
  const urlParams = new URLSearchParams(location.search);
  const urlAppId = urlParams.get('applicationId');
  const initialAppId = urlAppId || statePayloadId?.toString() || null;
  
  const [applicationId, setApplicationId] = useState<string | null>(initialAppId);

  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // Check if KYC already complete
  const [attempts, setAttempts] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [kycDeclaration, setKycDeclaration] = useState(false);
  const maxAttempts = 2;
  
  // PAN input state (shown if Digilocker doesn't return PAN document)
  const [showPanInput, setShowPanInput] = useState(false);
  const [panNumber, setPanNumber] = useState('');
  const [validatingPan, setValidatingPan] = useState(false);
  const [panValidated, setPanValidated] = useState(false);

  // PRIORITY 0: Check if user has pending/active loans - block KYC access if they do (unless ReKYC is required)
  useEffect(() => {
    const checkPendingLoans = async () => {
      try {
        const applicationsResponse = await apiService.getLoanApplications();
        console.log('🔍 [KYC Page] Checking for pending loans - API response:', applicationsResponse);
        
        // Check both success formats
        const isSuccess = applicationsResponse.success === true || applicationsResponse.status === 'success';
        
        if (isSuccess && applicationsResponse.data && applicationsResponse.data.applications) {
          const applications = applicationsResponse.data.applications;
          console.log('📋 [KYC Page] Applications found:', applications.length, applications.map((app: any) => ({ id: app.id, status: app.status })));

          // Define statuses that allow KYC access (only cleared and cancelled)
          const allowedStatuses = ['cleared', 'cancelled'];
          
          // Check if user has any applications that are NOT cleared or cancelled
          const hasPendingOrActiveLoan = applications.some((app: any) => {
            const status = (app.status || '').toLowerCase().trim();
            const isNotAllowed = !allowedStatuses.includes(status);
            console.log(`🔍 [KYC Page] App ${app.id}: status="${app.status}" (normalized: "${status}"), isNotAllowed=${isNotAllowed}`);
            return isNotAllowed;
          });

          console.log('🔍 [KYC Page] Has pending/active loan?', hasPendingOrActiveLoan);

          if (hasPendingOrActiveLoan) {
            // Check if ReKYC is required - if yes, allow access
            try {
              const checkId = applicationId || '0';
              const kycResponse = await apiService.getKYCStatus(checkId);
              let rekycRequired = false;
              
              if (kycResponse.success && kycResponse.data && kycResponse.data.verification_data) {
                let verificationData = kycResponse.data.verification_data;
                if (typeof verificationData === 'string') {
                  try {
                    verificationData = JSON.parse(verificationData);
                  } catch (e) {
                    console.warn('Failed to parse verification_data:', e);
                  }
                }
                rekycRequired = verificationData.rekyc_required === true;
              }
              
              console.log('🔍 [KYC Page] ReKYC required?', rekycRequired);
              
              // If ReKYC is NOT required, redirect away
              if (!rekycRequired) {
                console.log('🚫 [KYC Page] User has pending/active loan and ReKYC not required - redirecting to dashboard');
                toast.error('You have a pending or active loan application. Please complete it before accessing KYC verification.');
                navigate('/dashboard', { replace: true });
                return;
              } else {
                console.log('✅ [KYC Page] ReKYC required - allowing access to KYC page');
              }
            } catch (kycError) {
              console.error('Error checking ReKYC status:', kycError);
              // If we can't check ReKYC, redirect to be safe
              console.log('🚫 [KYC Page] Error checking ReKYC - redirecting to dashboard');
              toast.error('Unable to verify KYC status. Please try again later.');
              navigate('/dashboard', { replace: true });
              return;
            }
          } else {
            console.log('✅ [KYC Page] All loans are cleared or cancelled - allowing KYC access');
          }
        }
      } catch (error) {
        console.error('❌ [KYC Page] Error checking pending loans:', error);
        // On error, allow access (don't block) - let other checks handle it
      }
    };

    checkPendingLoans();
  }, [navigate, applicationId]);

  // Check if we should show PAN input from state (when redirected from KYCCheckPage)
  useEffect(() => {
    if (stateShowPanInput) {
      setShowPanInput(true);
      setChecking(false);
    }
  }, [stateShowPanInput]);

  // Check if KYC is already verified on page load
  useEffect(() => {
    // Check URL params on mount/update
    const urlParams = new URLSearchParams(location.search);
    const urlAppId = urlParams.get('applicationId');
    if (urlAppId && urlAppId !== applicationId) {
      setApplicationId(urlAppId);
      return; // Don't proceed with initPage if we just set from URL
    }
    
    const initPage = async () => {
      // If no app ID, try to fetch the latest one
      if (!applicationId) {
        try {
          const response = await apiService.getLoanApplications();
          if (response.success && response.data?.applications && response.data.applications.length > 0) {
            // Assume the most recent one is relevant
            const latest = response.data.applications[0];
            setApplicationId(latest.id.toString());
            // Update checking to true again to verify status for this ID
          } else {
            toast.error("No active application found.");
            setChecking(false);
            return;
          }
        } catch (e) {
          console.error("Failed to fetch user applications", e);
          setChecking(false);
          return;
        }
      }
    };

    if (!applicationId) {
      initPage();
    }
  }, [applicationId, location.search]);

  useEffect(() => {
    const checkKYCStatus = async () => {
      // KYC is per-user, so we can check even without applicationId
      // But we need applicationId for navigation purposes
      const checkId = applicationId || '0'; // Use '0' as placeholder if no applicationId

      try {
        const response = await apiService.getKYCStatus(checkId);

        // Check if ReKYC is required (admin triggered re-KYC)
        let rekycRequired = false;
        if (response.success && response.data && response.data.verification_data) {
          let verificationData = response.data.verification_data;
          // Parse if it's a string
          if (typeof verificationData === 'string') {
            try {
              verificationData = JSON.parse(verificationData);
            } catch (e) {
              // Ignore parsing errors
            }
          }
          rekycRequired = verificationData?.rekyc_required === true;
        }

        // If ReKYC is required, show the form even if KYC status is verified
        if (rekycRequired) {
          console.log('🔄 ReKYC required by admin - showing KYC form');
          setChecking(false);
          toast.info('Please complete KYC verification again as requested');
          return;
        }

        if (response.success && response.data.kyc_status === 'verified') {
          // KYC verified - check if PAN document exists
          if (applicationId) {
            try {
              const panCheckResponse = await apiService.checkPanDocument(applicationId);
              console.log('🔍 PAN check response:', panCheckResponse);
              
              if (panCheckResponse.success && !panCheckResponse.data?.hasPanDocument) {
                // No PAN document found - but check if employment details are already completed
                // If employment is completed, user has already progressed past KYC, so skip PAN requirement
                try {
                  const employmentResponse = await apiService.getEmploymentDetailsStatus();
                  if (employmentResponse.status === 'success' && employmentResponse.data?.completed) {
                    console.log('✅ Employment details completed - skipping PAN requirement');
                    // Employment completed means user already passed this step - proceed to next
                    toast.success('KYC already verified! Proceeding to next step...');
                    setTimeout(() => {
                      navigate('/loan-application/employment-details', {
                        state: { applicationId },
                        replace: true
                      });
                    }, 1500);
                    return;
                  }
                } catch (empError) {
                  console.error('Error checking employment status:', empError);
                }
                
                // No PAN document found and employment not completed - show PAN input
                console.log('⚠️ No PAN document found - showing PAN input');
                setShowPanInput(true);
                setChecking(false);
                toast.info('Please enter your PAN number to complete verification');
                return;
              } else {
                console.log('✅ PAN document found');
              }
            } catch (panError) {
              console.error('Error checking PAN document:', panError);
              // If PAN check fails (e.g., API authentication error), show manual PAN input
              console.log('⚠️ PAN check failed - showing manual PAN input');
              setShowPanInput(true);
              setChecking(false);
              toast.info('Please enter your PAN number to complete verification');
              return;
            }
          }
          
          // KYC already completed and PAN exists (or check skipped) - redirect to next step
          toast.success('KYC already verified! Proceeding to next step...');
          setTimeout(() => {
            navigate('/loan-application/credit-analytics', {
              replace: true
            });
          }, 1500);
        } else {
          // KYC not complete - show the form
          setChecking(false);
        }
      } catch (error) {
        console.error('Error checking KYC status:', error);
        // On error, show the form anyway
        setChecking(false);
      }
    };

    // Only check if we have an applicationId or if we're not being managed by StepGuard
    // StepGuard handles validation, but we still check here for immediate UI feedback
    checkKYCStatus();
  }, [applicationId, navigate]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(value);
  };

  const handleVerifyKYC = async () => {
    if (mobileNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!kycDeclaration) {
      toast.error('Please accept the KYC declaration');
      return;
    }

    setLoading(true);
    setAttempts(prev => prev + 1);

    try {
      // Generate Digilocker KYC URL (application_id is optional, KYC is per user)
      const response = await apiService.generateDigilockerKYCUrl({
        mobile_number: mobileNumber,
        application_id: applicationId ? parseInt(applicationId as string) : undefined,
        first_name: user?.first_name || user?.name?.split(' ')[0],
        last_name: user?.last_name || user?.name?.split(' ').slice(1).join(' '),
        email: user?.email
      });

      if (response.success && response.data.kycUrl) {
        toast.success('Redirecting to Digilocker for KYC verification...');

        // Redirect to Digilocker KYC URL
        // After returning from Digilocker, we'll check for PAN document
        window.location.href = response.data.kycUrl;
      } else {
        setVerificationStatus('failed');
        toast.error(response.message || 'Failed to generate KYC URL');
      }
    } catch (error: any) {
      console.error('Digilocker KYC error:', error);
      setVerificationStatus('failed');
      toast.error(error.response?.data?.message || 'Failed to generate KYC URL. Please try again.');
      setLoading(false);
    }
    // Note: loading state will persist until redirect happens
  };

  const handleSkipKYC = () => {
    toast.info('Skipping KYC verification. You can complete it later.');
    navigate('/loan-application/credit-analytics');
  };

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to uppercase and remove any non-alphanumeric characters
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setPanNumber(value);
  };

  const handleValidatePAN = async () => {
    // Validate PAN format: 5 letters, 4 digits, 1 letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber)) {
      toast.error('Please enter a valid PAN number (Format: ABCDE1234F)');
      return;
    }

    setValidatingPan(true);

    try {
      const response = await apiService.validatePAN(panNumber);

      if (response.success || response.status === 'success') {
        setPanValidated(true);
        toast.success('PAN validated successfully!');
        
        // Wait a moment then proceed to next step
        setTimeout(() => {
          navigate('/loan-application/credit-analytics', {
            replace: true
          });
        }, 1500);
      } else {
        toast.error(response.message || 'Failed to validate PAN. Please try again.');
      }
    } catch (error: any) {
      console.error('PAN validation error:', error);
      toast.error(error.response?.data?.message || 'Failed to validate PAN. Please try again.');
    } finally {
      setValidatingPan(false);
    }
  };

  // Show loading while checking KYC status
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking KYC status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">KYC Verification</h1>
          <p className="text-gray-600">
            Verify your identity using Digilocker for faster loan processing
          </p>
        </div>

        <Card className="shadow-lg">
          {/* Only show header when NOT in PAN verification mode */}
          {!showPanInput && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Aadhaar-Linked Mobile Number
              </CardTitle>
              <CardDescription>
                Enter the mobile number linked to your Aadhaar card
              </CardDescription>
            </CardHeader>
          )}

          <CardContent className="space-y-6">
            {/* Verification Status */}
            {verificationStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">Verification Successful!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Your KYC has been verified successfully. Redirecting to next step...
                  </p>
                </div>
              </div>
            )}

            {verificationStatus === 'failed' && attempts < maxAttempts && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Verification Failed</p>
                  <p className="text-sm text-red-700 mt-1">
                    Attempt {attempts} of {maxAttempts}. Please check your mobile number and try again.
                  </p>
                </div>
              </div>
            )}

            {verificationStatus === 'failed' && attempts >= maxAttempts && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-900">Maximum Attempts Reached</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Digilocker verification couldn't be completed. You can continue with your application and complete KYC later.
                  </p>
                </div>
              </div>
            )}

            {/* PAN Input Section (shown if Digilocker didn't return PAN document) */}
            {showPanInput && !panValidated && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pan" className="text-base">
                    PAN Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pan"
                    type="text"
                    value={panNumber}
                    onChange={handlePanChange}
                    placeholder="ABCDE1234F"
                    className="h-12 text-lg uppercase font-mono"
                    maxLength={10}
                    disabled={validatingPan}
                  />
                  <p className="text-sm text-gray-500">
                    Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
                  </p>
                </div>

                <Button
                  onClick={handleValidatePAN}
                  disabled={validatingPan || panNumber.length !== 10}
                  className="w-full h-12 text-base"
                >
                  {validatingPan ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Validating PAN...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-2" />
                      Validate PAN
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Mobile Number Input */}
            {!showPanInput && verificationStatus !== 'success' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-base">
                    Mobile Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                      +91
                    </div>
                    <Input
                      id="mobile"
                      type="tel"
                      value={mobileNumber}
                      onChange={handleMobileChange}
                      placeholder="Enter 10-digit mobile number"
                      className="pl-14 h-12 text-lg"
                      maxLength={10}
                      disabled={loading || attempts >= maxAttempts}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    This should be the mobile number registered with your Aadhaar card
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium mb-2">
                    Why Digilocker?
                  </p>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Instant KYC verification</li>
                    <li>Secure and government-approved</li>
                    <li>No document upload required</li>
                    <li>Faster loan approval</li>
                  </ul>
                </div>

                {/* KYC Declaration */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      type="checkbox"
                      id="kyc_declaration"
                      checked={kycDeclaration}
                      onChange={(e) => setKycDeclaration(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={loading || attempts >= maxAttempts}
                      required
                    />
                    <label htmlFor="kyc_declaration" className="text-sm text-gray-700 cursor-pointer flex-1">
                      I hereby declare that I have not opened and will not open any other account using OTP-based KYC in non-face-to-face mode with any other Entity <span className="text-red-500">*</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  {attempts < maxAttempts ? (
                    <>
                      <Button
                        onClick={handleVerifyKYC}
                        disabled={loading || mobileNumber.length !== 10 || !kycDeclaration}
                        className="flex-1 h-12 text-base"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5 mr-2" />
                            Verify with Digilocker
                          </>
                        )}
                      </Button>
                      {attempts > 0 && (
                        <Button
                          onClick={handleSkipKYC}
                          variant="outline"
                          disabled={loading}
                          className="flex-1 h-12 text-base"
                        >
                          Continue Without KYC
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={handleSkipKYC}
                      className="w-full h-12 text-base"
                    >
                      Continue to Next Step
                    </Button>
                  )}
                </div>

                {attempts > 0 && attempts < maxAttempts && (
                  <p className="text-sm text-center text-gray-500">
                    {maxAttempts - attempts} attempt{maxAttempts - attempts !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Having trouble? Contact our support team for assistance
          </p>
        </div>
      </div>
    </div>
  );
};

export default DigilockerKYCPage;

