import { useState } from 'react';
import { Search, Filter, Eye, UserCheck, UserX, ArrowLeft, Download, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Page } from '../../App';

interface AdminUsersPageProps {
  onNavigate: (page: Page) => void;
  onAdminLogout: () => void;
}

export function AdminUsersPage({ onNavigate, onAdminLogout }: AdminUsersPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const users = [
    {
      id: 'USR001',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@email.com',
      phone: '+91 98765 43210',
      joinDate: '2024-12-15',
      status: 'active',
      totalLoans: 2,
      activeLoans: 1,
      totalAmount: 800000,
      lastActivity: '2025-01-09'
    },
    {
      id: 'USR002',
      name: 'Priya Sharma',
      email: 'priya.sharma@email.com',
      phone: '+91 87654 32109',
      joinDate: '2024-11-20',
      status: 'active',
      totalLoans: 1,
      activeLoans: 1,
      totalAmount: 350000,
      lastActivity: '2025-01-08'
    },
    {
      id: 'USR003',
      name: 'Amit Patel', 
      email: 'amit.patel@email.com',
      phone: '+91 76543 21098',
      joinDate: '2024-10-05',
      status: 'inactive',
      totalLoans: 3,
      activeLoans: 0,
      totalAmount: 1500000,
      lastActivity: '2024-12-20'
    },
    {
      id: 'USR004',
      name: 'Sunita Verma',
      email: 'sunita.verma@email.com',
      phone: '+91 65432 10987',
      joinDate: '2024-09-12',
      status: 'suspended',
      totalLoans: 1,
      activeLoans: 0,
      totalAmount: 275000,
      lastActivity: '2024-11-15'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('admin-dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1E2A3B' }}>
                User Management
              </h1>
              <p className="text-gray-600">Manage customer accounts and information</p>
            </div>
          </div>
          <Button
            onClick={onAdminLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Manage customer accounts and view their loan history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Total Loans</TableHead>
                    <TableHead>Active Loans</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{user.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.joinDate}</TableCell>
                      <TableCell className="text-center">{user.totalLoans}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-blue-600">
                          {user.activeLoans}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold" style={{ color: '#0052FF' }}>
                        {formatCurrency(user.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-sm">{user.lastActivity}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {user.status === 'active' ? (
                            <Button size="sm" variant="outline" className="text-red-600">
                              <UserX className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-green-600">
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}