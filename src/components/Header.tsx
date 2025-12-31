import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { handleLogoClick, handleLoginClick } from '../utils/navigation';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const navigationItems = [
    { label: 'Home', path: '/' },
    { label: 'Personal Loan', path: '/personal-loan' },
    { label: 'Business Loan', path: '/business-loan' },
    { label: 'Credit Score', path: '/credit-score' },
    { label: 'Resources', path: '/resources' },
    { label: 'Contact Us', path: '/contact' },
  ];

  const policyItems = [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms & Conditions', path: '/terms' },
    { label: 'Fair Practice Code', path: '/fair-practice' },
    { label: 'Fees Policy', path: '/fees-policy' },
    { label: 'IT Policy', path: '/it-policy' },
    { label: 'Refund & Cancellation', path: '/refund-cancellation-policy' },
    { label: 'Grievance Redressal', path: '/grievance' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto mobile-container">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Logo */}
          <Logo 
            size="md" 
            variant="default" 
            onClick={() => handleLogoClick(navigate, isAuthenticated, user)}
          />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-blue-600 ${
                  isActive(item.path) 
                    ? 'text-blue-600' 
                    : 'text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
            
            {/* Policies Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1">
                  Policies
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {policyItems.map((policy) => (
                  <DropdownMenuItem key={policy.path} asChild>
                    <Link to={policy.path} className="cursor-pointer">
                      {policy.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  Welcome, {user?.first_name || 'User'}
                </span>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  size="sm"
                  asChild
                >
                  <Link to="/dashboard">
                    <User className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoginClick(navigate, isAuthenticated, user)}
              >
                Login
              </Button>
            )}
            <Button 
              style={{ backgroundColor: '#0052FF' }}
              className="text-white hover:opacity-90"
              size="sm"
              asChild
            >
              <Link to="/application">
                Apply Now
              </Link>
            </Button>
          </div>


          {/* Mobile Menu */}
          <div className="lg:hidden ml-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 sm:w-96">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-left">Navigation Menu</SheetTitle>
                  <SheetDescription className="text-left">
                    Access all pages and features of Pocket Credit
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`text-left px-4 py-4 font-medium transition-colors hover:bg-gray-100 rounded-lg touch-manipulation ${
                        isActive(item.path) 
                          ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                          : 'text-gray-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  
                  {/* Mobile Policies Section */}
                  <div className="border-t pt-4 mt-4">
                    <div className="px-4 py-2 text-sm font-semibold text-gray-500">Policies</div>
                    {policyItems.map((policy) => (
                      <Link
                        key={policy.path}
                        to={policy.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg touch-manipulation block"
                      >
                        {policy.label}
                      </Link>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4 mt-4 space-y-3">
                    {isAuthenticated ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600 px-4 py-2">
                          Welcome, {user?.first_name || 'User'}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full py-3 flex items-center justify-center gap-2 touch-manipulation"
                          asChild
                        >
                          <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                            <User className="h-4 w-4" />
                            Dashboard
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full py-3 touch-manipulation"
                        onClick={() => {
                          handleLoginClick(navigate, isAuthenticated, user);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        Login
                      </Button>
                    )}
                    <Button 
                      style={{ backgroundColor: '#00C49A' }}
                      className="w-full py-3 text-white hover:opacity-90 touch-manipulation"
                      asChild
                    >
                      <Link to="/application" onClick={() => setIsMobileMenuOpen(false)}>
                        Apply Now
                      </Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}