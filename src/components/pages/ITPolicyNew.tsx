import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Shield, FileText } from 'lucide-react';

export function ITPolicyNew() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#1E2A3B' }}>
              IT <span style={{ color: '#0052FF' }}>Policy</span>
            </h1>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              spheeti fintech private Limited | Corporate IT Governance Framework
            </p>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 md:p-12">
            
            {/* Introduction */}
            <section className="mb-8">
              <p className="text-sm text-gray-700 mb-4">
                IT governance is an integral part of corporate governance of spheeti fintech private Limited 
                (Company), and effective IT governance is the responsibility of the board of directors of spheeti 
                fintech private Limited ("Board") and its executive management. This Policy ensures 
                implementation of this IT Framework which, inter alia, includes (i) Security aspects; (ii) User Role; (iii) 
                Information Security and Cyber Security; (iv) Business Continuity Planning Policy; (v) Back-up Data.
              </p>
            </section>

            {/* Section I: Objective */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                I. OBJECTIVE
              </h2>
              
              <h3 className="text-lg font-medium mb-3 mt-4" style={{ color: '#1E2A3B' }}>
                1. Purpose
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                This policy defines the control requirements surrounding the management of access to information 
                on Company's computer and communications systems.
              </p>

              <h3 className="text-lg font-medium mb-3 mt-4" style={{ color: '#1E2A3B' }}>
                2. Scope
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                This policy applies to all Company's computer systems and facilities, with a target audience of 
                Company's Information Technology employees and partners.
              </p>

              <h3 className="text-lg font-medium mb-3 mt-4" style={{ color: '#1E2A3B' }}>
                3. Policy applied to All the internal Parties
              </h3>
            </section>

            {/* Section A: Access Control System */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                A. ACCESS CONTROL SYSTEM
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System – User ID Creation Date</h4>
                  <p className="text-sm text-gray-700">
                    Access control systems must be configured to capture and maintain the creation date for every user ID.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System – Last Logon Date</h4>
                  <p className="text-sm text-gray-700">
                    Access control systems must be configured to capture and maintain the date and time of the last logon for every user ID.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System – Last Logoff Date</h4>
                  <p className="text-sm text-gray-700">
                    Access control systems must be configured to capture and maintain the date and time of the last logoff for every user ID.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System – Password Change Date</h4>
                  <p className="text-sm text-gray-700">
                    Access control systems must be configured to capture and maintain the date and time of the last password change for every user ID.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System – User ID Expiration Date</h4>
                  <p className="text-sm text-gray-700">
                    Access control systems must be configured to capture and maintain an expiration date for every user ID that represents the last date that the user ID is active for use.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Malfunctioning Access Control</h4>
                  <p className="text-sm text-gray-700">
                    If a computer or network access control system is not functioning properly, it must default to denial of privileges to end-users.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Special Privileged Users</h4>
                  <p className="text-sm text-gray-700">
                    All multi-user computer and network systems must support a special type of user ID, which has broadly-defined system privileges that will enable authorized individuals to change the security state of systems.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Operating System User Authentication</h4>
                  <p className="text-sm text-gray-700">
                    Developers must not construct or install other mechanisms to identify or authenticate the identity of users without the advance permission of Company's management.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control System Modification</h4>
                  <p className="text-sm text-gray-700">
                    The functionality of all access control systems must not be altered, overridden or bypassed via the introduction of additional code or instructions.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Password Generation Algorithms</h4>
                  <p className="text-sm text-gray-700">
                    All software and files containing formulas, algorithms, and other specifics used in the process of generating passwords or Personal Identification Numbers must be controlled with the most stringent security measures supported by the involved computer system.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Password Retrieval</h4>
                  <p className="text-sm text-gray-700">
                    Computer and communication systems must be designed, tested, and controlled so as to prevent both the retrieval of, and unauthorized use of stored passwords, whether the passwords appear in encrypted or unencrypted form.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Access Control Information in Cookies</h4>
                  <p className="text-sm text-gray-700">
                    Company's information systems must never store any access control information in cookies deposited on, or stored on, end-user computers.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">System Capabilities and Commands</h4>
                  <p className="text-sm text-gray-700">
                    End users must be presented with only the system capabilities and commands that they have privileges to perform.
                  </p>
                </div>
              </div>
            </section>

            {/* Section B: Authorization */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                B. AUTHORIZATION
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Sensitive or Valuable Information Access</h4>
                  <p className="text-sm text-gray-700">
                    Access to Company's sensitive information must be provided only after express management authorization has been obtained.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Granting Access to Organization Information</h4>
                  <p className="text-sm text-gray-700">
                    Access to Company's information must always be authorized by a designated owner of such information, and must be limited on a need-to-know basis to a reasonably restricted number of people.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Information System Privilege Usage</h4>
                  <p className="text-sm text-gray-700">
                    Every information system privilege that has not been specifically permitted by the Company's management must not be employed for any Company's business purpose until approved in writing.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Granting System Privileges</h4>
                  <p className="text-sm text-gray-700">
                    Computer and communication system privileges must be granted only by a clear chain of authority delegation.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">User ID and Privilege Approval</h4>
                  <p className="text-sm text-gray-700">
                    Whenever user IDs, business application system privileges, or system privileges involve capabilities that go beyond those routinely granted to general users, they must be approved in advance by the user's immediate supervisor and Company's management.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Owner Approval for Privileges</h4>
                  <p className="text-sm text-gray-700">
                    Prior to being granted to users, business application system privileges must be approved by the applicable information owner.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">System Access Request Authorization</h4>
                  <p className="text-sm text-gray-700">
                    All requests for additional privileges on Company's multi-user systems or networks must be submitted on a completed system access request form that is authorized by the user's immediate manager.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Default User Privileges</h4>
                  <p className="text-sm text-gray-700">
                    Without specific written approval from management, administrators must not grant any privileges, beyond electronic mail and word processing, to any user.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Computer Access Training</h4>
                  <p className="text-sm text-gray-700">
                    All Company's users must complete an approved information security training class before they are granted access to any Company's computer systems.
                  </p>
                </div>
              </div>
            </section>

            {/* Section C: Access and Privilege Assignment */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: '#0052FF' }}>
                C. ACCESS AND PRIVILEGE ASSIGNMENT
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-800 mb-2">Production Programs and Information Access</h4>
                  <p className="text-sm text-gray-700">
                    Access controls to production programs and information must be configured such that production programs and information systems software support personnel are not granted access privileges except for problem resolution.
                  </p>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline"
                onClick={() => window.print()}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Print / Download
              </Button>
              <Button 
                onClick={() => navigate('/home')}
                style={{ backgroundColor: '#0052FF' }}
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