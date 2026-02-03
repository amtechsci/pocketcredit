import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_TIMEOUT = 18 * 60 * 1000; // Show warning 2 minutes before logout (18 minutes)
const THROTTLE_DELAY = 1000; // Throttle activity detection to once per second

interface UseAdminAutoLogoutOptions {
  onLogout: () => void;
  enabled?: boolean;
}

export function useAdminAutoLogout({ onLogout, enabled = true }: UseAdminAutoLogoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onLogoutRef = useRef(onLogout);
  const enabledRef = useRef(enabled);

  // Keep refs in sync
  useEffect(() => {
    onLogoutRef.current = onLogout;
    enabledRef.current = enabled;
  }, [onLogout, enabled]);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    
    // Throttle: only reset if at least THROTTLE_DELAY ms have passed since last reset
    if (now - lastActivityRef.current < THROTTLE_DELAY) {
      return;
    }
    
    lastActivityRef.current = now;

    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    warningShownRef.current = false;

    if (!enabledRef.current) return;

    // Set warning timer (18 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      warningShownRef.current = true;
      // Show warning modal
      const shouldContinue = window.confirm(
        'You have been inactive for 18 minutes. You will be logged out in 2 minutes due to inactivity.\n\nClick OK to continue your session or Cancel to logout now.'
      );
      
      if (!shouldContinue) {
        onLogoutRef.current();
        return;
      }
      
      // Reset timer if user chooses to continue
      resetTimer();
    }, WARNING_TIMEOUT);

    // Set logout timer (20 minutes)
    timeoutRef.current = setTimeout(() => {
      onLogoutRef.current();
    }, INACTIVITY_TIMEOUT);
  }, []);

  // Throttled reset function for high-frequency events
  const throttledResetTimer = useCallback(() => {
    if (throttleTimeoutRef.current) {
      return; // Already scheduled
    }

    throttleTimeoutRef.current = setTimeout(() => {
      throttleTimeoutRef.current = null;
      resetTimer();
    }, THROTTLE_DELAY);
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      // Clear timers when disabled
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      return;
    }

    // High-frequency events that need throttling
    const throttledEvents = ['mousemove', 'scroll'];
    
    // Low-frequency events that can reset immediately
    const immediateEvents = [
      'mousedown',
      'keypress',
      'touchstart',
      'click',
      'keydown',
      'focus',
      'input',
      'change'
    ];

    // Add throttled event listeners
    throttledEvents.forEach(event => {
      window.addEventListener(event, throttledResetTimer, { passive: true });
    });

    // Add immediate event listeners
    immediateEvents.forEach(event => {
      window.addEventListener(event, resetTimer, true);
    });

    // Also listen to visibility change (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      throttledEvents.forEach(event => {
        window.removeEventListener(event, throttledResetTimer);
      });
      immediateEvents.forEach(event => {
        window.removeEventListener(event, resetTimer, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [enabled, resetTimer, throttledResetTimer]);

  return {
    resetTimer
  };
}

