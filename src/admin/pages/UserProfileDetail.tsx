import { useState, useEffect } from 'react';
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
  Flag
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';




export function UserProfileDetail() {
    const navigate = useNavigate();
  const params = useParams();
  const [activeTab, setActiveTab] = useState('personal');
  const [showBasicInfoModal, setShowBasicInfoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showAddReferenceModal, setShowAddReferenceModal] = useState(false);
  const [showUploadNewModal, setShowUploadNewModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showSendSmsModal, setShowSendSmsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const { canEditUsers } = useAdmin();

  // Real data state
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    alternatePhone: ''
  });
  const [addressInfoForm, setAddressInfoForm] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: ''
  });
  const [employmentInfoForm, setEmploymentInfoForm] = useState({
    company: '',
    designation: '',
    monthlyIncome: '',
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

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const response = await adminApiService.getUserProfile(params.userId!);
        
        if (response.status === 'success') {
          setUserData(response.data);
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
        alternatePhone: ''
      });
    }
  }, [userData, showContactModal]);

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
    try {
      const response = await adminApiService.updateUserAddressInfo(params.userId!, addressInfoForm);
      if (response.status === 'success') {
        alert('Address information updated successfully!');
        setShowAddressModal(false);
      } else {
        alert('Failed to update address information');
      }
    } catch (error) {
      console.error('Error updating address info:', error);
      alert('Error updating address information');
    }
  };

  const handleEmploymentInfoSubmit = async () => {
    try {
      const response = await adminApiService.updateUserEmploymentInfo(params.userId!, {
        ...employmentInfoForm,
        monthlyIncome: parseFloat(employmentInfoForm.monthlyIncome),
        workExperience: parseFloat(employmentInfoForm.workExperience)
      });
      if (response.status === 'success') {
        alert('Employment information updated successfully!');
        setShowEmploymentModal(false);
      } else {
        alert('Failed to update employment information');
      }
    } catch (error) {
      console.error('Error updating employment info:', error);
      alert('Error updating employment information');
    }
  };

  const handleBankDetailsSubmit = async () => {
    try {
      const response = await adminApiService.addBankDetails(params.userId!, bankDetailsForm);
      if (response.status === 'success') {
        alert('Bank details added successfully!');
        setShowAddBankModal(false);
        setBankDetailsForm({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branchName: '' });
      } else {
        alert('Failed to add bank details');
      }
    } catch (error) {
      console.error('Error adding bank details:', error);
      alert('Error adding bank details');
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
        status: 'disbursed',
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
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
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'bank', label: 'Bank Information', icon: CreditCard },
    { id: 'reference', label: 'Reference', icon: Phone },
    { id: 'loans', label: 'All Loans', icon: Building },
    { id: 'transactions', label: 'Transaction Details', icon: IndianRupee },
    { id: 'follow-up', label: 'Follow Up', icon: MessageSquare },
    { id: 'notes', label: 'Note', icon: FileText },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'login-data', label: 'Login Data', icon: Clock },
  ];



  const renderPersonalTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
              {getUserData('personalInfo.age')}Y
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-1">Personal Profile</h3>
          <p className="text-sm font-semibold text-gray-900 mb-1">{getUserData('personalInfo.gender')} • {getUserData('personalInfo.maritalStatus')}</p>
          <p className="text-xs text-gray-500">Member since {formatDate(getUserData('registeredDate'))}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
              VERIFIED
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-1">Contact Info</h3>
          <p className="text-sm font-semibold text-gray-900 mb-1">{getUserData('mobile')}</p>
          <p className="text-xs text-gray-500">{getUserData('email')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
              {getUserData('personalInfo.yearsAtCurrentAddress')}Y
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-1">Address</h3>
          <p className="text-sm font-semibold text-gray-900 mb-1">{getUserData('personalInfo.city')}, {getUserData('personalInfo.state')}</p>
          <p className="text-xs text-gray-500">{getUserData('personalInfo.residenceType')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
              {getUserData('personalInfo.totalExperience')}
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-1">Employment</h3>
          <p className="text-sm font-semibold text-gray-900 mb-1">{getUserData('personalInfo.employment')}</p>
          <p className="text-xs text-gray-500">{formatCurrency(getUserData('personalInfo.monthlyIncome'))}/month</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
              {getArray('documents').filter(doc => doc.status === 'verified').length}/{getArray('documents').length}
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-1">Documents</h3>
          <p className="text-sm font-semibold text-gray-900 mb-1">{getArray('documents').length} Uploaded</p>
          <p className="text-xs text-gray-500">{getArray('documents').filter(doc => doc.status === 'verified').length} Verified</p>
        </div>
      </div>

      {/* Detailed Information Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Basic Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            {canEditUsers && (
              <button
                onClick={() => setShowBasicInfoModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-gray-900 font-medium">{getUserData('name')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Customer ID</label>
                <p className="text-gray-900 font-mono">{getUserData('clid')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                <p className="text-gray-900">{formatDate(getUserData('personalInfo.dateOfBirth'))}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Age</label>
                <p className="text-gray-900">{getUserData('personalInfo.age')} years</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Gender</label>
                <p className="text-gray-900">{getUserData('personalInfo.gender')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Marital Status</label>
                <p className="text-gray-900">{getUserData('personalInfo.maritalStatus')}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Education</label>
              <p className="text-gray-900">{getUserData('personalInfo.education')}</p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            {canEditUsers && (
              <button
                onClick={() => setShowContactModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Primary Mobile</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">{getUserData('mobile')}</p>
                <button className="text-blue-600 hover:text-blue-800">
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Alternate Mobile</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">{getUserData('alternatePhone')}</p>
                <button className="text-blue-600 hover:text-blue-800">
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email Address</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">{getUserData('email')}</p>
                <button className="text-blue-600 hover:text-blue-800">
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Family Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Family Information</h3>
          {canEditUsers && (
            <button
              onClick={() => alert('Family information edit modal')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-500">Father's Name</label>
            <p className="text-gray-900">{getUserData('personalInfo.fatherName')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Mother's Name</label>
            <p className="text-gray-900">{getUserData('personalInfo.motherName')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Spouse Name</label>
            <p className="text-gray-900">{getUserData('personalInfo.spouseName')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Number of Dependents</label>
            <p className="text-gray-900">{getUserData('personalInfo.numberOfDependents')} family members</p>
          </div>
        </div>
      </div>

      {/* Address & Employment in Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Address Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
            {canEditUsers && (
              <button
                onClick={() => setShowAddressModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Current Address</label>
              <p className="text-gray-900">{getUserData('personalInfo.address')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="text-gray-900">{getUserData('personalInfo.city')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">State</label>
                <p className="text-gray-900">{getUserData('personalInfo.state')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Pincode</label>
                <p className="text-gray-900">{getUserData('personalInfo.pincode')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Landmark</label>
                <p className="text-gray-900">{getUserData('personalInfo.landmark')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Residence Type</label>
                <p className="text-gray-900">{getUserData('personalInfo.residenceType')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Years at Address</label>
                <p className="text-gray-900">{getUserData('personalInfo.yearsAtCurrentAddress')} years</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Employment Information</h3>
            {canEditUsers && (
              <button
                onClick={() => setShowEmploymentModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Designation</label>
              <p className="text-gray-900">{getUserData('personalInfo.employment')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Company</label>
              <p className="text-gray-900">{getUserData('personalInfo.company')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Company Address</label>
              <p className="text-gray-900">{getUserData('personalInfo.companyAddress')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Current Experience</label>
                <p className="text-gray-900">{getUserData('personalInfo.workExperience')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Experience</label>
                <p className="text-gray-900">{getUserData('personalInfo.totalExperience')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Monthly Income</label>
                <p className="text-gray-900 font-semibold text-green-600">{formatCurrency(getUserData('personalInfo.monthlyIncome'))}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Other Income</label>
                <p className="text-gray-900">{formatCurrency(getUserData('personalInfo.otherIncome'))}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'verified' ? 'bg-green-100 text-green-800' :
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
                    <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm px-3 py-1.5 border border-blue-200 rounded-md hover:bg-blue-50">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-3 py-1.5 border border-green-200 rounded-md hover:bg-green-50">
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

  // Bank Information Tab
  const renderBankTab = () => (
    <div className="space-y-6">
      {/* Bank Account Details Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bank Account Details</h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAddBankModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Bank Details
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Verification Status</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                getUserData('bankInfo.verificationStatus') === 'verified' ? 'bg-green-100 text-green-800' :
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
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
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Admin Actions:</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-4 py-2 bg-green-50 border border-green-200 rounded-md hover:bg-green-100">
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm px-4 py-2 bg-red-50 border border-red-200 rounded-md hover:bg-red-100">
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm px-4 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100">
                <MessageSquare className="w-4 h-4" />
                Add Comment
              </button>
            </div>
          </div>
        </div>

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

  // Reference Tab
  const renderReferenceTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Reference Details</h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAddReferenceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Reference
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
              {getArray('references').filter(ref => ref.verificationStatus === 'verified').length} of {getArray('references').length} verified
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {getArray('references').map((ref, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{ref.name}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  ref.verificationStatus === 'verified' ? 'bg-green-100 text-green-800' :
                  ref.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  ref.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {ref.verificationStatus}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-600">Relationship:</span> {ref.relationship}
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span> {ref.phone}
                </div>
                <div>
                  <span className="text-gray-600">Email:</span> {ref.email}
                </div>
                <div>
                  <span className="text-gray-600">Address:</span> {ref.address}
                </div>
              </div>

              {/* Admin Actions for Reference */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm px-3 py-1.5 border border-blue-200 rounded-md hover:bg-blue-50">
                    <Phone className="w-4 h-4" />
                    Call
                  </button>
                  <button className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-3 py-1.5 border border-green-200 rounded-md hover:bg-green-50">
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  {ref.verificationStatus !== 'verified' && (
                    <>
                      <button className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm px-3 py-1.5 bg-green-50 border border-green-200 rounded-md hover:bg-green-100">
                        <CheckCircle className="w-4 h-4" />
                        Verify
                      </button>
                      <button className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100">
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}
                  <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100">
                    <MessageSquare className="w-4 h-4" />
                    Note
                  </button>
                </div>
              </div>

              {/* Verification Status Messages */}
              {ref.verificationStatus === 'verified' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Verified by Admin on {ref.verifiedDate || '2025-01-15'}</span>
                  </div>
                  {ref.feedback && (
                    <p className="text-sm text-green-600 mt-2">{ref.feedback}</p>
                  )}
                </div>
              )}

              {ref.verificationStatus === 'rejected' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <XCircle className="w-4 h-4" />
                    <span>Rejected on {ref.rejectedDate || '2025-01-15'}</span>
                  </div>
                  {ref.rejectionReason && (
                    <p className="text-sm text-red-600 mt-2">Reason: {ref.rejectionReason}</p>
                  )}
                </div>
              )}

              {ref.verificationStatus === 'pending' && ref.feedback && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <Clock className="w-4 h-4" />
                    <span>Pending verification - Last contacted: {ref.contactedDate || '2025-01-15'}</span>
                  </div>
                  <p className="text-sm text-yellow-600 mt-2">{ref.feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

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

  // Loans Tab
  const renderLoansTab = () => (
    <div className="space-y-6">
      {/* Loan Application Review Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">All Loans</h3>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>


        {/* Loans Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PF%</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Int%</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disb Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Period</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P.Fee</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apply Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('loans').map((loan, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loan.loanId}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(loan.principalAmount || loan.amount)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.processingFeePercent || '2.5'}%
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.interestRate || '12.5'}%
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(loan.disbursedAmount || loan.amount)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.timePeriod || '12'} months
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(loan.processingFee || (loan.amount * 0.025))}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(loan.gst || (loan.amount * 0.025 * 0.18))}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(loan.interest || (loan.amount * 0.125))}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(loan.totalAmount || (loan.amount + (loan.amount * 0.125) + (loan.amount * 0.025) + (loan.amount * 0.025 * 0.18)))}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(loan.appliedDate || loan.createdAt)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.reason || 'Personal Loan'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                      loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      loan.status === 'disbursed' ? 'bg-blue-100 text-blue-800' :
                      loan.status === 'active' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(loan.statusDate || loan.updatedAt)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button 
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View Application Details"
                        onClick={() => handleViewApplication(loan.loanId)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {loan.status === 'pending' || loan.status === 'under_review' ? (
                        <>
                          <button 
                            className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                            title="Approve Application"
                            onClick={() => handleApproveLoan(loan.loanId)}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                            title="Reject Application"
                            onClick={() => handleRejectLoan(loan.loanId)}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button 
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                          title="Edit Application"
                          onClick={() => handleEditLoan(loan.loanId)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );

  // Transactions Tab
  const renderTransactionsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
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
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference No</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('transactions').map((txn, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {txn.transactionId || `TXN${String(index + 1).padStart(6, '0')}`}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                        txn.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {txn.type === 'credit' ? 
                          <TrendingUp className="w-3 h-3 text-green-600" /> :
                          <TrendingDown className="w-3 h-3 text-red-600" />
                        }
                      </div>
                      <span className={`text-sm font-medium ${
                        txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.type?.toUpperCase() || 'DEBIT'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.description}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <span className={`${
                      txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.paymentMethod || 'Bank Transfer'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {txn.referenceNo || 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase()}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(txn.date)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.time || '09:15 AM'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      txn.status === 'completed' ? 'bg-green-100 text-green-800' :
                      txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      txn.status === 'failed' ? 'bg-red-100 text-red-800' :
                      txn.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(txn.balance || (500000 - (index * 15000)))}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <XCircle className="w-4 h-4" />
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
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Total Credits</p>
                <p className="text-2xl font-semibold text-green-900">
                  {formatCurrency(getArray('transactions').filter(txn => txn.type === 'credit').reduce((sum, txn) => sum + txn.amount, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Total Debits</p>
                <p className="text-2xl font-semibold text-red-900">
                  {formatCurrency(getArray('transactions').filter(txn => txn.type === 'debit').reduce((sum, txn) => sum + txn.amount, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <IndianRupee className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Current Balance</p>
                <p className="text-2xl font-semibold text-blue-900">
                  {formatCurrency(getArray('transactions').reduce((balance, txn) => 
                    balance + (txn.type === 'credit' ? txn.amount : -txn.amount), 500000))}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Pending</p>
                <p className="text-2xl font-semibold text-purple-900">
                  {getArray('transactions').filter(txn => txn.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getArray('followUpNotes').map((note, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {note.followUpId || `FU${String(index + 1).padStart(6, '0')}`}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.type === 'call' ? 'bg-blue-100 text-blue-800' :
                      note.type === 'email' ? 'bg-green-100 text-green-800' :
                      note.type === 'sms' ? 'bg-yellow-100 text-yellow-800' :
                      note.type === 'visit' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {note.type?.toUpperCase() || 'CALL'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.priority === 'high' ? 'bg-red-100 text-red-800' :
                      note.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      note.priority === 'low' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {note.priority?.toUpperCase() || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.subject || 'Follow Up Required'}
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
                    {formatDate(note.dueDate || note.date)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.status === 'completed' ? 'bg-green-100 text-green-800' :
                      note.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      note.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      note.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {note.status || 'PENDING'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(note.lastUpdated || note.date)}
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
                <p className="text-sm font-medium text-blue-600">Total Follow Ups</p>
                <p className="text-2xl font-semibold text-blue-900">{getUserData('followUpNotes')?.length || 0}</p>
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
                  {getArray('followUpNotes').filter(note => note.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-2xl font-semibold text-green-900">
                  {getArray('followUpNotes').filter(note => note.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-2xl font-semibold text-red-900">
                  {getArray('followUpNotes').filter(note => note.status === 'overdue').length}
                </p>
              </div>
            </div>
          </div>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.category === 'credit' ? 'bg-green-100 text-green-800' :
                      note.category === 'verification' ? 'bg-blue-100 text-blue-800' :
                      note.category === 'risk' ? 'bg-red-100 text-red-800' :
                      note.category === 'general' ? 'bg-gray-100 text-gray-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {note.category?.toUpperCase() || 'GENERAL'}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.priority === 'high' ? 'bg-red-100 text-red-800' :
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      note.status === 'active' ? 'bg-green-100 text-green-800' :
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sms.type === 'notification' ? 'bg-blue-100 text-blue-800' :
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sms.status === 'sent' ? 'bg-green-100 text-green-800' :
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
                    onChange={(e) => setBasicInfoForm({...basicInfoForm, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input 
                    type="text" 
                    value={basicInfoForm.lastName}
                    onChange={(e) => setBasicInfoForm({...basicInfoForm, lastName: e.target.value})}
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
                    onChange={(e) => setBasicInfoForm({...basicInfoForm, dateOfBirth: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input 
                    type="text" 
                    value={basicInfoForm.panNumber}
                    onChange={(e) => setBasicInfoForm({...basicInfoForm, panNumber: e.target.value})}
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
                  onChange={(e) => setContactInfoForm({...contactInfoForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
                <input 
                  type="tel" 
                  value={contactInfoForm.alternatePhone}
                  onChange={(e) => setContactInfoForm({...contactInfoForm, alternatePhone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter alternate mobile"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={contactInfoForm.email}
                  onChange={(e) => setContactInfoForm({...contactInfoForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
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
              <h4 className="text-lg font-semibold text-gray-900">Edit Address Information</h4>
              <button 
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea 
                  defaultValue={getUserData('personalInfo.address')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.city')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.state')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.pincode')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.landmark')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Residence Type</label>
                  <select 
                    defaultValue={getUserData('personalInfo.residenceType')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Owned">Owned</option>
                    <option value="Rented">Rented</option>
                    <option value="Family Owned">Family Owned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years at Address</label>
                  <input 
                    type="number" 
                    defaultValue={getUserData('personalInfo.yearsAtCurrentAddress')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    alert('Address information updated successfully!');
                    setShowAddressModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowAddressModal(false)}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.employment')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.company')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                <textarea 
                  defaultValue={getUserData('personalInfo.companyAddress')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Experience</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.workExperience')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience</label>
                  <input 
                    type="text" 
                    defaultValue={getUserData('personalInfo.totalExperience')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income</label>
                  <input 
                    type="number" 
                    defaultValue={getUserData('personalInfo.monthlyIncome')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Income</label>
                  <input 
                    type="number" 
                    defaultValue={getUserData('personalInfo.otherIncome')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    alert('Employment information updated successfully!');
                    setShowEmploymentModal(false);
                  }}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  placeholder="Enter document title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    multiple
                  />
                  <label htmlFor="document-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">PDF, JPG, PNG up to 10MB</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Document Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea 
                  placeholder="Add any additional notes about this document"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Priority Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Document uploaded successfully!');
                    setShowUploadNewModal(false);
                    setDocumentType('');
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Upload Document
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadNewModal(false);
                    setDocumentType('');
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
                    alert('Bank details added successfully!');
                    setShowAddBankModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Bank Details
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
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
            
            <form className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input 
                    type="text" 
                    placeholder="Enter full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relationship *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Relationship</option>
                    <option value="family">Family Member</option>
                    <option value="friend">Friend</option>
                    <option value="colleague">Colleague</option>
                    <option value="neighbor">Neighbor</option>
                    <option value="relative">Relative</option>
                    <option value="acquaintance">Acquaintance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number *</label>
                  <input 
                    type="tel" 
                    placeholder="Enter mobile number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Professional Information */}
              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-900 mb-3">Professional Information</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Occupation</label>
                    <input 
                      type="text" 
                      placeholder="Enter occupation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company/Organization</label>
                    <input 
                      type="text" 
                      placeholder="Enter company name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Work Address</label>
                  <textarea 
                    placeholder="Enter work address"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Contact Preferences */}
              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-900 mb-3">Contact Preferences</h5>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="prefer-call"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="prefer-call" className="ml-2 text-sm text-gray-700">
                      Prefer phone calls for verification
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="prefer-sms"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="prefer-sms" className="ml-2 text-sm text-gray-700">
                      Prefer SMS for verification
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="prefer-email"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="prefer-email" className="ml-2 text-sm text-gray-700">
                      Prefer email for verification
                    </label>
                  </div>
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
                      <option value="call">Phone Call</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="visit">Personal Visit</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                <textarea 
                  placeholder="Add any additional notes about this reference"
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
                    alert('Reference added successfully!');
                    setShowAddReferenceModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Reference
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddReferenceModal(false)}
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
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Transaction</h4>
              <button 
                onClick={() => setShowAddTransactionModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="space-y-4">
              {/* Transaction Type and Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Transaction Type</option>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="emi_payment">EMI Payment</option>
                    <option value="loan_disbursement">Loan Disbursement</option>
                    <option value="refund">Refund</option>
                    <option value="penalty">Penalty</option>
                    <option value="interest">Interest</option>
                    <option value="processing_fee">Processing Fee</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Description and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <input 
                    type="text" 
                    placeholder="Enter transaction description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Category</option>
                    <option value="loan">Loan Related</option>
                    <option value="emi">EMI Payment</option>
                    <option value="fee">Fees & Charges</option>
                    <option value="penalty">Penalty</option>
                    <option value="refund">Refund</option>
                    <option value="interest">Interest</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Payment Method and Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Payment Method</option>
                    <option value="upi">UPI</option>
                    <option value="net_banking">Net Banking</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="neft">NEFT</option>
                    <option value="rtgs">RTGS</option>
                    <option value="imps">IMPS</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
                  <input 
                    type="text" 
                    placeholder="Enter reference number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Date *</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Time</label>
                  <input 
                    type="time" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="processing">Processing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Bank Details */}
              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-900 mb-3">Bank Details</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                    <input 
                      type="text" 
                      placeholder="Enter bank name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                    <input 
                      type="text" 
                      placeholder="Enter account number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                <textarea 
                  placeholder="Add any additional notes about this transaction"
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
                    alert('Transaction added successfully!');
                    setShowAddTransactionModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTransactionModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
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
            
            <form className="space-y-4">
              {/* Follow Up Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Follow Up Type *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Follow Up Type</option>
                    <option value="call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="visit">Personal Visit</option>
                    <option value="meeting">Meeting</option>
                    <option value="document_request">Document Request</option>
                    <option value="verification">Verification</option>
                    <option value="payment_reminder">Payment Reminder</option>
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

              {/* Subject and Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <input 
                  type="text" 
                  placeholder="Enter follow up subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea 
                  placeholder="Enter detailed description of the follow up"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Assignment and Scheduling */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To *</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Assignee</option>
                    <option value="admin1">Admin User 1</option>
                    <option value="admin2">Admin User 2</option>
                    <option value="manager1">Manager 1</option>
                    <option value="officer1">Officer 1</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="self">Self</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Time and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
                  <input 
                    type="time" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Duration (minutes)</label>
                  <input 
                    type="number" 
                    placeholder="e.g., 30"
                    min="5"
                    max="480"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Contact Method and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Method</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Contact Method</option>
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="in_person">In Person</option>
                    <option value="video_call">Video Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                </div>
              </div>

              {/* Reminder Settings */}
              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-900 mb-3">Reminder Settings</h5>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="reminder-1day"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reminder-1day" className="ml-2 text-sm text-gray-700">
                      Remind 1 day before due date
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="reminder-1hour"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reminder-1hour" className="ml-2 text-sm text-gray-700">
                      Remind 1 hour before scheduled time
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="reminder-overdue"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reminder-overdue" className="ml-2 text-sm text-gray-700">
                      Send overdue reminder if not completed
                    </label>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                <textarea 
                  placeholder="Add any additional notes or special instructions"
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
                    alert('Follow up added successfully!');
                    setShowAddFollowUpModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Follow Up
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddFollowUpModal(false)}
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

      {/* Simplified Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Left: Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{getUserData('name')}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>CLID: {getUserData('clid')}</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {getUserData('mobile')}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {getUserData('email')}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  getUserData('status') === 'under_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {getUserData('status')?.replace('_', ' ')?.toUpperCase() || 'N/A'}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  {getUserData('kycStatus')?.toUpperCase() || 'N/A'}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  Score: {getUserData('creditScore')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Key Info */}
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Registered: {formatDate(getUserData('registeredDate'))}</div>
            <div className="text-sm text-gray-600 mb-2">Risk: {getUserData('riskCategory')} | Level: {getUserData('memberLevel')}</div>
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
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                      activeTab === tab.id
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
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'bank' && renderBankTab()}
        {activeTab === 'reference' && renderReferenceTab()}
        {activeTab === 'login-data' && renderLoginDataTab()}
        {activeTab === 'loans' && renderLoansTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'follow-up' && renderFollowUpTab()}
        {activeTab === 'notes' && renderNotesTab()}
        {activeTab === 'sms' && renderSmsTab()}
      </div>

      {/* Modals */}
      {renderModals()}
    </div>
  );
}