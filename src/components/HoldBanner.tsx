import React from 'react';
import { AlertCircle, Clock, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface HoldInfo {
  is_on_hold: boolean;
  hold_type: 'permanent' | 'temporary';
  hold_reason: string;
  hold_until?: string;
  hold_until_formatted?: string;
  remaining_days?: number;
  is_expired?: boolean;
  status?: string;
}

interface HoldBannerProps {
  holdInfo: HoldInfo | null;
}

export function HoldBanner({ holdInfo }: HoldBannerProps) {
  // Check if user is deleted
  const isDeleted = holdInfo?.status === 'deleted';
  
  if (isDeleted) {
    return (
      <div className="mb-6">
        <Alert variant="destructive" className="border-red-600 bg-red-100">
          <XCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">
            Your profile is purged in our system
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm">
              Thank you.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!holdInfo || !holdInfo.is_on_hold) {
    return null;
  }

  const isPermanent = holdInfo.hold_type === 'permanent';
  const isExpired = holdInfo.is_expired;
  const isCoolingPeriod = holdInfo.hold_type === 'cooling_period' || (holdInfo.hold_until && !isPermanent);

  return (
    <div className="mb-6">
      {isPermanent ? (
        // Permanent Hold (Not Process) - Red
        <Alert variant="destructive" className="border-red-500 bg-red-50">
          <XCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">
            Your profile is temporarily locked
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="text-sm">
              We will update you if it's unlocked.
            </p>
            {holdInfo.hold_reason && (
              <div className="bg-white/50 p-3 rounded border border-red-200">
                <p className="text-sm font-medium">Reason:</p>
                <p className="text-sm">{holdInfo.hold_reason}</p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : isCoolingPeriod && !isExpired ? (
        // Cooling Period (Re-process) - Orange/Yellow
        <Alert className="border-orange-500 bg-orange-50">
          <Clock className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-lg font-semibold text-orange-900">
            Your profile is under cooling period
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-orange-800">
              We will update you once you are eligible.
            </p>
            {holdInfo.hold_until_formatted && (
              <div className="flex items-center justify-between bg-white/70 p-3 rounded border border-orange-200">
                <div>
                  <p className="text-xs text-orange-700">Eligible After:</p>
                  <p className="text-sm font-semibold text-orange-900">
                    {holdInfo.hold_until_formatted}
                  </p>
                </div>
                {holdInfo.remaining_days !== undefined && (
                  <div className="text-right">
                    <p className="text-xs text-orange-700">Remaining Days:</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {holdInfo.remaining_days}
                    </p>
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : isExpired ? (
        // Expired Hold - Green
        <Alert className="border-green-500 bg-green-50">
          <AlertCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-lg font-semibold text-green-900">
            Hold Period Expired
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm text-green-800">
              Your hold period has expired. You can now continue with your application.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        // Temporary Hold - Orange/Yellow
        <Alert className="border-orange-500 bg-orange-50">
          <Clock className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-lg font-semibold text-orange-900">
            Application Temporarily On Hold
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-orange-800">
              Your loan application has been placed on temporary hold.
            </p>
            <div className="bg-white/50 p-3 rounded border border-orange-200">
              <p className="text-sm font-medium text-orange-900">Reason:</p>
              <p className="text-sm text-orange-800">{holdInfo.hold_reason}</p>
            </div>
            <div className="flex items-center justify-between bg-white/70 p-3 rounded border border-orange-200">
              <div>
                <p className="text-xs text-orange-700">Hold Until:</p>
                <p className="text-sm font-semibold text-orange-900">
                  {holdInfo.hold_until_formatted}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-orange-700">Remaining Days:</p>
                <p className="text-2xl font-bold text-orange-600">
                  {holdInfo.remaining_days}
                </p>
              </div>
            </div>
            <p className="text-xs text-orange-700 mt-2">
              You can reapply after the hold period expires.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

