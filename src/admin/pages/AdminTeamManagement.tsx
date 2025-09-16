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
  Calendar
} from 'lucide-react';




export function AdminTeamManagement() {
    const navigate = useNavigate();
  const params = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

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
      permissions: ['*']
    },
    {
      id: 'manager1',
      name: 'Raj Patel',
      email: 'raj.patel@pocketcredit.com',
      role: 'manager',
      permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers']
    },
    {
      id: 'manager2',
      name: 'Priya Singh',
      email: 'priya.singh@pocketcredit.com',
      role: 'manager',
      permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers']
    },
    {
      id: 'officer1',
      name: 'Amit Sharma',
      email: 'amit.sharma@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up']
    },
    {
      id: 'officer2',
      name: 'Vikram Singh',
      email: 'vikram.singh@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up']
    },
    {
      id: 'officer3',
      name: 'Neha Gupta',
      email: 'neha.gupta@pocketcredit.com',
      role: 'officer',
      permissions: ['view_loans', 'view_users', 'add_notes', 'follow_up']
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
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </button>
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

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleEditUser(member)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center justify-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => handleToggleUserStatus(member.id)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteUser(member.id)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Team Member</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'superadmin' | 'manager' | 'officer' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="officer">Officer</option>
                  <option value="manager">Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
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
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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
    </div>
  );
}