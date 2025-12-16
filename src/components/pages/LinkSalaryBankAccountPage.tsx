import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, CheckCircle, ArrowLeft } from 'lucide-react';
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
  const [checkingEnach, setCheckingEnach] = useState(true);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [fullAccountNumber, setFullAccountNumber] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for adding new bank
  const [newBankForm, setNewBankForm] = useState({
    account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  useEffect(() => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const allowEdit = urlParams.get('allowEdit');

    // If allowEdit=true, skip the completion check and just load the page
    if (allowEdit === 'true') {
      setCheckingEnach(false);
      checkAndFetchReport();
      return;
    }

    // Check if user has already completed this step by checking:
    // 1. If user has a primary bank account (set during e-NACH registration)
    // 2. If email is already verified (comes after e-NACH)
    // 3. If user has an active loan application (if not, redirect to dashboard)
    const checkCompletionAndRedirect = async () => {
      if (!user?.id) {
        setCheckingEnach(false);
        return;
      }

      try {
        // First, check if user has an active/pending loan application
        try {
          const applicationsResponse = await apiService.getLoanApplications();
          if (applicationsResponse.success && applicationsResponse.data?.applications) {
            const applications = applicationsResponse.data.applications;
            const activeApplication = applications.find((app: any) => 
              ['submitted', 'under_review', 'follow_up', 'disbursal'].includes(app.status)
            );
            
            if (!activeApplication) {
              console.log('No active loan application found, redirecting to dashboard');
              toast.info('No active loan application found. Redirecting to dashboard...');
              setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
              return;
            }
          } else {
            // No applications at all, redirect to dashboard
            console.log('No loan applications found, redirecting to dashboard');
            toast.info('No loan application found. Redirecting to dashboard...');
            setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
            return;
          }
        } catch (appError) {
          console.error('Error checking loan applications:', appError);
          // Continue with other checks even if this fails
        }

        // Method 1: Check if email is already verified
        if (user.personal_email_verified) {
          navigate('/email-verification', { replace: true });
          return;
        }

        // Method 2: Check if user has a primary bank account
        try {
          const bankDetailsResponse = await apiService.getUserBankDetails(user.id);
          if (bankDetailsResponse.success && bankDetailsResponse.data) {
            const hasPrimaryBank = bankDetailsResponse.data.some((bank: BankDetail) => {
              // Check if is_primary is truthy
              return Boolean(bank.is_primary);
            });

            if (hasPrimaryBank) {
              console.log('Primary bank account found, step completed, redirecting');
              navigate('/email-verification', { replace: true });
              return;
            }
          }
        } catch (bankError) {
          console.log('Error checking bank details:', bankError);
        }

        setCheckingEnach(false);
        checkAndFetchReport();
      } catch (error) {
        console.error('Error checking completion status:', error);
        setCheckingEnach(false);
        checkAndFetchReport();
      }
    };

    checkCompletionAndRedirect();
  }, [user?.id, user?.personal_email_verified, navigate]);

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
    if (selectedBankId !== bankId) {
      setSelectedBankId(bankId);
      setFullAccountNumber(''); // Reset input when changing selection
    }
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

    if (!fullAccountNumber) {
      toast.error('Please enter your full account number to confirm');
      return;
    }

    // Optional: Validate that the entered number matches the masked one (partial check)
    const selectedBank = bankDetails.find(b => b.id === selectedBankId);
    if (selectedBank) {
      const masked = selectedBank.account_number;
      // If masked has at least 4 chars and isn't fully masked
      if (masked.length >= 4 && !masked.includes('****')) {
        // If we actually had the full number, we could check equality. 
        // But here we assume we are collecting the full number to UPDATE it.
      } else if (masked.length >= 4) {
        const last4 = masked.slice(-4);
        if (!fullAccountNumber.endsWith(last4)) {
          toast.error(`Account number must end with ${last4}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Update the bank details with the full account number and mark as primary
      const response = await apiService.updateBankDetails(selectedBankId, {
        account_number: fullAccountNumber,
        is_primary: true
      });

      if (response.success) {
        toast.success('Bank details verified successfully');
        // Navigate to email verification page
        navigate('/email-verification');
      } else {
        toast.error(response.message || 'Failed to verify bank details');
      }
    } catch (error: any) {
      console.error('Error updating bank details:', error);
      toast.error(error.message || 'Failed to update bank details');
    } finally {
      setSubmitting(false);
    }
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '****' + accountNumber.slice(-4);
  };

  // Don't render anything while checking e-NACH status
  if (checkingEnach) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedBankId === bank.id
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

                        {/* Show Input if selected */}
                        {selectedBankId === bank.id && (
                          <div className="mt-4 ml-8" onClick={(e) => e.stopPropagation()}>
                            <Label htmlFor={`full-account-${bank.id}`} className="text-blue-900">
                              Confirm Full Account Number
                            </Label>
                            <Input
                              id={`full-account-${bank.id}`}
                              value={fullAccountNumber}
                              onChange={(e) => setFullAccountNumber(e.target.value)}
                              placeholder="Enter full account number"
                              className="mt-1 bg-white"
                              autoFocus
                            />
                            <p className="text-xs text-blue-600 mt-1">
                              Please enter the complete account number to verify.
                            </p>
                          </div>
                        )}
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

