import { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  IndianRupee,
  FileText,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { Page } from '../../App';

interface AdminDashboardPageProps {
  onNavigate: (page: Page) => void;
  onAdminLogout: () => void;
}

export function AdminDashboardPage({ onNavigate, onAdminLogout }: AdminDashboardPageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stats = [
    {
      title: 'Total Applications',
      value: '2,847',
      change: '+12.3% from last month',
      icon: FileText,
      color: '#0052FF'
    },
    {
      title: 'Active Loans',
      value: '1,923',
      change: '+8.1% from last month',
      icon: CreditCard,
      color: '#00C49A'
    },
    {
      title: 'Total Users',
      value: '15,642',
      change: '+23.5% from last month',
      icon: Users,
      color: '#FFD700'
    },
    {
      title: 'Revenue (₹)',
      value: '₹4.2Cr',
      change: '+15.2% from last month',
      icon: IndianRupee,
      color: '#FF6B6B'
    }
  ];

  const recentApplications = [
    {
      id: 'LA001234',
      customer: 'Rajesh Kumar',
      amount: '₹5,00,000',
      type: 'Personal Loan',
      status: 'pending',
      date: '2025-01-09',
      phone: '+91 98765 43210'
    },
    {
      id: 'LA001235',
      customer: 'Priya Sharma',
      amount: '₹3,50,000',
      type: 'Personal Loan',
      status: 'approved',
      date: '2025-01-09',
      phone: '+91 87654 32109'
    },
    {
      id: 'LA001236',
      customer: 'Amit Patel',
      amount: '₹12,00,000',
      type: 'Business Loan',
      status: 'under_review',
      date: '2025-01-08',
      phone: '+91 76543 21098'
    },
    {
      id: 'LA001237',
      customer: 'Sunita Verma',
      amount: '₹2,75,000',
      type: 'Personal Loan',
      status: 'rejected',
      date: '2025-01-08',
      phone: '+91 65432 10987'
    },
    {
      id: 'LA001238',
      customer: 'Vikram Singh',
      amount: '₹8,00,000',
      type: 'Business Loan',
      status: 'approved',
      date: '2025-01-07',
      phone: '+91 54321 09876'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'under_review':
        return <Badge className="bg-blue-100 text-blue-800">Under Review</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const sidebarItems = [
    { title: 'Dashboard', page: 'admin-dashboard' as Page, icon: BarChart3, active: true },
    { title: 'Loan Applications', page: 'admin-loans' as Page, icon: FileText },
    { title: 'User Management', page: 'admin-users' as Page, icon: Users },
    { title: 'Content Management', page: 'admin-content' as Page, icon: Settings },
    { title: 'Analytics', page: 'admin-analytics' as Page, icon: TrendingUp },
    { title: 'Settings', page: 'admin-settings' as Page, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0052FF' }}>
              <span className="text-white font-bold text-sm">PC</span>
            </div>
            <span className="font-semibold" style={{ color: '#1E2A3B' }}>Admin Portal</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-left transition-colors ${
                  item.active 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.title}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={onAdminLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                  Admin Dashboard
                </h1>
                <p className="text-gray-600">Welcome back, Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium" style={{ color: '#1E2A3B' }}>Admin User</p>
                <p className="text-xs text-gray-500">admin@pocketcredit.com</p>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                        <p className="text-3xl font-bold mt-2" style={{ color: '#1E2A3B' }}>
                          {stat.value}
                        </p>
                        <p className="text-xs text-green-600 mt-1">{stat.change}</p>
                      </div>
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${stat.color}15` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: stat.color }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent Applications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Loan Applications</CardTitle>
                  <CardDescription>Latest applications requiring attention</CardDescription>
                </div>
                <Button
                  onClick={() => onNavigate('admin-loans')}
                  style={{ backgroundColor: '#0052FF' }}
                >
                  View All Applications
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell className="font-mono text-sm">{application.id}</TableCell>
                        <TableCell className="font-medium">{application.customer}</TableCell>
                        <TableCell className="text-sm">{application.phone}</TableCell>
                        <TableCell className="font-semibold" style={{ color: '#0052FF' }}>
                          {application.amount}
                        </TableCell>
                        <TableCell>{application.type}</TableCell>
                        <TableCell>{getStatusBadge(application.status)}</TableCell>
                        <TableCell className="text-sm">{application.date}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigate('admin-loans')}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate('admin-loans')}>
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 mx-auto mb-4" style={{ color: '#0052FF' }} />
                <h3 className="font-semibold mb-2">Pending Applications</h3>
                <p className="text-2xl font-bold text-yellow-600">47</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate('admin-users')}>
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-4" style={{ color: '#00C49A' }} />
                <h3 className="font-semibold mb-2">New Users Today</h3>
                <p className="text-2xl font-bold text-green-600">23</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate('admin-analytics')}>
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-4" style={{ color: '#FFD700' }} />
                <h3 className="font-semibold mb-2">Approval Rate</h3>
                <p className="text-2xl font-bold text-blue-600">87.3%</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}