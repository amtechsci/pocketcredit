import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
              Spheeti Fintech Private Limited ("Company," "we," or "us") is committed to protecting your personal information. 
              This Privacy Policy outlines how we collect, store, use, disclose, and process your information when you use our services.
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
            
            {/* Section 1: Introduction */}
            <Card>
              <CardHeader>
                <CardTitle>1. INTRODUCTION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Spheeti Fintech Private Limited ("Company," "we," or "us"), a company incorporated under the Companies Act, 1956, is committed to protecting your personal information. The company's registered office is located at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India - 421001. Another part of the document states the company is within the meaning of the Companies Act, 2013.
                </p>
                <p className="text-sm text-gray-700">
                  This Privacy Policy ("Policy") outlines how we collect, store, use, disclose, and process your information when you use our services through the Company's mobile application or website ("Platform"). The services offered via the Platform are referred to as "Services". In this policy, "you" and "your" refer to a user of the app or website.
                </p>
                <p className="text-sm text-gray-700">
                  By using our Platform, you indicate that you have read, understood, and agree to be bound by this Policy. This Policy is legally enforceable in the same way as any other written agreement. You are advised to read this document carefully before using the offered services.
                </p>
              </CardContent>
            </Card>

            {/* Section 2: Information and Personal Data We Collect */}
            <Card>
              <CardHeader>
                <CardTitle>2. INFORMATION AND PERSONAL DATA WE COLLECT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  With your consent, we may collect, store, and process your information and personal data for various purposes. This includes:
                </p>
                <div>
                  <h4 className="font-medium mb-2">Personal Information</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    This includes your full name, permanent and current address, email, phone number, Permanent Account Number (PAN), Aadhaar card number, passport details, Voter ID, date of birth, and photograph. This data is used to provide services, verify your eligibility, facilitate communication, prevent fraud, and comply with legal requirements.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Financial Information</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Details such as salary, income, employment status, credit history, bank account number, bank statements, and E-Mandate/E-NACH, NEFT, IMPS, and UPI ID details are collected. This is used to provide services, verify eligibility, prevent fraud, enable communication, and meet legal requirements.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Demographic Information</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    This includes your age, gender, nationality, and religion. It is used to verify eligibility, prevent fraud, enable communication, for marketing, and to comply with legal requirements.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Device Information</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    We may gather data about your device, such as its name, model, language settings, and unique identifier. This is for marketing, account security, fraud prevention, and analyzing service stability.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">App Data</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Information about apps installed on your device is collected to perform credit risk analysis, detect fraud, verify applications, and ensure no malicious apps are present.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Usage Data</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Data on your interactions with our application, like access times and crash logs, is collected to provide customer support, improve user experience, and conduct fraud risk analysis.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Storage</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Access to your device's storage requires your explicit permission and is used for the loan process, credit review, and KYC process.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Camera</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    With your consent, camera access is used for the KYC process, loan process, and to handle user complaints and feedback.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Contacts Information</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    We require reference contacts to check your credit and assist with the loan application process. This is used to determine loan eligibility, get credible references, and for risk analysis.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Marketing and Communication Records</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Communication with customer service, including emails and call recordings, is collected for marketing purposes.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Cookies</h4>
                  <p className="text-sm text-gray-700">
                    We use cookies and tracking technologies to enhance your experience. These can include session cookies, technical cookies, and analytical cookies. In some cases, cookies used solely for technical or statistical purposes may be collected without explicit user consent.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Use of Personal Data and Purposes */}
            <Card>
              <CardHeader>
                <CardTitle>3. USE OF PERSONAL DATA AND PURPOSES</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Your personal data is used in compliance with applicable laws for the following purposes:
                </p>
                <div>
                  <h4 className="font-medium mb-2">Loan Assessment</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    To assess your eligibility for a loan, we use data like income, employment status, and creditworthiness to decide on loan applications.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Verification and Authentication</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Your data is verified for accuracy and authenticity, which includes KYC evaluation and risk assessments.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Internal Risk Management</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Collected data is used to evaluate lending risk, which helps improve services, reduce fraud, and build risk models.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Processing Loans and Transactions</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    We process your data to facilitate the disbursement of approved loans, create loan agreements, and manage repayments and recovery.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Customer Support and Services</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Your information is used to communicate your loan application status, provide updates, and address any queries.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Marketing</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    We use your information to market our products and services and to notify you about offers, events, and marketing campaigns. We may also analyze your information to develop and market new products to you.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Research</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Information is used to research market trends to improve our products and services.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Legal Compliance</h4>
                  <p className="text-sm text-gray-700">
                    Personal data is processed to fulfill legal obligations, such as anti-money laundering (AML) and know your customer (KYC) requirements.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: How We Collect Data */}
            <Card>
              <CardHeader>
                <CardTitle>4. HOW WE COLLECT DATA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We collect data through various methods:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>Information you provide:</strong> Data you consent to provide when using our services.</li>
                  <li><strong>Information we collect automatically:</strong> Data gathered each time you visit our Platform or use our Services.</li>
                  <li><strong>Information from Third Parties:</strong> Personal data received from third parties and public sources for advertising and user analytics.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 5: Sharing of Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>5. SHARING OF PERSONAL INFORMATION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  By accepting this Policy, you consent to the sharing of your information with third parties, affiliates, and service providers. We may share your personal information with the following parties:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>Credit Bureaus:</strong> To obtain credit reports and assess your creditworthiness.</li>
                  <li><strong>Verification Agencies:</strong> To validate the accuracy of information provided in your loan application.</li>
                  <li><strong>Lending and Third-Party Service Providers:</strong> To enable service delivery, including loan recovery and technical support.</li>
                  <li><strong>Regulatory and Legal Authorities:</strong> To comply with applicable laws, government requests, and legal obligations.</li>
                </ul>
                <p className="text-sm text-gray-700">
                  We do not rent, sell, or share your information with third parties or affiliates, except in the following cases:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>With your express permission for disclosure to financial institutions and banks.</li>
                  <li>In connection with the services provided through the Platform.</li>
                  <li>To investigate or prevent unlawful activities, suspected fraud, or potential threats.</li>
                  <li>To comply with court orders or requests from legal authorities.</li>
                  <li>As part of the information shared with marketers and advertisers.</li>
                  <li>To improve personalization and for offering new products or services.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 6: Data Retention */}
            <Card>
              <CardHeader>
                <CardTitle>6. DATA RETENTION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We retain your personal data only as long as necessary to fulfill the purposes for which it was collected and to satisfy any legal, accounting, or reporting requirements. After your relationship with us ends, we may continue to use your anonymized data for research and data analysis. Your contact information and application details may be kept to prevent fraud or for legal proceedings.
                </p>
                <p className="text-sm text-gray-700">
                  You can exercise the following rights by emailing us at support@pocketcredit.in:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>Right to rectification:</strong> You have the right to provide us with accurate and up-to-date data and have us correct any inaccuracies.</li>
                  <li><strong>Right to withdraw consent:</strong> You can withdraw specific consents, but this may result in you being unable to access some services.</li>
                  <li><strong>Right to restrict disclosure to third parties:</strong> You can request a restriction on sharing your information with third parties, but this may prevent you from using our services.</li>
                  <li><strong>Right to revoke consent:</strong> This allows you to withdraw consent for data collection, subject to applicable laws, which may limit our ability to provide services.</li>
                  <li><strong>Right to request deletion:</strong> You may ask for the deletion of your data, though this is subject to legal requirements and may limit the services we can provide.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 7: Security Breach */}
            <Card>
              <CardHeader>
                <CardTitle>7. SECURITY BREACH</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We implement reasonable security measures to protect your personal information from unauthorized access and disclosure. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security. Your information is stored on our servers, and we use Secure Socket Layer (SSL) technology to encrypt sensitive data. Access to our database is restricted, and we utilize DDOS protection offered by cloud vendors.
                </p>
                <p className="text-sm text-gray-700">
                  In the event of a security breach, we will comply with all applicable laws and may notify you electronically so you can take appropriate protective steps.
                </p>
              </CardContent>
            </Card>

            {/* Section 8: Review and Update */}
            <Card>
              <CardHeader>
                <CardTitle>8. REVIEW AND UPDATE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  This Policy is reviewed regularly, and we reserve the right to update it at any time. Any changes will be effective immediately upon being posted on the Platform. We encourage you to review this Policy each time you use the Platform.
                </p>
              </CardContent>
            </Card>

            {/* Section 9: Dispute Resolution */}
            <Card>
              <CardHeader>
                <CardTitle>9. DISPUTE RESOLUTION</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  Any dispute arising from this Policy shall be settled in accordance with the laws of India. The courts of Kolkata/Bangalore will have exclusive jurisdiction.
                </p>
              </CardContent>
            </Card>

            {/* Section 10: Grievance */}
            <Card>
              <CardHeader>
                <CardTitle>10. GRIEVANCE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  If you have questions or concerns about this Privacy Policy, you can contact us at support@pocketcredit.in.
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