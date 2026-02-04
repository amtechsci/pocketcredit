import { useEffect, useRef } from 'react';

interface UseAdminAutoLogoutOptions {
  enabled?: boolean;
}

export function useAdminAutoLogout({ enabled = true }: UseAdminAutoLogoutOptions) {
  const warningShownRef = useRef(false);
  const enabledRef = useRef(enabled);

  // Listen for session warnings from backend
  useEffect(() => {
    if (!enabled) {
      return;
    }

    enabledRef.current = enabled;

    const handleSessionWarning = (event: CustomEvent<{ secondsRemaining: number; minutesRemaining: number }>) => {
      const { secondsRemaining, minutesRemaining } = event.detail;
      
      // Only show warning once per session
      if (warningShownRef.current) {
        return;
      }
      
      warningShownRef.current = true;
      
      // Show warning to user
      const shouldContinue = window.confirm(
        `You have been inactive for 18 minutes. You will be logged out in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} due to inactivity.\n\nClick OK to continue your session.`
      );
      
      // Reset warning flag after a delay so it can show again if needed
      setTimeout(() => {
        warningShownRef.current = false;
      }, 60000); // Reset after 1 minute
    };

    window.addEventListener('admin-session-warning', handleSessionWarning as EventListener);

    return () => {
      window.removeEventListener('admin-session-warning', handleSessionWarning as EventListener);
    };
  }, [enabled]);
}
