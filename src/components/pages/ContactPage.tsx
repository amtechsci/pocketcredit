import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Mail, Phone, MapPin, Clock, MessageCircle, Headphones, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';




export function ContactPage() {
    const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    category: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    toast.success('Your message has been sent successfully! We will get back to you within 24 hours.');
    setFormData({
      name: '',
      email: '',
      phone: '',
      subject: '',
      category: '',
      message: ''
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const contactMethods = [
    {
      icon: Phone,
      title: 'Call Us',
      description: 'Speak to our loan experts',
      value: '1800-123-4567',
      availability: 'Mon-Sat, 9 AM - 8 PM',
      action: 'Call Now'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Send us your queries',
      value: 'support@pocketcredit.com',
      availability: '24/7 Response',
      action: 'Send Email'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our support team',
      value: 'Available Now',
      availability: 'Mon-Sat, 9 AM - 8 PM',
      action: 'Start Chat'
    }
  ];

  const faqCategories = [
    {
      title: 'Loan Application',
      questions: [
        { q: 'What documents do I need?', a: 'ID proof, address proof, income proof, and bank statements.' },
        { q: 'How long does approval take?', a: 'Most applications are approved within 24-48 hours.' },
        { q: 'What is the minimum income requirement?', a: 'Minimum monthly income of ₹25,000 for personal loans.' }
      ]
    },
    {
      title: 'Interest Rates & Fees',
      questions: [
        { q: 'What are current interest rates?', a: 'Personal loans start from 10.99% per annum.' },
        { q: 'Are there any processing fees?', a: 'Processing fee ranges from 1-3% of loan amount.' },
        { q: 'Can I prepay my loan?', a: 'Yes, with minimal or no prepayment charges after 6 months.' }
      ]
    },
    {
      title: 'Eligibility & Credit',
      questions: [
        { q: 'What is the minimum credit score required?', a: 'We accept applications from credit score 650 and above.' },
        { q: 'Can I apply if I am self-employed?', a: 'Yes, we offer loans to both salaried and self-employed individuals.' },
        { q: 'What if I have existing loans?', a: 'Existing loans are considered in our assessment process.' }
      ]
    }
  ];

  const offices = [
    {
      city: 'Mumbai',
      address: '123 Business Complex, Andheri East, Mumbai - 400069',
      phone: '+91 22 1234 5678',
      email: 'mumbai@pocketcredit.com'
    },
    {
      city: 'Delhi',
      address: '456 Corporate Tower, Connaught Place, New Delhi - 110001',
      phone: '+91 11 1234 5678',
      email: 'delhi@pocketcredit.com'
    },
    {
      city: 'Bangalore',
      address: '789 Tech Park, Electronic City, Bangalore - 560100',
      phone: '+91 80 1234 5678',
      email: 'bangalore@pocketcredit.com'
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

          {/* Contact Methods */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contactMethods.map((method, index) => (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <method.icon className="w-12 h-12 mx-auto mb-4" style={{ color: '#0052FF' }} />
                    <h3 className="text-lg font-medium mb-2">{method.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{method.description}</p>
                    <p className="font-medium mb-2" style={{ color: '#1E2A3B' }}>{method.value}</p>
                    <p className="text-xs text-gray-500 mb-4">{method.availability}</p>
                    <Button size="sm" style={{ backgroundColor: '#0052FF' }}>
                      {method.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Contact Form and Office Locations */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you within 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Inquiry Category</Label>
                    <Select onValueChange={(value) => handleInputChange('category', value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan-application">Loan Application</SelectItem>
                        <SelectItem value="existing-loan">Existing Loan</SelectItem>
                        <SelectItem value="technical-support">Technical Support</SelectItem>
                        <SelectItem value="complaint">Complaint/Grievance</SelectItem>
                        <SelectItem value="general">General Inquiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" style={{ backgroundColor: '#0052FF' }}>
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Office Locations */}
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
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-700">
                      <p className="font-medium">Emergency Support</p>
                      <p>For urgent loan-related queries, use our 24/7 email support</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl mb-8 text-center" style={{ color: '#1E2A3B' }}>
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {faqCategories.map((category, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.questions.map((faq, faqIndex) => (
                        <div key={faqIndex} className="text-sm">
                          <p className="font-medium mb-1">{faq.q}</p>
                          <p className="text-gray-600">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

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