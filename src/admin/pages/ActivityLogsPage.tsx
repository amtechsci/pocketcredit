import { useState, useEffect, useCallback } from 'react';
import { adminApiService } from '../../services/adminApi';
import { 
  Search,
  Filter,
  Download,
  Calendar,
  Users,
  Settings,
  Activity,
  ArrowUpRight,
  FileText,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  IndianRupee,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ActivityLog {
  id: string;
  timestamp: string;
  type: string;
  action: string;
  priority: string;
  metadata: any;
  user: { id: string; name: string; email: string } | null;
  admin: { id: string; name: string; email: string } | null;
  ipAddress: string;
  userAgent: string;
}

export function ActivityLogsPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>({});
  
  const itemsPerPage = 50;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_action':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'admin_action':
        return <Settings className="w-4 h-4 text-purple-500" />;
      case 'system_event':
        return <Activity className="w-4 h-4 text-gray-500" />;
      case 'api_call':
        return <ArrowUpRight className="w-4 h-4 text-indigo-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'approval':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejection':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'application':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'verification':
        return <Shield className="w-4 h-4 text-orange-500" />;
      case 'payment':
        return <IndianRupee className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReadableAction = (action: string, metadata: any) => {
    // Return the action as-is since middleware now provides business-friendly descriptions
    return action;
  };

  const getActivityDescription = (activity: ActivityLog) => {
    const { metadata, user, admin } = activity;
    
    let description = '';
    
    // Show who performed the action
    if (user) {
      description = `${user.name || `User #${user.id}`}`;
    } else if (admin) {
      description = `Admin ${admin.name || admin.email || `#${admin.id}`}`;
    } else {
      description = 'System';
    }
    
    // Add specific details based on the action
    const details = [];
    
    // Phone number for login/registration
    if (metadata?.phone) {
      details.push(`Phone: ${metadata.phone}`);
    }
    
    // Email for admin login or profile updates
    if (metadata?.email && !metadata?.phone) {
      details.push(`Email: ${metadata.email}`);
    }
    
    // Profile updates
    if (metadata?.firstName && metadata?.lastName) {
      details.push(`Name: ${metadata.firstName} ${metadata.lastName}`);
    }
    
    // Employment details
    if (metadata?.monthlyIncome) {
      details.push(`Income: ₹${metadata.monthlyIncome}/month`);
    }
    if (metadata?.companyName) {
      details.push(`Company: ${metadata.companyName}`);
    }
    
    // Loan application details
    if (metadata?.amount) {
      details.push(`Amount: ₹${metadata.amount}`);
    }
    if (metadata?.loanType) {
      details.push(`Type: ${metadata.loanType}`);
    }
    
    // Admin actions
    if (metadata?.newStatus) {
      details.push(`Status: ${metadata.newStatus}`);
    }
    if (metadata?.applicationId) {
      details.push(`App ID: ${metadata.applicationId}`);
    }
    
    // Document uploads
    if (metadata?.documentType) {
      details.push(`Document: ${metadata.documentType}`);
    }
    
    // Join details
    if (details.length > 0) {
      description += ` • ${details.join(' • ')}`;
    }
    
    return description;
  };

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      
      const filters = {
        page: currentPage,
        limit: itemsPerPage,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: searchTerm || undefined
      };

      const response = await adminApiService.getRecentActivities(itemsPerPage, filters);
      
      if (response.status === 'success') {
        setActivities(response.data || []);
        // Calculate total pages (assuming we get all data for now)
        setTotalPages(Math.ceil((response.data?.length || 0) / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, priorityFilter, searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await adminApiService.getActivityStats('30d');
      if (response.status === 'success') {
        setStats(response.data || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [fetchActivities, fetchStats]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    setCurrentPage(1);
  };

  const handlePriorityFilter = (priority: string) => {
    setPriorityFilter(priority);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600">Monitor and review all system activities</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.today || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.thisWeek || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">{stats.thisMonth || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="system_event">System Events</option>
            <option value="user_action">User Actions</option>
            <option value="admin_action">Admin Actions</option>
            <option value="api_call">API Calls</option>
            <option value="error">Errors</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => handlePriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User/Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading activities...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No activities found
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getReadableAction(activity.action, activity.metadata)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {getActivityDescription(activity)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {activity.user ? (
                          <div>
                            <div className="font-medium">{activity.user.name}</div>
                            <div className="text-gray-500">{activity.user.email}</div>
                          </div>
                        ) : activity.admin ? (
                          <div>
                            <div className="font-medium">{activity.admin.name}</div>
                            <div className="text-gray-500">{activity.admin.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-500">System</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(activity.priority)}`}>
                        {activity.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {activity.ipAddress}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
