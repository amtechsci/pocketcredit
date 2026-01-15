import { NavigateFunction } from 'react-router-dom';
import { User } from '../services/api';

/**
 * Centralized navigation utility for handling authentication-based routing
 */

/**
 * Handle logo click navigation based on authentication state
 * @param navigate - React Router navigate function
 * @param isAuthenticated - Whether user is authenticated
 * @param user - User object (if authenticated)
 */
export const handleLogoClick = (
  navigate: NavigateFunction,
  isAuthenticated: boolean,
  user?: User | null
) => {
  if (isAuthenticated && user) {
    // If user is deleted, redirect to deleted status page
    if (user.status === 'deleted') {
      navigate('/deleted-status');
    } else if (user.status === 'on_hold') {
      // If user is on hold, redirect to hold status page
      navigate('/hold-status');
    } else if (user.status === 'active' && user.profile_completion_step >= 2 && user.profile_completed) {
      // If user is active, has completed step 2, AND profile is fully completed, show dashboard
      navigate('/dashboard');
    } else if (user.profile_completed) {
      // If profile is complete, go to dashboard
      navigate('/dashboard');
    } else {
      // If profile is incomplete, go to profile completion
      // This includes users who were on hold at step 1 and need to complete it again
      navigate('/profile-completion');
    }
  } else {
    // If not authenticated, go to home
    navigate('/home');
  }
};

/**
 * Get the appropriate redirect path for authenticated users
 * @param user - User object
 * @returns Redirect path
 */
export const getAuthenticatedRedirect = (user?: User | null): string => {
  if (!user) return '/dashboard';
  
  // If user is deleted, redirect to deleted status page
  if (user.status === 'deleted') {
    return '/deleted-status';
  }
  
  // If user is on hold, redirect to hold status page
  if (user.status === 'on_hold') {
    return '/hold-status';
  }
  
  // If user is active, has completed step 2, AND profile is fully completed, show dashboard
  if (user.status === 'active' && user.profile_completion_step >= 2 && user.profile_completed) {
    return '/dashboard';
  }
  
  // If profile is complete, go to dashboard
  if (user.profile_completed) {
    return '/dashboard';
  }
  
  // If profile is not complete, redirect to profile completion
  // This includes users who were on hold at step 1 and need to complete it again
  return '/profile-completion';
};

/**
 * Handle login button click
 * @param navigate - React Router navigate function
 * @param isAuthenticated - Whether user is authenticated
 * @param user - User object (if authenticated)
 */
export const handleLoginClick = (
  navigate: NavigateFunction,
  isAuthenticated: boolean,
  user?: User | null
) => {
  if (isAuthenticated && user) {
    // If already logged in, go to appropriate dashboard
    const redirectPath = getAuthenticatedRedirect(user);
    navigate(redirectPath);
  } else {
    // If not logged in, go to auth page
    navigate('/auth');
  }
};
