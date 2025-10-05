import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';
import { 
  Search, 
  Bell,
  TrendingUp, 
  TrendingDown,
  Users,
  CreditCard,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Settings,
  Activity,
  ArrowUpRight,
  FileText,
  Shield
} from 'lucide-react';




export function AdminDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsResponse, activityResponse, chartResponse] = await Promise.all([
          adminApiService.getDashboardStats('30d'),
          adminApiService.getRecentActivities(10),
          adminApiService.getChartData('30d')
        ]);
        
        if (statsResponse.status === 'success' && statsResponse.data) {
          console.log('📊 Dashboard data received:', {
            stats: statsResponse.data,
            activities: activityResponse.data,
            charts: chartResponse.data
          });
          
          setDashboardData({
            ...statsResponse.data,
            recentActivity: activityResponse.data || [],
            chartData: chartResponse.data || {}
          });
        }
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
      }
    };

    fetchDashboardData();
  }, []);

  // Real data from API
  const keyMetrics = dashboardData ? [
    {
      title: 'Total Users',
      subtitle: 'Registered',
      value: dashboardData.totalUsers?.toLocaleString() || '0',
      change: dashboardData.newUsers ? `+${dashboardData.newUsers}` : '+0',
      trend: 'up',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Total Applications',
      subtitle: 'All Time',
      value: dashboardData.totalApplications?.toLocaleString() || '0',
      change: dashboardData.newApplications ? `+${dashboardData.newApplications}` : '+0',
      trend: 'up',
      icon: CreditCard,
      color: 'purple'
    },
    {
      title: 'Pending Review',
      subtitle: 'Under Review',
      value: dashboardData.pendingApplications?.toLocaleString() || '0',
      change: dashboardData.pendingApplications > 0 ? 'Needs Review' : 'All Clear',
      trend: dashboardData.pendingApplications > 0 ? 'up' : 'down',
      icon: Clock,
      color: 'orange'
    },
    {
      title: 'Approved Loans',
      subtitle: 'Successfully Approved',
      value: dashboardData.approvedApplications?.toLocaleString() || '0',
      change: dashboardData.approvedApplications > 0 ? `${Math.round((dashboardData.approvedApplications / dashboardData.totalApplications) * 100)}%` : '0%',
      trend: 'up',
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: 'Amount Disbursed',
      subtitle: 'Total Disbursed',
      value: dashboardData.totalDisbursed ? `₹${(dashboardData.totalDisbursed / 10000000).toFixed(1)}Cr` : '₹0',
      change: dashboardData.averageLoanAmount ? `Avg: ₹${Math.round(dashboardData.averageLoanAmount / 1000)}K` : 'No Data',
      trend: 'up',
      icon: IndianRupee,
      color: 'green'
    },
    {
      title: 'Rejected Applications',
      subtitle: 'Not Approved',
      value: dashboardData.rejectedApplications?.toLocaleString() || '0',
      change: dashboardData.rejectedApplications > 0 ? `${Math.round((dashboardData.rejectedApplications / dashboardData.totalApplications) * 100)}%` : '0%',
      trend: 'down',
      icon: XCircle,
      color: 'red'
    }
  ] : [];


  const recentActivity = dashboardData?.recentActivity || [];

  const quickActions = [
    { 
      title: 'Pending Approvals', 
      count: dashboardData?.pendingApplications?.toString() || '0', 
      action: () => navigate('/admin/applications?status=under_review') 
    },
    { 
      title: 'New Applications', 
      count: dashboardData?.newApplications?.toString() || '0', 
      action: () => navigate('/admin/applications?status=submitted') 
    },
    { 
      title: 'Approved Loans', 
      count: dashboardData?.approvedApplications?.toString() || '0', 
      action: () => navigate('/admin/applications?status=approved') 
    },
    { 
      title: 'Total Users', 
      count: dashboardData?.totalUsers?.toString() || '0', 
      action: () => navigate('/admin/users') 
    }
  ];

  const getMetricColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-500',
      orange: 'bg-orange-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      red: 'bg-red-500'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-500';
  };

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

  const getReadableAction = (action: string, _metadata?: any) => {
    // Return the action as-is since middleware now provides business-friendly descriptions
    return action;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Global Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {currentUser?.name || 'Admin'}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by User Name, Loan ID, Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="relative p-2 text-gray-400 hover:text-gray-600">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              3
            </span>
          </button>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Dashboard Cards - 70% width */}
        <div className="lg:col-span-7 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Dashboard Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {keyMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${getMetricColor(metric.color)}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className={`flex items-center text-sm ${
                        metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {metric.change}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {metric.value}
                    </div>
                    <div className="text-sm font-medium text-gray-600">{metric.title}</div>
                    <div className="text-xs text-gray-500">{metric.subtitle}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions - 30% width */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">{action.title}</span>
                <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  {action.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <button 
              onClick={() => navigate('/admin/activity-logs')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.length > 0 ? recentActivity.map((activity: any) => (
            <div key={activity.id} className="p-6 flex items-center space-x-4">
              <div className="flex-shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {getReadableAction(activity.action, activity.metadata)}
                </p>
                <p className="text-sm text-gray-500">
                  {activity.user ? `👤 ${activity.user.name || `User #${activity.user.id}`}` : 
                   activity.admin ? `⚙️ Admin ${activity.admin.name || activity.admin.email || `#${activity.admin.id}`}` : 
                   '🔧 System'}
                  {activity.metadata?.phone && ` • ${activity.metadata.phone}`}
                  {activity.metadata?.amount && ` • ₹${activity.metadata.amount}`}
                  {activity.metadata?.newStatus && ` • ${activity.metadata.newStatus}`}
                </p>
              </div>
              <div className="flex-shrink-0 text-sm text-gray-500">
                {new Date(activity.timestamp).toLocaleString()}
              </div>
            </div>
          )) : (
            <div className="p-6 text-center text-gray-500">
              No recent activity found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}