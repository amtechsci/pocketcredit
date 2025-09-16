import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, IndianRupee, Building2, Check, ExternalLink, Plus, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface BankDetailsData {
  accountNumber: string;
  ifscCode: string;
  confirmDetails: boolean;
}

interface ExistingBankDetails {
  id: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
  application_number?: string;
  loan_amount?: number;
  loan_purpose?: string;
}

export function BankDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [existingBankDetails, setExistingBankDetails] = useState<ExistingBankDetails[]>([]);
  const [currentBankDetails, setCurrentBankDetails] = useState<ExistingBankDetails | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<BankDetailsData>({
    accountNumber: '',
    ifscCode: '',
    confirmDetails: false
  });

  // Get application ID from URL params
  useEffect(() => {
    const appId = searchParams.get('applicationId');
    if (appId) {
      setApplicationId(appId);
    } else {
      // If no application ID, redirect back to loan application
      navigate('/application');
    }
  }, [searchParams, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  // Fetch existing bank details and current bank details for this application
  const fetchBankDetails = async () => {
    if (!applicationId || !user?.id) return;

    try {
      setLoading(true);
      
      // Fetch current bank details for this application
      try {
        const currentResponse = await apiService.getBankDetails(applicationId);
        if (currentResponse.success) {
          setCurrentBankDetails(currentResponse.data);
        }
      } catch (error) {
        // No existing bank details for this application
        console.log('No existing bank details for this application');
        setCurrentBankDetails(null);
      }

      // Fetch all user's bank details
      const userResponse = await apiService.getUserBankDetails(user.id);
      if (userResponse.success) {
        setExistingBankDetails(userResponse.data);
      }
    } catch (error) {
      console.error('Error fetching bank details:', error);
      toast.error('Failed to load bank details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankDetails();
  }, [applicationId, user?.id]);

  const handleInputChange = (field: keyof BankDetailsData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChooseExistingBank = async (bankId: number) => {
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.chooseBankDetails({
        application_id: parseInt(applicationId),
        bank_details_id: bankId
      });

      if (response.success) {
        toast.success('Bank details selected successfully!');
        // Refresh bank details to show updated state
        await fetchBankDetails();
        setSelectedBankId(null);
      } else {
        toast.error(response.message || 'Failed to select bank details');
      }
    } catch (error: any) {
      console.error('Choose bank details error:', error);
      toast.error(error.message || 'Failed to select bank details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewBank = () => {
    setShowNewForm(true);
    setSelectedBankId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    // Validation
    if (!formData.accountNumber || !formData.ifscCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.confirmDetails) {
      toast.error('Please confirm the bank details');
      return;
    }

    // Basic IFSC code validation (format: 4 letters + 7 characters)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(formData.ifscCode.toUpperCase())) {
      toast.error('Please enter a valid IFSC code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.saveBankDetails({
        application_id: parseInt(applicationId),
        account_number: formData.accountNumber,
        ifsc_code: formData.ifscCode.toUpperCase()
      });

      if (response.success) {
        toast.success('Bank details saved successfully!');
        // Refresh bank details to show updated state
        await fetchBankDetails();
        // Reset form
        setFormData({
          accountNumber: '',
          ifscCode: '',
          confirmDetails: false
        });
        setShowNewForm(false);
      } else {
        toast.error(response.message || 'Failed to save bank details');
      }
    } catch (error: any) {
      console.error('Bank details error:', error);
      toast.error(error.message || 'Failed to save bank details');
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
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 p-0 h-auto text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bank Details</h1>
            <p className="text-gray-600">
              {currentBankDetails 
                ? 'Confirm or update your bank details for this loan application'
                : 'Choose existing bank details or add new ones for loan disbursement'
              }
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading bank details...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Bank Details (if exists) */}
            {currentBankDetails && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Current Bank Details</h3>
                  <div className="flex items-center text-sm text-green-600">
                    <Check className="w-4 h-4 mr-1" />
                    Selected
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Bank Name</p>
                    <p className="font-medium">{currentBankDetails.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Account Number</p>
                    <p className="font-medium">****{currentBankDetails.account_number.slice(-4)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">IFSC Code</p>
                    <p className="font-medium">{currentBankDetails.ifsc_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Account Holder</p>
                    <p className="font-medium">{currentBankDetails.account_holder_name}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => navigate('/loan-application/references?applicationId=' + applicationId)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Continue with Current Bank Details
                  </Button>
                </div>
              </Card>
            )}

            {/* Existing Bank Details */}
            {!currentBankDetails && existingBankDetails.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Bank Details</h3>
                  <Button
                    onClick={handleAddNewBank}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New
                  </Button>
                </div>
                <div className="space-y-3">
                  {existingBankDetails.map((bank) => (
                    <div
                      key={bank.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedBankId === bank.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedBankId(bank.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CreditCard className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{bank.bank_name}</p>
                            <p className="text-sm text-gray-500">
                              ****{bank.account_number.slice(-4)} • {bank.ifsc_code}
                            </p>
                            {bank.application_number && (
                              <p className="text-xs text-gray-400">
                                Used for: {bank.application_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {bank.is_primary && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Primary
                            </span>
                          )}
                          {selectedBankId === bank.id && (
                            <Check className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedBankId && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => handleChooseExistingBank(selectedBankId)}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Selecting...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Choose Selected Bank Details
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Add New Bank Form */}
            {(!currentBankDetails && existingBankDetails.length === 0) || showNewForm ? (
              <Card className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Bank Details</h3>
                  {existingBankDetails.length > 0 && (
                    <Button
                      onClick={() => setShowNewForm(false)}
                      variant="ghost"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Account Number */}
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber" className="text-base font-medium">
                      Account Number *
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        id="accountNumber"
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                        placeholder="Enter your account number"
                        className="pl-10 h-12 text-base"
                        required
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      Enter the account number where you want to receive the loan amount
                    </p>
                  </div>

                  {/* IFSC Code */}
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode" className="text-base font-medium">
                      IFSC Code *
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        id="ifscCode"
                        type="text"
                        value={formData.ifscCode}
                        onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                        placeholder="Enter IFSC code (e.g., SBIN0001234)"
                        className="pl-10 h-12 text-base uppercase"
                        maxLength={11}
                        required
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      You can find your IFSC code on your bank passbook or online banking
                    </p>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="confirmDetails"
                        checked={formData.confirmDetails}
                        onChange={(e) => handleInputChange('confirmDetails', e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <label htmlFor="confirmDetails" className="cursor-pointer">
                          I hereby confirm that the bank details are correct and that the account belongs only to me. 
                          The loan amount, if approved, will be transferred to this account only. If the above information 
                          proves to be incorrect, Creditlab and its Lending partners will not be held liable and the loan 
                          will be deemed to have been disbursed to me and I will be responsible for repayment.
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={loading || !formData.confirmDetails}
                      className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving Bank Details...
                        </>
                      ) : (
                        <>
                          <Building2 className="w-4 h-4 mr-2" />
                          Save Bank Details
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            ) : null}

            {/* No Bank Details Available */}
            {!currentBankDetails && existingBankDetails.length === 0 && !showNewForm && (
              <Card className="p-6 text-center">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bank Details Found</h3>
                <p className="text-gray-600 mb-4">
                  You don't have any saved bank details. Add your bank details to continue with the loan application.
                </p>
                <Button onClick={handleAddNewBank} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bank Details
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Your bank details will be securely stored and used only for loan disbursement.
          </p>
        </div>
      </div>
    </div>
  );
}
