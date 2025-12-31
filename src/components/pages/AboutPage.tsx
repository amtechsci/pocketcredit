import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Users, Target, TrendingUp, Award, Shield, Heart, Zap, Calendar, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';



export function AboutPage() {
    const navigate = useNavigate();
  const stats = [
    { label: "Customers Served", value: "1M+", icon: Users },
    { label: "Loans Disbursed", value: "₹5,000 Cr+", icon: TrendingUp },
    { label: "Cities Covered", value: "500+", icon: MapPin }
  ];

  const timeline = [
    {
      year: "2019",
      title: "Foundation",
      description: "Pocket Credit was founded with a vision to democratize access to credit across India through technology."
    },
    {
      year: "2020",
      title: "First Million",
      description: "Crossed our first milestone of ₹100 crores in loan disbursements, serving over 100,000 customers."
    },
    {
      year: "2021",
      title: "Expansion",
      description: "Expanded to 200+ cities and partnered with leading NBFCs to offer diverse loan products."
    },
    {
      year: "2022",
      title: "Recognition",
      description: "Won 'Best Digital Lending Platform' award and achieved industry-leading customer satisfaction scores."
    },
    {
      year: "2023",
      title: "Innovation",
      description: "Launched AI-powered risk assessment and achieved 98% customer satisfaction with instant loan approvals."
    },
    {
      year: "2024",
      title: "Leadership",
      description: "Became India's fastest-growing digital lending platform with over 1 million satisfied customers."
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Customer First",
      description: "Every decision we make is centered around delivering exceptional value and service to our customers."
    },
    {
      icon: Shield,
      title: "Trust & Transparency",
      description: "We believe in complete transparency in our processes, pricing, and partnerships."
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "We continuously innovate to make financial services faster, easier, and more accessible."
    },
    {
      icon: Heart,
      title: "Financial Inclusion",
      description: "Our mission is to bridge the credit gap and provide financial opportunities for all Indians."
    },
    {
      icon: TrendingUp,
      title: "Excellence",
      description: "We strive for excellence in technology, service delivery, and customer satisfaction."
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "We work closely with partners, customers, and communities to create mutual value."
    }
  ];

  const achievements = [
    {
      title: "Best Digital Lending Platform 2023",
      organization: "Fintech Awards India",
      description: "Recognized for innovation and customer satisfaction"
    },
    {
      title: "Top 50 Fintech Companies",
      organization: "Economic Times",
      description: "Featured among India's most promising fintech startups"
    },
    {
      title: "Excellence in Customer Service",
      organization: "BFSI Awards",
      description: "Awarded for maintaining 98% customer satisfaction score"
    },
    {
      title: "Innovation in Financial Inclusion",
      organization: "Banking Frontier Awards",
      description: "Recognized for expanding credit access to underserved segments"
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0052FF' }}>
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            About Pocket Credit
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            We're on a mission to democratize access to credit across India, making financial 
            services faster, transparent, and accessible to everyone.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <stat.icon className="h-8 w-8 text-white mx-auto mb-2" />
                <div className="text-2xl text-white">{stat.value}</div>
                <div className="text-blue-100 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 px-4" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl mb-6" style={{ color: '#1E2A3B' }}>
                Our Mission
              </h2>
              <p className="text-lg mb-6" style={{ color: '#1E2A3B' }}>
                To bridge the credit gap in India by leveraging technology to provide instant, 
                transparent, and affordable financial solutions to individuals and businesses 
                across the country.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#00C49A' }}></div>
                  <p style={{ color: '#1E2A3B' }}>
                    Simplify the lending process through digital innovation
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#00C49A' }}></div>
                  <p style={{ color: '#1E2A3B' }}>
                    Provide transparent and fair financial products
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#00C49A' }}></div>
                  <p style={{ color: '#1E2A3B' }}>
                    Empower financial inclusion across all segments of society
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500&h=400&fit=crop"
                alt="Mission and Vision"
                className="rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Company Timeline */}
      <section className="py-16 px-4" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Our Journey
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              From a startup vision to India's leading digital lending platform - 
              here's how we've grown over the years.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full" style={{ backgroundColor: '#0052FF' }}></div>
            <div className="space-y-12">
              {timeline.map((item, index) => (
                <div key={index} className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8'}`}>
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge style={{ backgroundColor: '#00C49A', color: 'white' }}>
                            {item.year}
                          </Badge>
                          <Calendar className="h-4 w-4" style={{ color: '#0052FF' }} />
                        </div>
                        <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                          {item.title}
                        </h3>
                        <p style={{ color: '#1E2A3B' }}>
                          {item.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="w-4 h-4 rounded-full border-4 border-white z-10" style={{ backgroundColor: '#0052FF' }}></div>
                  <div className="w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Company Values */}
      <section className="py-16 px-4" style={{ backgroundColor: '#F0F4F8' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Our Values
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              The core principles that guide our decisions and shape our culture.
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

      {/* Awards & Recognition */}
      <section className="py-16 px-4" style={{ backgroundColor: 'white' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Awards & Recognition
            </h2>
            <p style={{ color: '#1E2A3B' }} className="max-w-2xl mx-auto">
              Industry recognition for our commitment to innovation and customer excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {achievements.map((achievement, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#00C49A' }}
                    >
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg mb-1" style={{ color: '#1E2A3B' }}>
                        {achievement.title}
                      </h3>
                      <div className="text-sm mb-2" style={{ color: '#0052FF' }}>
                        {achievement.organization}
                      </div>
                      <p className="text-sm" style={{ color: '#1E2A3B' }}>
                        {achievement.description}
                      </p>
                    </div>
                  </div>
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
            Ready to Experience the Future of Lending?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Join over 1 million customers who trust Pocket Credit for their financial needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/personal-loan')}
              size="lg"
              className="bg-white text-green-600 hover:bg-gray-50"
            >
              Apply for Personal Loan
            </Button>
            <Button
              onClick={() => navigate('/business-loan')}
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-green-600"
            >
              Business Loans
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}