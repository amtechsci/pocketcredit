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

    // Get application ID from location state or URL params
    const stateAppId = (location.state as any)?.applicationId;
    if (stateAppId) {
      setApplicationId(stateAppId);
      fetchRequiredDocuments(stateAppId);
    } else {
      // Try to get from user's latest loan application
      fetchLatestLoanApplication();
    }
  }, [isAuthenticated, navigate, location]);

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
      
      // Try to fetch validation history from user endpoint
      try {
        const response = await apiService.request('GET', `/validation/user/history?loanApplicationId=${appId}`, {});
        
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
              
              // Fetch existing uploaded documents
              try {
                const docsResponse = await apiService.getLoanDocuments(appId);
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
                    // All documents uploaded, redirect to application pending page
                    console.log('✅ All required documents are uploaded, redirecting...');
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
      
      // Try to fetch existing documents even with defaults
      try {
        const docsResponse = await apiService.getLoanDocuments(appId);
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
    setUploadedDocuments(prev => ({
      ...prev,
      [documentName]: documentData
    }));
    toast.success(`${documentName} uploaded successfully!`);
    
    // Refresh the documents list to ensure we have the latest data
    if (applicationId) {
      try {
        const docsResponse = await apiService.getLoanDocuments(applicationId);
        console.log('📄 Documents response (after upload):', docsResponse);
        if ((docsResponse.success || docsResponse.status === 'success') && docsResponse.data?.documents) {
          const uploadedDocsMap: { [key: string]: any } = {};
          docsResponse.data.documents.forEach((doc: any) => {
            uploadedDocsMap[doc.document_name] = doc;
            console.log(`✅ Found uploaded document: ${doc.document_name}`);
          });
          setUploadedDocuments(uploadedDocsMap);
        } else {
          console.log('⚠️ No documents found after upload');
        }
      } catch (error) {
        console.log('Could not refresh documents list:', error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!applicationId) {
      toast.error('Application ID not found');
      return;
    }

    // Check if all required documents are uploaded
    const missingDocuments = requiredDocuments.filter(
      doc => !uploadedDocuments[doc]
    );

    if (missingDocuments.length > 0) {
      toast.error(`Please upload all required documents: ${missingDocuments.join(', ')}`);
      return;
    }

    try {
      setSubmitting(true);
      
      // Submit all uploaded documents
      // Note: This would need a backend API endpoint to save document uploads for loan application
      // For now, we'll just show success and update status
      
      toast.success('All documents uploaded successfully! Your application will be reviewed.');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error submitting documents:', error);
      toast.error('Failed to submit documents. Please try again.');
    } finally {
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
                    disabled={submitting || requiredDocuments.some(doc => !uploadedDocuments[doc])}
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

