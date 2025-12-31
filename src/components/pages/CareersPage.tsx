import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapPin, Clock, Users, Mail, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';



export function CareersPage() {
    const navigate = useNavigate();
  const openPositions = [
    {
      title: "Credit Underwriter",
      department: "Risk & Credit",
      location: "Mumbai, Maharashtra",
      type: "Full-time",
      experience: "2-4 years",
      skills: ["Credit Analysis", "Risk Assessment", "Financial Analysis"],
      description: "Evaluate loan applications and assess creditworthiness of borrowers."
    },
    {
      title: "Relationship Manager",
      department: "Sales & Operations",
      location: "Mumbai, Maharashtra",
      type: "Full-time",
      experience: "1-3 years",
      skills: ["Customer Relations", "Communication", "Sales"],
      description: "Build and maintain relationships with customers to drive business growth."
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0052FF' }}>
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl mb-6 text-white font-bold">
            Join Our Team
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Help us revolutionize digital lending in India. Build your career while 
            making financial services accessible to millions.
          </p>
        </div>
      </section>

      {/* Application Instructions */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
                Apply Now
              </h2>
              <p className="text-lg mb-6" style={{ color: '#1E2A3B' }}>
                We're always looking for talented individuals to join our mission
              </p>
              <div className="bg-white rounded-lg p-6 mb-6 border border-blue-100">
                <p className="text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>
                  Share your CV / Resume at
                </p>
                <a 
                  href="mailto:support@pocketcredit.in" 
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  support@pocketcredit.in
                </a>
              </div>
              <p className="text-sm text-gray-600">
                Please mention the position you're applying for in the subject line
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Current Openings */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
              Current Openings
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto text-lg">
              Explore our current job openings and find the perfect role for you
            </p>
          </div>

          <div className="grid gap-6">
            {openPositions.map((position, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow bg-white">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                          {position.title}
                        </h3>
                        <Badge style={{ backgroundColor: '#00C49A', color: 'white' }}>
                          {position.department}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm" style={{ color: '#1E2A3B' }}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {position.location}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {position.type}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Experience: {position.experience}
                        </div>
                      </div>
                      
                      <p className="mb-4 text-lg" style={{ color: '#1E2A3B' }}>
                        {position.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {position.skills.map((skill, idx) => (
                          <Badge key={idx} variant="outline" className="text-sm">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4 lg:mt-0 lg:ml-6">
                      <Button 
                        style={{ backgroundColor: '#0052FF', color: 'white' }}
                        onClick={() => window.location.href = 'mailto:support@pocketcredit.in?subject=Application for ' + position.title}
                        size="lg"
                      >
                        Apply Now
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#1E2A3B' }}>
            Don't See a Position That Fits?
          </h2>
          <p className="text-lg mb-8" style={{ color: '#1E2A3B' }}>
            We're always open to connecting with talented individuals. Send us your resume and 
            we'll keep you in mind for future opportunities.
          </p>
          <Button 
            size="lg"
            style={{ backgroundColor: '#0052FF', color: 'white' }}
            onClick={() => window.location.href = 'mailto:support@pocketcredit.in'}
          >
            <Mail className="mr-2 h-5 w-5" />
            Send Your Resume
          </Button>
        </div>
      </section>
    </div>
  );
}
