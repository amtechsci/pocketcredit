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
  const [hasCheckedBank, setHasCheckedBank] = useState(false); // Prevent multiple redirects

  // Log component mount - this should ALWAYS show if component renders
  // This runs on EVERY render, so if we don't see this, component isn't rendering
  console.log('🔵🔵🔵 LinkSalaryBankAccountPage COMPONENT RENDERED 🔵🔵🔵', {
    pathname: window.location.pathname,
    search: window.location.search,
    userId: user?.id,
    emailVerified: user?.personal_email_verified,
    hasCheckedBank,
    checkingEnach
  });

  // Form state for adding new bank
  const [newBankForm, setNewBankForm] = useState({
    account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  useEffect(() => {
    console.log('🔵🔵🔵 LinkSalaryBankAccountPage: useEffect triggered 🔵🔵🔵');
    console.log('🔵 User:', user?.id, 'Email verified:', user?.personal_email_verified);

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const allowEdit = urlParams.get('allowEdit');
    console.log('🔵 LinkSalaryBankAccountPage: allowEdit =', allowEdit);

    // If allowEdit=true, skip the completion check and just load the page
    if (allowEdit === 'true') {
      console.log('🔵 LinkSalaryBankAccountPage: allowEdit=true, skipping checks');
      setCheckingEnach(false);
      checkAndFetchReport();
      return;
    }

    // Check if user has already completed this step by checking:
    // PRIORITY 1: Check bank account FIRST (this is the main purpose of this page)
    // PRIORITY 2: Check if user has an active loan application
    // PRIORITY 3: Only redirect if bank account exists AND email is verified
    const checkCompletionAndRedirect = async () => {
      console.log('🔵 LinkSalaryBankAccountPage: checkCompletionAndRedirect started');
      if (!user?.id) {
        console.log('🔵 No user ID, exiting');
        setCheckingEnach(false);
        return;
      }

      // Prevent multiple checks/redirects
      if (hasCheckedBank) {
        console.log('🔵 Already checked bank, skipping');
        return;
      }

      try {
        // FIRST: Check if user has a primary bank account (MOST IMPORTANT CHECK)
        // This check MUST happen before any redirects
        try {
          console.log('🔵 STEP 1: Checking bank details for user:', user.id);
          setHasCheckedBank(true); // Mark as checked to prevent duplicate checks
          const bankDetailsResponse = await apiService.getUserBankDetails(user.id);
          console.log('🔵 Bank details response:', bankDetailsResponse);

          if (bankDetailsResponse.success && bankDetailsResponse.data && bankDetailsResponse.data.length > 0) {
            console.log('🔵 Bank details data:', bankDetailsResponse.data);
            const hasPrimaryBank = bankDetailsResponse.data.some((bank: BankDetail) => {
              const isPrimary = Boolean(bank.is_primary);
              console.log(`🔵 Bank ${bank.id}: is_primary=${bank.is_primary}, boolean=${isPrimary}`);
              return isPrimary;
            });

            console.log('🔵 Has primary bank account?', hasPrimaryBank);

            if (hasPrimaryBank) {
              console.log('✅ Primary bank account found - user has already linked bank');
              // User has linked bank account - use progress engine to determine next step
              // First check if email is verified (prerequisite for some flows)
              if (!user.personal_email_verified) {
                console.log('📧 Email not verified, redirecting to email verification');
                setTimeout(() => navigate('/email-verification', { replace: true }), 500);
                return;
              }

              // Email verified - user has linked bank account.
              // We don't redirect here anymore, StepGuard or Progress Engine will handle it.
              console.log('✅ Primary bank account found - User has completed this step.');
              setCheckingEnach(false);
              return; // Exit early - bank account exists
            } else {
              console.log('✅✅✅ No primary bank account found - user NEEDS to link bank account - STAYING ON PAGE ✅✅✅');
              // No primary bank account - user MUST stay on this page to link it
              // DO NOT redirect - allow page to render
            }
          } else {
            console.log('✅✅✅ No bank details found - user NEEDS to link bank account - STAYING ON PAGE ✅✅✅');
            // No bank details - user MUST stay on this page to link it
            // DO NOT redirect - allow page to render
          }
        } catch (bankError) {
          console.error('❌ Error checking bank details:', bankError);
          // On error, allow user to proceed to link bank account
          // DO NOT redirect - allow page to render
        }

        // SECOND: Check if user has an active/pending loan application
        // Only check this AFTER bank check to ensure we don't redirect prematurely
        try {
          const applicationsResponse = await apiService.getLoanApplications();
          console.log('📋 Loan applications response:', {
            hasSuccess: !!applicationsResponse.success,
            status: applicationsResponse.status,
            hasData: !!applicationsResponse.data,
            hasApplications: !!applicationsResponse.data?.applications,
            applicationsCount: applicationsResponse.data?.applications?.length || 0
          });

          // Check for both 'success' property and 'status: success' (API uses status)
          const isSuccess = applicationsResponse.success || applicationsResponse.status === 'success';
          if (isSuccess && applicationsResponse.data?.applications) {
            const applications = applicationsResponse.data.applications;
            console.log('📋 Applications found:', applications.map((app: any) => ({ id: app.id, status: app.status })));

            // Include all statuses that indicate an active application in progress
            // This matches the backend check in userBankStatement.js which includes:
            // 'pending', 'under_review', 'in_progress', 'submitted'
            // Also include 'ready_for_disbursement' as users can still link bank accounts at this stage
            const activeStatuses = ['submitted', 'under_review', 'follow_up', 'disbursal', 'ready_for_disbursement', 'pending', 'in_progress'];

            // Debug: Log all application statuses
            console.log('🔍 All application statuses:', applications.map((app: any) => ({
              id: app.id,
              status: app.status,
              statusType: typeof app.status,
              statusTrimmed: app.status?.trim?.(),
              inArray: activeStatuses.includes(app.status),
              inArrayTrimmed: app.status ? activeStatuses.includes(app.status.trim()) : false
            })));

            const activeApplication = applications.find((app: any) => {
              if (!app || !app.status) return false;
              // Normalize status - trim whitespace and convert to lowercase for comparison
              const normalizedStatus = String(app.status).trim().toLowerCase();
              const normalizedActiveStatuses = activeStatuses.map(s => String(s).trim().toLowerCase());
              const matches = normalizedActiveStatuses.includes(normalizedStatus);
              console.log(`🔍 Checking app ${app.id}: status="${app.status}" (normalized: "${normalizedStatus}"), matches=${matches}`);
              return matches;
            });

            if (!activeApplication) {
              console.log('⚠️ No active loan application found. Applications:', applications.map((app: any) => app.status));
              console.log('⚠️ Allowed statuses:', activeStatuses);
              console.log('⚠️ Application details:', applications.map((app: any) => ({ id: app.id, status: app.status, statusType: typeof app.status })));
              toast.info('No active loan application found. Redirecting to dashboard...');
              setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
              return;
            }

            console.log('✅ Active application found:', { id: activeApplication.id, status: activeApplication.status });
            console.log('🔵 LinkSalaryBankAccountPage: Continuing to bank check...');
          } else {
            // No applications at all, redirect to dashboard
            console.log('⚠️ No loan applications found in response. Response:', applicationsResponse);
            toast.info('No loan application found. Redirecting to dashboard...');
            setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
            return;
          }
        } catch (appError) {
          console.error('❌ Error checking loan applications:', appError);
          // Continue with other checks even if this fails - don't block the flow
        }

        // If we reach here, user does NOT have a primary bank account
        // Therefore, they MUST stay on this page to link their bank account
        // DO NOT redirect - the page should render to allow bank linking
        console.log('✅✅✅ User needs to link bank account - staying on page ✅✅✅');

        setCheckingEnach(false);
        checkAndFetchReport();
      } catch (error) {
        console.error('Error checking completion status:', error);
        setCheckingEnach(false);
        checkAndFetchReport();
      }
    };

    // Only run check if user is loaded and we haven't checked yet
    if (user?.id && !hasCheckedBank) {
      checkCompletionAndRedirect();
    } else if (!user?.id) {
      console.log('🔵 Waiting for user to load...');
    }
  }, [user?.id, navigate, hasCheckedBank]); // Only depend on user.id and navigate

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
            // Check if it's a manual upload
            const isManualUpload = (reportResponse.data as any).isManualUpload;
            if (isManualUpload) {
              console.log('Manual upload detected - bank details may need to be added manually');
              // For manual uploads, don't show error - user can add bank details manually
            } else {
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
          }
        } catch (reportError: any) {
          console.error('Error fetching report:', reportError);
          // If it's a 400 or 500 error about manual upload, don't show error
          const errorMessage = reportError?.response?.data?.message || '';
          if (errorMessage.includes('Manual upload') || errorMessage.includes('No Digitap transaction')) {
            console.log('Manual upload detected - user can add bank details manually');
            // Don't show error toast for manual uploads
          } else {
            // For other errors, continue silently - user can still add bank manually
          }
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
        // Use progress engine to determine next step
        try {
          // Get active application ID
          const applicationsResponse = await apiService.getLoanApplications();
          const isSuccess = applicationsResponse.success || applicationsResponse.status === 'success';
          let activeApplicationId: number | null = null;

          if (isSuccess && applicationsResponse.data?.applications) {
            const applications = applicationsResponse.data.applications;
            const activeApplication = applications.find((app: any) =>
              ['submitted', 'under_review', 'follow_up', 'disbursal', 'repeat_disbursal', 'ready_to_repeat_disbursal', 'pending', 'in_progress', 'ready_for_disbursement'].includes(app.status)
            );
            activeApplicationId = activeApplication?.id || null;
          }

          const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
          const progress = await getOnboardingProgress(activeApplicationId);
          const nextRoute = getStepRoute(progress.currentStep, activeApplicationId);
          console.log('[LinkSalaryBankAccount] After submission, next step from engine:', progress.currentStep, '->', nextRoute);

          // Check if email verification is needed first
          if (user && !user.personal_email_verified) {
            navigate('/email-verification', { replace: true });
          } else {
            navigate(nextRoute, { replace: true });
          }
        } catch (error) {
          console.error('[LinkSalaryBankAccount] Error getting next step, using fallback:', error);
          // Fallback to email verification (old behavior)
          navigate('/email-verification', { replace: true });
        }
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

  // Always render something - even if checking, so component is visible
  // This ensures component mount logs will show
  if (checkingEnach) {
    console.log('🔵 Rendering checking state...');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking bank account status...</p>
            <p className="text-xs text-gray-500 mt-2">Please wait while we verify your information</p>
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

                {/* Only show "Add New Bank Account" if no bank details exist */}
                {bankDetails.length === 0 && (
                  <Button
                    onClick={() => setShowAddNew(true)}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Bank Account
                  </Button>
                )}
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

