import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Shield,
  UserCheck,
  UserX,
  MoreHorizontal,
  Calendar,
  X,
  Eye,
  Settings,
  Users,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  Filter,
  RefreshCw,
  Loader2,
  Key
} from 'lucide-react';
import { adminApiService } from '../../services/adminApi';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  status?: 'active' | 'inactive';
  is_active?: boolean;
  lastLogin?: string;
  last_login?: string;
  createdAt?: string;
  created_at?: string;
  phone?: string;
  department?: string;
  sub_admin_category?: string | null;
  whitelisted_ip?: string | null;
  weekly_off_days?: string | number[] | null;
  temp_inactive_from?: string | null;
  temp_inactive_to?: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  type: string;
  metadata: any;
  timestamp: string;
  priority: string;
  ip_address?: string;
  user_agent?: string;
}

export function AdminTeamManagement() {
  const navigate = useNavigate();
  const params = useParams();

  // Format date as DD/MM/YYYY without timezone conversion
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

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignCategory, setReassignCategory] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    superadmin: 0,
    manager: 0,
    officer: 0,
    active: 0,
    inactive: 0
  });
  const [activityData, setActivityData] = useState<{
    activities: ActivityLog[];
    stats: { today: number; week: number; month: number };
  } | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Change password state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'officer',
    permissions: [] as string[],
    phone: '',
    department: '',
    sub_admin_category: '' as string,
    whitelisted_ip: ''
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'officer',
    permissions: [] as string[],
    phone: '',
    department: '',
    is_active: true,
    sub_admin_category: '' as string,
    whitelisted_ip: '',
    weekly_off_days: [] as number[],
    temp_inactive_from: '',
    temp_inactive_to: ''
  });

  const [permissionsFormData, setPermissionsFormData] = useState<string[]>([]);

  const availablePermissions = [
    { id: 'approve_loans', label: 'Approve Loans', description: 'Can approve loan applications' },
    { id: 'reject_loans', label: 'Reject Loans', description: 'Can reject loan applications' },
    { id: 'view_users', label: 'View Users', description: 'Can view user profiles and data' },
    { id: 'edit_users', label: 'Edit Users', description: 'Can edit user information' },
    { id: 'edit_loans', label: 'Edit Loans', description: 'Can modify loan details' },
    { id: 'view_loans', label: 'View Loans', description: 'Can view loan applications' },
    { id: 'add_notes', label: 'Add Notes', description: 'Can add notes to user profiles' },
    { id: 'follow_up', label: 'Follow Up', description: 'Can add follow-up entries' },
    { id: 'manage_officers', label: 'Manage Officers', description: 'Can manage officer accounts' },
    { id: 'view_analytics', label: 'View Analytics', description: 'Can access analytics dashboard' },
    { id: 'export_data', label: 'Export Data', description: 'Can export reports and data' }
  ];

  // Fetch team members
  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApiService.getTeamMembers(1, 100, {
        role: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchTerm || undefined
      });

      if (response.status === 'success' && response.data) {
        const transformedMembers = response.data.admins.map((admin: any) => ({
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions || [],
          status: admin.is_active ? 'active' : 'inactive',
          is_active: admin.is_active,
          lastLogin: admin.last_login,
          createdAt: admin.created_at,
          phone: admin.phone,
          department: admin.department,
          sub_admin_category: admin.sub_admin_category ?? null,
          whitelisted_ip: admin.whitelisted_ip ?? null,
          weekly_off_days: admin.weekly_off_days ?? null,
          temp_inactive_from: admin.temp_inactive_from ?? null,
          temp_inactive_to: admin.temp_inactive_to ?? null
        }));
        setTeamMembers(transformedMembers);
      }
    } catch (err: any) {
      console.error('Failed to fetch team members:', err);
      setError(err.message || 'Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  // Fetch team statistics
  const fetchStats = async () => {
    try {
      const response = await adminApiService.getTeamStats();
      if (response.status === 'success' && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch activity for a user
  const fetchActivity = async (userId: string) => {
    try {
      setLoadingActivity(true);
      const response = await adminApiService.getTeamMemberActivity(userId, 50);
      if (response.status === 'success' && response.data) {
        setActivityData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
    fetchStats();
  }, []);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchTeamMembers();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'officer':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 0=Sun, 1=Mon, ... 6=Sat. Mirrors backend leave logic (local calendar date).
  const isOnLeaveToday = (member: AdminUser): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (member.weekly_off_days) {
      const days = Array.isArray(member.weekly_off_days)
        ? member.weekly_off_days
        : String(member.weekly_off_days).split(',').map(d => parseInt(String(d).trim(), 10)).filter(n => !Number.isNaN(n));
      if (days.includes(dayOfWeek)) return true;
    }

    if (member.temp_inactive_from || member.temp_inactive_to) {
      const from = member.temp_inactive_from ? String(member.temp_inactive_from).slice(0, 10) : null;
      const to = member.temp_inactive_to ? String(member.temp_inactive_to).slice(0, 10) : null;

      if (from && to) {
        if (todayStr >= from && todayStr <= to) return true;
      } else if (from && !to) {
        if (todayStr >= from) return true;
      } else if (!from && to) {
        if (todayStr <= to) return true;
      }
    }

    return false;
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'superadmin':
      case 'super_admin':
        return ['*'];
      case 'manager':
      case 'master_admin':
        return ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers', 'view_analytics'];
      case 'officer':
        return ['view_loans', 'view_users', 'add_notes', 'follow_up'];
      case 'nbfc_admin':
      case 'sub_admin':
        return ['view_loans', 'view_users'];
      default:
        return [];
    }
  };

  const SUB_ADMIN_CATEGORIES = [
    { value: 'verify_user', label: 'Verify User' },
    { value: 'qa_user', label: 'QA User' },
    { value: 'account_manager', label: 'Account Manager' },
    { value: 'follow_up_user', label: 'Follow-up User' },
    { value: 'recovery_officer', label: 'Recovery Officer' },
    { value: 'debt_agency', label: 'Debt Agency' }
  ];

  const REDISTRIBUTE_CATEGORIES = SUB_ADMIN_CATEGORIES.filter(c => c.value !== 'debt_agency');

  const handleRedistribute = async () => {
    if (!reassignCategory) return;
    try {
      setReassigning(true);
      setError(null);
      const response = await adminApiService.redistributeSubAdminAssignments(reassignCategory);
      if (response.status === 'success') {
        setShowReassignModal(false);
        setReassignCategory('');
        await fetchTeamMembers();
        if (typeof (window as any).toast?.success === 'function') {
          (window as any).toast.success(response.message || 'Assignments redistributed.');
        } else {
          alert(response.message || 'Assignments redistributed.');
        }
      } else {
        setError((response as any).message || 'Redistribution failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to redistribute');
    } finally {
      setReassigning(false);
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('Name, email, and password are required');
      return;
    }
    if (newUser.role === 'sub_admin' && !newUser.sub_admin_category) {
      setError('Sub-admin category is required for Sub-admin role');
      return;
    }
    if (newUser.role === 'sub_admin' && newUser.sub_admin_category === 'follow_up_user' && !newUser.phone) {
      setError('Phone number is required for Follow-up User (mobile OTP login only)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        permissions: newUser.permissions.length > 0 ? newUser.permissions : getRolePermissions(newUser.role),
        phone: newUser.phone || undefined,
        department: newUser.department || undefined
      };
      if (newUser.role === 'sub_admin') {
        payload.sub_admin_category = newUser.sub_admin_category || null;
        // Whitelisted IP for debt_agency and follow_up_user
        if (newUser.sub_admin_category === 'debt_agency' || newUser.sub_admin_category === 'follow_up_user') {
          payload.whitelisted_ip = newUser.whitelisted_ip || null;
        } else {
          payload.whitelisted_ip = null;
        }
      }
      const response = await adminApiService.createTeamMember(payload);

      if (response.status === 'success') {
        setShowAddModal(false);
        setNewUser({ name: '', email: '', password: '', role: 'officer', permissions: [], phone: '', department: '', sub_admin_category: '', whitelisted_ip: '' });
        await fetchTeamMembers();
        await fetchStats();
      } else {
        setError(response.message || 'Failed to create user');
      }
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    const weeklyOff = user.weekly_off_days;
    const weeklyArr = weeklyOff == null || weeklyOff === ''
      ? []
      : Array.isArray(weeklyOff)
        ? weeklyOff
        : String(weeklyOff).split(',').map(d => parseInt(d.trim(), 10)).filter(n => !Number.isNaN(n));
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      phone: user.phone || '',
      department: user.department || '',
      is_active: user.is_active !== false,
      sub_admin_category: user.sub_admin_category || '',
      whitelisted_ip: user.whitelisted_ip || '',
      weekly_off_days: weeklyArr,
      temp_inactive_from: user.temp_inactive_from ? String(user.temp_inactive_from).slice(0, 10) : '',
      temp_inactive_to: user.temp_inactive_to ? String(user.temp_inactive_to).slice(0, 10) : ''
    });
    setShowEditModal(true);
  };

  const handleOpenChangePassword = (user: AdminUser) => {
    setPasswordUser(user);
    setPasswordForm({
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError(null);
    setShowChangePasswordModal(true);
  };

  const handleChangePassword = async () => {
    if (!passwordUser) return;

    const trimmedPassword = passwordForm.newPassword.trim();
    if (!trimmedPassword || !passwordForm.confirmPassword.trim()) {
      setPasswordError('Both password fields are required');
      return;
    }

    if (trimmedPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (trimmedPassword !== passwordForm.confirmPassword.trim()) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      setPasswordError(null);
      const response = await adminApiService.resetTeamMemberPassword(passwordUser.id, trimmedPassword);

      if (response.status === 'success') {
        setShowChangePasswordModal(false);
        setPasswordUser(null);
        setPasswordForm({ newPassword: '', confirmPassword: '' });

        const message = response.message || 'Password updated successfully';
        if (typeof (window as any).toast?.success === 'function') {
          (window as any).toast.success(message);
        } else {
          alert(message);
        }
      } else {
        setPasswordError(response.message || 'Failed to update password');
      }
    } catch (err: any) {
      console.error('Failed to update password:', err);
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    // Validate phone for follow_up_user
    if (editFormData.role === 'sub_admin' && editFormData.sub_admin_category === 'follow_up_user' && !editFormData.phone) {
      setError('Phone number is required for Follow-up User (mobile OTP login only)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload: any = { ...editFormData };
      if (payload.role === 'sub_admin') {
        payload.sub_admin_category = payload.sub_admin_category || null;
        // Whitelisted IP for debt_agency and follow_up_user
        if (payload.sub_admin_category === 'debt_agency' || payload.sub_admin_category === 'follow_up_user') {
          payload.whitelisted_ip = payload.whitelisted_ip || null;
        } else {
          payload.whitelisted_ip = null;
        }
      } else {
        payload.sub_admin_category = null;
        payload.whitelisted_ip = null;
      }
      payload.weekly_off_days = editFormData.weekly_off_days.length ? editFormData.weekly_off_days : null;
      payload.temp_inactive_from = editFormData.temp_inactive_from || null;
      payload.temp_inactive_to = editFormData.temp_inactive_to || null;
      const response = await adminApiService.updateTeamMember(editingUser.id, payload);

      if (response.status === 'success') {
        setShowEditModal(false);
        setEditingUser(null);
        await fetchTeamMembers();
        await fetchStats();
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleViewUser = async (user: AdminUser) => {
    setViewingUser(user);
    setShowViewModal(true);
  };

  const handleManagePermissions = (user: AdminUser) => {
    setEditingUser(user);
    setPermissionsFormData(user.permissions || []);
    setShowPermissionsModal(true);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;

    try {
      setSaving(true);
      setError(null);
      const response = await adminApiService.updateTeamMemberPermissions(editingUser.id, permissionsFormData);

      if (response.status === 'success') {
        setShowPermissionsModal(false);
        setEditingUser(null);
        await fetchTeamMembers();
      } else {
        setError(response.message || 'Failed to update permissions');
      }
    } catch (err: any) {
      console.error('Failed to update permissions:', err);
      setError(err.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkActions = () => {
    setShowBulkActionsModal(true);
  };

  const handleViewActivity = async (user: AdminUser) => {
    setViewingUser(user);
    setShowActivityModal(true);
    await fetchActivity(user.id);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await adminApiService.deleteTeamMember(userId);

      if (response.status === 'success') {
        await fetchTeamMembers();
        await fetchStats();
      } else {
        setError(response.message || 'Failed to delete user');
        alert(response.message || 'Failed to delete user');
      }
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setError(err.message || 'Failed to delete user');
      alert(err.message || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      setSaving(true);
      setError(null);
      const response = await adminApiService.toggleTeamMemberStatus(userId);

      if (response.status === 'success') {
        await fetchTeamMembers();
        await fetchStats();
      } else {
        setError(response.message || 'Failed to update user status');
      }
    } catch (err: any) {
      console.error('Failed to toggle user status:', err);
      setError(err.message || 'Failed to update user status');
    } finally {
      setSaving(false);
    }
  };

  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(timestamp);
  };

  const getActivityType = (action: string) => {
    if (action.includes('approved') || action.includes('activated') || action.includes('created')) return 'success';
    if (action.includes('rejected') || action.includes('deleted') || action.includes('deactivated')) return 'warning';
    return 'info';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600">Manage admin accounts, roles, and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchTeamMembers(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleBulkActions}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Users className="w-4 h-4" />
            Bulk Actions
          </button>
          <button
            onClick={() => setShowReassignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors"
            title="Redistribute assignments by sub-admin type"
          >
            <RefreshCw className="w-4 h-4" />
            Reassign
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Team Member
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="master_admin">Master Admin</option>
            <option value="nbfc_admin">NBFC Admin</option>
            <option value="sub_admin">Sub-admin</option>
            <option value="manager">Manager</option>
            <option value="officer">Officer</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading team members...</span>
        </div>
      )}

      {/* Team Members Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                    {member.role === 'sub_admin' && member.sub_admin_category
                      ? SUB_ADMIN_CATEGORIES.find(c => c.value === member.sub_admin_category)?.label || member.sub_admin_category
                      : member.role.replace(/_/g, ' ')}
                  </span>
                </div>
                {member.role === 'sub_admin' && member.sub_admin_category !== 'debt_agency' && isOnLeaveToday(member) && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">On leave</span>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-gray-600 text-sm">Permissions:</span>
                  <div className="flex flex-wrap gap-1">
                    {member.permissions.includes('*') ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        All Permissions
                      </span>
                    ) : (
                      member.permissions.slice(0, 3).map(permission => (
                        <span key={permission} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {availablePermissions.find(p => p.id === permission)?.label || permission}
                        </span>
                      ))
                    )}
                    {member.permissions.length > 3 && !member.permissions.includes('*') && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        +{member.permissions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-1 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleViewUser(member)}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                  title="View Details"
                >
                  <Eye className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleEditUser(member)}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                  title="Edit User"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleManagePermissions(member)}
                  className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs"
                  title="Manage Permissions"
                >
                  <Settings className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleViewActivity(member)}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs"
                  title="View Activity"
                >
                  <Activity className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleOpenChangePassword(member)}
                  className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-xs"
                  title="Change Password"
                >
                  <Key className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleToggleUserStatus(member.id)}
                  disabled={saving}
                  className={`px-2 py-1 rounded text-xs ${member.status === 'active'
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                    } disabled:opacity-50`}
                  title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                >
                  {member.status === 'active' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => handleDeleteUser(member.id)}
                  disabled={saving}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs disabled:opacity-50"
                  title="Delete User"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Members */}
      {!loading && filteredMembers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No team members found</p>
        </div>
      )}

      {/* Add User Modal */}
      {/* Reassign by sub-admin category modal */}
      {showReassignModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Reassign by sub-admin</h4>
              <button
                onClick={() => { setShowReassignModal(false); setReassignCategory(''); }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Redistribute all applications/users for the selected type across all active sub-admins (including newly added). Choose the sub-admin category to reassign.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-admin type</label>
              <select
                value={reassignCategory}
                onChange={(e) => setReassignCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select type</option>
                {REDISTRIBUTE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRedistribute}
                disabled={!reassignCategory || reassigning}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {reassigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  'Reassign'
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowReassignModal(false); setReassignCategory(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Add Team Member</h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                    {newUser.role === 'sub_admin' && newUser.sub_admin_category === 'follow_up_user' && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number (required for Follow-up User)"
                    required={newUser.role === 'sub_admin' && newUser.sub_admin_category === 'follow_up_user'}
                  />
                  {newUser.role === 'sub_admin' && newUser.sub_admin_category === 'follow_up_user' && (
                    <p className="text-xs text-gray-500 mt-1">Required: Follow-up user can only login via mobile OTP</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    <option value="IT">IT</option>
                    <option value="Operations">Operations</option>
                    <option value="Risk Management">Risk Management</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Collections">Collections</option>
                    <option value="Verification">Verification</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                    <option value="QA">QA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value, sub_admin_category: e.target.value === 'sub_admin' ? newUser.sub_admin_category : '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="officer">Officer</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="master_admin">Master Admin</option>
                    <option value="nbfc_admin">NBFC Admin</option>
                    <option value="sub_admin">Sub-admin</option>
                  </select>
                </div>
              </div>

              {newUser.role === 'sub_admin' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sub-admin category *</label>
                    <select
                      value={newUser.sub_admin_category}
                      onChange={(e) => setNewUser({ ...newUser, sub_admin_category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select category</option>
                      {SUB_ADMIN_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  {(newUser.sub_admin_category === 'debt_agency' || newUser.sub_admin_category === 'follow_up_user') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Whitelisted IP (comma-separated, 2-3 IPs)</label>
                      <input
                        type="text"
                        value={newUser.whitelisted_ip}
                        onChange={(e) => setNewUser({ ...newUser, whitelisted_ip: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 192.168.1.1, 192.168.1.2"
                      />
                      {newUser.sub_admin_category === 'follow_up_user' && (
                        <p className="text-xs text-gray-500 mt-1">Follow-up user can only login from these IP addresses</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions Preview</label>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex flex-wrap gap-1">
                    {getRolePermissions(newUser.role).includes('*') ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        All Permissions
                      </span>
                    ) : (
                      getRolePermissions(newUser.role).map(permission => (
                        <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {availablePermissions.find(p => p.id === permission)?.label || permission}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newUser.name || !newUser.email || !newUser.password}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Edit Team Member</h4>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleUpdateUser(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                    {editFormData.role === 'sub_admin' && editFormData.sub_admin_category === 'follow_up_user' && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number (required for Follow-up User)"
                    required={editFormData.role === 'sub_admin' && editFormData.sub_admin_category === 'follow_up_user'}
                  />
                  {editFormData.role === 'sub_admin' && editFormData.sub_admin_category === 'follow_up_user' && (
                    <p className="text-xs text-gray-500 mt-1">Required: Follow-up user can only login via mobile OTP</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    <option value="IT">IT</option>
                    <option value="Operations">Operations</option>
                    <option value="Risk Management">Risk Management</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Collections">Collections</option>
                    <option value="Verification">Verification</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                    <option value="QA">QA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="officer">Officer</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="master_admin">Master Admin</option>
                    <option value="nbfc_admin">NBFC Admin</option>
                    <option value="sub_admin">Sub-admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editFormData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {editFormData.role === 'sub_admin' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sub-admin category *</label>
                    <select
                      value={editFormData.sub_admin_category}
                      onChange={(e) => setEditFormData({ ...editFormData, sub_admin_category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {SUB_ADMIN_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  {(editFormData.sub_admin_category === 'debt_agency' || editFormData.sub_admin_category === 'follow_up_user') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Whitelisted IP (comma-separated, 2-3 IPs)</label>
                      <input
                        type="text"
                        value={editFormData.whitelisted_ip}
                        onChange={(e) => setEditFormData({ ...editFormData, whitelisted_ip: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 192.168.1.1, 192.168.1.2"
                      />
                      {editFormData.sub_admin_category === 'follow_up_user' && (
                        <p className="text-xs text-gray-500 mt-1">Follow-up user can only login from these IP addresses</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editFormData.role === 'sub_admin' && editFormData.sub_admin_category && editFormData.sub_admin_category !== 'debt_agency' && editFormData.sub_admin_category !== 'follow_up_user' && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                  <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Temporary inactive (leave)
                  </h5>
                  <p className="text-xs text-gray-600">Set weekly off or leave dates for this sub-admin. When set, they are excluded from assignments and their work is temporarily covered by others. Sub-admins can also update their own leave from the account menu (top right) → Leave settings.</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weekly off (select days)</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 0, label: 'Sun' },
                        { v: 1, label: 'Mon' },
                        { v: 2, label: 'Tue' },
                        { v: 3, label: 'Wed' },
                        { v: 4, label: 'Thu' },
                        { v: 5, label: 'Fri' },
                        { v: 6, label: 'Sat' }
                      ].map(({ v, label }) => (
                        <label key={v} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={editFormData.weekly_off_days.includes(v)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditFormData({ ...editFormData, weekly_off_days: [...editFormData.weekly_off_days, v].sort((a, b) => a - b) });
                              } else {
                                setEditFormData({ ...editFormData, weekly_off_days: editFormData.weekly_off_days.filter(d => d !== v) });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Leave from (date)</label>
                      <input
                        type="date"
                        value={editFormData.temp_inactive_from}
                        onChange={(e) => setEditFormData({ ...editFormData, temp_inactive_from: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Leave to (date)</label>
                      <input
                        type="date"
                        value={editFormData.temp_inactive_to}
                        onChange={(e) => setEditFormData({ ...editFormData, temp_inactive_to: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {showViewModal && viewingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">User Details</h4>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{viewingUser.name}</h3>
                  <p className="text-gray-600">{viewingUser.email}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(viewingUser.role)}`}>
                    {viewingUser.role.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900">{viewingUser.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <p className="text-gray-900">{viewingUser.department || 'Not assigned'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${viewingUser.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {viewingUser.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Login</label>
                  <p className="text-gray-900">
                    {viewingUser.lastLogin || viewingUser.last_login ? formatDate(viewingUser.lastLogin || viewingUser.last_login!) : 'Never'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">
                    {viewingUser.createdAt || viewingUser.created_at ? formatDate(viewingUser.createdAt || viewingUser.created_at!) : 'Unknown'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User ID</label>
                  <p className="text-gray-900 font-mono text-sm">{viewingUser.id}</p>
                </div>
                {viewingUser.role === 'sub_admin' && viewingUser.sub_admin_category !== 'debt_agency' && (viewingUser.weekly_off_days || viewingUser.temp_inactive_from) && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Leave</label>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {isOnLeaveToday(viewingUser) && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">On leave today</span>
                      )}
                      {viewingUser.weekly_off_days && (
                        <span className="text-sm text-gray-700">
                          Weekly off: {[0,1,2,3,4,5,6].filter(d => {
                            const arr = Array.isArray(viewingUser.weekly_off_days) ? viewingUser.weekly_off_days : String(viewingUser.weekly_off_days).split(',').map(x => parseInt(x, 10));
                            return arr.includes(d);
                          }).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
                        </span>
                      )}
                      {viewingUser.temp_inactive_from && viewingUser.temp_inactive_to && (
                        <span className="text-sm text-gray-700">
                          Date range: {String(viewingUser.temp_inactive_from).slice(0, 10)} – {String(viewingUser.temp_inactive_to).slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {viewingUser.permissions.includes('*') ? (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                      All Permissions
                    </span>
                  ) : (
                    viewingUser.permissions.map(permission => (
                      <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {availablePermissions.find(p => p.id === permission)?.label || permission}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && passwordUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Change Password - {passwordUser.name}</h4>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordUser(null);
                  setPasswordForm({ newPassword: '', confirmPassword: '' });
                  setPasswordError(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    <strong>Security tip:</strong> Share the new password with the user over a secure channel
                    and ask them to change it after login.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password"
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Re-enter new password"
                  minLength={8}
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4 mt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordUser(null);
                  setPasswordForm({ newPassword: '', confirmPassword: '' });
                  setPasswordError(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Permissions Modal */}
      {showPermissionsModal && editingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Manage Permissions - {editingUser.name}</h4>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Changing permissions will affect what this user can access.
                    Make sure to review all changes before saving.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePermissions.map(permission => (
                  <label key={permission.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={permissionsFormData.includes(permission.id) || permissionsFormData.includes('*')}
                      disabled={permissionsFormData.includes('*')}
                      onChange={(e) => {
                        if (permission.id === '*') {
                          setPermissionsFormData(['*']);
                        } else {
                          if (e.target.checked) {
                            setPermissionsFormData([...permissionsFormData.filter(p => p !== '*'), permission.id]);
                          } else {
                            setPermissionsFormData(permissionsFormData.filter(p => p !== permission.id));
                          }
                        }
                      }}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{permission.label}</div>
                      <div className="text-sm text-gray-500">{permission.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 mt-6 border-t border-gray-200">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Permissions'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Bulk Actions</h4>
              <button
                onClick={() => setShowBulkActionsModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Select team members and choose an action to apply to all selected users.
                  </p>
                </div>
              </div>

              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Team Members</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {teamMembers.map(member => (
                    <label key={member.id} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={selectedUsers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, member.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== member.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email} • {member.role}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Choose Action</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Activate Users</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <UserX className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Deactivate Users</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <Settings className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">Change Role</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <Download className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Export Data</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 mt-6 border-t border-gray-200">
              <button
                onClick={() => setShowBulkActionsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Bulk action would apply to ${selectedUsers.length} users (feature to be implemented)`);
                  setShowBulkActionsModal(false);
                  setSelectedUsers([]);
                }}
                disabled={selectedUsers.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply to {selectedUsers.length} Users
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Activity Modal */}
      {showActivityModal && viewingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Activity Log - {viewingUser.name}</h4>
              <button
                onClick={() => setShowActivityModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {loadingActivity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading activity...</span>
                </div>
              ) : (
                <>
                  {/* Activity Stats */}
                  {activityData && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{activityData.stats.today}</div>
                        <div className="text-sm text-blue-800">Actions Today</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{activityData.stats.week}</div>
                        <div className="text-sm text-green-800">This Week</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{activityData.stats.month}</div>
                        <div className="text-sm text-purple-800">This Month</div>
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-900">Recent Activity</h5>
                    <div className="space-y-2">
                      {activityData && activityData.activities.length > 0 ? (
                        activityData.activities.map((activity) => {
                          const activityType = getActivityType(activity.action);
                          return (
                            <div key={activity.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                              <div className={`w-2 h-2 rounded-full ${activityType === 'success' ? 'bg-green-500' :
                                activityType === 'warning' ? 'bg-orange-500' :
                                  'bg-blue-500'
                                }`} />
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">{activity.action}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatActivityTime(activity.timestamp)}
                                </div>
                              </div>
                              <div className={`px-2 py-1 text-xs rounded ${activityType === 'success' ? 'bg-green-100 text-green-800' :
                                activityType === 'warning' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                {activityType}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                          <p>No activity recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
