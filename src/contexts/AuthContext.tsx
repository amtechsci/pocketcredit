import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiService, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithOTP: (phone: string, otp: string) => Promise<{ success: boolean; message: string }>;
  sendOTP: (phone: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Initialize user from localStorage if available
  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem('pocket_user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Helper function to update user and persist to localStorage
  const updateUserState = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('pocket_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('pocket_user');
      localStorage.removeItem('pocket_user_token'); // Also clear JWT token
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    const checkSession = async () => {
      try {
        const response = await apiService.getUserProfile();
        
        if (isMounted) {
          if (response.status === 'success' && response.data?.user) {
            updateUserState(response.data.user);
          } else {
            // If no valid session, clear stored user data
            updateUserState(null);
          }
          setIsLoading(false);
        }
      } catch (error: any) {
        if (isMounted) {
          // Only log actual errors, not authentication failures
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.error('Server connection timeout. Please check if the server is running.');
          }
          setIsLoading(false);
        }
      }
    };

    checkSession();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const response = await apiService.getUserProfile();
      if (response.status === 'success' && response.data?.user) {
        updateUserState(response.data.user);
      } else {
        // Session might be invalid, logout
        updateUserState(null);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      updateUserState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh user data when window regains focus (user returns to tab)
  // Temporarily disabled to prevent infinite loops
  // useEffect(() => {
  //   let focusTimeout: NodeJS.Timeout;
    
  //   const handleFocus = () => {
  //     console.log('Window focus event - isAuthenticated:', isAuthenticated);
  //     // Debounce focus events to prevent rapid firing
  //     clearTimeout(focusTimeout);
  //     focusTimeout = setTimeout(() => {
  //       if (isAuthenticated) {
  //         refreshUser();
  //       }
  //     }, 1000); // Wait 1 second before refreshing
  //   };

  //   window.addEventListener('focus', handleFocus);
  //   return () => {
  //     window.removeEventListener('focus', handleFocus);
  //     clearTimeout(focusTimeout);
  //   };
  // }, [isAuthenticated, refreshUser]);

  const sendOTP = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      const response = await apiService.sendOTP(phone);
      
      if (response.status === 'success') {
        return { success: true, message: response.message };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send OTP' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOTP = async (phone: string, otp: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      const response = await apiService.verifyOTP(phone, otp);
      
      if (response.status === 'success' && response.data) {
        updateUserState(response.data.user);
        return { success: true, message: response.message };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return { 
        success: false, 
        message: error.message || 'OTP verification failed' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      updateUserState(null);
    }
  };

  const updateUser = (userData: User): void => {
    updateUserState(userData);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    loginWithOTP,
    sendOTP,
    logout,
    refreshUser,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};