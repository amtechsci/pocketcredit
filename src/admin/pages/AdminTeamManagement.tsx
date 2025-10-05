import { useState } from 'react';
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
  RefreshCw
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'manager' | 'officer';
  permissions: string[];
  status?: 'active' | 'inactive';
  lastLogin?: string;
  createdAt?: string;
  phone?: string;
  department?: string;
}

export function AdminTeamManagement() {
    const navigate = useNavigate();
  const params = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'officer' as 'superadmin' | 'manager' | 'officer',
    permissions: [] as string[]
  });

  const teamMembers: AdminUser[] = [
    {
      id: 'admin1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@pocketcredit.com',
      role: 'superadmin',
      permissions: ['*'],
      status: 'active',
      lastLogin: '2025-01-09T10:30:00Z',
      createdAt: '2024-01-15T09:00:00Z',
      phone: '+1 555-0123',
      department: 'IT'
    },
    {
      id: 'manager1',
      name: 'Raj Patel',
      email: 'raj.patel@pocketcredit.com',
      role: 'manager',
      permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers'],
      status: 'active',
      lastLogin: '2025-01-09T09:15:00Z',
      createdAt: '2024-03-20T10:00:00Z',
      phone: '+91 98765 43210',
      department: 'Operations'
    },
    {
      id: 'manager2',
      name: 'Priya Singh',
      email: 'priya.singh@pocketcredit.com',
      role: 'manager',
      permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers'],
      status: 'active',
      lastLogin: '2025-01-08T16:45:00Z',
      createdAt: '2024-05-10T14:30:00Z',
      phone: '+91 87654 32109',
      department: 'Risk Management'
    },
    {
      id: 'officer1',
      name: 'Amit Sharma',
      email: 'amit.sharma@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up'],
      status: 'active',
      lastLogin: '2025-01-09T08:20:00Z',
      createdAt: '2024-07-15T11:00:00Z',
      phone: '+91 76543 21098',
      department: 'Customer Service'
    },
    {
      id: 'officer2',
      name: 'Vikram Singh',
      email: 'vikram.singh@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up'],
      status: 'inactive',
      lastLogin: '2025-01-05T17:30:00Z',
      createdAt: '2024-09-01T13:15:00Z',
      phone: '+91 65432 10987',
      department: 'Collections'
    },
    {
      id: 'officer3',
      name: 'Neha Gupta',
      email: 'neha.gupta@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up'],
      status: 'active',
      lastLogin: '2025-01-09T11:45:00Z',
      createdAt: '2024-11-20T09:30:00Z',
      phone: '+91 54321 09876',
      department: 'Verification'
    }
  ];

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

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'superadmin':
        return ['*'];
      case 'manager':
        return ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers', 'view_analytics'];
      case 'officer':
        return ['view_loans', 'view_users', 'add_notes', 'follow_up'];
      default:
        return [];
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = () => {
    if (newUser.name && newUser.email) {
      const user: AdminUser = {
        id: `user_${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        permissions: getRolePermissions(newUser.role)
      };
      
      console.log('Creating user:', user);
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'officer', permissions: [] });
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleViewUser = (user: AdminUser) => {
    setViewingUser(user);
    setShowViewModal(true);
  };

  const handleManagePermissions = (user: AdminUser) => {
    setEditingUser(user);
    setShowPermissionsModal(true);
  };

  const handleBulkActions = () => {
    setShowBulkActionsModal(true);
  };

  const handleViewActivity = (user: AdminUser) => {
    setViewingUser(user);
    setShowActivityModal(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      console.log('Deleting user:', userId);
    }
  };

  const handleToggleUserStatus = (userId: string) => {
    console.log('Toggling user status:', userId);
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
            onClick={handleBulkActions}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Users className="w-4 h-4" />
            Bulk Actions
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
            <option value="manager">Manager</option>
            <option value="officer">Officer</option>
          </select>
        </div>
      </div>

      {/* Team Members Grid */}
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
                  {member.role.replace('_', ' ').toUpperCase()}
                </span>
              </div>

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
                onClick={() => handleToggleUserStatus(member.id)}
                className={`px-2 py-1 rounded text-xs ${
                  member.status === 'active' 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                title={member.status === 'active' ? 'Deactivate' : 'Activate'}
              >
                {member.status === 'active' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleDeleteUser(member.id)}
                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                title="Delete User"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
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

            <form className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Department</option>
                    <option value="IT">IT</option>
                    <option value="Operations">Operations</option>
                    <option value="Risk Management">Risk Management</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Collections">Collections</option>
                    <option value="Verification">Verification</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'superadmin' | 'manager' | 'officer' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="officer">Officer</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

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
            </form>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={!newUser.name || !newUser.email}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.filter(m => m.role === 'superadmin').length}
              </div>
              <div className="text-sm text-gray-600">Super Admins</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.filter(m => m.role === 'manager').length}
              </div>
              <div className="text-sm text-gray-600">Managers</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.filter(m => m.role === 'officer').length}
              </div>
              <div className="text-sm text-gray-600">Officers</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{teamMembers.length}</div>
              <div className="text-sm text-gray-600">Total Members</div>
            </div>
          </div>
        </div>
      </div>

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
            
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input 
                    type="text" 
                    defaultValue={editingUser.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input 
                    type="email" 
                    defaultValue={editingUser.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input 
                    type="tel" 
                    defaultValue={editingUser.phone || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select 
                    defaultValue={editingUser.department || ''}
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
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select 
                    defaultValue={editingUser.role}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="officer">Officer</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select 
                    defaultValue={editingUser.status || 'active'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('User updated successfully!');
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update User
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
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    viewingUser.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {viewingUser.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Login</label>
                  <p className="text-gray-900">
                    {viewingUser.lastLogin ? new Date(viewingUser.lastLogin).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">
                    {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User ID</label>
                  <p className="text-gray-900 font-mono text-sm">{viewingUser.id}</p>
                </div>
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
                      defaultChecked={editingUser.permissions.includes(permission.id) || editingUser.permissions.includes('*')}
                      disabled={editingUser.permissions.includes('*')}
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
                onClick={() => {
                  alert('Permissions updated successfully!');
                  setShowPermissionsModal(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Permissions
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
                  alert(`Bulk action applied to ${selectedUsers.length} users!`);
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
              {/* Activity Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">24</div>
                  <div className="text-sm text-blue-800">Actions Today</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">156</div>
                  <div className="text-sm text-green-800">This Week</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">1,234</div>
                  <div className="text-sm text-purple-800">This Month</div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Recent Activity</h5>
                <div className="space-y-2">
                  {[
                    { action: 'Approved loan application CL250912', time: '2 minutes ago', type: 'success' },
                    { action: 'Viewed user profile for Rajesh Kumar', time: '15 minutes ago', type: 'info' },
                    { action: 'Added note to loan application CL250913', time: '1 hour ago', type: 'info' },
                    { action: 'Rejected loan application CL250914', time: '2 hours ago', type: 'warning' },
                    { action: 'Logged in to admin panel', time: '3 hours ago', type: 'info' },
                    { action: 'Exported user data report', time: '1 day ago', type: 'info' },
                    { action: 'Updated permissions for Amit Sharma', time: '2 days ago', type: 'info' },
                    { action: 'Created new team member account', time: '3 days ago', type: 'success' }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'warning' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="text-sm text-gray-900">{activity.action}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {activity.time}
                        </div>
                      </div>
                      <div className={`px-2 py-1 text-xs rounded ${
                        activity.type === 'success' ? 'bg-green-100 text-green-800' :
                        activity.type === 'warning' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {activity.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}