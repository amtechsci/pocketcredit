import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Key } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../Logo';
import { getPolicyPdfUrl } from '../../services/policyService';

// Component to handle policy links that fetch PDF from API
function PolicyLink({ slug, label }: { slug: string; label: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        setLoading(true);
        const url = await getPolicyPdfUrl(slug);
        setPdfUrl(url);
      } catch (error) {
        console.error(`Error fetching policy PDF for ${slug}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchPdf();
  }, [slug]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    } else if (!loading) {
      toast.error('Policy document is currently unavailable');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-blue-600 hover:underline"
      disabled={loading}
    >
      {label}
    </button>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const { loginWithOTP } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showExperianModal, setShowExperianModal] = useState(false);


  const validateMobileNumber = (number: string) => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(number);
  };

  const sendOtp = async () => {
    if (!validateMobileNumber(mobileNumber)) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    if (!consentChecked) {
      toast.error('Please agree to the terms and conditions to continue');
      return;
    }

    // Set loading state immediately
    setLoading(true);
    
    try {
      // Call the API service directly to avoid context loading state conflicts
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for session management
        body: JSON.stringify({ mobile: mobileNumber }),
      });

      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        // On success, update the state IMMEDIATELY to show the OTP form
        setShowOtp(true);
        setTimer(60);
        toast.success('OTP sent successfully to your mobile number');
        
        // Timer countdown
        const interval = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Handle API errors
        console.error('OTP send failed:', result.message);
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (error) {
      // Handle network or other unexpected errors
      console.error('Failed to send OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      // This ALWAYS runs last, after the try or catch block
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    console.log('🔍 verifyOtp called with OTP:', otp);
    
    if (otp.length !== 4) {
      console.log('❌ OTP length invalid:', otp.length);
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    console.log('✅ OTP validation passed, calling loginWithOTP...');
    setLoading(true);
    try {
      const result = await loginWithOTP(mobileNumber, otp);
      console.log('📥 loginWithOTP result:', result);
      
      if (result.success) {
        console.log('✅ Login successful, navigating to dashboard...');
        toast.success('Login successful!');
        
        // Check if user needs to complete profile
        // The AuthContext will handle this based on profile_completion_step
        // For now, navigate to dashboard - the App component will handle routing
        navigate('/dashboard');
      } else {
        console.log('❌ Login failed:', result.message);
        toast.error(result.message);
      }
    } catch (error) {
      console.error('❌ OTP verification exception:', error);
      toast.error('OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = () => {
    if (timer > 0) return;
    sendOtp();
  };

  const resetForm = () => {
    setMobileNumber('');
    setOtp('');
    setShowOtp(false);
    setTimer(0);
    setConsentChecked(false);
  };

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#F0F4F8' }}>
      <div className="container mx-auto px-4 max-w-md">

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-0">
            {/* Logo */}
            
            <CardTitle style={{ color: '#1E2A3B' }}>
              Login or Sign Up
            </CardTitle>
            <CardDescription className="text-base">
              Enter your mobile number to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!showOtp ? (
              // Mobile Number Input
              <div className="space-y-4">
                <div className="space-y-2">
                  
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-10 border-1 border-gray-300 rounded-md"
                      maxLength={10}
                    />
                    <p className="text-xs text-gray-500" style={{ paddingLeft: '2px', marginTop: '5px' }}> 
                      Please enter phone number linked to your Aadhaar Card
                    </p>
                  </div>
                </div>

                {/* Disclaimer and Consent */}
                <div className="space-y-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="consent" className="text-xs text-gray-700 leading-relaxed" style={{ paddingLeft: '5px' }}>
                      By continuing, I hereby agree/authorize the following:
                    </label>
                  </div>
                  
                  <div className="ml-6 space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>
                      1. PocketCredit{' '}
                      <PolicyLink slug="terms-conditions" label="T&C" />
                      {' '}&{' '}
                      <PolicyLink slug="privacy-policy" label="privacy policy" />
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>2. I am an Indian citizen above 21 years of age.</p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>3. I give my explicit consent and authorize PocketCredit and its partners to contact me via calls, SMS, IVR, auto-calls, WhatsApp and email for transactional, service, and promotional purposes, even if I am registered on DND/NDNC. I confirm that I am applying for a financial product and this consent forms part of my application.</p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>4. I declare that I can read and understand English and agree to receive all documents/ correspondence in English.</p>
                    <p className="text-xs text-gray-700 leading-relaxed" style={{ fontSize: '10px' }}>5. I hereby consent to PocketCredit (Spheeti Fintech Pvt. Ltd.) being appointed as my authorised representative to receive my credit information from Experian for the purpose of evaluating and providing loan offers to me. I acknowledge and agree to the{' '}
                      <button
                        onClick={() => setShowExperianModal(true)}
                        className="text-blue-600 hover:underline"
                      >
                        Experian Terms & Conditions
                      </button>.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={sendOtp}
                  disabled={loading || !validateMobileNumber(mobileNumber) || !consentChecked}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </div>
            ) : (
              // OTP Verification
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    OTP sent to <span className="font-medium">+91 {mobileNumber}</span>
                  </p>
                  <button
                    onClick={() => {
                      setShowOtp(false);
                      setOtp('');
                    }}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    Change number?
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 4-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="pl-10 text-center text-lg tracking-widest border-1 border-gray-300 rounded-md"
                      maxLength={4}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 4-digit OTP sent to your mobile number
                  </p>
                </div>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend OTP in {timer} seconds
                    </p>
                  ) : (
                    <button
                      onClick={resendOtp}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <Button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 4}
                  style={{ backgroundColor: '#0052FF' }}
                  className="w-full text-white hover:opacity-90"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
              </div>
            )}



            {/* Terms and Privacy */}
            <div className="text-center pt-4">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our{' '}
                <button
                  onClick={() => navigate('/terms')}
                  className="text-blue-600 hover:underline"
                >
                  Terms & Conditions
                </button>{' '}
                and{' '}
                <button
                  onClick={() => navigate('/privacy')}
                  className="text-blue-600 hover:underline"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700">
              Secured with 256-bit encryption
            </span>
          </div>
        </div>
      </div>

      {/* Experian Terms & Conditions Modal */}
      <Dialog open={showExperianModal} onOpenChange={setShowExperianModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] sm:max-w-4xl flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
              Experian Terms & Conditions
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-2">Last updated on November 17, 2025</p>
          </DialogHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(95vh - 180px)' }}>
            <style>{`
              /* Custom scrollbar styling */
              .experian-terms-scroll::-webkit-scrollbar {
                width: 8px;
              }
              .experian-terms-scroll::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
              }
              .experian-terms-scroll::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
              }
              .experian-terms-scroll::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
            `}</style>
            <div className="experian-terms-scroll space-y-6 text-sm leading-relaxed" style={{ color: '#374151' }}>
              {/* Header Section */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-bold mb-2" style={{ color: '#1E2A3B' }}>Terms of Use Agreement</h3>
                <p className="text-xs text-gray-500 mb-1">Revised November 17, 2025</p>
                <p className="text-xs text-gray-500 italic">(Please note that our Terms of Use Agreement is also referred to as the "Terms and Conditions")</p>
              </div>

              {/* Overview Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="overview">
                  Overview and Acceptance of Terms
                </h4>
                <p className="text-sm leading-7">
                  You agree that by creating an account with ECS (as defined below), or using our Services (as defined below), website(s) (such as this website, usa.experian.com, or any affiliated website (including, but not limited to, Experian.com, FreeCreditReport.com, FreeCreditScore.com, CreditReport.com, Creditchecktotal.com, CreditScore.com, usa.experian.com, and experian.experiandirect.com)), or mobile applications (such as the Experian app), as well as any content provided or accessible in connection with the website(s) or mobile application(s), including information, user interfaces, source code, reports, images, products, services, and data (each website and mobile application referred to herein as a "Website," and collectively, as "Websites"), you represent to ECS that you have read, understood, and expressly consent and agree to be bound by this Terms of Use Agreement, and the terms, conditions, and notices contained or referenced herein ("Agreement") whether you are a "Visitor" (which means that you simply browse or access a Website), or a "Customer" (which means that you have created an account with ECS, or enrolled or registered with a Website, or are accessing or using a Service).
                </p>
                <p className="text-sm leading-7">
                  At Customer's election, Customer may, from time to time, request to receive, and ECS may provide, free services or services subject to a fee, whether a recurring fee or a one-time transactional fee (each a "Service"), and Customer's receipt and use of such Services shall, at all times, be subject to this Agreement. The term "Service" includes, but is not limited to, the provision of any of our products and services, including credit report(s), credit risk score(s), credit monitoring, credit score monitoring and credit score tracking (including all the data and information contained therein), the receipt of any alerts notifying you of changes to the information contained in your credit report(s), regardless of the manner in which you receive the Services, whether by email or mail, through a website or mobile application, by telephone, or through any other mechanism by which a Service is delivered or provided to you.
                </p>
                <p className="text-sm leading-7">
                  The term "you," "your," and "User" means a Visitor or a Customer. The term "ECS" means ConsumerInfo.com, Inc., an Experian® company (also known as Experian Consumer Services) and referred to as "Experian" on the Websites, its predecessors in interest, successors and assigns, affiliates (including, but not limited to, Experian Information Solutions, Inc.), agents, employees, and any of its third party service providers (including, without limitation, cloud service providers) who ECS uses in connection with the provision of the Services to you. The terms "we" and "us" mean you and ECS. If you are a Visitor and do not wish to be bound by this Agreement, you should immediately cease accessing and using the Websites. Notwithstanding the immediate preceding sentence, if you are a Visitor and continue to access and use a Website, by virtue of your continued access and use of the Website, you are indicating your acceptance of this Agreement and agreement to be bound by the terms and conditions contained herein. If you wish to become a Customer and make use of the Services, you will be prompted during the registration process to agree, and must agree, to be bound by this Agreement.
                </p>
                <p className="text-sm leading-7">
                  You may not browse the Websites, or create an account or register with ECS, or use or enroll in any Services, and you may not accept this Agreement, if you are not of a legal age to form a binding contract with ECS. If you accept this Agreement, you represent that you have the capacity to be bound by it. Before you continue, you should print or save a local copy of this Agreement for your records.
                </p>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                  <p className="text-sm font-semibold leading-6" style={{ color: '#92400e' }}>
                    THE SERVICES AND WEBSITES ARE SUBJECT TO ALL TERMS AND CONDITIONS CONTAINED HEREIN AND ALL APPLICABLE LAWS AND REGULATIONS. PLEASE READ THIS AGREEMENT CAREFULLY. YOUR ACCEPTANCE OF, ORDER OF, USE OF, AND/OR ACCESS TO, THE SERVICES AND WEBSITES CONSTITUTES YOUR AGREEMENT TO ABIDE BY EACH OF THE TERMS AND CONDITIONS SET FORTH HEREIN. IF YOU DO NOT AGREE WITH ANY OF THESE TERMS OR CONDITIONS, DO NOT USE, ACCESS OR ORDER ANY SERVICE OR ACCESS OR USE THE WEBSITES. IF YOU HAVE ALREADY BEGUN ACCESSING OR USING THE SERVICES AND/OR WEBSITES AND DO NOT AGREE TO BE BOUND BY THIS AGREEMENT, IMMEDIATELY CEASE USING THE SERVICE OR WEBSITE AND/OR DISCARD ANY INFORMATION OR PRODUCTS YOU RECEIVED VIA ANY SERVICE OR WEBSITE (TO THE EXTENT APPLICABLE), AND CALL CUSTOMER CARE AT 1-855-962-6943 TO CANCEL YOUR ACCOUNT WITH ECS. NOTE, YOU MAY ALSO BE ABLE TO DEACTIVATE YOUR PAID SERVICE AND RETAIN YOUR ACCOUNT WITH ECS ONLINE, AS AND TO THE EXTENT EXPLAINED IN FURTHER DETAIL BELOW.
                  </p>
                </div>
              </section>

              {/* FCRA Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="fcra-consent">
                  FCRA Permissible Purpose and Consents
                </h4>
                <p className="text-sm leading-7">
                  You understand and agree that, by establishing an account with ECS, or submitting your order or enrolling for any Service (including an order for a Service that includes enrollment of your minor child in such Service), you have provided "written instructions" in accordance with the Fair Credit Reporting Act, as amended ("FCRA"), for ECS, and its service providers, to obtain your credit report and/or credit score(s) (or the credit report or credit score(s) of any minor children whom you have enrolled in a Service) on a recurring basis to provide them to you while you have an account with ECS, and such information may be obtained by Experian Information Solutions, Inc. ("Experian Credit Bureau") or any other credit or counseling reporting company. You understand and agree that, pursuant to such authorization, ECS, and its service providers, may access your credit profile (and those of any minor children whom you have enrolled in a Service), including without limitation, your credit report, credit score(s) and other related information, to, among other things, verify your identity (or those of any minor children whom you have enrolled) and to provide credit monitoring, credit scoring, credit score monitoring and tracking, identity monitoring, alerts for, among other things, dormant accounts, new accounts, inquiries, other changes to information contained in your credit report, fraud resolution, or card registry products. You understand and agree that ECS, and its service providers, may, from time to time, provide products, services, features and/or functionality to you, and that they shall be offered pursuant to the same authorization that you provided to ECS for ECS to obtain your credit report and/or credit score(s) on a recurring basis to provide them to you to review while you have an account with ECS.
                </p>
                <p className="text-sm leading-7">
                  You further understand and agree that, by establishing an account with ECS, or submitting your order or enrolling for any Service, you are providing "written instructions" in accordance with the FCRA for ECS and its service providers, to obtain and use the information you have provided, and your credit report and/or credit score(s) to notify you of credit opportunities and other products and services that may be available to you through ECS or through unaffiliated third parties (as explained in the section below entitled "General Description of Services"). In addition, you further understand and agree that, if you request certain credit or loan offers as part of any Service, such as prequalified personal loan offers, you are authorizing ECS and its service providers to send your information to lending partners on your behalf, and are providing "written instructions" in accordance with the FCRA to such credit and lending partners to obtain information from your personal credit profile or other information from one or more consumer reporting agencies, such as TransUnion, Experian or Equifax, to prequalify you for credit or loan options, offers or other credit opportunities, including prequalified personal loan offers, to share such credit opportunities with ECS, or to use such information to assist you in completing a credit or loan application.
                </p>
                <p className="text-sm leading-7">
                  You understand and agree that ECS receives compensation for the marketing of credit opportunities or other products or services available through third parties, and that this compensation may impact how and where such credit opportunities, products or services appear on a Website (including, for example, the order in which they appear). You further understand and agree that many but not all credit opportunities available through third parties, such as prequalified credit and personal loan offers, may be made available to you in a Service, and such Service will not include all credit opportunities available through third parties. Please note that prequalification for a credit opportunity available through a third party does not guarantee approval, and you will need to submit an application with such third party if you choose to apply for a prequalified offer (and such application may result in a credit inquiry that can impact your credit score(s)).
                </p>
                <p className="text-sm leading-7">
                  You further understand and agree that, by using the Experian Boost Service or other Services using Linked Accounts (as defined below, including Financial Management Tools), you (i) authorize ECS and its service providers, including those service providers used to obtain your account and transaction information, to gain recurring access to your financial account(s), and utility, telecom and other service account(s) (if available in your Service), to obtain, use and store financial and service account information (including, without limitation, account names, numbers, descriptions and balances, and credit limits, due dates, interest rates, reward balances, and recurrences) and transactions (including, without limitation, historical and current transactions, transaction types, amounts, dates and descriptions) ("Consumer Consent Account and Transaction Data") to add and maintain transactions (e.g. addition of certain utility and mobile telecom bill, insurance and rental payment history, including, if available in your Service, electronic bill payments) to your Experian credit or consumer file with an Experian Bureau (as defined below) ("Experian Credit File"), provide you with personalized offers, including credit opportunities and other products and services that may be available to you through ECS or through unaffiliated third parties ("Personalized Offers") if such Service is made available to you, and if Financial Management Tools are made available to you, for ECS to monitor and provide alerts and insights for your financial and service account information and transactions for your own review, and for the purpose of facilitating and improving Experian Boost and other services (including for research, development, and analytical purposes which includes without limitation developing products and services for ECS and its affiliates and for evaluating partners and their products or services); and (ii) designate ECS, and its service providers, including those service provider(s) used to obtain your account information, as your agent(s), and have provided "written instructions" in accordance with the FCRA, to add and maintain information to your Experian credit file using Consumer Consent Account and Transaction Data, and such information may be provided on your behalf by ECS to the Experian Credit Bureau, Experian RentBureau and any other Experian credit or counseling reporting company or Experian specialized bureau (collectively, "Experian Bureaus" and each an "Experian Bureau"), and may be used and stored by the Experian Bureaus for any purposes lawfully permitted by the FCRA (e.g. use in lending decisions of certain utility and mobile telecom bill, insurance and rental payment history added to your Experian credit file using Experian Boost), and/or to the same extent as any other information furnished to the Experian Credit Bureau or any other Experian Bureau for inclusion in your Experian Credit File.
                </p>
                <p className="text-sm leading-7">
                  ECS may, at its sole discretion, provide you the choice to opt out of receiving Personalized Offers from unaffiliated third parties based on Consumer Consent Account and Transaction Data. Opting out of Personalized Offers based on Consumer Consent Account and Transaction Data, should you choose to do so, will not impact your ability to use the Experian Boost Service or Financial Management Tools Service, nor will opting out of Personalized Offers based on Consumer Consent Account and Transaction Data cause you to opt out of other marketing or personalized offers from ECS or unaffiliated third parties, including credit opportunities and other products and services that may be available to you through ECS or through unaffiliated third parties.
                </p>
              </section>

              {/* Personal Information Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="personal-info">
                  Personal Information
                </h4>
                <p className="text-sm leading-7">
                  ECS, and its service providers, may use your personal information to the extent necessary to authenticate your identity, process your order or request for, and provide, the Services to you, as well as for quality assurance, account and business maintenance, and other business uses in accordance with applicable law. You also agree that ECS may share personal information about your transactions and experiences with us, with both our affiliates and non-affiliated third parties as described in our Privacy Policy. You may have the right under federal law to limit some but not all of our sharing as described in our Privacy Policy.
                </p>
              </section>

              {/* Amendments Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="amendments">
                  Amendments
                </h4>
                <p className="text-sm leading-7">
                  This Agreement may be updated from time to time. You should check this Website regularly for updates to this Agreement. Each time you order, access or use any of the Services or Websites, you signify your acceptance and agreement, without limitation or qualification, to be bound by the then current Agreement. Modifications take effect as soon as they are posted to this Website (or any of the Websites, to the extent applicable to you), delivered to you, or reasonably made available to you in writing by ECS. However, no amendment will retroactively modify the parties' agreed-to dispute resolution provisions of this Agreement for then-pending disputes, unless the parties expressly agree otherwise in writing.
                </p>
              </section>

              {/* Modification Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="modification">
                  Modification of Services or Websites
                </h4>
                <p className="text-sm leading-7">
                  ECS may, at its discretion, modify or discontinue any of the Services or Websites, or any portion thereof, with or without notice. You agree that ECS will not be liable to you, your minor children or any third party for any modification or discontinuance of any of the Service or Websites.
                </p>
              </section>

              {/* General Description Section */}
              <section className="space-y-3">
                <h4 className="font-bold text-base mb-3 uppercase tracking-wide" style={{ color: '#1E2A3B' }} id="general-description">
                  General Description of Services
                </h4>
                <p className="text-sm leading-7">
                  The Services and Websites are meant to provide you a means to review your personal finance and/or credit information for educational purposes only, and to manage if and to the extent you so choose, and may notify you of credit opportunities and other products and services that may be available to you through ECS or through third parties (such as, among other things, advertisements or offers for available credit cards, loan options, financial products or services, or credit related products or services and other offers to Customers, the ability to track and collect certain consumer information specific to you, including but not limited to, credit score, loan and credit card monthly payment, total amount and interest rates). The Services and Websites are meant for your personal use only. The Services and Websites may also provide you other third-party product information, such as the availability of loans and other financial products or services, or credit related products or services (including credit repair or other credit education services). This includes receiving offers free of charge for various credit or other financial products or services based upon your self-identified credit attributes (and/or your consumer report or credit score). These offers may also be generic and may not contain offers based on information specific to you.
                </p>
                <p className="text-sm leading-7">
                  We will identify those Services that are provided to you free of charge. Some of the Services (including Experian Credit Tracker, Experian CreditWorks, or Experian IdentityWorks) may require a fee at the time of Service purchase or enrollment, such as membership Services that require the payment of an ongoing fee for ECS's provision of such Services. By purchasing such Services and providing payment information, you represent that you are authorized to utilize the payment method presented and agree to pay the specified fee for paid Services, including any method offered or used through a mobile application. Furthermore, you agree and authorize us to, for time to time: (i) submit a transaction using the card information provided, (ii) in the case of automatic recurring transactions, submit a transaction on a recurring basis (e.g., monthly or annual basis) for membership renewals, (iii) if necessary, obtain updates from card issuers for cards provided to us, (iv) if necessary, bill you, in a prorated manner (as required), in accordance with the particular fee terms for the Service you are purchasing or enrolling in, including if you are transitioning between free or paid Services (or vice versa), when a recurring basis transaction is at issue, and (v) if necessary (and applicable) bill your mobile carrier or others via a mobile application if you authorize us to do so. You may cancel your subscription or enrollment for an ongoing paid Service at any time by calling Customer Care or by using any other method specified on the Websites or in the customer membership center.
                </p>
              </section>
            </div>
          </div>

          {/* Footer with Button */}
          <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50">
            <Button
              onClick={() => setShowExperianModal(false)}
              className="w-full text-base py-6 font-semibold"
              style={{ backgroundColor: '#0052FF' }}
            >
              I Understand and Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}