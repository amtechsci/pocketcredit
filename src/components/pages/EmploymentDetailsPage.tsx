import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Briefcase, Building, Users, Award, ArrowRight, Check, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

interface EmploymentData {
  company_name: string;
  monthly_net_income: string;
  income_confirmed: boolean;
  education: string;
  salary_date: string;
  industry: string;
  industry_other: string;
  department: string;
  department_other: string;
  designation: string;
}

interface CompanySuggestion {
  id: number;
  company_name: string;
  industry: string | null;
  is_verified: boolean;
}

const INDUSTRIES = [
  'Police / Army',
  'Lawyer / Advocate / Judge / Law related',
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

const EDUCATION_OPTIONS = [
  'Below 10th',
  'Secondary School (10th)',
  '12th / +2 / Intermediate',
  'Diploma / Degree',
  "Bachelor's / Graduate",
  "PG / Master's"
];

const DEPARTMENTS = [
  'Driving',
  'Teaching',
  'Lawyer / Advocate / Judge / Law related',
  'Police',
  'Doctor',
  'Army',
  'Collections / Recovery Team',
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
  'Lawyer / Advocate / Judge / Law related',
  'Police',
  'Driver',
  'Doctor',
  'Army',
  'Collection Agent / Recovery officer',
  'Executive level 1',
  'Executive level 2',
  'Team Leader',
  'Manager',
  'Senior Manager',
  'CEO/ director / Vice President / Authorised signatory / CBO / CFO / Company Secretary (CS)'
];

export const EmploymentDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EmploymentData>({
    company_name: '',
    monthly_net_income: '',
    income_confirmed: false,
    education: '',
    salary_date: '',
    industry: '',
    industry_other: '',
    department: '',
    department_other: '',
    designation: ''
  });

  // Company autocomplete state
  const [companySuggestions, setCompanySuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  // Check if employment details already completed on mount
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkEmploymentStatus = async () => {
      try {
        // Check if employment details already exist (user-specific, no longer requires applicationId)
        const response = await apiService.getEmploymentDetailsStatus();
        
        if (response.status === 'success' && response.data?.completed) {
          // Employment details already completed - redirect to next step
          toast.success('Employment details already submitted! Proceeding to next step...');
          setTimeout(() => {
            navigate('/loan-application/bank-statement', {
              state: { applicationId }
            });
          }, 1500);
        } else {
          // Not complete - pre-fill form if data exists
          if (response.data?.employmentData) {
            const data = response.data.employmentData;
            setFormData(prev => ({
              ...prev,
              company_name: data.company_name || prev.company_name,
              designation: data.designation || prev.designation,
              industry: data.industry || prev.industry,
              department: data.department || prev.department,
              education: data.education || prev.education,
              monthly_net_income: data.monthly_net_income ? data.monthly_net_income.toString() : prev.monthly_net_income,
              salary_date: data.salary_date ? data.salary_date.toString() : prev.salary_date
            }));
            toast.info('Found existing employment details. Please review and submit.');
          }
          setChecking(false);
        }
      } catch (error) {
        console.error('Error checking employment status:', error);
        // On error, show the form anyway
        setChecking(false);
      }
    };

    checkEmploymentStatus();
  }, [navigate]);

  // Load initial companies on mount
  useEffect(() => {
    const loadInitialCompanies = async () => {
      try {
        const response = await apiService.searchCompanies('', 10);
        if (response.success && response.data) {
          setCompanySuggestions(response.data);
        }
      } catch (error) {
        console.error('Failed to load initial companies:', error);
      }
    };

    loadInitialCompanies();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node) &&
          companyInputRef.current && !companyInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search companies with debounce
  const searchCompanies = async (query: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // If query is empty or too short, load initial popular companies
    if (query.trim().length < 2) {
      const timeout = setTimeout(async () => {
        setLoadingSuggestions(true);
        try {
          const response = await apiService.searchCompanies('', 10);
          if (response.success && response.data) {
            setCompanySuggestions(response.data);
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error('Failed to load companies:', error);
        } finally {
          setLoadingSuggestions(false);
        }
      }, 200);
      
      setSearchTimeout(timeout);
      return;
    }

    // Search with user query
    const timeout = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const response = await apiService.searchCompanies(query, 15);
        if (response.success && response.data) {
          setCompanySuggestions(response.data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Failed to search companies:', error);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);
  };

  const handleInputChange = (field: keyof EmploymentData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value as any }));
    
    // Trigger company search when company_name changes
    if (field === 'company_name') {
      searchCompanies(value as string);
    }
  };

  const handleSelectCompany = (company: CompanySuggestion) => {
    setFormData(prev => ({ 
      ...prev, 
      company_name: company.company_name,
      // Auto-fill industry if available
      industry: company.industry || prev.industry
    }));
    setShowSuggestions(false);
    setCompanySuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.company_name.trim()) {
      toast.error('Please enter company name');
      return;
    }

    if (!formData.monthly_net_income || parseFloat(formData.monthly_net_income) <= 0) {
      toast.error('Please enter a valid monthly net income');
      return;
    }

    if (!formData.income_confirmed) {
      toast.error('Please confirm your income details');
      return;
    }

    if (!formData.education) {
      toast.error('Please select your education level');
      return;
    }

    if (!formData.salary_date) {
      toast.error('Please select your salary date');
      return;
    }

    if (!formData.industry) {
      toast.error('Please select industry');
      return;
    }

    if (formData.industry === 'Others' && !formData.industry_other.trim()) {
      toast.error('Please specify the industry');
      return;
    }

    if (!formData.department) {
      toast.error('Please select department');
      return;
    }

    if (formData.department === 'Others' && !formData.department_other.trim()) {
      toast.error('Please specify the department');
      return;
    }

    if (!formData.designation) {
      toast.error('Please select designation');
      return;
    }

    setLoading(true);

    try {
      // Employment details is now user-specific (one-time step), no longer requires application_id
      const response = await apiService.submitEmploymentDetails({
        company_name: formData.company_name,
        monthly_net_income: parseFloat(formData.monthly_net_income),
        income_confirmed: formData.income_confirmed,
        education: formData.education,
        salary_date: parseInt(formData.salary_date),
        industry: formData.industry === 'Others' ? formData.industry_other : formData.industry,
        department: formData.department === 'Others' ? formData.department_other : formData.department,
        designation: formData.designation
        // application_id is no longer required - this is user-specific
      });

      if (response.success) {
        toast.success('Employment details saved successfully!');
        
        // Wait a moment for backend to update loan application step, then navigate
        setTimeout(() => {
          navigate('/loan-application/bank-statement', { replace: true });
        }, 500);
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

  // Show loading while checking employment status
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking employment details status...</p>
        </div>
      </div>
    );
  }

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
              {/* Company Name with Autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="company_name" className="text-base flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    ref={companyInputRef}
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    onFocus={() => {
                      // Show suggestions if we have any (initial or search results)
                      if (companySuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="Click to see popular companies or start typing"
                    className="h-11 pr-10"
                    disabled={loading}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  
                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && (companySuggestions.length > 0 || loadingSuggestions) && (
                    <div 
                      ref={suggestionRef}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    >
                      {loadingSuggestions ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Searching companies...
                        </div>
                      ) : (
                        <>
                          {companySuggestions.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              onClick={() => handleSelectCompany(company)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors flex items-start justify-between gap-2"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {company.company_name}
                                  </span>
                                  {company.is_verified && (
                                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                {company.industry && (
                                  <span className="text-xs text-gray-500 block mt-1">
                                    {company.industry}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                          <div className="p-3 bg-gray-50 border-t border-gray-200">
                            <p className="text-xs text-gray-600 text-center">
                              {formData.company_name.trim() 
                                ? "Don't see your company? You can still type and submit"
                                : "Showing popular companies. Type to search or enter manually"
                              }
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click to see popular companies, or start typing to search
                </p>
              </div>

              {/* Monthly Net Income */}
              <div className="space-y-2">
                <Label htmlFor="monthly_net_income" className="text-base">
                  Monthly Net Income (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="monthly_net_income"
                  type="number"
                  value={formData.monthly_net_income}
                  onChange={(e) => handleInputChange('monthly_net_income', e.target.value)}
                  placeholder="Enter monthly net income"
                  className="h-11"
                  min="0"
                  step="1000"
                  disabled={loading}
                  required
                />
              </div>

              {/* Income Confirmation Checkbox */}
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="income_confirmed"
                    checked={formData.income_confirmed}
                    onChange={(e) => setFormData(prev => ({ ...prev, income_confirmed: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={loading}
                    required
                  />
                  <label htmlFor="income_confirmed" className="text-sm text-gray-700 cursor-pointer">
                    I hereby confirm that the monthly income of my household (me & my family, including my spouse & unmarried children) exceeds Rs.25,000 & the annual income exceeds Rs.3,00,000. <span className="text-red-500">*</span>
                  </label>
                </div>
              </div>

              {/* Education */}
              <div className="space-y-2">
                <Label className="text-base">
                  Education <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2">
                  {EDUCATION_OPTIONS.map((edu) => (
                    <div key={edu} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                      <input
                        type="radio"
                        id={`education_${edu}`}
                        name="education"
                        value={edu}
                        checked={formData.education === edu}
                        onChange={(e) => handleInputChange('education', e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        disabled={loading}
                        required
                      />
                      <label htmlFor={`education_${edu}`} className="text-sm text-gray-700 cursor-pointer flex-1">
                        {edu}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Salary Date */}
              <div className="space-y-2">
                <Label htmlFor="salary_date" className="text-base">
                  Salary Date <span className="text-red-500">*</span>
                </Label>
                <select
                  id="salary_date"
                  value={formData.salary_date}
                  onChange={(e) => handleInputChange('salary_date', e.target.value)}
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                  required
                >
                  <option value="">Select salary date</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day.toString()}>
                      {day}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the day of the month when you receive your salary
                </p>
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
                {formData.industry === 'Others' && (
                  <Input
                    id="industry_other"
                    type="text"
                    value={formData.industry_other}
                    onChange={(e) => handleInputChange('industry_other', e.target.value)}
                    placeholder="Please specify the industry"
                    className="h-11 mt-2"
                    disabled={loading}
                    required
                  />
                )}
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
                {formData.department === 'Others' && (
                  <Input
                    id="department_other"
                    type="text"
                    value={formData.department_other}
                    onChange={(e) => handleInputChange('department_other', e.target.value)}
                    placeholder="Please specify the department"
                    className="h-11 mt-2"
                    disabled={loading}
                    required
                  />
                )}
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

