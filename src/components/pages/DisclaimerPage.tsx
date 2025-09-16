import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Shield, FileText, Eye, Info, Clock, Building2, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';

export function DisclaimerPage() {
  const navigate = useNavigate();
  const disclaimerSections = [
    {
      title: "General Disclaimer",
      content: [
        "The information provided on this website is for general informational purposes only and should not be construed as financial, legal, or investment advice.",
        "While we strive to provide accurate and up-to-date information, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the information, products, services, or related graphics contained on this website.",
        "Any reliance you place on such information is strictly at your own risk. In no event will we be liable for any loss or damage arising from the use of this website."
      ]
    },
    {
      title: "Loan Products Disclaimer",
      content: [
        "Loan approval is subject to verification of documents, credit score assessment, and meeting our eligibility criteria.",
        "Interest rates, processing fees, and other charges are subject to change without prior notice and may vary based on individual risk profiles.",
        "The actual loan amount sanctioned may differ from the amount applied for, based on our internal assessment and risk evaluation.",
        "All loan products are subject to the terms and conditions of the respective partner lending institutions."
      ]
    },
    {
      title: "Third-Party Services",
      content: [
        "We partner with various NBFCs and financial institutions to provide loan products. We are not responsible for the services, terms, or policies of these third-party lenders.",
        "Credit scores and reports are provided by third-party agencies. We do not guarantee the accuracy of these reports.",
        "External links on our website may direct you to third-party sites. We are not responsible for the content or practices of these external sites."
      ]
    },
    {
      title: "Technology and System Availability",
      content: [
        "While we strive to maintain system availability 24/7, we do not guarantee uninterrupted access to our services.",
        "Technical issues, maintenance, or other factors beyond our control may result in temporary service interruptions.",
        "We are not liable for any losses or damages resulting from system downtime or technical issues."
      ]
    }
  ];

  const disclosures = [
    {
      title: "Company Information",
      items: [
        "Company Name: Pocket Credit Technologies Private Limited",
        "CIN: U65921MH2019PTC325847",
        "Registered Office: 15th Floor, Tower A, Peninsula Business Park, Mumbai - 400013",
        "Email: info@pocketcredit.in",
        "Phone: 1800-123-4567"
      ]
    },
    {
      title: "Regulatory Information",
      items: [
        "We are a digital lending platform that facilitates loans through our partner NBFCs and banks.",
        "We are not a Non-Banking Financial Company (NBFC) and do not lend money directly.",
        "All lending activities are conducted by our partner institutions who are duly licensed by the Reserve Bank of India.",
        "We comply with all applicable laws and regulations including the Information Technology Act, 2000 and RBI guidelines."
      ]
    },
    {
      title: "Data and Privacy",
      items: [
        "We collect and process personal data in accordance with our Privacy Policy and applicable data protection laws.",
        "Credit bureau data is accessed only with customer consent and for legitimate lending purposes.",
        "Customer data is shared with partner lenders only after proper consent and for loan processing purposes.",
        "We implement industry-standard security measures to protect customer data."
      ]
    },
    {
      title: "Fees and Charges",
      items: [
        "We may charge convenience fees for certain services as disclosed during the application process.",
        "Partner lenders may charge processing fees, administrative charges, and other fees as per their terms.",
        "All fees and charges are transparently disclosed before loan agreement execution.",
        "GST and other applicable taxes will be charged extra on all fees and charges."
      ]
    }
  ];

  const risks = [
    {
      icon: AlertTriangle,
      title: "Credit Risk",
      description: "Loan defaults can impact your credit score and future borrowing ability. Ensure you can comfortably repay before borrowing."
    },
    {
      icon: Clock,
      title: "Interest Rate Risk",
      description: "Interest rates may vary based on market conditions and your credit profile. Fixed rates may be higher than floating rates initially."
    },
    {
      icon: FileText,
      title: "Documentation Risk",
      description: "Incomplete or incorrect documentation may lead to loan rejection or delays in processing."
    },
    {
      icon: Scale,
      title: "Legal Risk",
      description: "Loan agreements are legally binding contracts. Ensure you understand all terms and conditions before signing."
    }
  ];

  const importantNotes = [
    "This platform is designed for users aged 18 years and above.",
    "Loans are subject to individual eligibility and creditworthiness assessment.",
    "We recommend borrowing only what you can comfortably repay to avoid financial stress.",
    "Always read and understand the loan agreement terms before signing.",
    "Contact our customer support for any clarifications before applying for a loan."
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
            Disclaimer & Disclosure
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Important information about our services, risks, and regulatory compliance. 
            Please read carefully before using our platform.
          </p>
        </div>
      </section>

      {/* Alert Banner */}
      <section className="py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Important:</strong> This document contains critical information about risks, limitations, and regulatory aspects of our services. 
              Please read all sections carefully. If you have any questions, contact our customer support before proceeding.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="disclaimers" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="disclaimers">Disclaimers</TabsTrigger>
              <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
              <TabsTrigger value="risks">Risk Factors</TabsTrigger>
              <TabsTrigger value="notes">Important Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="disclaimers" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Legal Disclaimers
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Important disclaimers regarding our services and platform usage.
                </p>
              </div>

              <div className="space-y-6">
                {disclaimerSections.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                        <FileText className="h-5 w-5" style={{ color: '#0052FF' }} />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {section.content.map((item, idx) => (
                          <p key={idx} style={{ color: '#1E2A3B' }}>
                            {item}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Regulatory Disclosures
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Mandatory disclosures as per regulatory requirements and industry standards.
                </p>
              </div>

              <div className="space-y-6">
                {disclosures.map((disclosure, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                        <Info className="h-5 w-5" style={{ color: '#0052FF' }} />
                        {disclosure.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {disclosure.items.map((item, idx) => (
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

            <TabsContent value="risks" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Risk Factors
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Important risks to consider before availing our loan services.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {risks.map((risk, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: '#FEF3C7' }}
                        >
                          <risk.icon className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                          <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                            {risk.title}
                          </h3>
                          <p style={{ color: '#1E2A3B' }}>
                            {risk.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg mb-2 text-red-800">
                        High Risk Warning
                      </h3>
                      <p className="text-red-700">
                        Borrowing money involves financial risk. Only borrow what you can afford to repay. 
                        Defaulting on loan payments can severely impact your credit score and legal action may be taken. 
                        Consider alternative sources of funding and ensure you have a repayment plan before borrowing.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Important Notes
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Key points to remember while using our platform and services.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3" style={{ color: '#1E2A3B' }}>
                    <Eye className="h-5 w-5" style={{ color: '#0052FF' }} />
                    Key Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {importantNotes.map((note, index) => (
                      <li key={index} className="flex items-start gap-3" style={{ color: '#1E2A3B' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ backgroundColor: '#0052FF' }}>
                          <span className="text-white text-xs">{index + 1}</span>
                        </div>
                        {note}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="text-center">
                  <CardContent className="p-6">
                    <Shield className="h-10 w-10 mx-auto mb-3" style={{ color: '#00C49A' }} />
                    <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                      Secure Platform
                    </h3>
                    <p className="text-sm" style={{ color: '#1E2A3B' }}>
                      Bank-grade security with 256-bit SSL encryption for all transactions.
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardContent className="p-6">
                    <Building2 className="h-10 w-10 mx-auto mb-3" style={{ color: '#00C49A' }} />
                    <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                      RBI Compliant
                    </h3>
                    <p className="text-sm" style={{ color: '#1E2A3B' }}>
                      All partner lenders are RBI registered and compliant with regulations.
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardContent className="p-6">
                    <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: '#00C49A' }} />
                    <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                      Transparent Terms
                    </h3>
                    <p className="text-sm" style={{ color: '#1E2A3B' }}>
                      All fees, charges, and terms are clearly disclosed before agreement.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg mb-3 text-blue-800">
                    Need Clarification?
                  </h3>
                  <p className="text-blue-700 mb-4">
                    If you have any questions about these disclaimers, disclosures, or our services, 
                    please don't hesitate to contact our customer support team.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Badge variant="outline" className="text-blue-800 border-blue-300">
                      Phone: 1800-123-4567
                    </Badge>
                    <Badge variant="outline" className="text-blue-800 border-blue-300">
                      Email: support@pocketcredit.in
                    </Badge>
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
            <strong>Last Updated:</strong> January 15, 2024
          </p>
          <p className="text-sm mt-2" style={{ color: '#1E2A3B' }}>
            This document is subject to periodic updates. Please review regularly for any changes.
          </p>
        </div>
      </section>
    </div>
  );
}