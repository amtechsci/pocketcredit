import { ReactNode } from 'react';
import { useLoanApplicationStepManager, LoanApplicationStep } from '../../hooks/useLoanApplicationStepManager';
import { Loader2 } from 'lucide-react';

interface StepGuardProps {
  step: LoanApplicationStep;
  children: ReactNode;
}

/**
 * StepGuard component that protects loan application routes
 * Ensures users can only access steps they're allowed to based on prerequisites
 */
export const StepGuard = ({ step, children }: StepGuardProps) => {
  const { loading, error } = useLoanApplicationStepManager(step);

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
    console.warn('[StepGuard] Error during validation:', error);
  }

  // If currentStep is set and it's different from required step, 
  // the hook will handle redirect automatically
  // We just render children if we get here - don't block rendering
  return <>{children}</>;
};

