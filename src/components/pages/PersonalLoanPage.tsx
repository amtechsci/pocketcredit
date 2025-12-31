import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, FileText, Clock, Shield, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { EMICalculator } from '../EMICalculator';
import { ImageWithFallback } from '../figma/ImageWithFallback';




export function PersonalLoanPage() {
    const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Clock,
      title: '100% Digital Process',
      description: 'Complete application online without visiting any branch',
      color: '#0052FF'
    },
    {
      icon: Shield,
      title: 'No Collateral Required',
      description: 'Unsecured loans based on your income and credit profile',
      color: '#06B6D4'
    },
    {
      icon: CheckCircle,
      title: 'Quick Disbursal',
      description: 'Get money in your account within 15 min of approval',
      color: '#FFD700'
    },
    {
      icon: Calculator,
      title: 'Flexible Repayment',
      description: 'Choose tenure from 6 months to 5 years as per your convenience',
      color: '#FF6B6B'
    }
  ];

  const eligibilityData = [
    {
      criteria: 'Age',
      salaried: '18 to 45 years',
      selfEmployed: '18 to 45 years'
    },
    {
      criteria: 'Min. Monthly Income',
      salaried: '₹15,000',
      selfEmployed: '₹15,000'
    },
    {
      criteria: 'Min. CIBIL Score',
      salaried: 'Not Required',
      selfEmployed: 'Not Required'
    },
    {
      criteria: 'Residence',
      salaried: 'Indian Resident',
      selfEmployed: 'Indian Resident'
    }
  ];

  const ratesAndCharges = [
    {
      particular: 'Interest Rate',
      charges: 'Starting at 14% - 36% p.a.',
      description: 'Fixed'
    },
    {
      particular: 'Processing Fee',
      charges: 'Up to 14% of loan amount',
      description: 'Min. ₹999, Max. ₹5,999'
    }
  ];

  const requiredDocuments = [
    { type: 'Identity Proof', documents: ['PAN Card (Mandatory)'] },
    { type: 'Address Proof', documents: ['Aadhaar Card'] },
    { type: 'Income Proof (Salaried)', documents: ['Bank statements (6 months)'] },
    { type: 'Income Proof (Self-Employed)', documents: ['Bank statements (12 months)'] }
  ];

  const faqs = [
    {
      question: 'What is the maximum loan amount I can avail?',
      answer: 'You can apply for a loan of up to ₹3,00,000 with Pocket Credit. The sanctioned amount and tenure depend on a credit assessment. We also support borrowers with low or limited credit history to promote financial inclusion.'
    },
    {
      question: 'What repayment tenure options are available?',
      answer: 'We offer flexible repayment tenures of up to 195 days. You may choose between a single-term repayment or EMI-based loan options.'
    },
    {
      question: 'Who can apply for a loan?',
      answer: 'Any Indian citizen aged 18 years or above is eligible to apply.'
    },
    {
      question: 'Is a credit score mandatory to get a loan?',
      answer: 'A credit score is not mandatory. First-time borrowers or individuals with no credit history can still avail loans. However, a higher credit score may help you get better pricing and higher loan limits.'
    },
    {
      question: 'Are there any hidden charges?',
      answer: 'No. We follow a transparent pricing policy. All applicable charges, including interest, processing fees, and other costs, are clearly disclosed upfront.'
    },
    {
      question: 'Can I repay my loan before the due date?',
      answer: 'Yes, you can prepay your loan at any time without any prepayment charges.'
    },
    {
      question: 'What are the consequences of missing a payment?',
      answer: 'Late or missed payments may attract overdue penalties and can negatively impact your credit score, which may affect your ability to obtain loans in the future.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-green-50"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%230052FF%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
        
        <div className="relative container mx-auto mobile-container py-12 sm:py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[70vh] lg:min-h-[80vh]">
            
            {/* Content */}
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left order-2 lg:order-1">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-100 shadow-sm">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">RBI Registered NBFC Platform</span>
              </div>
              
              {/* Main Headline */}
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight" style={{ color: '#1E2A3B' }}>
                  Get{' '}
                  <span className="relative">
                    <span style={{ color: '#0052FF' }}>Personal Loans</span>
                    <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 100 12" fill="none">
                      <path d="M2 10c20-3 40-6 60-8s20-1 36 2" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" fill="none"/>
                    </svg>
                  </span>
                  {' '}up to{' '}
                  <span style={{ color: '#0052FF' }}>₹3 Lakhs</span>
                </h1>
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  <span className="font-semibold" style={{ color: '#06B6D4' }}>Quick approval in minutes</span>, 
                  no collateral required, and money in your account within 15 min.
                </p>
              </div>

              {/* Key Benefits */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 py-4">
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#0052FF' }}>₹3L</div>
                  <div className="text-xs sm:text-sm text-gray-600">Max Amount</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#06B6D4' }}>14%-36%</div>
                  <div className="text-xs sm:text-sm text-gray-600">Starting Rate</div>
                </div>
                <div className="text-center lg:text-left col-span-2 sm:col-span-1">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#0052FF' }}>15 min</div>
                  <div className="text-xs sm:text-sm text-gray-600">Disbursal</div>
                </div>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-200">
                  <CheckCircle className="w-4 h-4" style={{ color: '#06B6D4' }} />
                  <span className="text-sm font-medium">No Collateral</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-200">
                  <Clock className="w-4 h-4" style={{ color: '#0052FF' }} />
                  <span className="text-sm font-medium">Instant Approval</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-200">
                  <FileText className="w-4 h-4" style={{ color: '#FFD700' }} />
                  <span className="text-sm font-medium">Minimal Docs</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-4 sm:space-y-0 sm:flex sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg"
                  onClick={() => navigate('/application')}
                  className="flex-1 sm:flex-none text-white hover:opacity-90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  Apply Now - Get Instant Approval
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="flex-1 sm:flex-none border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-4 text-lg font-semibold"
                >
                  Check Eligibility
                </Button>
              </div>

              {/* Trust Indicator */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1">
                    <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: '#06B6D4' }}>
                      <span className="text-xs text-white">✓</span>
                    </div>
                    <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-xs text-white">✓</span>
                    </div>
                    <div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-xs text-white">✓</span>
                    </div>
                  </div>
                  <span className="font-medium">50,000+ happy customers</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => <span key={i}>★</span>)}
                  </div>
                  <span className="font-medium">4.8/5 rating</span>
                </div>
              </div>
            </div>
            
            {/* Hero Image */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
              <div className="relative">
                {/* Background decoration */}
                <div className="absolute -top-4 -right-4 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-green-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-4 -left-4 w-60 h-60 bg-gradient-to-br from-green-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
                
                {/* Main image */}
                <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-3xl p-6 shadow-2xl">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1659355893994-bddb1ba8e3a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGluZGlhbiUyMHByb2Zlc3Npb25hbCUyMGZpbmFuY2UlMjBzdWNjZXNzJTIwc21hcnRwaG9uZXxlbnwxfHx8fDE3NTcyMzY0MjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Happy customer with approved personal loan"
                    className="w-full max-w-sm sm:max-w-md lg:max-w-lg rounded-2xl shadow-lg"
                  />
                  
                  {/* Floating success card */}
                  <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Loan Approved!</div>
                        <div className="text-xs text-gray-600">₹3,00,000 disbursed</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating rate card */}
                  <div className="absolute -top-4 -left-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl p-3 shadow-xl">
                    <div className="text-center">
                      <div className="text-lg font-bold">14%</div>
                      <div className="text-xs opacity-90">Interest Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Process Steps Banner */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200">
          <div className="container mx-auto mobile-container py-4">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <span className="font-medium">Apply Online</span>
              </div>
              <div className="hidden sm:block w-8 h-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">2</span>
                </div>
                <span className="font-medium">Get Instant Approval</span>
              </div>
              <div className="hidden sm:block w-8 h-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">3</span>
                </div>
                <span className="font-medium">Upload Documents</span>
              </div>
              <div className="hidden sm:block w-8 h-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-semibold">4</span>
                </div>
                <span className="font-medium">Get Money in 24hrs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Why Choose Our Personal Loan?
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Experience the easiest and fastest way to get a personal loan
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

      {/* Eligibility Criteria */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Eligibility Criteria
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Simple and transparent eligibility requirements
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criteria</TableHead>
                      <TableHead>Salaried</TableHead>
                      <TableHead>Self-Employed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibilityData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.criteria}</TableCell>
                        <TableCell>{row.salaried}</TableCell>
                        <TableCell>{row.selfEmployed}</TableCell>
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
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Interest Rates & Charges
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Transparent pricing with no hidden costs
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
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Required Documents
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Minimal documentation for quick processing
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
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
                Personal Loan EMI Calculator
              </h2>
              <p className="text-lg" style={{ color: '#1E2A3B' }}>
                Plan your finances with our interactive EMI calculator
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
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Frequently Asked Questions
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Get answers to common queries about personal loans
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
            Ready to Get Your Personal Loan?
          </h2>
          <p className="text-lg mb-8 text-blue-100">
            Join thousands of satisfied customers who got instant approval
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/application')}
            style={{ backgroundColor: '#00C49A' }}
            className="text-white hover:opacity-90 px-8 py-3"
          >
            Apply for Personal Loan
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}