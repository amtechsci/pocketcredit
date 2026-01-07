import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Clock, Award, Star, CheckCircle, CreditCard, Building, Smartphone, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { EligibilityChecker } from '../EligibilityChecker';
import { EMICalculator } from '../EMICalculator';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export function HomePage() {
  const navigate = useNavigate();
  const [activeCalculator, setActiveCalculator] = useState<'eligibility' | 'emi'>('eligibility');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  // Show floating button after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingButton(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const trustMetrics = [
    { icon: Users, label: '50k+ Satisfied Users', color: '#00C49A' },
    { icon: Star, label: '4.5+ Star Rating', color: '#FFD700' },
    { icon: Shield, label: 'RBI registered NBFC (with Reg. No: N-13.02361)', color: '#0052FF' },
  ];

  const howItWorksSteps = [
    {
      step: 1,
      title: 'Check Eligibility',
      description: 'Get instant approval in seconds',
      icon: CheckCircle,
    },
    {
      step: 2,
      title: 'Complete KYC & Upload Documents',
      description: 'Secure document verification',
      icon: Shield,
    },
    {
      step: 3,
      title: 'Accept Final Offer',
      description: 'Review and accept loan terms',
      icon: Award,
    },
    {
      step: 4,
      title: 'Get Money in Your Account',
      description: 'Instant disbursal to your account',
      icon: CreditCard,
    },
  ];

  const loanProducts = [
    {
      title: 'Personal Loan',
      description: 'Quick personal loans up to ₹3 lakhs with minimal documentation',
      features: ['No collateral required', 'Instant approval', 'Flexible tenure'],
      amount: 'Up to ₹3 Lakhs',
      interest: 'Starting at 14% - 36% p.a.',
      path: '/personal-loan',
      image: 'https://images.unsplash.com/flagged/photo-1570607008863-da87b9deefa7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBpbmRpYW4lMjB3b21hbiUyMHNtYXJ0cGhvbmUlMjBmaW5hbmNlfGVufDF8fHx8MTc1NzE3MzA4MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    },
    {
      title: 'Business Loan',
      description: 'Grow your business with loans up to ₹50 lakhs at competitive rates',
      features: ['Quick processing', 'Competitive rates', 'Flexible repayment'],
      amount: 'Up to ₹50 Lakhs',
      interest: 'Starting at 12% p.a.',
      path: '/business-loan',
      image: 'https://images.unsplash.com/photo-1659353221012-4b03d33347d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMGluZGlhbiUyMGVudHJlcHJlbmV1cnxlbnwxfHx8fDE3NTcxNzMwNzd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    }
  ];

  const testimonials = [
    {
      name: 'Priya Sharma',
      role: 'Software Engineer',
      image: 'https://images.unsplash.com/flagged/photo-1570607008863-da87b9deefa7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBpbmRpYW4lMjB3b21hbiUyMHNtYXJ0cGhvbmUlMjBmaW5hbmNlfGVufDF8fHx8MTc1NzE3MzA4MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      quote: 'Got my loan approved in just 15 minutes! The process was incredibly smooth and transparent.',
      rating: 5
    },
    {
      name: 'Rajesh Kumar',
      role: 'Small Business Owner',
      image: 'https://images.unsplash.com/photo-1659353221012-4b03d33347d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMGluZGlhbiUyMGVudHJlcHJlbmV1cnxlbnwxfHx8fDE3NTcxNzMwNzd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      quote: 'Pocket Credit helped me expand my business with a competitive business loan. Highly recommended!',
      rating: 5
    },
    {
      name: 'Anita Patel',
      role: 'Teacher',
      image: 'https://images.unsplash.com/photo-1659352790654-058e9077a4f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGluZGlhbiUyMGZhbWlseSUyMGZpbmFuY2lhbCUyMHN1Y2Nlc3N8ZW58MXx8fHwxNzU3MTczMDcyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      quote: 'No hidden charges, clear terms, and excellent customer support. Thank you Pocket Credit!',
      rating: 5
    }
  ];

  const faqs = [
    {
      question: 'What is the maximum loan amount I can get?',
      answer: 'You can get a loan up to ₹3,00,000.'
    },
    {
      question: 'What is the loan tenure?',
      answer: 'The loan tenure is up to 195 days. You can choose between single-term or EMI-based repayment.'
    },
    {
      question: 'Who is eligible for a loan?',
      answer: 'Indian citizens aged 18 years and above are eligible to apply for a loan.'
    },
    {
      question: 'Is credit score mandatory?',
      answer: 'No, credit score is not mandatory. First-time borrowers are welcome to apply.'
    },
    {
      question: 'Are there any hidden charges?',
      answer: 'No, we believe in transparent pricing with no hidden charges. All fees and charges are clearly communicated upfront.'
    },
    {
      question: 'Can I prepay my loan?',
      answer: 'Yes, prepayment is allowed anytime without any charges.'
    },
    {
      question: 'What happens if I miss a payment?',
      answer: 'Late penalties will apply on missed payments and it may impact your credit score.'
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
                <span className="text-sm font-medium text-blue-700">Welcome to "PocketCredit" a product of Spheeti Fintech Pvt. Ltd., an RBI-registered NBFC.</span>
              </div>
              
              {/* Main Headline */}
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight" style={{ color: '#1E2A3B' }}>
                  Get{' '}
                  <span className="relative">
                    <span style={{ color: '#0052FF' }}>Instant Loans</span>
                    <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 100 12" fill="none">
                      <path d="M2 10c20-3 40-6 60-8s20-1 36 2" stroke="#00C49A" strokeWidth="3" strokeLinecap="round" fill="none"/>
                    </svg>
                  </span>
                  {' '}up to{' '}
                  <span style={{ color: '#0052FF' }}>₹3 Lakhs</span>
                </h1>
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  <span className="font-semibold text-green-600">2-minute approval</span>, 
                  zero paperwork, and money in your account within 15 min.
                </p>
              </div>

              {/* Key Benefits */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 py-4">
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#0052FF' }}>15 min</div>
                  <div className="text-xs sm:text-sm text-gray-600">Disbursal time</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#00C49A' }}>100%</div>
                  <div className="text-xs sm:text-sm text-gray-600">digital</div>
                </div>
                <div className="text-center lg:text-left col-span-2 sm:col-span-1">
                  <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: '#0052FF' }}>Best</div>
                  <div className="text-xs sm:text-sm text-gray-600">interest rates & no collateral</div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-4 sm:space-y-0 sm:flex sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg"
                  onClick={() => navigate('/application')}
                  style={{ backgroundColor: '#0052FF' }}
                  className="text-white hover:opacity-90 btn-mobile touch-manipulation w-full sm:w-auto text-base sm:text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Apply Now - Get ₹3L
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              {/* Small Print */}
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                *Subject to eligibility criteria. Processing fee and other charges may apply. 
                Loans are provided by our RBI registered NBFC platform.
              </p>
            </div>

            {/* Hero Image */}
            <div className="relative order-1 lg:order-2">
              <div className="relative max-w-md mx-auto lg:max-w-lg xl:max-w-xl">
                {/* Background Decorative Elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 bg-blue-100 rounded-full opacity-20"></div>
                <div className="absolute -bottom-4 -left-4 w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full opacity-30"></div>
                
                {/* Main Image */}
                <div className="relative bg-white rounded-3xl shadow-2xl p-4 sm:p-6">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1659352790654-058e9077a4f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGluZGlhbiUyMGZhbWlseSUyMGZpbmFuY2lhbCUyMHN1Y2Nlc3MlMjBtb2JpbGUlMjBhcHB8ZW58MXx8fHwxNzU3MjMzNDk3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Happy Indian family using financial app"
                    className="w-full h-auto rounded-2xl"
                  />
                  
                  {/* Floating Stats Cards */}
                  <div className="absolute -top-2 -left-2 sm:-top-4 sm:-left-4 bg-white rounded-lg shadow-lg p-3 sm:p-4 border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-green-600">₹3 lakh</div>
                        <div className="text-xs text-gray-500">Approved</div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute -bottom-2 -right-2 sm:-bottom-4 sm:-right-4 bg-white rounded-lg shadow-lg p-3 sm:p-4 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-blue-600">2 min</div>
                        <div className="text-xs text-gray-500">Approval</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phone Mockup Overlay */}
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8 w-16 h-28 sm:w-20 sm:h-36 bg-white rounded-lg shadow-xl border-2 border-gray-200">
                  <div className="p-1 sm:p-2 h-full">
                    <div className="w-full h-full bg-gradient-to-b from-blue-50 to-green-50 rounded-md flex flex-col items-center justify-center">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mb-2" style={{ backgroundColor: '#00C49A' }}>
                        <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-white m-auto mt-2 sm:mt-2.5" />
                      </div>
                      <div className="text-xs font-bold" style={{ color: '#0052FF' }}>Pocket</div>
                      <div className="text-xs font-bold" style={{ color: '#00C49A' }}>Credit</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tools */}
      <section className="py-8 sm:py-12" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto mobile-container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="mobile-text-xl sm:text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
                Check Your Eligibility & Calculate EMI
              </h2>
              <div className="flex justify-center">
                <div className="bg-white rounded-lg p-1 shadow-sm w-full max-w-md">
                  <button
                    onClick={() => setActiveCalculator('eligibility')}
                    className={`px-3 sm:px-6 py-2 sm:py-3 rounded-md font-medium transition-all touch-manipulation flex-1 w-1/2 ${
                      activeCalculator === 'eligibility'
                        ? 'text-white shadow-sm'
                        : 'text-gray-600'
                    }`}
                    style={{ 
                      backgroundColor: activeCalculator === 'eligibility' ? '#0052FF' : 'transparent'
                    }}
                  >
                    <span className="text-xs sm:text-sm md:text-base">Eligibility</span>
                  </button>
                  <button
                    onClick={() => setActiveCalculator('emi')}
                    className={`px-3 sm:px-6 py-2 sm:py-3 rounded-md font-medium transition-all touch-manipulation flex-1 w-1/2 ${
                      activeCalculator === 'emi'
                        ? 'text-white shadow-sm'
                        : 'text-gray-600'
                    }`}
                    style={{ 
                      backgroundColor: activeCalculator === 'emi' ? '#0052FF' : 'transparent'
                    }}
                  >
                    <span className="text-xs sm:text-sm md:text-base">EMI Calculator</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg mobile-card-padding">
              {activeCalculator === 'eligibility' ? (
                <EligibilityChecker onApply={() => navigate('/application')} />
              ) : (
                <EMICalculator />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 sm:py-12 bg-white border-t border-b">
        <div className="container mx-auto mobile-container">
          <div className="text-center mb-6 sm:mb-8">
            <h3 className="text-xl font-semibold mb-4" style={{ color: '#1E2A3B' }}>
              Trusted Financial Platform
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {trustMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div key={index} className="text-center">
                  <div 
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: `${metric.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: metric.color }} />
                  </div>
                  <p className="font-semibold" style={{ color: '#1E2A3B' }}>{metric.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              How It Works
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Get your loan in 4 simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorksSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="text-center">
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center relative"
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    <Icon className="w-8 h-8 text-white" />
                    <div 
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: '#00C49A' }}
                    >
                      {step.step}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: '#1E2A3B' }}>{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product Previews */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Our Loan Products
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Choose the right loan for your needs
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {loanProducts.map((product) => (
              <Card key={product.title} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-48 relative">
                  <ImageWithFallback 
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle style={{ color: '#1E2A3B' }}>{product.title}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Loan Amount</p>
                      <p className="font-semibold" style={{ color: '#0052FF' }}>{product.amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Interest Rate</p>
                      <p className="font-semibold" style={{ color: '#00C49A' }}>{product.interest}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {product.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4" style={{ color: '#00C49A' }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => navigate(product.path)}
                    className="w-full"
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    Learn More
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              What Our Customers Say
            </h2>
            <p className="text-lg" style={{ color: '#1E2A3B' }}>
              Trusted by thousands of satisfied customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm mb-4 leading-relaxed" style={{ color: '#1E2A3B' }}>
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <ImageWithFallback 
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1E2A3B' }}>
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-gray-600">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
              Get answers to common queries about our loans
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
                          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-4" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-4" />
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

      {/* CTA Section */}
      <section className="py-16" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
            Ready to Get Your Loan?
          </h2>
          <p className="text-lg mb-8" style={{ color: '#1E2A3B' }}>
            Join thousands of satisfied customers who got their loans instantly
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/application')}
            style={{ backgroundColor: '#0052FF' }}
            className="text-white hover:opacity-90 px-8 py-3"
          >
            Apply for Loan Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Floating Apply Now Button */}
      {showFloatingButton && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button
            size="lg"
            onClick={() => navigate('/application')}
            style={{ backgroundColor: '#0052FF' }}
            className="text-white hover:opacity-90 shadow-2xl rounded-full px-6 py-6 h-auto flex items-center gap-2 text-base sm:text-lg font-semibold hover:scale-105 transition-all duration-300"
          >
            <span className="hidden sm:inline">Apply Now</span>
            <span className="sm:hidden">Apply</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}