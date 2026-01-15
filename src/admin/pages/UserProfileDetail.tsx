import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Edit,
  X,
  Plus,
  MessageSquare,
  Clock,
  Building,
  Eye,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  IndianRupee,
  Briefcase,
  Monitor,
  RefreshCw,
  Filter,
  Flag,
  Shield,
  Wallet,
  UserPlus,
  HelpCircle,
  Upload,
  Loader2
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';
import { toast } from 'sonner';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';




export function UserProfileDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const [activeTab, setActiveTab] = useState('personal');
  const [showBasicInfoModal, setShowBasicInfoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDescription, setDocumentDescription] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [showAddReferenceModal, setShowAddReferenceModal] = useState(false);
  const [showUploadNewModal, setShowUploadNewModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    type: '',
    response: ''
  });
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showSendSmsModal, setShowSendSmsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const { canEditUsers, currentUser } = useAdmin();

  // Debug admin context (commented out to reduce console noise)

  // Real data state
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loanDocuments, setLoanDocuments] = useState<{ [loanId: number]: any[] }>({});
  const [documentsLoading, setDocumentsLoading] = useState<{ [loanId: number]: boolean }>({});
  const [expandedLoanDocuments, setExpandedLoanDocuments] = useState<{ [loanId: number]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [refetchingKYC, setRefetchingKYC] = useState(false);

  // Form state for modals
  const [basicInfoForm, setBasicInfoForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    panNumber: ''
  });
  const [contactInfoForm, setContactInfoForm] = useState({
    email: '',
    phone: '',
    alternatePhone: '',
    personalEmail: '',
    officialEmail: '',
    companyEmail: ''
  });
  const [addressInfoForm, setAddressInfoForm] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    address_type: 'current' as 'current' | 'permanent' | 'office',
    is_primary: false
  });
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [employmentInfoForm, setEmploymentInfoForm] = useState({
    company: '',
    companyName: '',
    designation: '',
    industry: '',
    department: '',
    monthlyIncome: '',
    income: '',
    workExperience: ''
  });
  const [bankDetailsForm, setBankDetailsForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    branchName: ''
  });
  const [referenceForm, setReferenceForm] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    address: ''
  });
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<{ [key: number]: string }>({});
  const [editingSalaryDate, setEditingSalaryDate] = useState(false);
  const [bankStatement, setBankStatement] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [verifyingStatement, setVerifyingStatement] = useState(false);
  const [salaryDateEditValue, setSalaryDateEditValue] = useState('');
  const [editingReference, setEditingReference] = useState<number | null>(null);
  const [editingReferenceField, setEditingReferenceField] = useState<{ [key: number]: 'name' | 'phone' | 'relation' | null }>({});
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editingReferenceNumber, setEditingReferenceNumber] = useState<string>('');
  const [referenceEditValues, setReferenceEditValues] = useState<{ [key: number]: { name?: string; phone?: string; relation?: string } }>({});
  const [newReference, setNewReference] = useState({ name: '', phone: '', relation: '' });
  const [referenceErrors, setReferenceErrors] = useState({ name: '', phone: '', relation: '' });
  const [noteForm, setNoteForm] = useState({
    subject: '',
    note: '',
    category: '',
    priority: ''
  });
  const [smsForm, setSmsForm] = useState({
    message: '',
    templateId: ''
  });

  // Helper to get current date string (moved before useState to avoid hoisting issues)
  const getCurrentDateForForm = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    transactionType: '',
    loanApplicationId: '',
    description: '',
    category: 'loan',
    paymentMethod: 'net_banking',
    referenceNumber: '',
    transactionDate: getCurrentDateForForm(),
    status: 'completed',
    transactionTime: '',
    additionalNotes: ''
  });

  const transactionTypeOptions = [
    { value: 'loan_disbursement', label: 'Loan Disbursement' },
    { value: '1st_emi_paid', label: '1st EMI paid' },
    { value: '2nd_emi_paid', label: '2nd EMI paid' },
    { value: '3rd_emi_paid', label: '3rd EMI paid' },
    { value: '4th_emi_paid', label: '4th EMI paid' },
    { value: 'loan_extension_1st', label: 'Loan extension 1st' },
    { value: 'loan_extension_2nd', label: 'Loan extension 2nd' },
    { value: 'loan_extension_3rd', label: 'Loan extension 3rd' },
    { value: 'loan_extension_4th', label: 'Loan extension 4th' },
    { value: 'settlement', label: 'Settlement' },
    { value: 'full_payment', label: 'Full Payment' },
    { value: 'part_payment', label: 'Part Payment' }
  ];

  // State for loan plan management
  const [loanPlans, setLoanPlans] = useState<any[]>([]);
  const [userLoanPlan, setUserLoanPlan] = useState<any>(null);
  const [showLoanPlanModal, setShowLoanPlanModal] = useState(false);
  const [selectedLoanPlanId, setSelectedLoanPlanId] = useState<number | null>(null);

  // State for editable loan fields
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [editValues, setEditValues] = useState<any>({});

  // State for loan calculations (backend-only)
  const [loanCalculations, setLoanCalculations] = useState<{ [loanId: number]: any }>({});
  const [calculationsLoading, setCalculationsLoading] = useState<{ [loanId: number]: boolean }>({});

  // State for plan details modal
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<any>(null);

  // State for assigning plan to a specific loan (not user's default plan)
  const [editingLoanPlanId, setEditingLoanPlanId] = useState<number | null>(null);

  // Validation tab state
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [documentInput, setDocumentInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [showDocumentSuggestions, setShowDocumentSuggestions] = useState(false);
  const [showReasonSuggestions, setShowReasonSuggestions] = useState(false);
  const [holdUser, setHoldUser] = useState('');
  const [holdDuration, setHoldDuration] = useState('');
  const [holdDays, setHoldDays] = useState('');

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Real validation history data from API
  const [validationHistory, setValidationHistory] = useState([]);
  const [validationHistoryLoading, setValidationHistoryLoading] = useState(false);

  // Credit Analytics data from API
  const [creditAnalyticsData, setCreditAnalyticsData] = useState<any>(null);
  const [creditAnalyticsLoading, setCreditAnalyticsLoading] = useState(false);
  const [performingCreditCheck, setPerformingCreditCheck] = useState(false);

  // EMI Details modal state
  const [showEmiDetailsModal, setShowEmiDetailsModal] = useState(false);
  const [selectedLoanEmiSchedule, setSelectedLoanEmiSchedule] = useState<any[]>([]);
  const [selectedLoanIdForEmi, setSelectedLoanIdForEmi] = useState<string>('');

  // Validation options from API
  const [documentOptions, setDocumentOptions] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);
  const [validationOptionsLoading, setValidationOptionsLoading] = useState(false);

  // Helper function to view history details
  const viewHistoryDetails = (item) => {
    setSelectedHistoryItem(item);
    setShowHistoryModal(true);
  };

  // Fetch validation options from API
  const fetchValidationOptions = async () => {
    try {
      setValidationOptionsLoading(true);
      const response = await adminApiService.getValidationOptions();

      if (response.status === 'success') {
        const options = response.data;
        setDocumentOptions(options.need_document?.map(opt => opt.name) || []);
        setReasonOptions(options.not_process?.map(opt => opt.name) || []);
      }
    } catch (error) {
      console.error('Error fetching validation options:', error);
      // Fallback to default options
      setDocumentOptions([
        'Last 3 month bank statement up to date',
        'Last 2 month bank statement up to date',
        'Last 1 month bank statement up to date',
        'Current month till date bank statement',
        'Latest one month pay slip/salary slip',
        'Pay slip/salary slip',
        'Aadhar front side',
        'Aadhar back side',
        'Aadhar card password',
        'Passport front side',
        'Passport back side',
        'Office address & land line number',
        'Company website URL link',
        'Offer letter/appointment letter',
        'Pan card',
        'Present address proof',
        'Other'
      ]);
      setReasonOptions([
        'Less salary',
        'Salary not reflecting in statement',
        'Modified(Bank statement)',
        'Modified(salary slip)',
        'Self employed',
        'Resigned job',
        'Red profile',
        'Existing Customer',
        'Waste Customer',
        'Wrong number/invalid/not exist',
        'Net banking issue',
        'Doesn\'t have net banking',
        'Other'
      ]);
    } finally {
      setValidationOptionsLoading(false);
    }
  };

  // Fetch validation history from API
  const fetchValidationHistory = async () => {
    if (!userData?.id) return;

    try {
      setValidationHistoryLoading(true);
      const response = await adminApiService.getValidationHistory(userData.id);

      if (response.status === 'success') {
        setValidationHistory(response.data);
      }
    } catch (error) {
      console.error('Error fetching validation history:', error);
      setValidationHistory([]);
    } finally {
      setValidationHistoryLoading(false);
    }
  };

  // Fetch credit analytics data
  const fetchCreditAnalytics = async () => {
    if (!userData?.id) return;

    try {
      setCreditAnalyticsLoading(true);
      const response = await adminApiService.getUserCreditAnalytics(userData.id);

      if (response.status === 'success') {
        setCreditAnalyticsData(response.data);
      }
    } catch (error) {
      console.error('Error fetching credit analytics:', error);
      setCreditAnalyticsData(null);
    } finally {
      setCreditAnalyticsLoading(false);
    }
  };

  // Perform credit check for user
  const handlePerformCreditCheck = async () => {
    if (!userData?.id) return;

    if (!confirm('Are you sure you want to perform a credit check for this user? This will fetch credit analytics data from Experian.')) {
      return;
    }

    try {
      setPerformingCreditCheck(true);
      const response = await adminApiService.performCreditCheck(userData.id);

      if (response.status === 'success') {
        if (response.data?.already_checked) {
          alert('Credit check already performed for this user. Refreshing data...');
        } else {
          alert(`Credit check completed! Score: ${response.data?.credit_score || 'N/A'}, Eligible: ${response.data?.is_eligible ? 'Yes' : 'No'}`);
        }
        // Refresh credit analytics data
        await fetchCreditAnalytics();
      } else {
        alert(response.message || 'Failed to perform credit check');
      }
    } catch (error: any) {
      console.error('Error performing credit check:', error);
      alert(error.response?.data?.message || error.message || 'Failed to perform credit check');
    } finally {
      setPerformingCreditCheck(false);
    }
  };

  // Submit validation action
  const submitValidationAction = async () => {
    if (!selectedAction || !userData?.id) return;

    // Check if user has any loan in account_manager status
    const loans = getArray('loans');
    const accountManagerLoans = loans ? loans.filter((loan: any) => loan.status === 'account_manager') : [];
    
    // Block certain actions if user has loans in account_manager status
    const blockedActions = ['not_process', 're_process', 'delete', 'cancel', 'process'];
    if (blockedActions.includes(selectedAction) && accountManagerLoans.length > 0) {
      alert(`Cannot perform "${selectedAction}" action. User has loan(s) in account_manager status. Loans in account_manager status cannot be modified.`);
      return;
    }

    try {
      // Get admin ID from the admin context
      const adminId = currentUser?.id || 'unknown';

      let actionDetails = {};

      switch (selectedAction) {
        case 'need_document':
          actionDetails = { documents: selectedDocuments };
          break;
        case 'not_process':
          actionDetails = { reasons: selectedReasons };
          break;
        case 'process':
          actionDetails = { message: 'Application moved to disbursal status' };
          break;
        case 're_process':
          actionDetails = { message: 'Profile moved to cooling period (45 days)' };
          break;
        case 'unhold':
          actionDetails = { message: 'Profile unhold - moved to active status' };
          break;
        case 'delete':
          actionDetails = { message: 'Profile deleted (data purged except primary number, PAN, Aadhar, and loan data)' };
          break;
        case 'cancel':
          actionDetails = {
            cancelLoan: true,
            holdUser,
            holdDuration,
            holdDays: holdDuration === 'days' ? holdDays : null
          };
          break;
      }

      // Get the latest loan application ID from applied loans
      // For cancel action, include all cancellable statuses
      const loans = getArray('loans');
      const cancellableStatuses = selectedAction === 'cancel' 
        ? ['submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 'ready_for_disbursement', 'repeat_ready_for_disbursement', 'repeat_disbursal']
        : ['submitted', 'under_review', 'follow_up', 'disbursal'];
      
      const appliedLoans = loans ? loans.filter((loan: any) =>
        cancellableStatuses.includes(loan.status)
      ) : [];
      const latestLoan = appliedLoans && appliedLoans.length > 0 ? appliedLoans[0] : null;
      const loanApplicationId = latestLoan?.id || userData.current_loan_id || null;

      const requestData = {
        userId: userData.id,
        loanApplicationId: loanApplicationId,
        actionType: selectedAction,
        actionDetails,
        adminId
      };


      const response = await adminApiService.submitValidationAction(requestData);

      if (response.status === 'success') {
        // If action is "Need Document", update loan status to "follow_up"
        if (selectedAction === 'need_document' && loanApplicationId) {
          try {
            await adminApiService.updateApplicationStatus(loanApplicationId.toString(), 'follow_up');
          } catch (statusError) {
            console.error('Error updating loan status:', statusError);
            // Don't fail the whole operation if status update fails
          }
        }

        // Reset form
        setSelectedAction('');
        setSelectedDocuments([]);
        setSelectedReasons([]);
        setDocumentInput('');
        setReasonInput('');
        setHoldUser('');
        setHoldDuration('');
        setHoldDays('');

        // Refresh history and user data
        await fetchValidationHistory();
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }

        // Show success message
        alert('Validation action submitted successfully! Loan status updated to Follow Up.');
      } else {
        // Show error message from response
        alert(response.message || 'Failed to submit validation action. Please try again.');
      }
    } catch (error: any) {
      console.error('Error submitting validation action:', error);
      // Check if error is due to account_manager loan
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit validation action. Please try again.';
      alert(errorMessage);
    }
  };

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const response = await adminApiService.getUserProfile(params.userId!);

        if (response.status === 'success' && response.data) {
          setUserData(response.data);

          // Load user's selected loan plan from response data
          if (response.data.selectedLoanPlan) {
            // Loan plan is already included in the response
            setUserLoanPlan(response.data.selectedLoanPlan);
            setSelectedLoanPlanId(response.data.selectedLoanPlan.id);
          } else if (response.data.selectedLoanPlanId) {
            // Fallback: fetch plan if not included in response
            try {
              const planResponse = await adminApiService.getLoanPlan(response.data.selectedLoanPlanId);
              if (planResponse.success && planResponse.data) {
                setUserLoanPlan(planResponse.data);
                setSelectedLoanPlanId(planResponse.data.id);
              } else if (planResponse.status === 'success' && planResponse.data) {
                setUserLoanPlan(planResponse.data);
                setSelectedLoanPlanId(planResponse.data.id);
              }
            } catch (err) {
              console.error('Error fetching user loan plan:', err);
            }
          } else {
            // No loan plan assigned
            setUserLoanPlan(null);
            setSelectedLoanPlanId(null);
          }
        } else {
          setError(response.message || 'Failed to fetch user profile');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to fetch user profile');
      } finally {
        setLoading(false);
      }
    };

    if (params.userId) {
      fetchUserProfile();
    }
  }, [params.userId]);

  // Fetch all loan plans for selection
  useEffect(() => {
    const fetchLoanPlans = async () => {
      try {
        const response = await adminApiService.getLoanPlans();
        if (response.success && response.data) {
          setLoanPlans(response.data.filter((plan: any) => plan.is_active === 1 || plan.is_active === true));
        } else if (response.status === 'success' && response.data) {
          // Fallback for different response format
          setLoanPlans(response.data.filter((plan: any) => plan.is_active === 1 || plan.is_active === true));
        }
      } catch (err) {
        console.error('Error fetching loan plans:', err);
      }
    };

    fetchLoanPlans();
  }, []);

  // Handle loan status change
  const handleLoanStatusChange = async (loanId: number, newStatus: string) => {
    if (!confirm(`Are you sure you want to change the status to "${newStatus}"?`)) {
      return;
    }

    try {
      const response = await adminApiService.updateApplicationStatus(loanId.toString(), newStatus);

      if (response.status === 'success' || response.success) {
        alert('Loan status updated successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to update loan status');
        // Reload page to revert dropdown
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating loan status:', error);
      alert('Failed to update loan status. Please try again.');
      // Reload page to revert dropdown
      window.location.reload();
    }
  };

  // Quick Process - Move loan from follow_up to disbursal
  const handleQuickProcess = async (loanId: number) => {
    if (!confirm('Are you sure you want to process this application? This will move it to Disbursal status.')) {
      return;
    }

    try {
      const adminId = currentUser?.id || 'unknown';

      // Submit validation action with "process" type
      const response = await adminApiService.submitValidationAction({
        userId: userData?.id,
        loanApplicationId: loanId,
        actionType: 'process',
        actionDetails: { message: 'Application processed and moved to disbursal status' },
        adminId
      });

      if (response.status === 'success') {
        alert('Application processed successfully! Status updated to Disbursal.');

        // Refresh user data to show updated status
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }

        // Refresh validation history
        await fetchValidationHistory();
      } else {
        alert(response.message || 'Failed to process application');
      }
    } catch (error: any) {
      console.error('Error processing application:', error);
      alert(error.response?.data?.message || error.message || 'Failed to process application. Please try again.');
    }
  };

  // Update user's loan plan or assign plan to a loan
  const handleUpdateLoanPlan = async () => {
    if (!selectedLoanPlanId) return;

    try {
      // If editingLoanPlanId is set, assign plan to that loan
      if (editingLoanPlanId) {
        const response = await adminApiService.assignLoanPlanToApplication(editingLoanPlanId, selectedLoanPlanId);

        if (response.status === 'success' || response.success) {
          setShowLoanPlanModal(false);
          const loanIdToRefresh = editingLoanPlanId;
          setEditingLoanPlanId(null);
          setSelectedLoanPlanId(null);
          alert('Loan plan assigned successfully!');
          // Refresh user data to show updated loan
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success' && profileResponse.data) {
            setUserData(profileResponse.data);
            // Clear loan calculations cache for this loan and re-fetch
            setLoanCalculations(prev => {
              const updated = { ...prev };
              delete updated[loanIdToRefresh];
              return updated;
            });
            // Re-fetch calculation with new plan
            fetchLoanCalculation(loanIdToRefresh);
          }
        } else {
          alert(response.message || 'Failed to assign loan plan');
        }
        return;
      }

      // Otherwise, update user's default loan plan
      if (!params.userId) return;

      const response = await adminApiService.updateUserLoanPlan(params.userId, selectedLoanPlanId);

      if (response.status === 'success' || response.success) {
        // Update local state
        const planResponse = await adminApiService.getLoanPlan(selectedLoanPlanId);
        if (planResponse.success && planResponse.data) {
          setUserLoanPlan(planResponse.data);
        } else if (planResponse.status === 'success' && planResponse.data) {
          setUserLoanPlan(planResponse.data);
        }
        setShowLoanPlanModal(false);
        setSelectedLoanPlanId(null);
        alert('Loan plan updated successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to update loan plan');
      }
    } catch (err) {
      console.error('Error updating loan plan:', err);
      alert('Failed to update loan plan');
    }
  };

  // Fetch validation data when user data is loaded
  useEffect(() => {
    if (userData?.id) {
      fetchValidationOptions();
      fetchValidationHistory();
    }
  }, [userData?.id]);

  // Fetch loan calculations when loans are available (backend-only)
  useEffect(() => {
    if (userData && (activeTab === 'applied-loans' || activeTab === 'loans')) {
      let loansToFetch: any[] = [];

      if (activeTab === 'applied-loans') {
        loansToFetch = getArray('loans'); // Fetch all loans, no status filter
      } else if (activeTab === 'loans') {
        loansToFetch = getArray('loans').filter((loan: any) =>
          ['account_manager', 'cleared'].includes(loan.status)
        );
      }

      loansToFetch.forEach((loan: any) => {
        const loanId = loan.id || loan.loanId;
        if (loanId && !loanCalculations[loanId] && !calculationsLoading[loanId]) {
          fetchLoanCalculation(loanId);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, activeTab]);

  // Fetch validation history when validation tab is active
  useEffect(() => {
    if (activeTab === 'validation' && userData?.id) {
      fetchValidationHistory();
    }
  }, [activeTab, userData?.id]);

  // Fetch credit analytics automatically when userData is loaded (for Experian score display)
  useEffect(() => {
    if (userData?.id && !creditAnalyticsData) {
      fetchCreditAnalytics();
    }
  }, [userData?.id]);

  // Fetch credit analytics when credit analytics tab is active (refresh if needed)
  useEffect(() => {
    if (activeTab === 'credit-analytics' && userData?.id) {
      fetchCreditAnalytics();
    }
  }, [activeTab, userData?.id]);

  // Fetch transactions when transactions tab is active
  useEffect(() => {
    if (activeTab === 'transactions' && userData?.id) {
      fetchUserTransactions();
    }
  }, [activeTab, userData?.id]);

  const fetchUserTransactions = async () => {
    try {
      const response = await adminApiService.getUserTransactions(params.userId!);
      if (response.status === 'success') {
        setUserData((prev: any) => ({
          ...prev,
          transactions: response.data
        }));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  // Initialize form data when modals open
  useEffect(() => {
    if (userData && showBasicInfoModal) {
      setBasicInfoForm({
        firstName: userData.name?.split(' ')[0] || '',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        dateOfBirth: userData.dateOfBirth || '',
        panNumber: userData.panNumber || ''
      });
    }
  }, [userData, showBasicInfoModal]);

  useEffect(() => {
    if (userData && showContactModal) {
      setContactInfoForm({
        email: userData.email || '',
        phone: userData.mobile || '',
        alternatePhone: userData.alternateMobile || '',
        personalEmail: userData.personalEmail || '',
        officialEmail: userData.officialEmail || '',
        companyEmail: userData.companyEmail || ''
      });
    }
  }, [userData, showContactModal]);

  // Auto-update disbursal amount when loan calculation is fetched for loan disbursement transactions
  useEffect(() => {
    if (transactionForm.transactionType === 'loan_disbursement' && transactionForm.loanApplicationId) {
      const loanId = parseInt(transactionForm.loanApplicationId);
      if (loanId && !isNaN(loanId)) {
        // Check if loan has already been disbursed (to avoid overwriting stored values)
        // For repeat_disbursal loans, ALWAYS recalculate (don't use stored disbursal_amount from previous disbursal)
        const loan = getArray('loans')?.find((l: any) => {
          const lId = l.id || l.loanId;
          return lId && (lId.toString() === loanId.toString() || parseInt(lId.toString()) === loanId);
        });
        const isRepeatDisbursal = loan?.status === 'repeat_disbursal' || loan?.status === 'repeat_ready_for_disbursement';
        const isFinalStatus = (loan?.status === 'account_manager' || loan?.status === 'cleared') && !isRepeatDisbursal;
        const isAlreadyDisbursed = (loan?.disbursed_at && isFinalStatus) || isFinalStatus;
        const loanAmount = loan?.loan_amount || loan?.amount || loan?.principalAmount || 0;
        const storedDisbursalAmount = loan?.disbursal_amount || loan?.disbursalAmount;
        
        // If calculation is available, use it to update the amount
        if (loanCalculations[loanId]?.disbursal?.amount !== undefined) {
          const disbursalAmount = loanCalculations[loanId].disbursal.amount;
          const currentAmount = parseFloat(transactionForm.amount || '0');
          
          
          // For loans not yet disbursed OR repeat_disbursal loans, always update if:
          // 1. Amount doesn't match calculated disbursal amount, OR
          // 2. Current amount matches stored disbursal amount (which might be wrong for repeat_disbursal), OR
          // 3. Current amount matches loan_amount (temporary placeholder), OR
          // 4. It's a repeat_disbursal loan (always update these)
          if (!isAlreadyDisbursed || isRepeatDisbursal) {
            const shouldUpdate = 
              isRepeatDisbursal || // Always update repeat_disbursal loans
              Math.abs(currentAmount - disbursalAmount) > 0.01 || // Amount doesn't match
              (storedDisbursalAmount && Math.abs(currentAmount - storedDisbursalAmount) < 0.01) || // Using stored (wrong) value
              (loanAmount > 0 && Math.abs(currentAmount - loanAmount) < 0.01); // Using loan_amount placeholder
            
            if (shouldUpdate) {
              setTransactionForm(prev => ({ ...prev, amount: disbursalAmount.toString() }));
              
            }
          }
        } else if ((!isAlreadyDisbursed || isRepeatDisbursal) && !calculationsLoading[loanId]) {
          fetchLoanCalculation(loanId).catch(err => console.error('Error fetching loan calculation:', err));
        }
      }
    }
  }, [transactionForm.transactionType, transactionForm.loanApplicationId, loanCalculations, calculationsLoading]);

  // Fetch bank statement when tab becomes active
  useEffect(() => {
    if (activeTab === 'statement-verification' && params.userId && !bankStatement) {
      const fetchBankStatement = async () => {
        if (!params.userId) return;
        setLoadingStatement(true);
        try {
          const response = await adminApiService.getBankStatement(params.userId);
          if (response.success && response.data) {
            setBankStatement(response.data.statement);
          }
        } catch (error) {
          console.error('Error fetching bank statement:', error);
          toast.error('Failed to fetch bank statement');
        } finally {
          setLoadingStatement(false);
        }
      };
      fetchBankStatement();
    }
  }, [activeTab, params.userId, bankStatement]);

  // Form submission handlers
  const handleBasicInfoSubmit = async () => {
    try {
      const response = await adminApiService.updateUserBasicInfo(params.userId!, basicInfoForm);
      if (response.status === 'success') {
        alert('Basic information updated successfully!');
        setShowBasicInfoModal(false);
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to update basic information');
      }
    } catch (error) {
      console.error('Error updating basic info:', error);
      alert('Error updating basic information');
    }
  };

  const handleContactInfoSubmit = async () => {
    try {
      const response = await adminApiService.updateUserContactInfo(params.userId!, contactInfoForm);
      if (response.status === 'success') {
        alert('Contact information updated successfully!');
        setShowContactModal(false);
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to update contact information');
      }
    } catch (error) {
      console.error('Error updating contact info:', error);
      alert('Error updating contact information');
    }
  };

  // Loan Application Review Handlers
  const handleViewApplication = (loanId: string) => {
    // TODO: Implement detailed application view modal
    alert(`Viewing application details for loan: ${loanId}`);
  };

  const handleApproveLoan = async (loanId: string) => {
    try {
      const response = await adminApiService.updateApplicationStatus(loanId, 'approved');
      if (response.status === 'success') {
        alert('Loan application approved successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to approve loan application');
      }
    } catch (error) {
      console.error('Error approving loan:', error);
      alert('Error approving loan application');
    }
  };

  const handleRejectLoan = async (loanId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      try {
        const response = await adminApiService.updateApplicationStatus(loanId, 'rejected', reason);
        if (response.status === 'success') {
          alert('Loan application rejected successfully!');
          // Refresh user data
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
          }
        } else {
          alert('Failed to reject loan application');
        }
      } catch (error) {
        console.error('Error rejecting loan:', error);
        alert('Error rejecting loan application');
      }
    }
  };

  const handleEditLoan = (loanId: string) => {
    // TODO: Implement loan editing modal
    alert(`Editing loan application: ${loanId}`);
  };

  const handleAddressInfoSubmit = async () => {
    // Validation
    if (!addressInfoForm.address_line1 || !addressInfoForm.city || !addressInfoForm.state || !addressInfoForm.pincode) {
      toast.error('Please fill in all required fields (Address Line 1, City, State, Pincode)');
      return;
    }

    if (addressInfoForm.pincode.length !== 6) {
      toast.error('Pincode must be 6 digits');
      return;
    }

    try {
      let response;
      if (editingAddressId) {
        // Update existing address
        response = await adminApiService.updateUserAddress(params.userId!, editingAddressId, addressInfoForm);
      } else {
        // Add new address
        response = await adminApiService.addUserAddress(params.userId!, addressInfoForm);
      }

      if (response.status === 'success') {
        toast.success(editingAddressId ? 'Address updated successfully!' : 'Address added successfully!');
        setShowAddressModal(false);
        setEditingAddressId(null);
        // Refresh user data
        const refreshResponse = await adminApiService.getUserProfile(params.userId!);
        if (refreshResponse.status === 'success' && refreshResponse.data) {
          setUserData(refreshResponse.data);
        }
      } else {
        toast.error(response.message || 'Failed to save address');
      }
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast.error(error.response?.data?.message || 'Error saving address');
    }
  };

  const handleUpdateLoanLimit = async (newLimit: number) => {
    try {
      const response = await adminApiService.updateUserLoanLimit(params.userId!, newLimit);
      if (response.status === 'success') {
        alert('Loan limit updated successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to update loan limit');
      }
    } catch (error) {
      console.error('Error updating loan limit:', error);
      alert('Error updating loan limit');
    }
  };

  const handleEmploymentInfoSubmit = async () => {
    try {
      const response = await adminApiService.updateUserEmploymentInfo(params.userId!, {
        company: employmentInfoForm.company || employmentInfoForm.companyName,
        companyName: employmentInfoForm.companyName || employmentInfoForm.company,
        designation: employmentInfoForm.designation,
        industry: employmentInfoForm.industry,
        department: employmentInfoForm.department,
        monthlyIncome: employmentInfoForm.monthlyIncome ? parseFloat(employmentInfoForm.monthlyIncome) : null,
        income: employmentInfoForm.income ? parseFloat(employmentInfoForm.income) : (employmentInfoForm.monthlyIncome ? parseFloat(employmentInfoForm.monthlyIncome) : null),
        workExperience: employmentInfoForm.workExperience ? parseFloat(employmentInfoForm.workExperience) : null
      });
      if (response.status === 'success') {
        alert('Employment information updated successfully!');
        setShowEmploymentModal(false);
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to update employment information');
      }
    } catch (error) {
      console.error('Error updating employment info:', error);
      alert('Error updating employment information');
    }
  };

  const handleTransactionSubmit = async () => {
    try {
      // Validate required fields
      if (!transactionForm.amount || isNaN(parseFloat(transactionForm.amount))) {
        alert('Please enter a valid amount');
        return;
      }

      if (!transactionForm.transactionType) {
        alert('Please select a transaction type');
        return;
      }

      // If loan disbursement, require loan application ID
      if (transactionForm.transactionType === 'loan_disbursement' && !transactionForm.loanApplicationId) {
        alert('Please select a loan application for disbursement');
        return;
      }

      // Check if trying to disburse a loan that's already in account_manager or cleared
      if (transactionForm.transactionType === 'loan_disbursement' && transactionForm.loanApplicationId) {
        const loan = getArray('loans')?.find((l: any) => 
          l.id?.toString() === transactionForm.loanApplicationId || 
          l.loanId?.toString() === transactionForm.loanApplicationId
        );
        
        if (loan && (loan.status === 'account_manager' || loan.status === 'cleared')) {
          alert(`Cannot disburse this loan. Loan is already in "${loan.status}" status. The loan has already been disbursed.`);
          return;
        }
      }

      // Require UTR/reference number
      if (!transactionForm.referenceNumber || transactionForm.referenceNumber.trim() === '') {
        alert('Please enter a UTR / Reference number');
        return;
      }

      const transactionData = {
        amount: parseFloat(transactionForm.amount),
        type: transactionForm.transactionType, // Backend expects "type" or "transaction_type"
        transaction_type: transactionForm.transactionType,
        loan_application_id: transactionForm.loanApplicationId ? parseInt(transactionForm.loanApplicationId) : null,
        description: transactionForm.description,
        category: transactionForm.category,
        payment_method: transactionForm.paymentMethod,
        reference_number: transactionForm.referenceNumber,
        transaction_date: transactionForm.transactionDate,
        status: transactionForm.status,
        additional_notes: transactionForm.additionalNotes
      };

      const response = await adminApiService.addTransaction(params.userId!, transactionData);

      if (response.status === 'success') {
        // Show success message (toast would be better, but using alert for consistency)
        if (response.data && response.data.loan_status_updated) {
          alert(`Transaction added successfully! Loan status updated to ${response.data.new_status}.`);
        } else {
          alert('Transaction added successfully!');
        }

        setShowAddTransactionModal(false);
        setTransactionForm({
          amount: '',
          transactionType: '',
          loanApplicationId: '',
          description: '',
          category: 'loan',
          paymentMethod: 'bank_transfer',
          referenceNumber: '',
          transactionDate: getCurrentDateForForm(),
          status: 'completed',
          transactionTime: '',
          additionalNotes: ''
        });

        // Refresh user data (especially loans list)
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to add transaction');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Error adding transaction');
    }
  };

  const handleUpdateTransactionReference = async (transactionId: number, referenceNumber: string) => {
    try {
      if (!referenceNumber || referenceNumber.trim() === '') {
        alert('Reference / UTR number cannot be empty');
        setEditingTransactionId(null);
        return;
      }

      const response = await adminApiService.updateTransaction(params.userId!, transactionId.toString(), referenceNumber.trim());
      
      if (response.status === 'success') {
        // Update local state
        if (userData && userData.transactions) {
          const updatedTransactions = userData.transactions.map((t: any) =>
            t.id === transactionId ? { ...t, reference_number: referenceNumber.trim() } : t
          );
          setUserData({ ...userData, transactions: updatedTransactions });
        }
        setEditingTransactionId(null);
        setEditingReferenceNumber('');
      } else {
        alert(response.message || 'Failed to update reference number');
      }
    } catch (error) {
      console.error('Error updating transaction reference:', error);
      alert('Error updating reference number');
    }
  };

  const handleBankDetailsSubmit = async () => {
    try {
      const response = await adminApiService.addBankDetails(params.userId!, bankDetailsForm);
      if (response.status === 'success') {
        alert('Bank details added successfully!');
        setShowAddBankModal(false);
        setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to add bank details');
      }
    } catch (error) {
      console.error('Error adding bank details:', error);
      alert('Error adding bank details');
    }
  };

  const handleEditBankDetails = () => {
    const bankId = getUserData('bankInfo.id', null) || getUserData('bankDetails.0.id', null);
    if (!bankId || bankId === 'N/A') {
      alert('Bank details ID not found');
      return;
    }
    setEditingBankId(bankId.toString());
    setBankDetailsForm({
      bankName: getUserData('bankInfo.bankName') || '',
      accountNumber: getUserData('bankInfo.accountNumber') || '',
      ifscCode: getUserData('bankInfo.ifscCode') || '',
      accountHolderName: getUserData('bankInfo.accountHolderName') || getUserData('name') || '',
      branchName: getUserData('bankInfo.branchName') || ''
    });
    setShowEditBankModal(true);
  };

  const handleUpdateBankDetails = async () => {
    if (!editingBankId) return;
    try {
      const response = await adminApiService.updateBankDetails(params.userId!, editingBankId, bankDetailsForm);
      if (response.status === 'success') {
        alert('Bank details updated successfully!');
        setShowEditBankModal(false);
        setEditingBankId(null);
        setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        alert(response.message || 'Failed to update bank details');
      }
    } catch (error) {
      console.error('Error updating bank details:', error);
      alert('Error updating bank details');
    }
  };

  const handleReferenceSubmit = async () => {
    try {
      const response = await adminApiService.addReferenceDetails(params.userId!, referenceForm);
      if (response.status === 'success') {
        alert('Reference details added successfully!');
        setShowAddReferenceModal(false);
        setReferenceForm({ name: '', relationship: '', phone: '', email: '', address: '' });
      } else {
        alert('Failed to add reference details');
      }
    } catch (error) {
      console.error('Error adding reference details:', error);
      alert('Error adding reference details');
    }
  };

  const handleAddReference = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Clear previous errors
    setReferenceErrors({ name: '', phone: '', relation: '' });
    
    let hasErrors = false;
    const errors = { name: '', phone: '', relation: '' };
    
    // Validate name
    if (!newReference.name || newReference.name.trim() === '') {
      errors.name = 'Name is required';
      hasErrors = true;
    }
    
    // Validate phone number
    if (!newReference.phone || newReference.phone.trim() === '') {
      errors.phone = 'Phone number is required';
      hasErrors = true;
    } else {
      const phoneDigits = newReference.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        errors.phone = 'Mobile number must be exactly 10 digits';
        hasErrors = true;
      }
    }
    
    // Validate relation
    if (!newReference.relation || newReference.relation.trim() === '') {
      errors.relation = 'Relation is required';
      hasErrors = true;
    }
    
    if (hasErrors) {
      setReferenceErrors(errors);
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      const response = await adminApiService.addReference(params.userId!, newReference);
      if (response.status === 'success') {
        toast.success('Reference added successfully!');
        setShowAddReferenceModal(false);
        setNewReference({ name: '', phone: '', relation: '' });
        setReferenceErrors({ name: '', phone: '', relation: '' });
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        toast.error(response.message || 'Failed to add reference');
      }
    } catch (error: any) {
      console.error('Error adding reference:', error);
      toast.error(error.message || 'Failed to add reference');
    }
  };

  const handleNoteSubmit = async () => {
    try {
      const response = await adminApiService.addNote(params.userId!, noteForm);
      if (response.status === 'success') {
        alert('Note added successfully!');
        setShowAddNoteModal(false);
        setNoteForm({ subject: '', note: '', category: '', priority: '' });
      } else {
        alert('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    }
  };

  const handleSmsSubmit = async () => {
    try {
      const response = await adminApiService.sendSMS(params.userId!, smsForm);
      if (response.status === 'success') {
        alert('SMS sent successfully!');
        setShowSendSmsModal(false);
        setSmsForm({ message: '', templateId: '' });
      } else {
        alert('Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('Error sending SMS');
    }
  };

  const handleEditSalaryDate = () => {
    setSalaryDateEditValue(userData?.salaryDate?.toString() || '');
    setEditingSalaryDate(true);
  };

  const handleSaveSalaryDate = async () => {
    // Validate salary date is between 1 and 31
    const day = parseInt(salaryDateEditValue);
    if (salaryDateEditValue && (isNaN(day) || day < 1 || day > 31)) {
      toast.error('Salary date must be a number between 1 and 31');
      return;
    }

    try {
      const response = await adminApiService.updateUserSalaryDate(
        params.userId!,
        salaryDateEditValue || null
      );

      if (response.status === 'success') {
        toast.success('Salary date updated successfully!');
        setEditingSalaryDate(false);
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        toast.error(response.message || 'Failed to update salary date');
      }
    } catch (error: any) {
      console.error('Error updating salary date:', error);
      toast.error(error.message || 'Failed to update salary date');
    }
  };

  const handleCancelSalaryDateEdit = () => {
    setEditingSalaryDate(false);
    setSalaryDateEditValue('');
  };

  // Enhanced mock user data with much more detail (fallback)
  const mockUserData = {
    id: params.userId,
    name: 'Rajesh Kumar Singh',
    clid: 'CL250912',
    status: 'under_review',
    mobile: '+91 98765 43210',
    alternatePhone: '+91 87654 32109',
    email: 'rajesh.kumar@email.com',
    accountManager: 'Raj Patel',
    recoveryOfficer: 'Amit Sharma',
    registeredDate: '2025-01-09',
    creditScore: 720,
    memberLevel: 'Silver',
    kycStatus: 'completed',
    riskCategory: 'Low',
    lastLoginDate: '2025-01-09 09:15',
    personalInfo: {
      dateOfBirth: '1990-05-15',
      age: 34,
      gender: 'Male',
      fatherName: 'Mohan Kumar Singh',
      motherName: 'Sunita Singh',
      spouseName: 'Priya Singh',
      address: '123, MG Road, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      landmark: 'Near Forum Mall',
      residenceType: 'Rented',
      yearsAtCurrentAddress: 3,
      employment: 'Software Engineer',
      company: 'TCS Limited',
      companyAddress: 'Electronics City, Bangalore',
      workExperience: '5 years',
      totalExperience: '8 years',
      monthlyIncome: 75000,
      otherIncome: 15000,
      maritalStatus: 'Married',
      numberOfDependents: 2,
      education: 'B.Tech Computer Science',
      professionalQualification: 'None'
    },
    bankInfo: {
      bankName: 'HDFC Bank',
      accountNumber: '50100123456789',
      ifscCode: 'HDFC0001234',
      accountType: 'Savings',
      branchName: 'Koramangala Branch',
      accountHolderName: 'Rajesh Kumar Singh',
      averageBalance: 125000,
      relationshipLength: '5 years',
      loanAccounts: 2,
      overdueAmount: 0,
      currentEMIs: 25000,
      networth: 850000,
      verificationStatus: 'pending',
      addedDate: '2025-01-09',
      verifiedDate: null,
      rejectedDate: null,
      rejectionReason: null
    },
    references: [
      {
        name: 'Amit Sharma',
        relationship: 'Friend',
        phone: '+91 99887 76655',
        email: 'amit.sharma@email.com',
        address: 'HSR Layout, Bangalore',
        verificationStatus: 'verified',
        contactedDate: '2025-01-09',
        verifiedDate: '2025-01-09',
        rejectedDate: null,
        rejectionReason: null,
        feedback: 'Confirmed employment and character. Positive reference.'
      },
      {
        name: 'Suresh Kumar',
        relationship: 'Colleague',
        phone: '+91 88776 65544',
        email: 'suresh.kumar@tcs.com',
        address: 'Electronic City, Bangalore',
        verificationStatus: 'pending',
        contactedDate: '2025-01-10',
        verifiedDate: null,
        rejectedDate: null,
        rejectionReason: null,
        feedback: 'Contacted but no response yet. Will follow up.'
      }
    ],
    documents: [
      {
        type: 'Aadhaar Card',
        description: 'Front and back copy',
        status: 'verified',
        uploadedDate: '2025-01-09',
        verifiedDate: '2025-01-09',
        fileName: 'aadhaar_card.pdf',
        fileSize: '1.2 MB',
        rejectedDate: null,
        rejectionReason: null
      },
      {
        type: 'PAN Card',
        description: 'Clear copy',
        status: 'verified',
        uploadedDate: '2025-01-09',
        verifiedDate: '2025-01-09',
        fileName: 'pan_card.pdf',
        fileSize: '0.8 MB',
        rejectedDate: null,
        rejectionReason: null
      },
      {
        type: 'Bank Statement',
        description: 'Last 6 months',
        status: 'pending',
        uploadedDate: '2025-01-09',
        verifiedDate: null,
        fileName: 'bank_statement.pdf',
        fileSize: '2.1 MB',
        rejectedDate: null,
        rejectionReason: null
      },
      {
        type: 'Salary Slip',
        description: 'Last 3 months',
        status: 'rejected',
        uploadedDate: '2025-01-09',
        verifiedDate: null,
        fileName: 'salary_slips.pdf',
        fileSize: '1.5 MB',
        rejectedDate: '2025-01-10',
        rejectionReason: 'Poor image quality, please resubmit'
      }
    ],
    bankDocuments: [
      {
        type: 'Bank Statement',
        description: 'Last 6 months statement',
        status: 'verified',
        uploadedDate: '2025-01-09',
        verifiedDate: '2025-01-09',
        fileName: 'bank_statement_6months.pdf',
        fileSize: '2.1 MB'
      },
      {
        type: 'Passbook',
        description: 'First and last page',
        status: 'verified',
        uploadedDate: '2025-01-09',
        verifiedDate: '2025-01-09',
        fileName: 'passbook_pages.pdf',
        fileSize: '1.8 MB'
      },
      {
        type: 'Cheque Leaf',
        description: 'Cancelled cheque leaf',
        status: 'pending',
        uploadedDate: '2025-01-10',
        verifiedDate: null,
        fileName: 'cancelled_cheque.pdf',
        fileSize: '0.5 MB'
      }
    ],
    loginHistory: [
      {
        device: 'Chrome on Windows',
        location: 'Bangalore, India',
        ip: '192.168.1.100',
        time: '2025-01-09 09:15'
      },
      {
        device: 'Mobile App',
        location: 'Bangalore, India',
        ip: '192.168.1.101',
        time: '2025-01-08 18:30'
      },
      {
        device: 'Safari on Mac',
        location: 'Bangalore, India',
        ip: '192.168.1.102',
        time: '2025-01-07 14:20'
      }
    ],
    loans: [
      {
        loanId: 'LN250912001',
        amount: 500000,
        principalAmount: 500000,
        type: 'Personal Loan',
        status: 'approved',
        appliedDate: '2025-01-09',
        approvedDate: '2025-01-09',
        disbursedDate: '2025-01-10',
        emi: 15000,
        tenure: 36,
        timePeriod: 36,
        processingFeePercent: 2.5,
        interestRate: 12.5,
        disbursedAmount: 500000,
        processingFee: 12500,
        gst: 2250,
        interest: 62500,
        totalAmount: 577250,
        reason: 'Home Renovation',
        statusDate: '2025-01-09',
        createdAt: '2025-01-09',
        updatedAt: '2025-01-10'
      },
      {
        loanId: 'LN250912002',
        amount: 200000,
        principalAmount: 200000,
        type: 'Business Loan',
        status: 'pending',
        appliedDate: '2025-01-08',
        approvedDate: null,
        disbursedDate: null,
        emi: 8000,
        tenure: 24,
        timePeriod: 24,
        processingFeePercent: 3.0,
        interestRate: 15.0,
        disbursedAmount: 0,
        processingFee: 6000,
        gst: 1080,
        interest: 30000,
        totalAmount: 237080,
        reason: 'Business Expansion',
        statusDate: '2025-01-08',
        createdAt: '2025-01-08',
        updatedAt: '2025-01-08'
      },
      {
        loanId: 'LN250912003',
        amount: 100000,
        principalAmount: 100000,
        type: 'Personal Loan',
        status: 'account_manager',
        appliedDate: '2025-01-05',
        approvedDate: '2025-01-06',
        disbursedDate: '2025-01-07',
        emi: 3500,
        tenure: 30,
        timePeriod: 30,
        processingFeePercent: 2.0,
        interestRate: 11.0,
        disbursedAmount: 100000,
        processingFee: 2000,
        gst: 360,
        interest: 11000,
        totalAmount: 113360,
        reason: 'Medical Emergency',
        statusDate: '2025-01-07',
        createdAt: '2025-01-05',
        updatedAt: '2025-01-07'
      }
    ],
    transactions: [
      {
        transactionId: 'TXN000001',
        type: 'credit',
        amount: 500000,
        description: 'Loan Disbursement - Personal Loan',
        date: '2025-01-10',
        time: '10:30 AM',
        status: 'completed',
        paymentMethod: 'Bank Transfer',
        referenceNo: 'REF12345678',
        balance: 500000
      },
      {
        transactionId: 'TXN000002',
        type: 'debit',
        amount: 15000,
        description: 'EMI Payment - January 2025',
        date: '2025-01-05',
        time: '09:15 AM',
        status: 'completed',
        paymentMethod: 'Auto Debit',
        referenceNo: 'REF87654321',
        balance: 485000
      },
      {
        transactionId: 'TXN000003',
        type: 'debit',
        amount: 15000,
        description: 'EMI Payment - December 2024',
        date: '2024-12-05',
        time: '09:15 AM',
        status: 'completed',
        paymentMethod: 'Auto Debit',
        referenceNo: 'REF11223344',
        balance: 470000
      },
      {
        transactionId: 'TXN000004',
        type: 'debit',
        amount: 2500,
        description: 'Processing Fee',
        date: '2025-01-09',
        time: '11:45 AM',
        status: 'completed',
        paymentMethod: 'UPI',
        referenceNo: 'REF55667788',
        balance: 467500
      },
      {
        transactionId: 'TXN000005',
        type: 'credit',
        amount: 10000,
        description: 'Refund - Overpayment',
        date: '2025-01-08',
        time: '02:20 PM',
        status: 'completed',
        paymentMethod: 'Bank Transfer',
        referenceNo: 'REF99887766',
        balance: 477500
      },
      {
        transactionId: 'TXN000006',
        type: 'debit',
        amount: 5000,
        description: 'Late Payment Fee',
        date: '2025-01-07',
        time: '03:30 PM',
        status: 'pending',
        paymentMethod: 'Credit Card',
        referenceNo: 'REF44332211',
        balance: 472500
      }
    ],
    followUpNotes: [
      {
        followUpId: 'FU000001',
        date: '2025-01-09',
        admin: 'Raj Patel',
        note: 'Customer called for loan status update. Explained the approval process.',
        type: 'call',
        priority: 'high',
        subject: 'Loan Status Inquiry',
        dueDate: '2025-01-10',
        status: 'completed',
        lastUpdated: '2025-01-09'
      },
      {
        followUpId: 'FU000002',
        date: '2025-01-08',
        admin: 'Amit Sharma',
        note: 'Document verification completed. All documents are in order.',
        type: 'email',
        priority: 'medium',
        subject: 'Document Verification',
        dueDate: '2025-01-08',
        status: 'completed',
        lastUpdated: '2025-01-08'
      },
      {
        followUpId: 'FU000003',
        date: '2025-01-07',
        admin: 'Priya Singh',
        note: 'Customer needs to submit additional bank statements for verification.',
        type: 'sms',
        priority: 'high',
        subject: 'Additional Documents Required',
        dueDate: '2025-01-09',
        status: 'pending',
        lastUpdated: '2025-01-07'
      },
      {
        followUpId: 'FU000004',
        date: '2025-01-06',
        admin: 'Vikram Kumar',
        note: 'Follow up call scheduled for loan disbursement discussion.',
        type: 'call',
        priority: 'medium',
        subject: 'Loan Disbursement Discussion',
        dueDate: '2025-01-08',
        status: 'overdue',
        lastUpdated: '2025-01-06'
      },
      {
        followUpId: 'FU000005',
        date: '2025-01-05',
        admin: 'Neha Gupta',
        note: 'Customer visit scheduled for KYC completion.',
        type: 'visit',
        priority: 'low',
        subject: 'KYC Completion Visit',
        dueDate: '2025-01-12',
        status: 'in_progress',
        lastUpdated: '2025-01-10'
      }
    ],
    notes: [
      {
        noteId: 'NOTE000001',
        date: '2025-01-09',
        admin: 'Raj Patel',
        note: 'Customer has good credit history. Low risk profile.',
        category: 'credit',
        priority: 'high',
        subject: 'Credit Assessment',
        status: 'active',
        lastModified: '2025-01-09'
      },
      {
        noteId: 'NOTE000002',
        date: '2025-01-08',
        admin: 'Amit Sharma',
        note: 'Employment verification completed. Salary confirmed.',
        category: 'verification',
        priority: 'medium',
        subject: 'Employment Verification',
        status: 'active',
        lastModified: '2025-01-08'
      },
      {
        noteId: 'NOTE000003',
        date: '2025-01-07',
        admin: 'Priya Singh',
        note: 'Customer requires additional documentation for KYC completion.',
        category: 'verification',
        priority: 'high',
        subject: 'KYC Documentation',
        status: 'flagged',
        lastModified: '2025-01-07'
      },
      {
        noteId: 'NOTE000004',
        date: '2025-01-06',
        admin: 'Vikram Kumar',
        note: 'Customer has excellent payment history with previous loans.',
        category: 'credit',
        priority: 'low',
        subject: 'Payment History',
        status: 'active',
        lastModified: '2025-01-06'
      }
    ],
    smsHistory: [
      {
        smsId: 'SMS000001',
        date: '2025-01-09',
        time: '10:30 AM',
        message: 'Your loan application has been approved. Amount: ₹5,00,000',
        status: 'delivered',
        type: 'notification',
        recipient: '+91 98765 43210',
        template: 'Loan Approval',
        sentBy: 'Raj Patel',
        deliveryStatus: 'Delivered'
      },
      {
        smsId: 'SMS000002',
        date: '2025-01-08',
        time: '03:45 PM',
        message: 'Please upload your bank statement for verification.',
        status: 'sent',
        type: 'reminder',
        recipient: '+91 98765 43210',
        template: 'Document Upload',
        sentBy: 'Amit Sharma',
        deliveryStatus: 'Delivered'
      },
      {
        smsId: 'SMS000003',
        date: '2025-01-07',
        time: '09:15 AM',
        message: 'Welcome to Pocket Credit! Your account has been created.',
        status: 'delivered',
        type: 'notification',
        recipient: '+91 98765 43210',
        template: 'Welcome',
        sentBy: 'System',
        deliveryStatus: 'Delivered'
      },
      {
        smsId: 'SMS000004',
        date: '2025-01-06',
        time: '02:20 PM',
        message: 'Your EMI payment of ₹15,000 is due on 10th January.',
        status: 'sent',
        type: 'reminder',
        recipient: '+91 98765 43210',
        template: 'EMI Reminder',
        sentBy: 'System',
        deliveryStatus: 'Delivered'
      },
      {
        smsId: 'SMS000005',
        date: '2025-01-05',
        time: '11:30 AM',
        message: 'Your loan disbursement of ₹5,00,000 has been processed.',
        status: 'failed',
        type: 'alert',
        recipient: '+91 98765 43210',
        template: 'Disbursement Alert',
        sentBy: 'Priya Singh',
        deliveryStatus: 'Failed'
      },
      {
        smsId: 'SMS000006',
        date: '2025-01-04',
        time: '04:15 PM',
        message: 'Check out our new loan products with attractive interest rates!',
        status: 'sent',
        type: 'promotional',
        recipient: '+91 98765 43210',
        template: 'Promotional',
        sentBy: 'Marketing Team',
        deliveryStatus: 'Delivered'
      }
    ],
    isEmailVerified: true,
    isMobileVerified: true
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined || amount === '' || isNaN(Number(amount))) {
      return '₹0';
    }
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount < 0) {
      return '₹0';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  // Format currency with decimal places (for EMI amounts - preserve exact decimals, don't round)
  const formatCurrencyWithDecimals = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined || amount === '' || isNaN(Number(amount))) {
      return '₹0';
    }
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount < 0) {
      return '₹0';
    }
    // Preserve exact decimal places as stored (up to 2 decimal places)
    // minimumFractionDigits: 0 means don't force trailing zeros
    // maximumFractionDigits: 2 means show up to 2 decimal places
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numAmount);
  };

  // Helper function to get current date as YYYY-MM-DD string (server timezone - no conversion)
  const getCurrentDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format loan ID to short format (PLL + last 4 digits)
  const formatLoanId = (applicationNumber: string | null | undefined, loanApplicationId: number | null | undefined) => {
    if (applicationNumber) {
      // Extract last 4 digits from application number (e.g., PC06543530515 -> 0515)
      const last4 = applicationNumber.slice(-4);
      return `PLL${last4}`;
    }
    if (loanApplicationId) {
      // Use loan_application_id and take last 4 digits
      return `PLL${String(loanApplicationId).padStart(4, '0').slice(-4)}`;
    }
    return '-';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '') return 'N/A';
    
    // Extract date part from datetime string (e.g., "2025-12-25 23:19:50" -> "2025-12-25")
    let datePart = String(dateString);
    if (typeof dateString === 'string' && dateString.includes(' ')) {
      datePart = dateString.split(' ')[0];
    }
    
    // Handle ISO date format: "2025-12-25" or "2025-12-25T00:00:00.000Z"
    if (datePart.includes('T')) {
      datePart = datePart.split('T')[0];
    }
    
    // Format as DD/MM/YYYY (Indian format) - no timezone conversion, just string manipulation
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      // Ensure day and month are zero-padded
      const formattedDay = String(day).padStart(2, '0');
      const formattedMonth = String(month).padStart(2, '0');
      return `${formattedDay}/${formattedMonth}/${year}`;
    }
    
    return datePart; // Return as-is if format is unexpected
  };

  // Use real data with fallback to mock data
  const currentUserData = userData || mockUserData;

  // Helper function to safely access user data
  const getUserData = (path: string, fallback: any = 'N/A') => {
    try {
      const user = currentUserData.user || currentUserData;
      return path.split('.').reduce((obj, key) => obj?.[key], user) || fallback;
    } catch {
      return fallback;
    }
  };

  // Helper to always return an array for collection paths
  const getArray = (path: string): any[] => {
    const value = getUserData(path, []);
    return Array.isArray(value) ? value : [];
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'kyc', label: 'KYC Details', icon: CheckCircle },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'bank', label: 'Bank Information', icon: CreditCard },
    { id: 'statement-verification', label: 'Statement Verification', icon: FileText },
    { id: 'reference', label: 'Reference', icon: Phone },
    { id: 'applied-loans', label: 'Applied Loans', icon: Clock },
    { id: 'loans', label: 'Loans', icon: Building },
    { id: 'transactions', label: 'Transaction Details', icon: IndianRupee },
    { id: 'validation', label: 'Validation', icon: Shield },
    { id: 'credit-analytics', label: 'Credit Analytics', icon: TrendingUp },
    { id: 'follow-up', label: 'Follow Up', icon: MessageSquare },
    { id: 'notes', label: 'Note', icon: FileText },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'login-data', label: 'Login Data', icon: Clock },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
  ];

  const handleRefetchKYC = async () => {
    if (!params.userId) return;
    
    setRefetchingKYC(true);
    try {
      const response = await adminApiService.refetchKYCData(params.userId);
      if (response.status === 'success') {
        toast.success(`KYC data refetched successfully! ${response.data?.documentsProcessed || 0} documents processed.`);
        // Refresh user profile to show updated data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success' && profileResponse.data) {
          setUserData(profileResponse.data);
        }
      } else {
        toast.error(response.message || 'Failed to refetch KYC data');
      }
    } catch (error: any) {
      console.error('Error refetching KYC:', error);
      toast.error(error.message || 'Failed to refetch KYC data');
    } finally {
      setRefetchingKYC(false);
    }
  };

  const renderKYCTab = () => {
    const kycData = getUserData('kycVerification');
    const kycDocs = getUserData('kycDocuments', []);

    // Helper to extract the actual data object
    const getVerificationData = () => {
      let raw = kycData?.verification_data;
      if (!raw) {
        return {};
      }
      
      // Parse if it's a JSON string
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch (e) {
          console.error('❌ Error parsing verification_data:', e);
          return {};
        }
      }
      
      // If raw is an object, check for nested kycData
      if (typeof raw === 'object' && raw !== null) {
        // Check if kycData exists - it might be a string that needs parsing
        if (raw.kycData) {
          if (typeof raw.kycData === 'string') {
            try {
              const parsedKycData = JSON.parse(raw.kycData);
              return parsedKycData;
            } catch (e) {
              console.error('❌ Error parsing kycData string:', e);
            }
          } else if (typeof raw.kycData === 'object') {
            return raw.kycData;
          }
        }
        // Check if the object itself has KYC fields (direct structure)
        if (raw.name || raw.maskedAdharNumber || raw.dob || raw.status) {
          return raw;
        }
        // If it has transactionId but no KYC fields, it might be the wrapper
        // Try to find kycData in nested structure
        if (raw.verification_data && typeof raw.verification_data === 'object') {
          if (raw.verification_data.kycData) {
            // Check if nested kycData is also a string
            if (typeof raw.verification_data.kycData === 'string') {
              try {
                const parsedKycData = JSON.parse(raw.verification_data.kycData);
                return parsedKycData;
              } catch (e) {
                console.error('❌ Error parsing nested kycData string:', e);
              }
            } else {
              return raw.verification_data.kycData;
            }
          }
        }
      }
      
      return raw || {};
    };

    const verificationData = getVerificationData();
    const isVerified = ['verified', 'completed', 'success'].includes(kycData?.status?.toLowerCase());
    const hasTransactionId = kycData?.verification_data?.transactionId;

    return (
      <div className="space-y-6">
        {/* Verification Status Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">KYC Verification Details</h3>
            <div className="flex items-center gap-3">
              {hasTransactionId && (
                <button
                  onClick={handleRefetchKYC}
                  disabled={refetchingKYC}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${refetchingKYC ? 'animate-spin' : ''}`} />
                  {refetchingKYC ? 'Refetching...' : 'Refetch KYC Data'}
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                {kycData?.status?.toUpperCase() || 'NOT VERIFIED'}
              </span>
            </div>
          </div>

          {!kycData ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No KYC verification data available.</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Profile Image */}
              {verificationData.image && (
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={`data:image/jpeg;base64,${verificationData.image}`}
                      alt="KYC Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                  <p className="text-gray-900 font-medium">{verificationData?.name || verificationData?.Name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Date of Birth</label>
                  <p className="text-gray-900">{verificationData?.dob || verificationData?.dob || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Gender</label>
                  <p className="text-gray-900">{verificationData?.gender || verificationData?.Gender || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Masked Aadhaar</label>
                  <p className="text-gray-900">{verificationData?.maskedAdharNumber || verificationData?.masked_adhar_number || verificationData?.uid || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Care Of</label>
                  <p className="text-gray-900">{verificationData?.careOf || verificationData?.care_of || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {(() => {
                      const addr = verificationData.address;
                      if (!addr) return 'N/A';
                      if (typeof addr === 'string') return addr;
                      if (typeof addr === 'object') {
                        // Format address object nicely
                        const parts = [];
                        if (addr.house) parts.push(addr.house);
                        if (addr.loc) parts.push(addr.loc);
                        if (addr.street) parts.push(addr.street);
                        if (addr.landmark) parts.push(addr.landmark);
                        if (addr.vtc || addr.po) parts.push(addr.vtc || addr.po);
                        if (addr.dist || addr.subdist) parts.push(addr.dist || addr.subdist);
                        if (addr.state) parts.push(addr.state);
                        if (addr.pc) parts.push(`PIN: ${addr.pc}`);
                        if (addr.country) parts.push(addr.country);
                        return parts.length > 0 ? parts.join(', ') : JSON.stringify(addr, null, 2);
                      }
                      return 'N/A';
                    })()}
                  </p>
                </div>

                {/* Raw Data Toggle */}
                <div className="md:col-span-2 mt-4">
                  <details className="cursor-pointer">
                    <summary className="text-sm text-blue-600 hover:text-blue-800 font-medium">View Raw Data</summary>
                    <pre className="mt-2 bg-gray-50 p-4 rounded text-xs overflow-auto max-h-60 border border-gray-200">
                      {JSON.stringify(verificationData, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KYC Documents Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Documents</h3>
          {kycDocs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kycDocs.map((doc: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[150px]" title={doc.document_type}>
                          {doc.document_type || 'Document'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => window.open(doc.url, '_blank')}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => window.open(doc.url, '_blank')}
                      className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No KYC documents found.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPersonalTab = () => {
    const allAddresses = userData?.allAddresses || [];
    const allReferences = userData?.references || [];
    const allEmployment = userData?.allEmployment || [];
    const latestEmployment = allEmployment[0] || {};

    // Get employment type, income, and payment mode
    const employmentType = latestEmployment.employment_type || userData?.employmentType || 'N/A';
    const monthlyIncome = latestEmployment.monthly_salary_old || 
                          userData?.allEmployment?.[0]?.monthly_salary_old ||
                          userData?.monthlyIncome ||
                          getUserData('personalInfo.monthlyIncome');
    const paymentMode = latestEmployment.salary_payment_mode || 
                       latestEmployment.payment_mode ||
                       userData?.paymentMode || 'N/A';

    return (
      <div className="space-y-4">
        {/* Compact Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">Age</div>
            <div className="text-sm font-semibold text-gray-900">{getUserData('personalInfo.age')}Y</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">Gender</div>
            <div className="text-sm font-semibold text-gray-900">{getUserData('personalInfo.gender')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative">
            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              PAN
              {userData?.duplicateChecks?.panExists && (
                <span className="text-red-600" title={`PAN exists in ${userData.duplicateChecks.panDuplicateUsers.length} other profile(s)`}>
                  ⚠️
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900">{userData?.panNumber || 'N/A'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative">
            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              Mobile
              {userData?.duplicateChecks?.mobileExists && (
                <span className="text-red-600" title={`Mobile exists in ${userData.duplicateChecks.mobileDuplicateUsers.length} other profile(s)`}>
                  ⚠️
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900">{getUserData('mobile')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">Alt Mobile</div>
            <div className="text-sm font-semibold text-gray-900">{userData?.alternateMobile || 'N/A'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">Email</div>
            <div className="text-sm font-semibold text-gray-900 truncate">{getUserData('email')}</div>
          </div>
        </div>

        {/* Basic Information & Contact - Compact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Basic Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Basic Information
            </h3>
            <div className="space-y-2 text-sm">
              {(() => {
                const userInfoRecords = userData?.userInfoRecords || [];
                const aadharInfo = userInfoRecords.find((r: any) => r.source === 'digilocker');
                const panInfo = userInfoRecords.find((r: any) => r.source === 'pan_api');
                return (
                  <>
                    {aadharInfo?.name && (
                      <div>
                        <span className="text-gray-500">Name (Aadhar):</span>
                        <span className="ml-2 text-gray-900">{aadharInfo.name}</span>
                        <span className="ml-2 text-xs text-blue-600">(Digilocker)</span>
                      </div>
                    )}
                    {panInfo?.name && (
                      <div>
                        <span className="text-gray-500">Name (PAN):</span>
                        <span className="ml-2 text-gray-900">{panInfo.name}</span>
                        <span className="ml-2 text-xs text-blue-600">(PAN API)</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div>
                <span className="text-gray-500">DOB (User Entered):</span>
                <span className="ml-2 text-gray-900">{formatDate(getUserData('dateOfBirth'))}</span>
              </div>
              {(() => {
                const userInfoRecords = userData?.userInfoRecords || [];
                const aadharInfo = userInfoRecords.find((r: any) => r.source === 'digilocker');
                const panInfo = userInfoRecords.find((r: any) => r.source === 'pan_api');
                return (
                  <>
                    {aadharInfo?.dob && (
                      <div>
                        <span className="text-gray-500">DOB (Aadhar):</span>
                        <span className="ml-2 text-gray-900">{formatDate(aadharInfo.dob)}</span>
                        <span className="ml-2 text-xs text-blue-600">(Digilocker)</span>
                      </div>
                    )}
                    {panInfo?.dob && (
                      <div>
                        <span className="text-gray-500">DOB (PAN):</span>
                        <span className="ml-2 text-gray-900">{formatDate(panInfo.dob)}</span>
                        <span className="ml-2 text-xs text-blue-600">(PAN API)</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div>
                <span className="text-gray-500">Marital Status:</span>
                <span className="ml-2 text-gray-900">{getUserData('personalInfo.maritalStatus')}</span>
              </div>
              <div>
                <span className="text-gray-500">Education:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.education || getUserData('personalInfo.education') || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Selected Options (from Step 2 - Employment Quick Check) */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Selected Options (Step 2)
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Employment Type:</span>
                <span className="ml-2 text-gray-900 font-medium capitalize">
                  {latestEmployment.employment_type || userData?.employmentType || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Payment Mode:</span>
                <span className="ml-2 text-gray-900 font-medium capitalize">
                  {(() => {
                    const mode = latestEmployment.salary_payment_mode || latestEmployment.payment_mode;
                    if (!mode) return 'N/A';
                    // Format: bank_transfer -> Bank Transfer, cash -> Cash, etc.
                    return mode.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                  })()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Income Range:</span>
                <span className="ml-2 text-gray-900 font-medium">
                  {(() => {
                    const range = userData?.incomeRange || latestEmployment.income_range;
                    if (!range) return 'N/A';
                    const rangeMap: { [key: string]: string } = {
                      '1k-20k': '₹1k - ₹20k',
                      '20k-30k': '₹20k - ₹30k',
                      '30k-40k': '₹30k - ₹40k',
                      'above-40k': 'Above ₹40k'
                    };
                    return rangeMap[range] || range;
                  })()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Date of Birth (Step 2):</span>
                <span className="ml-2 text-gray-900 font-medium">
                  {userData?.dateOfBirth ? formatDate(userData.dateOfBirth) : formatDate(getUserData('dateOfBirth')) || 'N/A'}
                </span>
              </div>
              {userData?.application_hold_reason && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-500">Hold Reason:</span>
                  <span className="ml-2 text-red-600 font-medium">{userData.application_hold_reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact Information
              </h3>
              {canEditUsers && (
                <button
                  onClick={() => {
                    setContactInfoForm({
                      email: getUserData('email') || '',
                      phone: getUserData('mobile') || '',
                      alternatePhone: userData?.alternateMobile || '',
                      personalEmail: userData?.personalEmail || '',
                      officialEmail: userData?.officialEmail || '',
                      companyEmail: userData?.companyEmail || ''
                    });
                    setShowContactModal(true);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Edit className="w-3 h-3 inline mr-1" />
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Primary:</span>
                <span className="ml-2 font-medium text-gray-900">{getUserData('mobile')}</span>
              </div>
              <div>
                <span className="text-gray-500">Alternate:</span>
                <span className="ml-2 text-gray-900">{userData?.alternateMobile || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 text-gray-900 truncate">{getUserData('email') && getUserData('email') !== 'N/A' ? getUserData('email') : (userData?.personalEmail || userData?.officialEmail || 'N/A')}</span>
              </div>
              {userData?.personalEmail && (
                <div>
                  <span className="text-gray-500">Personal Email:</span>
                  <span className="ml-2 text-gray-900 truncate">{userData.personalEmail}</span>
                </div>
              )}
              {userData?.officialEmail && (
                <div>
                  <span className="text-gray-500">Official Email:</span>
                  <span className="ml-2 text-gray-900 truncate">{userData.officialEmail}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Company Email:</span>
                <span className="ml-2 text-gray-900 truncate">{userData?.companyEmail && userData.companyEmail !== 'N/A' ? userData.companyEmail : 'N/A'}</span>
              </div>
              {userData?.companyName && userData.companyName !== 'N/A' && (
                <div>
                  <span className="text-gray-500">Company:</span>
                  <span className="ml-2 text-gray-900">{userData.companyName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Employment Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Employment
              </h3>
              {canEditUsers && (
                <button
                  onClick={() => {
                    const latestEmployment = userData?.allEmployment?.[0] || {};
                    setEmploymentInfoForm({
                      company: latestEmployment.company_name || userData?.companyName || '',
                      companyName: latestEmployment.company_name || userData?.companyName || '',
                      designation: latestEmployment.designation || '',
                      industry: latestEmployment.industry || '',
                      department: latestEmployment.department || '',
                      monthlyIncome: userData?.personalInfo?.monthlyIncome?.toString() || '',
                      income: userData?.personalInfo?.monthlyIncome?.toString() || '',
                      workExperience: latestEmployment.work_experience_years?.toString() || ''
                    });
                    setShowEmploymentModal(true);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Edit className="w-3 h-3 inline mr-1" />
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.employment_type || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Company:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.company_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Designation:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.designation || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Industry:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.industry || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Department:</span>
                <span className="ml-2 text-gray-900">{latestEmployment.department || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Experience:</span>
                <span className="ml-2 text-gray-900">
                  {userData?.work_experience_range || getUserData('work_experience_range') || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Salary Date:</span>
                {editingSalaryDate ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={salaryDateEditValue}
                      onChange={(e) => setSalaryDateEditValue(e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Day (1-31)"
                    />
                    <button
                      onClick={handleSaveSalaryDate}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelSalaryDateEdit}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="ml-2 text-gray-900">
                      {userData?.salaryDate 
                        ? `${userData.salaryDate}${(() => {
                            const day = Number(userData.salaryDate);
                            if (day === 1 || day === 21 || day === 31) return 'st';
                            if (day === 2 || day === 22) return 'nd';
                            if (day === 3 || day === 23) return 'rd';
                            return 'th';
                          })()}` 
                        : 'N/A'}
                    </span>
                    {canEditUsers && (
                      <button
                        onClick={handleEditSalaryDate}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Salary Date"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
              <div>
                <span className="text-gray-500">Income:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {(() => {
                    // Try multiple sources for income - prioritize employment record
                    const income = latestEmployment?.monthly_salary_old ||
                                  userData?.allEmployment?.[0]?.monthly_salary_old ||
                                  userData?.monthlyIncome || 
                                  getUserData('personalInfo.monthlyIncome');
                    // Check if it's a valid number greater than 0
                    if (income === null || income === undefined || income === 'N/A') return 'N/A';
                    const incomeNum = typeof income === 'number' ? income : parseFloat(income);
                    return incomeNum && incomeNum > 0 ? formatCurrency(incomeNum) : 'N/A';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Addresses - Compact Cards */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Addresses ({allAddresses.length})
            </h3>
            {canEditUsers && (
              <button
                onClick={() => {
                  setAddressInfoForm({
                    address_line1: '',
                    address_line2: '',
                    city: '',
                    state: '',
                    pincode: '',
                    country: 'India',
                    address_type: 'current',
                    is_primary: false
                  });
                  setEditingAddressId(null);
                  setShowAddressModal(true);
                }}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
          {allAddresses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAddresses.map((addr: any, idx: number) => (
                <div key={addr.id || idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                      {addr.is_primary ? 'Primary' : addr.source || 'Address'}
                    </span>
                    {addr.source && (
                      <span className="text-xs text-gray-500">{addr.source}</span>
                    )}
                  </div>
                  <div className="text-xs space-y-1 text-gray-700">
                    {addr.address_line1 && <div>{addr.address_line1}</div>}
                    {addr.address_line2 && <div>{addr.address_line2}</div>}
                    <div>
                      {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                    </div>
                    {addr.country && addr.country !== 'India' && <div>{addr.country}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No addresses found</p>
          )}
        </div>


        {/* Loan Plan - Compact */}
        {userLoanPlan && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Loan Plan
              </h3>
              {canEditUsers && (
                <button
                  onClick={() => {
                    setSelectedLoanPlanId(userLoanPlan?.id || null);
                    setShowLoanPlanModal(true);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Plan:</span>
                <span className="ml-2 font-medium text-gray-900">{userLoanPlan.plan_name}</span>
              </div>
              <div>
                <span className="text-gray-500">Code:</span>
                <span className="ml-2 text-gray-900">{userLoanPlan.plan_code}</span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 text-gray-900">{userLoanPlan.plan_type === 'single' ? 'Single' : 'Multi-EMI'}</span>
              </div>
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 text-gray-900">{userLoanPlan.repayment_days || userLoanPlan.emi_count || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Login History */}
        {userData?.loginHistory && userData.loginHistory.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Login History ({userData.loginHistory.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Login Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">OS</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userData.loginHistory.slice(0, 10).map((login: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {login.login_time ? formatDate(login.login_time) : 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-mono text-xs">
                        {login.ip_address || 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {login.browser_name || 'Unknown'}
                        {login.browser_version && ` ${login.browser_version}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900 capitalize">
                        {login.device_type || 'Unknown'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {login.os_name || 'Unknown'}
                        {login.os_version && ` ${login.os_version}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {login.location_city && login.location_country 
                          ? `${login.location_city}, ${login.location_country}`
                          : login.location_country || 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          login.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {login.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {userData.loginHistory.length > 10 && (
              <p className="text-xs text-gray-500 mt-2">Showing latest 10 logins. Total: {userData.loginHistory.length}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Documents Tab
  const renderDocumentsTab = () => {
    const documents = getUserData('documents');
    console.log('Documents data:', documents);
    return (
      <div className="space-y-6">
        {/* Upload Document Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
            <button
              onClick={() => setShowUploadNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload New
            </button>
          </div>
        </div>

        {/* Document Verification Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Document Verification</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {getArray('documents').filter(doc => doc.status === 'verified').length} of {getArray('documents').length} verified
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getArray('documents').map((doc, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{doc.type}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${doc.status === 'verified' ? 'bg-green-100 text-green-800' :
                    doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{doc.description}</p>

                {/* Document Preview */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span>{doc.fileName || `${doc.type.toLowerCase().replace(' ', '_')}.pdf`}</span>
                    <span className="text-xs text-gray-500">({doc.fileSize || '2.4 MB'})</span>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (doc.url) {
                          window.open(doc.url, '_blank');
                        } else {
                          alert('Document URL not available. Please refresh the page.');
                        }
                      }}
                      disabled={!doc.url}
                      className={`flex items-center gap-1 text-sm px-3 py-1.5 border rounded-md transition-colors ${
                        doc.url 
                          ? 'text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50' 
                          : 'text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button 
                      onClick={() => {
                        if (doc.url) {
                          const link = document.createElement('a');
                          link.href = doc.url;
                          link.download = doc.fileName || 'document';
                          link.target = '_blank';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else {
                          alert('Document URL not available. Please refresh the page.');
                        }
                      }}
                      disabled={!doc.url}
                      className={`flex items-center gap-1 text-sm px-3 py-1.5 border rounded-md transition-colors ${
                        doc.url 
                          ? 'text-green-600 hover:text-green-800 border-green-200 hover:bg-green-50' 
                          : 'text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>

                  {doc.status !== 'verified' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-3 py-1.5 bg-green-50 border border-green-200 rounded-md hover:bg-green-100">
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100">
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100">
                        <MessageSquare className="w-4 h-4" />
                        Comment
                      </button>
                    </div>
                  )}

                  {doc.status === 'verified' && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Verified by Admin on {doc.verifiedDate || '2025-01-15'}</span>
                      </div>
                    </div>
                  )}

                  {doc.status === 'rejected' && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <XCircle className="w-4 h-4" />
                        <span>Rejected on {doc.rejectedDate || '2025-01-15'}</span>
                      </div>
                      {doc.rejectionReason && (
                        <p className="text-xs text-gray-600 mt-1">Reason: {doc.rejectionReason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Bank Details Action Handlers
  const handleApproveBankDetails = async (bankId: string) => {
    if (!bankId) {
      alert('Bank details ID not found');
      return;
    }

    if (!confirm('Are you sure you want to approve these bank details?')) {
      return;
    }

    try {
      const response = await adminApiService.updateBankDetailsStatus(params.userId!, bankId, 'verified');
      if (response.status === 'success') {
        alert('Bank details approved successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to approve bank details');
      }
    } catch (error) {
      console.error('Error approving bank details:', error);
      alert('Error approving bank details');
    }
  };

  const handleRejectBankDetails = async (bankId: string) => {
    if (!bankId) {
      alert('Bank details ID not found');
      return;
    }

    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const response = await adminApiService.updateBankDetailsStatus(params.userId!, bankId, 'rejected', reason);
      if (response.status === 'success') {
        alert('Bank details rejected successfully!');
        // Refresh user data
        const profileResponse = await adminApiService.getUserProfile(params.userId!);
        if (profileResponse.status === 'success') {
          setUserData(profileResponse.data);
        }
      } else {
        alert('Failed to reject bank details');
      }
    } catch (error) {
      console.error('Error rejecting bank details:', error);
      alert('Error rejecting bank details');
    }
  };

  const handleAddBankComment = async (bankId: string) => {
    if (!bankId) {
      alert('Bank details ID not found');
      return;
    }

    // For now just show alert as comment functionality is not fully implemented in backend for bank details specifically
    alert('Comment functionality coming soon');
  };

  // Bank Information Tab
  const renderBankTab = () => (
    <div className="space-y-6">
      {/* Bank Account Details Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bank Account Details</h3>
          <div className="flex items-center gap-3">
            {getUserData('bankInfo.id') && (
              <button
                onClick={handleEditBankDetails}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Bank Details
              </button>
            )}
            <button
              onClick={() => setShowAddBankModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Bank Details
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Verification Status</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getUserData('bankInfo.verificationStatus') === 'verified' ? 'bg-green-100 text-green-800' :
                getUserData('bankInfo.verificationStatus') === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  getUserData('bankInfo.verificationStatus') === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                }`}>
                {getUserData('bankInfo.verificationStatus') || 'pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <p className="text-gray-900">{getUserData('bankInfo.bankName')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Account Number
              {userData?.duplicateChecks?.bankAccountExists && (
                <span className="text-red-600" title={`Bank account exists in ${userData.duplicateChecks.bankAccountDuplicateUsers.length} other profile(s)`}>
                  ⚠️
                </span>
              )}
            </label>
            <p className="text-gray-900 font-mono">{getUserData('bankInfo.accountNumber')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
            <p className="text-gray-900 font-mono">{getUserData('bankInfo.ifscCode')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <p className="text-gray-900">{getUserData('bankInfo.accountType')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
            <p className="text-gray-900">{getUserData('bankInfo.accountHolderName') || getUserData('name')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
            <p className="text-gray-900">{getUserData('bankInfo.branchName') || 'Main Branch'}</p>
          </div>
        </div>

        {/* Admin Actions for Bank Details */}
        {getUserData('bankInfo.verificationStatus') !== 'verified' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Admin Actions:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveBankDetails(getUserData('bankInfo.id') || getUserData('bankDetails.0.id'))}
                  className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-4 py-2 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleRejectBankDetails(getUserData('bankInfo.id') || getUserData('bankDetails.0.id'))}
                  className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm px-4 py-2 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => handleAddBankComment(getUserData('bankInfo.id') || getUserData('bankDetails.0.id'))}
                  className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm px-4 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100"
                >
                  <MessageSquare className="w-4 h-4" />
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verification History */}
        {getUserData('bankInfo.verificationStatus') === 'verified' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span>Bank details verified by Admin on {getUserData('bankInfo.verifiedDate') || '2025-01-15'}</span>
            </div>
          </div>
        )}

        {getUserData('bankInfo.verificationStatus') === 'rejected' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4" />
              <span>Bank details rejected on {getUserData('bankInfo.rejectedDate') || '2025-01-15'}</span>
            </div>
            {getUserData('bankInfo.rejectionReason') && (
              <p className="text-sm text-red-600 mt-2">Reason: {getUserData('bankInfo.rejectionReason')}</p>
            )}
          </div>
        )}
      </div>

      {/* Bank Details History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details History</h3>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Current Bank Details</h4>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Bank:</span> {getUserData('bankInfo.bankName')}
              </div>
              <div>
                <span className="text-gray-600">Account:</span> {getUserData('bankInfo.accountNumber')}
              </div>
              <div>
                <span className="text-gray-600">IFSC:</span> {getUserData('bankInfo.ifscCode')}
              </div>
              <div>
                <span className="text-gray-600">Added:</span> {formatDate(getUserData('bankInfo.addedDate') || '2025-01-09')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Statement Verification Tab
  const renderStatementVerificationTab = () => {
    const fetchBankStatement = async () => {
      if (!params.userId) return;
      setLoadingStatement(true);
      try {
        const response = await adminApiService.getBankStatement(params.userId);
        if (response.success && response.data) {
          setBankStatement(response.data.statement);
        }
      } catch (error) {
        console.error('Error fetching bank statement:', error);
        toast.error('Failed to fetch bank statement');
      } finally {
        setLoadingStatement(false);
      }
    };

    const handleTriggerVerification = async () => {
      if (!params.userId) {
        toast.error('User ID not found');
        return;
      }

      setVerifyingStatement(true);
      try {
        // No file upload needed - backend will use existing file from S3 and generate Digitap URL
        const response = await adminApiService.triggerBankStatementVerification(params.userId, null);
        if (response.success) {
          toast.success('Verification initiated successfully');
          await fetchBankStatement();
        } else {
          toast.error(response.message || 'Failed to trigger verification');
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        toast.error(error.message || 'Failed to trigger verification');
      } finally {
        setVerifyingStatement(false);
      }
    };

    const handleCheckStatus = async () => {
      if (!params.userId) return;
      setLoadingStatement(true);
      try {
        const response = await adminApiService.checkBankStatementStatus(params.userId);
        if (response.success) {
          toast.success('Status updated');
          await fetchBankStatement();
        } else {
          toast.error(response.message || 'Failed to check status');
        }
      } catch (error) {
        console.error('Status check error:', error);
        toast.error('Failed to check status');
      } finally {
        setLoadingStatement(false);
      }
    };

    const handleFetchReport = async () => {
      if (!params.userId) return;
      setLoadingStatement(true);
      try {
        const response = await adminApiService.fetchBankStatementReport(params.userId);
        if (response.success) {
          toast.success('Report fetched successfully');
          await fetchBankStatement();
        } else {
          toast.error(response.message || 'Failed to fetch report');
        }
      } catch (error) {
        console.error('Report fetch error:', error);
        toast.error('Failed to fetch report');
      } finally {
        setLoadingStatement(false);
      }
    };

    const handleUpdateDecision = async (decision: 'approved' | 'rejected', notes?: string) => {
      if (!params.userId) return;
      try {
        const response = await adminApiService.updateBankStatementDecision(params.userId, decision, notes);
        if (response.success) {
          toast.success(`Statement ${decision} successfully`);
          await fetchBankStatement();
        } else {
          toast.error(response.message || 'Failed to update decision');
        }
      } catch (error) {
        console.error('Decision update error:', error);
        toast.error('Failed to update decision');
      }
    };

    if (loadingStatement && !bankStatement) {
      return (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    const statement = bankStatement;
    const hasStatement = !!statement;
    const userStatus = statement?.user_status || 'none';
    const verificationStatus = statement?.verification_status || 'not_started';

    return (
      <div className="space-y-6">
        {/* Statement Details */}
        {hasStatement && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Statement Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Reference Number</label>
                <p className="text-gray-900 font-mono text-sm">{statement.client_ref_num || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                <p className="text-gray-900">{statement.file_name || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Size</label>
                <p className="text-gray-900">
                  {statement.file_size ? `${(statement.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Method</label>
                <p className="text-gray-900 capitalize">{statement.upload_method || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uploaded At</label>
                <p className="text-gray-900">
                  {statement.created_at ? new Date(statement.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              {statement.request_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Request ID</label>
                  <p className="text-gray-900 font-mono text-sm">{statement.request_id}</p>
                </div>
              )}
              {statement.txn_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                  <p className="text-gray-900 font-mono text-sm">{statement.txn_id}</p>
                </div>
              )}
              {/* Show uploaded file for manual uploads */}
              {statement.upload_method === 'manual' && statement.file_path && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Uploaded File</label>
                  <a
                    href={statement.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    {statement.file_name || 'Download File'}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Actions - Only for manual uploads */}
        {(!hasStatement || (hasStatement && statement.upload_method === 'manual')) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Verification Actions</h4>

            {!hasStatement && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No bank statement uploaded yet. User needs to upload a statement first.
                </p>
              </div>
            )}

          {hasStatement && verificationStatus === 'not_started' && statement.upload_method === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  The existing uploaded file will be used for Digitap verification. Click the button below to generate a Digitap upload URL and upload the file.
                </p>
              </div>
              <Button
                onClick={handleTriggerVerification}
                disabled={verifyingStatement}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {verifyingStatement ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Trigger Digitap Verification
                  </>
                )}
              </Button>
            </div>
          )}

          {hasStatement && verificationStatus === 'api_verification_pending' && statement.upload_method === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  Verification is in progress. You can check the status or fetch the report when ready.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleCheckStatus}
                  disabled={loadingStatement}
                  variant="outline"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingStatement ? 'animate-spin' : ''}`} />
                  Check Status
                </Button>
                <Button
                  onClick={handleFetchReport}
                  disabled={loadingStatement}
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Fetch Report
                </Button>
              </div>
            </div>
          )}

          {hasStatement && verificationStatus === 'api_verified' && statement.upload_method === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 mb-2">
                  ✓ Digitap API verification completed successfully.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleFetchReport}
                  disabled={loadingStatement}
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  View Report
                </Button>
                <Button
                  onClick={() => handleUpdateDecision('approved')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Statement
                </Button>
                <Button
                  onClick={() => {
                    const notes = prompt('Enter rejection reason:');
                    if (notes) handleUpdateDecision('rejected', notes);
                  }}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Statement
                </Button>
              </div>
            </div>
          )}

          {hasStatement && verificationStatus === 'api_failed' && statement.upload_method === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">
                  ✗ Digitap API verification failed. {statement.upload_method === 'manual' ? 'You can retry with a new file.' : 'Please check the API logs or contact support.'}
                </p>
              </div>
              {statement.upload_method === 'manual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload New File for Retry
                  </label>
                  <Button
                    onClick={handleTriggerVerification}
                    disabled={verifyingStatement}
                    className="mt-3 bg-blue-600 hover:bg-blue-700"
                  >
                    {verifyingStatement ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Retry Verification'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* Report Data */}
        {hasStatement && statement.reportData && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Verification Report</h4>
            
            {statement.upload_method === 'online' && typeof statement.reportData === 'object' ? (
              <div className="space-y-6">
                {/* Customer Info */}
                {statement.reportData.customer_info && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Customer Information</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(statement.reportData.customer_info).map(([key, value]: [string, any]) => (
                            <tr key={key}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 capitalize">
                                {key.replace(/_/g, ' ')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{value || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Accounts */}
                {statement.reportData.accounts && Array.isArray(statement.reportData.accounts) && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Account Details</h5>
                    {statement.reportData.accounts.map((account: any, accIndex: number) => (
                      <div key={accIndex} className="mb-6 border border-gray-200 rounded-lg p-4">
                        <h6 className="text-xs font-semibold text-gray-700 mb-3">Account {accIndex + 1}</h6>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          {Object.entries(account).filter(([key]) => key !== 'transactions').map(([key, value]: [string, any]) => (
                            <div key={key}>
                              <div className="text-xs font-medium text-gray-600 capitalize mb-1">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-sm text-gray-900">{value || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Transactions Table */}
                        {account.transactions && Array.isArray(account.transactions) && account.transactions.length > 0 && (
                          <div className="mt-4">
                            <h6 className="text-xs font-semibold text-gray-700 mb-2">Transactions ({account.transactions.length})</h6>
                            <div className="overflow-x-auto max-h-96">
                              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Amount</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Balance</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Narration</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Tamper Flag</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {account.transactions.map((txn: any, txnIndex: number) => (
                                    <tr key={txnIndex} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-gray-900">{txn.date || 'N/A'}</td>
                                      <td className={`px-3 py-2 font-medium ${
                                        txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {txn.amount > 0 ? '+' : ''}{txn.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                                      </td>
                                      <td className="px-3 py-2 text-gray-900">{txn.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || 'N/A'}</td>
                                      <td className="px-3 py-2 text-gray-900">{txn.category || 'N/A'}</td>
                                      <td className="px-3 py-2 text-gray-900 max-w-xs truncate" title={txn.narration}>
                                        {txn.narration || 'N/A'}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          txn.tamper_flag === 'GREEN' ? 'bg-green-100 text-green-800' :
                                          txn.tamper_flag === 'RED' ? 'bg-red-100 text-red-800' :
                                          'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          {txn.tamper_flag || 'N/A'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Analysis Data */}
                {statement.reportData.analysis_data && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Analysis Data</h5>
                    {Object.entries(statement.reportData.analysis_data).map(([period, data]: [string, any]) => (
                      <div key={period} className="mb-4 border border-gray-200 rounded-lg p-4">
                        <h6 className="text-xs font-semibold text-gray-700 mb-3">{period}</h6>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 text-xs">
                            <tbody className="bg-white divide-y divide-gray-200">
                              {Object.entries(data).slice(0, 20).map(([key, value]: [string, any]) => (
                                <tr key={key}>
                                  <td className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 w-1/3">
                                    {key.replace(/_/g, ' ')}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-900">
                                    {typeof value === 'number' ? value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : (value || 'N/A')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {Object.keys(data).length > 20 && (
                            <p className="text-xs text-gray-500 mt-2 px-3">
                              Showing first 20 of {Object.keys(data).length} fields. Full data available in API response.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tamper Detection */}
                {statement.reportData.tamper_detection_details && Array.isArray(statement.reportData.tamper_detection_details) && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Tamper Detection Details</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(statement.reportData.tamper_detection_details[0] || {}).map((key) => (
                              <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-gray-700 capitalize">
                                {key.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {statement.reportData.tamper_detection_details.map((detail: any, index: number) => (
                            <tr key={index}>
                              {Object.values(detail).map((value: any, valIndex: number) => (
                                <td key={valIndex} className="px-4 py-2 text-sm text-gray-900">
                                  {value || 'N/A'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Statement Period Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statement.reportData.statement_start_date && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600 mb-1">Statement Start Date</div>
                      <div className="text-sm text-gray-900">{statement.reportData.statement_start_date}</div>
                    </div>
                  )}
                  {statement.reportData.statement_end_date && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600 mb-1">Statement End Date</div>
                      <div className="text-sm text-gray-900">{statement.reportData.statement_end_date}</div>
                    </div>
                  )}
                  {statement.reportData.duration_in_month && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600 mb-1">Duration (Months)</div>
                      <div className="text-sm text-gray-900">{statement.reportData.duration_in_month}</div>
                    </div>
                  )}
                  {statement.reportData.source_of_data && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600 mb-1">Source of Data</div>
                      <div className="text-sm text-gray-900">{statement.reportData.source_of_data}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(statement.reportData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Verification History */}
        {hasStatement && statement.verified_at && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Verification History</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Verified By:</span>{' '}
                <span className="text-gray-900">Admin ID {statement.verified_by || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Verified At:</span>{' '}
                <span className="text-gray-900">
                  {statement.verified_at ? new Date(statement.verified_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              {statement.verification_decision && (
                <div>
                  <span className="font-medium text-gray-700">Decision:</span>{' '}
                  <span className={`font-semibold ${
                    statement.verification_decision === 'approved' ? 'text-green-600' :
                    statement.verification_decision === 'rejected' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {statement.verification_decision.toUpperCase()}
                  </span>
                </div>
              )}
              {statement.verification_notes && (
                <div>
                  <span className="font-medium text-gray-700">Notes:</span>{' '}
                  <span className="text-gray-900">{statement.verification_notes}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reference Tab
  const renderReferenceTab = () => {
    const allReferences = userData?.references || [];
    
    const handleEditReference = (refId: number, field: 'name' | 'phone' | 'relation') => {
      setEditingReference(refId);
      setEditingReferenceField({ ...editingReferenceField, [refId]: field });
      const ref = allReferences.find((r: any) => r.id === refId);
      setReferenceEditValues({
        ...referenceEditValues,
        [refId]: {
          name: ref?.name || '',
          phone: ref?.phone || '',
          relation: ref?.relation || ''
        }
      });
    };

    const handleSaveReferenceEdit = async (refId: number) => {
      const editData = referenceEditValues[refId];
      if (!editData) return;

      // Validate phone number if it's being edited - must be exactly 10 digits
      if (editData.phone) {
        const phoneDigits = editData.phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          toast.error('Phone number must be exactly 10 digits');
          return;
        }
      }

      try {
        const response = await adminApiService.updateReference(
          params.userId!,
          refId.toString(),
          editData
        );

        if (response.status === 'success') {
          toast.success('Reference updated successfully!');
          setEditingReference(null);
          setEditingReferenceField({ ...editingReferenceField, [refId]: null });
          // Refresh user data
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
          }
        } else {
          toast.error(response.message || 'Failed to update reference');
        }
      } catch (error: any) {
        console.error('Error updating reference:', error);
        toast.error(error.message || 'Failed to update reference');
      }
    };

    const handleCancelEdit = (refId: number) => {
      setEditingReference(null);
      setEditingReferenceField({ ...editingReferenceField, [refId]: null });
      setReferenceEditValues({ ...referenceEditValues, [refId]: {} });
    };
    
    const handleVerifyReference = async (referenceId: number) => {
      if (!confirm('Are you sure you want to verify this reference?')) {
        return;
      }

      try {
        const response = await adminApiService.updateReferenceStatus(
          params.userId!,
          referenceId.toString(),
          'verified'
        );

        if (response.status === 'success') {
          toast.success('Reference verified successfully!');
          // Refresh user data
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
          }
        } else {
          toast.error(response.message || 'Failed to verify reference');
        }
      } catch (error: any) {
        console.error('Error verifying reference:', error);
        toast.error(error.message || 'Failed to verify reference');
      }
    };

    const handleRejectReference = async (referenceId: number) => {
      const reason = prompt('Please provide a reason for rejection:');
      if (!reason) return;

      try {
        const response = await adminApiService.updateReferenceStatus(
          params.userId!,
          referenceId.toString(),
          'rejected',
          undefined,
          reason
        );

        if (response.status === 'success') {
          toast.success('Reference rejected successfully!');
          // Refresh user data
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
          }
        } else {
          toast.error(response.message || 'Failed to reject reference');
        }
      } catch (error: any) {
        console.error('Error rejecting reference:', error);
        toast.error(error.message || 'Failed to reject reference');
      }
    };

    const handleSaveNote = async (referenceId: number) => {
      const note = noteText[referenceId] || '';
      
      try {
        const response = await adminApiService.updateReferenceStatus(
          params.userId!,
          referenceId.toString(),
          undefined,
          note
        );

        if (response.status === 'success') {
          toast.success('Note saved successfully!');
          setEditingNote(null);
          // Refresh user data
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
          }
        } else {
          toast.error(response.message || 'Failed to save note');
        }
      } catch (error: any) {
        console.error('Error saving note:', error);
        toast.error(error.message || 'Failed to save note');
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Reference Details</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddReferenceModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Reference
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {allReferences.filter((ref: any) => ref.status === 'verified').length} of {allReferences.length} verified
                </span>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {allReferences.length > 0 ? (
            <div className="space-y-4">
              {allReferences.map((ref: any, index: number) => (
                <div key={ref.id || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    {editingReference === ref.id && editingReferenceField[ref.id] === 'name' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={referenceEditValues[ref.id]?.name || ''}
                          onChange={(e) => setReferenceEditValues({
                            ...referenceEditValues,
                            [ref.id]: { ...referenceEditValues[ref.id], name: e.target.value }
                          })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Name"
                        />
                        <button
                          onClick={() => handleSaveReferenceEdit(ref.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => handleCancelEdit(ref.id)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <h4 className="font-medium text-gray-900">{ref.name || 'N/A'}</h4>
                        {canEditUsers && (
                          <button
                            onClick={() => handleEditReference(ref.id, 'name')}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Name"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ref.status === 'verified' ? 'bg-green-100 text-green-800' :
                      ref.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ref.status || 'pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Relationship:</span>
                      {editingReference === ref.id && editingReferenceField[ref.id] === 'relation' ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={referenceEditValues[ref.id]?.relation || ''}
                            onChange={(e) => setReferenceEditValues({
                              ...referenceEditValues,
                              [ref.id]: { ...referenceEditValues[ref.id], relation: e.target.value }
                            })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Relation"
                          />
                          <button
                            onClick={() => handleSaveReferenceEdit(ref.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleCancelEdit(ref.id)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{ref.relation || 'N/A'}</span>
                          {canEditUsers && (
                            <button
                              onClick={() => handleEditReference(ref.id, 'relation')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit Relation"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 flex items-center gap-1">
                        Phone:
                        {userData?.duplicateChecks?.referencePhoneExists && 
                         userData.duplicateChecks.referencePhoneDuplicateUsers.some((u: any) => 
                           u.matchingPhone === ref.phone || u.phone === ref.phone || u.alternate_mobile === ref.phone
                         ) && (
                          <span className="text-red-600" title="This reference phone matches another user's mobile number">
                            ⚠️
                          </span>
                        )}
                      </span>
                      {editingReference === ref.id && editingReferenceField[ref.id] === 'phone' ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={referenceEditValues[ref.id]?.phone || ''}
                            onChange={(e) => setReferenceEditValues({
                              ...referenceEditValues,
                              [ref.id]: { ...referenceEditValues[ref.id], phone: e.target.value }
                            })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Phone"
                          />
                          <button
                            onClick={() => handleSaveReferenceEdit(ref.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleCancelEdit(ref.id)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{ref.phone || 'N/A'}</span>
                          {canEditUsers && (
                            <button
                              onClick={() => handleEditReference(ref.id, 'phone')}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit Phone"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Admin Actions for Reference */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <a 
                        href={`tel:${ref.phone}`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm px-3 py-1.5 border border-blue-200 rounded-md hover:bg-blue-50"
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {ref.status !== 'verified' && (
                        <button
                          onClick={() => handleVerifyReference(ref.id)}
                          className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-3 py-1.5 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Verify
                        </button>
                      )}
                      {ref.status !== 'rejected' && (
                        <button
                          onClick={() => handleRejectReference(ref.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Verification Status Messages */}
                  {ref.status === 'verified' && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span>Verified by Admin{ref.updated_at ? ` on ${formatDate(ref.updated_at)}` : ''}</span>
                      </div>
                    </div>
                  )}

                  {ref.status === 'rejected' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-red-700">
                        <XCircle className="w-4 h-4" />
                        <span>Rejected{ref.updated_at ? ` on ${formatDate(ref.updated_at)}` : ''}</span>
                      </div>
                    </div>
                  )}

                  {/* Notes Section */}
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Admin Notes
                      </label>
                      {editingNote !== ref.id && (
                        <button
                          onClick={() => {
                            setEditingNote(ref.id);
                            setNoteText({ ...noteText, [ref.id]: ref.notes || '' });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {ref.notes ? 'Edit' : 'Add Note'}
                        </button>
                      )}
                    </div>
                    
                    {editingNote === ref.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText[ref.id] || ''}
                          onChange={(e) => setNoteText({ ...noteText, [ref.id]: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          rows={3}
                          placeholder="Add notes about this reference..."
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveNote(ref.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                          >
                            Save Note
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 min-h-[60px]">
                        {ref.notes || 'No notes added yet'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No references found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Login Data Tab
  const renderLoginDataTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Login History</h3>
        <div className="space-y-3">
          {getArray('loginHistory').map((login, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{login.device}</p>
                  <p className="text-xs text-gray-600">{login.location}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-900">{login.time}</p>
                <p className="text-xs text-gray-600">{login.ip}</p>
              </div>
            </div>
          )) || (
              <div className="text-center py-8 text-gray-500">
                <p>No login history available</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );

  // Handle Excel download (component-level function)
  const handleDownloadExcel = async (txnId: string | null) => {
    if (!txnId) {
      alert('Transaction ID not available. Cannot download Excel report.');
      return;
    }

    try {
      setDownloadingExcel(true);
      const excelBlob = await adminApiService.downloadBankStatementExcel(txnId);
      
      // Create download link
      const url = window.URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bank_statement_${txnId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Excel downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading Excel:', error);
      alert('Failed to download Excel report: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Accounts Tab (Account Aggregator)
  const renderAccountsTab = () => {
    const banks = getUserData('bankStatement.banks', []);
    const statementSummary = getUserData('bankStatement.request_level_summary_var', null);
    const txnId = getUserData('bankStatement.txn_id', null);

    // If no data, showing a placeholder or empty state
    if ((!banks || banks.length === 0) && !statementSummary) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Account Data Available</h3>
          <p className="text-gray-600 mb-6">There is no account aggregator data available for this user.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Refresh Bank Data
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Statement Summary Card */}
        {statementSummary && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Statement Summary</h3>
                  <p className="text-sm text-gray-500">Analysis Overview</p>
                </div>
              </div>
              {txnId && (
                <button
                  onClick={() => handleDownloadExcel(txnId)}
                  disabled={downloadingExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {downloadingExcel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Excel</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Balance Metrics */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Min Balance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Min Balance"] || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Max Balance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Max Balance"] || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Avg EOD Balance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Average EOD Balance"] || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Median EOD Balance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Median EOD Balance"] || 0)}
                  </p>
                </div>

                {/* Transaction Metrics */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Credits</p>
                  <p className="text-lg font-semibold text-green-700">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Total Amount of Credit Transactions"] || 0)}
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({statementSummary["Total No. of Credit Transactions"] || 0} txns)
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Debits</p>
                  <p className="text-lg font-semibold text-red-700">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Total Amount of Debit Transactions"] || 0)}
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({statementSummary["Total No. of Debit Transactions"] || 0} txns)
                    </span>
                  </p>
                </div>

                {/* Cash Metrics */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Withdrawals</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Total Amount of Cash Withdrawals"] || 0)}
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({statementSummary["Total No. of Cash Withdrawals"] || 0})
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Deposits</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Total Amount of Cash Deposits"] || 0)}
                  </p>
                </div>

                {/* Loan & Bounce Metrics */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Loan/EMI Payments</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(statementSummary["Total Amount of EMI / loan Payments"] || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Bounce Count</p>
                  <p className="text-lg font-semibold text-red-600">
                    {parseInt(statementSummary["Total No. of I/W Bounced"] || 0) + parseInt(statementSummary["Total Number of Outward Cheque Bounces"] || 0)}
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      (Cheque: {statementSummary["Total No. of I/W Chq Bounced"] || 0})
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {banks && banks.map((bank: any, bankIndex: number) => (

          <div key={bankIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center">
                  <Building className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{bank.bank}</h3>
                  <p className="text-sm text-gray-500">Source: {bank.source_bank_id || 'N/A'}</p>
                </div>
              </div>
              {bank.multiple_accounts_found === 'yes' && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                  Multiple Accounts
                </span>
              )}
            </div>

            <div className="p-6 space-y-8">
              {bank.accounts.map((account: any, accIndex: number) => (
                <div key={accIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Account Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-lg">
                            {account.account_type} Account
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${account.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {account.status || 'ACTIVE'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 font-mono">
                          {account.account_number} • {account.ifsc_code}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR'
                          }).format(parseFloat(account.current_balance || '0'))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account Details Grid */}
                  <div className="px-6 py-4 bg-white border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Customer Name</p>
                        <p className="text-sm font-medium text-gray-900">{account.customer_info?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Opening Date</p>
                        <p className="text-sm font-medium text-gray-900">{account.opening_date || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Branch</p>
                        <p className="text-sm font-medium text-gray-900">{account.location || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Nominee</p>
                        <p className="text-sm font-medium text-gray-900">{account.nominee || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Transactions Preview */}
                  {account.transactions && account.transactions.length > 0 && (
                    <div className="bg-white">
                      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                        <h5 className="text-sm font-semibold text-gray-900">Recent Transactions</h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                            <tr>
                              <th className="px-6 py-3">Date</th>
                              <th className="px-6 py-3">Description</th>
                              <th className="px-6 py-3">Ref No</th>
                              <th className="px-6 py-3 text-right">Amount</th>
                              <th className="px-6 py-3 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {account.transactions.slice(0, 5).map((txn: any, tIndex: number) => (
                              <tr key={tIndex} className="hover:bg-gray-50">
                                <td className="px-6 py-3 whitespace-nowrap">
                                  {txn.date ? formatDate(txn.date) : '-'}
                                </td>
                                <td className="px-6 py-3">
                                  <div className="max-w-xs truncate" title={txn.narration}>
                                    {txn.narration || txn.description}
                                  </div>
                                </td>
                                <td className="px-6 py-3 font-mono text-xs">
                                  {txn.cheque_num || txn.txn_id || '-'}
                                </td>
                                <td className={`px-6 py-3 text-right font-medium ${txn.type === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                  {txn.type === 'DEBIT' ? '-' : '+'}{new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR'
                                  }).format(parseFloat(txn.amount || '0'))}
                                </td>
                                <td className="px-6 py-3 text-right text-gray-600">
                                  {new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR'
                                  }).format(parseFloat(txn.balance || '0'))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {account.transactions.length > 5 && (
                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
                          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            View All {account.transactions.length} Transactions
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Fetch loan calculation from backend (backend-only approach)
  const fetchLoanDocuments = async (loanId: number) => {
    setDocumentsLoading(prev => ({ ...prev, [loanId]: true }));
    try {
      console.log(`🔍 Fetching documents for loan ${loanId}...`);
      const response = await adminApiService.getLoanDocuments(loanId);
      console.log(`📄 Admin documents response for loan ${loanId}:`, response);
      if ((response.success || response.status === 'success') && response.data?.documents) {
        console.log(`✅ Found ${response.data.documents.length} documents for loan ${loanId}`);
        response.data.documents.forEach((doc: any) => {
          console.log(`  - ${doc.document_name} (${doc.document_type})`);
        });
        setLoanDocuments(prev => ({ ...prev, [loanId]: response.data!.documents }));
      } else {
        console.log(`⚠️ No documents found for loan ${loanId} or invalid response`);
        setLoanDocuments(prev => ({ ...prev, [loanId]: [] }));
      }
    } catch (error: any) {
      console.error(`❌ Error fetching loan documents for loan ${loanId}:`, error);
      console.error('Error details:', error.response?.data || error.message);
      setLoanDocuments(prev => ({ ...prev, [loanId]: [] }));
    } finally {
      setDocumentsLoading(prev => ({ ...prev, [loanId]: false }));
    }
  };

  const fetchLoanCalculation = async (loanId: number) => {
    if (loanCalculations[loanId] || calculationsLoading[loanId]) {
      return; // Already fetched or loading
    }

    setCalculationsLoading(prev => ({ ...prev, [loanId]: true }));

    try {
      const response = await adminApiService.getLoanCalculation(loanId);
      console.log(`📊 [Fetch Loan Calculation] Response for loan #${loanId}:`, response);
      if ((response.success || response.status === 'success') && response.data) {
        setLoanCalculations(prev => ({ ...prev, [loanId]: response.data }));
        console.log(`✅ [Fetch Loan Calculation] Stored calculation for loan #${loanId}, disbursal amount: ₹${response.data?.disbursal?.amount || 'N/A'}`);
      } else {
        console.warn(`⚠️ [Fetch Loan Calculation] Invalid response for loan #${loanId}:`, response);
      }
    } catch (error) {
      console.error(`❌ Error fetching calculation for loan ${loanId}:`, error);
    } finally {
      setCalculationsLoading(prev => ({ ...prev, [loanId]: false }));
    }
  };

  // Fetch plan details for modal
  const fetchPlanDetails = async (planId: number) => {
    try {
      const [planResponse, feesResponse] = await Promise.all([
        adminApiService.getLoanPlan(planId),
        adminApiService.getLoanPlanFees(planId)
      ]);

      if (planResponse.success && planResponse.data) {
        const planData = planResponse.data;

        // Add fees to plan data
        if (feesResponse.success && feesResponse.data) {
          planData.fees = feesResponse.data.map((fee: any) => ({
            fee_name: fee.fee_name,
            fee_percent: fee.fee_percent,
            application_method: fee.application_method
          }));
        } else {
          planData.fees = [];
        }

        setSelectedPlanDetails(planData);
        setShowPlanDetailsModal(true);
      }
    } catch (error) {
      console.error('Error fetching plan details:', error);
      alert('Failed to load plan details');
    }
  };

  // Applied Loans Tab - Show all loans regardless of status
  const renderAppliedLoansTab = () => {
    const appliedLoans = getArray('loans'); // Show all loans, no status filter

    const handleEdit = (loan: any) => {
      // Prevent editing if loan has been processed (account_manager or cleared status)
      if (['account_manager', 'cleared'].includes(loan.status)) {
        alert('Cannot edit loan details - this loan has been processed and is frozen per the Loan Calculation Rulebook.');
        return;
      }
      
      setEditingLoan(loan.id);
      setEditValues({
        principalAmount: loan.principalAmount || loan.amount || 0,
        pfPercent: loan.processingFeePercent || 14,
        intPercent: loan.interestRate || 0.10,
      });
    };

    const handleSave = async (loanId: number) => {
      try {
        // Update loan amount if principal amount was changed
        if (editValues.principalAmount !== undefined) {
          const loan = appliedLoans.find((l: any) => (l.id || l.loanId) === loanId);
          const currentAmount = loan?.principalAmount || loan?.amount || 0;
          if (parseFloat(editValues.principalAmount) !== currentAmount) {
            // Update loan amount via API
            const amountResponse: any = await adminApiService.updateLoanAmount(loanId.toString(), {
              loan_amount: parseFloat(editValues.principalAmount),
              principalAmount: parseFloat(editValues.principalAmount)
            });
            if (!amountResponse.success && amountResponse.status !== 'success') {
              alert('Failed to update loan amount: ' + (amountResponse.message || 'Unknown error'));
              return;
            }
          }
        }

        // Call API to save the edited values (processing fee and interest)
        const response: any = await adminApiService.updateLoanCalculation(loanId, {
          processing_fee_percent: editValues.pfPercent ? parseFloat(editValues.pfPercent) : undefined,
          interest_percent_per_day: editValues.intPercent ? parseFloat(editValues.intPercent) : undefined
        });

        if (response.success || response.status === 'success') {
          console.log('Loan updated successfully:', response);
          // Refresh the user data to show updated values
          const profileResponse = await adminApiService.getUserProfile(params.userId!);
          if (profileResponse.status === 'success') {
            setUserData(profileResponse.data);
            // Clear loan calculations cache to force recalculation
            setLoanCalculations(prev => {
              const updated = { ...prev };
              delete updated[loanId];
              return updated;
            });
          }
          setEditingLoan(null);
          alert('Loan updated successfully!');
        } else {
          console.error('Failed to update loan:', response.message);
          alert('Failed to update loan: ' + response.message);
        }
      } catch (error: any) {
        console.error('Error saving loan:', error);
        alert('Error saving loan: ' + (error.message || 'Unknown error'));
      }
    };

    return (
      <div className="space-y-6">
        {/* Applied Loans Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Applied Loans</h3>
            <p className="text-sm text-gray-600 mt-1">All loan applications for this user</p>
          </div>

          {appliedLoans.length > 0 ? (
            <>
              {/* Loans Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apply Date & Time</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal Amount</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Plan</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disb Amount</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disbursal Fee</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disbursal Fee GST</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayable Fee</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayable Fee GST</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {appliedLoans.map((loan: any, index: number) => {
                      const loanId = loan.id || loan.loanId;
                      const calculation = loanCalculations[loanId];
                      const isLoading = calculationsLoading[loanId];

                      // Get plan code and plan ID from multiple sources
                      let planCode = 'N/A';
                      let planId = null;
                      
                      // Priority 1: Use plan_code from API response (from JOIN with loan_plans table)
                      if (loan.plan_code) {
                        planCode = loan.plan_code;
                        planId = loan.loan_plan_id || null;
                      }
                      // Priority 2: Check loan_plan_id directly
                      else if (loan.loan_plan_id) {
                        planId = loan.loan_plan_id;
                        // Try to get plan code from plan_snapshot
                        if (loan.plan_snapshot) {
                          try {
                            const planData = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
                            planCode = planData.plan_code || `Plan #${planId}`;
                            planId = planData.plan_id || planId;
                          } catch (e) {
                            planCode = `Plan #${planId}`;
                          }
                        } else {
                          // No plan_snapshot but has loan_plan_id
                          planCode = `Plan #${planId}`;
                        }
                      }
                      // Priority 3: Fallback to plan_snapshot if loan_plan_id not set
                      else if (loan.plan_snapshot) {
                        try {
                          const planData = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
                          planCode = planData.plan_code || 'N/A';
                          planId = planData.plan_id || planData.id || null;
                        } catch (e) {
                          // Ignore parse errors
                        }
                      }

                      // Use shortLoanId from backend, or generate fallback
                      const shortLoanId = loan.shortLoanId || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);

                      // Fetch calculation if not loaded yet
                      if (loanId && !calculation && !isLoading) {
                        fetchLoanCalculation(loanId);
                      }

                      return (
                        <Fragment key={loanId}>
                          <tr className="hover:bg-gray-50">
                            {/* Loan ID */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {shortLoanId}
                            </td>

                            {/* Apply Date & Time */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {loan.created_at ? (
                                <div>
                                  <div className="font-medium">
                                    {new Date(loan.created_at).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(loan.created_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </td>

                            {/* Principal Amount - Editable */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {editingLoan === loanId ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={editValues.principalAmount || loan.principalAmount || loan.amount || 0}
                                    onChange={(e) => setEditValues({ ...editValues, principalAmount: e.target.value })}
                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="Amount"
                                  />
                                  <button
                                    onClick={() => handleSave(loanId)}
                                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    title="Save changes"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingLoan(null)}
                                    className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{calculation ? formatCurrency(calculation.principal) : isLoading ? '...' : formatCurrency(loan.principalAmount || loan.amount || 0)}</span>
                                  {canEditUsers && !['account_manager', 'cleared'].includes(loan.status) && (
                                    <button
                                      onClick={() => handleEdit(loan)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Edit principal amount"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canEditUsers && ['account_manager', 'cleared'].includes(loan.status) && (
                                    <span className="text-xs text-gray-400 ml-2" title="Cannot edit - loan has been processed">🔒</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Loan Plan - Clickable/Editable */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {planId ? (
                                <button
                                  onClick={() => fetchPlanDetails(planId)}
                                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  title="Click to view plan details"
                                >
                                  {planCode}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">{planCode}</span>
                                  {!['account_manager', 'cleared'].includes(loan.status) && (
                                    <button
                                      onClick={() => {
                                        setEditingLoanPlanId(loanId);
                                        setSelectedLoanPlanId(null);
                                        setShowLoanPlanModal(true);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                      title="Assign loan plan"
                                    >
                                      Assign Plan
                                    </button>
                                  )}
                                </div>
                              )}
                              {planId && !['account_manager', 'cleared'].includes(loan.status) && (
                                <button
                                  onClick={() => {
                                    setEditingLoanPlanId(loanId);
                                    setSelectedLoanPlanId(planId);
                                    setShowLoanPlanModal(true);
                                  }}
                                  className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                                  title="Change plan"
                                >
                                  Change
                                </button>
                              )}
                              {planId && ['account_manager', 'cleared'].includes(loan.status) && (
                                <span className="ml-2 text-xs text-gray-400" title="Cannot change plan - loan has been processed">🔒</span>
                              )}
                            </td>

                            {/* Disbursal Amount */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.disbursal.amount.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Disbursal Fee */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.totals.disbursalFee.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Disbursal Fee GST */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.totals.disbursalFeeGST.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Repayable Fee */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.totals.repayableFee.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Repayable Fee GST */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.totals.repayableFeeGST.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Interest */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {calculation ? calculation.interest.amount.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Total Amount */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {calculation ? calculation.total.repayable.toFixed(2) : isLoading ? '...' : 'N/A'}
                            </td>

                            {/* Status */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${loan.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                loan.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                                  loan.status === 'follow_up' ? 'bg-purple-100 text-purple-800' :
                                    loan.status === 'disbursal' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                }`}>
                                {loan.status || 'N/A'}
                              </span>
                            </td>

                            {/* Status Date */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(loan.statusDate || loan.updatedAt || loan.createdAt)}
                            </td>

                            {/* Action Buttons */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex flex-col gap-1">
                                <button
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                  onClick={() => window.open(`/admin/loan-agreement/${loanId}`, '_blank')}
                                  title="View Loan Agreement"
                                >
                                  Agreement
                                </button>
                                <button
                                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  onClick={() => window.open(`/admin/kfs/${loanId}`, '_blank')}
                                  title="View Key Facts Statement"
                                >
                                  View KFS
                                </button>
                                {loan.status === 'cleared' && (
                                  <button
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                    onClick={() => window.open(`/admin/noc/${loanId}`, '_blank')}
                                    title="View No Dues Certificate"
                                  >
                                    View NOC
                                  </button>
                                )}
                                <button
                                  className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                                  onClick={() => {
                                    const isExpanded = expandedLoanDocuments[loanId];
                                    setExpandedLoanDocuments(prev => ({
                                      ...prev,
                                      [loanId]: !isExpanded
                                    }));
                                    if (!isExpanded && !loanDocuments[loanId]) {
                                      fetchLoanDocuments(loanId);
                                    }
                                  }}
                                  title="View Uploaded Documents"
                                >
                                  {expandedLoanDocuments[loanId] ? 'Hide Docs' : 'View Docs'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedLoanDocuments[loanId] && (
                            <tr>
                              <td colSpan={13} className="px-3 py-4 bg-gray-50">
                                {documentsLoading[loanId] ? (
                                  <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="text-sm text-gray-600 mt-2">Loading documents...</p>
                                  </div>
                                ) : loanDocuments[loanId] && loanDocuments[loanId].length > 0 ? (
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-gray-900 mb-3">Uploaded Documents</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {loanDocuments[loanId].map((doc: any, idx: number) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <FileText className="w-4 h-4 text-gray-600" />
                                              <span className="text-sm font-medium text-gray-900">{doc.document_name}</span>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${doc.upload_status === 'verified' ? 'bg-green-100 text-green-800' :
                                              doc.upload_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                              }`}>
                                              {doc.upload_status}
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-600 mb-2">
                                            <p>File: {doc.file_name}</p>
                                            <p>Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                                            <p>Uploaded: {formatDate(doc.uploaded_at)}</p>
                                          </div>
                                          <button
                                            onClick={async () => {
                                              try {
                                                const urlResponse = await adminApiService.getLoanDocumentUrl(doc.id);
                                                if ((urlResponse.success || urlResponse.status === 'success') && urlResponse.data?.url) {
                                                  window.open(urlResponse.data.url, '_blank');
                                                }
                                              } catch (error) {
                                                alert('Failed to get document URL');
                                              }
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                                          >
                                            View Document
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">No documents uploaded yet</p>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Quick Follow-up Section */}
              {appliedLoans.some((loan: any) => loan.status === 'follow_up') && (
                <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Follow-up</h3>
                  <div className="space-y-3">
                    {appliedLoans
                      .filter((loan: any) => loan.status === 'follow_up')
                      .map((loan: any) => {
                        const loanId = loan.id || loan.loanId;
                        const shortLoanId = loan.loanId ? `CLL${loan.loanId.slice(-8)}` : `CLL${loan.id || 'N/A'}`;

                        return (
                          <div key={loanId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">Loan ID: {shortLoanId}</p>
                              <p className="text-sm text-gray-600">Status: Follow Up - Ready for processing</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value === 'process') {
                                    handleQuickProcess(loanId);
                                    e.target.value = ''; // Reset dropdown
                                  }
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Action</option>
                                <option value="process">Process</option>
                              </select>
                              <button
                                onClick={() => handleQuickProcess(loanId)}
                                className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 font-medium"
                                title="This will process the application to Disbursal status"
                              >
                                Process
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    <strong>Process:</strong> This will process the application to Disbursal status
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applied Loans</h3>
              <p className="text-gray-600">This user doesn't have any loan applications in progress.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to parse date string to YYYY-MM-DD format (no timezone conversion)
  const parseDateString = (dateStr: string | Date): string => {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
      // If it's already a Date object, format it as YYYY-MM-DD
      const year = dateStr.getFullYear();
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Extract date part from datetime string
    const str = String(dateStr);
    if (str.includes(' ')) {
      return str.split(' ')[0];
    }
    if (str.includes('T')) {
      return str.split('T')[0];
    }
    return str;
  };

  // Helper function to calculate days difference between two dates (no timezone conversion)
  const daysDifference = (date1: string, date2: string): number => {
    const d1 = parseDateString(date1);
    const d2 = parseDateString(date2);
    if (!d1 || !d2) return 0;
    
    const [y1, m1, day1] = d1.split('-').map(Number);
    const [y2, m2, day2] = d2.split('-').map(Number);
    
    // Simple date difference calculation
    const date1Obj = new Date(y1, m1 - 1, day1);
    const date2Obj = new Date(y2, m2 - 1, day2);
    const diff = Math.floor((date2Obj.getTime() - date1Obj.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };


  // Helper function to calculate DPD (Days Past Due) - no timezone conversion
  const calculateDPD = (disbursedDate: string, dueDate: string | null, currentDate?: string) => {
    if (!dueDate) return 0;
    const current = currentDate || getCurrentDateString();
    const diff = daysDifference(dueDate, current);
    return diff > 0 ? diff : 0;
  };

  // Helper function to calculate penalty charges
  const calculatePenalty = (principal: number, dpd: number) => {
    if (dpd <= 0) return { penalty: 0, gst: 0, total: 0 };
    
    let penaltyPercent = 0;
    if (dpd === 1) {
      penaltyPercent = 5; // 5% on first day
    } else if (dpd >= 2 && dpd <= 10) {
      penaltyPercent = 1 * (dpd - 1); // 1% per day from day 2-10
    } else if (dpd >= 11 && dpd <= 120) {
      penaltyPercent = 9 + (0.6 * (dpd - 10)); // 9% (days 2-10) + 0.6% per day from day 11-120
    }
    // Above 120 days, penalty is 0
    
    const penalty = (principal * penaltyPercent) / 100;
    const gst = (penalty * 18) / 100;
    return { penalty, gst, total: penalty + gst };
  };

  // Helper function to calculate interest till current date - no timezone conversion
  // Uses inclusive counting: both start date and end date count as days
  const calculateInterestTillDate = (principal: number, ratePerDay: number, disbursedDate: string, currentDate?: string) => {
    if (!disbursedDate) return 0;
    const current = currentDate || getCurrentDateString();
    // Add +1 for inclusive counting (both start and end dates count)
    const days = Math.max(1, daysDifference(disbursedDate, current) + 1);
    return principal * ratePerDay * days;
  };

  // Loans Tab (Account Manager)
  const renderLoansTab = () => {
    const runningLoans = getArray('loans').filter((loan: any) =>
      ['account_manager', 'cleared'].includes(loan.status)
    );

    return (
      <div className="space-y-6">
        {/* Loan Application Review Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Loans (Account Manager)</h3>
            <p className="text-sm text-gray-600 mt-1">Loans assigned to account manager</p>
          </div>


          {runningLoans.length > 0 ? (
            <>
              {/* Loans Table */}
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Loan ID</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Processed Date
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Date when the loan was processed/disbursed</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan extension Availed date</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal Amount</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Processed Amount
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Amount actually disbursed to the borrower (after deducting fees)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Exhausted Period
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Number of days since loan disbursement</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Extension period till</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            P.fee
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Processing fee charged on the loan</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            post service fee
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Post service fee added to the total repayable amount</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            gst
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>gst on p.fee & post service fee</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Interest
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Total Interest for full tenure</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Penalty
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Penalty Charge + gst on penalty</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due date</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Total Amount
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>principal + post service fee + gst on post service fee + interest balance till current date + penalty if any + gst on penalty</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMI Details</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Pre close
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Pre close (changes wrt date)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Log</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan closed amount</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan closed date</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            Loan extension
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Loan extension fee + interest till date (from Dpd -5 to DPD 15) + penalty if applicable</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan extended amount</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan extended date</th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            DPD
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs z-50">
                                <p>Days Past Due - Number of days the loan payment is overdue</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto pay</th>
                      </tr>
                    </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {runningLoans.map((loan: any, index: number) => {
                      const loanId = loan.id || loan.loanId;
                      const calculation = loanCalculations[loanId];
                      const isLoading = calculationsLoading[loanId];

                      // Use shortLoanId from backend, or generate fallback
                      const shortLoanId = loan.shortLoanId || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);

                      // Fetch calculation if not loaded yet
                      if (loanId && !calculation && !isLoading) {
                        fetchLoanCalculation(loanId);
                      }

                      // Calculate derived values
                      // Processed Date: ONLY use processed_at (when loan was actually processed/disbursed)
                      // Do NOT fallback to other dates - if not processed, show N/A
                      const processedDate = (loan.processed_at && loan.processed_at !== 'null' && loan.processed_at !== 'undefined' && loan.processed_at !== '')
                        ? loan.processed_at
                        : (loan.processedDate && loan.processedDate !== 'null' && loan.processedDate !== 'undefined' && loan.processedDate !== '')
                        ? loan.processedDate
                        : null;
                      // Explicitly check for null/undefined/empty string to avoid showing incorrect dates
                      const hasProcessedDate = processedDate !== null && processedDate !== undefined && processedDate !== '' && processedDate !== 'null' && processedDate !== 'undefined';
                      
                      const principal = calculation?.principal || loan.principalAmount || loan.amount || loan.loan_amount || 0;
                      
                      // Use processed values if available (frozen at processing time), otherwise calculate
                      const processedAmount = loan.processed_amount || calculation?.disbursal?.amount || loan.disbursal_amount || loan.disbursalAmount || principal;
                      const disbursedDate = loan.disbursedDate || loan.disbursed_at;
                      
                      // Use processed values if available (frozen at processing time), otherwise calculate
                      const isProcessed = loan.processed_at || loan.processedDate;
                      
                      // Exhausted period - calculate from processed_at or disbursed_at
                      // Per rulebook: Use inclusive counting (day 1 = processing day)
                      let exhaustedPeriod = 'N/A';
                      if (isProcessed && (loan.exhausted_period_days === null || loan.exhausted_period_days === undefined || loan.exhausted_period_days === 0)) {
                        // If processed but no exhausted_period_days value (or it's 0), calculate from processed_at
                        const processedDateForCalc = loan.processed_at || loan.processedDate;
                        if (processedDateForCalc) {
                          const days = Math.max(1, daysDifference(processedDateForCalc, getCurrentDateString()) + 1); // +1 for inclusive counting
                          exhaustedPeriod = `${days} days`;
                        }
                      } else if (isProcessed && loan.exhausted_period_days > 0) {
                        // Use stored value if it's greater than 0 (from new loans)
                        exhaustedPeriod = `${loan.exhausted_period_days} days`;
                      } else if (disbursedDate) {
                        const days = Math.max(1, daysDifference(disbursedDate, getCurrentDateString()) + 1); // +1 for inclusive counting
                        exhaustedPeriod = `${days} days`;
                      }

                      // Due date - use processed value if available, otherwise calculate
                      let dueDate = null;
                      if (isProcessed && loan.processed_due_date) {
                        dueDate = loan.processed_due_date;
                      } else if (calculation?.interest?.repayment_date) {
                        dueDate = parseDateString(calculation.interest.repayment_date);
                      } else if (disbursedDate && calculation?.interest?.days) {
                        // Add days to disbursed date without timezone conversion
                        const disbursedDateStr = parseDateString(disbursedDate);
                        const [year, month, day] = disbursedDateStr.split('-').map(Number);
                        const startDate = new Date(year, month - 1, day);
                        // Add days - 1 because start date counts as day 1
                        const dueDateObj = new Date(startDate.getTime() + ((calculation.interest.days - 1) * 24 * 60 * 60 * 1000));
                        dueDate = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;
                      }

                      // Calculate DPD (no timezone conversion)
                      const dpd = dueDate ? calculateDPD(disbursedDate || '', dueDate) : 0;

                      // Penalty - use processed value if available, otherwise calculate
                      let penaltyData = { penalty: 0, gst: 0, total: 0 };
                      if (isProcessed && loan.processed_penalty !== null && loan.processed_penalty !== undefined) {
                        penaltyData.total = parseFloat(loan.processed_penalty) || 0; // Ensure it's a number
                      } else {
                        penaltyData = calculatePenalty(principal, dpd);
                      }

                      // Calculate interest for full tenure (till due date, not till today)
                      // For multi-EMI loans, prioritize backend-calculated total_interest to avoid timezone issues
                      let interestTillDate = 0;
                      if (calculation?.interest?.total_interest !== undefined && calculation?.interest?.total_interest !== null) {
                        // Use backend-calculated total_interest (avoids timezone issues in schedule calculation)
                        interestTillDate = calculation.interest.total_interest;
                      } else if (calculation?.repayment?.schedule && Array.isArray(calculation.repayment.schedule) && calculation.repayment.schedule.length > 1) {
                        // Multi-EMI loan: Sum interest from all EMI periods in the schedule
                        interestTillDate = calculation.repayment.schedule.reduce((sum: number, emi: any) => sum + (emi.interest || 0), 0);
                      } else {
                        // Single payment loan: Use the full tenure interest from calculation
                        interestTillDate = calculation?.interest?.amount || 0;
                      }
                      
                      // Calculate interest till TODAY (for Pre-close calculation)
                      // Use API-provided value if available (backend calculates with proper inclusive counting)
                      // Otherwise fall back to frontend calculation
                      let interestTillToday = 0;
                      if (calculation?.interest?.interestTillToday !== undefined && calculation.interest.interestTillToday !== null) {
                        // Use backend-calculated value (ensures consistency and proper inclusive counting)
                        interestTillToday = calculation.interest.interestTillToday;
                      } else {
                        // Fallback: Calculate on frontend (for backward compatibility)
                        const baseDateForInterest = isProcessed && loan.processed_at 
                          ? parseDateString(loan.processed_at) // Normalize date format (handles timezone issues)
                          : (disbursedDate ? parseDateString(disbursedDate) : null);
                        if (baseDateForInterest && calculation?.interest?.rate_per_day) {
                          interestTillToday = calculateInterestTillDate(principal, calculation.interest.rate_per_day, baseDateForInterest, getCurrentDateString());
                        }
                      }

                      // Processing fee - use processed value if available, otherwise calculate
                      const processingFee = isProcessed && loan.processed_p_fee !== null 
                        ? loan.processed_p_fee 
                        : (calculation?.totals?.disbursalFee || loan.processingFee || 0);
                      const processingFeeGST = calculation?.totals?.disbursalFeeGST || 0;

                      // Post service fee - use processed value if available, otherwise calculate
                      const postServiceFee = isProcessed && loan.processed_post_service_fee !== null
                        ? loan.processed_post_service_fee
                        : (calculation?.totals?.repayableFee || 0);
                      const postServiceFeeGST = calculation?.totals?.repayableFeeGST || 0;
                      
                      // Total GST - use processed value if available, otherwise calculate
                      const totalGSTOnFees = isProcessed && loan.processed_gst !== null
                        ? loan.processed_gst
                        : (processingFeeGST + postServiceFeeGST);

                      // Total interest for full tenure - use processed value if available, otherwise calculate
                      // For multi-EMI, prioritize backend-calculated total_interest to avoid timezone issues
                      let totalInterestFullTenure;
                      if (isProcessed && loan.processed_interest !== null) {
                        totalInterestFullTenure = loan.processed_interest;
                      } else if (calculation?.interest?.total_interest !== undefined && calculation?.interest?.total_interest !== null) {
                        // Use backend-calculated total_interest (avoids timezone issues in schedule calculation)
                        totalInterestFullTenure = calculation.interest.total_interest;
                      } else if (calculation?.repayment?.schedule && Array.isArray(calculation.repayment.schedule) && calculation.repayment.schedule.length > 1) {
                        // Multi-EMI loan: Sum interest from all EMI periods in the schedule
                        totalInterestFullTenure = calculation.repayment.schedule.reduce((sum: number, emi: any) => sum + (emi.interest || 0), 0);
                      } else {
                        totalInterestFullTenure = calculation?.interest?.amount || loan.interest || 0;
                      }

                      // Calculate total amount: principal + post service fee + gst on post service fee + interest balance till current date + penalty if any + gst on penalty
                      const totalAmount = principal + postServiceFee + postServiceFeeGST + interestTillDate + penaltyData.total;

                      // Loan extension fields (placeholder - these would come from database)
                      const loanExtensionAvailedDate = loan.extension_availed_date || 'N/A';
                      const loanExtensionPeriodTill = loan.extension_period_till || 'N/A';
                      const loanExtensionFee = parseFloat(loan.extension_fee) || 0;
                      const loanExtendedAmount = loan.extended_amount || 'N/A';
                      const loanExtendedDate = loan.extended_date || 'N/A';
                      
                      // Loan extension amount: Only show if extension is actually availed
                      const hasExtension = loanExtensionAvailedDate !== 'N/A' && loanExtensionAvailedDate !== null;
                      const loanExtensionAmount = hasExtension 
                        ? loanExtensionFee + interestTillDate + penaltyData.total
                        : null;

                      // Loan closed fields
                      const loanClosedAmount = loan.status === 'cleared' ? (loan.closed_amount || totalAmount) : 'N/A';
                      const loanClosedDate = loan.status === 'cleared' ? (loan.closed_date || loan.updatedAt) : 'N/A';

                      // EMI Schedule - get ONLY from loan.emi_schedule (raw data, no calculations)
                      let emiSchedule: any[] = [];
                      
                      if (loan.emi_schedule) {
                        // Parse emi_schedule from loan data (stored as JSON string in database)
                        try {
                          const parsedSchedule = typeof loan.emi_schedule === 'string' 
                            ? JSON.parse(loan.emi_schedule) 
                            : loan.emi_schedule;
                          
                          // Use raw emi_schedule data exactly as stored
                          // Structure: emi_number, due_date, emi_amount, status
                          emiSchedule = Array.isArray(parsedSchedule) ? parsedSchedule.map((emi: any) => ({
                            emi_number: emi.emi_number || emi.instalment_no,
                            due_date: emi.due_date || emi.date,
                            emi_amount: emi.emi_amount || 0,
                            status: emi.status || 'pending'
                          })) : [];
                        } catch (e) {
                          console.error('Error parsing loan.emi_schedule:', e);
                        }
                      }

                      // Helper function to open EMI details modal
                      const handleViewEmiDetails = async () => {
                        try {
                          // Fetch calculated schedule from loan calculations API (includes penalty)
                          const calcResponse = await adminApiService.getLoanCalculation(loan.id);
                          if (calcResponse.success && calcResponse.data?.repayment?.schedule) {
                            // Use calculated schedule with penalty
                            setSelectedLoanEmiSchedule(calcResponse.data.repayment.schedule);
                          } else {
                            // Fallback to stored emi_schedule if calculation fails
                            setSelectedLoanEmiSchedule(emiSchedule);
                          }
                        } catch (error) {
                          console.error('Error fetching calculated EMI schedule:', error);
                          // Fallback to stored emi_schedule
                          setSelectedLoanEmiSchedule(emiSchedule);
                        }
                        setSelectedLoanIdForEmi(shortLoanId);
                        setShowEmiDetailsModal(true);
                      };

                      // Pre-close amount: principal + 10% pre-close fee + GST + interest till TODAY
                      // Use same calculation as RepaymentSchedulePage for consistency
                      const preCloseFeePercent = 10;
                      // Round to 2 decimals: Math.round(value * 100) / 100
                      const preCloseFee = Math.round((principal * preCloseFeePercent) / 100 * 100) / 100;
                      const preCloseFeeGST = Math.round(preCloseFee * 0.18 * 100) / 100;
                      // Round interestTillToday to 2 decimals before summing
                      const interestTillTodayRounded = Math.round(interestTillToday * 100) / 100;
                      // Round each component before summing to avoid floating point errors
                      const preCloseAmount = Math.round((principal + interestTillTodayRounded + preCloseFee + preCloseFeeGST) * 100) / 100;

                      // Status log
                      const statusLog = `${loan.status} - ${formatDate(loan.statusDate || loan.updatedAt)}`;

                      // Auto pay
                      const autoPay = loan.auto_pay_enabled ? 'Yes' : 'No';

                      return (
                        <tr key={index} className="hover:bg-gray-50 border-l-4 border-l-green-500">
                          <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                            {shortLoanId}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {hasProcessedDate ? formatDate(processedDate) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanExtensionAvailedDate !== 'N/A' ? formatDate(loanExtensionAvailedDate) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(principal)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(processedAmount)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {exhaustedPeriod}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanExtensionPeriodTill !== 'N/A' ? formatDate(loanExtensionPeriodTill) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(processingFee)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(postServiceFee)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(totalGSTOnFees)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(totalInterestFullTenure)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(penaltyData.total)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dueDate ? formatDate(dueDate) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(totalAmount)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            <Button
                              onClick={handleViewEmiDetails}
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              disabled={emiSchedule.length === 0}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(preCloseAmount)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {statusLog}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanClosedAmount !== 'N/A' ? formatCurrency(loanClosedAmount) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanClosedDate !== 'N/A' ? formatDate(loanClosedDate) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanExtensionAmount !== null ? formatCurrency(loanExtensionAmount) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanExtendedAmount !== 'N/A' ? formatCurrency(loanExtendedAmount) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {loanExtendedDate !== 'N/A' ? formatDate(loanExtendedDate) : 'N/A'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dpd}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                            {autoPay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </TooltipProvider>
            </>
          ) : (
            <div className="text-center py-12">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Running Loans</h3>
              <p className="text-gray-600">This user doesn't have any loans with account manager.</p>
            </div>
          )}
        </div>
      </div>
    );
  };




  // Validation Tab Helper Functions
  const getDocumentSuggestions = () => {
    if (!documentInput) return documentOptions;
    return documentOptions.filter(option =>
      option.toLowerCase().includes(documentInput.toLowerCase()) &&
      !selectedDocuments.includes(option)
    );
  };

  const getReasonSuggestions = () => {
    if (!reasonInput) return reasonOptions;
    return reasonOptions.filter(option =>
      option.toLowerCase().includes(reasonInput.toLowerCase()) &&
      !selectedReasons.includes(option)
    );
  };

  // Handle adding documents
  const addDocument = (document) => {
    if (document && !selectedDocuments.includes(document)) {
      setSelectedDocuments([...selectedDocuments, document]);
      setDocumentInput('');
      setShowDocumentSuggestions(false);
    }
  };

  // Handle adding reasons
  const addReason = (reason) => {
    if (reason && !selectedReasons.includes(reason)) {
      setSelectedReasons([...selectedReasons, reason]);
      setReasonInput('');
      setShowReasonSuggestions(false);
    }
  };

  // Handle removing documents
  const removeDocument = (documentToRemove) => {
    setSelectedDocuments(selectedDocuments.filter(doc => doc !== documentToRemove));
  };

  // Handle removing reasons
  const removeReason = (reasonToRemove) => {
    setSelectedReasons(selectedReasons.filter(reason => reason !== reasonToRemove));
  };

  // Handle document input key press
  const handleDocumentKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDocument(documentInput);
    } else if (e.key === 'Escape') {
      setShowDocumentSuggestions(false);
    }
  };

  // Handle reason input key press
  const handleReasonKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addReason(reasonInput);
    } else if (e.key === 'Escape') {
      setShowReasonSuggestions(false);
    }
  };

  // Validation Tab
  const renderValidationTab = () => {
    // Check if user has any loan in account_manager status
    const loans = getArray('loans');
    const accountManagerLoans = loans ? loans.filter((loan: any) => loan.status === 'account_manager') : [];
    const hasAccountManagerLoan = accountManagerLoans.length > 0;
    
    // Blocked actions when account_manager loan exists
    const blockedActions = ['not_process', 're_process', 'delete', 'cancel', 'process'];

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Validation Status</h3>
          </div>

          {/* Warning message if account_manager loan exists */}
          {hasAccountManagerLoan && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ User has loan(s) in account_manager status. Certain actions (Not Process, Re-process, Delete, Cancel, Process) are disabled.
              </p>
            </div>
          )}

          {/* Quick Follow-up Form and History Layout */}
          <div className="flex gap-6">
            {/* Quick Follow-up Form - 1/3 width */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 w-1/3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Follow-up</h3>

              <div className="space-y-4">
                {/* Action Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Action</label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose an action...</option>
                    <option value="need_document">Need Document</option>
                    <option 
                      value="process" 
                      disabled={hasAccountManagerLoan}
                      style={{ color: hasAccountManagerLoan ? '#999' : 'inherit' }}
                    >
                      Process{hasAccountManagerLoan ? ' (Disabled - Account Manager Loan)' : ''}
                    </option>
                    <option 
                      value="not_process" 
                      disabled={hasAccountManagerLoan}
                      style={{ color: hasAccountManagerLoan ? '#999' : 'inherit' }}
                    >
                      Not Process{hasAccountManagerLoan ? ' (Disabled - Account Manager Loan)' : ''}
                    </option>
                    <option 
                      value="re_process" 
                      disabled={hasAccountManagerLoan}
                      style={{ color: hasAccountManagerLoan ? '#999' : 'inherit' }}
                    >
                      Re-process{hasAccountManagerLoan ? ' (Disabled - Account Manager Loan)' : ''}
                    </option>
                    <option value="unhold">Unhold</option>
                    <option 
                      value="delete" 
                      disabled={hasAccountManagerLoan}
                      style={{ color: hasAccountManagerLoan ? '#999' : 'inherit' }}
                    >
                      Delete{hasAccountManagerLoan ? ' (Disabled - Account Manager Loan)' : ''}
                    </option>
                    <option 
                      value="cancel" 
                      disabled={hasAccountManagerLoan}
                      style={{ color: hasAccountManagerLoan ? '#999' : 'inherit' }}
                    >
                      Cancel{hasAccountManagerLoan ? ' (Disabled - Account Manager Loan)' : ''}
                    </option>
                  </select>
                </div>

                {/* Need Document Section */}
                {selectedAction === 'need_document' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Required Documents</label>
                    <div className="relative">
                      <div className="border border-gray-300 rounded-md p-3 min-h-[100px] bg-gray-50">
                        {/* Selected Documents */}
                        {selectedDocuments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {selectedDocuments.map((document, index) => (
                              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                {document}
                                <button
                                  onClick={() => removeDocument(document)}
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Input Field */}
                        <input
                          type="text"
                          value={documentInput}
                          onChange={(e) => {
                            setDocumentInput(e.target.value);
                            setShowDocumentSuggestions(true);
                          }}
                          onKeyPress={handleDocumentKeyPress}
                          onFocus={() => setShowDocumentSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowDocumentSuggestions(false), 200)}
                          placeholder="Type to search or add new document..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      {/* Suggestions Dropdown */}
                      {showDocumentSuggestions && (getDocumentSuggestions().length > 0 || documentInput) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {getDocumentSuggestions().map((option, index) => (
                            <div
                              key={index}
                              onClick={() => addDocument(option)}
                              onMouseDown={(e) => e.preventDefault()}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                            >
                              {option}
                            </div>
                          ))}
                          {documentInput && !documentOptions.includes(documentInput) && (
                            <div
                              onClick={() => addDocument(documentInput)}
                              onMouseDown={(e) => e.preventDefault()}
                              className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm border-t border-gray-200 bg-green-50"
                            >
                              + Create "{documentInput}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Process Section */}
                {selectedAction === 'process' && (
                  <div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-800">
                          This will process the application to Disbursal status
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Not Process Section */}
                {selectedAction === 'not_process' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reasons</label>
                    <div className="relative">
                      <div className="border border-gray-300 rounded-md p-3 min-h-[100px] bg-gray-50">
                        {/* Selected Reasons */}
                        {selectedReasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {selectedReasons.map((reason, index) => (
                              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                {reason}
                                <button
                                  onClick={() => removeReason(reason)}
                                  className="ml-2 text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Input Field */}
                        <input
                          type="text"
                          value={reasonInput}
                          onChange={(e) => {
                            setReasonInput(e.target.value);
                            setShowReasonSuggestions(true);
                          }}
                          onKeyPress={handleReasonKeyPress}
                          onFocus={() => setShowReasonSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowReasonSuggestions(false), 200)}
                          placeholder="Type to search or add new reason..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        />
                      </div>

                      {/* Suggestions Dropdown */}
                      {showReasonSuggestions && (getReasonSuggestions().length > 0 || reasonInput) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {getReasonSuggestions().map((option, index) => (
                            <div
                              key={index}
                              onClick={() => addReason(option)}
                              onMouseDown={(e) => e.preventDefault()}
                              className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm"
                            >
                              {option}
                            </div>
                          ))}
                          {reasonInput && !reasonOptions.includes(reasonInput) && (
                            <div
                              onClick={() => addReason(reasonInput)}
                              onMouseDown={(e) => e.preventDefault()}
                              className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm border-t border-gray-200 bg-green-50"
                            >
                              + Create "{reasonInput}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Re-process Section */}
                {selectedAction === 're_process' && (
                  <div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                        <span className="text-sm font-medium text-yellow-800">
                          This will hold the profile for 45 days (cooling period). User will see: "Your profile is under cooling period (We will update you once you are eligible)"
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unhold Section */}
                {selectedAction === 'unhold' && (
                  <div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-800">
                          This will move the profile from hold status to normal active status
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Section */}
                {selectedAction === 'delete' && (
                  <div>
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                        <div>
                          <span className="text-sm font-medium text-red-800 block mb-2">
                            Warning: This will permanently delete all user data except:
                          </span>
                          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                            <li>Primary phone number</li>
                            <li>PAN number</li>
                            <li>Aadhar number</li>
                            <li>All loan data</li>
                          </ul>
                          <span className="text-sm font-medium text-red-800 block mt-2">
                            User will see: "Your profile is purged in our system. Thank you."
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancel Section */}
                {selectedAction === 'cancel' && (
                  <div>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="cancel-loan"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="cancel-loan" className="ml-2 text-sm text-gray-700">
                          Cancel the current applied loan
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hold user?</label>
                        <select
                          value={holdUser}
                          onChange={(e) => setHoldUser(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select option...</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>

                      {holdUser === 'yes' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Hold duration</label>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="forever"
                                name="hold-type"
                                value="forever"
                                checked={holdDuration === 'forever'}
                                onChange={(e) => setHoldDuration(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <label htmlFor="forever" className="ml-2 text-sm text-gray-700">Forever</label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="days"
                                name="hold-type"
                                value="days"
                                checked={holdDuration === 'days'}
                                onChange={(e) => setHoldDuration(e.target.value)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <label htmlFor="days" className="ml-2 text-sm text-gray-700">For</label>
                              <input
                                type="number"
                                value={holdDays}
                                onChange={(e) => setHoldDays(e.target.value)}
                                className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm w-20"
                                placeholder="days"
                              />
                              <span className="ml-1 text-sm text-gray-700">days</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={submitValidationAction}
                    disabled={!selectedAction}
                    className={`px-6 py-2 rounded-md transition-colors ${selectedAction
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    Submit Action
                  </button>
                </div>
              </div>
            </div>

            {/* Validation History Table - 2/3 width */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 w-2/3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation History</h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Updated By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Updated On
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validationHistoryLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          Loading validation history...
                        </td>
                      </tr>
                    ) : validationHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No validation history found
                        </td>
                      </tr>
                    ) : (
                      validationHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.type === 'Need Document' ? 'bg-blue-100 text-blue-800' :
                              item.type === 'Process' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.updatedBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.updatedOn}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => viewHistoryDetails(item)}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* History Details Modal */}
        {showHistoryModal && selectedHistoryItem && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedHistoryItem.type} Details
                  </h3>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Updated By:</strong> {selectedHistoryItem.updatedBy}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Updated On:</strong> {selectedHistoryItem.updatedOn}
                    </p>
                  </div>

                  {selectedHistoryItem.action === 'need_document' && selectedHistoryItem.details.documents && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Required Documents:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedHistoryItem.details.documents.map((doc, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedHistoryItem.action === 'not_process' && selectedHistoryItem.details.reasons && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Rejection Reasons:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedHistoryItem.details.reasons.map((reason, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedHistoryItem.action === 'process' && selectedHistoryItem.details.message && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Action Details:</h4>
                      <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-md">
                        {selectedHistoryItem.details.message}
                      </p>
                    </div>
                  )}

                  {selectedHistoryItem.action === 'cancel' && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Cancel Details:</h4>
                      <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                        <p><strong>Cancel Loan:</strong> {selectedHistoryItem.details.cancelLoan ? 'Yes' : 'No'}</p>
                        {selectedHistoryItem.details.holdUser && (
                          <>
                            <p><strong>Hold User:</strong> {selectedHistoryItem.details.holdUser}</p>
                            {selectedHistoryItem.details.holdDuration && (
                              <p><strong>Hold Duration:</strong> {selectedHistoryItem.details.holdDuration}</p>
                            )}
                            {selectedHistoryItem.details.holdDays && (
                              <p><strong>Hold Days:</strong> {selectedHistoryItem.details.holdDays}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Credit Analytics Tab
  const renderCreditAnalyticsTab = () => {
    if (creditAnalyticsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Loading credit analytics data...</p>
          </div>
        </div>
      );
    }

    if (!creditAnalyticsData) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Credit Analytics Data</h3>
          <p className="text-gray-600 mb-4">This user has not completed a credit check yet.</p>
          <button
            onClick={handlePerformCreditCheck}
            disabled={performingCreditCheck || !userData?.id}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {performingCreditCheck ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Performing Credit Check...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Perform Credit Check
              </>
            )}
          </button>
          {performingCreditCheck && (
            <p className="text-sm text-gray-500 mt-3">This may take a few moments...</p>
          )}
        </div>
      );
    }

    const { credit_score, is_eligible, rejection_reasons, full_report, pdf_url, checked_at, request_id, client_ref_num, result_code, api_message } = creditAnalyticsData;

    // Check if result_code is 102 (mobile number mismatch)
    // Check both from database field and from full_report
    const actualResultCode = result_code || full_report?.result_code;
    const actualMessage = api_message || full_report?.message;

    // If result_code is 102, show mobile number mismatch error
    if (actualResultCode === 102 && actualMessage) {
      // Extract masked mobile number from message (e.g., [83XXXXX247])
      const maskedMobileMatch = actualMessage.match(/\[([^\]]+)\]/);
      const maskedMobile = maskedMobileMatch ? maskedMobileMatch[1] : null;
      
      // Get user's actual mobile number
      const userMobile = userData?.mobile || userData?.phone || 'N/A';

      return (
        <div className="bg-white rounded-lg border border-red-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <h3 className="text-xl font-semibold text-red-900">Mobile Number Mismatch</h3>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
            <p className="text-base font-semibold text-red-900 mb-3">
              mobile number did not match
            </p>
            <p className="text-sm text-gray-800">
              mobile number {maskedMobile ? `[${maskedMobile}]` : '[N/A]'}, received number ({userMobile})
            </p>
          </div>

          {request_id && (
            <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
              <p><strong>Request ID:</strong> {request_id}</p>
              {client_ref_num && <p><strong>Client Ref:</strong> {client_ref_num}</p>}
              {checked_at && <p><strong>Report Date:</strong> {new Date(checked_at).toLocaleDateString('en-GB')}</p>}
            </div>
          )}
        </div>
      );
    }

    // Parse the full report to extract detailed information
    const reportData = full_report?.result?.result_json?.INProfileResponse || {};
    
    // Extract PDF URL - first check if it's stored directly in the database
    // Then check various possible locations in the Experian response
    let experianPdfUrl = pdf_url || null;
    
    if (!experianPdfUrl && full_report) {
      // Check multiple nested paths where PDF URL might be stored in the response
      // Priority: result_pdf field (for report_type "4")
      experianPdfUrl = 
        full_report?.result?.result_pdf || // Primary location for report_type "4"
        full_report?.result?.model?.pdf_url ||
        full_report?.result?.data?.pdf_url ||
        full_report?.result?.pdf_url ||
        full_report?.result?.model?.pdfUrl ||
        full_report?.result?.data?.pdfUrl ||
        full_report?.result?.pdfUrl ||
        full_report?.model?.pdf_url ||
        full_report?.data?.pdf_url ||
        full_report?.pdf_url ||
        full_report?.model?.pdfUrl ||
        full_report?.data?.pdfUrl ||
        full_report?.pdfUrl ||
        reportData?.pdf_url ||
        reportData?.pdfUrl ||
        null;
    }
    
    // Debug logging to help identify where PDF URL is located
    if (full_report && !experianPdfUrl) {
      console.log('🔍 PDF URL not found. Checking full_report structure:', {
        hasPdfUrlInDb: !!pdf_url,
        hasResult: !!full_report.result,
        hasModel: !!full_report.result?.model,
        hasData: !!full_report.result?.data,
        resultKeys: full_report.result ? Object.keys(full_report.result) : [],
        modelKeys: full_report.result?.model ? Object.keys(full_report.result.model) : [],
        dataKeys: full_report.result?.data ? Object.keys(full_report.result.data) : [],
        topLevelKeys: Object.keys(full_report)
      });
    } else if (experianPdfUrl) {
      console.log('✅ PDF URL found:', experianPdfUrl);
    }
    const accountSummary = reportData.CAIS_Account?.CAIS_Account_DETAILS || [];
    const enquirySummary = reportData.CAPS?.CAPS_Summary || {};
    const capsApplications = reportData.CAPS?.CAPS_Application_Details || [];
    const currentApplication = reportData.Current_Application || {};

    // Get credit score from report if not in database
    // Check multiple sources for credit score
    let displayScore = credit_score;
    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
      displayScore = reportData.SCORE?.BureauScore;
    }
    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
      displayScore = reportData?.BureauScore;
    }
    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
      displayScore = userData?.experianScore;
    }
    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
      displayScore = 'N/A';
    }

    // Extract PAN from report if not in userData
    const panNumber = userData?.panNumber || userData?.pan_number || userData?.pan || currentApplication.CreditReportInquiry?.InquiryPurpose || '-';


    return (
      <div className="space-y-6">
        {/* Current Application Information */}
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Current Application Information</h3>
          </div>
          <p className="text-sm text-orange-600 italic mb-4">These are the details you gave us when you apply for your Experian Credit Report.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Name</p>
              <p className="text-sm text-gray-900">{userData?.name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Mobile Phone</p>
              <p className="text-sm text-gray-900">{userData?.mobile || userData?.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">PAN</p>
              <p className="text-sm text-gray-900 uppercase">{panNumber}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Email</p>
              <p className="text-sm text-gray-900">{userData?.email && userData.email !== 'N/A' ? userData.email : '-'}</p>
            </div>
          </div>
        </div>

        {/* Experian Credit Score */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Experian Credit Score</h3>
            </div>
            {/* Experian PDF Download Button */}
            {experianPdfUrl ? (
              <button
                onClick={() => {
                  if (experianPdfUrl) {
                    window.open(experianPdfUrl, '_blank');
                  } else {
                    toast.error('PDF URL not available');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Experian PDF
              </button>
            ) : full_report ? (
              // Show debug button if PDF URL not found but report exists
              <button
                onClick={() => {
                  console.log('📄 Full Report Structure:', JSON.stringify(full_report, null, 2));
                  toast.info('Check browser console for full report structure. PDF URL may be in a different location.');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                title="PDF URL not found - Click to see report structure in console"
              >
                <FileText className="w-4 h-4" />
                Debug: View Report Structure
              </button>
            ) : null}
          </div>
          <p className="text-sm text-orange-600 italic mb-6">Your Experian Credit Report is summarized in the form of Experian Credit Score which ranges from 300 - 900.</p>

          <div className="flex items-center gap-8">
            {/* Credit Score Gauge */}
            <div className="relative">
              <div className="w-40 h-40 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full bg-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600">{displayScore}</div>
                    <div className="text-xs text-gray-500 mt-1">Credit Score</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>300</span>
                <span>900</span>
              </div>
            </div>

            {/* Score Factors */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">1. Recency:</span>
                <span className="text-sm text-gray-900">Recent Credit Account Defaults</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">2. Leverage:</span>
                <span className="text-sm text-gray-900">Credit Accounts with on-time re-payment history</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">3. Coverage:</span>
                <span className="text-sm text-gray-900">Non-delinquent and delinquent Credit Accounts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">4. Delinquency Status:</span>
                <span className="text-sm text-gray-900">Defaults on Credit Accounts (current & recent periodic intervals)</span>
              </div>
            </div>

            {/* Eligibility Badge */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full shadow-lg mb-2 ${is_eligible ? 'bg-green-100' : 'bg-red-100'
                }`}>
                {is_eligible ? (
                  <CheckCircle className="w-12 h-12 text-green-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {is_eligible ? 'Eligible' : 'Not Eligible'}
              </p>
            </div>
          </div>
        </div>

        {/* Rejection Reasons */}
        {rejection_reasons && rejection_reasons.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Rejection Reasons</h3>
            </div>
            <ul className="space-y-2">
              {rejection_reasons.map((reason, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Report Summary */}
        {reportData.CAIS_Account?.CAIS_Summary && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Report Summary</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Credit Account Summary */}
              <div>
                <h4 className="font-semibold text-blue-600 mb-3 text-sm">Credit Account Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total number of Accounts</span>
                    <span className="font-semibold">{reportData.CAIS_Account?.CAIS_Summary?.Credit_Account?.CreditAccountTotal || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Accounts</span>
                    <span className="font-semibold">{reportData.CAIS_Account?.CAIS_Summary?.Credit_Account?.CreditAccountActive || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Closed Accounts</span>
                    <span className="font-semibold">{reportData.CAIS_Account?.CAIS_Summary?.Credit_Account?.CreditAccountClosed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CC/CO</span>
                    <span className="font-semibold">-</span>
                  </div>
                </div>
              </div>

              {/* Current Balance Amount Summary */}
              <div>
                <h4 className="font-semibold text-blue-600 mb-3 text-sm">Current Balance Amount Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Current Bal. amt</span>
                    <span className="font-semibold">₹{reportData.CAIS_Account?.CAIS_Summary?.Total_Outstanding_Balance?.Outstanding_Balance_All || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SF/WD/WO/Settled amt</span>
                    <span className="font-semibold">₹0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Secured Accounts amt</span>
                    <span className="font-semibold">₹{reportData.CAIS_Account?.CAIS_Summary?.Total_Outstanding_Balance?.Outstanding_Balance_Secured || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unsecured Accounts amt</span>
                    <span className="font-semibold">₹{reportData.CAIS_Account?.CAIS_Summary?.Total_Outstanding_Balance?.Outstanding_Balance_UnSecured || 0}</span>
                  </div>
                </div>
              </div>

              {/* Credit Enquiry Summary */}
              <div>
                <h4 className="font-semibold text-blue-600 mb-3 text-sm">Credit Enquiry Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last 7 days credit enquiries</span>
                    <span className="font-semibold">{enquirySummary.CAPSLast7Days || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last 30 days credit enquiries</span>
                    <span className="font-semibold">{enquirySummary.CAPSLast30Days || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last 90 days credit enquiries</span>
                    <span className="font-semibold">{enquirySummary.CAPSLast90Days || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last 180 days credit enquiries</span>
                    <span className="font-semibold">{enquirySummary.CAPSLast180Days || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credit Account Information */}
        {accountSummary && accountSummary.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Summary: Credit Account Information</h3>
            </div>
            <p className="text-sm text-orange-600 italic mb-4">This section displays summary of all your reported credit accounts found in the Experian Credit Bureau database.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 px-2 py-2 text-left">#</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Lender</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Account type</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Account No</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Ownership</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Date Reported</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Account Status</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Date Opened</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Sanction Amt</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Current Balance</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">Amount Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {accountSummary.slice(0, 20).map((account, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-2 text-blue-600 font-semibold">
                        Acct {index + 1}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-blue-600">
                        {account.Subscriber_Name || 'N/A'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {account.Account_Type || 'N/A'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-mono">
                        {account.Account_Number ? account.Account_Number.replace(/\d(?=\d{4})/g, 'X') : 'N/A'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {account.Ownership_Indicator || 'Individual'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {account.Date_Reported || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${account.Account_Status === 'CLOSED' ? 'bg-gray-200 text-gray-700' :
                          account.Account_Status === 'ACTIVE' ? 'bg-green-200 text-green-700' :
                            'bg-yellow-200 text-yellow-700'
                          }`}>
                          {account.Account_Status || 'N/A'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {account.Open_Date || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        {account.Highest_Credit_or_Original_Loan_Amount ?
                          `₹${parseInt(account.Highest_Credit_or_Original_Loan_Amount).toLocaleString('en-IN')}` :
                          '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        {account.Current_Balance ?
                          `₹${parseInt(account.Current_Balance).toLocaleString('en-IN')}` :
                          '₹0'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        {account.Amount_Overdue ?
                          `₹${parseInt(account.Amount_Overdue).toLocaleString('en-IN')}` :
                          '₹0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accountSummary.length > 20 && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Showing 20 of {accountSummary.length} accounts
              </p>
            )}
          </div>
        )}

        {/* Credit Utilization Chart */}
        {accountSummary && accountSummary.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Credit Utilization Analysis</h3>
            </div>
            <p className="text-sm text-orange-600 italic mb-4">Credit utilization shows how much of your available credit you're currently using.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accountSummary.filter((acc: any) => acc.Credit_Limit_Amount && parseInt(acc.Credit_Limit_Amount) > 0).map((account: any, index: number) => {
                const limit = parseInt(account.Credit_Limit_Amount || '0');
                const balance = parseInt(account.Current_Balance || '0');
                const utilization = limit > 0 ? ((balance / limit) * 100).toFixed(1) : '0';
                const utilizationNum = parseFloat(utilization);
                const utilizationColor = utilizationNum > 70 ? 'bg-red-500' : utilizationNum > 30 ? 'bg-yellow-500' : 'bg-green-500';

                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{account.Subscriber_Name}</p>
                        <p className="text-xs text-gray-500">{account.Account_Type}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${account.Account_Status === 'ACTIVE' || account.Account_Status === '11' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {account.Account_Status === '11' ? 'ACTIVE' : account.Account_Status}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>₹{balance.toLocaleString('en-IN')} used</span>
                        <span>₹{limit.toLocaleString('en-IN')} limit</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${utilizationColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                      </div>
                      <p className="text-xs text-center mt-1 font-semibold">{utilization}% utilized</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Account Age Analysis */}
        {accountSummary && accountSummary.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Account Age Analysis</h3>
            </div>
            <p className="text-sm text-orange-600 italic mb-4">Older accounts with good payment history positively impact your credit score.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Lender</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Account Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Opened Date</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Account Age</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accountSummary.map((account: any, index: number) => {
                    const openDate = account.Open_Date;
                    let accountAge = 'N/A';
                    if (openDate && openDate.length === 8) {
                      const year = parseInt(openDate.substring(0, 4));
                      const month = parseInt(openDate.substring(4, 6));
                      const day = parseInt(openDate.substring(6, 8));
                      const opened = new Date(year, month - 1, day);
                      const now = new Date();
                      const years = now.getFullYear() - opened.getFullYear();
                      const months = now.getMonth() - opened.getMonth();
                      const totalMonths = years * 12 + months;
                      accountAge = totalMonths > 12 ? `${Math.floor(totalMonths / 12)} years ${totalMonths % 12} months` : `${totalMonths} months`;
                    }

                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-blue-600 font-medium">{account.Subscriber_Name}</td>
                        <td className="px-4 py-3">{account.Account_Type}</td>
                        <td className="px-4 py-3">{openDate ? `${openDate.substring(6, 8)}/${openDate.substring(4, 6)}/${openDate.substring(0, 4)}` : '-'}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600">{accountAge}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${account.Account_Status === 'CLOSED' || account.Account_Status === '13' ? 'bg-gray-200 text-gray-700' :
                            account.Account_Status === 'ACTIVE' || account.Account_Status === '11' ? 'bg-green-200 text-green-700' :
                              'bg-yellow-200 text-yellow-700'
                            }`}>
                            {account.Account_Status === '11' ? 'ACTIVE' : account.Account_Status === '13' ? 'CLOSED' : account.Account_Status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed CAPS Enquiry History */}
        {capsApplications && capsApplications.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Credit Enquiry History (CAPS)</h3>
            </div>
            <p className="text-sm text-orange-600 italic mb-4">Recent credit enquiries made by lenders when you applied for credit.</p>

            <div className="space-y-4">
              {capsApplications.map((enquiry: any, index: number) => (
                <div key={index} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Lender</p>
                      <p className="font-semibold text-sm text-gray-900">{enquiry.Subscriber_Name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Date of Request</p>
                      <p className="font-semibold text-sm text-gray-900">
                        {enquiry.Date_of_Request ?
                          `${enquiry.Date_of_Request.substring(6, 8)}/${enquiry.Date_of_Request.substring(4, 6)}/${enquiry.Date_of_Request.substring(0, 4)}` :
                          'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Amount Financed</p>
                      <p className="font-semibold text-sm text-gray-900">₹{parseInt(enquiry.Amount_Financed || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Report Number</p>
                      <p className="font-semibold text-sm text-gray-900 font-mono">{enquiry.ReportNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment History Timeline */}
        {accountSummary && accountSummary.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-teal-600" />
              <h3 className="text-lg font-semibold text-gray-900">Payment History Timeline</h3>
            </div>
            <p className="text-sm text-orange-600 italic mb-4">Payment history for your credit accounts. "0" means on-time payment, "?" means no data reported.</p>

            <div className="space-y-6">
              {accountSummary.slice(0, 5).map((account: any, index: number) => {
                const history = account.CAIS_Account_History || [];
                if (history.length === 0) return null;

                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{account.Subscriber_Name}</p>
                        <p className="text-xs text-gray-500">{account.Account_Type} - {account.Account_Number}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${account.Account_Status === 'CLOSED' || account.Account_Status === '13' ? 'bg-gray-200 text-gray-700' :
                        account.Account_Status === 'ACTIVE' || account.Account_Status === '11' ? 'bg-green-200 text-green-700' :
                          'bg-yellow-200 text-yellow-700'
                        }`}>
                        {account.Account_Status === '11' ? 'ACTIVE' : account.Account_Status === '13' ? 'CLOSED' : account.Account_Status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {history.slice(0, 24).reverse().map((month: any, idx: number) => {
                        const dpd = month.Days_Past_Due;
                        const bgColor = dpd === '0' ? 'bg-green-500' :
                          dpd === '?' ? 'bg-gray-300' :
                            parseInt(dpd) > 90 ? 'bg-red-500' :
                              parseInt(dpd) > 30 ? 'bg-orange-500' : 'bg-yellow-500';

                        return (
                          <div key={idx} className="group relative">
                            <div className={`w-6 h-6 ${bgColor} rounded flex items-center justify-center text-white text-xs font-bold cursor-pointer`}>
                              {dpd}
                            </div>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              {month.Month}/{month.Year}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>On-time (0)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-gray-300 rounded"></div>
                        <span>No data (?)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span>1-30 days</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span>31-90 days</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span>90+ days</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Request ID:</span>
              <span className="ml-2 font-mono text-xs">{request_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Client Ref:</span>
              <span className="ml-2 font-mono text-xs">{client_ref_num || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Report Date:</span>
              <span className="ml-2">{checked_at ? formatDate(checked_at) : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // Follow Up Tab
  const renderFollowUpTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Follow Up Management</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddFollowUpModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Follow Up
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Calendar className="w-4 h-4" />
              Schedule
            </button>
          </div>
        </div>

        {/* Follow Up Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Follow Up ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('followUps').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                    No follow-ups found. Click "Add Follow Up" to create one.
                  </td>
                </tr>
              ) : (
                getArray('followUps').map((followUp: any, index: number) => (
                  <tr key={followUp.id || index} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {followUp.follow_up_id || `FU${String(index + 1).padStart(6, '0')}`}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${followUp.type === 'call' ? 'bg-blue-100 text-blue-800' :
                        followUp.type === 'email' ? 'bg-green-100 text-green-800' :
                          followUp.type === 'sms' ? 'bg-yellow-100 text-yellow-800' :
                            followUp.type === 'meeting' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                        }`}>
                        {followUp.type?.toUpperCase() || 'CALL'}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {followUp.subject || 'Follow Up Required'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {followUp.description || followUp.notes || ''}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(followUp.created_at)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button className="text-orange-600 hover:text-orange-900">
                          <Clock className="w-4 h-4" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Notes Tab
  const renderNotesTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Admin Notes Management</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddNoteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Note
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Notes Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note Content</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('notes').map((note, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {note.noteId || `NOTE${String(index + 1).padStart(6, '0')}`}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${note.category === 'credit' ? 'bg-green-100 text-green-800' :
                      note.category === 'verification' ? 'bg-blue-100 text-blue-800' :
                        note.category === 'risk' ? 'bg-red-100 text-red-800' :
                          note.category === 'general' ? 'bg-gray-100 text-gray-800' :
                            'bg-purple-100 text-purple-800'
                      }`}>
                      {note.category?.toUpperCase() || 'GENERAL'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${note.priority === 'high' ? 'bg-red-100 text-red-800' :
                      note.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        note.priority === 'low' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      {note.priority?.toUpperCase() || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.subject || 'Admin Note'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {note.note}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.admin}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(note.date)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(note.lastModified || note.date)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${note.status === 'active' ? 'bg-green-100 text-green-800' :
                      note.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                        note.status === 'flagged' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                      }`}>
                      {note.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button className="text-orange-600 hover:text-orange-900">
                        <Flag className="w-4 h-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Notes</p>
                <p className="text-2xl font-semibold text-blue-900">{getUserData('notes')?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Active</p>
                <p className="text-2xl font-semibold text-green-900">
                  {getArray('notes').filter(note => note.status === 'active').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Flag className="w-8 h-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Flagged</p>
                <p className="text-2xl font-semibold text-red-900">
                  {getArray('notes').filter(note => note.status === 'flagged').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <User className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Admins</p>
                <p className="text-2xl font-semibold text-purple-900">
                  {new Set(getArray('notes').map(note => note.admin)).size}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // SMS Tab
  const renderSmsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">SMS Communication Management</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSendSmsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Send SMS
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Templates
            </button>
          </div>
        </div>

        {/* SMS Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent By</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('smsHistory').map((sms, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sms.smsId || `SMS${String(index + 1).padStart(6, '0')}`}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${sms.type === 'notification' ? 'bg-blue-100 text-blue-800' :
                      sms.type === 'reminder' ? 'bg-yellow-100 text-yellow-800' :
                        sms.type === 'alert' ? 'bg-red-100 text-red-800' :
                          sms.type === 'promotional' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                      }`}>
                      {sms.type?.toUpperCase() || 'NOTIFICATION'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sms.recipient || getUserData('mobile')}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {sms.message}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sms.template || 'Custom'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sms.sentBy || 'System'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(sms.date)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sms.time || '09:15 AM'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${sms.status === 'sent' ? 'bg-green-100 text-green-800' :
                      sms.status === 'failed' ? 'bg-red-100 text-red-800' :
                        sms.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          sms.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                      }`}>
                      {sms.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sms.deliveryStatus || 'Delivered'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button className="text-orange-600 hover:text-orange-900">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageSquare className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total SMS</p>
                <p className="text-2xl font-semibold text-blue-900">{getUserData('smsHistory')?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Sent</p>
                <p className="text-2xl font-semibold text-green-900">
                  {getArray('smsHistory').filter(sms => sms.status === 'sent' || sms.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-2xl font-semibold text-red-900">
                  {getArray('smsHistory').filter(sms => sms.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-semibold text-yellow-900">
                  {getArray('smsHistory').filter(sms => sms.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  // Transactions Tab
  const renderTransactionsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddTransactionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Transaction
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Related Loan</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('transactions').length > 0 ? (
                getArray('transactions').map((transaction: any, index: number) => (
                  <tr key={transaction.id || index} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date || transaction.created_at)}
                      <div className="text-xs text-gray-500">{transaction.transaction_time}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.transaction_type === 'loan_disbursement' ? 'bg-purple-100 text-purple-800' :
                        transaction.transaction_type?.startsWith('emi_paid') ? 'bg-blue-100 text-blue-800' :
                        transaction.transaction_type?.startsWith('loan_extension') ? 'bg-indigo-100 text-indigo-800' :
                        transaction.transaction_type === 'settlement' ? 'bg-yellow-100 text-yellow-800' :
                        transaction.transaction_type === 'full_payment' ? 'bg-green-100 text-green-800' :
                        transaction.transaction_type === 'part_payment' ? 'bg-teal-100 text-teal-800' :
                        'bg-gray-100 text-gray-800'
                        }`}>
                        {transaction.transaction_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold ${
                      transaction.transaction_type?.startsWith('emi_paid') || 
                      transaction.transaction_type?.startsWith('loan_extension') ||
                      ['full_payment', 'part_payment', 'settlement'].includes(transaction.transaction_type) ? 'text-green-600' :
                      ['loan_disbursement'].includes(transaction.transaction_type) ? 'text-red-600' : 'text-gray-900'
                      }`}>
                      {transaction.transaction_type?.startsWith('emi_paid') || 
                       transaction.transaction_type?.startsWith('loan_extension') ||
                       ['full_payment', 'part_payment', 'settlement'].includes(transaction.transaction_type) ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.loan_application_id ? (
                        <span className="text-blue-600 hover:underline cursor-pointer">
                          {formatLoanId(transaction.application_number, transaction.loan_application_id)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                      {editingTransactionId === transaction.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingReferenceNumber}
                            onChange={(e) => setEditingReferenceNumber(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateTransactionReference(transaction.id, editingReferenceNumber);
                              } else if (e.key === 'Escape') {
                                setEditingTransactionId(null);
                                setEditingReferenceNumber('');
                              }
                            }}
                            onBlur={() => {
                              if (editingReferenceNumber.trim() !== (transaction.reference_number || '')) {
                                handleUpdateTransactionReference(transaction.id, editingReferenceNumber);
                              } else {
                                setEditingTransactionId(null);
                                setEditingReferenceNumber('');
                              }
                            }}
                            className="px-2 py-1 border border-blue-500 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[150px]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateTransactionReference(transaction.id, editingReferenceNumber)}
                            className="text-green-600 hover:text-green-800"
                            title="Save"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTransactionId(null);
                              setEditingReferenceNumber('');
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingTransactionId(transaction.id);
                            setEditingReferenceNumber(transaction.reference_number || '');
                          }}
                          className="flex items-center gap-2 cursor-pointer group"
                          title="Click to edit"
                        >
                          <span className="font-mono group-hover:text-blue-600">
                            {transaction.reference_number || '-'}
                          </span>
                          <Edit className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.created_by_name || 'System'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <CreditCard className="w-8 h-8 text-gray-300 mb-2" />
                      <p>No transactions found for this user.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderModals = () => (
    <>
      {/* Basic Info Modal */}
      {showBasicInfoModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Basic Information</h4>
              <button
                onClick={() => setShowBasicInfoModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={basicInfoForm.firstName}
                    onChange={(e) => setBasicInfoForm({ ...basicInfoForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={basicInfoForm.lastName}
                    onChange={(e) => setBasicInfoForm({ ...basicInfoForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={basicInfoForm.dateOfBirth}
                    onChange={(e) => setBasicInfoForm({ ...basicInfoForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={basicInfoForm.panNumber}
                    onChange={(e) => setBasicInfoForm({ ...basicInfoForm, panNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter PAN number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    defaultValue={getUserData('personalInfo.gender')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <select
                    defaultValue={getUserData('personalInfo.maritalStatus')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                <input
                  type="text"
                  defaultValue={getUserData('personalInfo.education')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBasicInfoSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowBasicInfoModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Contact Information</h4>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Mobile</label>
                <input
                  type="tel"
                  value={contactInfoForm.phone}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
                <input
                  type="tel"
                  value={contactInfoForm.alternatePhone}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, alternatePhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter alternate mobile"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={contactInfoForm.email}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={contactInfoForm.personalEmail}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, personalEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter personal email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={contactInfoForm.officialEmail}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, officialEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter official email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
                <input
                  type="email"
                  value={contactInfoForm.companyEmail}
                  onChange={(e) => setContactInfoForm({ ...contactInfoForm, companyEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company email"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleContactInfoSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                {editingAddressId ? 'Edit Address' : 'Add New Address'}
              </h4>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  setEditingAddressId(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Type</label>
                <select
                  value={addressInfoForm.address_type}
                  onChange={(e) => setAddressInfoForm({ ...addressInfoForm, address_type: e.target.value as 'current' | 'permanent' | 'office' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="current">Current</option>
                  <option value="permanent">Permanent</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
                <textarea
                  value={addressInfoForm.address_line1}
                  onChange={(e) => setAddressInfoForm({ ...addressInfoForm, address_line1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter address line 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <textarea
                  value={addressInfoForm.address_line2}
                  onChange={(e) => setAddressInfoForm({ ...addressInfoForm, address_line2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Enter address line 2 (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addressInfoForm.city}
                    onChange={(e) => setAddressInfoForm({ ...addressInfoForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addressInfoForm.state}
                    onChange={(e) => setAddressInfoForm({ ...addressInfoForm, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter state"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addressInfoForm.pincode}
                    onChange={(e) => setAddressInfoForm({ ...addressInfoForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter 6-digit pincode"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={addressInfoForm.country}
                    onChange={(e) => setAddressInfoForm({ ...addressInfoForm, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter country"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addressInfoForm.is_primary}
                    onChange={(e) => setAddressInfoForm({ ...addressInfoForm, is_primary: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Set as primary address</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddressInfoSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingAddressId ? 'Update Address' : 'Add Address'}
                </button>
                <button
                  onClick={() => {
                    setShowAddressModal(false);
                    setEditingAddressId(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employment Modal */}
      {showEmploymentModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Employment Information</h4>
              <button
                onClick={() => setShowEmploymentModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={employmentInfoForm.companyName || employmentInfoForm.company}
                  onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, companyName: e.target.value, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={employmentInfoForm.designation}
                    onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter designation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={employmentInfoForm.industry}
                    onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter industry"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={employmentInfoForm.department}
                  onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter department"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income</label>
                  <input
                    type="number"
                    value={employmentInfoForm.income || employmentInfoForm.monthlyIncome}
                    onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, income: e.target.value, monthlyIncome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter monthly income"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Experience (Years)</label>
                  <input
                    type="number"
                    value={employmentInfoForm.workExperience}
                    onChange={(e) => setEmploymentInfoForm({ ...employmentInfoForm, workExperience: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter years of experience"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleEmploymentInfoSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEmploymentModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload New Document Modal */}
      {showUploadNewModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Upload New Document</h4>
              <button
                onClick={() => setShowUploadNewModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  disabled={uploadingDocument}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    uploadingDocument ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  required
                >
                  <option value="">Select Document Type</option>
                  <option value="pan">PAN Card</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="bank_statement">Bank Statement</option>
                  <option value="salary_slip">Salary Slip</option>
                  <option value="employment_letter">Employment Letter</option>
                  <option value="address_proof">Address Proof</option>
                  <option value="income_certificate">Income Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Title</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Enter document title"
                  disabled={uploadingDocument}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    uploadingDocument ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  required
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    id="document-upload"
                    disabled={uploadingDocument}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setDocumentFile(file);
                        if (!documentTitle) {
                          setDocumentTitle(file.name);
                        }
                      }
                    }}
                  />
                  <label htmlFor="document-upload" className={uploadingDocument ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">PDF, JPG, PNG up to 10MB</p>
                      {documentFile && (
                        <p className="text-xs text-green-600 mt-2">Selected: {documentFile.name}</p>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Document Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={documentDescription}
                  onChange={(e) => setDocumentDescription(e.target.value)}
                  placeholder="Add any additional notes about this document"
                  rows={3}
                  disabled={uploadingDocument}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    uploadingDocument ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Priority Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                <select
                  disabled={uploadingDocument}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    uploadingDocument ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={uploadingDocument}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!documentType || !documentTitle || !documentFile) {
                      alert('Please fill in all required fields and select a file');
                      return;
                    }

                    setUploadingDocument(true);
                    try {
                      const formData = new FormData();
                      formData.append('document', documentFile);
                      formData.append('documentType', documentType);
                      formData.append('documentTitle', documentTitle);
                      if (documentDescription) {
                        formData.append('description', documentDescription);
                      }
                      // loanApplicationId is optional - backend will use most recent if not provided
                      // We can add a selector later if needed

                      const response = await adminApiService.uploadUserDocument(params.userId!, formData);
                      if (response.status === 'success') {
                        alert('Document uploaded successfully!');
                        setShowUploadNewModal(false);
                        setDocumentType('');
                        setDocumentTitle('');
                        setDocumentFile(null);
                        setDocumentDescription('');
                        setUploadingDocument(false);
                        // Refresh user data
                        const profileResponse = await adminApiService.getUserProfile(params.userId!);
                        if (profileResponse.status === 'success') {
                          setUserData(profileResponse.data);
                        }
                      } else {
                        alert(response.message || 'Failed to upload document');
                      }
                    } catch (error: any) {
                      console.error('Error uploading document:', error);
                      alert('Error uploading document: ' + (error.message || 'Unknown error'));
                    } finally {
                      setUploadingDocument(false);
                    }
                  }}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                    uploadingDocument
                      ? 'bg-blue-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {uploadingDocument ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Document'
                  )}
                </button>
                <button
                  type="button"
                  disabled={uploadingDocument}
                  onClick={() => {
                    setShowUploadNewModal(false);
                    setDocumentType('');
                    setDocumentTitle('');
                    setDocumentFile(null);
                    setDocumentDescription('');
                    setUploadingDocument(false);
                  }}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    uploadingDocument
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bank Details Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Bank Details</h4>
              <button
                onClick={() => setShowAddBankModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Bank Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Bank</option>
                    <option value="sbi">State Bank of India</option>
                    <option value="hdfc">HDFC Bank</option>
                    <option value="icici">ICICI Bank</option>
                    <option value="axis">Axis Bank</option>
                    <option value="kotak">Kotak Mahindra Bank</option>
                    <option value="pnb">Punjab National Bank</option>
                    <option value="bob">Bank of Baroda</option>
                    <option value="canara">Canara Bank</option>
                    <option value="union">Union Bank of India</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Type *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Account Type</option>
                    <option value="savings">Savings Account</option>
                    <option value="current">Current Account</option>
                    <option value="salary">Salary Account</option>
                    <option value="business">Business Account</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
                  <input
                    type="text"
                    placeholder="Enter account number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code *</label>
                  <input
                    type="text"
                    placeholder="Enter IFSC code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name *</label>
                  <input
                    type="text"
                    placeholder="Enter account holder name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
                  <input
                    type="text"
                    placeholder="Enter branch name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Code</label>
                  <input
                    type="text"
                    placeholder="Enter branch code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    placeholder="Enter city"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Verification Details */}
              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-900 mb-3">Verification Details</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verification Priority</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verification Method</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                      <option value="api">API Verification</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                <textarea
                  placeholder="Add any additional notes about this bank account"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBankDetailsSubmit();
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Bank Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBankModal(false);
                    setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bank Details Modal */}
      {showEditBankModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Bank Details</h4>
              <button
                onClick={() => {
                  setShowEditBankModal(false);
                  setEditingBankId(null);
                  setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Bank Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                <input
                  type="text"
                  value={bankDetailsForm.bankName}
                  onChange={(e) => setBankDetailsForm({ ...bankDetailsForm, bankName: e.target.value })}
                  placeholder="Enter bank name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
                <input
                  type="text"
                  value={bankDetailsForm.accountNumber}
                  onChange={(e) => setBankDetailsForm({ ...bankDetailsForm, accountNumber: e.target.value })}
                  placeholder="Enter account number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* IFSC Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code *</label>
                <input
                  type="text"
                  value={bankDetailsForm.ifscCode}
                  onChange={(e) => setBankDetailsForm({ ...bankDetailsForm, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="Enter IFSC code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name *</label>
                <input
                  type="text"
                  value={bankDetailsForm.accountHolderName}
                  onChange={(e) => setBankDetailsForm({ ...bankDetailsForm, accountHolderName: e.target.value })}
                  placeholder="Enter account holder name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
                <input
                  type="text"
                  value={bankDetailsForm.branchName}
                  onChange={(e) => setBankDetailsForm({ ...bankDetailsForm, branchName: e.target.value })}
                  placeholder="Enter branch name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    handleUpdateBankDetails();
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Bank Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditBankModal(false);
                    setEditingBankId(null);
                    setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Reference Modal */}
      {showAddReferenceModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Reference</h4>
              <button
                onClick={() => setShowAddReferenceModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddReference(e);
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={newReference.name}
                  onChange={(e) => {
                    setNewReference({ ...newReference, name: e.target.value });
                    if (referenceErrors.name) {
                      setReferenceErrors({ ...referenceErrors, name: '' });
                    }
                  }}
                  placeholder="Enter name"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    referenceErrors.name 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {referenceErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{referenceErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={newReference.phone}
                  onChange={(e) => {
                    // Only allow numeric input
                    const value = e.target.value.replace(/\D/g, '');
                    // Limit to 10 digits
                    const limitedValue = value.slice(0, 10);
                    setNewReference({ ...newReference, phone: limitedValue });
                    if (referenceErrors.phone) {
                      setReferenceErrors({ ...referenceErrors, phone: '' });
                    }
                  }}
                  placeholder="Enter phone number (10 digits)"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    referenceErrors.phone 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {referenceErrors.phone && (
                  <p className="mt-1 text-sm text-red-600">{referenceErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Relation *</label>
                <input
                  type="text"
                  value={newReference.relation}
                  onChange={(e) => {
                    setNewReference({ ...newReference, relation: e.target.value });
                    if (referenceErrors.relation) {
                      setReferenceErrors({ ...referenceErrors, relation: '' });
                    }
                  }}
                  placeholder="Enter relationship"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    referenceErrors.relation 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {referenceErrors.relation && (
                  <p className="mt-1 text-sm text-red-600">{referenceErrors.relation}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddReference(e as any);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Reference
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddReferenceModal(false);
                    setNewReference({ name: '', phone: '', relation: '' });
                    setReferenceErrors({ name: '', phone: '', relation: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center pb-3 border-b mb-4">
                <h3 className="text-xl font-medium text-gray-900">Add New Transaction</h3>
                <button
                  onClick={() => setShowAddTransactionModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Type */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                  <select
                    value={transactionForm.transactionType}
                    onChange={(e) => {
                      const type = e.target.value;
                      setTransactionForm(prev => ({
                        ...prev,
                        transactionType: type,
                        // Auto-set category based on type
                        category: type === 'loan_disbursement' || type.startsWith('emi_paid') || type.startsWith('loan_extension') ? 'loan' : 'other'
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Type</option>
                    {transactionTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Loan Application Selector (Visible if loan related or requested) */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Related Loan Application
                    {transactionForm.transactionType === 'loan_disbursement' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={transactionForm.loanApplicationId}
                    onChange={(e) => {
                      const appId = e.target.value;
                      // Auto-fill amount if it's a disbursement
                      let amount = transactionForm.amount;
                      if (transactionForm.transactionType === 'loan_disbursement' && appId) {
                        const loan = getArray('loans')?.find((l: any) => l.id.toString() === appId || l.loanId?.toString() === appId);
                        if (loan) {
                          // Check if loan is in a status that requires recalculation
                          // For repeat_disbursal loans, ALWAYS recalculate (don't use stored disbursal_amount from previous disbursal)
                          const isRepeatDisbursal = loan.status === 'repeat_disbursal' || loan.status === 'repeat_ready_for_disbursement';
                          // Check if loan is already in final status (account_manager/cleared) and not a repeat disbursal
                          const isFinalStatus = (loan.status === 'account_manager' || loan.status === 'cleared') && !isRepeatDisbursal;
                          const isAlreadyDisbursed = (loan.disbursed_at && isFinalStatus) || isFinalStatus;
                          
                          if (isAlreadyDisbursed && !isRepeatDisbursal) {
                            // For already disbursed loans in final status (and not repeat disbursal), use the stored disbursal_amount
                            amount = loan.disbursal_amount || loan.disbursalAmount;
                          } else {
                            // For loans not yet disbursed OR repeat_disbursal loans, NEVER use stored disbursal_amount (might be from old loan)
                            // Always fetch calculation to get correct disbursal amount based on current loan_amount
                            const loanId = parseInt(appId);
                            if (loanId) {
                              // Check if calculation is already cached
                              if (loanCalculations[loanId]?.disbursal?.amount !== undefined) {
                                // Use cached calculation immediately
                                amount = loanCalculations[loanId].disbursal.amount;
                              } else {
                                // Don't use stored disbursal_amount - it might be wrong for repeat_disbursal loans!
                                // Use loan_amount as temporary placeholder (will be updated by useEffect when calculation arrives)
                                amount = loan.loan_amount || loan.amount || loan.principalAmount || '';
                                // Trigger calculation fetch immediately to get correct disbursal amount
                                fetchLoanCalculation(loanId).catch(err => console.error('Error fetching loan calculation:', err));
                              }
                            } else {
                              // Fallback: use loan_amount (never use stored disbursal_amount for non-final loans)
                              amount = loan.loan_amount || loan.amount || loan.principalAmount || '';
                            }
                          }
                        }
                      }
                      setTransactionForm({ ...transactionForm, loanApplicationId: appId, amount: amount ? amount.toString() : '' });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Loan Application (Optional normally, Required for Disbursement)</option>
                    {/* For loan disbursement, only show loans that are NOT already in account_manager or cleared */}
                    {transactionForm.transactionType === 'loan_disbursement' ? (
                      <>
                        {/* Show ready_for_disbursement loans first */}
                        {getArray('loans')?.filter((l: any) => l.status === 'ready_for_disbursement').map((loan: any) => {
                          const shortLoanId = loan.shortLoanId || loan.application_number || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);
                          return (
                            <option key={loan.id || loan.loanId} value={loan.id || loan.loanId} className="font-bold text-green-600">
                              📦 {shortLoanId} - ₹{loan.amount || loan.loan_amount || loan.principalAmount} (Ready for Disbursement)
                            </option>
                          );
                        })}
                        {getArray('loans')?.filter((l: any) => l.status === 'ready_for_disbursement').length > 0 && 
                         getArray('loans')?.filter((l: any) => l.status !== 'ready_for_disbursement' && l.status !== 'account_manager' && l.status !== 'cleared').length > 0 && (
                          <option disabled>──────────────</option>
                        )}
                        {/* Show other loans (exclude account_manager and cleared) */}
                        {getArray('loans')?.filter((l: any) => l.status !== 'ready_for_disbursement' && l.status !== 'account_manager' && l.status !== 'cleared').map((loan: any) => {
                          const shortLoanId = loan.shortLoanId || loan.application_number || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);
                          return (
                            <option key={loan.id || loan.loanId} value={loan.id || loan.loanId}>
                              {shortLoanId} - ₹{loan.amount || loan.loan_amount || loan.principalAmount} ({loan.status})
                            </option>
                          );
                        })}
                        {/* Show already disbursed loans as disabled */}
                        {getArray('loans')?.filter((l: any) => l.status === 'account_manager' || l.status === 'cleared').length > 0 && (
                          <>
                            <option disabled>─── Already Disbursed (Cannot Select) ───</option>
                            {getArray('loans')?.filter((l: any) => l.status === 'account_manager' || l.status === 'cleared').map((loan: any) => {
                              const shortLoanId = loan.shortLoanId || loan.application_number || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);
                              return (
                                <option key={loan.id || loan.loanId} disabled style={{ color: '#999' }}>
                                  🚫 {shortLoanId} - ₹{loan.amount || loan.loan_amount || loan.principalAmount} ({loan.status})
                                </option>
                              );
                            })}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Show ready_for_disbursement loans first */}
                        {getArray('loans')?.filter((l: any) => l.status === 'ready_for_disbursement').map((loan: any) => {
                          const shortLoanId = loan.shortLoanId || loan.application_number || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);
                          return (
                            <option key={loan.id || loan.loanId} value={loan.id || loan.loanId} className="font-bold text-green-600">
                              📦 {shortLoanId} - ₹{loan.amount || loan.loan_amount || loan.principalAmount} (Ready for Disbursement)
                            </option>
                          );
                        })}
                        <option disabled>──────────────</option>
                        {/* Show all other loans */}
                        {getArray('loans')?.filter((l: any) => l.status !== 'ready_for_disbursement').map((loan: any) => {
                          const shortLoanId = loan.shortLoanId || loan.application_number || (loan.loanId ? `PLL${loan.loanId.slice(-4)}` : `PLL${String(loan.id || 'N/A').padStart(4, '0').slice(-4)}`);
                          return (
                            <option key={loan.id || loan.loanId} value={loan.id || loan.loanId}>
                              {shortLoanId} - ₹{loan.amount || loan.loan_amount || loan.principalAmount} ({loan.status})
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                  {transactionForm.transactionType === 'loan_disbursement' && (
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ You can only disburse loans that are NOT already in "Account Manager" or "Cleared" status.
                    </p>
                  )}
                  {transactionForm.transactionType === 'full_payment' && (
                    <p className="text-xs text-blue-600 mt-1">
                      ✅ This transaction will mark the selected loan as "Cleared" (fully paid).
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {transactionForm.transactionType === 'loan_disbursement' ? 'Disb Amount (₹)' : 'Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                {/* Date & Time */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={transactionForm.transactionDate}
                    onChange={(e) => setTransactionForm({ ...transactionForm, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Reference Number */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference / UTR No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={transactionForm.referenceNumber}
                    onChange={(e) => setTransactionForm({ ...transactionForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. UPI12345678"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowAddTransactionModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransactionSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow Up Modal */}
      {showAddFollowUpModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Follow Up</h4>
              <button
                onClick={() => setShowAddFollowUpModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!followUpForm.type || !followUpForm.response) {
                  alert('Please fill in all required fields');
                  return;
                }

                if (!params.userId) {
                  alert('User ID is missing');
                  return;
                }

                setSubmittingFollowUp(true);
                try {
                  const response = await adminApiService.addFollowUp(params.userId, {
                    type: followUpForm.type,
                    response: followUpForm.response,
                    description: `Follow up: ${followUpForm.response}`,
                    subject: `Follow Up - ${followUpForm.type}`,
                    status: 'pending'
                  });

                  if (response.status === 'success') {
                    alert('Follow up added successfully!');
                    setShowAddFollowUpModal(false);
                    setFollowUpForm({ type: '', response: '' });
                    // Refresh user data to show new follow-up
                    if (params.userId) {
                      const profileResponse = await adminApiService.getUserProfile(params.userId);
                      if (profileResponse.status === 'success') {
                        setUserData(profileResponse.data);
                      }
                    }
                  } else {
                    alert('Failed to add follow up: ' + (response.message || 'Unknown error'));
                  }
                } catch (error: any) {
                  console.error('Error adding follow up:', error);
                  alert('Failed to add follow up: ' + (error.message || 'Unknown error'));
                } finally {
                  setSubmittingFollowUp(false);
                }
              }}
            >
              {/* Follow Up Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Follow Up Type *</label>
                <select
                  value={followUpForm.type}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Follow Up Type</option>
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="meeting">Meeting</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Response */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Response *</label>
                <select
                  value={followUpForm.response}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, response: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Response</option>
                  <optgroup label="Responded">
                    <option value="responded_shall_mail_docs_eod">shall mail the docs by EOD</option>
                    <option value="responded_shall_mail_docs_tomorrow">shall mail the docs tomorrow</option>
                    <option value="responded_will_upload_docs_website">will upload docs on website/ app</option>
                    <option value="responded_will_send_docs_whatsapp">will send docs on WhatsApp</option>
                    <option value="responded_customer_not_interested">customer not interested</option>
                    <option value="responded_not_responding_properly">not responding properly</option>
                    <option value="responded_told_to_call_back_later">told to call back later</option>
                    <option value="responded_wrong_number">wrong number</option>
                    <option value="responded_didnt_not_apply_loan">didn't not apply loan</option>
                    <option value="responded_interest_rate_is_high">interest rate is high</option>
                    <option value="responded_dont_have_required_docs">don't have required docs</option>
                    <option value="responded_uploaded_all_docs_done">uploaded all docs. It's done</option>
                  </optgroup>
                  <optgroup label="Not responded">
                    <option value="not_responded_call_not_answering">Call not answering</option>
                    <option value="not_responded_switched_off">switched off</option>
                    <option value="not_responded_not_reachable">not reachable</option>
                  </optgroup>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submittingFollowUp}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingFollowUp ? 'Adding...' : 'Add Follow Up'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFollowUpModal(false);
                    setFollowUpForm({ type: '', response: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Note</h4>
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Note Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="general">General</option>
                    <option value="credit">Credit Related</option>
                    <option value="verification">Verification</option>
                    <option value="risk">Risk Assessment</option>
                    <option value="payment">Payment Related</option>
                    <option value="document">Document Related</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Subject and Note Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <input
                  type="text"
                  placeholder="Enter note subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Content *</label>
                <textarea
                  placeholder="Enter detailed note content"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Visibility and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="private">Private</option>
                    <option value="team">Team Only</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Note added successfully!');
                    setShowAddNoteModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Note
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send SMS Modal */}
      {showSendSmsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Send SMS</h4>
              <button
                onClick={() => setShowSendSmsModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Recipient and SMS Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recipient *</label>
                  <input
                    type="tel"
                    placeholder="Enter mobile number"
                    defaultValue={getUserData('mobile')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SMS Type *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select SMS Type</option>
                    <option value="notification">Notification</option>
                    <option value="reminder">Reminder</option>
                    <option value="alert">Alert</option>
                    <option value="promotional">Promotional</option>
                    <option value="verification">Verification</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template (Optional)</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Template</option>
                  <option value="loan_approved">Loan Approved</option>
                  <option value="payment_reminder">Payment Reminder</option>
                  <option value="document_required">Document Required</option>
                  <option value="verification_pending">Verification Pending</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>

              {/* Message Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                <textarea
                  placeholder="Enter your SMS message (160 characters max)"
                  rows={4}
                  maxLength={160}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  <span id="char-count">0</span>/160 characters
                </div>
              </div>

              {/* Scheduling */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Send Now or Schedule</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="now">Send Now</option>
                    <option value="schedule">Schedule</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('SMS sent successfully!');
                    setShowSendSmsModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Send SMS
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendSmsModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">SMS Templates</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddTemplateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Template
                </button>
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Templates List */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Template 1 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Loan Approved</h5>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Type: Notification</p>
                  <p className="text-sm text-gray-700">"Dear {getUserData('name')}, your loan application has been approved for ₹{getUserData('loans')?.[0]?.amount || 'X'}. Please check your email for further details."</p>
                </div>

                {/* Template 2 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Payment Reminder</h5>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Type: Reminder</p>
                  <p className="text-sm text-gray-700">"Dear {getUserData('name')}, your EMI payment of ₹X is due on [DATE]. Please make the payment to avoid late fees."</p>
                </div>

                {/* Template 3 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Document Required</h5>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Type: Alert</p>
                  <p className="text-sm text-gray-700">"Dear {getUserData('name')}, additional documents are required for your loan application. Please upload them in your dashboard."</p>
                </div>

                {/* Template 4 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">Verification Pending</h5>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Type: Verification</p>
                  <p className="text-sm text-gray-700">"Dear {getUserData('name')}, your KYC verification is pending. Please complete the verification process to proceed."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add SMS Template</h4>
              <button
                onClick={() => setShowAddTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              {/* Template Name and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                  <input
                    type="text"
                    placeholder="Enter template name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template Type *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="notification">Notification</option>
                    <option value="reminder">Reminder</option>
                    <option value="alert">Alert</option>
                    <option value="promotional">Promotional</option>
                    <option value="verification">Verification</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Template Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Content *</label>
                <textarea
                  placeholder="Enter template message. Use {name}, {amount}, {date} for variables"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  Available variables: {'{name}'}, {'{amount}'}, {'{date}'}, {'{loan_id}'}, {'{mobile}'}
                </div>
              </div>

              {/* Category and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="loan">Loan Related</option>
                    <option value="payment">Payment Related</option>
                    <option value="verification">Verification</option>
                    <option value="general">General</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Template added successfully!');
                    setShowAddTemplateModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Details Modal */}
      {showPlanDetailsModal && selectedPlanDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Loan Plan Details</h4>
              <button
                onClick={() => {
                  setShowPlanDetailsModal(false);
                  setSelectedPlanDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan Name</label>
                  <p className="text-gray-900 font-semibold">{selectedPlanDetails.plan_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan Code</label>
                  <p className="text-gray-900">{selectedPlanDetails.plan_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan Type</label>
                  <p className="text-gray-900">{selectedPlanDetails.plan_type === 'single' ? 'Single Payment' : 'Multi-EMI'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Interest Rate</label>
                  <p className="text-gray-900">{selectedPlanDetails.interest_percent_per_day ? (parseFloat(selectedPlanDetails.interest_percent_per_day) * 100).toFixed(4) : 'N/A'}% per day</p>
                </div>
                {selectedPlanDetails.plan_type === 'single' ? (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-gray-900">{selectedPlanDetails.repayment_days || 'N/A'} days</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-500">EMI Frequency</label>
                      <p className="text-gray-900 capitalize">{selectedPlanDetails.emi_frequency || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">EMI Count</label>
                      <p className="text-gray-900">{selectedPlanDetails.emi_count || 'N/A'}</p>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Calculate by Salary Date</label>
                  <p className="text-gray-900">{selectedPlanDetails.calculate_by_salary_date ? 'Yes' : 'No'}</p>
                </div>
                {selectedPlanDetails.allow_extension && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan Extension</label>
                    <p className="text-gray-900">
                      {selectedPlanDetails.extension_show_from_days && selectedPlanDetails.extension_show_till_days
                        ? `D${selectedPlanDetails.extension_show_from_days} to D+${selectedPlanDetails.extension_show_till_days}`
                        : 'Enabled'}
                    </p>
                  </div>
                )}
              </div>

              {/* Fees Section */}
              <div className="mt-6">
                <h5 className="text-md font-semibold text-gray-900 mb-3">Fees</h5>
                {selectedPlanDetails.fees && selectedPlanDetails.fees.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlanDetails.fees.map((fee: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{fee.fee_name}</p>
                            <p className="text-sm text-gray-600">{fee.fee_percent}%</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {fee.application_method === 'deduct_from_disbursal'
                                ? 'Deduct from Disbursal'
                                : 'Add to Total Repayable'}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">18% GST applies</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No fees assigned to this plan</p>
                )}
              </div>

              {selectedPlanDetails.description && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900 text-sm">{selectedPlanDetails.description}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowPlanDetailsModal(false);
                  setSelectedPlanDetails(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Plan Selection Modal */}
      {showLoanPlanModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                {editingLoanPlanId ? 'Assign Loan Plan to Loan' : 'Select Loan Plan'}
              </h4>
              <button
                onClick={() => {
                  setShowLoanPlanModal(false);
                  setEditingLoanPlanId(null);
                  setSelectedLoanPlanId(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {loanPlans.length > 0 ? (
                <div className="space-y-2">
                  {loanPlans.map((plan: any) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedLoanPlanId(plan.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedLoanPlanId === plan.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-semibold text-gray-900">{plan.plan_name}</h5>
                          <p className="text-sm text-gray-600 mt-1">Code: {plan.plan_code}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Type: {plan.plan_type === 'single' ? 'Single Payment' : `Multi-EMI (${plan.emi_count || 'N/A'} EMIs)`}
                          </p>
                          {plan.is_default && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                              Default Plan
                            </span>
                          )}
                        </div>
                        {selectedLoanPlanId === plan.id && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No active loan plans available</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateLoanPlan}
                  disabled={!selectedLoanPlanId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingLoanPlanId ? 'Assign Plan' : 'Update Plan'}
                </button>
                <button
                  onClick={() => {
                    setShowLoanPlanModal(false);
                    setEditingLoanPlanId(null);
                    setSelectedLoanPlanId(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMI Details Modal */}
      <Dialog open={showEmiDetailsModal} onOpenChange={setShowEmiDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>EMI Details - {selectedLoanIdForEmi}</DialogTitle>
            <DialogDescription>
              View all EMI schedule details with dates and amounts
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedLoanEmiSchedule.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EMI #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount (₹)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedLoanEmiSchedule.map((emi: any, index: number) => {
                      // Get data from calculated schedule (includes penalty) or stored emi_schedule
                      const emiNumber = emi.emi_number || emi.instalment_no || (index + 1);
                      const emiDate = emi.due_date || 'N/A';
                      // Use instalment_amount if available (includes penalty), otherwise use emi_amount
                      const emiAmount = parseFloat(emi.instalment_amount || emi.emi_amount || 0);
                      const emiStatus = emi.status || 'pending';
                      
                      // Check if EMI is overdue and has penalty
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueDate = emiDate !== 'N/A' ? new Date(emiDate) : null;
                      const isOverdue = dueDate && dueDate < today;
                      const hasPenalty = emi.penalty_total > 0 || emi.penalty_base > 0;

                      return (
                        <tr key={index} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {emiNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {emiDate !== 'N/A' ? formatDate(emiDate) : 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrencyWithDecimals(emiAmount)}
                            </div>
                            {hasPenalty && (
                              <div className="text-xs text-red-600 mt-1">
                                <div>Penalty: ₹{(emi.penalty_base || 0).toFixed(2)}</div>
                                <div>GST: ₹{(emi.penalty_gst || 0).toFixed(2)}</div>
                                <div className="font-semibold">Total Penalty: ₹{(emi.penalty_total || 0).toFixed(2)}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                emiStatus === 'paid' || emiStatus === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : emiStatus === 'overdue' || emiStatus === 'defaulted' || isOverdue
                                  ? 'bg-red-100 text-red-800'
                                  : emiStatus === 'pending' || emiStatus === 'due'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {isOverdue ? 'Overdue' : (emiStatus.charAt(0).toUpperCase() + emiStatus.slice(1))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {selectedLoanEmiSchedule.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Total:
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatCurrencyWithDecimals(
                            selectedLoanEmiSchedule.reduce((sum: number, emi: any) => {
                              // Use instalment_amount (includes penalty) if available, otherwise emi_amount
                              return sum + parseFloat(emi.instalment_amount || emi.emi_amount || 0);
                            }, 0)
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No EMI schedule data available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/applications')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Applications
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">User Profile Detail - {getUserData('name')}</span>
          </div>
        </div>
      </div>

      {/* Duplicate Account Alerts */}
      {(userData?.duplicateChecks?.panExists || 
        userData?.duplicateChecks?.bankAccountExists || 
        userData?.duplicateChecks?.mobileExists || 
        userData?.duplicateChecks?.referencePhoneExists) && (
        <div className="bg-red-50 border-l-4 border-red-500 px-6 py-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">Duplicate Account Detected</h3>
              <div className="text-sm text-red-700 space-y-1">
                {userData.duplicateChecks.panExists && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">PAN:</span>
                    <span>Exists in {userData.duplicateChecks.panDuplicateUsers.length} other profile(s)</span>
                    <button
                      onClick={() => {
                        const userIds = userData.duplicateChecks.panDuplicateUsers.map((u: any) => u.id).join(',');
                        window.open(`/admin/users?search=${userIds}`, '_blank');
                      }}
                      className="text-red-800 underline hover:text-red-900"
                    >
                      View
                    </button>
                  </div>
                )}
                {userData.duplicateChecks.bankAccountExists && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Bank Account:</span>
                    <span>Exists in {userData.duplicateChecks.bankAccountDuplicateUsers.length} other profile(s)</span>
                    <button
                      onClick={() => {
                        const userIds = userData.duplicateChecks.bankAccountDuplicateUsers.map((u: any) => u.id).join(',');
                        window.open(`/admin/users?search=${userIds}`, '_blank');
                      }}
                      className="text-red-800 underline hover:text-red-900"
                    >
                      View
                    </button>
                  </div>
                )}
                {userData.duplicateChecks.mobileExists && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Mobile:</span>
                    <span>Exists in {userData.duplicateChecks.mobileDuplicateUsers.length} other profile(s)</span>
                    <button
                      onClick={() => {
                        const userIds = userData.duplicateChecks.mobileDuplicateUsers.map((u: any) => u.id).join(',');
                        window.open(`/admin/users?search=${userIds}`, '_blank');
                      }}
                      className="text-red-800 underline hover:text-red-900"
                    >
                      View
                    </button>
                  </div>
                )}
                {userData.duplicateChecks.referencePhoneExists && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Reference Phone:</span>
                    <span>Matches {userData.duplicateChecks.referencePhoneDuplicateUsers.length} other profile(s)</span>
                    <button
                      onClick={() => {
                        const userIds = userData.duplicateChecks.referencePhoneDuplicateUsers.map((u: any) => u.id).join(',');
                        window.open(`/admin/users?search=${userIds}`, '_blank');
                      }}
                      className="text-red-800 underline hover:text-red-900"
                    >
                      View
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Left: Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-gray-900">
                  {getUserData('name')}
                  {getUserData('clid') && (
                    <span className="ml-2 text-sm font-normal text-gray-500">({getUserData('clid')})</span>
                  )}
                </h1>
                <div className="flex items-center gap-2">
                  {getUserData('profileStatus') && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      getUserData('profileStatus') === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      getUserData('profileStatus') === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                      getUserData('profileStatus') === 'follow_up' ? 'bg-orange-100 text-orange-800' :
                      getUserData('profileStatus') === 'disbursal' ? 'bg-purple-100 text-purple-800' :
                      getUserData('profileStatus') === 'ready_for_disbursement' ? 'bg-indigo-100 text-indigo-800' :
                      getUserData('profileStatus') === 'account_manager' ? 'bg-green-100 text-green-800' :
                      getUserData('profileStatus') === 'cleared' ? 'bg-gray-100 text-gray-800' :
                      getUserData('profileStatus') === 'hold' || getUserData('status') === 'on_hold' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getUserData('profileStatus') === 'account_manager' && getUserData('assignedManager') 
                        ? `Account Manager: ${getUserData('assignedManager')}`
                        : getUserData('profileStatus')?.replace(/_/g, ' ').toUpperCase() || 'ACTIVE'}
                    </span>
                  )}
                  {/* Hold Status Badge */}
                  {(getUserData('status') === 'on_hold' || getUserData('status') === 'hold') && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                      HOLD
                    </span>
                  )}
                  {/* Delete Status Badge */}
                  {getUserData('status') === 'deleted' && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-800 text-white border border-gray-900">
                      DELETED
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {getUserData('clid') && <span>CLID: {getUserData('clid')}</span>}
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {getUserData('mobile')}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {getUserData('email')}
                </span>
                {getUserData('creditScore') && (
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Pocket Score:</span> {getUserData('creditScore')}
                  </span>
                )}
                {(() => {
                  // Calculate Experian score using same logic as credit analytics tab
                  let experianScore = null;
                  
                  // First check creditAnalyticsData (most reliable source)
                  if (creditAnalyticsData) {
                    const { credit_score, full_report } = creditAnalyticsData;
                    const reportData = full_report?.result?.result_json?.INProfileResponse || {};
                    
                    // Check multiple sources for credit score (same logic as credit analytics tab)
                    let displayScore = credit_score;
                    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
                      displayScore = reportData.SCORE?.BureauScore;
                    }
                    if (!displayScore || displayScore === 'N/A' || displayScore === null) {
                      displayScore = reportData?.BureauScore;
                    }
                    if (displayScore && displayScore !== 'N/A' && displayScore !== null) {
                      experianScore = displayScore;
                    }
                  }
                  
                  // Fallback to userData if not found in creditAnalyticsData
                  if (!experianScore || experianScore === 'N/A' || experianScore === null) {
                    experianScore = userData?.experianScore || getUserData('experianScore');
                  }
                  
                  // Always display Experian score if we have any value (including from creditAnalyticsData)
                  if (experianScore !== null && experianScore !== undefined && experianScore !== '') {
                    return (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">Experian:</span> {experianScore}
                      </span>
                    );
                  }
                  return null;
                })()}
                {getUserData('limitVsSalaryPercent') && (
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Limit vs Salary:</span> {getUserData('limitVsSalaryPercent')}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getUserData('status') === 'under_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {getUserData('status')?.replace('_', ' ')?.toUpperCase() || 'N/A'}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  {getUserData('kycStatus')?.toUpperCase() || 'N/A'}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  Score: {getUserData('creditScore')}
                </span>
                {(() => {
                  // Get E-NACH status from latest loan
                  const loans = getArray('loans');
                  const latestLoan = loans && loans.length > 0 ? loans[0] : null;
                  const enachStatus = latestLoan?.enach_status || null;
                  
                  const getEnachStatusDisplay = (status: string | null | undefined) => {
                    if (!status) return 'N/A';
                    const statusMap: { [key: string]: string } = {
                      'ACTIVE': 'Success',
                      'INITIALIZED': 'Initialized',
                      'BANK_APPROVAL_PENDING': 'Bank Approval Pending',
                      'FAILED': 'Failed',
                      'CANCELLED': 'Cancelled',
                      'pending': 'Pending',
                      'registered': 'Registered',
                      'active': 'Active',
                      'failed': 'Failed',
                      'cancelled': 'Cancelled'
                    };
                    return statusMap[status] || status;
                  };
                  
                  const displayStatus = getEnachStatusDisplay(enachStatus);
                  
                  return (
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      displayStatus === 'Success' || displayStatus === 'Active' ? 'bg-green-100 text-green-800' :
                      displayStatus === 'Cancelled' || displayStatus === 'Failed' ? 'bg-red-100 text-red-800' :
                      displayStatus === 'Bank Approval Pending' || displayStatus === 'Initialized' || displayStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      E-NACH Status: {displayStatus}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Right: Key Info */}
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Registered: {formatDate(getUserData('registeredDate'))}</div>
            <div className="text-sm text-gray-600 mb-2">
              Risk: {getUserData('riskCategory')} | Level: {getUserData('memberLevel')}
              {getUserData('loanLimit') > 0 && (
                <span className="ml-2">
                  | Loan Limit: ₹{getUserData('loanLimit').toLocaleString('en-IN')}
                  {canEditUsers && (
                    <button
                      onClick={() => {
                        const newLimit = prompt('Enter new loan limit:', getUserData('loanLimit'));
                        if (newLimit && !isNaN(parseFloat(newLimit))) {
                          handleUpdateLoanLimit(parseFloat(newLimit));
                        }
                      }}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      title="Edit loan limit"
                    >
                      <Edit className="w-3 h-3 inline" />
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex overflow-x-auto scrollbar-hide mobile-scroll">
            <div className="flex space-x-0 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll Indicator for Mobile */}
        <div className="block md:hidden px-6 py-1">
          <div className="flex justify-center">
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              ← Scroll for more tabs →
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {activeTab === 'personal' && renderPersonalTab()}
        {activeTab === 'kyc' && renderKYCTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'bank' && renderBankTab()}
        {activeTab === 'statement-verification' && renderStatementVerificationTab()}
        {activeTab === 'reference' && renderReferenceTab()}
        {activeTab === 'login-data' && renderLoginDataTab()}
        {activeTab === 'accounts' && renderAccountsTab()}
        {activeTab === 'applied-loans' && renderAppliedLoansTab()}
        {activeTab === 'loans' && renderLoansTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'validation' && renderValidationTab()}
        {activeTab === 'credit-analytics' && renderCreditAnalyticsTab()}
        {activeTab === 'follow-up' && renderFollowUpTab()}
        {activeTab === 'notes' && renderNotesTab()}
        {activeTab === 'sms' && renderSmsTab()}
      </div>

      {/* Modals */}
      {renderModals()}
    </div>
  );
}