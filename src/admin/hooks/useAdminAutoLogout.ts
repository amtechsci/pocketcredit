import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes = 1,200,000 milliseconds
const WARNING_TIMEOUT = 18 * 60 * 1000; // 18 minutes = 1,080,000 milliseconds

interface UseAdminAutoLogoutOptions {
  onLogout: () => void;
  enabled?: boolean;
}

export function useAdminAutoLogout({ onLogout, enabled = true }: UseAdminAutoLogoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const onLogoutRef = useRef(onLogout);
  const enabledRef = useRef(enabled);
  const lastResetTimeRef = useRef<number>(0);
  const timerStartTimeRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const listenersAttachedRef = useRef(false);

  // Keep refs in sync - this should NOT cause timer resets
  useEffect(() => {
    onLogoutRef.current = onLogout;
    const wasEnabled = enabledRef.current;
    enabledRef.current = enabled;
    
    // If we're being disabled, clear timers and reset initialization flag
    if (wasEnabled && !enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      isInitializedRef.current = false;
      listenersAttachedRef.current = false;
    }
  }, [onLogout, enabled]);

  // Main effect - setup event listeners and initialize timer
  // This should ONLY run when enabled changes from false to true, or on mount
  useEffect(() => {
    // Function to clear all timers
    const clearAllTimers = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };

    // If disabled, just clear timers and remove listeners
    if (!enabled) {
      clearAllTimers();
      isInitializedRef.current = false;
      listenersAttachedRef.current = false;
      return;
    }

    // If already initialized and enabled is still true, don't re-initialize
    // This prevents the timer from being reset when the component re-renders
    if (isInitializedRef.current && listenersAttachedRef.current) {
      return;
    }
    
    // Mark as initialized
    isInitializedRef.current = true;
    listenersAttachedRef.current = true;

    // Function to reset the inactivity timer
    const resetTimer = () => {
      // Don't reset if disabled
      if (!enabledRef.current) {
        clearAllTimers();
        return;
      }

      // Prevent resetting too frequently (throttle to once per second)
      const now = Date.now();
      if (now - lastResetTimeRef.current < 1000) {
        return;
      }
      lastResetTimeRef.current = now;

      // Clear existing timers first
      clearAllTimers();
      warningShownRef.current = false;

      // Record when timer starts
      timerStartTimeRef.current = Date.now();

      // Set warning timer (18 minutes)
      warningTimeoutRef.current = setTimeout(() => {
        if (!enabledRef.current) return;
        
        warningShownRef.current = true;
        const shouldContinue = window.confirm(
          'You have been inactive for 18 minutes. You will be logged out in 2 minutes due to inactivity.\n\nClick OK to continue your session or Cancel to logout now.'
        );
        
        if (!shouldContinue) {
          clearAllTimers();
          onLogoutRef.current();
          return;
        }
        
        // Reset timer if user chooses to continue
        resetTimer();
      }, WARNING_TIMEOUT);

      // Set logout timer (20 minutes) - THIS IS THE MAIN TIMER
      timeoutRef.current = setTimeout(() => {
        if (!enabledRef.current) return;
        clearAllTimers();
        onLogoutRef.current();
      }, INACTIVITY_TIMEOUT);
    };

    // Handle scroll events with debounce
    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (enabledRef.current) {
          resetTimer();
        }
      }, 500);
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        resetTimer();
      }
    };

    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mouseup',
      'click',
      'keydown',
      'keypress',
      'keyup',
      'touchstart',
      'touchend',
      'focus',
      'input',
      'change',
      'submit'
    ];

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, true);
    });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize timer ONCE when effect runs
    resetTimer();

    // Cleanup function
    return () => {
      // Remove all event listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer, true);
      });
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clear timers and reset flags only if we're disabling or component is unmounting
      // Check the actual enabled value, not the ref (ref might not be updated yet)
      if (!enabled) {
        clearAllTimers();
        isInitializedRef.current = false;
        listenersAttachedRef.current = false;
      }
    };
  }, [enabled]); // Only re-run when enabled changes

  return {
    resetTimer: useCallback(() => {
      // Trigger a click event to reset the timer
      if (enabledRef.current) {
        window.dispatchEvent(new Event('click'));
      }
    }, [])
  };
}
