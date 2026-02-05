import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { LoanDocumentUpload } from '../LoanDocumentUpload';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { DashboardHeader } from '../DashboardHeader';
import { useLoanApplicationStepManager, STEP_ROUTES } from '../../hooks/useLoanApplicationStepManager';

export const LoanDocumentUploadPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Check prerequisites and redirect to current step if needed
    const initializePage = async () => {
      // Get application ID from URL params, location state, or fetch latest
      const urlParams = new URLSearchParams(location.search);
      const urlAppId = urlParams.get('applicationId');
      const stateAppId = (location.state as any)?.applicationId;
      let appId = urlAppId || stateAppId;
      
      // If no appId, try to get from latest application
      if (!appId) {
        try {
          const response = await apiService.getLoanApplications();
          if (response.success && response.data && response.data.applications) {
            const followUpApp = response.data.applications.find(
              (app: any) => app.status === 'follow_up'
            );
            if (followUpApp) {
              appId = followUpApp.id;
            }
          }
        } catch (error) {
          console.error('Error fetching applications:', error);
        }
      }
      
      if (appId) {
        const id = parseInt(appId);
        if (!isNaN(id)) {
          // Check email verification and get current step from loan application
          try {
            // Check email verification
            const profileResponse = await apiService.getUserProfile();
            const userData = profileResponse.status === 'success' && profileResponse.data?.user 
              ? profileResponse.data.user 
              : user;
            
            if (userData && !userData.personal_email_verified) {
              console.log('⚠️ Email verification pending, redirecting to email verification');
              navigate('/email-verification', { replace: true });
              return;
            }
            
            // Get current step from loan application - use forceRefresh to bypass cache
            const appResponse = await apiService.getLoanApplicationById(id, { cache: false, skipDeduplication: true });
            if (appResponse.success && appResponse.data?.application) {
              const currentStep = appResponse.data.application.current_step;
              
              // If current step is not upload-documents, redirect to current step
              if (currentStep && currentStep !== 'upload-documents') {
                console.log(`⚠️ Current step is ${currentStep}, redirecting from upload-documents`);
                const stepRoutes: { [key: string]: string } = {
                  'kyc-verification': `/loan-application/kyc-verification?applicationId=${id}`,
                  'employment-details': `/loan-application/employment-details?applicationId=${id}`,
                  'bank-statement': `/loan-application/bank-statement?applicationId=${id}`,
                  'bank-details': `/link-salary-bank-account?applicationId=${id}`,
                  'references': '/user-references',
                  'steps': `/application-under-review?applicationId=${id}`
                };
                const route = stepRoutes[currentStep] || STEP_ROUTES[currentStep as keyof typeof STEP_ROUTES] || '/dashboard';
                navigate(route, { replace: true });
                return;
              }
            }
            
            // Current step is upload-documents or couldn't determine, proceed
            setApplicationId(id);
            fetchRequiredDocuments(id);
            return;
          } catch (error) {
            console.error('Error checking prerequisites:', error);
            // Continue with document upload if check fails
          }
        }
      }
      
      // No application ID or check failed, try to get from latest loan application
      fetchLatestLoanApplication();
    };

    initializePage();
  }, [isAuthenticated, navigate, location, user]);

  const fetchLatestLoanApplication = async () => {
    try {
      const response = await apiService.getLoanApplications();
      if (response.success && response.data && response.data.applications) {
        const followUpApp = response.data.applications.find(
          (app: any) => app.status === 'follow_up'
        );
        if (followUpApp) {
          setApplicationId(followUpApp.id);
          fetchRequiredDocuments(followUpApp.id);
        } else {
          toast.error('No loan application found that requires document upload');
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error fetching loan applications:', error);
      toast.error('Failed to load loan application');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequiredDocuments = async (appId: number) => {
    try {
      setLoading(true);
      
      // Try to fetch validation history from user endpoint - use forceRefresh to bypass cache
      try {
        const response = await apiService.request('GET', `/validation/user/history?loanApplicationId=${appId}`, {}, { cache: false, skipDeduplication: true });
        
        if (response.status === 'success' && response.data) {
          // Find the latest "need_document" action for this application
          const documentActions = response.data.filter(
            (action: any) => action.action_type === 'need_document' && action.loan_application_id === appId
          );
          
          if (documentActions.length > 0) {
            const latestAction = documentActions[0];
            const documents = latestAction.action_details?.documents || [];
            if (documents.length > 0) {
              setRequiredDocuments(documents);
              
              // Fetch existing uploaded documents - use forceRefresh to bypass cache
              try {
                const docsResponse = await apiService.getLoanDocuments(appId, { cache: false, skipDeduplication: true });
                console.log('📄 Documents response:', docsResponse);
                if ((docsResponse.success || docsResponse.status === 'success') && docsResponse.data?.documents) {
                  const uploadedDocsMap: { [key: string]: any } = {};
                  docsResponse.data.documents.forEach((doc: any) => {
                    // Match documents by document_name
                    uploadedDocsMap[doc.document_name] = doc;
                    console.log(`✅ Found uploaded document: ${doc.document_name}`);
                  });
                  setUploadedDocuments(uploadedDocsMap);
                  
                  // Check if all required documents are uploaded
                  const allUploaded = documents.every((doc: string) => {
                    // Normalize document names for comparison
                    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normalizedDoc = normalize(doc);
                    
                    // Check if document exists in uploaded docs (flexible matching)
                    const uploaded = Object.keys(uploadedDocsMap).some(uploadedDoc => {
                      const normalizedUploaded = normalize(uploadedDoc);
                      // Check for exact match, contains match, or partial match
                      return normalizedDoc === normalizedUploaded ||
                             normalizedDoc.includes(normalizedUploaded) ||
                             normalizedUploaded.includes(normalizedDoc) ||
                             // Special cases for common document name variations
                             (normalizedDoc.includes('aadhar') && normalizedUploaded.includes('aadhaar')) ||
                             (normalizedDoc.includes('aadhaar') && normalizedUploaded.includes('aadhar')) ||
                             (normalizedDoc.includes('pan') && normalizedUploaded.includes('pan'));
                    });
                    return uploaded;
                  });
                  
                  if (allUploaded && documents.length > 0) {
                    // All documents uploaded, check for pending steps before redirecting
                    console.log('✅ All required documents are uploaded, checking pending steps...');
                    
                    // All documents uploaded, get current step from loan application
                    try {
                      // Check email verification first
                      const profileResponse = await apiService.getUserProfile();
                      const userData = profileResponse.status === 'success' && profileResponse.data?.user 
                        ? profileResponse.data.user 
                        : user;
                      
                      if (userData && !userData.personal_email_verified) {
                        console.log('⚠️ Email verification pending, redirecting to email verification');
                        toast.info('Please complete email verification before proceeding');
                        setTimeout(() => {
                          navigate('/email-verification', { 
                            state: { applicationId: appId } 
                          });
                        }, 1500);
                        setLoading(false);
                        return;
                      }
                      
                      // Use progress engine with forceRefresh to determine next step
                      try {
                        const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
                        const progress = await getOnboardingProgress(appId, true); // forceRefresh = true
                        const nextRoute = getStepRoute(progress.currentStep, appId);
                        console.log('[LoanDocumentUpload] All documents uploaded, next step:', progress.currentStep, '->', nextRoute);
                        
                        toast.success('All required documents have been uploaded!');
                        setTimeout(() => {
                          navigate(nextRoute, { replace: true });
                        }, 1500);
                      } catch (progressError) {
                        console.error('[LoanDocumentUpload] Error getting progress, using fallback:', progressError);
                        // Fallback: get current step from loan application
                        const appResponse = await apiService.getLoanApplicationById(appId, { cache: false, skipDeduplication: true });
                        if (appResponse.success && appResponse.data?.application) {
                          const currentStep = appResponse.data.application.current_step;
                          // Map current_step to route
                          const stepRoutes: { [key: string]: string } = {
                            'kyc-verification': `/loan-application/kyc-verification?applicationId=${appId}`,
                            'employment-details': `/loan-application/employment-details?applicationId=${appId}`,
                            'bank-statement': `/loan-application/bank-statement?applicationId=${appId}`,
                            'bank-details': `/link-salary-bank-account?applicationId=${appId}`,
                            'references': '/user-references',
                            'upload-documents': `/loan-application/upload-documents?applicationId=${appId}`,
                            'steps': `/application-under-review?applicationId=${appId}`
                          };
                          const route = stepRoutes[currentStep] || `/application-under-review?applicationId=${appId}`;
                          
                          toast.success('All required documents have been uploaded!');
                          setTimeout(() => {
                            navigate(route, { replace: true });
                          }, 1500);
                        } else {
                          toast.success('All required documents have been uploaded!');
                          setTimeout(() => {
                            navigate('/application-under-review');
                          }, 1500);
                        }
                      }
                    } catch (error) {
                      console.error('Error getting loan application:', error);
                      toast.success('All required documents have been uploaded!');
                      setTimeout(() => {
                        navigate('/application-under-review');
                      }, 1500);
                    }
                    setLoading(false);
                    return;
                  }
                } else {
                  console.log('⚠️ No documents found or invalid response format');
                }
              } catch (docsError) {
                console.error('❌ Could not fetch existing documents:', docsError);
              }
              
              setLoading(false);
              return;
            }
          }
        }
      } catch (validationError) {
        console.log('Could not fetch validation history, using defaults:', validationError);
      }
      
      // Fallback to default required documents
      setRequiredDocuments([
        'Last 3 month bank statement up to date',
        'Latest one month pay slip/salary slip',
        'Aadhar front side',
        'Aadhar back side',
        'PAN card'
      ]);
      
      // Try to fetch existing documents even with defaults - use forceRefresh to bypass cache
      try {
        const docsResponse = await apiService.getLoanDocuments(appId, { cache: false, skipDeduplication: true });
        console.log('📄 Documents response (fallback):', docsResponse);
        if ((docsResponse.success || docsResponse.status === 'success') && docsResponse.data?.documents) {
          const uploadedDocsMap: { [key: string]: any } = {};
          docsResponse.data.documents.forEach((doc: any) => {
            uploadedDocsMap[doc.document_name] = doc;
            console.log(`✅ Found uploaded document: ${doc.document_name}`);
          });
          setUploadedDocuments(uploadedDocsMap);
          
          // Check if all required documents are uploaded (fallback check)
          const defaultDocs = [
            'Last 3 month bank statement up to date',
            'Latest one month pay slip/salary slip',
            'Aadhar front side',
            'Aadhar back side',
            'PAN card'
          ];
          
          const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const allUploaded = defaultDocs.every((doc: string) => {
            const normalizedDoc = normalize(doc);
            // Check if document exists in uploaded docs (flexible matching)
            const uploaded = Object.keys(uploadedDocsMap).some(uploadedDoc => {
              const normalizedUploaded = normalize(uploadedDoc);
              return normalizedDoc === normalizedUploaded ||
                     normalizedDoc.includes(normalizedUploaded) ||
                     normalizedUploaded.includes(normalizedDoc) ||
                     (normalizedDoc.includes('aadhar') && normalizedUploaded.includes('aadhaar')) ||
                     (normalizedDoc.includes('aadhaar') && normalizedUploaded.includes('aadhar')) ||
                     (normalizedDoc.includes('pan') && normalizedUploaded.includes('pan'));
            });
            return uploaded;
          });
          
          if (allUploaded && requiredDocuments.length === defaultDocs.length) {
            // All documents uploaded, redirect to application pending page
            console.log('✅ All required documents are uploaded (fallback), redirecting...');
            toast.success('All required documents have been uploaded!');
            setTimeout(() => {
              navigate('/application-under-review', { 
                state: { applicationId: appId } 
              });
            }, 1500);
            setLoading(false);
            return;
          }
        } else {
          console.log('⚠️ No documents found or invalid response format (fallback)');
        }
      } catch (docsError) {
        console.error('❌ Could not fetch existing documents:', docsError);
      }
    } catch (error) {
      console.error('Error fetching required documents:', error);
      // Fallback to default required documents
      setRequiredDocuments([
        'Last 3 month bank statement up to date',
        'Latest one month pay slip/salary slip',
        'Aadhar front side',
        'Aadhar back side',
        'PAN card'
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (documentName: string, documentData: any) => {
    if (!applicationId) return;
    
    // Clear caches related to documents and validation to ensure fresh data
    apiService.clearCache('/loan-documents');
    apiService.clearCache('/validation');
    apiService.clearCache(`/loan-applications/${applicationId}`);
    
    // Refresh the documents list to ensure we have the latest data - use forceRefresh to bypass cache
    try {
      const docsResponse = await apiService.getLoanDocuments(applicationId, { cache: false, skipDeduplication: true });
      console.log('📄 Documents response (after upload):', docsResponse);
      if ((docsResponse.success || docsResponse.status === 'success') && docsResponse.data?.documents) {
        const uploadedDocsMap: { [key: string]: any } = {};
        
        // Helper function to normalize document names for matching
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedDocName = normalize(documentName);
        
        docsResponse.data.documents.forEach((doc: any) => {
          const normalizedDoc = normalize(doc.document_name || '');
          // Match by exact name or normalized comparison
          if (normalizedDoc === normalizedDocName || 
              normalizedDoc.includes(normalizedDocName) || 
              normalizedDocName.includes(normalizedDoc)) {
            uploadedDocsMap[documentName] = doc;
            // Also map by actual document name from backend
            uploadedDocsMap[doc.document_name] = doc;
          } else {
            uploadedDocsMap[doc.document_name] = doc;
          }
          console.log(`✅ Found uploaded document: ${doc.document_name}`);
        });
        
        setUploadedDocuments(prev => ({
          ...prev,
          ...uploadedDocsMap,
          [documentName]: documentData || uploadedDocsMap[documentName]
        }));
        
        toast.success(`${documentName} uploaded successfully!`);
      } else {
        // Fallback: use the documentData directly
        setUploadedDocuments(prev => ({
          ...prev,
          [documentName]: documentData
        }));
        toast.success(`${documentName} uploaded successfully!`);
      }
    } catch (error) {
      console.error('Could not refresh documents list:', error);
      // Fallback: use the documentData directly
      setUploadedDocuments(prev => ({
        ...prev,
        [documentName]: documentData
      }));
      toast.success(`${documentName} uploaded successfully!`);
    }
  };

  const handleSubmit = async () => {
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    try {
      setSubmitting(true);
      
      // Refresh documents list to verify all are uploaded - use forceRefresh to bypass cache
      const docsResponse = await apiService.getLoanDocuments(applicationId, { cache: false, skipDeduplication: true });
      
      if (docsResponse.success || docsResponse.status === 'success') {
        const uploadedDocs = docsResponse.data?.documents || [];
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check if all required documents are uploaded
        const missingDocuments: string[] = [];
        
        requiredDocuments.forEach((requiredDoc: string) => {
          const normalizedRequired = normalize(requiredDoc);
          const isUploaded = uploadedDocs.some((uploaded: any) => {
            const normalizedUploaded = normalize(uploaded.document_name || '');
            return normalizedRequired === normalizedUploaded ||
                   normalizedRequired.includes(normalizedUploaded) ||
                   normalizedUploaded.includes(normalizedRequired) ||
                   (normalizedRequired.includes('aadhar') && normalizedUploaded.includes('aadhaar')) ||
                   (normalizedRequired.includes('aadhaar') && normalizedUploaded.includes('aadhar')) ||
                   (normalizedRequired.includes('pan') && normalizedUploaded.includes('pan'));
          });
          
          if (!isUploaded) {
            missingDocuments.push(requiredDoc);
          }
        });

        if (missingDocuments.length > 0) {
          toast.error(`Please upload all required documents: ${missingDocuments.join(', ')}`);
          setSubmitting(false);
          return;
        }
        
        // All documents are uploaded, get current step from loan application
        console.log('✅ All documents uploaded, getting current step...');
        
        try {
          // Check email verification first
          const profileResponse = await apiService.getUserProfile();
          const userData = profileResponse.status === 'success' && profileResponse.data?.user 
            ? profileResponse.data.user 
            : user;
          
          if (userData && !userData.personal_email_verified) {
            console.log('⚠️ Email verification pending, redirecting to email verification');
            toast.info('Please complete email verification before proceeding');
            setTimeout(() => {
              navigate('/email-verification', { 
                state: { applicationId: applicationId } 
              });
            }, 1500);
            setSubmitting(false);
            return;
          }
          
          // Use unified progress engine with forceRefresh to determine next step
          toast.success('All documents uploaded successfully!');
          setTimeout(async () => {
            try {
              const { getOnboardingProgress, getStepRoute } = await import('../../utils/onboardingProgressEngine');
              const progress = await getOnboardingProgress(applicationId, true); // forceRefresh = true
              const nextRoute = getStepRoute(progress.currentStep, applicationId);
              console.log('[LoanDocumentUpload] Next step from engine:', progress.currentStep, '->', nextRoute);
              navigate(nextRoute, { replace: true });
            } catch (error) {
              console.error('[LoanDocumentUpload] Error getting next step, using fallback:', error);
              // Fallback to under review page
              navigate(`/application-under-review?applicationId=${applicationId}`, { replace: true });
            }
          }, 1500);
        } catch (innerError) {
          console.error('[LoanDocumentUpload] Error checking email or getting next step:', innerError);
          // Fallback: just navigate to under review
          toast.success('All documents uploaded successfully!');
          setTimeout(() => {
            navigate(`/application-under-review?applicationId=${applicationId}`, { replace: true });
          }, 1500);
        }
      } else {
        toast.error('Failed to verify documents. Please try again.');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting documents:', error);
      toast.error('Failed to submit documents. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document requirements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || 'User'} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 p-0 h-auto text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-1">
                  Additional Documents Required
                </h3>
                <p className="text-sm text-yellow-800">
                  Our team needs some additional documents to process your loan application. 
                  Please upload all required documents below.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Document Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Required Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {requiredDocuments.length > 0 ? (
              <>
                {requiredDocuments.map((documentName, index) => {
                  // Convert document name to a valid document type key
                  const documentType = documentName.toLowerCase()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '');
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {index + 1}. {documentName}
                          </span>
                          {uploadedDocuments[documentName] && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        {uploadedDocuments[documentName] && (
                          <span className="text-xs text-green-600 font-medium">Uploaded</span>
                        )}
                      </div>
                      
                      {applicationId && (
                        <LoanDocumentUpload
                          loanApplicationId={applicationId}
                          documentName={documentName}
                          documentType={documentType}
                          label=""
                          description={`Upload ${documentName}`}
                          onUploadSuccess={(doc) => handleDocumentUpload(documentName, doc)}
                          onUploadError={(error) => toast.error(`Failed to upload ${documentName}: ${error}`)}
                          existingFile={uploadedDocuments[documentName]}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit All Documents
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No documents required at this time.</p>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4"
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoanDocumentUploadPage;

