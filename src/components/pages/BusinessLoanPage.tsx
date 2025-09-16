import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, FileText, Clock, Shield, Calculator, ChevronDown, ChevronUp, Building, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { EMICalculator } from '../EMICalculator';
import { ImageWithFallback } from '../figma/ImageWithFallback';




export function BusinessLoanPage() {
    const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Clock,
      title: 'Quick Processing',
      description: 'Get approval in 48 hours with minimal documentation',
      color: '#0052FF'
    },
    {
      icon: Shield,
      title: 'Competitive Rates',
      description: 'Starting at 12% p.a. for established businesses',
      color: '#06B6D4'
    },
    {
      icon: Building,
      title: 'High Loan Amount',
      description: 'Get funding up to ₹50 lakhs for business expansion',
      color: '#FFD700'
    },
    {
      icon: TrendingUp,
      title: 'Flexible Repayment',
      description: 'Choose tenure up to 5 years with flexible EMI options',
      color: '#FF6B6B'
    }
  ];

  const eligibilityData = [
    {
      criteria: 'Business Type',
      requirement: 'Proprietorship, Partnership, Pvt Ltd, LLP'
    },
    {
      criteria: 'Business Vintage',
      requirement: 'Minimum 3 years in operation'
    },
    {
      criteria: 'Annual Turnover',
      requirement: 'Minimum ₹40 lakhs per annum'
    },
    {
      criteria: 'Age of Applicant',
      requirement: '25 to 65 years'
    },
    {
      criteria: 'CIBIL Score',
      requirement: 'Minimum 700'
    },
    {
      criteria: 'ITR Filing',
      requirement: 'Regular ITR filing for last 3 years'
    }
  ];

  const ratesAndCharges = [
    {
      particular: 'Interest Rate',
      charges: 'Starting at 12% p.a.',
      description: 'Based on business profile and turnover'
    },
    {
      particular: 'Processing Fee',
      charges: 'Up to 2% of loan amount',
      description: 'Min. ₹2,999, Max. ₹15,000'
    },
    {
      particular: 'Late Payment Charges',
      charges: '2% per month',
      description: 'On overdue amount'
    },
    {
      particular: 'Foreclosure Charges',
      charges: '2% of outstanding',
      description: 'After 12 months'
    },
    {
      particular: 'Documentation Charges',
      charges: '₹2,500',
      description: 'One-time charges'
    }
  ];

  const requiredDocuments = [
    { 
      type: 'Business Documents', 
      documents: [
        'Business Registration Certificate', 
        'Partnership Deed/MOA & AOA', 
        'GST Registration Certificate', 
        'Trade License'
      ] 
    },
    { 
      type: 'Financial Documents', 
      documents: [
        'ITR for last 3 years', 
        'Audited Financial Statements', 
        'Bank statements (12-18 months)', 
        'GST Returns'
      ] 
    },
    { 
      type: 'Identity & Address Proof', 
      documents: [
        'PAN Card of business and promoters', 
        'Aadhaar Card of promoters', 
        'Registered office address proof', 
        'Current account statements'
      ] 
    },
    { 
      type: 'Additional Documents', 
      documents: [
        'Business profile/Project report', 
        'Rent agreement of business premises', 
        'Vendor/Customer contracts', 
        'Collateral documents (if applicable)'
      ] 
    }
  ];

  const loanPurposes = [
    'Working Capital Requirements',
    'Business Expansion',
    'Equipment Purchase',
    'Inventory Funding',
    'Office Setup/Renovation',
    'Technology Upgradation',
    'Marketing & Advertising',
    'Export/Import Financing'
  ];

  const faqs = [
    {
      question: 'What is the maximum business loan amount available?',
      answer: 'You can get a business loan up to ₹50 lakhs based on your business turnover, profitability, and repayment capacity. The exact amount depends on your business profile assessment.'
    },
    {
      question: 'What documents are required for business loan application?',
      answer: 'Key documents include business registration proof, ITR for last 3 years, bank statements, GST returns, financial statements, and identity proof of promoters. Complete list varies based on business type.'
    },
    {
      question: 'How is the interest rate determined?',
      answer: 'Interest rates start from 12% p.a. and vary based on factors like business vintage, turnover, profitability, credit score, loan amount, and tenure. Better business profile gets better rates.'
    },
    {
      question: 'Is collateral required for business loans?',
      answer: 'For loans up to ₹25 lakhs, collateral may not be required based on business strength. For higher amounts, collateral or guarantee may be needed as per lender policy.'
    },
    {
      question: 'What can business loans be used for?',
      answer: 'Business loans can be used for working capital, business expansion, equipment purchase, inventory, office setup, technology upgrade, marketing, and other legitimate business purposes.'
    },
    {
      question: 'How long does the approval process take?',
      answer: 'With complete documentation, business loan approval typically takes 48-72 hours. Disbursal happens within 5-7 business days after approval and completion of legal formalities.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
                Business Loan for Growth
              </h1>
              <p className="text-lg mb-6" style={{ color: '#1E2A3B' }}>
                Fuel your business dreams with loans up to ₹50 lakhs. 
                Quick approval, competitive rates, and flexible repayment options.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                  <p className="text-2xl font-bold" style={{ color: '#0052FF' }}>₹50L</p>
                  <p className="text-sm text-gray-600">Maximum Amount</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                  <p className="text-2xl font-bold" style={{ color: '#06B6D4' }}>12%</p>
                  <p className="text-sm text-gray-600">Starting Interest Rate</p>
                </div>
              </div>
              <Button 
                size="lg"
                onClick={() => navigate('/application')}
                style={{ backgroundColor: '#0052FF' }}
                className="text-white hover:opacity-90 px-8 py-3"
              >
                Apply for Business Loan
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex justify-center">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1659353221012-4b03d33347d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMGluZGlhbiUyMGVudHJlcHJlbmV1cnxlbnwxfHx8fDE3NTcxNzMwNzd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Business loan for entrepreneurs"
                className="w-full max-w-md rounded-2xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Why Choose Our Business Loan?
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Designed specifically for growing businesses and entrepreneurs
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div 
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: `${feature.color}15` }}
                    >
                      <Icon className="w-8 h-8" style={{ color: feature.color }} />
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Loan Purposes */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              What Can You Use Business Loans For?
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Flexible usage for all your legitimate business needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {loanPurposes.map((purpose, index) => (
              <Card key={index} className="text-center hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: '#00C49A' }} />
                  <p className="text-sm font-medium" style={{ color: '#1E2A3B' }}>{purpose}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility Criteria */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Business Loan Eligibility
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Check if your business meets our requirements
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criteria</TableHead>
                      <TableHead>Requirement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibilityData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.criteria}</TableCell>
                        <TableCell>{row.requirement}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Interest Rates & Charges */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Interest Rates & Charges
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Competitive and transparent pricing structure
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Particular</TableHead>
                      <TableHead>Charges</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ratesAndCharges.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.particular}</TableCell>
                        <TableCell>
                          <span className="font-semibold" style={{ color: '#0052FF' }}>
                            {row.charges}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600">{row.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Required Documents */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Required Documents
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Keep these documents ready for quick processing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {requiredDocuments.map((category, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" style={{ color: '#0052FF' }} />
                    {category.type}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.documents.map((doc, docIndex) => (
                      <li key={docIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* EMI Calculator */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
                Business Loan EMI Calculator
              </h2>
              <p className="text-lg" style={{ color: '#1E2A3B' }}>
                Plan your business finances with our EMI calculator
              </p>
            </div>
            <Card>
              <CardContent className="p-6 md:p-8">
                <EMICalculator />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Frequently Asked Questions
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Common queries about business loans answered
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Collapsible key={index} open={openFaq === index} onOpenChange={(open) => setOpenFaq(open ? index : null)}>
                <CollapsibleTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-left" style={{ color: '#1E2A3B' }}>
                          {faq.question}
                        </h3>
                        {openFaq === index ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="mt-2">
                    <CardContent className="p-4 pt-0">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => navigate('/application')}
          size="lg"
          style={{ backgroundColor: '#00C49A' }}
          className="text-white hover:opacity-90 shadow-lg"
        >
          Apply Now
        </Button>
      </div>

      {/* Final CTA Section */}
      <section className="py-16" style={{ backgroundColor: '#0052FF' }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
            Ready to Grow Your Business?
          </h2>
          <p className="text-lg mb-8 text-blue-100">
            Get the funding you need to take your business to the next level
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/application')}
            style={{ backgroundColor: '#00C49A' }}
            className="text-white hover:opacity-90 px-8 py-3"
          >
            Apply for Business Loan
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}