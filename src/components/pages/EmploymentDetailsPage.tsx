import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Briefcase, Building, Users, Award, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

interface EmploymentData {
  company_name: string;
  industry: string;
  department: string;
  designation: string;
}

const INDUSTRIES = [
  'IT (Information Technology) / Software',
  'Health Care',
  'Education',
  'E-commerce',
  'Hospitality',
  'Automotive',
  'Food Service',
  'Manufacturing',
  'Transport / Logistics',
  'Banking / Finance',
  'Construction',
  'Farming / Agriculture',
  'Medical / Pharmacy',
  'Textiles',
  'Entertainment',
  'Others'
];

const DEPARTMENTS = [
  'Administration',
  'Business Development',
  'Client Relations / Account Management',
  'Customer Support / Customer Success',
  'Data Analytics / Business Intelligence',
  'Engineering / Software Development',
  'Executive / Management',
  'Finance & Accounts',
  'Human Resources (HR)',
  'Information Technology (IT)',
  'Internal Audit / Risk Management',
  'Legal & Compliance',
  'Logistics & Warehouse',
  'Marketing',
  'Office Administration / Facilities',
  'Operations',
  'Procurement / Purchase',
  'Product Management',
  'Production / Manufacturing',
  'Project Management Office (PMO)',
  'Quality Control / Quality Assurance',
  'Research & Development (R&D)',
  'Sales',
  'Security & Housekeeping',
  'Strategy & Planning',
  'Supply Chain Management',
  'Transport / Fleet Management',
  'Others'
];

const DESIGNATIONS = [
  'Executive Level 1',
  'Executive Level 2',
  'Team Leader',
  'Manager',
  'Senior Manager',
  'CEO / Director / Vice President / Authorised Signatory / CBO / CFO / Company Secretary (CS)'
];

export const EmploymentDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EmploymentData>({
    company_name: '',
    industry: '',
    department: '',
    designation: ''
  });

  const handleInputChange = (field: keyof EmploymentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.company_name.trim()) {
      toast.error('Please enter company name');
      return;
    }

    if (!formData.industry) {
      toast.error('Please select industry');
      return;
    }

    if (!formData.department) {
      toast.error('Please select department');
      return;
    }

    if (!formData.designation) {
      toast.error('Please select designation');
      return;
    }

    if (!applicationId) {
      toast.error('Application ID is missing');
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.submitEmploymentDetails({
        ...formData,
        application_id: applicationId
      });

      if (response.success) {
        toast.success('Employment details saved successfully!');
        
        // Navigate to loan application steps
        navigate(`/loan-application/steps?applicationId=${applicationId}`);
      } else {
        toast.error(response.message || 'Failed to save employment details');
      }
    } catch (error: any) {
      console.error('Employment details submission error:', error);
      toast.error(error.response?.data?.message || 'Failed to save employment details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employment Details</h1>
          <p className="text-gray-600">
            Please provide your current employment information
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
            <CardDescription>
              All fields are required for loan processing
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-base flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Enter your company name"
                  className="h-11"
                  disabled={loading}
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-base">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <select
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Department <span className="text-red-500">*</span>
                </Label>
                <select
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div className="space-y-2">
                <Label htmlFor="designation" className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Designation <span className="text-red-500">*</span>
                </Label>
                <select
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => handleInputChange('designation', e.target.value)}
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map((desig) => (
                    <option key={desig} value={desig}>
                      {desig}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base"
                >
                  {loading ? 'Saving...' : 'Continue to Next Step'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Your employment details help us verify your eligibility and process your loan application faster. All information is kept confidential.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmploymentDetailsPage;

