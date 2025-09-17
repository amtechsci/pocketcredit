import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, Scale, CheckCircle, DollarSign, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';

export function DisclaimerPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'IT, Fees & Fair Practice Policy - Pocket Credit';
  }, []);

  // IT Policy Content
  const itPolicySections = [
    {
      title: "Information Security",
      content: [
        "We implement industry-standard security measures to protect customer data and information.",
        "All data transmission is encrypted using 256-bit SSL encryption technology.",
        "Access to customer data is restricted to authorized personnel only.",
        "Regular security audits and penetration testing are conducted to ensure system integrity.",
        "We comply with the Information Technology Act, 2000 and related regulations."
      ]
    },
    {
      title: "Data Collection and Usage",
      content: [
        "We collect only necessary information required for loan processing and verification.",
        "Customer data is used solely for legitimate business purposes and regulatory compliance.",
        "We do not sell or share customer data with third parties without explicit consent.",
        "Data retention policies are in place to ensure data is not kept longer than necessary.",
        "Customers have the right to access, modify, or delete their personal information."
      ]
    },
    {
      title: "System Availability",
      content: [
        "We strive to maintain 99.9% system uptime for our digital platform.",
        "Scheduled maintenance windows are communicated in advance to minimize disruption.",
        "We have backup systems and disaster recovery procedures in place.",
        "Technical support is available 24/7 for critical issues.",
        "System performance is continuously monitored and optimized."
      ]
    }
  ];

  // Fees Policy Content
  const feesPolicySections = [
    {
      title: "Processing Fees",
      content: [
        "Processing fees range from 1% to 3% of the loan amount, depending on the loan product and risk profile.",
        "Fees are calculated and displayed upfront before loan approval.",
        "No hidden charges or surprise fees are levied.",
        "Processing fees are non-refundable once the loan is disbursed.",
        "GST at applicable rates is charged on all fees."
      ]
    },
    {
      title: "Interest Rates",
      content: [
        "Interest rates range from 12% to 36% per annum, based on creditworthiness and loan tenure.",
        "Rates are fixed for the entire loan tenure and communicated clearly upfront.",
        "No prepayment penalties for early loan closure.",
        "Interest is calculated on a reducing balance basis.",
        "Late payment charges of 2% per month may apply for delayed payments."
      ]
    },
    {
      title: "Other Charges",
      content: [
        "Documentation charges: ₹500 (one-time, non-refundable)",
        "EMI bounce charges: ₹500 per instance",
        "Legal charges: As per actuals (only in case of recovery proceedings)",
        "All charges are clearly disclosed in the loan agreement.",
        "No charges for loan closure or prepayment."
      ]
    }
  ];

  // Fair Practice Code Content
  const fairPracticeSections = [
    {
      title: "Transparency in Lending",
      content: [
        "All terms and conditions are clearly communicated in simple language.",
        "Interest rates, fees, and charges are disclosed upfront before loan approval.",
        "No hidden charges or surprise fees are levied.",
        "Loan agreements are provided in both English and local language.",
        "Customers are given adequate time to review and understand loan terms."
      ]
    },
    {
      title: "Responsible Lending",
      content: [
        "We assess customer's repayment capacity before sanctioning loans.",
        "We do not encourage over-borrowing or multiple simultaneous loans.",
        "Clear communication about loan obligations and consequences of default.",
        "Flexible repayment options are offered based on customer's financial situation.",
        "We provide financial literacy resources to help customers make informed decisions."
      ]
    },
    {
      title: "Customer Rights",
      content: [
        "Right to receive all loan-related documents and information.",
        "Right to grievance redressal through our multi-level complaint mechanism.",
        "Right to privacy and data protection as per applicable laws.",
        "Right to fair treatment and non-discrimination.",
        "Right to transparent communication about loan status and terms."
      ]
    }
  ];

  // FAQ Content
  const faqItems = [
    {
      question: "What is the eligibility to apply for loan?",
      answer: "A person with monthly net income of Rs.25000 • Applying from Any city in India."
    },
    {
      question: "What is the maximum loan amount I am eligible for?",
      answer: "We give loans upto Rs 6000 - Rs 1 lakh. The sanctioned loan amount depends on your financial and credit history information."
    },
    {
      question: "What are the steps involved to get a loan?",
      answer: "The steps involved are: 1. Loan application. 2. KYC verification. 3. Fill bank account details. 4. Loan disbursal."
    },
    {
      question: "How much time does it take to get money in the account?",
      answer: "Loan sanction is instant on the website. After that we verify the information from submitted documents. Once approved, money is disbursed in 30min"
    }
  ];

  // Service Features
  const serviceFeatures = [
    {
      icon: CheckCircle,
      title: "100% online",
      description: "Complete digital process from application to disbursal"
    },
    {
      icon: FileText,
      title: "Minimum Documentation",
      description: "Simple and quick document verification process"
    },
    {
      icon: Clock,
      title: "Disbursal in 30 minutes",
      description: "Fast approval and quick fund transfer"
    }
  ];

  const processSteps = [
    {
      step: "1",
      title: "Simple Registration",
      description: "Quick and easy account creation with basic details"
    },
    {
      step: "2", 
      title: "Quick verification",
      description: "Fast KYC and document verification process"
    },
    {
      step: "3",
      title: "Instant Fund Transfer",
      description: "Money credited to your account within 30 minutes"
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#1E2A3B' }}>
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#0052FF' }}
            >
              <FileText className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            IT, Fees & Fair Practice Policy
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Comprehensive information about our IT policy, fees policy, fair practice code, and loan services. 
            Please read carefully before using our platform.
          </p>
        </div>
      </section>

      {/* Service Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              We Are Fully Dedicated To Support You
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              How it works? Simple Registration • Quick verification • Instant Fund Transfer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {processSteps.map((step, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#0052FF' }}>
                    <span className="text-2xl font-bold text-white">{step.step}</span>
                  </div>
                  <h3 className="text-xl mb-3" style={{ color: '#1E2A3B' }}>
                    {step.title}
                  </h3>
                  <p className="text-gray-600">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Our Loans
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {serviceFeatures.map((feature, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-8">
                  <feature.icon className="h-12 w-12 mx-auto mb-4" style={{ color: '#00C49A' }} />
                  <h3 className="text-xl mb-3" style={{ color: '#1E2A3B' }}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="it-policy" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="it-policy">IT Policy</TabsTrigger>
              <TabsTrigger value="fees-policy">Fees Policy</TabsTrigger>
              <TabsTrigger value="fair-practice">Fair Practice Code</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="it-policy" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  IT Policy
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Information technology policies and security measures for our digital platform.
                </p>
              </div>

              <div className="space-y-6">
                {itPolicySections.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                        <Settings className="h-5 w-5" style={{ color: '#0052FF' }} />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.content.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2" style={{ color: '#1E2A3B' }}>
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#00C49A' }}></div>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="fees-policy" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Fees Policy
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Transparent fee structure and charges for all our loan products.
                </p>
              </div>

              <div className="space-y-6">
                {feesPolicySections.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                        <DollarSign className="h-5 w-5" style={{ color: '#0052FF' }} />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.content.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2" style={{ color: '#1E2A3B' }}>
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#00C49A' }}></div>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="fair-practice" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Fair Practice Code
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Our commitment to fair and transparent lending practices.
                </p>
              </div>

              <div className="space-y-6">
                {fairPracticeSections.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                        <Scale className="h-5 w-5" style={{ color: '#0052FF' }} />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.content.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2" style={{ color: '#1E2A3B' }}>
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#00C49A' }}></div>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="faq" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Need Help? Read Popular Questions
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Common questions about our loan products and services.
                </p>
              </div>

              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <h3 className="text-lg mb-3" style={{ color: '#1E2A3B' }}>
                        {faq.question}
                      </h3>
                      <p style={{ color: '#1E2A3B' }}>
                        {faq.answer}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg mb-3 text-blue-800">
                    Still have questions?
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Contact our customer support team for any additional assistance.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button 
                      onClick={() => navigate('/contact')}
                      style={{ backgroundColor: '#0052FF' }}
                    >
                      Contact Support
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/grievance')}
                    >
                      Grievance Redressal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Last Updated */}
      <section className="py-8 px-4" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm" style={{ color: '#1E2A3B' }}>
            <strong>Last Updated:</strong> January 10, 2025
          </p>
          <p className="text-sm mt-2" style={{ color: '#1E2A3B' }}>
            This document is subject to periodic updates. Please review regularly for any changes.
          </p>
        </div>
      </section>
    </div>
  );
}