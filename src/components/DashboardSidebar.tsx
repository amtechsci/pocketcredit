import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  CreditCard, 
  User
} from 'lucide-react';

export function DashboardSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home, path: '/dashboard' },
    { id: 'loans', label: 'My Loans', icon: CreditCard, path: '/my-loans' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' }
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
      </div>
    </div>
  );
}

