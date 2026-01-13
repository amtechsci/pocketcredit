import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { partnerApiService } from '../services/partnerApi';

interface Partner {
  id: number;
  partner_uuid: string;
  name: string;
  email: string | null;
}

interface PartnerContextType {
  partner: Partner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (clientId: string, clientSecret: string) => Promise<void>;
  logout: () => void;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if partner is already authenticated
    const token = localStorage.getItem('partner_access_token');
    if (token) {
      try {
        // Decode JWT token to get partner info
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.partner_id) {
          setPartner({
            id: 0, // Will be available from token payload if included
            partner_uuid: payload.partner_id || '',
            name: payload.name || 'Partner',
            email: payload.email || null,
          });
          setIsAuthenticated(true);
        }
      } catch (error) {
        // Token invalid, clear it
        localStorage.removeItem('partner_access_token');
        localStorage.removeItem('partner_refresh_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (clientId: string, clientSecret: string) => {
    try {
      const response = await partnerApiService.login(clientId, clientSecret);
      if (response.status && response.data?.access_token) {
        setIsAuthenticated(true);
        // Decode JWT token to get partner info
        try {
          const token = response.data.access_token;
          const payload = JSON.parse(atob(token.split('.')[1]));
          setPartner({
            id: 0,
            partner_uuid: payload.partner_id || '',
            name: payload.name || 'Partner',
            email: payload.email || null,
          });
        } catch (decodeError) {
          // If token decode fails, set default
          setPartner({
            id: 0,
            partner_uuid: '',
            name: 'Partner',
            email: null,
          });
        }
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const logout = () => {
    partnerApiService.logout();
    setPartner(null);
    setIsAuthenticated(false);
  };

  return (
    <PartnerContext.Provider
      value={{
        partner,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}
