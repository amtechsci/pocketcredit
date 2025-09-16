import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Shield, Lock, Database, AlertTriangle, CheckCircle, Key, Users, Monitor, ExternalLink, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';




export function ITPolicy() {
    const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Information Technology & <span style={{ color: '#0052FF' }}>Cybersecurity Policy</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Comprehensive IT security framework aligned with ISO/IEC 27001:2013 standards
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Board Approved Policy | Last Updated: January 10, 2025
            </p>
          </div>

          {/* ISO Compliance Notice */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-green-800 mb-2">ISO/IEC 27001:2013 Compliance</h3>
                    <p className="text-sm text-green-700">
                      Our Information Security Management System is aligned with global standards for Information Security Management – ISO/IEC 27001:2013, adopting best practices for protecting information assets through efficient processes and safeguarding customer and organizational information.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Section 1: Objective */}
            <Card>
              <CardHeader>
                <CardTitle>1. Objective and Scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Purpose:</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    This section defines the control requirements for managing access to information on the Company's computer and communications systems.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Scope:</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    The policy applies to all Company computer systems and facilities, targeting the Company's Information Technology employees and partners.
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Board Responsibility:</strong> This IT policy is an essential part of the corporate governance of Spheeti Fintech Private Limited, with the Board of Directors and executive management responsible for its effective implementation.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Access Control System */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  2. Access Control System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">System Requirements:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Access control systems must record and maintain the creation date, last logon date, last logoff date, last password change date, and expiration date for every user ID</li>
                    <li>If an access control system malfunctions, it must default to denying privileges to end-users</li>
                    <li>Multi-user systems must support special privileged user IDs for authorized individuals to change system security states</li>
                    <li>Developers are prohibited from creating or installing alternative user identification or authentication mechanisms without advance management permission</li>
                    <li>Access control system functionality must not be altered, overridden, or bypassed by additional code</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Security Measures:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Software and files containing password generation algorithms must be controlled with the most stringent security measures</li>
                    <li>Systems must prevent retrieval and unauthorized use of stored passwords</li>
                    <li>Company information systems must never store access control information in cookies on end-user computers</li>
                    <li>End-users should only be presented with system capabilities and commands they are privileged to perform</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Authorization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  3. Authorization Framework
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Access Authorization:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Access to sensitive Company information requires express management authorization</li>
                    <li>Access to Company information must be authorized by the designated owner and limited on a need-to-know basis</li>
                    <li>Information system privileges not specifically permitted by Company management must not be used for business purposes without written approval</li>
                    <li>System privileges must be granted through a clear chain of authority delegation</li>
                    <li>User IDs, business application system privileges, or system privileges beyond routine access require advance approval from the user's immediate supervisor and Company management</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Training Requirements:</h4>
                  <p className="text-sm text-gray-700">
                    All Company users must complete an approved information security training class before gaining access to any Company computer systems.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Access and Privilege Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  4. Access and Privilege Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Production Environment Controls:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Access controls to production programs and information must restrict production programs and information systems software support personnel from access, except for problem resolution</li>
                    <li>Computer operations personnel must be restricted from modifying systems software, application software, and production information</li>
                    <li>System privileges for all users, systems, and programs must be restricted based on the need to know</li>
                    <li>Access privileges for user IDs engaged in abusive or criminal activity must be immediately revoked</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Developer Access Controls:</h4>
                  <p className="text-sm text-gray-700">
                    Developers requiring access to production business information for system development or testing should only be granted "read" and "copy" access on production machines, limited to the duration of testing and development, and promptly revoked thereafter.
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mb-2" />
                  <p className="text-sm text-orange-700">
                    <strong>Critical Rule:</strong> Access to sensitive information must be granted only to specific individuals, not groups.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Password Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  5. Password Security Standards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">General Requirements:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>All application-level passwords must be changed at least every 45 days and cannot reuse the past 5 passwords</li>
                    <li>All user-level passwords (e.g., email, desktop) must be changed at least every 45 days and cannot reuse the past 10 passwords</li>
                    <li>Passwords must not be sent in email or other electronic communications</li>
                    <li>All user-level and application-level passwords must adhere to construction guidelines</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Password Construction Requirements:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h5 className="font-medium text-gray-800 mb-2">Technical Requirements:</h5>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Minimum length: 8 characters</li>
                        <li>• Maximum length: 12 characters</li>
                        <li>• Must include alphabet, numeric, and special character</li>
                        <li>• Expire within 45 calendar days</li>
                        <li>• Not identical to previous 5 passwords</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h5 className="font-medium text-gray-800 mb-2">Restrictions:</h5>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Not a dictionary word or proper name</li>
                        <li>• Not the same as the User ID</li>
                        <li>• Not displayed when entered</li>
                        <li>• Not transmitted in clear text</li>
                        <li>• Must be reset only for authorized users</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Password Protection Standards ("Do not's"):</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Do not reveal passwords over the phone, in email, to the boss, in front of others, or hint at their format</li>
                    <li>Do not reveal passwords on questionnaires or security forms</li>
                    <li>Do not share with family members or co-workers while on vacation</li>
                    <li>Do not use the "Remember Password" feature in applications</li>
                    <li>Do not write passwords down or store them unencrypted on any computer system</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Application Development Standards:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Programs must support authentication of individual users, not groups</li>
                    <li>Passwords should not be stored in clear text or easily reversible forms</li>
                    <li>Copy-pasting user ID and password should be disabled in the application</li>
                    <li>The system should compel users to change their password upon first login</li>
                    <li>The system should disable a user ID after three consecutive wrong password entries</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Information Security Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  6. Information Security Management System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Standards Alignment</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Aligned with ISO/IEC 27001:2013</li>
                      <li>• Adopts best practices for Information Security</li>
                      <li>• Focuses on protecting information assets</li>
                      <li>• Safeguards customer and organizational information</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Management Commitment</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Senior management fully committed</li>
                      <li>• IT service management focus</li>
                      <li>• Information security priority</li>
                      <li>• Continual improvement mechanism</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Key Policy Elements:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>All approved policies will be communicated to customers, vendors, and other interested parties</li>
                    <li>Periodic reviews of this policy will ensure its continued suitability and applicability</li>
                    <li>Internal or external auditors will conduct periodic reviews of policy implementation</li>
                    <li>Company adheres to customer policies, processes, and guidelines as required and agreed upon</li>
                    <li>Threats and risks to information system assets are identified using a managed Risk Management framework periodically</li>
                    <li>All identified security risks in information systems have been reduced to an acceptable level</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: Security Measures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  7. Security Infrastructure and Measures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Information Protection:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Information is protected against unauthorized access and malicious activities with required security infrastructure</li>
                    <li>Measures are taken to assure confidentiality, integrity, and availability of information</li>
                    <li>A competent and professional security organization is built, maintained, and reviewed</li>
                    <li>Top priority is given to security awareness and education to ensure all personnel are aware of security requirements</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Compliance and Incident Management:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Compliance with Government Regulations, legislative, and contractual requirements is ensured</li>
                    <li>All actual or suspected breaches of information security are reported to and investigated by the Incident Management Process</li>
                    <li>Remote access to COMPANY networks via remote access must be controlled using a Virtual Private Network (requiring a password and user ID)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 8: Business Continuity */}
            <Card>
              <CardHeader>
                <CardTitle>8. Business Continuity and Data Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  This policy framework covers security aspects, user roles, Information Security and Cyber Security, Business Continuity Planning, and Back-up Data to ensure operational resilience and data protection.
                </p>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800 mb-2">Coverage Areas:</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Security aspects and user role management</li>
                    <li>• Information Security and Cyber Security protocols</li>
                    <li>• Business Continuity Planning</li>
                    <li>• Back-up Data management and recovery</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Related Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Related Documents and Policies</CardTitle>
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
                    onClick={() => navigate('/terms')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Terms & Conditions
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
                    onClick={() => navigate('/grievance')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Grievance Redressal
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
                  Download/Print Policy
                </Button>
                <Button 
                  onClick={() => navigate('/contact')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Contact IT Team
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