import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  const quickLinks = [
    { label: 'Personal Loan', path: '/personal-loan' },
    { label: 'Business Loan', path: '/business-loan' },
    { label: 'Credit Score', path: '/credit-score' },
    { label: 'EMI Calculator', path: '/' },
  ];

  const companyLinks = [
    { label: 'About Us', path: '/about' },
    { label: 'Media / Press', path: '/media' },
    { label: 'Careers', path: '/careers' },
    { label: 'Our NBFC Partners', path: '/partners' },
  ];

  const legalLinks = [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms & Conditions', path: '/terms' },
    { label: 'Fair Practice Code', path: '/fair-practice' },
    { label: 'Grievance Redressal', path: '/grievance' },
    { label: 'IT, Fees & Fair Practice Policy', path: '/it-fees-fair-practice-policy' },
  ];

  return (
    <footer className="bg-white border-t">
      <div className="container mx-auto mobile-container py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#0052FF' }}
              >
                <span className="text-white font-bold">PC</span>
              </div>
              <span className="text-lg font-semibold" style={{ color: '#1E2A3B' }}>
                Pocket Credit
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Your trusted partner for instant personal and business loans. 
              Get quick approval and transparent terms across India.
            </p>
            <div className="flex gap-4">
              <button className="p-2 -m-2 touch-manipulation" aria-label="Follow us on Facebook">
                <Facebook className="h-5 w-5 text-gray-500 hover:text-blue-600 transition-colors" />
              </button>
              <button className="p-2 -m-2 touch-manipulation" aria-label="Follow us on Twitter">
                <Twitter className="h-5 w-5 text-gray-500 hover:text-blue-400 transition-colors" />
              </button>
              <button className="p-2 -m-2 touch-manipulation" aria-label="Connect with us on LinkedIn">
                <Linkedin className="h-5 w-5 text-gray-500 hover:text-blue-700 transition-colors" />
              </button>
              <button className="p-2 -m-2 touch-manipulation" aria-label="Follow us on Instagram">
                <Instagram className="h-5 w-5 text-gray-500 hover:text-pink-500 transition-colors" />
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#1E2A3B' }}>Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors py-1 touch-manipulation text-left"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#1E2A3B' }}>Company</h3>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors py-1 touch-manipulation text-left"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#1E2A3B' }}>Contact & Legal</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                support@pocketcredit.com
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                1800-123-4567
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                Mumbai, Maharashtra, India
              </div>
            </div>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-500 hover:text-blue-600 transition-colors py-1 touch-manipulation text-left"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t mt-4 sm:mt-6 pt-4 sm:pt-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                © 2025 Pocket Credit. All rights reserved. | Loan services provided by our RBI registered NBFC partners.
              </p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                *Terms and conditions apply. Interest rates may vary based on credit profile and loan amount.
              </p>
            </div>
            
          </div>
        </div>
      </div>
    </footer>
  );
}