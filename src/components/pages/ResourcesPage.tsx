import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search, BookOpen, Calculator, FileText, Video, Download, Clock, User } from 'lucide-react';




export function ResourcesPage() {
    const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Resources' },
    { id: 'guides', label: 'Guides' },
    { id: 'calculators', label: 'Calculators' },
    { id: 'videos', label: 'Videos' },
    { id: 'documents', label: 'Documents' }
  ];

  const resources = [
    {
      id: 1,
      title: 'Complete Guide to Personal Loans',
      description: 'Everything you need to know about personal loans, eligibility, and application process.',
      category: 'guides',
      type: 'Guide',
      readTime: '8 min read',
      icon: BookOpen,
      featured: true
    },
    {
      id: 2,
      title: 'EMI Calculator',
      description: 'Calculate your monthly EMI for different loan amounts and tenures.',
      category: 'calculators',
      type: 'Calculator',
      readTime: 'Interactive',
      icon: Calculator,
      featured: true
    },
    {
      id: 3,
      title: 'How to Improve Your Credit Score',
      description: 'Proven strategies to boost your credit score and get better loan terms.',
      category: 'guides',
      type: 'Guide',
      readTime: '6 min read',
      icon: BookOpen,
      featured: false
    },
    {
      id: 4,
      title: 'Business Loan Application Checklist',
      description: 'Complete checklist of documents needed for business loan application.',
      category: 'documents',
      type: 'Checklist',
      readTime: '3 min read',
      icon: FileText,
      featured: false
    },
    {
      id: 5,
      title: 'Understanding Interest Rates',
      description: 'Learn about different types of interest rates and how they affect your loan.',
      category: 'videos',
      type: 'Video',
      readTime: '12 min watch',
      icon: Video,
      featured: false
    },
    {
      id: 6,
      title: 'Loan Application Process Explained',
      description: 'Step-by-step video guide through our loan application process.',
      category: 'videos',
      type: 'Video',
      readTime: '8 min watch',
      icon: Video,
      featured: false
    },
    {
      id: 7,
      title: 'Income Documentation Guide',
      description: 'Complete guide on income documents required for different employment types.',
      category: 'documents',
      type: 'Guide',
      readTime: '5 min read',
      icon: FileText,
      featured: false
    },
    {
      id: 8,
      title: 'Debt Consolidation Calculator',
      description: 'Calculate potential savings by consolidating multiple debts into one loan.',
      category: 'calculators',
      type: 'Calculator',
      readTime: 'Interactive',
      icon: Calculator,
      featured: false
    }
  ];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredResources = resources.filter(resource => resource.featured);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl mb-6" style={{ color: '#1E2A3B' }}>
              Loan <span style={{ color: '#0052FF' }}>Resources</span> & Guides
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: '#1E2A3B' }}>
              Access helpful guides, calculators, and tools to make informed decisions about your loans
            </p>
          </div>

          {/* Search and Filter */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  style={{
                    backgroundColor: selectedCategory === category.id ? '#0052FF' : 'transparent',
                    borderColor: '#0052FF',
                    color: selectedCategory === category.id ? 'white' : '#0052FF'
                  }}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Featured Resources */}
          {selectedCategory === 'all' && (
            <div className="max-w-6xl mx-auto mb-12">
              <h2 className="text-2xl mb-6 text-center" style={{ color: '#1E2A3B' }}>
                Featured Resources
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featuredResources.map((resource) => (
                  <Card key={resource.id} className="group hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <resource.icon className="w-8 h-8 mb-2" style={{ color: '#0052FF' }} />
                        <Badge variant="secondary" style={{ backgroundColor: '#00C49A', color: 'white' }}>
                          Featured
                        </Badge>
                      </div>
                      <CardTitle className="group-hover:text-blue-600 transition-colors">
                        {resource.title}
                      </CardTitle>
                      <CardDescription>
                        {resource.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {resource.readTime}
                        </div>
                        <Badge variant="outline">{resource.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Resources */}
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl mb-6 text-center" style={{ color: '#1E2A3B' }}>
              {selectedCategory === 'all' ? 'All Resources' : categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            
            {filteredResources.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No resources found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResources.map((resource) => (
                  <Card key={resource.id} className="group hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <resource.icon className="w-6 h-6 mb-2" style={{ color: '#0052FF' }} />
                      <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                        {resource.title}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {resource.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {resource.readTime}
                        </div>
                        <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Quick Tools Section */}
          <div className="max-w-4xl mx-auto mt-16">
            <h2 className="text-2xl mb-8 text-center" style={{ color: '#1E2A3B' }}>
              Quick Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <Calculator className="w-12 h-12 mx-auto mb-4" style={{ color: '#0052FF' }} />
                  <h3 className="text-lg font-medium mb-2">EMI Calculator</h3>
                  <p className="text-sm text-gray-600 mb-4">Calculate monthly payments for any loan amount</p>
                  <Button size="sm" style={{ backgroundColor: '#0052FF' }}>
                    Calculate EMI
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: '#0052FF' }} />
                  <h3 className="text-lg font-medium mb-2">Eligibility Checker</h3>
                  <p className="text-sm text-gray-600 mb-4">Check your loan eligibility instantly</p>
                  <Button size="sm" style={{ backgroundColor: '#0052FF' }}>
                    Check Eligibility
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <User className="w-12 h-12 mx-auto mb-4" style={{ color: '#0052FF' }} />
                  <h3 className="text-lg font-medium mb-2">Credit Score</h3>
                  <p className="text-sm text-gray-600 mb-4">Get your free credit score report</p>
                  <Button 
                    size="sm" 
                    style={{ backgroundColor: '#0052FF' }}
                    onClick={() => navigate('/credit-score')}
                  >
                    Check Score
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <Card>
              <CardContent className="pt-8 pb-8">
                <h2 className="text-2xl mb-4" style={{ color: '#1E2A3B' }}>
                  Need Personal Assistance?
                </h2>
                <p className="text-gray-600 mb-6">
                  Our loan experts are here to help you choose the right loan for your needs
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={() => navigate('/contact')}
                    style={{ backgroundColor: '#0052FF' }}
                  >
                    Contact Our Experts
                  </Button>
                  <Button 
                    onClick={() => navigate('/application')}
                    style={{ backgroundColor: '#00C49A' }}
                  >
                    Apply for Loan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}