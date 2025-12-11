import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Building, Mail, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface ReferenceData {
  name: string;
  phone: string;
  relation: string;
}

interface AlternateData {
  alternate_mobile: string;
  company_name: string;
  company_email: string;
}

const RELATION_OPTIONS = [
  'Family',
  'Friend',
  'Colleague',
  'Relative',
  'Neighbor'
];

interface EnhancedUserReferencesPageProps {
  onComplete?: () => void;
  showBackButton?: boolean;
  embedded?: boolean; // If true, don't render header and page wrapper
}

export function EnhancedUserReferencesPage({ 
  onComplete, 
  showBackButton = true,
  embedded = false
}: EnhancedUserReferencesPageProps = {}) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [references, setReferences] = useState<ReferenceData[]>([
    { name: '', phone: '', relation: 'Family' },
    { name: '', phone: '', relation: 'Family' },
    { name: '', phone: '', relation: 'Friend' }
  ]);
  
  const [alternateData, setAlternateData] = useState<AlternateData>({
    alternate_mobile: '',
    company_name: '',
    company_email: ''
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    fetchExistingData();
  }, [isAuthenticated, navigate]);

  const fetchExistingData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserReferences();
      
      if (response.data) {
        // Load existing references
        if (response.data.references && response.data.references.length > 0) {
          const existingRefs = response.data.references.slice(0, 3);
          const newRefs = [...references];
          
          existingRefs.forEach((ref: any, index: number) => {
            if (index < 3) {
              newRefs[index] = {
                name: ref.name || '',
                phone: ref.phone || '',
                relation: ref.relation || (index === 2 ? 'Friend' : 'Family')
              };
            }
          });
          
          setReferences(newRefs);
        }
        
        // Load existing alternate data
        if (response.data.alternate_data) {
          setAlternateData({
            alternate_mobile: response.data.alternate_data.alternate_mobile || '',
            company_name: response.data.alternate_data.company_name || '',
            company_email: response.data.alternate_data.company_email || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching existing data:', error);
      toast.error('Failed to load existing data');
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceChange = (index: number, field: keyof ReferenceData, value: string) => {
    const newReferences = [...references];
    newReferences[index] = { ...newReferences[index], [field]: value };
    setReferences(newReferences);
  };

  const handleAlternateDataChange = (field: keyof AlternateData, value: string) => {
    setAlternateData(prev => ({ ...prev, [field]: value }));
  };

  // Check if a phone number is duplicated or matches user's registered number
  const isPhoneDuplicate = (phone: string, excludeIndex?: number) => {
    if (!phone.trim()) return false;
    
    // First check: User's registered phone number cannot be used as reference or alternate
    if (user?.phone && phone === user.phone) {
      return true; // This is the user's own number - not allowed
    }
    
    // If checking a reference phone (excludeIndex is defined)
    if (excludeIndex !== undefined) {
      // Check against other references and alternate mobile
      const otherReferences = references.filter((_, index) => index !== excludeIndex).map(ref => ref.phone);
      const allOtherPhones = [...otherReferences, alternateData.alternate_mobile].filter(p => p.trim() !== '');
      return allOtherPhones.includes(phone);
    } else {
      // If checking alternate mobile (excludeIndex is undefined), only check against references
      const allReferencePhones = references.map(ref => ref.phone).filter(p => p.trim() !== '');
      return allReferencePhones.includes(phone);
    }
  };

  // Get validation status for a phone input
  const getPhoneValidationStatus = (phone: string, excludeIndex?: number) => {
    if (!phone.trim()) return 'neutral';
    if (!/^[6-9]\d{9}$/.test(phone)) return 'invalid';
    
    // Check if it's the user's own number
    if (user?.phone && phone === user.phone) return 'own_number';
    
    if (isPhoneDuplicate(phone, excludeIndex)) return 'duplicate';
    return 'valid';
  };

  // Get specific error message for phone validation
  const getPhoneErrorMessage = (phone: string, excludeIndex?: number) => {
    if (!phone.trim()) return '';
    if (!/^[6-9]\d{9}$/.test(phone)) return 'Invalid phone number format';
    if (user?.phone && phone === user.phone) return 'Cannot use your own registered phone number';
    if (isPhoneDuplicate(phone, excludeIndex)) {
      if (excludeIndex !== undefined) {
        return 'This number is already used in another field';
      } else {
        return 'This number is already used in a reference';
      }
    }
    return '';
  };

  const validateForm = () => {
    // Validate all 3 references are filled
    for (let i = 0; i < 3; i++) {
      if (!references[i].name.trim() || !references[i].phone.trim() || !references[i].relation) {
        toast.error(`Please fill all fields for Reference ${i + 1}`);
        return false;
      }
      
      // Validate phone format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(references[i].phone)) {
        toast.error(`Invalid phone number format for Reference ${i + 1}`);
        return false;
      }
      
      // Check if reference phone is user's own number
      if (user?.phone && references[i].phone === user.phone) {
        toast.error(`Reference ${i + 1}: Cannot use your own registered phone number`);
        return false;
      }
    }
    
    // Validate alternate data
    if (!alternateData.alternate_mobile.trim() || !alternateData.company_name.trim() || !alternateData.company_email.trim()) {
      toast.error('Please fill all alternate data fields');
      return false;
    }
    
    // Validate alternate mobile format
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(alternateData.alternate_mobile)) {
      toast.error('Invalid alternate mobile number format');
      return false;
    }
    
    // Check if alternate mobile is user's own number
    if (user?.phone && alternateData.alternate_mobile === user.phone) {
      toast.error('Alternate mobile cannot be your own registered phone number');
      return false;
    }
    
    // Validate company email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(alternateData.company_email)) {
      toast.error('Invalid company email format');
      return false;
    }
    
    // Check for duplicate phone numbers across all fields
    const allPhones = [
      ...references.map(ref => ref.phone),
      alternateData.alternate_mobile
    ];
    
    // Check for duplicates within references
    for (let i = 0; i < references.length; i++) {
      for (let j = i + 1; j < references.length; j++) {
        if (references[i].phone === references[j].phone) {
          toast.error(`Reference ${i + 1} and Reference ${j + 1} have the same phone number`);
          return false;
        }
      }
    }
    
    // Check if alternate mobile matches any reference
    const referencePhones = references.map(ref => ref.phone);
    if (referencePhones.includes(alternateData.alternate_mobile)) {
      toast.error('Alternate mobile number cannot be same as any reference number');
      return false;
    }
    
    // Final check: all numbers should be unique
    const uniquePhones = new Set(allPhones);
    if (uniquePhones.size !== allPhones.length) {
      toast.error('All phone numbers must be unique. Please check for duplicates.');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await apiService.saveUserReferences({
        references: references.map(ref => ({
          name: ref.name,
          phone: ref.phone,
          relation: ref.relation
        })),
        alternate_mobile: alternateData.alternate_mobile,
        company_name: alternateData.company_name,
        company_email: alternateData.company_email
      });
      
      if (response.data) {
        toast.success('References and alternate data saved successfully!');
        if (onComplete) {
          onComplete();
        } else {
          navigate(-1); // Go back to previous page
        }
      } else {
        toast.error('Failed to save references');
      }
    } catch (error: any) {
      console.error('Error saving references:', error);
      toast.error(error.message || 'Failed to save references');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const formContent = (
    <>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="mb-8">
          {showBackButton && (
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-6 p-2 h-auto text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Application
            </Button>
          )}
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              References & Verification
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Complete your loan application by providing 3 personal references and employment verification details
            </p>
          </div>
        </div>
      )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Reference Numbers Section */}
          <Card className="p-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Personal References
                </h2>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                Please provide 3 different reference contacts from your family or friends for quick verification and transfers.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {references.map((reference, index) => (
                <div key={index} className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-6 rounded-xl border border-gray-200/50 hover:border-blue-300/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Reference {index + 1}</h3>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        Full Name
                      </Label>
                      <Input
                        id={`name-${index}`}
                        type="text"
                        value={reference.name}
                        onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                        placeholder="Enter full name"
                        className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`phone-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-600" />
                        Phone Number
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">+91</span>
                        <Input
                          id={`phone-${index}`}
                          type="tel"
                          value={reference.phone}
                          onChange={(e) => handleReferenceChange(index, 'phone', e.target.value)}
                          placeholder="9876543210"
                          className={`h-12 pl-16 transition-all duration-200 ${
                            getPhoneValidationStatus(reference.phone, index) === 'valid' 
                              ? 'border-green-300 focus:border-green-500 focus:ring-green-500/20' 
                              : getPhoneValidationStatus(reference.phone, index) === 'duplicate' || 
                                getPhoneValidationStatus(reference.phone, index) === 'own_number' ||
                                getPhoneValidationStatus(reference.phone, index) === 'invalid'
                              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                          }`}
                          maxLength={10}
                          required
                        />
                        {reference.phone && (getPhoneValidationStatus(reference.phone, index) === 'duplicate' || 
                          getPhoneValidationStatus(reference.phone, index) === 'own_number' ||
                          getPhoneValidationStatus(reference.phone, index) === 'invalid') && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          </div>
                        )}
                        {reference.phone && getPhoneValidationStatus(reference.phone, index) === 'valid' && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                        )}
                      </div>
                      {reference.phone && getPhoneErrorMessage(reference.phone, index) && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {getPhoneErrorMessage(reference.phone, index)}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`relation-${index}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        Relationship
                      </Label>
                      <Select
                        value={reference.relation}
                        onValueChange={(value) => handleReferenceChange(index, 'relation', value)}
                      >
                        <SelectTrigger className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Alternate Data Section */}
          <Card className="p-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Employment Verification
                </h2>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                Provide your employment details and alternate contact information for verification purposes.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-3">
                <Label htmlFor="alternate-mobile" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Alternate Mobile
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">+91</span>
                  <Input
                    id="alternate-mobile"
                    type="tel"
                    value={alternateData.alternate_mobile}
                    onChange={(e) => handleAlternateDataChange('alternate_mobile', e.target.value)}
                    placeholder="9876543210"
                    className={`h-12 pl-16 transition-all duration-200 ${
                      getPhoneValidationStatus(alternateData.alternate_mobile) === 'valid' 
                        ? 'border-green-300 focus:border-green-500 focus:ring-green-500/20' 
                        : getPhoneValidationStatus(alternateData.alternate_mobile) === 'duplicate' ||
                          getPhoneValidationStatus(alternateData.alternate_mobile) === 'own_number' ||
                          getPhoneValidationStatus(alternateData.alternate_mobile) === 'invalid'
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                    }`}
                    maxLength={10}
                    required
                  />
                  {alternateData.alternate_mobile && (getPhoneValidationStatus(alternateData.alternate_mobile) === 'duplicate' ||
                    getPhoneValidationStatus(alternateData.alternate_mobile) === 'own_number' ||
                    getPhoneValidationStatus(alternateData.alternate_mobile) === 'invalid') && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  {alternateData.alternate_mobile && getPhoneValidationStatus(alternateData.alternate_mobile) === 'valid' && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {alternateData.alternate_mobile && getPhoneErrorMessage(alternateData.alternate_mobile) && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {getPhoneErrorMessage(alternateData.alternate_mobile)}
                  </p>
                )}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Enter your alternate mobile number or any number from your family. This number cannot be the same as any reference number.
                  </p>
                </div>
              </div>
              
              <div className="lg:col-span-1 space-y-3">
                <Label htmlFor="company-name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-600" />
                  Company Name
                </Label>
                <Input
                  id="company-name"
                  type="text"
                  value={alternateData.company_name}
                  onChange={(e) => handleAlternateDataChange('company_name', e.target.value)}
                  placeholder="Enter your company name"
                  className="h-12 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-200"
                  required
                />
              </div>
              
              <div className="lg:col-span-1 space-y-3">
                <Label htmlFor="company-email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  Company Email
                </Label>
                <Input
                  id="company-email"
                  type="email"
                  value={alternateData.company_email}
                  onChange={(e) => handleAlternateDataChange('company_email', e.target.value)}
                  placeholder="your.name@company.com"
                  className="h-12 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-200"
                  required
                />
                <p className="text-xs text-gray-500">
                  Official, corporate, or work email address
                </p>
              </div>
            </div>
          </Card>

          {/* Submit Button */}
          <div className="text-center pt-8">
            <div className="inline-flex flex-col items-center gap-4">
              <Button
                type="submit"
                disabled={saving || loading}
                className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Saving Information...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Complete Verification
                  </>
                )}
              </Button>
              
              <p className="text-sm text-gray-500 max-w-md">
                By submitting, you confirm that all information provided is accurate and subject to verification.
              </p>
            </div>
          </div>
        </form>
      </>
  );

  // If embedded, return just the form content without page wrapper
  if (embedded) {
    return formContent;
  }

  // Otherwise, return full page with header
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {formContent}
      </div>
    </div>
  );
}
