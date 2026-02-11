import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';




export function ContactPage() {
  const navigate = useNavigate();

  const offices = [
    {
      city: 'Mumbai',
      address: 'Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar, MUMBAI, Maharashtra, India - 421001',
      phone: '+91 22 1234 5678',
      email: 'support@pocketcredit.in'
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Get in <span style={{ color: '#0052FF' }}>Touch</span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Our loan experts are here to help you with any questions about your loan application
            </p>
          </div>

          {/* Office Locations and Business Hours */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Our Offices
                  </CardTitle>
                  <CardDescription>
                    Visit us at any of our branch locations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {offices.map((office, index) => (
                    <div key={index} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{office.city}</h4>
                        <Badge variant="outline" className="text-xs">Branch</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{office.address}</p>
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {office.phone}
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {office.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Business Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Business Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Monday - Friday</span>
                      <span className="font-medium">9:00 AM - 8:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday</span>
                      <span className="font-medium">9:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday</span>
                      <span className="text-gray-500">Closed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Email Support */}
         

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <Card>
              <CardContent className="pt-8 pb-8">
                <h2 className="text-2xl mb-4" style={{ color: '#1E2A3B' }}>
                  Ready to Apply for a Loan?
                </h2>
                <p className="text-gray-600 mb-6">
                  Start your loan application today and get instant approval
                </p>
                <Button 
                  onClick={() => navigate('/application')}
                  size="lg"
                  style={{ backgroundColor: '#00C49A' }}
                >
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}