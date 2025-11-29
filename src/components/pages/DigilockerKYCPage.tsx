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
  const { applicationId } = location.state || {};

  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // Check if KYC already complete
  const [attempts, setAttempts] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [kycDeclaration, setKycDeclaration] = useState(false);
  const maxAttempts = 2;

  // Check if KYC is already verified on page load
  useEffect(() => {
    const checkKYCStatus = async () => {
      if (!applicationId) {
        setChecking(false);
        return;
      }

      try {
        const response = await apiService.getKYCStatus(applicationId);
        
        if (response.success && response.data.kyc_status === 'verified') {
          // KYC already completed - redirect to next step
          toast.success('KYC already verified! Proceeding to next step...');
          setTimeout(() => {
            navigate('/loan-application/employment-details', {
              state: { applicationId }
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

    if (!applicationId) {
      toast.error('Application ID is missing');
      return;
    }

    setLoading(true);
    setAttempts(prev => prev + 1);

    try {
      // Generate Digilocker KYC URL
      const response = await apiService.generateDigilockerKYCUrl({
        mobile_number: mobileNumber,
        application_id: parseInt(applicationId as string),
        first_name: user?.first_name || user?.name?.split(' ')[0],
        last_name: user?.last_name || user?.name?.split(' ').slice(1).join(' '),
        email: user?.email
      });

      if (response.success && response.data.kycUrl) {
        toast.success('Redirecting to Digilocker for KYC verification...');
        
        // Redirect to Digilocker KYC URL
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
    navigate('/loan-application/employment-details', {
      state: { applicationId }
    });
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Aadhaar-Linked Mobile Number
            </CardTitle>
            <CardDescription>
              Enter the mobile number linked to your Aadhaar card
            </CardDescription>
          </CardHeader>

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

            {/* Mobile Number Input */}
            {verificationStatus !== 'success' && (
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

