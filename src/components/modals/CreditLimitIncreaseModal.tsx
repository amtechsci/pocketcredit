import { useState } from 'react';
import { CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
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


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            <h2 className="text-xl font-bold">Credit Limit Increase</h2>
          </div>
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

          </div>

          {/* Actions */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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

