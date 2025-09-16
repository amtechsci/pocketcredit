import { Calculator, DollarSign, AlertTriangle, Info, TrendingUp, FileText, ExternalLink, Download, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { Page } from '../../App';

interface FeesPolicyProps {
  onNavigate: (page: Page) => void;
}

export function FeesPolicy({ onNavigate }: FeesPolicyProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Calculator className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Interest Rate, Penalty Charges & <span style={{ color: '#0052FF' }}>Fees Policy</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Transparent pricing structure and fee methodology for all loan products offered by spheeti fintech private Limited
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Board Approved Policy | Compliant with RBI Master Directions | Last Updated: January 10, 2025
            </p>
          </div>

          {/* RBI Compliance Notice */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-blue-800 mb-2">RBI Compliance Statement</h3>
                    <p className="text-sm text-blue-700">
                      This policy has been established in accordance with RBI Master Directions, Digital Lending Guidelines, and other applicable regulations. The Board of Directors adopted this policy and will apply best industry practices as long as they don't conflict with RBI guidelines.
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
                  spheeti fintech private Limited (SFPL) is an RBI-registered Non-Banking Finance Company. SFPL provides short-term personal loans and advances without collateral or security.
                </p>
                <p className="text-sm text-gray-700">
                  The company has established internal principles and procedures for determining interest rates, overdue charges, and other fees, which are available on its website and updated as changes occur.
                </p>
              </CardContent>
            </Card>

            {/* Section 2: Objectives */}
            <Card>
              <CardHeader>
                <CardTitle>2. Policy Objectives</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">The policy aims to:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Ensure transparent, fair, and compliant interest rates</li>
                    <li>Communicate the annualized interest rate, risk gradation approach, and rationale for varying rates across borrower categories</li>
                    <li>Provide clarity on the methodology and rationale for interest rate determination</li>
                    <li>Outline factors considered in determining interest rates and other charges</li>
                    <li>Outline broad principles for levying penal charges fairly and consistently</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Interest Rate Model */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  3. Interest Rate Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  SFPL primarily offers fixed interest rate loans through digital platforms, with various products for different customer needs.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Interest rates for each product are determined based on:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-2">Financial Factors:</h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Cost of Funds (including borrowing costs and associated expenses)</li>
                        <li>• Operating Costs (administrative and operational expenses)</li>
                        <li>• Market Conditions (prevailing interest rates in banking and financial sectors)</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-green-800 mb-2">Risk Assessment:</h5>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Credit Risk (customer's credit history, repayment capacity, and financial stability)</li>
                        <li>• Nature of Lending (type of lending, principal amount, and tenure)</li>
                        <li>• Loan Tenure (different rates for different loan durations)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Regulatory Compliance:</h4>
                  <p className="text-sm text-gray-700">
                    All interest rate determinations are made in compliance with RBI guidelines and regulatory requirements.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Fixed Interest Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  4. Current Interest Rate Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h4 className="font-medium text-yellow-800">Standard Interest Rate</h4>
                  </div>
                  <p className="text-sm text-yellow-700">
                    The company offers a standard interest rate of <strong>0.1% per day</strong> to borrowers. This rate is applied proportionately for the loan tenure.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Daily Rate Breakdown:</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Daily Rate: 0.1%</li>
                      <li>• Monthly Equivalent: ~3%</li>
                      <li>• Annualized Rate: ~36.5%</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Application:</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Applied proportionately</li>
                      <li>• Based on loan tenure</li>
                      <li>• Fixed rate structure</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Fees and Charges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  5. Product-wise Fees and Charges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  In addition to interest, other financial charges may be levied as outlined below:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3" style={{ color: '#1E2A3B' }}>Primary Charges:</h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li className="flex justify-between">
                        <span>Processing fees:</span>
                        <Badge variant="outline">10-15% of loan amount</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Documentation fees:</span>
                        <Badge variant="outline">As applicable</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Technology charges:</span>
                        <Badge variant="outline">Variable</Badge>
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3" style={{ color: '#1E2A3B' }}>Additional Charges:</h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li className="flex justify-between">
                        <span>Late payment charges:</span>
                        <Badge variant="outline">Per policy</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Pre-payment charges:</span>
                        <Badge variant="outline">As applicable</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Other applicable cess:</span>
                        <Badge variant="outline">Variable</Badge>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Disclosure:</strong> These charges will be mentioned in the Loan Agreement/Key Fact Statement (KFS). 
                    Stamp duty, service tax, GST, and other cess will also be collected at applicable rates.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Overdue Charges */}
            <Card>
              <CardHeader>
                <CardTitle>6. Overdue Charges and Penal Fees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  Delayed/late payment charges will be collected for any payment delays or defaults. These charges will be decided by the company from time to time for different products.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Key Principles for Penal Charges:</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-green-800 mb-1">Purpose:</h5>
                      <p className="text-sm text-green-700">Penal charges are intended to promote credit discipline, not to enhance revenue.</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-1">Classification:</h5>
                      <p className="text-sm text-blue-700">Penalty for non-compliance with material loan terms will be treated as 'penal charges,' not 'penal interest.'</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <h5 className="font-medium text-purple-800 mb-1">Calculation:</h5>
                      <p className="text-sm text-purple-700">Penal charges will not be capitalized (no further interest computed on them). No additional component will be added to the interest rate.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Structure of Penal Charges:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Currently, penal charges are only levied for missed repayments by the due date</li>
                    <li>The quantum of penal charges will be reasonable, commensurate with non-compliance, and non-discriminatory within a loan/product category</li>
                    <li>The quantum and reason for penal charges will be clearly disclosed in the loan agreement, KFS, and on the company website</li>
                    <li>Borrowers will be communicated about applicable penal charges, the instance of their levy, and the reason</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Section 7: APR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  7. Annual Percentage Rate (APR)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                  <h4 className="font-medium text-orange-800 mb-2">APR Disclosure</h4>
                  <p className="text-sm text-orange-700">
                    SFPL will disclose the annualized effective rate (APR) in loan documentation. The APR represents the total cost of the digital loan to the borrower, including the nominal interest rate and all applicable fees and charges, expressed as a percentage over a one-year period.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Purpose of APR:</h4>
                  <p className="text-sm text-gray-700">
                    This ensures borrowers have a clear and standardized understanding of the total cost of credit, enabling informed decision-making.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 8: Communication */}
            <Card>
              <CardHeader>
                <CardTitle>8. Communication and Transparency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Disclosure Timeline:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Loan charges will be intimated to customers at the time of loan sanction/availing</li>
                    <li>This policy will be uploaded on the company's website</li>
                    <li>Any changes will be updated periodically</li>
                    <li>Customers will be notified of material changes through appropriate channels</li>
                  </ul>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Website Availability:</h4>
                  <p className="text-sm text-gray-700">
                    Current rates, charges, and the complete fee structure are available on our website and are updated regularly to reflect any changes.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 9: Review */}
            <Card>
              <CardHeader>
                <CardTitle>9. Policy Review and Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Review Schedule:</h4>
                  <p className="text-sm text-gray-700">
                    The policy will be reviewed annually, or more frequently if deemed necessary by the Board of Directors.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Factors for Review:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Changes in RBI guidelines and regulations</li>
                    <li>Market conditions and competitive landscape</li>
                    <li>Cost of funds and operational expenses</li>
                    <li>Risk assessment methodologies</li>
                    <li>Customer feedback and business requirements</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Important Notice */}
            <Card>
              <CardHeader>
                <CardTitle>Important Notice for Borrowers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 mb-2">Before Taking a Loan:</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        <li>• Carefully read and understand all terms and conditions</li>
                        <li>• Review the complete fee structure and APR</li>
                        <li>• Ensure you can afford the repayments</li>
                        <li>• Ask questions if anything is unclear</li>
                        <li>• Consider the consequences of default</li>
                      </ul>
                    </div>
                  </div>
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
                    onClick={() => onNavigate('fair-practice')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Fair Practice Code
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => onNavigate('terms')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Terms & Conditions
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => onNavigate('grievance')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Grievance Redressal
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => onNavigate('privacy')}
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
                  Download/Print Policy
                </Button>
                <Button 
                  onClick={() => onNavigate('contact')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Contact Support
                </Button>
              </div>
              <Button 
                onClick={() => onNavigate('home')}
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