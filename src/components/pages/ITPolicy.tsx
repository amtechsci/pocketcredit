import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Shield, Lock, Database, AlertTriangle, CheckCircle, Key, Users, Monitor, ExternalLink, Download, HelpCircle, Clock, FileText, CreditCard, Smartphone, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';




export function ITPolicy() {
    const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Shield className="w-16 h-16 mx-auto mb-6" style={{ color: '#0052FF' }} />
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              We Are Fully Dedicated To <span style={{ color: '#0052FF' }}>Support You</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Your trusted financial partner for quick and easy loans
            </p>
          </div>

          {/* How it works Section */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl mb-4" style={{ color: '#1E2A3B' }}>
                How it works?
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0052FF' }}>
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>Simple Registration</h3>
                <p className="text-gray-600">Quick and easy registration process</p>
              </Card>
              
              <Card className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00C49A' }}>
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>Quick verification</h3>
                <p className="text-gray-600">Fast verification of your documents</p>
              </Card>
              
              <Card className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF6B35' }}>
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>Instant Fund Transfer</h3>
                <p className="text-gray-600">Get your money transferred instantly</p>
              </Card>
            </div>
          </div>

          {/* Our Loans Section */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl mb-4" style={{ color: '#1E2A3B' }}>
                Our Loans
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0052FF' }}>
                      <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold" style={{ color: '#1E2A3B' }}>100% online</h3>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00C49A' }}>
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold" style={{ color: '#1E2A3B' }}>Minimum Documentation</h3>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF6B35' }}>
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold" style={{ color: '#1E2A3B' }}>Disbursal in 30 minutes</h3>
                  </div>
                  
                  <Button 
                    size="lg" 
                    className="w-full mt-6"
                    style={{ backgroundColor: '#0052FF' }}
                    onClick={() => navigate('/loan-application')}
                  >
                    Apply Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </Card>
              
              <Card className="p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0F4F8' }}>
                    <CreditCard className="w-16 h-16" style={{ color: '#0052FF' }} />
                  </div>
                  <p className="text-gray-600">Image placeholder for loan illustration</p>
                </div>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl mb-4" style={{ color: '#1E2A3B' }}>
                FAQ
              </h2>
              <p className="text-lg" style={{ color: '#1E2A3B' }}>
                Need Help? Read Popular Questions
              </p>
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <HelpCircle className="w-6 h-6 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                        What is the eligibility to apply for loan?
                      </h3>
                      <p className="text-gray-700">
                        A person with monthly net income of Rs.25,000<br />
                        • Applying from Any city in India.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <HelpCircle className="w-6 h-6 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                        What is the maximum loan amount I am eligible for?
                      </h3>
                      <p className="text-gray-700">
                        Loan amount eligibility depends on your income, credit score, and other factors. 
                        Our system will calculate your maximum eligible amount during the application process.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <HelpCircle className="w-6 h-6 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                        What are the steps involved to get a loan?
                      </h3>
                      <p className="text-gray-700">
                        1. Simple Registration<br />
                        2. Quick verification<br />
                        3. Instant Fund Transfer<br />
                        The entire process is 100% online with minimum documentation.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <HelpCircle className="w-6 h-6 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                        How much time does it take to get money in the account?
                      </h3>
                      <p className="text-gray-700">
                        Once your application is approved, we disburse the loan amount within 30 minutes 
                        directly to your bank account.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="text-center space-y-4 mt-12">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => navigate('/loan-application')}
                  style={{ backgroundColor: '#0052FF' }}
                  size="lg"
                >
                  Apply for Loan Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/contact')}
                  size="lg"
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