import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { toast } from 'sonner';
import { Logo } from '../Logo';

type FlowStep = 
  | 'input' 
  | 'loading' 
  | 'nadl-otp' 
  | 'fetching-accounts' 
  | 'account-selection' 
  | 'bank-otp' 
  | 'linking' 
  | 'consent-approval' 
  | 'complete';

export const AccountAggregatorFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const applicationId = location.state?.applicationId;
  const initialMobile = location.state?.mobileNumber || '';
  const initialBank = location.state?.selectedBank || '';

  const [currentStep, setCurrentStep] = useState<FlowStep>(initialMobile && initialBank ? 'loading' : 'input');
  const [mobileNumber, setMobileNumber] = useState(initialMobile);
  const [selectedBank, setSelectedBank] = useState(initialBank);
  const [nadlOtp, setNadlOtp] = useState(['', '', '', '', '']);
  const [bankOtp, setBankOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [selectedAccount, setSelectedAccount] = useState(true);

  const banks = [
    'ICICI Bank',
    'HDFC Bank',
    'State Bank of India',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'IndusInd Bank Ltd.',
    'IDFC FIRST BANK',
    'Canara Bank',
    'Union Bank Of India',
    'Punjab National Bank',
    'Bank of Baroda',
    'Yes Bank'
  ];

  // Auto-progress through steps
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (currentStep === 'loading') {
      timer = setTimeout(() => setCurrentStep('nadl-otp'), 2000);
    } else if (currentStep === 'fetching-accounts') {
      timer = setTimeout(() => setCurrentStep('account-selection'), 3000);
    } else if (currentStep === 'linking') {
      timer = setTimeout(() => setCurrentStep('consent-approval'), 2500);
    }

    return () => clearTimeout(timer);
  }, [currentStep]);

  // Resend timer
  useEffect(() => {
    if (currentStep === 'nadl-otp' || currentStep === 'bank-otp') {
      const interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  const handleInitiate = () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!selectedBank) {
      toast.error('Please select your bank');
      return;
    }
    setCurrentStep('loading');
  };

  const handleNadlOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...nadlOtp];
      newOtp[index] = value;
      setNadlOtp(newOtp);
      
      // Auto-focus next input
      if (value && index < 4) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleVerifyNadlOtp = () => {
    const otpValue = nadlOtp.join('');
    if (otpValue.length === 5) {
      toast.success('OTP verified successfully');
      setCurrentStep('fetching-accounts');
    } else {
      toast.error('Please enter complete OTP');
    }
  };

  const handleContinueToBank = () => {
    setCurrentStep('bank-otp');
    setResendTimer(60);
  };

  const handleVerifyBankOtp = () => {
    if (bankOtp.length >= 6) {
      toast.success('Bank OTP verified');
      setCurrentStep('linking');
    } else {
      toast.error('Please enter valid OTP');
    }
  };

  const handleApproveConsent = async () => {
    toast.success('Consent approved successfully!');
    setTimeout(async () => {
      setCurrentStep('complete');
      setTimeout(async () => {
        // Use unified progress engine to determine next step
        try {
          const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
          const progress = await getOnboardingProgress(applicationId);
          const nextRoute = getStepRoute(progress.currentStep, applicationId);
          console.log('[AccountAggregator] Next step from engine:', progress.currentStep, '->', nextRoute);
          navigate(nextRoute, { replace: true });
        } catch (error) {
          console.error('[AccountAggregator] Error getting next step, using fallback:', error);
          // Fallback to employment details (old behavior)
          navigate('/loan-application/employment-details', { state: { applicationId } });
        }
      }, 2000);
    }, 1000);
  };

  const handleReject = () => {
    toast.error('Consent rejected');
    navigate(-1);
  };

  // Render different screens based on current step
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm py-4 px-4 border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep === 'input' && (
              <button onClick={() => navigate(-1)} className="p-1 text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-800">Pocketcredit</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Step 1: Input Form */}
        {currentStep === 'input' && (
          <div className="p-4 space-y-4">
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Enter Mobile no. linked with your bank</h3>
              <Input
                type="tel"
                placeholder="Enter your mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-12 text-base"
                maxLength={10}
              />
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Select your Bank Name</h3>
                <p className="text-sm text-gray-600">Choose Your bank where salary is created</p>
              </div>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base"
              >
                <option value="">Select Salaried Bank account name</option>
                {banks.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </Card>

            <Button onClick={handleInitiate} className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
              Upload
            </Button>
          </div>
        )}

        {/* Step 2: Loading */}
        {currentStep === 'loading' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-700 font-medium mb-2">Loading...</p>
            <p className="text-sm text-gray-600 text-center max-w-md">
              This may take few seconds. Please do not press back button or close the app.
            </p>
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="text-xs text-gray-500">Powered By <span className="text-purple-600 font-bold">N@DL</span></div>
              <Logo className="h-8" />
            </div>
          </div>
        )}

        {/* Step 3: NADL OTP Verification */}
        {currentStep === 'nadl-otp' && (
          <div className="p-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800 text-sm font-medium">OTP sent successfully</span>
              </div>
              <button className="text-gray-500"><X className="h-4 w-4" /></button>
            </div>

            <Card className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Verify OTP</h2>
              <p className="text-sm text-gray-600">VUA: ******{mobileNumber.slice(-4)}@NADL</p>
              <p className="text-sm text-gray-700">Enter NADL OTP received on <span className="font-semibold">{mobileNumber}</span></p>
              
              <div className="flex gap-2 justify-center my-6">
                {nadlOtp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleNadlOtpChange(index, e.target.value)}
                    className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                ))}
              </div>

              <p className="text-sm text-gray-600 text-center">
                Resend OTP in <span className="font-semibold">{resendTimer}</span>
              </p>

              <div className="flex items-start gap-2 mt-4">
                <input type="checkbox" id="terms" className="mt-1" defaultChecked />
                <label htmlFor="terms" className="text-xs text-gray-600">
                  By proceeding, you agree to NADL <span className="text-blue-600 underline">terms and conditions</span>
                </label>
              </div>

              <Button onClick={handleVerifyNadlOtp} className="w-full h-12 bg-purple-500 hover:bg-purple-600">
                Submit
              </Button>
            </Card>

            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-xs text-gray-500">Powered By <span className="text-purple-600 font-bold">N@DL</span></div>
              <Logo className="h-8" />
            </div>
          </div>
        )}

        {/* Step 4: Fetching Accounts */}
        {currentStep === 'fetching-accounts' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-700 font-medium mb-2">Fetching your accounts...</p>
            <p className="text-sm text-gray-600 text-center max-w-md">
              This may take few seconds. Please do not press back button or close the app.
            </p>
          </div>
        )}

        {/* Step 5: Account Selection */}
        {currentStep === 'account-selection' && (
          <div className="p-4 space-y-4">
            <div className="bg-white p-4 rounded-t-lg">
              <div className="flex items-center gap-2 mb-4">
                <Logo className="h-8" />
              </div>
            </div>

            <Card className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Select Account(s) to link</h2>
              <p className="text-sm text-gray-600">Account discovered for mobile no. {mobileNumber}</p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">i</div>
                  <span className="font-semibold">{selectedBank}</span>
                </div>
                
                <div className="border-2 border-blue-600 rounded-lg p-4 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                  />
                  <div>
                    <p className="font-semibold">A/c No XXXX4831</p>
                    <p className="text-sm text-gray-600">SAVINGS</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleContinueToBank} 
                disabled={!selectedAccount}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 mt-6"
              >
                Link Your Bank Account
              </Button>
            </Card>

            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-xs text-gray-500">Powered By <span className="text-purple-600 font-bold">N@DL</span></div>
              <Logo className="h-8" />
            </div>
          </div>
        )}

        {/* Step 6: Bank OTP */}
        {currentStep === 'bank-otp' && (
          <div className="p-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800 text-sm font-medium">OTP sent successfully</span>
              </div>
              <button className="text-gray-500"><X className="h-4 w-4" /></button>
            </div>

            <Card className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto">
                i
              </div>
              <h2 className="text-xl font-bold">{selectedBank}</h2>
              <p className="text-sm text-gray-600">OTP sent to {mobileNumber}</p>
              
              <Input
                type="text"
                placeholder="Please Enter OTP"
                value={bankOtp}
                onChange={(e) => setBankOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-12 text-center text-lg font-semibold"
                maxLength={6}
              />

              <Button onClick={handleVerifyBankOtp} className="w-full h-12 bg-gray-200 text-gray-700 hover:bg-gray-300">
                Verify OTP
              </Button>

              <p className="text-sm text-gray-600">Resend OTP in {resendTimer}</p>
              <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching OTP
              </p>
              <button className="text-sm text-blue-600">Go Back</button>
            </Card>
          </div>
        )}

        {/* Step 7: Linking Accounts */}
        {currentStep === 'linking' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
            <div className="relative mb-4">
              <Loader2 className="h-16 w-16 text-orange-500 animate-spin" />
            </div>
            <p className="text-gray-700 font-medium mb-2">Linking your Accounts...</p>
            <p className="text-sm text-gray-600 text-center max-w-md">
              This may take few seconds. Please do not press back button or close the app.
            </p>
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="text-xs text-gray-500">Powered By <span className="text-purple-600 font-bold">N@DL</span></div>
              <Logo className="h-8" />
            </div>
          </div>
        )}

        {/* Step 8: Consent Approval */}
        {currentStep === 'consent-approval' && (
          <div className="p-4 space-y-4 bg-gray-900 min-h-screen text-white">
            <h2 className="text-xl font-bold text-center">Approve Consent</h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold">i</div>
                <span className="font-semibold">{selectedBank}</span>
              </div>
              
              <div className="border border-gray-700 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked readOnly className="w-5 h-5 accent-blue-600" />
                  <div>
                    <p className="font-semibold text-sm">A/c No XXXX4831</p>
                    <p className="text-xs text-gray-400">SAVINGS</p>
                  </div>
                </div>
                <button className="text-xs text-blue-400 border border-gray-600 px-3 py-1 rounded">
                  Link Another Account
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-3">Consent Details</h3>
              
              <div className="border border-gray-700 rounded-lg p-4 space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Statement Period</span>
                  <span>19 May 25 - 17 Sep 25</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Purpose</span>
                  <span>Aggregated Statement</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Frequency</span>
                  <span>Once</span>
                </div>
                <button className="text-xs text-blue-400 mt-2">Show More ▼</button>
              </div>

              <div className="border border-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Statement Period</span>
                  <span>15 May 25 - 17 Dec 25</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Purpose</span>
                  <span className="text-xs">Explicit Consent For Monitoring Of The Accounts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Frequency</span>
                  <span>5 time(s) per MONTH</span>
                </div>
                <button className="text-xs text-blue-400 mt-2">Show More ▼</button>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              I hereby authorise Pocketcredit to fetch my transaction details.
            </p>
            
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="text-xs text-gray-500">Powered By <span className="text-purple-600 font-bold">N@DL</span></div>
              <span className="text-gray-600">|</span>
              <Logo className="h-6" />
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleReject} variant="outline" className="flex-1 h-12 bg-transparent border-gray-600 text-white hover:bg-gray-800">
                Reject
              </Button>
              <Button onClick={handleApproveConsent} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700">
                Approve
              </Button>
            </div>
          </div>
        )}

        {/* Step 9: Complete */}
        {currentStep === 'complete' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
            <CheckCircle className="h-24 w-24 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Bank Statement Verified!</h2>
            <p className="text-gray-600 text-center">Redirecting to next step...</p>
          </div>
        )}
      </div>
    </div>
  );
};

