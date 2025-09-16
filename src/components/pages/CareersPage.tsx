import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapPin, Clock, Users, TrendingUp, Heart, Zap, Target, Award, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ImageWithFallback } from '../figma/ImageWithFallback';



export function CareersPage() {
    const navigate = useNavigate();
  const openPositions = [
    {
      title: "Senior Software Engineer - Backend",
      department: "Engineering",
      location: "Mumbai, Maharashtra",
      type: "Full-time",
      experience: "4-6 years",
      skills: ["Node.js", "Python", "AWS", "MongoDB"],
      description: "Build scalable backend systems for our lending platform."
    },
    {
      title: "Product Manager - Lending",
      department: "Product",
      location: "Bengaluru, Karnataka",
      type: "Full-time",
      experience: "3-5 years",
      skills: ["Product Strategy", "Fintech", "Analytics"],
      description: "Drive product strategy and roadmap for our core lending products."
    },
    {
      title: "Risk Analyst",
      department: "Risk & Compliance",
      location: "Mumbai, Maharashtra",
      type: "Full-time",
      experience: "2-4 years",
      skills: ["Risk Modeling", "Python", "SQL", "Statistics"],
      description: "Develop and maintain risk models for loan underwriting."
    },
    {
      title: "UI/UX Designer",
      department: "Design",
      location: "Mumbai, Maharashtra",
      type: "Full-time",
      experience: "2-4 years",
      skills: ["Figma", "User Research", "Prototyping"],
      description: "Design intuitive user experiences for our digital platform."
    },
    {
      title: "Data Scientist",
      department: "Analytics",
      location: "Bengaluru, Karnataka",
      type: "Full-time",
      experience: "3-5 years",
      skills: ["Machine Learning", "Python", "TensorFlow"],
      description: "Build ML models to improve loan approval and risk assessment."
    },
    {
      title: "Customer Success Manager",
      department: "Operations",
      location: "Delhi, National Capital Territory",
      type: "Full-time",
      experience: "1-3 years",
      skills: ["Communication", "CRM", "Problem Solving"],
      description: "Ensure exceptional customer experience and satisfaction."
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We're passionate about democratizing access to credit and empowering financial inclusion across India."
    },
    {
      icon: Zap,
      title: "Innovation First",
      description: "We embrace cutting-edge technology and innovative solutions to solve complex financial challenges."
    },
    {
      icon: Users,
      title: "Collaborative Culture",
      description: "We believe in the power of teamwork, open communication, and supporting each other's growth."
    },
    {
      icon: TrendingUp,
      title: "Growth Mindset",
      description: "We encourage continuous learning, taking on new challenges, and pushing boundaries."
    },
    {
      icon: Heart,
      title: "Customer-Centric",
      description: "Every decision we make is guided by what's best for our customers and their financial well-being."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We set high standards for ourselves and strive for excellence in everything we do."
    }
  ];

  const benefits = [
    {
      category: "Health & Wellness",
      items: [
        "Comprehensive health insurance for you and your family",
        "Mental health support and counseling services",
        "Annual health checkups",
        "Gym membership reimbursement"
      ]
    },
    {
      category: "Financial Benefits",
      items: [
        "Competitive salary with performance bonuses",
        "Employee stock option plan (ESOP)",
        "Provident fund contribution",
        "Special loan rates for employees"
      ]
    },
    {
      category: "Work-Life Balance",
      items: [
        "Flexible working hours",
        "Work from home options",
        "25+ paid leave days annually",
        "Sabbatical leave policy"
      ]
    },
    {
      category: "Growth & Learning",
      items: [
        "Learning and development budget",
        "Conference and course reimbursement",
        "Internal mentorship programs",
        "Leadership development tracks"
      ]
    }
  ];

  const departments = [
    { name: "Engineering", count: 12, icon: "💻" },
    { name: "Product", count: 5, icon: "🎯" },
    { name: "Design", count: 3, icon: "🎨" },
    { name: "Risk & Compliance", count: 4, icon: "🛡️" },
    { name: "Operations", count: 8, icon: "⚙️" },
    { name: "Analytics", count: 6, icon: "📊" }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0052FF' }}>
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            Join Our Mission
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Help us revolutionize digital lending in India. Build your career while 
            making financial services accessible to millions.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl text-white">150+</div>
              <div className="text-blue-100">Team Members</div>
            </div>
            <div>
              <div className="text-3xl text-white">6</div>
              <div className="text-blue-100">Departments</div>
            </div>
            <div>
              <div className="text-3xl text-white">25+</div>
              <div className="text-blue-100">Open Positions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Open Positions
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              Explore opportunities across different teams and find the perfect role 
              to grow your career with us.
            </p>
          </div>

          <Tabs defaultValue="all" className="space-y-8">
            <TabsList className="grid grid-cols-7 max-w-4xl mx-auto">
              <TabsTrigger value="all">All ({openPositions.length})</TabsTrigger>
              {departments.map((dept) => (
                <TabsTrigger key={dept.name} value={dept.name.toLowerCase()}>
                  {dept.name} ({dept.count})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              <div className="grid gap-6">
                {openPositions.map((position, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl" style={{ color: '#1E2A3B' }}>
                              {position.title}
                            </h3>
                            <Badge style={{ backgroundColor: '#00C49A', color: 'white' }}>
                              {position.department}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 mb-3 text-sm" style={{ color: '#1E2A3B' }}>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {position.location}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {position.type}
                            </div>
                            <div>
                              Experience: {position.experience}
                            </div>
                          </div>
                          
                          <p className="mb-3" style={{ color: '#1E2A3B' }}>
                            {position.description}
                          </p>
                          
                          <div className="flex flex-wrap gap-2">
                            {position.skills.map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="mt-4 lg:mt-0 lg:ml-6">
                          <Button style={{ backgroundColor: '#0052FF', color: 'white' }}>
                            Apply Now
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Department specific tabs would filter positions */}
            <TabsContent value="engineering" className="space-y-6">
              <div className="grid gap-6">
                {openPositions.filter(p => p.department === "Engineering").map((position, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      {/* Same content structure as above */}
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl" style={{ color: '#1E2A3B' }}>
                              {position.title}
                            </h3>
                            <Badge style={{ backgroundColor: '#00C49A', color: 'white' }}>
                              {position.department}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mb-3 text-sm" style={{ color: '#1E2A3B' }}>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {position.location}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {position.type}
                            </div>
                            <div>Experience: {position.experience}</div>
                          </div>
                          <p className="mb-3" style={{ color: '#1E2A3B' }}>{position.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {position.skills.map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 lg:mt-0 lg:ml-6">
                          <Button style={{ backgroundColor: '#0052FF', color: 'white' }}>
                            Apply Now <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Company Culture */}
      <section className="py-16 px-4" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Our Values
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              The principles that guide everything we do and shape our culture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: '#0052FF' }}
                >
                  <value.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                  {value.title}
                </h3>
                <p className="text-sm" style={{ color: '#1E2A3B' }}>
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Benefits & Perks
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              We invest in our people with comprehensive benefits and growth opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((category, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle style={{ color: '#1E2A3B' }}>
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.items.map((item, idx) => (
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
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#00C49A' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl mb-4 text-white">
            Ready to Make an Impact?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Join our team and help shape the future of digital lending in India.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-green-600 hover:bg-gray-50"
            >
              View All Openings
            </Button>
            <Button
              onClick={() => navigate('/contact')}
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-green-600"
            >
              Contact HR Team
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}