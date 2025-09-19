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
              spheeti fintech private Limited ("Company," "we," or "us") is committed to protecting your personal information. 
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
                  spheeti fintech private Limited, a Company ("Company," "we" or "us") incorporated under the Companies Act, 1956, having registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India – 421001, is committed to protecting the privacy and security of your personal information. For the purposes of this Privacy Policy ("Policy"), "you" and "your" shall mean you as a User of the App/website ("User"). This Policy describes how we collect, store, use, disclose, transfer and process your information for providing you the Services through the Company's mobile application and (or) website ("Platform"). The services offered through the Platform are collectively referred to as "Services."
                </p>
                <p className="text-sm text-gray-700">
                  You are advised to read the Policy carefully and accept the terms of this Policy before using the Services offered by us. By accessing and using our Platform directly or indirectly, you signify that you have read, understood and agree to be bound by this Policy.
                </p>
                <p className="text-sm text-gray-700">
                  This Policy shall be enforceable against you in the same manner as any other written agreement. Terms & Conditions and all capitalized terms under this Policy that have not been specifically defined herein shall have the meaning as ascribed to it under the Platform terms & conditions.
                </p>
                <p className="text-sm text-gray-700">
                  spheeti fintech private Limited, a Company within the meaning of Companies Act, 2013, having registered office at Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India – 421001 (hereinafter shall be referred to as "Company" or "us" "pocketcredit" or "we"). For the purposes of this Privacy Policy ("Privacy Policy") "you" and "your" shall mean you as a User of the App/website ("User").
                </p>
                <p className="text-sm text-gray-700">
                  spheeti fintech private Limited recognizes the importance of maintaining your privacy and is committed to protecting the privacy and security of your personal information. We value your privacy and appreciate your trust in us. This Policy describes how we collect, store, use, disclose, transfer and process your information for providing you the Services through the Company's mobile application and (or) website ("Platform"). You are advised to read the Privacy Policy carefully and accept the terms of this Privacy Policy before using the services offered by us. By accessing and using our Platform directly or indirectly, you signify that you have read, understood and agree to be bound by this Privacy Policy.
                </p>
                <p className="text-sm text-gray-700">
                  This policy shall be enforceable against you in the same manner as any other written agreement. Terms & Conditions and all capitalized terms under this policy that have not been specifically defined herein shall have the meaning as ascribed to it under the platform terms & conditions.
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
                  We may collect, store, use, disclose, transfer and process your information and personal data, with your consent, as below:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Sl No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Data Collected</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">1</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Personal Information:</strong> This may include but is not limited to full name, permanent and current address, email address, phone number, Permanent Account Number (PAN), Aadhaar card number, passport details, Voter ID card, date of birth, photograph.
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          To provide Services to you; verify your eligibility, facilitate communication, prevent fraud, and comply with legal requirements.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">2</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Financial Information:</strong> Salary and Income details, employment status and details, credit history, bank account number and bank account data including E-Mandate/E-NACH, NEFT, IMPS and UPI ID details, bank statement, information and other required details.
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          To provide Services to you; verify your eligibility, prevent fraud, enable communication, and to comply with legal requirements
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">3</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Demographic information:</strong> Age, gender, nationality, religion and others.
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          To verify your eligibility, prevent fraud, enable communication, for marketing, to comply with legal requirements
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">4</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Device Information:</strong> Following registration, when you use the Services, we may gather data about your device, such as its name, model, region and language settings, unique device identifier, hardware and software details, status, and usage patterns. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          For marketing purposes, ensuring account security, fraud prevention, and analyzing the stability of the Services.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">5</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>App Data:</strong> We gather information about the installed apps on your device while you use our Services, such as the name of the application, the size of the application, and the time it takes to install or update. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          For credit risk analysis, fraud detection, application verification, and ensuring the absence of malicious and untrusted applications.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">6</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Usage data:</strong> We collect data on your interactions with our application. This includes data such as Service access times, app crash logs, etc. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          To provide customer support, improve the user experience, and conduct fraud risk analysis.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">7</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Storage:</strong> We need your explicit permission to access the storage on your device. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          For Loan process, credit review, and KYC process.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">8</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Camera:</strong> Pursuant to your consent.
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          For KYC process, Loan Process, user complaints and feedbacks.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">10</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Marketing and Communication records:</strong> Any communication with customer service including emails, call recordings, chat logs, information about promotions, surveys, campaigns, subscription or withdrawal from getting any marketing materials. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          For marketing purposes.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">11</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Cookies:</strong> Cookies and tracking technologies are used to enhance your experience and improve our Services. In some cases, cookies may be collected without explicit User consent if they are used solely for technical or statistical purposes, not for personalization of advertising or tracking User behavior for marketing. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          These may include session cookies, which are temporarily stored in the user's browser to ensure the proper functioning of the website until the session ends. These cookies may store session state information such as User authorization; technical cookies (used to ensure the operation of the site and to perform technical functions, such as saving User preferences); analytical cookies (used to collect depersonalized statistical information about how Users interact with the Website, such as the number of visitors, time spent on pages, etc. This helps Website owners understand how to improve User experience).
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">12</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Contacts Information:</strong> We require reference contacts when using the services in order for us to check your credit and assist you with the loan application process. (as applicable)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          Loan eligibility, credible reference, risk analysis.
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
                  We require and use your personal data in compliance with applicable laws for the following reasons, notwithstanding the points mentioned above:
                </p>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>i. For loan assessment and decision-making:</strong> We need to assess eligibility for the loan through the personal data provided by you. We use factors such as income, employment status, creditworthiness, etc. to determine whether to approve or deny the loan application.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>ii. For verifying, validation and authentication:</strong> The personal data provided is verified and validated to ensure its accuracy and authenticity and for doing KYC evaluation and risk assessments. The data may be cross-checked with relevant authorities, verifying supporting documents to confirm the individual's identity and other relevant details.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>iii. Internal risk management:</strong> Personal data collected from you is used to evaluate the level of risk associated with lending of loans. This is necessary to improve our Services, reduce fraud rates, build risk models, etc.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>iv. For processing loan and transactions:</strong> We process the personal data collected from you to facilitate the processing and disbursement of approved loans. This will include activities such as creation of loan agreements, maintaining records of loan, availing of credit facilities including initiating fund transfers, making repayments, recovery, etc.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>v. For providing Services and customer support:</strong> We use your information to communicate loan application status, provide updates, and address any queries or concerns. The information also enables our lenders to provide customer support throughout the loan application process. We also use your Personal Information to market our products and services and to notify you about events, offers, sponsorships, marketing programmes and similar marketing campaigns.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>vi. For marketing our products and services:</strong> We use your information to market our products and services and also to notify you about events, offers, sponsorships, marketing programmes and similar marketing campaigns. We may also process and analyse your information (including Sensitive Personal Information) to understand your usage trends and preferences, and to develop and market new products, services, features and functions to you based on the analysis conducted.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>vii. For conducting research to improve our product and services:</strong> The information is to research and gain insights into the latest market trends so that we can improve and develop technologies to support our products and services.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <strong>viii. Compliance with legal and regulatory requirements:</strong> The Personal data is processed to fulfill legal and regulatory obligations imposed on us, including but not limited to anti-money laundering (AML) and know your customer (KYC) requirements. This may involve sharing information with regulatory authorities or conducting necessary reporting.
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
                  We employ various methods to collect and process data, including;
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>i. Information you provide:</strong> Data you consent to provide when using our Services or correspond with us;</li>
                  <li><strong>ii. Information we collect automatically:</strong> Data collected automatically each time you visit our Platform or use our Services;</li>
                  <li><strong>iii. Information from Third- Parties:</strong> Personal data received from third parties and publicly available sources, including analytics for advertising and user analytics purposes.</li>
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
                  We believe that your personal information should be treated with utmost confidence, and we take all reasonable measures to ensure that your personal information is disclosed and shared with third parties through secure methods. By accepting this Policy, you explicitly provide your consent to sharing your Information (including Sensitive Personal Information) with third parties, affiliates, and service providers in connection with services and products offered to you. We may share your personal information with following parties:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li><strong>i) Credit Bureaus:</strong> We share your Personal Information with credit bureaus to obtain credit reports and assess your creditworthiness. Including credit history, outstanding debts, payment behaviour, and credit scores.</li>
                  <li><strong>ii) Verification Agencies:</strong> Personal data may be shared with third-party verification agencies or service providers to validate the accuracy and authenticity of the information provided in the loan application by you such as employment details, income, identity, or other relevant data.</li>
                  <li><strong>iii) Lending Service Providers (including Recovery agents) and Third Party Service Providers:</strong> We may share personal information with our service providers and vendors to enable service delivery (including recovery of loans) through our partners and technical support teams.</li>
                  <li><strong>iv) Regulatory and Legal Compliance:</strong> Personal Information may be shared with regulatory authorities, government agencies, or law enforcement entities to ensure compliance with applicable laws, government requests, and legal and regulatory obligations.</li>
                </ul>
                <p className="text-sm text-gray-700">
                  We do not rent, sell or share You information and will not disclose to third parties or affiliates, unless:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>i. it is in connection with disclosure to financial institutions and banks, in which case, the User hereby gives his express permission;</li>
                  <li>ii. it is in connection with the Services being rendered through the Platform;</li>
                  <li>iii. it is to help investigate, prevent or take action regarding unlawful and illegal activities; suspected fraud, potential threat to the safety or security of any person, violations of our Terms of Use, or as defence against legal claims;</li>
                  <li>iv. it is a case of special circumstances such as compliance with court orders, requests/order, notices from legal authorities or law enforcement agencies compel us to make such disclosure;</li>
                  <li>v. it forms part of the information we share with marketers and advertisers;</li>
                  <li>vi. it improves personalization, analysis and for offering new products/services.</li>
                </ul>
                <p className="text-sm text-gray-700">
                  Please note that in the event you are directed to a third-party website and if you choose to access them (or avail of such third party's offerings), we will not be responsible for privacy practices or content of such third-party websites or applications.
                </p>
              </CardContent>
            </Card>

            {/* Section 6: Data Retention */}
            <Card>
              <CardHeader>
                <CardTitle>6. DATA RETENTION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We retain your personal data only as long as necessary to fulfill the purposes for which we collected it, including for the purposes of satisfying any legal, compliance, accounting, or reporting requirements. We shall retain your data till the required period to comply with legal and compliance obligations.
                </p>
                <p className="text-sm text-gray-700">
                  Further, you may exercise the following rights by sending us a mail over support@pocketcredit.in:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Sl No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Rights provided to You</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">1</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Right to rectification</strong>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          In the event that any personal data provided by you is inaccurate, incomplete or outdated then you shall have the right to provide us with the accurate, complete and up to date data and have us rectify such data.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">2</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Right to withdraw consent</strong>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          You have the right to withdraw specific consents you have provided under this Policy. However, if you do so, you may not be able to access some of the features or Services.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">3</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Right to restrict disclosure to third parties</strong>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          You have the right to request a restriction on the disclosure of your information to third parties. However, please note that such a restriction may prevent you from using our Services.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">4</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Right to revoke consent</strong>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          This allows you to withdraw consent previously granted for the collection of personal data. We will comply with such requests, subject to applicable laws and the terms of any loans sanctioned through the Platform. However, exercising this right may limit or hinder our ability to provide services to you.
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">5</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <strong>Right to request deletion</strong>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          You may request deletion of any data collected by us pursuant to this Privacy Policy by reaching out to us. However, this right is subject to any lawful requirements and exercising this right may limit or hinder our ability to provide services to you.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-700">
                  Post termination of your relationship with spheeti fintech private Limited, we may continue to use your anonymized data either individually or in combination with anonymized data of other users. We use this aggregated anonymized data for data analysis, profiling, and research purposes. This helps us gain insights into our user behaviour and their profiles and improve our Services. We may keep your contact information along with your application details (if any) to prevent fraud for the exercise/ defence of a legal claim or for providing evidence in legal proceeding(s) as required.
                </p>
              </CardContent>
            </Card>

            {/* Section 7: Security Breach */}
            <Card>
              <CardHeader>
                <CardTitle>7. SECURITY BREACH</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  We at spheeti fintech private Limited, are committed to providing you the utmost security and safeguarding of your personal data. We implement sufficient and reasonable security measures to protect your personal information from unauthorized access, use and disclosure. While we take every reasonable measure to protect your personal information, it is important for you to understand that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security. This includes maintaining the confidentiality of your Account credentials, promptly reporting any suspicious activities, and adhering to the terms and conditions outlined in our Privacy Policy.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong>i.</strong> Your personal data can be accessed after you login to your Account through the Website/App. You are requested not to share your password and login ID with anyone as it can lead to data leakage. You can update the data such as your postal address, contact details, employment information from the Website/App.
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>ii.</strong> Your information is stored on our servers, and we encrypt certain sensitive information using Secure Socket Layer (SSL) technology to ensure that your personal details are safe as it is transmitted to us.
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>iii.</strong> We have restricted access to our database to a single IP address; external networks are unable to access it. In addition, the database provides quick data recovery in the event of data loss and includes several backup strategies. We defend against DDOS attacks on specific traffic by utilizing the fundamental DDOS protection capability offered by cloud vendors.
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>iv.</strong> The processing of data including the collection, usage, and sharing of your personal information by spheeti fintech private Limited shall be in compliance with the applicable laws.
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>v.</strong> In the event of a security breach which is raised to us or comes to our knowledge, we will comply with all applicable laws and regulations and take steps to make sure there is no further misuse of such information and may attempt to notify you electronically so that you can take appropriate steps.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 8: Review and Update */}
            <Card>
              <CardHeader>
                <CardTitle>8. REVIEW AND UPDATE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  We regularly review this Policy and reserve the right to change or update this Policy at any time. Such changes shall be effective immediately upon posting on this Platform. Your access and use of the Platform following any such change constitutes your agreement to follow and be bound by this Policy, as updated or modified. For this reason, we encourage you to review this Policy each time you access and use the Platform.
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
                  In the event of any dispute, difference or claim arising out of this Policy, the same shall be settled in accordance with the laws of India through regular judicial process and the courts of Kolkata/Bangalore shall have exclusive jurisdiction.
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
                  If you have any questions about this Privacy Policy or concerns regarding your privacy, please feel free to contact us at support@pocketcredit.in.
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
                      Ulhasnagar MUMBAI MAHARASHTRA, MUMBAI, Maharashtra, India – 421001
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