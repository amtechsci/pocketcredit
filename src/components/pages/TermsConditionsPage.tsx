import { useNavigate } from 'react-router-dom';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FileText, AlertTriangle, Download, Mail, ExternalLink, Shield, Info } from 'lucide-react';




export function TermsConditionsPage() {
    const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <FileText className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Terms & <span style={{ color: '#0052FF' }}>Conditions</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              This document is a legally binding agreement between you (the "User") and Spheeti Fintech Private Limited ("Company," "we," "us," or "our"), 
              a Non-Banking Financial Company (NBFC) with its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India - 421001.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Last Updated: January 10, 2025 | Effective Date: January 10, 2025
            </p>
          </div>

          {/* Important Notice */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-blue-800 mb-2">NBFC Registration</h3>
                    <p className="text-sm text-blue-700">
                      Spheeti Fintech Private Limited is a Non-Banking Financial Company (NBFC) registered with the Reserve Bank of India (RBI) and operates under the brand name "Pocket Credit". All services are provided in compliance with RBI guidelines and regulations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Terms Content */}
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Introduction */}
            <Card>
              <CardHeader>
                <CardTitle>Introduction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  This document is a legally binding agreement between you (the "User") and Spheeti Fintech Private Limited ("Company," "we," "us," or "our"), a Non-Banking Financial Company (NBFC) with its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India - 421001. By using the app or its services, you accept these Terms and Conditions (T&Cs).
                </p>
              </CardContent>
            </Card>

            {/* Section 1: Scope */}
            <Card>
              <CardHeader>
                <CardTitle>1. SCOPE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  The platform provides you with the following facilities:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Credit facility services</li>
                  <li>Account creation and maintenance</li>
                  <li>Repayment facilitation</li>
                  <li>A channel for user grievances and feedback</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 2: Eligibility */}
            <Card>
              <CardHeader>
                <CardTitle>2. ELIGIBILITY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You must be a natural or legal person, at least 21 years of age, with the legal capacity to enter into contracts under Indian law.
                </p>
              </CardContent>
            </Card>

            {/* Section 3: Right to Terminate */}
            <Card>
              <CardHeader>
                <CardTitle>3. RIGHT TO TERMINATE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We reserve the right to terminate or suspend your account and access to the Platform at any time, without notice, if we detect a violation of these T&Cs or any suspicious activity.
                </p>
              </CardContent>
            </Card>

            {/* Section 4: User Account */}
            <Card>
              <CardHeader>
                <CardTitle>4. USER ACCOUNT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You are granted a limited, non-transferable license to use the application on a device you own or control. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. Deleting the app does not terminate your account; you must follow the de-registration process.
                </p>
              </CardContent>
            </Card>

            {/* Section 5: Representations and Obligations */}
            <Card>
              <CardHeader>
                <CardTitle>5. REPRESENTATIONS AND OBLIGATIONS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You must ensure all information you provide is accurate and updated. You are responsible for the security of your mobile device and all activities under your account credentials. You agree not to engage in unlawful activities, such as creating fraudulent accounts.
                </p>
              </CardContent>
            </Card>

            {/* Section 6: Intellectual Property */}
            <Card>
              <CardHeader>
                <CardTitle>6. INTELLECTUAL PROPERTY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  All content, features, and functionality on the Platform, including code, text, graphics, and logos, are our intellectual property and are protected by law.
                </p>
              </CardContent>
            </Card>

            {/* Section 7: Limitation on Use */}
            <Card>
              <CardHeader>
                <CardTitle>7. LIMITATION ON USE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You are granted a limited, non-commercial license to access the Platform for personal, lawful purposes. You shall not decompile, reverse engineer, copy, modify, or distribute the Platform or its content. Unauthorized use may lead to termination of your access and legal action.
                </p>
              </CardContent>
            </Card>

            {/* Section 8: Data and Information Privacy */}
            <Card>
              <CardHeader>
                <CardTitle>8. DATA AND INFORMATION PRIVACY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Our handling of your personal data is governed by our Privacy Policy. We may use third-party providers for services like KYC checks and payment processing. We are not liable for issues arising from our reliance on these third-party services.
                </p>
              </CardContent>
            </Card>

            {/* Section 9: Disclaimer */}
            <Card>
              <CardHeader>
                <CardTitle>9. DISCLAIMER</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-800 mb-2">"As Is" Service Provision</h4>
                      <p className="text-sm text-orange-700">
                        The Platform is provided on an "as is" basis. We do not guarantee that it will be error-free, uninterrupted, or completely secure. We are not liable for any special, incidental, or consequential damages arising from your use of the Platform.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 10: User Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>10. USER FEEDBACK</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  If you submit any creative ideas, suggestions, or other content ("comments"), you agree that we may use, edit, and distribute these comments without restriction or compensation.
                </p>
              </CardContent>
            </Card>

            {/* Section 11: Third Party Links and Advertisement */}
            <Card>
              <CardHeader>
                <CardTitle>11. THIRD PARTY LINKS AND ADVERTISEMENT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We are not responsible for the content, accuracy, or reliability of any third-party websites linked on the Platform. Accessing these links is at your own risk.
                </p>
              </CardContent>
            </Card>

            {/* Section 12: Indemnity */}
            <Card>
              <CardHeader>
                <CardTitle>12. INDEMNITY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You agree to indemnify and hold harmless the Company from any claims, losses, or damages arising out of your use or misuse of the Services or your violation of these T&Cs.
                </p>
              </CardContent>
            </Card>

            {/* Section 13: Limitation of Liability */}
            <Card>
              <CardHeader>
                <CardTitle>13. LIMITATION OF LIABILITY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 mb-2">Liability Limitation</h4>
                      <p className="text-sm text-red-700">
                        We shall not be liable for any direct, indirect, punitive, or consequential damages connected with the use or performance of the app's features, whether based on contract, tort, negligence, or otherwise.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 14: General Terms */}
            <Card>
              <CardHeader>
                <CardTitle>14. GENERAL TERMS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Amendment:</h4>
                  <p className="text-sm text-gray-700">We can change these Terms at any time.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Assignment:</h4>
                  <p className="text-sm text-gray-700">You cannot transfer your rights or obligations under these Terms.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Governing Law:</h4>
                  <p className="text-sm text-gray-700">These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of the courts in Assam.</p>
                </div>
              </CardContent>
            </Card>

            {/* Section 15: Grievances */}
            <Card>
              <CardHeader>
                <CardTitle>15. GRIEVANCES</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  For complaints or feedback, you can contact us via email at: support@pocketcredit.in
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#0052FF' }} />
                    <span>Email: support@pocketcredit.in</span>
                  </div>
                  <div>
                    <p className="font-medium">Company Address:</p>
                    <p className="text-gray-600">
                      Spheeti Fintech Private Limited<br />
                      Mahadev Compound Gala No. A7, Dhobi Ghat Road<br />
                      Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI<br />
                      Maharashtra, India - 421001
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Related Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Related Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/privacy')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Privacy Policy
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/grievance')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Grievance Redressal
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/fair-practice')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Fair Practice Code
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/partners')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Partner List
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="text-center space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download/Print Terms
                </Button>
                <Button 
                  onClick={() => navigate('/contact')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Contact Support Team
                </Button>
              </div>
              <Button 
                onClick={() => navigate('/home')}
                variant="outline"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}