/**
 * Over Due tab: lists loan applications with status = overdue.
 * Used by Recovery Officer, Debt Agency, and NBFC Admin.
 */
import { LoanApplicationsQueue } from './LoanApplicationsQueue';

export function OverduePage() {
  return (
    <div className="space-y-4">
      <LoanApplicationsQueue initialStatus="overdue" />
    </div>
  );
}
