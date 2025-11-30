import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Mail, MessageSquare, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
      
      if (response.success && response.data && response.data.applications && response.data.applications.length > 0) {
        const latestApplication = response.data.applications[0];
        setApplicationStatus(latestApplication.status);
        
        // If application is approved or disbursed, redirect to dashboard
        if (['approved', 'disbursed'].includes(latestApplication.status)) {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking application status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="shadow-xl border-0">
          <CardContent className="p-8 md:p-12">
            <div className="text-center">
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>

              {/* Main Message */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Your Loan application is under review
              </h1>
              
              <p className="text-lg text-gray-600 mb-8">
                & will update you shortly.
              </p>

              {/* Thank You Message */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-8">
                <p className="text-xl text-gray-800 font-medium">
                  Thank you for choosing us. We will serve you the best.
                </p>
              </div>

              {/* Status Information */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>Application Status: <strong className="text-gray-900">Under Review</strong></span>
                </div>
                
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <span>You will receive updates via email</span>
                </div>
                
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span>You will receive updates via SMS</span>
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
                <ul className="text-left space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">1.</span>
                    <span>Our team is reviewing your application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">2.</span>
                    <span>We'll verify all your submitted documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">3.</span>
                    <span>You'll receive an update within 24-48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">4.</span>
                    <span>Once approved, funds will be disbursed to your account</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
    </div>
  );
};

export default ApplicationUnderReviewPage;

