import { useState, useEffect } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { SharedExtensionLetterDocument } from '../shared/SharedExtensionLetterDocument';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
// @ts-ignore - Cashfree SDK doesn't have TypeScript definitions
import { load } from '@cashfreepayments/cashfree-js';

interface ExtensionLetterModalProps {
  loanId: number;
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => Promise<void>;
}

export function ExtensionLetterModal({ loanId, isOpen, onClose, onAccept }: ExtensionLetterModalProps) {
  const [extensionData, setExtensionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (isOpen && loanId) {
      fetchExtensionLetter();
    } else {
      // Reset state when modal closes
      setExtensionData(null);
      setAccepted(false);
    }
  }, [isOpen, loanId]);

  const fetchExtensionLetter = async () => {
    try {
      setLoading(true);
      const response = await apiService.getExtensionLetter(loanId);
      if (response.success && response.data) {
        setExtensionData(response.data);
      } else {
        toast.error(response.message || 'Failed to load extension letter');
        onClose();
      }
    } catch (error: any) {
      console.error('Error fetching extension letter:', error);
      toast.error(error.message || 'Failed to load extension letter');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!extensionData) return;

    try {
      setAccepting(true);
      toast.loading('Submitting extension request...');

      // Step 1: Submit extension request (creates extension with pending_payment status)
      const extensionRequestResponse = await apiService.requestLoanExtension(loanId, 'Requesting loan tenure extension');
      
      if (!extensionRequestResponse.success) {
        throw new Error(extensionRequestResponse.message || 'Failed to submit extension request');
      }

      // Step 2: Get the extension ID from the response
      const extensionId = extensionRequestResponse.data?.extension_id;
      
      if (!extensionId) {
        throw new Error('Extension ID not found in response');
      }

      toast.loading('Creating payment order...');

      // Step 3: Create payment order for extension fee
      const paymentResponse = await apiService.createExtensionPayment(extensionId);
      
      if (!paymentResponse.success || !paymentResponse.data?.paymentSessionId) {
        throw new Error(paymentResponse.message || 'Failed to create payment order');
      }

      toast.success('Opening payment gateway...');

      // Step 4: Open payment gateway
      try {
        const isProduction = paymentResponse.data.checkoutUrl?.includes('payments.cashfree.com') && 
                           !paymentResponse.data.checkoutUrl?.includes('payments-test');
        
        const cashfree = await load({ 
          mode: isProduction ? "production" : "sandbox"
        });

        if (cashfree) {
          // Close modal before opening payment gateway
          onClose();
          
          cashfree.checkout({
            paymentSessionId: paymentResponse.data.paymentSessionId
          });
        } else {
          throw new Error('Failed to load Cashfree SDK');
        }
      } catch (sdkError: any) {
        console.error('Cashfree SDK error:', sdkError);
        toast.error('Failed to open payment gateway. Please try again.');
        
        // Fallback: redirect to checkout URL
        if (paymentResponse.data.checkoutUrl) {
          window.location.href = paymentResponse.data.checkoutUrl;
        } else {
          throw new Error('No payment session available');
        }
      }
    } catch (error: any) {
      console.error('Error accepting extension:', error);
      toast.error(error.message || 'Failed to submit extension request');
      setAccepting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Loan Extension Letter</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={accepting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading extension letter...</span>
            </div>
          ) : extensionData ? (
            <div className="extension-letter-content">
              <SharedExtensionLetterDocument extensionData={extensionData} />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600">
              Failed to load extension letter
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !accepted && extensionData && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Please read the extension letter carefully. After accepting, you will be redirected to payment gateway to pay the extension fee.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={accepting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {accepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept & Pay Extension Fee
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

