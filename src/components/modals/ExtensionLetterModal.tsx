import { useState, useEffect } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { SharedExtensionLetterDocument } from '../shared/SharedExtensionLetterDocument';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

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

      // Step 1: Get HTML content from the extension letter document
      const extensionLetterElement = document.querySelector('.extension-letter-content');
      if (!extensionLetterElement) {
        throw new Error('Extension letter content not found');
      }

      const htmlContent = extensionLetterElement.outerHTML;

      // Step 2: Send extension letter to email
      try {
        const emailResponse = await apiService.sendExtensionLetterEmail(loanId, htmlContent);
        if (emailResponse.success) {
          toast.success('Extension letter sent to your email');
        } else {
          console.warn('Email sending failed (non-fatal):', emailResponse.message);
          // Continue even if email fails
        }
      } catch (emailError: any) {
        console.error('Error sending email (non-fatal):', emailError);
        // Continue even if email fails
      }

      // Step 2: Submit extension request
      await onAccept();
      
      setAccepted(true);
      toast.success('Extension request submitted successfully!');
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error accepting extension:', error);
      toast.error(error.message || 'Failed to submit extension request');
    } finally {
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
          ) : accepted ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Extension Request Submitted!</h3>
              <p className="text-gray-600 text-center">
                Your extension request has been submitted and the extension letter has been sent to your email.
              </p>
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
              Please read the extension letter carefully before accepting.
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
                    Accept & Submit Request
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

