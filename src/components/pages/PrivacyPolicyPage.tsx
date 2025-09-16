import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Shield, Eye, Lock, Download, Mail } from 'lucide-react';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Privacy <span style={{ color: '#0052FF' }}>Policy</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              We are committed to protecting your privacy and ensuring the security of your personal information. 
              Spheeti Fintech Private Limited operates under the brand "Pocket Credit" to provide transparent and secure lending services.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Last Updated: January 10, 2025
            </p>
          </div>

          {/* Quick Summary */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" style={{ color: '#0052FF' }} />
                  Privacy at a Glance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <Lock className="w-8 h-8 mx-auto mb-2" style={{ color: '#00C49A' }} />
                    <h4 className="font-medium mb-1">Data Security</h4>
                    <p className="text-sm text-gray-600">Bank-grade encryption protects your information</p>
                  </div>
                  <div className="text-center">
                    <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: '#00C49A' }} />
                    <h4 className="font-medium mb-1">No Data Sale</h4>
                    <p className="text-sm text-gray-600">We never sell your personal data to third parties</p>
                  </div>
                  <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-2" style={{ color: '#00C49A' }} />
                    <h4 className="font-medium mb-1">Full Control</h4>
                    <p className="text-sm text-gray-600">You can access, update, or delete your data anytime</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Privacy Policy Content */}
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Section 1: Information We Collect */}
            <Card>
              <CardHeader>
                <CardTitle>1. Information We Collect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Personal Information</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Name, address, phone number, and email address</li>
                    <li>Date of birth and identity verification documents</li>
                    <li>Employment details and income information</li>
                    <li>Bank account details and financial statements</li>
                    <li>Credit score and credit history information</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Technical Information</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>IP address, browser type, and device information</li>
                    <li>Usage data and interaction with our platform</li>
                    <li>Cookies and similar tracking technologies</li>
                    <li>Location data (with your consent)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: How We Use Your Information */}
            <Card>
              <CardHeader>
                <CardTitle>2. How We Use Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Loan Processing</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Evaluate loan eligibility and creditworthiness</li>
                    <li>Process loan applications and disbursals</li>
                    <li>Communicate loan status and updates</li>
                    <li>Manage ongoing loan relationships</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Service Improvement</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Enhance user experience and platform functionality</li>
                    <li>Provide personalized loan recommendations</li>
                    <li>Conduct analytics and market research</li>
                    <li>Prevent fraud and ensure platform security</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Legal Compliance</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Comply with regulatory requirements</li>
                    <li>Report to credit bureaus as required</li>
                    <li>Respond to legal requests and court orders</li>
                    <li>Maintain records as per statutory requirements</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Information Sharing */}
            <Card>
              <CardHeader>
                <CardTitle>3. Information Sharing and Disclosure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">NBFC Operations</h4>
                  <p className="text-sm text-gray-700">
                    Spheeti Fintech Private Limited is a registered Non-Banking Financial Company (NBFC) with the Reserve Bank of India. 
                    We process, evaluate, and disburse loans directly while maintaining strict confidentiality and data protection standards.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Credit Bureaus</h4>
                  <p className="text-sm text-gray-700">
                    We report loan information to credit bureaus (CIBIL, Experian, Equifax, CRIF) 
                    to help maintain accurate credit records and facilitate future credit decisions.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Service Providers</h4>
                  <p className="text-sm text-gray-700">
                    We work with trusted third-party service providers for technology services, 
                    data analytics, customer support, and fraud prevention. They are contractually 
                    obligated to protect your information.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Legal Requirements</h4>
                  <p className="text-sm text-gray-700">
                    We may disclose information when required by law, regulation, legal process, 
                    or government request, or to protect the rights, property, or safety of our users.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Data Security */}
            <Card>
              <CardHeader>
                <CardTitle>4. Data Security and Protection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Security Measures</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>256-bit SSL encryption for all data transmission</li>
                    <li>Multi-factor authentication for account access</li>
                    <li>Regular security audits and penetration testing</li>
                    <li>Secure data centers with 24/7 monitoring</li>
                    <li>Employee background checks and security training</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Data Retention</h4>
                  <p className="text-sm text-gray-700">
                    We retain your personal information for as long as necessary to provide our services 
                    and comply with legal obligations. Inactive accounts may be archived after 7 years 
                    as per RBI guidelines.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Your Rights */}
            <Card>
              <CardHeader>
                <CardTitle>5. Your Rights and Choices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Access and Update</h4>
                  <p className="text-sm text-gray-700">
                    You can access and update your personal information through your account dashboard 
                    or by contacting our customer support team.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Data Portability</h4>
                  <p className="text-sm text-gray-700">
                    You have the right to request a copy of your personal data in a structured, 
                    commonly used format for transfer to another service provider.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Consent Withdrawal</h4>
                  <p className="text-sm text-gray-700">
                    You can withdraw your consent for non-essential data processing activities. 
                    However, this may limit our ability to provide certain services.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Account Deletion</h4>
                  <p className="text-sm text-gray-700">
                    You can request account deletion, subject to our legal obligations to retain 
                    certain information for regulatory compliance and audit purposes.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Cookies and Tracking */}
            <Card>
              <CardHeader>
                <CardTitle>6. Cookies and Tracking Technologies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Cookie Usage</h4>
                  <p className="text-sm text-gray-700">
                    We use cookies and similar technologies to enhance your browsing experience, 
                    remember your preferences, and analyze platform usage for improvements.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Cookie Control</h4>
                  <p className="text-sm text-gray-700">
                    You can control cookie settings through your browser preferences. However, 
                    disabling cookies may affect the functionality of our platform.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: Third-Party Links */}
            <Card>
              <CardHeader>
                <CardTitle>7. Third-Party Links and Services</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  Our platform may contain links to third-party websites or services. We are not 
                  responsible for the privacy practices of these external sites. We encourage you 
                  to review their privacy policies before providing any personal information.
                </p>
              </CardContent>
            </Card>

            {/* Section 8: Updates to Policy */}
            <Card>
              <CardHeader>
                <CardTitle>8. Updates to This Privacy Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  We may update this privacy policy periodically to reflect changes in our practices 
                  or applicable laws. We will notify you of significant changes through email or 
                  prominent notices on our platform. Continued use of our services constitutes 
                  acceptance of the updated policy.
                </p>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>9. Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  If you have questions about this privacy policy or our data practices, please contact us:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#0052FF' }} />
                    <span>Privacy Officer: support@creditlab.in</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#0052FF' }} />
                    <span>Data Protection Officer: support@creditlab.in</span>
                  </div>
                  <div>
                    <p className="font-medium">Mailing Address:</p>
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

            {/* Action Buttons */}
            <div className="text-center space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download/Print Policy
                </Button>
                <Button 
                  onClick={() => navigate('/contact')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Contact Privacy Officer
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