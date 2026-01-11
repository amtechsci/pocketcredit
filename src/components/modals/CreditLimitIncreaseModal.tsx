import { useState } from 'react';
import { X, CheckCircle, XCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface CreditLimitIncreaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingLimit: {
    id: number;
    newLimit: number;
    currentLimit: number;
    percentage?: number;
    loanCount?: number;
    isPremiumLimit: boolean;
    premiumTenure?: number;
  };
  onAccept: () => void;
}

export function CreditLimitIncreaseModal({
  isOpen,
  onClose,
  pendingLimit,
  onAccept
}: CreditLimitIncreaseModalProps) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    try {
      setAccepting(true);
      const response = await apiService.acceptCreditLimit(pendingLimit.id);
      
      if (response.success) {
        toast.success('Credit limit increase accepted successfully!');
        onAccept();
        onClose();
      } else {
        toast.error(response.message || 'Failed to accept credit limit increase');
      }
    } catch (error: any) {
      console.error('Error accepting credit limit:', error);
      toast.error(error.message || 'Failed to accept credit limit increase');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    try {
      setRejecting(true);
      const response = await apiService.rejectCreditLimit(pendingLimit.id);
      
      if (response.success) {
        toast.success('Credit limit increase rejected');
        onClose();
      } else {
        toast.error(response.message || 'Failed to reject credit limit increase');
      }
    } catch (error: any) {
      console.error('Error rejecting credit limit:', error);
      toast.error(error.message || 'Failed to reject credit limit increase');
    } finally {
      setRejecting(false);
    }
  };

  const increaseAmount = pendingLimit.newLimit - pendingLimit.currentLimit;
  const increasePercentage = ((increaseAmount / pendingLimit.currentLimit) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            <h2 className="text-xl font-bold">Credit Limit Increase</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            disabled={accepting || rejecting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Congratulations! Your credit limit has been increased.
            </p>

            {/* Current Limit */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Current Limit</p>
              <p className="text-2xl font-bold text-gray-700">
                ₹{pendingLimit.currentLimit.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Arrow */}
            <div className="my-4">
              <TrendingUp className="w-8 h-8 mx-auto text-blue-600" />
            </div>

            {/* New Limit */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">New Limit</p>
              <p className="text-3xl font-bold text-blue-600">
                ₹{pendingLimit.newLimit.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Increase Amount */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                <span className="font-semibold">+₹{increaseAmount.toLocaleString('en-IN')}</span>
                {' '}({increasePercentage}% increase)
              </p>
            </div>

            {/* Premium Limit Info */}
            {pendingLimit.isPremiumLimit && pendingLimit.premiumTenure && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Premium Loan Available
                    </p>
                    <p className="text-xs text-blue-700">
                      You are now eligible for a premium loan of ₹1,50,000 with {pendingLimit.premiumTenure} EMIs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Info */}
            {pendingLimit.percentage && (
              <div className="text-xs text-gray-500 mt-4">
                Based on {pendingLimit.percentage}% of your salary
                {pendingLimit.loanCount && ` • ${pendingLimit.loanCount} loan${pendingLimit.loanCount > 1 ? 's' : ''} completed`}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={accepting || rejecting}
              className="flex-1"
            >
              {rejecting ? (
                <>
                  <XCircle className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={accepting || rejecting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {accepting ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            By accepting, you agree to the new credit limit terms and conditions.
          </p>
        </div>
      </div>
    </div>
  );
}

