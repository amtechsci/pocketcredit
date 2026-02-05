import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * DocumentRequiredGuard - Enforces document upload requirement
 * 
 * When admin requests documents via "need_document" action:
 * - User can ONLY access /loan-application/upload-documents
 * - All other routes (including dashboard) are blocked
 * - User is automatically redirected to upload page
 */
export function DocumentRequiredGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [hasPendingDocuments, setHasPendingDocuments] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  
  // Refs to prevent duplicate API calls and infinite loops
  const hasCheckedRef = useRef(false);
  const lastUserIdRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Skip check if user hasn't changed and we've already checked
    const userId = user?.id || null;
    const currentPath = location.pathname;
    
    // If we're on the upload page, always allow (don't block or check)
    if (currentPath.includes('/loan-application/upload-documents')) {
      setIsChecking(false);
      return;
    }
    
    // Only skip if same user AND already checked
    // This allows re-checking when navigating between routes to catch document uploads
    if (hasCheckedRef.current && lastUserIdRef.current === userId) {
      // Reset the check flag to force a fresh check when navigating away from upload page
      // This ensures we catch document uploads after user completes them
      hasCheckedRef.current = false;
    }

    if (!isAuthenticated || !user) {
      setIsChecking(false);
      return;
    }
    
    // Prevent concurrent checks
    if (isCheckingRef.current) {
      return;
    }

    const checkDocumentRequirement = async () => {
      // Double-check to prevent race conditions
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      
      try {
        setIsChecking(true);
        
        // Get all loan applications
        const applicationsResponse = await apiService.getLoanApplications();
        // Check for both success formats: success: true OR status: 'success'
        const isSuccess = applicationsResponse.success === true || applicationsResponse.status === 'success';
        
        if (isSuccess && applicationsResponse.data?.applications) {
          const applications = applicationsResponse.data.applications;
          
          // Check each application for pending document requests
          for (const app of applications) {
            try {
              // Check validation history for need_document actions - use forceRefresh to bypass cache
              const validationResponse = await (apiService as any).request(
                'GET',
                `/validation/user/history?loanApplicationId=${app.id}`,
                {},
                { cache: false, skipDeduplication: true }
              );
              
              if (validationResponse.status === 'success' && validationResponse.data && Array.isArray(validationResponse.data)) {
                const documentActions = validationResponse.data.filter(
                  (action: any) => 
                    action.action_type === 'need_document' && 
                    action.loan_application_id === app.id
                );
                
                if (documentActions.length > 0) {
                  const latestAction = documentActions[0];
                  const documents = latestAction.action_details?.documents || [];
                  
                  if (documents.length > 0) {
                    // Check if all documents are uploaded - use forceRefresh to bypass cache
                    const docsResponse = await apiService.getLoanDocuments(app.id, { 
                      cache: false, 
                      skipDeduplication: true 
                    });
                    
                    if (docsResponse.success || docsResponse.status === 'success') {
                      const uploadedDocs = docsResponse.data?.documents || [];
                      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                      
                      const allUploaded = documents.every((doc: string) => {
                        const normalizedDoc = normalize(doc);
                        return uploadedDocs.some((uploaded: any) => {
                          const normalizedUploaded = normalize(uploaded.document_name || '');
                          return normalizedDoc === normalizedUploaded ||
                                 normalizedDoc.includes(normalizedUploaded) ||
                                 normalizedUploaded.includes(normalizedDoc) ||
                                 (normalizedDoc.includes('aadhar') && normalizedUploaded.includes('aadhaar')) ||
                                 (normalizedDoc.includes('aadhaar') && normalizedUploaded.includes('aadhar')) ||
                                 (normalizedDoc.includes('pan') && normalizedUploaded.includes('pan'));
                        });
                      });
                      
                      if (!allUploaded) {
                        // Documents are pending - enforce restriction
                        setHasPendingDocuments(true);
                        setApplicationId(app.id);
                        
                        // Mark check complete before redirect
                        hasCheckedRef.current = true;
                        lastUserIdRef.current = userId;
                        
                        // If user is not on the upload page, redirect them
                        if (!location.pathname.includes('/loan-application/upload-documents')) {
                          navigate(`/loan-application/upload-documents?applicationId=${app.id}`, { replace: true });
                        }
                        
                        setIsChecking(false);
                        isCheckingRef.current = false;
                        return;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('DocumentRequiredGuard: Error checking app:', app.id, error);
            }
          }
        }
        
        // No pending documents found - allow access
        setHasPendingDocuments(false);
        setApplicationId(null);
      } catch (error) {
        console.error('DocumentRequiredGuard: Error checking document requirement:', error);
        // On error, allow access (fail open)
        setHasPendingDocuments(false);
      } finally {
        // Mark check as complete
        hasCheckedRef.current = true;
        lastUserIdRef.current = userId;
        isCheckingRef.current = false;
        setIsChecking(false);
      }
    };

    checkDocumentRequirement();
  // Re-run when user changes OR when location changes (to catch document uploads)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, location.pathname]);

  // Show loading spinner while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking requirements...</p>
        </div>
      </div>
    );
  }

  // If on upload page, always allow access
  if (location.pathname.includes('/loan-application/upload-documents')) {
    return <>{children}</>;
  }

  // If pending documents exist and user is not on upload page, block access
  if (hasPendingDocuments && applicationId) {
    // This shouldn't render because we redirect above, but as a safety net:
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-6">
            <div className="text-yellow-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Document Upload Required
            </h2>
            <p className="text-gray-700 mb-6">
              Our admin team has requested additional documents for your loan application. 
              Please upload the required documents to continue.
            </p>
            <button
              onClick={() => navigate(`/loan-application/upload-documents?applicationId=${applicationId}`)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Upload Documents Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No pending documents - allow access to page
  return <>{children}</>;
}

