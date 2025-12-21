import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, X, FileText } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function PendingDocumentNotification() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsVisible(false);
      return;
    }

    const checkPendingDocuments = async () => {
      try {
        setIsLoading(true);
        
        // Get user's latest loan application
        const dashboardResponse = await apiService.getDashboardSummary();
        const latestApplication = (dashboardResponse.data as any)?.latest_application;
        
        if (!latestApplication || !latestApplication.id) {
          setIsVisible(false);
          return;
        }

        // Fetch validation history to check for pending document requests
        const validationResponse = await apiService.request(
          'GET',
          `/validation/user/history?loanApplicationId=${latestApplication.id}`,
          {}
        );

        if (validationResponse.status === 'success' && validationResponse.data) {
          // Find the latest "need_document" action for this application
          const documentActions = validationResponse.data.filter(
            (action: any) => action.action_type === 'need_document' && action.loan_application_id === latestApplication.id
          );

          if (documentActions.length > 0) {
            const latestAction = documentActions[0];
            const documents = latestAction.action_details?.documents || [];
            
            if (documents.length > 0) {
              // Check which documents are still pending (not uploaded)
              try {
                const docsResponse = await apiService.getLoanDocuments(latestApplication.id);
                const uploadedDocs: string[] = [];
                
                if ((docsResponse.success || docsResponse.status === 'success') && docsResponse.data?.documents) {
                  docsResponse.data.documents.forEach((doc: any) => {
                    if (doc.upload_status === 'verified' || doc.upload_status === 'pending') {
                      uploadedDocs.push(doc.document_name);
                    }
                  });
                }

                // Filter out already uploaded documents
                const stillPending = documents.filter((doc: string) => !uploadedDocs.includes(doc));
                
                if (stillPending.length > 0) {
                  setPendingDocuments(stillPending);
                  setIsVisible(true);
                } else {
                  setIsVisible(false);
                }
              } catch (error) {
                // If we can't check uploaded docs, show all requested documents
                setPendingDocuments(documents);
                setIsVisible(true);
              }
            } else {
              setIsVisible(false);
            }
          } else {
            setIsVisible(false);
          }
        } else {
          setIsVisible(false);
        }
      } catch (error) {
        console.error('Error checking pending documents:', error);
        setIsVisible(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPendingDocuments();
    
    // Check every 30 seconds for new pending documents
    const interval = setInterval(checkPendingDocuments, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  if (!isVisible || pendingDocuments.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">
                Pending Document Upload Required
              </p>
              <p className="text-xs opacity-90">
                Admin has requested the following documents: {pendingDocuments.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/loan-documents')}
              className="px-4 py-1.5 bg-white text-yellow-600 rounded-md hover:bg-yellow-50 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Upload Now
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-white hover:text-yellow-100 p-1 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

