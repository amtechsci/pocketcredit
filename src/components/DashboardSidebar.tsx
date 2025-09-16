import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  Home, 
  CreditCard, 
  User, 
  FileText, 
  MessageCircle,
  IndianRupee,
  Calculator,
  FileSpreadsheet
} from 'lucide-react';

export function DashboardSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home, path: '/dashboard' },
    { id: 'loans', label: 'My Loans', icon: CreditCard, path: '/my-loans' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'documents', label: 'Documents', icon: FileText, path: '/documents' },
    { id: 'support', label: 'Support', icon: MessageCircle, path: '/support' }
  ];

  const quickActions = [
    { label: 'Pay EMI', icon: IndianRupee, path: '/pay-emi' },
    { label: 'EMI Calculator', icon: Calculator, path: '/emi-calculator' },
    { label: 'Apply Loan', icon: FileSpreadsheet, path: '/application' }
  ];

  return (
    <div className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
      <div className="p-6">
        <nav className="space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-blue-600' : 'text-gray-500'}`} />
              <span className="font-medium">{item.label}</span>
              {location.pathname === item.path && (
                <div className="w-2 h-2 bg-blue-600 rounded-full ml-auto" />
              )}
            </button>
          ))}
        </nav>
        
        {/* Quick Actions in Sidebar */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Button 
                key={action.label}
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => navigate(action.path)}
              >
                <action.icon className="w-4 h-4 mr-2" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

