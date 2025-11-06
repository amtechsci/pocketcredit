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
  industry: string;
  department: string;
  designation: string;
}

interface CompanySuggestion {
  id: number;
  company_name: string;
  industry: string | null;
  is_verified: boolean;
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
      if (!applicationId) {
        setChecking(false);
        return;
      }

      try {
        // Check if employment details already exist for this application
        const response = await apiService.getEmploymentDetailsStatus(applicationId);
        
        if (response.status === 'success' && response.data?.completed) {
          // Employment details already completed - redirect to next step
          toast.success('Employment details already submitted! Proceeding to next step...');
          setTimeout(() => {
            navigate('/loan-application/credit-check', {
              state: { applicationId }
            });
          }, 1500);
        } else {
          // Not complete - show the form
          setChecking(false);
        }
      } catch (error) {
        console.error('Error checking employment status:', error);
        // On error, show the form anyway
        setChecking(false);
      }
    };

    checkEmploymentStatus();
  }, [applicationId, navigate]);

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

  const handleInputChange = (field: keyof EmploymentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Trigger company search when company_name changes
    if (field === 'company_name') {
      searchCompanies(value);
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
        
        // Navigate to credit check (next step after employment)
        navigate('/loan-application/credit-check', {
          state: { applicationId }
        });
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

