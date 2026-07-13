import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Clock, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { getOnboardingProgress, getStepRoute } from '../../utils/onboardingProgressEngine';

export const EmploymentDocsPendingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationIdParam = searchParams.get('applicationId');

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const appId = applicationIdParam ? parseInt(applicationIdParam, 10) : null;
        const statusRes = await apiService.getEmploymentVerificationStatus(appId || undefined, {
          cache: false,
          skipDeduplication: true
        });

        if (statusRes.success && statusRes.data?.verified) {
          const progress = await getOnboardingProgress(appId, true);
          navigate(getStepRoute(progress.currentStep, appId, progress.prerequisites), { replace: true });
          return;
        }

        if (statusRes.success && statusRes.data && !statusRes.data.docs_verify) {
          navigate(
            `/loan-application/employment-verification${appId ? `?applicationId=${appId}` : ''}`,
            { replace: true }
          );
        }
      } catch (error) {
        console.error('Poll employment status error:', error);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 15000);
    return () => clearInterval(interval);
  }, [applicationIdParam, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Clock className="w-6 h-6 text-amber-600" />
            Documents Under Review
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 mx-auto text-amber-500" />
          <p className="text-lg font-medium text-gray-900">
            Your documents are under verification. We will get back to you soon.
          </p>
          <p className="text-sm text-gray-600">
            Our team is reviewing your employment documents. Please wait here — you cannot proceed until an admin approves your documents.
          </p>
          <p className="text-xs text-gray-500">
            This page will refresh automatically when your status is updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmploymentDocsPendingPage;
