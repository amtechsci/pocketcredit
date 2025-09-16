import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
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

interface ExistingReference {
  id: number;
  user_id: number;
  loan_application_id: number;
  name: string;
  phone: string;
  relation: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const RELATION_OPTIONS = [
  'Family',
  'Friend',
  'Colleague',
  'Relative',
  'Neighbor'
];

export function ReferenceDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [existingReferences, setExistingReferences] = useState<ExistingReference[]>([]);
  const [references, setReferences] = useState<ReferenceData[]>([
    { name: '', phone: '', relation: 'Family' },
    { name: '', phone: '', relation: 'Family' },
    { name: '', phone: '', relation: 'Friend' }
  ]);
  const [confirmDetails, setConfirmDetails] = useState(false);

  // Get application ID from URL params
  useEffect(() => {
    const appId = searchParams.get('applicationId');
    if (appId) {
      setApplicationId(appId);
    } else {
      navigate('/dashboard');
    }
  }, [searchParams, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  // Fetch existing references
  useEffect(() => {
    const fetchReferences = async () => {
      if (!applicationId) return;

      try {
        setLoading(true);
        const response = await apiService.getReferenceDetails(applicationId);
        if (response.success) {
          setExistingReferences(response.data);
          // If references exist, populate the form
          if (response.data.length > 0) {
            setReferences([
              { 
                name: response.data[0]?.name || '', 
                phone: response.data[0]?.phone || '', 
                relation: response.data[0]?.relation || 'Family' 
              },
              { 
                name: response.data[1]?.name || '', 
                phone: response.data[1]?.phone || '', 
                relation: response.data[1]?.relation || 'Family' 
              },
              { 
                name: response.data[2]?.name || '', 
                phone: response.data[2]?.phone || '', 
                relation: response.data[2]?.relation || 'Friend' 
              }
            ]);
          }
        }
      } catch (error) {
        console.log('No existing references found');
      } finally {
        setLoading(false);
      }
    };

    fetchReferences();
  }, [applicationId]);

  const updateReference = (index: number, field: keyof ReferenceData, value: string) => {
    const updated = [...references];
    updated[index] = { ...updated[index], [field]: value };
    setReferences(updated);
  };

  const validateReferences = () => {
    // Check if all 3 references are filled
    for (let i = 0; i < 3; i++) {
      const ref = references[i];
      if (!ref.name.trim() || !ref.phone.trim() || !ref.relation.trim()) {
        toast.error(`Reference ${i + 1}: Please fill in all fields`);
        return false;
      }
    }

    // Check for duplicate phone numbers
    const phoneNumbers = references.map(ref => ref.phone).filter(phone => phone.trim());
    const uniquePhones = [...new Set(phoneNumbers)];
    if (uniquePhones.length !== phoneNumbers.length) {
      toast.error('All reference phone numbers must be different');
      return false;
    }

    // Validate phone numbers
    const phoneRegex = /^[6-9]\d{9}$/;
    for (let i = 0; i < 3; i++) {
      if (references[i].phone.trim() && !phoneRegex.test(references[i].phone)) {
        toast.error(`Reference ${i + 1}: Please enter a valid 10-digit mobile number starting with 6-9`);
        return false;
      }
    }

    // Check confirmation checkbox
    if (!confirmDetails) {
      toast.error('Please confirm the reference contact numbers');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    if (!validateReferences()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.saveReferenceDetails({
        application_id: parseInt(applicationId),
        references: references.filter(ref => ref.name.trim() && ref.phone.trim() && ref.relation.trim())
      });

      if (response.success) {
        toast.success('Reference details saved successfully!');
        // Refresh references
        const refResponse = await apiService.getReferenceDetails(applicationId);
        if (refResponse.success) {
          setExistingReferences(refResponse.data);
        }
        // Navigate to completion or next step
        navigate('/loan-application/steps?applicationId=' + applicationId + '&step=complete');
      } else {
        toast.error(response.message || 'Failed to save reference details');
      }
    } catch (error: any) {
      console.error('Reference details error:', error);
      toast.error(error.message || 'Failed to save reference details');
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 p-0 h-auto text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading reference details...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Existing References Display */}
            {existingReferences.length > 0 && (
              <Card className="p-6 mb-8 border-green-200 bg-green-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Current References</h3>
                      <p className="text-sm text-gray-600">You have {existingReferences.length} reference{existingReferences.length !== 1 ? 's' : ''} saved</p>
                    </div>
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    ✓ Completed
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {existingReferences.map((ref, index) => (
                    <div key={ref.id} className="p-4 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Reference {index + 1}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          ref.status === 'verified' ? 'bg-green-100 text-green-800' :
                          ref.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {ref.status.charAt(0).toUpperCase() + ref.status.slice(1)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                          <p className="font-medium text-gray-900">{ref.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                          <p className="font-medium text-gray-900">{ref.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Relation</p>
                          <p className="font-medium text-gray-900">{ref.relation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Reference Form */}
            <Card className="shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Reference Details</h3>
                <p className="text-gray-600">
                  Please provide 3 reference contact numbers (family/friends for quick verification)
                </p>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {references.map((reference, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                      {/* Reference Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">{index + 1}</span>
                        </div>
                        <h4 className="text-base font-semibold text-gray-900">Reference {index + 1}</h4>
                      </div>
                      
                      {/* Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Name Field */}
                        <div className="space-y-1">
                          <Label htmlFor={`name-${index}`} className="text-sm font-medium text-gray-700">
                            Name *
                          </Label>
                          <Input
                            id={`name-${index}`}
                            type="text"
                            value={reference.name}
                            onChange={(e) => updateReference(index, 'name', e.target.value)}
                            placeholder="Enter full name"
                            className="h-10 bg-white"
                            required
                          />
                        </div>

                        {/* Phone Field with +91 prefix */}
                        <div className="space-y-1">
                          <Label htmlFor={`phone-${index}`} className="text-sm font-medium text-gray-700">
                            Mobile Number *
                          </Label>
                          <div className="flex">
                            <div className="flex items-center px-3 bg-white border border-gray-300 border-r-0 rounded-l-md">
                              <span className="text-gray-700 font-medium text-sm">+91</span>
                            </div>
                            <Input
                              id={`phone-${index}`}
                              type="tel"
                              value={reference.phone}
                              onChange={(e) => updateReference(index, 'phone', e.target.value)}
                              placeholder="Enter mobile number"
                              className="h-10 rounded-l-none bg-white"
                              maxLength={10}
                              required
                            />
                          </div>
                        </div>

                        {/* Relation Dropdown */}
                        <div className="space-y-1">
                          <Label htmlFor={`relation-${index}`} className="text-sm font-medium text-gray-700">
                            Relation *
                          </Label>
                          <Select
                            value={reference.relation}
                            onValueChange={(value) => updateReference(index, 'relation', value)}
                          >
                            <SelectTrigger className="h-10 bg-white">
                              <SelectValue placeholder="Select relation" />
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

                  {/* Confirmation Checkbox */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="confirmDetails"
                        checked={confirmDetails}
                        onChange={(e) => setConfirmDetails(e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <label htmlFor="confirmDetails" className="cursor-pointer">
                          I confirm that the reference contact numbers provided are correct and belong to people who can verify my identity. I understand that these references may be contacted for verification purposes.
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-6">
                    <Button
                      type="submit"
                      disabled={loading || !confirmDetails}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving References...
                        </>
                      ) : (
                        'Save Reference Details'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}