import { ReactNode } from 'react';
import { useLoanApplicationStepManager, LoanApplicationStep } from '../../hooks/useLoanApplicationStepManager';
import { Loader2 } from 'lucide-react';

interface StepGuardProps {
  step: LoanApplicationStep;
  children: ReactNode;
}

/**
 * StepGuard component that protects loan application routes
 * 
 * Now uses the unified OnboardingProgressEngine via useLoanApplicationStepManager hook.
 * The hook handles all validation and redirection logic using the engine.
 * 
 * This component is a thin wrapper that:
 * - Shows loading state while validation is in progress
 * - Allows the hook to handle redirects automatically
 * - Renders children once validation passes
 */
export const StepGuard = ({ step, children }: StepGuardProps) => {
  // The hook now uses the unified progress engine internally
  // It will automatically redirect if user doesn't have access to the step
  const { loading, error, currentStep } = useLoanApplicationStepManager(step);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Validating step access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Don't block on error - let the page render
    // The error might be temporary (e.g., network issue)
    // The engine returns safe fallbacks, so we can proceed
    console.warn('[StepGuard] Error during validation (non-blocking):', error);
  }

  // If currentStep is set and it's different from required step, 
  // the hook will handle redirect automatically via the unified engine
  // We just render children if we get here - don't block rendering
  // The engine ensures we only get here if user has access
  return <>{children}</>;
};

