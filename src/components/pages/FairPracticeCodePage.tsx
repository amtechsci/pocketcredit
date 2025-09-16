import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Shield, CheckCircle, Scale, Users, FileText, Star, AlertTriangle, ExternalLink, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';




export function FairPracticeCodePage() {
    const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Scale className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Fair Practice <span style={{ color: '#0052FF' }}>Code</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Our commitment to fair, transparent, and ethical lending practices in compliance with RBI guidelines
            </p>
            <p className="text-sm text-gray-600 mt-4">
              In accordance with RBI Master Direction - NBFC Scale Based Regulation | Last Updated: January 10, 2025
            </p>
          </div>

          {/* RBI Compliance Notice */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-blue-800 mb-2">RBI Compliance Statement</h3>
                    <p className="text-sm text-blue-700">
                      This Fair Practice Code has been amended according to the Master Direction – Reserve Bank of India (Non-Banking Financial Company – Scale Based Regulation) Directions, 2023 and is reviewed by the Company's Board. The Code is in conformity with RBI Circular No. RBI/2015-16/16 DNBR (PD) CC.No.054/03.10.119/2015-16 dated July 1, 2015.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Section 1: Introduction */}
            <Card>
              <CardHeader>
                <CardTitle>1. Introduction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Spheeti Fintech Private Limited (SFPL) is a Non-Banking Financial Company (NBFC) registered with the Reserve Bank of India (RBI) and aims to follow RBI's policy guidelines for fair business practices with borrowers.
                </p>
                <p className="text-sm text-gray-700">
                  This Fair Practice Code (FPC or Code) sets minimum fair practice standards for the Company and provides information to borrowers on how the Company interacts with them daily. SFPL is committed to fair and transparent dealings with borrowers and has implemented this FPC.
                </p>
              </CardContent>
            </Card>

            {/* Section 2: Objectives */}
            <Card>
              <CardHeader>
                <CardTitle>2. Objectives of the Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">The primary objectives are:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>To promote good, fair, and trustworthy practices in dealing with borrowers</li>
                    <li>To increase transparency for borrowers to understand expected services</li>
                    <li>To encourage market competition for higher operating standards</li>
                    <li>To promote a fair and cordial relationship between borrowers and the Company</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Company Commitments */}
            <Card>
              <CardHeader>
                <CardTitle>3. Company's Key Commitments and Declarations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600 mb-2" />
                    <h4 className="font-medium text-blue-800 mb-2">Integrity & Transparency</h4>
                    <p className="text-sm text-blue-700">
                      Act honestly, fairly, and reasonably, dealing with borrowers based on integrity and transparency.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <Users className="w-6 h-6 text-green-600 mb-2" />
                    <h4 className="font-medium text-green-800 mb-2">Non-Discrimination</h4>
                    <p className="text-sm text-green-700">
                      No discrimination based on gender, race, caste, religion, or language, treating all clients consistently and fairly.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <FileText className="w-6 h-6 text-purple-600 mb-2" />
                    <h4 className="font-medium text-purple-800 mb-2">Transparency in Records</h4>
                    <p className="text-sm text-purple-700">
                      Ensure transparency in maintaining books of accounts and disclosing financial statements by qualified auditors.
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <Star className="w-6 h-6 text-orange-600 mb-2" />
                    <h4 className="font-medium text-orange-800 mb-2">Board Responsibility</h4>
                    <p className="text-sm text-orange-700">
                      Board of Directors and management are responsible for implementing the FPC and ensuring employee awareness.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Loan Applications */}
            <Card>
              <CardHeader>
                <CardTitle>4. Applications for Availing Loans and Their Processing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Our Commitments:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Communications will be provided in vernacular language upon request</li>
                    <li>Loan agreements will contain all necessary information, including interest rates, processing charges, insurance charges, and penal charges</li>
                    <li>The loan application form will list required documents</li>
                    <li>SFPL will offer credit to eligible applicants</li>
                    <li>Acknowledgements for loan applications and documents will be given</li>
                    <li>Decisions on loan applications will be made within 30 days of receiving a complete application</li>
                    <li>Contact numbers will be provided for inquiries about the loan process</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Loan Appraisal */}
            <Card>
              <CardHeader>
                <CardTitle>5. Loan Appraisal and Terms/Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Transparency Requirements:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>The Company will convey in writing the annualized rate of interest, Annual Percentage Rate (APR), and method of application</li>
                    <li>Penal charges for late repayment will be mentioned in bold in the loan agreement</li>
                    <li>Contingent charges will be disclosed separately in the sanction letter</li>
                    <li>A copy of the loan agreement and enclosures will be furnished to borrowers, preferably in vernacular language if requested</li>
                    <li>Terms, conditions, and responsibilities will be reiterated at application, sanction, and disbursement</li>
                    <li>Due notice will be given for changes in loan conditions, especially interest rates (prospectively)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Marketing */}
            <Card>
              <CardHeader>
                <CardTitle>6. Marketing and Product Synergy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Advertising and promotional materials will be reviewed for clarity, fairness, reasonableness, and non-misleading representations</li>
                    <li>The company will provide a comprehensive range of financial products, including internal offerings, those from affiliated entities, and through strategic partnerships</li>
                    <li>Cross-selling opportunities will be promoted to enhance value for borrowers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: Disbursement */}
            <Card>
              <CardHeader>
                <CardTitle>7. Disbursement of Loans Including Changes in Terms and Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Notice will be given for changes in terms, including disbursement schedule, interest rates, service charges, and foreclosure charges</li>
                    <li>Changes in interest rates and charges will apply prospectively</li>
                    <li>Decision to recall/accelerate payment or seek additional securities will be in consonance with the loan agreement, with prior notice to borrowers</li>
                    <li>All securities will be released upon full repayment, subject to any legitimate lien for other claims</li>
                    <li>Clients will be clearly informed about loan terms, advantages of timely repayments, and consequences of default</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 8: Recovery */}
            <Card>
              <CardHeader>
                <CardTitle>8. Recovery of Loans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
                  <h4 className="font-medium text-red-800 mb-2">Ethical Recovery Practices</h4>
                  <p className="text-sm text-red-700">
                    The Company will not resort to undue harassment (e.g., bothering at odd hours, using muscle power) for recovery, and staff will be trained appropriately.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Recovery Standards:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Decisions to recall/accelerate payment will be in consonance with the loan agreement</li>
                    <li>Polite language will be used, avoiding abusive and harsh words</li>
                    <li>All securities will be released upon full repayment, subject to any legitimate lien for other claims</li>
                    <li>If a right of set-off is exercised, the borrower will be given notice with full particulars</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 9: Privacy */}
            <Card>
              <CardHeader>
                <CardTitle>9. Privacy and Confidentiality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Data Sharing Policy:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Details of loans and repayment records may be shared with Credit Information Companies (CICs) as per regulatory directions</li>
                    <li>Personal information will be treated as private and confidential, even after the borrower is no longer associated</li>
                    <li>Data will not be revealed except when required by law, for providing services, for public duty, for the company's interest, or with borrower consent</li>
                    <li>Personal information will be safeguarded, with disclosures only to authorized parties with client knowledge and consent</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 10: Interest Rates */}
            <Card>
              <CardHeader>
                <CardTitle>10. Regulation on Interest Charged</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Interest Rate Model:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>The Company will adopt an interest rate model considering cost of funds, margin, and risk premium</li>
                    <li>The interest rate and approach for risk gradation will be disclosed in the application form and sanction letter</li>
                    <li>Rates and risk gradation approach will be available on the website or published in newspapers</li>
                    <li>Interest rates will be annualized</li>
                    <li>Interest will be charged from the date of actual disbursement, not sanction or agreement execution</li>
                    <li>For disbursal or repayment during the month, interest will be charged only for the outstanding period</li>
                    <li>Foreclosure charges/pre-payment penalties will not be charged on floating rate term loans sanctioned to individual borrowers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 11: Accessibility */}
            <Card>
              <CardHeader>
                <CardTitle>11. Loan Facilities to the Physically/Visually Challenged</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>The loan sanctioning process prohibits discrimination against physically/visually challenged applicants</li>
                    <li>All branches will provide assistance to such persons</li>
                    <li>Training programs for employees will include modules on the rights of persons with disabilities</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 12: General Provisions */}
            <Card>
              <CardHeader>
                <CardTitle>12. General Provisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>The Company will refrain from interfering in borrower affairs except as provided in loan terms</li>
                    <li>Requests for transfer of borrowal accounts will receive consent or objection within 21 days</li>
                    <li>Borrowers will be called between 8:00 A.M. and 7:00 P.M., unless business circumstances require otherwise</li>
                    <li>Security enforcement for delinquent borrowers will aim only to recover dues, costs, and expenses</li>
                    <li>The process of security enforcement, valuation, and realization will be fair and transparent</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 13: Compliance */}
            <Card>
              <CardHeader>
                <CardTitle>13. Compliance and Implementation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Compliance Measures:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>The Fair Practice Code will be provided in vernacular language if requested</li>
                    <li>The FPC will be displayed on notice boards of all branches and offices, and on the company website</li>
                    <li>Borrowers are requested to provide feedback to improve services</li>
                    <li>If any clause in this policy overrides applicable RBI guidelines, the RBI provisions will prevail</li>
                    <li>The Board of Directors is authorized to review and approve modifications to the FPC</li>
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
                    onClick={() => navigate('/grievance')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Grievance Redressal
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/fees-policy')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Interest & Fees Policy
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
                    onClick={() => navigate('/privacy')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Privacy Policy
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
                  Download/Print FPC
                </Button>
                <Button 
                  onClick={() => navigate('/contact')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Contact Support
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