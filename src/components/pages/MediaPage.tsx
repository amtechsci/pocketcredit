import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Calendar, Download, ExternalLink, FileText, Image, Video, Award, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ImageWithFallback } from '../figma/ImageWithFallback';



export function MediaPage() {
    const navigate = useNavigate();
  const pressReleases = [
    {
      date: "2024-01-15",
      title: "Pocket Credit Crosses ₹1,000 Crore in Loan Disbursements",
      excerpt: "Milestone achievement reflects growing trust and rapid expansion across India's digital lending landscape.",
      category: "Business Milestone",
      readTime: "3 min read"
    },
    {
      date: "2024-01-10",
      title: "Partnership with Leading NBFCs to Expand Loan Portfolio",
      excerpt: "Strategic partnerships enhance product offerings and provide customers with more competitive loan options.",
      category: "Partnerships",
      readTime: "4 min read"
    },
    {
      date: "2023-12-20",
      title: "Pocket Credit Wins 'Best Digital Lending Platform 2023'",
      excerpt: "Recognition for innovation in fintech and commitment to financial inclusion across India.",
      category: "Awards",
      readTime: "2 min read"
    },
    {
      date: "2023-12-05",
      title: "Enhanced Security Features Launched for Better Customer Protection",
      excerpt: "New multi-layer security protocols ensure complete safety of customer data and transactions.",
      category: "Product Update",
      readTime: "5 min read"
    }
  ];

  const mediaFeatures: any[] = [];

  const mediaKit = [
    {
      type: "Logo Pack",
      description: "High-resolution logos in various formats (PNG, SVG, EPS)",
      icon: Image,
      size: "2.5 MB"
    },
    {
      type: "Brand Guidelines",
      description: "Complete brand identity guidelines and usage instructions",
      icon: FileText,
      size: "1.8 MB"
    },
    {
      type: "Company Factsheet",
      description: "Key facts, figures, and company information",
      icon: FileText,
      size: "500 KB"
    },
    {
      type: "Product Screenshots",
      description: "High-quality screenshots of our platform and mobile app",
      icon: Image,
      size: "5.2 MB"
    },
    {
      type: "Leadership Photos",
      description: "Professional photos of key leadership team members",
      icon: Image,
      size: "3.1 MB"
    },
    {
      type: "Video Assets",
      description: "Company overview and product demonstration videos",
      icon: Video,
      size: "45 MB"
    }
  ];

  const awards = [
    {
      title: "Best Digital Lending Platform 2023",
      organization: "Fintech Awards India",
      year: "2023"
    },
    {
      title: "Innovation in Financial Services",
      organization: "BFSI Excellence Awards",
      year: "2023"
    },
    {
      title: "Rising Fintech of the Year",
      organization: "Startup Awards",
      year: "2022"
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#1E2A3B' }}>
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            Media & Press Center
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Stay updated with the latest news, press releases, and media coverage 
            about Pocket Credit's journey in transforming digital lending in India.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl text-white">50+</div>
              <div className="text-gray-300">Media Mentions</div>
            </div>
            <div>
              <div className="text-3xl text-white">15+</div>
              <div className="text-gray-300">Press Releases</div>
            </div>
            <div>
              <div className="text-3xl text-white">3</div>
              <div className="text-gray-300">Industry Awards</div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Tabs */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="press-releases" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="press-releases">Press Releases</TabsTrigger>
              <TabsTrigger value="media-coverage">Media Coverage</TabsTrigger>
              <TabsTrigger value="media-kit">Media Kit</TabsTrigger>
              <TabsTrigger value="awards">Awards</TabsTrigger>
            </TabsList>

            <TabsContent value="press-releases" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Latest Press Releases
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Official announcements and company news
                </p>
              </div>
              
              <div className="grid gap-6">
                {pressReleases.map((release, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                        <div className="flex items-center gap-4 mb-2 md:mb-0">
                          <Calendar className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <span style={{ color: '#1E2A3B' }}>
                            {new Date(release.date).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          <Badge variant="outline">{release.category}</Badge>
                        </div>
                        <span className="text-sm" style={{ color: '#1E2A3B' }}>
                          {release.readTime}
                        </span>
                      </div>
                      
                      <h3 className="text-xl mb-3" style={{ color: '#1E2A3B' }}>
                        {release.title}
                      </h3>
                      
                      <p className="mb-4" style={{ color: '#1E2A3B' }}>
                        {release.excerpt}
                      </p>
                      
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Read Full Release
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="media-coverage" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Media Coverage
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Features and mentions in leading publications
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mediaFeatures.map((feature, index) => (
                  <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video">
                      <ImageWithFallback
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <Badge style={{ backgroundColor: '#0052FF', color: 'white' }}>
                          {feature.outlet}
                        </Badge>
                        <span className="text-sm" style={{ color: '#1E2A3B' }}>
                          {new Date(feature.date).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      
                      <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                        {feature.title}
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: '#1E2A3B' }}>
                          {feature.type}
                        </span>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="media-kit" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Media Kit
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Download official assets and resources for media use
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mediaKit.map((item, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: '#0052FF' }}
                      >
                        <item.icon className="h-8 w-8 text-white" />
                      </div>
                      
                      <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                        {item.type}
                      </h3>
                      
                      <p className="text-sm mb-4" style={{ color: '#1E2A3B' }}>
                        {item.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: '#1E2A3B' }}>
                          {item.size}
                        </span>
                        <Button size="sm" style={{ backgroundColor: '#00C49A', color: 'white' }}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="awards" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Awards & Recognition
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Industry recognition for our innovation and excellence
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {awards.map((award, index) => (
                  <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                    <CardContent className="p-8">
                      <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: '#00C49A' }}
                      >
                        <Award className="h-8 w-8 text-white" />
                      </div>
                      
                      <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                        {award.title}
                      </h3>
                      
                      <p className="mb-2" style={{ color: '#1E2A3B' }}>
                        {award.organization}
                      </p>
                      
                      <Badge variant="outline">
                        {award.year}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

    </div>
  );
}