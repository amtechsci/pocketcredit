import { useState, useEffect, useRef, type ReactNode } from 'react';
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

/** Searchable single-select for long option lists (education / industry / department / designation). */
function FilterableSelect({
  id,
  label,
  icon,
  value,
  options,
  placeholder,
  disabled,
  onChange
}: {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(filter.trim().toLowerCase())
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div className="space-y-2" ref={wrapRef}>
      <Label htmlFor={id} className="text-base flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            setFilter('');
          }}
          className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <span className={value ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
            {value || placeholder}
          </span>
          <Search className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`Filter ${typeof label === 'string' ? label.toLowerCase() : 'options'}...`}
                  className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${
                        value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800'
                      }`}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                        setFilter('');
                      }}
                    >
                      <span className="truncate">{opt}</span>
                      {value === opt && <Check className="w-4 h-4 shrink-0 ml-2" />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export const EmploymentDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Get applicationId from URL params, state, or fetch latest
  const urlParams = new URLSearchParams(location.search);
  const urlAppId = urlParams.get('applicationId');
  const stateAppId = (location.state as any)?.applicationId;
  const [applicationId, setApplicationId] = useState<number | null>(
    urlAppId ? parseInt(urlAppId) : (stateAppId ? (typeof stateAppId === 'string' ? parseInt(stateAppId) : stateAppId) : null)
  );

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
        // Just pre-fill form if data exists, don't handle redirection here
        // StepGuard already handles redirection if the step is complete
        const response = await apiService.getEmploymentDetailsStatus();

        if (response.status === 'success' && response.data?.employmentData) {
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

          if (response.data.completed) {
            console.log('[EmploymentDetails] Details are complete, StepGuard will handle any needed redirection.');
          } else {
            // Data exists but not completed - form is pre-filled, user can review and submit
            console.log('[EmploymentDetails] Found existing employment details, form pre-filled for review.');
          }
        }
        setChecking(false);
      } catch (error) {
        console.error('Error checking employment status:', error);
        setChecking(false);
      }
    };

    checkEmploymentStatus();
  }, []);

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
        // toast.success('Employment details saved successfully!');

        // Trigger Credit Check (BRE Engine)
        try {
          // Pass applicationId if available from location state (convert null to undefined)
          const creditCheckResponse = await apiService.checkCreditEligibility(applicationId || undefined);

          // Backend returns 'is_eligible' not 'eligible' - check both for compatibility
          // Type assertion needed because TypeScript interface doesn't match backend response
          // Handle both boolean and number (0/1) formats from database
          const responseData = creditCheckResponse.data as any;
          const isEligible = responseData?.is_eligible === true ||
            (typeof responseData?.is_eligible === 'number' && responseData?.is_eligible === 1) ||
            responseData?.eligible === true ||
            (typeof responseData?.eligible === 'number' && responseData?.eligible === 1);

          if (creditCheckResponse.status === 'success' && isEligible) {
            // Use unified progress engine to determine next step
            setTimeout(async () => {
              try {
                // Ensure we have applicationId - fetch latest if missing
                let appId = applicationId;
                if (!appId) {
                  try {
                    const appsResponse = await apiService.getLoanApplications();
                    if (appsResponse.success || appsResponse.status === 'success') {
                      const apps = appsResponse.data?.applications || [];
                      const activeApp = apps.find((app: any) => 
                        ['submitted', 'under_review', 'follow_up', 'pending', 'in_progress'].includes(app.status)
                      );
                      appId = activeApp?.id || null;
                      if (appId) setApplicationId(appId);
                    }
                  } catch (e) {
                    console.error('[EmploymentDetails] Error fetching application:', e);
                  }
                }
                
                const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                const progress = await getOnboardingProgress(appId);
                const nextRoute = getStepRoute(progress.currentStep, appId);
                console.log('[EmploymentDetails] Next step from engine:', progress.currentStep, '->', nextRoute, 'appId:', appId);
                navigate(nextRoute, { replace: true });
              } catch (error) {
                console.error('[EmploymentDetails] Error getting next step, using fallback:', error);
                // Fallback to bank statement (old behavior)
                navigate('/loan-application/bank-statement', {
                  state: { applicationId },
                  replace: true
                });
              }
            }, 1000);
          } else {
            // Failed BRE or other checks
            // Backend returns 'reasons' array, not 'rejection_reasons'
            const reasons = responseData?.reasons || responseData?.rejection_reasons || [];
            const displayReason = Array.isArray(reasons) && reasons.length > 0
              ? reasons[0]
              : (responseData?.hold_reason || 'Credit criteria not met');

            toast.error(`Application placed on hold: ${displayReason}`, { duration: 5000 });

            // Redirect to dashboard where they will see the On Hold status
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 3000);
          }
        } catch (checkError) {
          console.error('Credit check error:', checkError);
          // If technical error, still let them know something went wrong but maybe don't block hard if it's just a network blip?
          // Requirement says "take to next step ONLY if below conditions are passed". So we must block.
          toast.error('Unable to verify eligibility. Please contact support or try again later.');
        }

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
              <FilterableSelect
                id="education"
                label={<>Education <span className="text-red-500">*</span></>}
                value={formData.education}
                options={EDUCATION_OPTIONS}
                placeholder="Filter & select education"
                disabled={loading}
                onChange={(v) => handleInputChange('education', v)}
              />

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
                <FilterableSelect
                  id="industry"
                  label={<>Industry <span className="text-red-500">*</span></>}
                  value={formData.industry}
                  options={INDUSTRIES}
                  placeholder="Filter & select industry"
                  disabled={loading}
                  onChange={(v) => handleInputChange('industry', v)}
                />
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
                <FilterableSelect
                  id="department"
                  icon={<Users className="w-4 h-4" />}
                  label={<>Department <span className="text-red-500">*</span></>}
                  value={formData.department}
                  options={DEPARTMENTS}
                  placeholder="Filter & select department"
                  disabled={loading}
                  onChange={(v) => handleInputChange('department', v)}
                />
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
              <FilterableSelect
                id="designation"
                icon={<Award className="w-4 h-4" />}
                label={<>Designation <span className="text-red-500">*</span></>}
                value={formData.designation}
                options={DESIGNATIONS}
                placeholder="Filter & select designation"
                disabled={loading}
                onChange={(v) => handleInputChange('designation', v)}
              />

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

