import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { CheckCircle, AlertCircle, TrendingUp, Shield, Clock, Star } from 'lucide-react';




export function CreditScorePage() {
    const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showScore, setShowScore] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckScore = async () => {
    if (phoneNumber.length !== 10) return;
    
    setIsChecking(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsChecking(false);
    setShowScore(true);
  };

  const creditScore = 750;
  const getScoreColor = (score: number) => {
    if (score >= 750) return '#00C49A';
    if (score >= 650) return '#FFA500';
    return '#FF6B6B';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    return 'Needs Improvement';
  };

  const factors = [
    { title: 'Payment History', impact: 'High', status: 'good', description: 'No missed payments in last 12 months' },
    { title: 'Credit Utilization', impact: 'High', status: 'excellent', description: '22% utilization - Keep below 30%' },
    { title: 'Credit Age', impact: 'Medium', status: 'good', description: 'Average age of 3.2 years' },
    { title: 'Credit Mix', impact: 'Low', status: 'fair', description: 'Consider diversifying credit types' },
    { title: 'Recent Inquiries', impact: 'Low', status: 'excellent', description: 'Only 1 inquiry in last 6 months' }
  ];

  const recommendations = [
    'Continue making all payments on time',
    'Keep credit utilization below 30%',
    'Avoid closing old credit accounts',
    'Consider a secured credit card to build history'
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Check Your <span style={{ color: '#0052FF' }}>Credit Score</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Get your free credit score instantly and understand factors affecting your creditworthiness
            </p>
          </div>

          {!showScore ? (
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <CardTitle>Get Your Free Credit Score</CardTitle>
                <CardDescription>
                  Enter your mobile number to get instant access to your credit score
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="phone">Mobile Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your 10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                  />
                </div>
                <Button 
                  onClick={handleCheckScore}
                  disabled={phoneNumber.length !== 10 || isChecking}
                  className="w-full"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  {isChecking ? 'Checking...' : 'Check Credit Score'}
                </Button>
                <div className="text-xs text-center text-gray-500">
                  <Shield className="inline w-3 h-3 mr-1" />
                  100% Safe & Secure. No impact on credit score.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Credit Score Display */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 mb-4"
                         style={{ borderColor: getScoreColor(creditScore) }}>
                      <div className="text-center">
                        <div className="text-3xl font-bold" style={{ color: getScoreColor(creditScore) }}>
                          {creditScore}
                        </div>
                        <div className="text-sm text-gray-600">Credit Score</div>
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="text-white text-sm"
                      style={{ backgroundColor: getScoreColor(creditScore) }}
                    >
                      {getScoreLabel(creditScore)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-600">Range</div>
                      <div className="font-semibold">300-850</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Last Updated</div>
                      <div className="font-semibold">Today</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Credit Age</div>
                      <div className="font-semibold">3.2 Years</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Accounts</div>
                      <div className="font-semibold">7 Active</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Score Factors */}
              <Card>
                <CardHeader>
                  <CardTitle>Factors Affecting Your Score</CardTitle>
                  <CardDescription>
                    Understand what impacts your credit score the most
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {factors.map((factor, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {factor.status === 'excellent' && <CheckCircle className="w-5 h-5 text-green-500" />}
                          {factor.status === 'good' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                          {factor.status === 'fair' && <AlertCircle className="w-5 h-5 text-orange-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium">{factor.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {factor.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{factor.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" style={{ color: '#00C49A' }} />
                    Recommendations to Improve
                  </CardTitle>
                  <CardDescription>
                    Follow these tips to maintain or improve your credit score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Star className="w-4 h-4 mt-0.5 text-yellow-500" />
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* CTA Section */}
              <Card className="text-center">
                <CardContent className="pt-6">
                  <h3 className="text-xl mb-2">Ready to Apply for a Loan?</h3>
                  <p className="text-gray-600 mb-4">
                    With your excellent credit score, you qualify for our best interest rates
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button 
                      onClick={() => navigate('/personal-loan')}
                      style={{ backgroundColor: '#0052FF' }}
                    >
                      Personal Loan
                    </Button>
                    <Button 
                      onClick={() => navigate('/business-loan')}
                      style={{ backgroundColor: '#00C49A' }}
                    >
                      Business Loan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trust Indicators */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
              <h4 className="font-medium">100% Secure</h4>
              <p className="text-sm text-gray-600">Bank-grade security</p>
            </div>
            <div>
              <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
              <h4 className="font-medium">Instant Results</h4>
              <p className="text-sm text-gray-600">Get score in seconds</p>
            </div>
            <div>
              <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
              <h4 className="font-medium">No Credit Impact</h4>
              <p className="text-sm text-gray-600">Soft inquiry only</p>
            </div>
            <div>
              <Star className="w-8 h-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
              <h4 className="font-medium">Always Free</h4>
              <p className="text-sm text-gray-600">No hidden charges</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}