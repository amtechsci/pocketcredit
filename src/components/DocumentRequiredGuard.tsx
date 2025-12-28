import { useEffect, useState } from 'react';
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

  console.log('🔒 🔒 🔒 DocumentRequiredGuard COMPONENT RENDERED 🔒 🔒 🔒', location.pathname);

  useEffect(() => {
    console.log('🔒 DocumentRequiredGuard: useEffect triggered', { 
      isAuthenticated, 
      hasUser: !!user, 
      pathname: location.pathname 
    });

    if (!isAuthenticated || !user) {
      console.log('🔒 DocumentRequiredGuard: User not authenticated, skipping check');
      setIsChecking(false);
      return;
    }

    const checkDocumentRequirement = async () => {
      try {
        console.log('🔒 DocumentRequiredGuard: Starting document requirement check...');
        setIsChecking(true);
        
        // Get all loan applications
        console.log('🔒 DocumentRequiredGuard: Fetching loan applications...');
        const applicationsResponse = await apiService.getLoanApplications();
        console.log('🔒 DocumentRequiredGuard: Applications response:', applicationsResponse);
        
        // Check for both success formats: success: true OR status: 'success'
        const isSuccess = applicationsResponse.success === true || applicationsResponse.status === 'success';
        console.log('🔒 DocumentRequiredGuard: Response success check:', isSuccess, 'has data?', !!applicationsResponse.data?.applications);
        
        if (isSuccess && applicationsResponse.data?.applications) {
          const applications = applicationsResponse.data.applications;
          console.log('🔒 DocumentRequiredGuard: Found', applications.length, 'applications');
          
          // Check each application for pending document requests
          for (const app of applications) {
            console.log('🔒 DocumentRequiredGuard: Checking app', app.id, 'status:', app.status);
            try {
              // Check validation history for need_document actions
              console.log('🔒 DocumentRequiredGuard: Fetching validation history for app', app.id);
              const validationResponse = await (apiService as any).request(
                'GET',
                `/validation/user/history?loanApplicationId=${app.id}`,
                {}
              );
              console.log('🔒 DocumentRequiredGuard: Validation response for app', app.id, ':', validationResponse);
              
              if (validationResponse.status === 'success' && validationResponse.data && Array.isArray(validationResponse.data)) {
                const documentActions = validationResponse.data.filter(
                  (action: any) => 
                    action.action_type === 'need_document' && 
                    action.loan_application_id === app.id
                );
                console.log('🔒 DocumentRequiredGuard: Found', documentActions.length, 'document actions for app', app.id);
                
                if (documentActions.length > 0) {
                  const latestAction = documentActions[0];
                  const documents = latestAction.action_details?.documents || [];
                  console.log('🔒 DocumentRequiredGuard: Required documents:', documents);
                  
                  if (documents.length > 0) {
                    // Check if all documents are uploaded
                    console.log('🔒 DocumentRequiredGuard: Checking uploaded documents for app', app.id);
                    const docsResponse = await apiService.getLoanDocuments(app.id);
                    console.log('🔒 DocumentRequiredGuard: Uploaded documents response:', docsResponse);
                    
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
                      
                      console.log('🔒 DocumentRequiredGuard: All uploaded?', allUploaded);
                      
                      if (!allUploaded) {
                        // Documents are pending - enforce restriction
                        console.log('🚫 DocumentRequiredGuard: Pending documents found - enforcing upload requirement');
                        console.log('🚫 DocumentRequiredGuard: Missing documents detected');
                        setHasPendingDocuments(true);
                        setApplicationId(app.id);
                        
                        // If user is not on the upload page, redirect them
                        if (!location.pathname.includes('/loan-application/upload-documents')) {
                          console.log('🚫 DocumentRequiredGuard: Blocking access to:', location.pathname);
                          console.log('🚫 DocumentRequiredGuard: Redirecting to upload page for app', app.id);
                          navigate(`/loan-application/upload-documents?applicationId=${app.id}`, { replace: true });
                        } else {
                          console.log('✅ DocumentRequiredGuard: Already on upload page, allowing access');
                        }
                        
                        setIsChecking(false);
                        return;
                      } else {
                        console.log('✅ DocumentRequiredGuard: All required documents uploaded for app', app.id);
                      }
                    }
                  }
                }
              } else {
                console.log('🔒 DocumentRequiredGuard: No validation data for app', app.id);
              }
            } catch (error) {
              console.error('🔒 DocumentRequiredGuard: Error checking validation history for app:', app.id, error);
            }
          }
        } else {
          console.log('🔒 DocumentRequiredGuard: No applications found or invalid response');
        }
        
        // No pending documents found - allow access
        console.log('✅ DocumentRequiredGuard: No pending documents found - allowing access');
        setHasPendingDocuments(false);
        setApplicationId(null);
      } catch (error) {
        console.error('🔒 DocumentRequiredGuard: Error checking document requirement:', error);
        // On error, allow access (fail open)
        setHasPendingDocuments(false);
      } finally {
        console.log('🔒 DocumentRequiredGuard: Check complete, isChecking = false');
        setIsChecking(false);
      }
    };

    checkDocumentRequirement();
  }, [isAuthenticated, user, location.pathname, navigate]);

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

