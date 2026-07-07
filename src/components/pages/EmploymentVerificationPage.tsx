import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { VerifyEmploymentPage } from './VerifyEmploymentPage';
import { getOnboardingProgress, getStepRoute } from '../../utils/onboardingProgressEngine';

export const EmploymentVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationIdParam = searchParams.get('applicationId');
  const [applicationId, setApplicationId] = useState<number | null>(
    applicationIdParam ? parseInt(applicationIdParam, 10) : null
  );
  const [phase, setPhase] = useState<'loading' | 'pan' | 'uan-check' | 'verify' | 'done'>('loading');
  const [panNumber, setPanNumber] = useState('');
  const [validatingPan, setValidatingPan] = useState(false);
  const [checkingUan, setCheckingUan] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        let appId = applicationId;
        if (!appId) {
          const apps = await apiService.getLoanApplications();
          if (apps.success && apps.data?.applications?.length) {
            const active = apps.data.applications.find(
              (a: any) => !['cleared', 'cancelled', 'rejected'].includes(a.status)
            );
            appId = active?.id || apps.data.applications[0].id;
            setApplicationId(appId);
          }
        }

        const statusRes = await apiService.getEmploymentVerificationStatus(appId || undefined, {
          cache: false,
          skipDeduplication: true
        });

        if (statusRes.success && statusRes.data) {
          if (statusRes.data.verified) {
            setPhase('done');
            const progress = await getOnboardingProgress(appId, true);
            navigate(getStepRoute(progress.currentStep, appId), { replace: true });
            return;
          }
          if (statusRes.data.docs_verify) {
            navigate(`/loan-application/employment-docs-pending${appId ? `?applicationId=${appId}` : ''}`, { replace: true });
            return;
          }
        }

        const panRes = appId ? await apiService.checkPanDocument(String(appId)) : null;
        const hasPan = panRes?.success && panRes.data?.hasPanDocument;

        if (!hasPan) {
          setPhase('pan');
          return;
        }

        setPhase('uan-check');
        await runUanCheck(appId, undefined);
      } catch (error) {
        console.error('Employment verification init error:', error);
        setPhase('verify');
      }
    };
    init();
  }, []);

  const runUanCheck = async (appId: number | null, pan?: string) => {
    setCheckingUan(true);
    try {
      const response = await apiService.checkEmploymentUANByPAN({
        applicationId: appId || undefined,
        pan: pan?.toUpperCase()
      });

      if (response.needsPan) {
        setPhase('pan');
        return;
      }

      if (response.verified) {
        toast.success('Employment verified successfully');
        setPhase('done');
        const progress = await getOnboardingProgress(appId, true);
        navigate(getStepRoute(progress.currentStep, appId), { replace: true });
        return;
      }

      if (response.shouldShowManualFlow) {
        setPhase('verify');
        return;
      }

      setPhase('verify');
    } catch (error: any) {
      console.error('UAN check error:', error);
      setPhase('verify');
    } finally {
      setCheckingUan(false);
    }
  };

  const handleValidatePan = async () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const pan = panNumber.trim().toUpperCase();
    if (!panRegex.test(pan)) {
      toast.error('Please enter a valid PAN number (e.g. ABCDE1234F)');
      return;
    }
    setValidatingPan(true);
    try {
      const response = await apiService.validatePAN(pan);
      if (response.success || response.status === 'success') {
        toast.success('PAN validated successfully');
        setPhase('uan-check');
        await runUanCheck(applicationId, pan);
      } else {
        toast.error(response.message || 'Invalid PAN number');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate PAN');
    } finally {
      setValidatingPan(false);
    }
  };

  if (phase === 'loading' || phase === 'uan-check' || phase === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
            <p className="text-lg font-medium">
              {phase === 'uan-check' || checkingUan ? 'Verifying your employment...' : 'Loading...'}
            </p>
            <p className="text-sm text-gray-600">Please wait while we verify your details</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'pan') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Enter PAN Number</CardTitle>
            <p className="text-sm text-gray-600 text-center">
              PAN was not returned from DigiLocker. Please enter your PAN to continue.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="mt-1 uppercase"
              />
            </div>
            <Button onClick={handleValidatePan} disabled={validatingPan || panNumber.length !== 10} className="w-full">
              {validatingPan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <VerifyEmploymentPage applicationId={applicationId} />
    </div>
  );
};

export default EmploymentVerificationPage;
