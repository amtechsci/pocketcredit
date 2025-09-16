import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileText, AlertTriangle, Scale, Download, Mail, ExternalLink, Shield, Info } from 'lucide-react';




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
              These Terms and Conditions constitute a legally binding agreement between you and Spheeti Fintech Private Limited, 
              operating under the brand "Pocket Credit" - a product of Spheeti Fintech Private Limited
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
            
            {/* Section 1: Service Scope */}
            <Card>
              <CardHeader>
                <CardTitle>1. Scope of Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  The scope of services offered through the Pocket Credit platform includes:
                </p>
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Credit facility services</li>
                    <li>Account creation and maintenance</li>
                    <li>Facilitation for repayment</li>
                    <li>User grievances and feedback</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Eligibility */}
            <Card>
              <CardHeader>
                <CardTitle>2. Eligibility Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  To be eligible for our services, you must be:
                </p>
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>A natural or legal person</li>
                    <li>At least 21 years of age</li>
                    <li>Possess the legal capacity to enter into a binding contract under Indian law</li>
                    <li>Able to provide accurate and updated information</li>
                    <li>Willing to maintain the security of your mobile device</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Account Management */}
            <Card>
              <CardHeader>
                <CardTitle>3. User Account and Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Account License:</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    The company grants you a restricted, non-transferable license to use the web application.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Your Responsibilities:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Maintain confidentiality of your account information</li>
                    <li>Take responsibility for all activities that occur under your account</li>
                    <li>Notify the company immediately of any unauthorized use or security breach</li>
                    <li>Ensure you log out after each session</li>
                    <li>Follow the de-registration process outlined in the Privacy Policy (deleting the app does not terminate your account)</li>
                    <li>Keep the platform updated and agree not to engage in unlawful activities</li>
                    <li>Not create fraudulent accounts</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Information Collection */}
            <Card>
              <CardHeader>
                <CardTitle>4. Information Collection and Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  The company collects user information to deliver its services, and the handling of this information is governed by our Privacy Policy.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Information Requirements:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>You must provide accurate and updated information</li>
                    <li>You are accountable for all activities under your credentials and any bank transactions</li>
                    <li>You authorize the company or its third-party partners to facilitate payments</li>
                    <li>The company may deny access if information is deemed unreliable or fraudulent</li>
                    <li>Additional verification procedures may be introduced as needed</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>Note:</strong> If you are on the "Do Not Disturb" list, you are responsible for ensuring our representatives can contact you for service-related communications.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Intellectual Property */}
            <Card>
              <CardHeader>
                <CardTitle>5. Intellectual Property Rights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  All content on the platform, including code, data, text, designs, graphics, user interfaces, images, trademarks, logos, audio, video, and software, is the intellectual property of the company and is protected by applicable laws.
                </p>
                <div>
                  <h4 className="font-medium mb-2">License Granted:</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    The company grants you a limited, non-transferable, non-sublicensable, and revocable license for personal, lawful, and non-commercial use of the platform.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Prohibited Activities:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Using the platform for any unlawful purpose</li>
                    <li>Damaging or disabling our servers</li>
                    <li>Interfering with other users</li>
                    <li>Gaining unauthorized access</li>
                    <li>Decompiling, reverse engineering, or reproducing any content without prior written permission</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-2">
                    Unauthorized use may lead to the termination of your access and legal action.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Service Disclaimers */}
            <Card>
              <CardHeader>
                <CardTitle>6. Service Disclaimers and Warranties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-800 mb-2">"As Is" Service Provision</h4>
                      <p className="text-sm text-orange-700">
                        The platform is provided "as is," and the company does not warrant that it will be error-free, uninterrupted, secure, or compatible with all devices.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Service Limitations:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>We do not guarantee the quality, performance, or availability of our services</li>
                    <li>We do not guarantee that any defects will be corrected</li>
                    <li>We do not guarantee that the app is free from viruses</li>
                    <li>We use third-party providers for various tasks and are not liable for issues arising from reliance on their services</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: Third-Party Services */}
            <Card>
              <CardHeader>
                <CardTitle>7. Third-Party Links and Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Links to third-party websites are provided for convenience only. The company has no control over their content and makes no warranties regarding their accuracy, completeness, or reliability.
                </p>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Disclaimer:</strong> You access these links at your own risk. We are not responsible for any content, policies, or practices of third-party websites.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 8: User Content and Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>8. User Content and Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Any feedback you provide, including creative ideas and suggestions, can be used, edited, copied, published, and distributed by the company without restriction, confidentiality, or compensation.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Content License:</h4>
                  <p className="text-sm text-gray-700">
                    You grant the company a license to use any content you submit through the platform.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 9: Indemnification */}
            <Card>
              <CardHeader>
                <CardTitle>9. Indemnification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  You agree to indemnify, defend, and hold harmless the company and its associates from any claims, demands, losses, damages, liabilities, costs, and expenses arising from:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Your use or misuse of our services</li>
                  <li>Violation of these terms</li>
                  <li>Breach of representations</li>
                  <li>Infringement of rights</li>
                  <li>Any user content causing damage to a third party</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 10: Limitation of Liability */}
            <Card>
              <CardHeader>
                <CardTitle>10. Limitation of Liability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 mb-2">Liability Limitation</h4>
                      <p className="text-sm text-red-700">
                        The company is not liable for any direct, indirect, punitive, incidental, special, or consequential damages, including loss of use, data, or profits, arising from the access, use, or performance of the app's functions, interruptions, delays, or unauthorized access.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>Important:</strong> This clause survives in perpetuity and applies to all uses of our platform and services.
                </p>
                <p className="text-sm text-gray-700">
                  The company and its partners are not liable for any special, incidental, punitive, indirect, or consequential damages. We also disclaim responsibility for any losses resulting from internet fraud or hacking.
                </p>
              </CardContent>
            </Card>

            {/* Section 11: Account Termination */}
            <Card>
              <CardHeader>
                <CardTitle>11. Account Termination</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  The company reserves the right to terminate or suspend your membership, remove your profile or content, and restrict your access to the platform if there is a violation of these terms or any suspicious activity.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Upon Termination:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>All rights and licenses granted to you will be revoked</li>
                    <li>You must cease all use of the platform and its services</li>
                    <li>Outstanding loan obligations remain in effect</li>
                    <li>Certain provisions survive termination as specified</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 12: General Terms */}
            <Card>
              <CardHeader>
                <CardTitle>12. General Provisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Amendment:</h4>
                  <p className="text-sm text-gray-700">The company reserves the right to change or modify these terms at any time.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Assignment:</h4>
                  <p className="text-sm text-gray-700">You cannot assign or transfer your rights or obligations under these terms.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Waiver:</h4>
                  <p className="text-sm text-gray-700">Any delay or failure to exercise our rights does not constitute a waiver.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Severability:</h4>
                  <p className="text-sm text-gray-700">If any provision is deemed illegal or unenforceable, the remaining provisions will remain valid.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Survival:</h4>
                  <p className="text-sm text-gray-700">User representations, obligations, warranties, indemnities, limitation of liability, loan repayment, governing law, arbitration, and general provisions will survive termination.</p>
                </div>
              </CardContent>
            </Card>

            {/* Section 13: Governing Law */}
            <Card>
              <CardHeader>
                <CardTitle>13. Governing Law and Jurisdiction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  The use of the platform and these terms are governed by the laws of India, with exclusive jurisdiction for any disputes in Assam.
                </p>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>14. Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  For grievances, you can submit complaints or feedback in writing via email:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#0052FF' }} />
                    <span>Customer Support: support@creditlab.in</span>
                  </div>
                  <div>
                    <p className="font-medium">Corporate Address:</p>
                    <p className="text-gray-600">
                      Spheeti Fintech Private Limited<br />
                      #30 2nd Floor 1st Main BHCS Layout<br />
                      BTM 2nd Stage Opp Gopalan Innovation Mall<br />
                      Bengaluru, Karnataka 560076, India
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