import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_TIMEOUT = 18 * 60 * 1000; // Show warning 2 minutes before logout (18 minutes)

interface UseAdminAutoLogoutOptions {
  onLogout: () => void;
  enabled?: boolean;
}

export function useAdminAutoLogout({ onLogout, enabled = true }: UseAdminAutoLogoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    warningShownRef.current = false;

    if (!enabled) return;

    // Set warning timer (18 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      warningShownRef.current = true;
      // Show warning modal
      const shouldContinue = window.confirm(
        'You have been inactive for 18 minutes. You will be logged out in 2 minutes due to inactivity.\n\nClick OK to continue your session or Cancel to logout now.'
      );
      
      if (!shouldContinue) {
        onLogout();
        return;
      }
      
      // Reset timer if user chooses to continue
      resetTimer();
    }, WARNING_TIMEOUT);

    // Set logout timer (20 minutes)
    timeoutRef.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_TIMEOUT);
  }, [enabled, onLogout]);

  useEffect(() => {
    if (!enabled) return;

    // List of events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, true);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [enabled, resetTimer]);

  return {
    resetTimer
  };
}

