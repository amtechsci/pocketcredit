import { MessageSquare, Clock, Phone, Mail, FileText, AlertCircle, CheckCircle, User, Calendar, Building, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';



export function GrievanceRedressalPage() {
    const navigate = useNavigate();
  const [grievanceForm, setGrievanceForm] = useState({
    name: '',
    email: '',
    phone: '',
    loanId: '',
    category: '',
    subject: '',
    description: ''
  });

  const handleSubmitGrievance = () => {
    if (!grievanceForm.name || !grievanceForm.email || !grievanceForm.category || !grievanceForm.description) {
      toast.error('Please fill all required fields');
      return;
    }
    
    toast.success('Grievance submitted successfully. Reference number: GRV-2025-0156');
    // Reset form
    setGrievanceForm({
      name: '',
      email: '',
      phone: '',
      loanId: '',
      category: '',
      subject: '',
      description: ''
    });
  };

  const grievanceCategories = [
    "Loan Application Issues",
    "Documentation Problems", 
    "Interest Rate Concerns",
    "Payment & EMI Issues",
    "Customer Service",
    "Technical Issues",
    "Billing & Charges",
    "Data Privacy Concerns",
    "Collection Practices",
    "Loan Disbursement Issues",
    "Others"
  ];

  // Based on actual policy document
  const escalationProcess = [
    {
      level: "Level 1",
      handler: "Branch/Place of Business",
      timeline: "7 days",
      description: "Initial complaint review and resolution attempt at branch level",
      contact: {
        method: "Written complaint to Branch Manager",
        email: "support@creditlab.in",
        phone: "+91 9346551691",
        address: "#30 2nd Floor 1st Main BHCS Layout BTM 2nd Stage Opp Gopalan Innovation Mall, Bengaluru, Karnataka 560076"
      }
    },
    {
      level: "Level 2", 
      handler: "Grievance Redressal Officer",
      timeline: "7 working days",
      description: "Escalated review by dedicated grievance redressal officer",
      contact: {
        name: "Mr. Kowshik",
        email: "grievance@creditlab.in",
        phone: "+91 9346551691"
      }
    },
    {
      level: "Level 3",
      handler: "Chief Nodal Officer",
      timeline: "15 working days",
      description: "Final internal escalation to Chief Nodal Officer",
      contact: {
        name: "MR. Abhishek M R",
        email: "abhi@creditlab.in",
        phone: "+91 7259333111"
      }
    },
    {
      level: "Level 4",
      handler: "Reserve Bank of India",
      timeline: "After 1 month",
      description: "External escalation to RBI if not satisfied with internal resolution",
      contact: {
        address: "Reserve Bank of India, 15, Netaji Subhas Rd, Fairley Place, B.B.D. Bagh, Kolkata, West Bengal 700001",
        phone: "033 2230 3299",
        email: "rdkolkata@rbi.org.in"
      }
    }
  ];

  const faqItems = [
    {
      question: "How long does it take to resolve a grievance?",
      answer: "Level 1: 7 days, Level 2: 7 working days after escalation, Level 3: 15 working days after escalation. If not resolved within 1 month, you may approach RBI."
    },
    {
      question: "What happens if I don't receive a response within the specified time?",
      answer: "If you don't receive a response within 15 days from your initial complaint, you may contact our Chief Nodal Officer directly. After 1 month without resolution, you can approach the Reserve Bank of India."
    },
    {
      question: "Can I directly approach the RBI with my complaint?",
      answer: "You should first try to resolve the issue through our internal grievance mechanism. You may approach RBI only if you don't receive a response within 1 month or are dissatisfied with our resolution."
    },
    {
      question: "Is there any charge for filing a grievance?",
      answer: "No, filing a grievance with us is completely free of charge. We encourage customers to report any issues they face."
    },
    {
      question: "What information should I include in my complaint?",
      answer: "Please include your name, contact details, loan details (if applicable), a clear description of the issue, and any supporting documents. This helps us process your complaint more efficiently."
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#1E2A3B' }}>
        <div className="max-w-6xl mx-auto text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-6 text-white" />
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            Grievance Redressal Mechanism
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Multi-level grievance redressal mechanism established by Spheeti Fintech Private Limited 
            for resolving disputes and complaints arising from the company's decisions.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl text-white">4 Levels</div>
              <div className="text-gray-300">Resolution Process</div>
            </div>
            <div>
              <div className="text-3xl text-white">7 Days</div>
              <div className="text-gray-300">Initial Response</div>
            </div>
            <div>
              <div className="text-3xl text-white">24/7</div>
              <div className="text-gray-300">Support Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="submit" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="submit">Submit Grievance</TabsTrigger>
              <TabsTrigger value="process">Resolution Process</TabsTrigger>
              <TabsTrigger value="contact">Contact Details</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="submit" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Submit Your Grievance
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Please provide detailed information about your concern so we can assist you better.
                </p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg max-w-2xl mx-auto">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> For immediate assistance, you can also call our Customer Care at 
                    <strong> +91 9346551691</strong> or email <strong>support@creditlab.in</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle style={{ color: '#1E2A3B' }}>Grievance Form</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                            Full Name *
                          </label>
                          <Input
                            value={grievanceForm.name}
                            onChange={(e) => setGrievanceForm({ ...grievanceForm, name: e.target.value })}
                            placeholder="Enter your full name"
                          />
                        </div>
                        <div>
                          <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                            Email Address *
                          </label>
                          <Input
                            type="email"
                            value={grievanceForm.email}
                            onChange={(e) => setGrievanceForm({ ...grievanceForm, email: e.target.value })}
                            placeholder="Enter your email"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                            Phone Number
                          </label>
                          <Input
                            type="tel"
                            value={grievanceForm.phone}
                            onChange={(e) => setGrievanceForm({ ...grievanceForm, phone: e.target.value })}
                            placeholder="Enter your phone number"
                          />
                        </div>
                        <div>
                          <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                            Loan ID (if applicable)
                          </label>
                          <Input
                            value={grievanceForm.loanId}
                            onChange={(e) => setGrievanceForm({ ...grievanceForm, loanId: e.target.value })}
                            placeholder="Enter your loan ID"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                          Grievance Category *
                        </label>
                        <Select
                          value={grievanceForm.category}
                          onValueChange={(value) => setGrievanceForm({ ...grievanceForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {grievanceCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                          Subject
                        </label>
                        <Input
                          value={grievanceForm.subject}
                          onChange={(e) => setGrievanceForm({ ...grievanceForm, subject: e.target.value })}
                          placeholder="Brief description of the issue"
                        />
                      </div>

                      <div>
                        <label className="block mb-2" style={{ color: '#1E2A3B' }}>
                          Detailed Description *
                        </label>
                        <Textarea
                          value={grievanceForm.description}
                          onChange={(e) => setGrievanceForm({ ...grievanceForm, description: e.target.value })}
                          placeholder="Please provide detailed information about your grievance..."
                          className="min-h-[120px]"
                        />
                      </div>

                      <Button
                        onClick={handleSubmitGrievance}
                        className="w-full"
                        style={{ backgroundColor: '#0052FF', color: 'white' }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Submit Grievance
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle style={{ color: '#1E2A3B' }}>Quick Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                        <Phone className="h-8 w-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
                        <div style={{ color: '#1E2A3B' }}>Customer Care</div>
                        <div style={{ color: '#1E2A3B' }}>+91 9346551691</div>
                        <div className="text-sm" style={{ color: '#1E2A3B' }}>Available during business hours</div>
                      </div>

                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                        <Mail className="h-8 w-8 mx-auto mb-2" style={{ color: '#0052FF' }} />
                        <div style={{ color: '#1E2A3B' }}>Email Support</div>
                        <div style={{ color: '#1E2A3B' }}>support@creditlab.in</div>
                        <div className="text-sm" style={{ color: '#1E2A3B' }}>Initial response within 7 days</div>
                      </div>

                      <div className="p-4 border rounded-lg" style={{ borderColor: '#0052FF' }}>
                        <AlertCircle className="h-5 w-5 mb-2" style={{ color: '#0052FF' }} />
                        <div className="text-sm" style={{ color: '#1E2A3B' }}>
                          Written complaints can be addressed to the Branch Manager at our registered office address.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="process" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Multi-Level Resolution Process
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Our structured 4-level approach to handling and resolving grievances as per RBI guidelines.
                </p>
              </div>

              <div className="grid gap-6">
                {escalationProcess.map((step, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: index === 0 ? '#0052FF' : index === 1 ? '#2563EB' : index === 2 ? '#1E2A3B' : '#DC2626' }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold" style={{ color: '#1E2A3B' }}>
                              {step.level}: {step.handler}
                            </h3>
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {step.timeline}
                            </Badge>
                          </div>
                          <p className="text-gray-700 mb-4">
                            {step.description}
                          </p>
                          
                          {/* Contact Details for each level */}
                          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                            <h4 className="font-medium text-gray-900">Contact Information:</h4>
                            {step.contact.name && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-600" />
                                <span className="text-sm text-gray-700">{step.contact.name}</span>
                              </div>
                            )}
                            {step.contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-600" />
                                <span className="text-sm text-gray-700">{step.contact.email}</span>
                              </div>
                            )}
                            {step.contact.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-600" />
                                <span className="text-sm text-gray-700">{step.contact.phone}</span>
                              </div>
                            )}
                            {step.contact.address && (
                              <div className="flex items-start gap-2">
                                <Building className="h-4 w-4 text-gray-600 mt-0.5" />
                                <span className="text-sm text-gray-700">{step.contact.address}</span>
                              </div>
                            )}
                            {step.contact.method && (
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
                                <span className="text-sm text-gray-700">{step.contact.method}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {index < escalationProcess.length - 1 && (
                          <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="h-6 w-6 mt-1" style={{ color: '#0052FF' }} />
                    <div>
                      <h3 className="text-lg mb-2" style={{ color: '#1E2A3B' }}>
                        Our Commitment
                      </h3>
                      <p style={{ color: '#1E2A3B' }}>
                        We are committed to fair and transparent resolution of all grievances. Every complaint is taken seriously 
                        and investigated thoroughly. You will be kept informed at each stage of the resolution process. If you are 
                        not satisfied with our response at any level, you have the right to escalate to the next level.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Contact Information
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Reach out to us through the appropriate channel based on your grievance level.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Level 1 & 2 Contacts */}
                <Card>
                  <CardHeader>
                    <CardTitle style={{ color: '#1E2A3B' }}>Primary Contact (Level 1 & 2)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2" style={{ color: '#1E2A3B' }}>Customer Care & Grievance Officer</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div>
                            <div style={{ color: '#1E2A3B' }}>Mr. Kowshik (Grievance Redressal Officer)</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div style={{ color: '#1E2A3B' }}>grievance@creditlab.in</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div style={{ color: '#1E2A3B' }}>+91 9346551691</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Building className="h-5 w-5 mt-1" style={{ color: '#0052FF' }} />
                          <div className="text-sm" style={{ color: '#1E2A3B' }}>
                            #30 2nd Floor 1st Main BHCS Layout<br />
                            BTM 2nd Stage Opp Gopalan Innovation Mall<br />
                            Bengaluru, Karnataka 560076
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Level 3 Contact */}
                <Card>
                  <CardHeader>
                    <CardTitle style={{ color: '#1E2A3B' }}>Chief Nodal Officer (Level 3)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div>
                            <div style={{ color: '#1E2A3B' }}>MR. Abhishek M R</div>
                            <div className="text-sm text-gray-600">Chief Nodal Officer</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div style={{ color: '#1E2A3B' }}>abhi@creditlab.in</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5" style={{ color: '#0052FF' }} />
                          <div style={{ color: '#1E2A3B' }}>+91 7259333111</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-700">
                        <strong>Escalation Condition:</strong> Contact if not satisfied with response from Level 1 & 2, 
                        or if no response received within 15 days.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* RBI Contact */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle style={{ color: '#1E2A3B' }}>Reserve Bank of India (Level 4)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5" style={{ color: '#0052FF' }} />
                            <div>
                              <div style={{ color: '#1E2A3B' }}>Reserve Bank of India</div>
                              <div className="text-sm text-gray-600">Kolkata Regional Office</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5" style={{ color: '#0052FF' }} />
                            <div style={{ color: '#1E2A3B' }}>rdkolkata@rbi.org.in</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5" style={{ color: '#0052FF' }} />
                            <div style={{ color: '#1E2A3B' }}>033 2230 3299</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 mt-1" style={{ color: '#0052FF' }} />
                            <div className="text-sm" style={{ color: '#1E2A3B' }}>
                              15, Netaji Subhas Rd, Fairley Place<br />
                              B.B.D. Bagh, Kolkata<br />
                              West Bengal 700001
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-2">Escalation Condition</h4>
                        <p className="text-sm text-red-700">
                          You may approach RBI if:<br />
                          • No response received within 1 month from initial complaint<br />
                          • Dissatisfied with response received at all internal levels<br />
                          • You can also file complaints on RBI CMS portal: cms.rbi.org.in
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="faq" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
                  Frequently Asked Questions
                </h2>
                <p style={{ color: '#1E2A3B' }}>
                  Common questions about our grievance redressal mechanism.
                </p>
              </div>

              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <h3 className="text-lg mb-3" style={{ color: '#1E2A3B' }}>
                        {faq.question}
                      </h3>
                      <p style={{ color: '#1E2A3B' }}>
                        {faq.answer}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <h3 className="text-lg mb-4" style={{ color: '#1E2A3B' }}>
                      Still have questions?
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button 
                        onClick={() => navigate('/contact')}
                        style={{ backgroundColor: '#0052FF' }}
                      >
                        Contact Support
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => navigate('/terms')}
                      >
                        View Terms & Conditions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}