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
              These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User" or "you") and spheeti fintech private Limited, 
              a Non-Banking Financial Company (NBFC) incorporated under the Companies Act, 1956, having its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India – 421001 ("Company," "we," "us," "pocketcredit" or "our").
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
                  These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User" or "you") and spheeti fintech private Limited, a Non-Banking Financial Company (NBFC) incorporated under the Companies Act, 1956, having its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India – 421001 ("Company," "we," "us," "pocketcredit" or "our").
                </p>
                <p className="text-sm text-gray-700">
                  These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User" or "you") and spheeti fintech private Limited, a Non-Banking Financial Company (NBFC) incorporated under the Companies Act, 1956, having its registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India – 421001 ("Company," "we," "us," or "our").
                </p>
                <p className="text-sm text-gray-700">
                  The services offered through the Platform are collectively referred to as "Services."
                </p>
                <p className="text-sm text-gray-700">
                  The term "User" refers to any individual who accesses or uses the Platform via any device and/or avails the services offered through the App/website. For the purpose of these T&Cs, "You" and "your" refer to the User.
                </p>
                <p className="text-sm text-gray-700">
                  Your continued use of the App or availing of its services constitutes your acceptance of these T&Cs, including any updates made over time. If you do not agree with the T&Cs, please refrain from using the App or accessing the Services.
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
                  The Platform facilitates the below facilities to You:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>i. Credit facility services</li>
                  <li>ii. Create and maintain account</li>
                  <li>iii. Facilitation for repayment</li>
                  <li>iv. User grievances and feedback</li>
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
                  You explicitly declare and confirm that you are a natural or legal person who is at least 21 years of age and possess the legal capacity to enter into contracts under Indian law.
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
                  We reserve the right to modify, discontinue or terminate your membership, remove your profile and any content or information posted on the Platform, and/or restrict your access to the Platform at any time, with or without notice, if we determine a violation of these T&Cs or detect suspicious activity. These actions will be taken if you breach any of the T&Cs or violates any agreement made through the Platform.
                </p>
                <p className="text-sm text-gray-700">
                  We, in our sole discretion, reserve the right to temporarily suspend or permanently terminate any user account and refuse any current or future use of the platform for any reason at any time. Such termination may result in the deactivation or deletion of the account, disruptions to any Services, and the loss of all the content hosted therein.
                </p>
                <p className="text-sm text-gray-700">
                  Unless otherwise communicated by us, upon termination: (a) the rights and licenses granted to you under these T&Cs will be revoked; and (b) you are required to cease all use of the Platform and its Services.
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
                  <strong>i.</strong> We hereby grant you to You a restricted, non-transferable, license to download and use the web Application on a Device, which you own or control, to avail of the functions and features in accordance with these T&Cs.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>ii.</strong> You are solely responsible for maintaining the confidentiality of the information you hold for your account, and for any and all activities that occur under your Account as a result of your failing to keep this information secure and confidential.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>iii.</strong> You agree to: (a) immediately notify us of any unauthorized use of your Account, or any breach of security; and (b) ensure that you log out of your Account at the end of each session. We will not be liable for any loss or damage resulting from your failure to comply with this clause.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>iv.</strong> You acknowledge that deleting the App from your device does not terminate your Account. To fully deactivate your Account, you must follow the de-registration process outlined in the Privacy Policy. If you wish to have your details removed from our records, you may refer to our Privacy Policy.
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
                  You acknowledge that all information you provide is accurate, valid, and should be regularly updated as needed. Given the nature of the Platform and the Services provided, you are responsible for maintaining the security of your mobile device. You are solely accountable for all activities occurring under your account credentials and any transactions involving your bank account. It is crucial that you keep your password secure and do not share your account details with any third party. If you suspect unauthorized access to your account, contact our Grievance Team immediately and follow any additional necessary steps.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>i.</strong> You are also responsible for ensuring that you keep the Platform updated to the latest version to avoid issues with accessing certain services.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>ii.</strong> You agree not to engage in any unlawful activities, including the creation of multiple or fraudulent accounts, or using the Platform for immoral purposes.
                </p>
                <p className="text-sm text-gray-700">
                  <strong>iii.</strong> You acknowledge and authorize the Company, or any third party acting on its behalf, to facilitate payments through the available payment methods on our Platform, in a manner and form as prescribed by the Company or applicable law.
                </p>
                <p className="text-sm text-gray-700">
                  We do not provide any warranties regarding Services and will not be liable for any claims by you or third parties.
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
                  The underlying code of the Platform, all associated content, features, and functionality, including all data, text, designs, pages, graphics, user interfaces, visual interfaces, images, artwork, photographs, trademarks, logos, audio and video and HTML code, source code, or software (collectively, "Content") that reside or are viewable or otherwise discoverable on the Platform are our intellectual property and is protected by applicable copyright, trademark, and other intellectual property laws.
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
                  We grant you a limited, non-transferable, non-sublicensable, and revocable license to access the Platform and use its features solely for your personal, lawful purposes. This license is strictly for non-commercial use and is subject to compliance with these T&Cs.
                </p>
                <p className="text-sm text-gray-700">
                  You shall not use the Platform for any unlawful purposes or in a manner that violates any applicable laws, the terms of these T&Cs, or our Privacy Policy.
                </p>
                <p className="text-sm text-gray-700">
                  You shall not use the Platform in any way that could damage, disable, overburden, or impair our server or any network connected to it, nor interfere with any other user's ability to access or enjoy the Platform. You shall not attempt to gain unauthorized access to any features, user accounts, computer systems, or networks connected to our server, through hacking, password mining, or any other means. Additionally, you shall not attempt to obtain materials or information through methods that are not intentionally made available to you through the App.
                </p>
                <p className="text-sm text-gray-700">
                  You may not decompile, reverse engineer, disassemble, rent, lease, loan, sell, sublicense, copy, modify, reproduce, republish, distribute, display, or create derivative works from the Platform. Nor may you use any network monitoring or discovery software to determine the site architecture, or extract information about usage, individual identities or users. You will not use any robot, spider, other automatic software or device, or manual process to monitor or copy the Content without our prior written permission.
                </p>
                <p className="text-sm text-gray-700">
                  You are not permitted to copy, distribute, modify, create derivative works of, publicly display, or exploit the Content, its features, or any related materials, directly or indirectly, without our prior written consent.
                </p>
                <p className="text-sm text-gray-700">
                  You may not use the Platform or any Content for any purpose that is unlawful or prohibited by these T&Cs, or to solicit the performance of any illegal activity or other activity which infringes our rights or those of others.
                </p>
                <p className="text-sm text-gray-700">
                  Unauthorized use or exploitation of the Platform or the Content may result in the termination of your access to the Platform and may lead to legal action.
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
                  We gather certain information from you to deliver our Services effectively. The handling of your personal data is regulated by our Privacy Policy, which outlines the types of information we collect and how we process it. If we determine, at our discretion and in accordance with our internal policies, that the information you provide is unreliable or may be fraudulent, we reserve the right to deny you access to our Services. Furthermore, we may introduce additional verification procedures in the future, which could require you to supply more information.
                </p>
                <p className="text-sm text-gray-700">
                  To provide our Services, we utilize third-party providers for various tasks, including eligibility checks, payment processing, KYC (Know Your Customer) procedures, and other functions that enhance our offerings. While we maintain proper documentation with these third parties, we cannot accept liability for any issues that arise from our reliance on their services.
                </p>
                <p className="text-sm text-gray-700">
                  If you have registered your phone number with your network provider on the "Do Not Disturb" list, it is your responsibility to ensure that our representatives can contact you by phone to provide information about various financial products. You must also confirm that any calls you receive are related to the information you have provided to us and agree not to file complaints with the relevant authorities regarding these communications. All Services and products accessed by you on the Platform will also be governed by specific agreements between the Company and you related to those Services or products.
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
                        The Platform has been designed to provide high availability, tested for functionality and security, however, we do not promise, represent or warrant that the Platform or any Content, Service or feature of the Platform will be error-free or uninterrupted, or completely secure.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-700">
                  The Platform and its Content are provided/delivered on an "as is" basis, without any representations or warranties, whether express or implied, except as otherwise expressly stated in writing. We and our Partners do not guarantee the quality, performance, or availability of the App or Services, including, but not limited to, error-free operation, ongoing compatibility with any device, or the correction of any issues. We do not warrant that any defects or errors will be corrected, that the App is free from viruses or other malicious, harmful, or corrupting code, or that the App does not infringe on third-party rights. We also make no representations regarding the title, merchantability, accuracy and completeness of data, satisfactory quality, or fitness for a particular purpose.
                </p>
                <p className="text-sm text-gray-700">
                  We do not warrant that the efficiency of any product, service, information, or other material obtained by you through the Platform will meet user's or any other person's expectations, achieve any intended result, be compatible or work with any software, system or other services except if and to the extent expressly set forth in the specifications or that any errors in the Platform will be corrected.
                </p>
                <p className="text-sm text-gray-700">
                  In no event shall we, our Partners, successors, assigns, or any of their respective investors, directors, officers, employees, or agents be held liable for any special, incidental, punitive, indirect, or consequential damages or losses arising from your use of the Platform.
                </p>
                <p className="text-sm text-gray-700">
                  While we take all reasonable precautions to ensure the accuracy, security, and confidentiality of the data and information provided through the Platform, we cannot guarantee protection against internet fraud, hacking, or similar activities. The possibility of such threats exists, and we disclaim any responsibility for losses resulting from such actions.
                </p>
                <p className="text-sm text-gray-700">
                  We shall not be liable for the loss and/or damage of the confidential information or data of the User arising as a result of an event or a series of related events, that is beyond our control.
                </p>
              </CardContent>
            </Card>

            {/* Section 10: User Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>10. USER FEEDBACK</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  If you submit materials (such as contest entries) or voluntarily send creative ideas, suggestions, proposals, or other content (collectively, "comments"), you agree that the Company may use, edit, copy, publish, distribute, translate, and otherwise utilize your comments without restriction. The Company is not obligated to maintain confidentiality, provide compensation, or respond to any comments.
                </p>
                <p className="text-sm text-gray-700">
                  You agree that your comments do not infringe on third-party rights (such as copyright or privacy) and do not contain harmful, unlawful, or abusive content. You also agree not to mislead the Company or others about the origin of your comments.
                </p>
                <p className="text-sm text-gray-700">
                  By submitting any content, you grant the Company and its service providers a license to use, display, and distribute the Content to provide services. The Company may also use non-personally identifiable information derived from your use of the Service. You confirm that the owner of the Content agrees to these terms and grants the Company and its service providers unrestricted use of the Content, with no obligation for payment. The Company retains ownership of your confidential account information, as between the Company and third-party service providers.
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
                  Links to third-party websites on the App are provided solely for convenience in connection with the Services. We have no control over the content of these websites and makes no warranties regarding their accuracy, completeness, or reliability. We also do not guarantee that these websites are free from copyright, trademark, or other infringements, nor that they are free from viruses or other harmful content. If you choose to follow a link to a third-party website, you do so at your own risk. Links to third-party sites do not imply endorsement or responsibility for the content, opinions, products, or services offered on those sites.
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
                  You agree to indemnify, defend, and hold harmless the Company, its affiliates, contractors, employees, officers, directors, agents, and third-party associates, licensors, and partners from any and all claims, demands, losses, damages, liabilities, costs, and expenses, including but not limited to legal fees and expenses, arising out of or related to
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>i. your use or misuse of the Services and the Platform;</li>
                  <li>ii. you violation of these T&Cs;</li>
                  <li>iii. your breach of representations, warranties, and covenants made by you herein; or</li>
                  <li>iv. any infringement of intellectual property or other rights of any individual or entity;</li>
                  <li>v. any claim that your User Content caused damage to a third party. This includes any threatening, libelous, obscene, harassing, or offensive material posted or transmitted by you on the Platform.</li>
                </ul>
                <p className="text-sm text-gray-700">
                  The Company reserves the right, at your expense, to assume exclusive defense and control of any matter for which you are required to indemnify the Company, including the right to settle, and you agree to cooperate with the Company in the defense and settlement of such claims. The Company will make reasonable efforts to notify you of any claim, action, or proceeding initiated by a third party that is subject to this indemnification upon becoming aware of it. This indemnification obligation shall survive the termination of these Terms and Conditions.
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
                        YOU EXPRESSLY UNDERSTAND AND AGREE THAT, IN NO EVENT SHALL WE BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL OR CONSEQUENTIAL DAMAGES OR FOR ANY DAMAGES WHATSOEVER INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS DUE TO USE, DATA OR PROFITS, ARISING OUT OF OR IN ANY WAY CONNECTED WITH THE ACCESS, USE OR PERFORMANCE OF THIS APP'S FUNCTIONS AND FEATURES OR FOR INTERRUPTIONS, DELAY, ETC., EVEN IF WE WERE ADVISED OF THE POSSIBILITY OF DAMAGES RESULTING FROM THE COST OF GETTING SUBSTITUTE FACILITIES ON THE APP, ANY PRODUCTS, DATA, INFORMATION OR SERVICES PURCHASED OR OBTAINED OR MESSAGES RECEIVED OR TRANSACTIONS ENTERED INTO THROUGH OR FROM THE APP, UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR TRANSMISSIONS OR DATA STATEMENTS OR CONDUCT OF ANYONE ON THE APP, OR INABILITY TO USE THE APP, THE PROVISION OF OR FAILURE TO PROVIDE THE FUNCTIONS AND FEATURES, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY OR OTHERWISE. THIS CLAUSE SHALL SURVIVE IN PERPETUITY.
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
                  <p className="text-sm text-gray-700">
                    <strong>i. Amendment:</strong> We reserve the right to change, modify, add, or remove discounts and any provisions of these Terms at any time, in accordance with the Company's policies and applicable regulations.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>ii. Assignment:</strong> You shall not assign or transfer any rights or obligations that have accrued to you under these Terms. Any attempt to assign or transfer such rights or obligations shall be deemed null and void.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>iii. Waiver:</strong> Unless explicitly stated otherwise, any delay or failure by us to exercise any rights or remedies arising from these Terms and/or other policies available on the Platform shall not be construed as a waiver of those rights or remedies. Furthermore, the partial or single exercise of any rights or remedies shall not preclude any subsequent exercise of those rights or remedies by us.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>iv. Survival:</strong> You acknowledge that your representations, obligations, and warranties, as well as the provisions concerning indemnities, limitation of liability, loan repayment, governing law and arbitration, and these general provisions, shall remain in effect beyond the passage of time and the termination of these Terms.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>v. Severability:</strong> If any provision of these Terms is deemed illegal or unenforceable, the validity, legality, and enforceability of the remaining provisions shall not be affected or impaired in any way. Any provision found to be invalid, illegal, or unenforceable shall be replaced by a provision of similar intent that reflects the original purpose of the parties, to the extent permitted by applicable law.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>vi. Governing Law:</strong> Your use of this Platform and any T&Cs outlined in this agreement are governed by the laws of India. In the event of any disputes arising from your use of the Platform, the courts in Assam shall have exclusive jurisdiction.
                  </p>
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
                  You can file a complaint or provide feedback if You are dissatisfied with the services provided by the Company. Complaints or feedback can be submitted in writing via email:
                </p>
                <p className="text-sm text-gray-700">
                  Email: support@pocketcredit.in
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#0052FF' }} />
                    <span>Email: support@pocketcredit.in</span>
                  </div>
                  <div>
                    <p className="font-medium">Company Address:</p>
                    <p className="text-gray-600">
                      spheeti fintech private Limited<br />
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