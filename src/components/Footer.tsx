import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Instagram, Mail, MapPin } from 'lucide-react';
import { usePolicies } from '../hooks/usePolicies';
import { Logo } from './Logo';

export function Footer() {
  const { policies } = usePolicies(); // Fetch policies from API

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
    { label: 'Our Partners', path: '/partners' },
  ];

  const contactInfo = [
    { icon: Mail, text: 'support@pocketcredit.in' },
    { icon: MapPin, text: 'Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar, MUMBAI, Maharashtra, India - 421001' },
  ];

  return (
    <footer className="bg-white border-t">
      <div className="container mx-auto mobile-container py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center mb-4">
              <Logo size="md" className="flex-shrink-0" />
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Your trusted platform for instant personal and business loans. 
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
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors py-1 touch-manipulation text-left inline-block"
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
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors py-1 touch-manipulation text-left inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#1E2A3B' }}>Contact & Legal</h3>
            <div className="space-y-3 mb-4">
              {contactInfo.map((contact, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <contact.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{contact.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legal Links - Compact horizontal layout */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center lg:justify-start">
            {policies.map((policy, index) => (
              <span key={policy.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (policy.pdf_url) {
                      window.open(policy.pdf_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="text-xs text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {policy.policy_name}
                </button>
                {index < policies.length - 1 && (
                  <span className="text-gray-400 ml-4">|</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center lg:text-left">
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            © 2025 Pocket Credit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
