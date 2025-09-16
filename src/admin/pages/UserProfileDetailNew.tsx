import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
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
  Save,
  X,
  Plus,
  MessageSquare,
  Clock,
  Building,
  Badge,
  Star,
  AlertTriangle,
  Eye,
  Send,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  Briefcase,
  Home,
  Users,
  FileCheck,
  Activity,
  Smartphone,
  Monitor,
  RefreshCw,
  Filter,
  Search,
  ExternalLink,
  Copy,
  UserCheck,
  UserX,
  Calendar as CalendarIcon,
  Info
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { Logo } from '../../components/Logo';
import type { AdminPage, AdminUser } from '../../AdminApp';

interface UserProfileDetailProps {
  userId: string;
}

export function UserProfileDetail({ userId }: UserProfileDetailProps) {
  const { currentUser } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  const [followUpNote, setFollowUpNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showBasicInfoModal, setShowBasicInfoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const { canEditUsers, canApproveLoans, canRejectLoans } = useAdmin();

  // Enhanced mock user data with much more detail
  const userData = {
    id: userId,
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
      primaryBank: 'HDFC Bank',
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
      networth: 850000
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
        feedback: 'Confirmed employment and character. Positive reference.'
      },
      {
        name: 'Suresh Kumar',
        relationship: 'Colleague',
        phone: '+91 88776 65544',
        email: 'suresh.kumar@tcs.com',
        address: 'Electronic City, Bangalore',
        verificationStatus: 'pending',
        contactedDate: null,
        feedback: null
      }
    ]
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

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'bank', label: 'Bank Information', icon: CreditCard },
    { id: 'reference', label: 'Reference', icon: Phone },
    { id: 'login-data', label: 'Login Data', icon: Clock },
    { id: 'loans', label: 'All Loans', icon: Building },
    { id: 'transactions', label: 'Transaction Details', icon: DollarSign },
    { id: 'validation', label: 'Validation', icon: CheckCircle },
    { id: 'follow-up', label: 'Follow Up', icon: MessageSquare },
    { id: 'notes', label: 'Note', icon: FileText },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'cibil', label: 'CIBIL ANALYSIS', icon: Star },
    { id: 'pan', label: 'PAN ANALYSIS', icon: Badge },
  ];

  const renderPersonalTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded">
              {userData.personalInfo.age}Y
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Personal Profile</h3>
          <p className="text-sm text-gray-600 mb-3">{userData.personalInfo.gender} • {userData.personalInfo.maritalStatus}</p>
          <p className="text-xs text-gray-500">Member since {formatDate(userData.registeredDate)}</p>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded">
              VERIFIED
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Contact Info</h3>
          <p className="text-sm text-gray-600 mb-1">{userData.mobile}</p>
          <p className="text-xs text-gray-500">{userData.email}</p>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
              <MapPin className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded">
              {userData.personalInfo.yearsAtCurrentAddress}Y
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
          <p className="text-sm text-gray-600 mb-1">{userData.personalInfo.city}, {userData.personalInfo.state}</p>
          <p className="text-xs text-gray-500">{userData.personalInfo.residenceType}</p>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-orange-600 bg-orange-200 px-2 py-1 rounded">
              {userData.personalInfo.totalExperience}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Employment</h3>
          <p className="text-sm text-gray-600 mb-1">{userData.personalInfo.employment}</p>
          <p className="text-xs text-gray-500">{formatCurrency(userData.personalInfo.monthlyIncome)}/month</p>
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
                <p className="text-gray-900 font-medium">{userData.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Customer ID</label>
                <p className="text-gray-900 font-mono">{userData.clid}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                <p className="text-gray-900">{formatDate(userData.personalInfo.dateOfBirth)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Age</label>
                <p className="text-gray-900">{userData.personalInfo.age} years</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Gender</label>
                <p className="text-gray-900">{userData.personalInfo.gender}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Marital Status</label>
                <p className="text-gray-900">{userData.personalInfo.maritalStatus}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Education</label>
              <p className="text-gray-900">{userData.personalInfo.education}</p>
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
                <p className="text-gray-900">{userData.mobile}</p>
                <button className="text-blue-600 hover:text-blue-800">
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Alternate Mobile</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">{userData.alternatePhone}</p>
                <button className="text-blue-600 hover:text-blue-800">
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email Address</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">{userData.email}</p>
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
            <p className="text-gray-900">{userData.personalInfo.fatherName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Mother's Name</label>
            <p className="text-gray-900">{userData.personalInfo.motherName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Spouse Name</label>
            <p className="text-gray-900">{userData.personalInfo.spouseName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Number of Dependents</label>
            <p className="text-gray-900">{userData.personalInfo.numberOfDependents} family members</p>
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
              <p className="text-gray-900">{userData.personalInfo.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="text-gray-900">{userData.personalInfo.city}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">State</label>
                <p className="text-gray-900">{userData.personalInfo.state}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Pincode</label>
                <p className="text-gray-900">{userData.personalInfo.pincode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Landmark</label>
                <p className="text-gray-900">{userData.personalInfo.landmark}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Residence Type</label>
                <p className="text-gray-900">{userData.personalInfo.residenceType}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Years at Address</label>
                <p className="text-gray-900">{userData.personalInfo.yearsAtCurrentAddress} years</p>
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
              <p className="text-gray-900">{userData.personalInfo.employment}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Company</label>
              <p className="text-gray-900">{userData.personalInfo.company}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Company Address</label>
              <p className="text-gray-900">{userData.personalInfo.companyAddress}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Current Experience</label>
                <p className="text-gray-900">{userData.personalInfo.workExperience}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Experience</label>
                <p className="text-gray-900">{userData.personalInfo.totalExperience}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Monthly Income</label>
                <p className="text-gray-900 font-semibold text-green-600">{formatCurrency(userData.personalInfo.monthlyIncome)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Other Income</label>
                <p className="text-gray-900">{formatCurrency(userData.personalInfo.otherIncome)}</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Basic Information</h4>
              <button 
                onClick={() => setShowBasicInfoModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    defaultValue={userData.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input 
                    type="date" 
                    defaultValue={userData.personalInfo.dateOfBirth}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select 
                    defaultValue={userData.personalInfo.gender}
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
                    defaultValue={userData.personalInfo.maritalStatus}
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
                  defaultValue={userData.personalInfo.education}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    alert('Basic information updated successfully!');
                    setShowBasicInfoModal(false);
                  }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Contact Information</h4>
              <button 
                onClick={() => setShowContactModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Mobile</label>
                <input 
                  type="tel" 
                  defaultValue={userData.mobile}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
                <input 
                  type="tel" 
                  defaultValue={userData.alternatePhone}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  defaultValue={userData.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    alert('Contact information updated successfully!');
                    setShowContactModal(false);
                  }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Address Information</h4>
              <button 
                onClick={() => setShowAddressModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea 
                  defaultValue={userData.personalInfo.address}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.city}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.state}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.pincode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.landmark}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Residence Type</label>
                  <select 
                    defaultValue={userData.personalInfo.residenceType}
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
                    defaultValue={userData.personalInfo.yearsAtCurrentAddress}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Employment Information</h4>
              <button 
                onClick={() => setShowEmploymentModal(false)}
                className="text-gray-500 hover:text-gray-700"
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
                    defaultValue={userData.personalInfo.employment}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.company}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                <textarea 
                  defaultValue={userData.personalInfo.companyAddress}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Experience</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.workExperience}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience</label>
                  <input 
                    type="text" 
                    defaultValue={userData.personalInfo.totalExperience}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income</label>
                  <input 
                    type="number" 
                    defaultValue={userData.personalInfo.monthlyIncome}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Income</label>
                  <input 
                    type="number" 
                    defaultValue={userData.personalInfo.otherIncome}
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
    </>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/applications')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Applications
          </button>
          <div className="flex items-center gap-2">
            <Logo size="sm" variant="default" />
            <span className="font-semibold text-gray-900">User Profile Detail - {userData.name}</span>
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
              <h1 className="text-xl font-bold text-gray-900">{userData.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>CLID: {userData.clid}</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {userData.mobile}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {userData.email}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  userData.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {userData.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  {userData.kycStatus.toUpperCase()}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  Score: {userData.creditScore}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Key Info */}
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Registered: {formatDate(userData.registeredDate)}</div>
            <div className="text-sm text-gray-600 mb-2">Risk: {userData.riskCategory} | Level: {userData.memberLevel}</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {activeTab === 'personal' && renderPersonalTab()}
        {activeTab !== 'personal' && (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
            <p>This section is under development</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {renderModals()}
    </div>
  );
}