import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, CheckCircle, Info, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface BankDetail {
  id: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type?: string;
  is_primary?: boolean;
  is_verified?: boolean;
  created_at: string;
}

export const LinkSalaryBankAccountPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for adding new bank
  const [newBankForm, setNewBankForm] = useState({
    account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  useEffect(() => {
    checkAndFetchReport();
  }, []);

  const checkAndFetchReport = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        toast.error('User not found');
        navigate('/auth');
        return;
      }

      // First, check bank statement status - this will automatically fetch report if needed
      const statusResponse = await apiService.getUserBankStatementStatus();
      
      if (statusResponse.success && statusResponse.data) {
        const { status, reportJustFetched } = statusResponse.data as any;
        
        // If status is completed but report was just fetched, wait a moment for bank details extraction
        if (status === 'completed' && reportJustFetched) {
          toast.success('Bank statement report fetched! Extracting bank details...');
          // Wait a bit for bank details extraction to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Now fetch bank details
      await fetchBankDetails();
    } catch (error) {
      console.error('Error checking bank statement:', error);
      // Continue to fetch bank details even if status check fails
      await fetchBankDetails();
    }
  };

  const fetchBankDetails = async () => {
    try {
      if (!user?.id) {
        return;
      }

      const response = await apiService.getUserBankDetails(user.id);
      
      if (response.success && response.data && response.data.length > 0) {
        setBankDetails(response.data as BankDetail[]);
        // Auto-select if only one bank detail exists
        if (response.data.length === 1) {
          setSelectedBankId(response.data[0].id);
        }
      } else {
        // If no bank details found, try to manually fetch the report
        console.log('No bank details found - attempting to fetch report...');
        try {
          // Call the fetch-bank-report endpoint which will fetch report if status is completed
          const reportResponse = await apiService.fetchUserBankReport();
          if (reportResponse.success && reportResponse.data) {
            toast.success('Bank statement report fetched! Extracting bank details...');
            // Wait for bank details extraction
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Retry fetching bank details
            const retryResponse = await apiService.getUserBankDetails(user.id);
            if (retryResponse.success && retryResponse.data && retryResponse.data.length > 0) {
              setBankDetails(retryResponse.data as BankDetail[]);
              if (retryResponse.data.length === 1) {
                setSelectedBankId(retryResponse.data[0].id);
              }
            }
          }
        } catch (reportError) {
          console.error('Error fetching report:', reportError);
          // Continue - user can still add bank manually
        }
      }
    } catch (error) {
      console.error('Error fetching bank details:', error);
      // Don't show error immediately, might be processing
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBank = (bankId: number) => {
    setSelectedBankId(bankId);
  };

  const handleAddNewBank = async () => {
    // Validate form
    if (!newBankForm.account_number || !newBankForm.ifsc_code) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(newBankForm.ifsc_code.toUpperCase())) {
      toast.error('Invalid IFSC code format');
      return;
    }

    try {
      setSubmitting(true);
      
      // Call API to save bank details for user
      const response = await apiService.saveUserBankDetails({
        account_number: newBankForm.account_number,
        ifsc_code: newBankForm.ifsc_code.toUpperCase(),
        bank_name: newBankForm.bank_name || undefined
      });
      
      if (response.success) {
        toast.success('Bank account added successfully!');
        setShowAddNew(false);
        setNewBankForm({ account_number: '', ifsc_code: '', bank_name: '' });
        // Refresh bank details list
        await fetchBankDetails();
      } else {
        toast.error(response.message || 'Failed to add bank account');
      }
    } catch (error: any) {
      console.error('Error adding bank:', error);
      toast.error(error.response?.data?.message || 'Failed to add bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedBankId) {
      toast.error('Please select a bank account');
      return;
    }

    setSubmitting(true);

    try {
      // Register the selected bank account for e-NACH
      const response = await apiService.registerEnach(selectedBankId);

      if (response.success) {
        toast.success('Salary bank account registered for e-NACH successfully!');
        
        // Navigate to email verification page
        setTimeout(() => {
          navigate('/email-verification');
        }, 1500);
      } else {
        toast.error(response.message || 'Failed to register bank account');
      }
    } catch (error: any) {
      console.error('Error registering e-NACH:', error);
      toast.error(error.message || 'Failed to register bank account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '****' + accountNumber.slice(-4);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading bank accounts...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 overflow-y-auto">
      {/* Header with Back Button */}
      <div className="bg-white border-b sticky top-0 z-10 mb-4 md:mb-6">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4 flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">Link your salary bank account</h1>
            <p className="text-gray-600 text-xs md:text-sm mt-1">Select your salary bank account to proceed with e-NACH registration</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">

        {/* e-NACH Information Section - Always Visible */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-xl flex items-center gap-2">
              <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              What is e-NACH / e-Mandate?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 text-xs md:text-sm text-gray-700 pt-0">
              <div>
                <p className="mb-2">
                  <strong>Electronic National Automated Clearing House (e-NACH)</strong> is a financial system that helps automate recurring payments for loans.
                </p>
                <p className="mb-2">
                  e-NACH is a service that allows you to pay your loan EMIs from your bank account. It's a service provided by the National Payments Corporation of India (NPCI).
                </p>
                <p className="mb-2">
                  <strong>e-mandate</strong> is an electronic version of a mandate, which is a standing instruction given to the bank where a customer holds their account to debit a fixed amount to another bank account automatically.
                </p>
                <p className="mb-4">
                  ENACH, allows the platform to set up payments with predefined frequency or Ad Hoc. By setting the frequency to Adhoc, the platform can present a mandate per the business requirements.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 md:p-4 rounded">
                <p className="font-semibold text-blue-900 mb-1 md:mb-2 text-xs md:text-sm">Period or Tenure of E-NACH:</p>
                <p className="text-blue-800 text-xs md:text-sm leading-relaxed">
                  The "Period or Tenure of E-NACH" refers to the validity of your E-mandate or e-NACH registration. It does not imply that your account will be debited throughout this period. Instead, it signifies that the E-mandate remains valid for transactions during this time. If you wish to apply for a loan, you can do so directly without having to go through the E-NACH registration process again, as the existing mandate remains valid.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 md:p-4 rounded">
                <p className="font-semibold text-blue-900 mb-1 md:mb-2 text-xs md:text-sm">Maximum amount:</p>
                <p className="text-blue-800 text-xs md:text-sm leading-relaxed">
                  The maximum amount refers to the highest total sum that can be debited throughout the duration of the mandate. This includes the principal loan amount, as well as any accrued interest and charges specified in the loan agreement. We set up an e-mandate for an amount higher than your current loan balance to accommodate potential future increases in your loan limit. This way, you won't need to register again if your limit changes, as the one-time registration will cover the higher amount.
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-400 p-3 md:p-4 rounded">
                <p className="font-semibold text-green-900 mb-1 md:mb-2 text-xs md:text-sm">Benefits:</p>
                <ul className="list-disc list-inside space-y-1 text-green-800 text-xs md:text-sm">
                  <li>One-time authorization: No need to submit fresh mandates for each transaction.</li>
                  <li>Easy digital authentication: Using Netbanking or Debit Card credentials</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 md:p-4 rounded">
                <p className="font-semibold text-yellow-900 mb-1 md:mb-2 text-xs md:text-sm">Note:</p>
                <p className="text-yellow-800 text-xs md:text-sm leading-relaxed">
                  Make sure you are ready with your debit card or net banking details linked to the bank shown below to proceed with e-NACH registration.
                </p>
              </div>
            </CardContent>
        </Card>

        {/* Bank Accounts List */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg md:text-xl">Select Your Salary Bank Account</CardTitle>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              Choose the bank account where you receive your salary
            </p>
          </CardHeader>
          <CardContent>
            {bankDetails.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No bank accounts found</p>
                <Button onClick={() => setShowAddNew(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bankDetails.map((bank) => (
                  <div
                    key={bank.id}
                    onClick={() => handleSelectBank(bank.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedBankId === bank.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className={`w-5 h-5 ${selectedBankId === bank.id ? 'text-blue-600' : 'text-gray-400'}`} />
                          <h3 className="font-semibold text-gray-900">{bank.bank_name}</h3>
                          {selectedBankId === bank.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 ml-8">
                          <div>
                            <span className="font-medium">Account Number:</span>{' '}
                            {maskAccountNumber(bank.account_number)}
                          </div>
                          <div>
                            <span className="font-medium">IFSC:</span> {bank.ifsc_code}
                          </div>
                          <div>
                            <span className="font-medium">Account Holder:</span>{' '}
                            {bank.account_holder_name}
                          </div>
                          {bank.account_type && (
                            <div>
                              <span className="font-medium">Type:</span> {bank.account_type}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={() => setShowAddNew(true)}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Bank Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continue Button */}
        {selectedBankId && (
          <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4 mt-4 md:mt-6 sticky bottom-0 bg-gray-50 pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:static">
            <Button
              onClick={handleContinue}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px] w-full sm:w-auto"
            >
              {submitting ? 'Processing...' : 'Continue'}
            </Button>
          </div>
        )}

        {/* Add New Bank Dialog */}
        <Dialog open={showAddNew} onOpenChange={setShowAddNew}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Bank Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="account_number">Account Number *</Label>
                <Input
                  id="account_number"
                  value={newBankForm.account_number}
                  onChange={(e) =>
                    setNewBankForm({ ...newBankForm, account_number: e.target.value })
                  }
                  placeholder="Enter account number"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ifsc_code">IFSC Code *</Label>
                <Input
                  id="ifsc_code"
                  value={newBankForm.ifsc_code}
                  onChange={(e) =>
                    setNewBankForm({ ...newBankForm, ifsc_code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., HDFC0001234"
                  className="mt-1 uppercase"
                  maxLength={11}
                />
              </div>
              <div>
                <Label htmlFor="bank_name">Bank Name (Optional)</Label>
                <Input
                  id="bank_name"
                  value={newBankForm.bank_name}
                  onChange={(e) =>
                    setNewBankForm({ ...newBankForm, bank_name: e.target.value })
                  }
                  placeholder="Enter bank name"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddNew(false);
                    setNewBankForm({ account_number: '', ifsc_code: '', bank_name: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddNewBank}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submitting ? 'Adding...' : 'Add Bank'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LinkSalaryBankAccountPage;

