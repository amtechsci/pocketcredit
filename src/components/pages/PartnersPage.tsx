import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Building, Users, CheckCircle, TrendingUp, Shield, Phone, Mail, MapPin, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';



export function PartnersPage() {
    const navigate = useNavigate();
  // Actual partners from the policy document
  const activePartners = [
    {
      name: "Shivtel Communications private limited",
      category: "Communication Service - Outbound Dialing",
      status: "Active",
      description: "Professional outbound dialing and communication services for customer engagement and support operations.",
      services: ["Outbound Dialing", "Customer Communication", "Support Services"],
      partnership: "Current Active Partner"
    }
  ];

  const inactivePartners = [
    {
      name: "Finwings Technologies pvt ltd",
      category: "Collection and Recoveries",
      status: "Inactive",
      description: "Previously provided collection and recovery services for loan management operations.",
      services: ["Collection Services", "Recovery Operations", "Debt Management"],
      partnership: "Previous Partner"
    }
  ];

  const potentialPartnerTypes = [
    {
      category: "Technology Partners",
      description: "Digital platform and infrastructure providers",
      icon: TrendingUp,
      color: "blue"
    },
    {
      category: "Payment Partners",
      description: "Payment gateway and processing services",
      icon: Shield,
      color: "green"
    },
    {
      category: "Verification Partners",
      description: "KYC and document verification services",
      icon: CheckCircle,
      color: "purple"
    },
    {
      category: "Credit Bureau Partners",
      description: "Credit scoring and bureau services",
      icon: Building,
      color: "orange"
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#1E2A3B' }}>
        <div className="max-w-6xl mx-auto text-center">
          <Users className="w-16 h-16 mx-auto mb-6 text-white" />
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            Our Partners & Service Providers
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Strategic partnerships with leading service providers to enhance our lending platform capabilities
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl text-white">1</div>
              <div className="text-gray-300">Active Partner</div>
            </div>
            <div>
              <div className="text-3xl text-white">100%</div>
              <div className="text-gray-300">Service Uptime</div>
            </div>
            <div>
              <div className="text-3xl text-white">24/7</div>
              <div className="text-gray-300">Support Coverage</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Company Information */}
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Spheeti Fintech Private Limited
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              List of Third-Party Service Providers (LSPs) engaged for various operational activities
            </p>
            <div className="max-w-2xl mx-auto p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Corporate Address:</strong> Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India - 421001
              </p>
            </div>
          </div>

          {/* Active Partners */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-6 h-6" style={{ color: '#0052FF' }} />
              <h2 className="text-2xl" style={{ color: '#1E2A3B' }}>Active Service Partners</h2>
            </div>
            
            <div className="grid gap-6">
              {activePartners.map((partner, index) => (
                <Card key={index} className="border-green-200 bg-green-50">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl" style={{ color: '#1E2A3B' }}>
                          {partner.name}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{partner.category}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {partner.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">
                      {partner.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>Services Provided:</h4>
                        <div className="flex flex-wrap gap-2">
                          {partner.services.map((service, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>Partnership Status:</h4>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{partner.partnership}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Inactive Partners */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl" style={{ color: '#1E2A3B' }}>Previous Service Partners</h2>
            </div>
            
            <div className="grid gap-6">
              {inactivePartners.map((partner, index) => (
                <Card key={index} className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl" style={{ color: '#1E2A3B' }}>
                          {partner.name}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{partner.category}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {partner.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">
                      {partner.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>Services Previously Provided:</h4>
                        <div className="flex flex-wrap gap-2">
                          {partner.services.map((service, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>Partnership Status:</h4>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{partner.partnership}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Partner Categories */}
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl mb-4" style={{ color: '#1E2A3B' }}>
                Partnership Categories
              </h2>
              <p className="text-gray-600">
                We collaborate with various types of service providers to ensure comprehensive service delivery
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {potentialPartnerTypes.map((type, index) => {
                const Icon = type.icon;
                const colorClasses = {
                  blue: 'bg-blue-50 text-blue-700 border-blue-200',
                  green: 'bg-green-50 text-green-700 border-green-200',
                  purple: 'bg-purple-50 text-purple-700 border-purple-200',
                  orange: 'bg-orange-50 text-orange-700 border-orange-200'
                };
                
                return (
                  <Card key={index} className={`border ${colorClasses[type.color as keyof typeof colorClasses]}`}>
                    <CardContent className="p-6 text-center">
                      <Icon className="w-8 h-8 mx-auto mb-3" style={{ color: type.color === 'blue' ? '#0052FF' : undefined }} />
                      <h3 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>
                        {type.category}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {type.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Partnership Standards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Partnership Standards & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3" style={{ color: '#1E2A3B' }}>Selection Criteria:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Regulatory compliance and certifications</li>
                    <li>• Proven track record and reliability</li>
                    <li>• Data security and privacy standards</li>
                    <li>• Service quality and performance metrics</li>
                    <li>• Cost-effectiveness and scalability</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-3" style={{ color: '#1E2A3B' }}>Monitoring & Review:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Regular performance evaluations</li>
                    <li>• Compliance audits and assessments</li>
                    <li>• Service level agreement monitoring</li>
                    <li>• Risk management and mitigation</li>
                    <li>• Continuous improvement initiatives</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Partner Relations Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                For partnership inquiries and vendor relations:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5" style={{ color: '#0052FF' }} />
                    <div>
                      <div className="font-medium" style={{ color: '#1E2A3B' }}>General Support</div>
                      <div className="text-sm text-gray-600">support@creditlab.in</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5" style={{ color: '#0052FF' }} />
                    <div>
                      <div className="font-medium" style={{ color: '#1E2A3B' }}>Customer Care</div>
                      <div className="text-sm text-gray-600">+91 9346551691</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <div className="font-medium" style={{ color: '#1E2A3B' }}>Corporate Office</div>
                      <div className="text-sm text-gray-600">
                        Mahadev Compound Gala No. A7, Dhobi Ghat Road<br />
                        Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI<br />
                        Maharashtra, India - 421001
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/contact')}
                style={{ backgroundColor: '#0052FF' }}
              >
                Partnership Inquiry
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/about')}
              >
                Learn More About Us
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
      </section>
    </div>
  );
}