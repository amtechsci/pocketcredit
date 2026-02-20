import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Mail, MessageSquare, Home, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

export const ApplicationUnderReviewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkApplicationStatus();
    // Poll for status updates every 30 seconds
    const interval = setInterval(() => {
      checkApplicationStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkApplicationStatus = async () => {
    try {
      // Check if user has a loan application
      const response = await apiService.getLoanApplications();
      
      console.log('📋 ApplicationUnderReview: API response:', response);
      
      // Check both 'success' and 'status === success' for compatibility
      const isSuccess = response.success === true || response.status === 'success';
      
      if (isSuccess && response.data && response.data.applications && response.data.applications.length > 0) {
        const applications = response.data.applications;
        console.log('📋 ApplicationUnderReview: All applications:', applications);
        
        // Find the most recent application with a post-disbursal status
        const postDisbursalStatuses = ['disbursal', 'ready_for_disbursement', 'repeat_disbursal', 'ready_to_repeat_disbursal'];
        const postDisbursalApp = applications.find((app: any) => postDisbursalStatuses.includes(app.status));
        
        if (postDisbursalApp) {
          console.log(`🔄 ApplicationUnderReview: Found post-disbursal application with status ${postDisbursalApp.status}, redirecting to post-disbursal`);
          setApplicationStatus(postDisbursalApp.status);
          navigate(`/post-disbursal?applicationId=${postDisbursalApp.id}`, { replace: true });
          return;
        }
        
        // If no post-disbursal app, check the latest application for other statuses
        const latestApplication = applications[0];
        console.log('📋 ApplicationUnderReview: Latest application:', latestApplication);
        setApplicationStatus(latestApplication.status);
        
        // If application is approved, redirect to dashboard
        if (latestApplication.status === 'approved') {
          navigate('/dashboard', { replace: true });
        }
      } else {
        console.log('📋 ApplicationUnderReview: No applications found or invalid response structure');
      }
    } catch (error) {
      console.error('❌ ApplicationUnderReview: Error checking application status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 pb-20 md:pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Back to Dashboard</span>
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-12">
        <Card className="shadow-xl border-0">
          <CardContent className="p-4 md:p-8 lg:p-12">
            <div className="text-center">
              {/* Success Icon */}
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 md:w-12 md:h-12 text-green-600" />
                </div>
              </div>

              {/* Main Message - show Verification Pending when in follow_up, Under Review otherwise */}
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 md:mb-4 leading-tight">
                {applicationStatus === 'follow_up'
                  ? 'Verification Pending'
                  : 'Your Loan application is under review'}
              </h1>
              
              <p className="text-base md:text-lg text-gray-600 mb-6 md:mb-8">
                {applicationStatus === 'follow_up'
                  ? 'We have received your documents and will verify them shortly.'
                  : '& will update you shortly.'}
              </p>

              {/* Thank You Message */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 md:p-6 rounded-lg mb-6 md:mb-8">
                <p className="text-base md:text-xl text-gray-800 font-medium">
                  Thank you for choosing us. We will serve you the best.
                </p>
              </div>

              {/* Status Information */}
              <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                <div className="flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base text-gray-600">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                  <span className="break-words">
                    Application Status: <strong className="text-gray-900">
                      {applicationStatus === 'follow_up' ? 'Verification Pending' : 'Under Review'}
                    </strong>
                  </span>
                </div>
                
                <div className="flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base text-gray-600">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                  <span className="break-words">You will receive updates via email</span>
                </div>
                
                <div className="flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base text-gray-600">
                  <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                  <span className="break-words">You will receive updates via SMS</span>
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-gray-50 rounded-lg p-4 md:p-6 mb-6">
                <h3 className="font-semibold text-base md:text-lg text-gray-900 mb-3 text-left">What happens next?</h3>
                <ul className="text-left space-y-2 text-xs md:text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">1.</span>
                    <span>Our team is reviewing your application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">2.</span>
                    <span>We'll verify all your submitted documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">3.</span>
                    <span>You'll receive an update within 24-48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">4.</span>
                    <span>Once approved, funds will be disbursed to your account</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons - Hidden on mobile, shown on desktop */}
              <div className="hidden md:flex md:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="min-w-[150px]"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Button for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-10 shadow-lg">
        <Button
          onClick={() => navigate('/dashboard')}
          className="w-full"
          size="lg"
        >
          <Home className="w-4 h-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default ApplicationUnderReviewPage;

