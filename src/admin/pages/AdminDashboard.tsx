import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { 
  Search, 
  Bell,
  TrendingUp, 
  TrendingDown,
  Users,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  MoreVertical
} from 'lucide-react';




export function AdminDashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const { currentUser } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data
  const keyMetrics = [
    {
      title: 'New Applications',
      subtitle: 'Today',
      value: '47',
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Pending Review',
      subtitle: 'Waiting',
      value: '23',
      change: '+5%',
      trend: 'up',
      icon: Clock,
      color: 'orange'
    },
    {
      title: 'Amount Disbursed',
      subtitle: 'Month-to-Date',
      value: '₹2.4Cr',
      change: '+18%',
      trend: 'up',
      icon: DollarSign,
      color: 'green'
    },
    {
      title: 'Active EMIs',
      subtitle: 'This Month',
      value: '1,847',
      change: '+7%',
      trend: 'up',
      icon: CreditCard,
      color: 'purple'
    },
    {
      title: 'Default Rate',
      subtitle: 'Current',
      value: '2.3%',
      change: '-0.5%',
      trend: 'down',
      icon: AlertCircle,
      color: 'red'
    }
  ];

  const funnelData = [
    { stage: 'Applied', count: 1247, percentage: 100 },
    { stage: 'Under Review', count: 894, percentage: 72 },
    { stage: 'Approved', count: 623, percentage: 50 },
    { stage: 'Disbursed', count: 587, percentage: 47 }
  ];

  const recentActivity = [
    {
      id: 1,
      action: 'Loan CL250912 approved',
      user: 'Raj Patel',
      time: '2 minutes ago',
      type: 'approval'
    },
    {
      id: 2,
      action: 'New application CL250913 submitted',
      user: 'System',
      time: '5 minutes ago',
      type: 'application'
    },
    {
      id: 3,
      action: 'Document verification completed for CL250910',
      user: 'Priya Singh',
      time: '12 minutes ago',
      type: 'verification'
    },
    {
      id: 4,
      action: 'Loan CL250908 rejected - Low CIBIL',
      user: 'Sarah Johnson',
      time: '18 minutes ago',
      type: 'rejection'
    },
    {
      id: 5,
      action: 'EMI payment received for CL250745',
      user: 'System',
      time: '25 minutes ago',
      type: 'payment'
    }
  ];

  const quickActions = [
    { title: 'Pending Approvals', count: '23', action: () => navigate('/admin/applications') },
    { title: 'KYC Verification', count: '15', action: () => navigate('/admin/applications') },
    { title: 'Document Review', count: '8', action: () => navigate('/admin/applications') },
    { title: 'Follow-ups Due', count: '12', action: () => navigate('/admin/applications') }
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
      case 'approval':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejection':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'application':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'verification':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'payment':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Global Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {currentUser.name}</p>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
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
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                <div className="text-sm font-medium text-gray-600">{metric.title}</div>
                <div className="text-xs text-gray-500">{metric.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Application Funnel */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Loan Application Funnel</h2>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {funnelData.map((stage, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-24 text-sm font-medium text-gray-700">
                      {stage.stage}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-600 w-16 text-right">
                      {stage.percentage}%
                    </div>
                  </div>
                  <div className="ml-4 text-lg font-semibold text-gray-900 w-16 text-right">
                    {stage.count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              View All
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="p-6 flex items-center space-x-4">
              <div className="flex-shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-sm text-gray-500">by {activity.user}</p>
              </div>
              <div className="flex-shrink-0 text-sm text-gray-500">
                {activity.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}