/**
 * Over Due tab: lists loan applications with status = overdue.
 * Used by Recovery Officer, Debt Agency, and NBFC Admin.
 */
import { LoanApplicationsQueue } from './LoanApplicationsQueue';

export function OverduePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Over Due</h1>
      </div>
      <LoanApplicationsQueue initialStatus="overdue" />
    </div>
  );
}
