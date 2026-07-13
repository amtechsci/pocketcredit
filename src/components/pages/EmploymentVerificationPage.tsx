import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { getOnboardingProgress, getStepRoute } from '../../utils/onboardingProgressEngine';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function uploadDocsRoute(appId: number | null, mode: 'payslip_only' | 'full') {
  const base = `/loan-application/upload-employment-documents?mode=${mode}`;
  return appId ? `${base}&applicationId=${appId}` : base;
}

export const EmploymentVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationIdParam = searchParams.get('applicationId');
  const [applicationId, setApplicationId] = useState<number | null>(
    applicationIdParam ? parseInt(applicationIdParam, 10) : null
  );
  const [phase, setPhase] = useState<'loading' | 'pan' | 'uan-check' | 'done'>('loading');
  const [panNumber, setPanNumber] = useState('');
  const [validatingPan, setValidatingPan] = useState(false);
  const [checkingUan, setCheckingUan] = useState(false);

  const resolveApplicationId = useCallback(async (): Promise<number | null> => {
    if (applicationIdParam) {
      const parsed = parseInt(applicationIdParam, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const apps = await apiService.getLoanApplications();
    if (apps.success && apps.data?.applications?.length) {
      const active = apps.data.applications.find(
        (a: any) => !['cleared', 'cancelled', 'rejected'].includes(a.status)
      );
      return active?.id || apps.data.applications[0].id;
    }
    return null;
  }, [applicationIdParam]);

  const resolvePanNumber = useCallback(async (appId: number | null): Promise<string | null> => {
    try {
      const profile = await apiService.getUserProfile();
      const fromProfile = profile.data?.user?.pan_number?.trim().toUpperCase();
      if (fromProfile && PAN_REGEX.test(fromProfile)) {
        return fromProfile;
      }
    } catch (error) {
      console.warn('[EmploymentVerification] Could not load PAN from profile:', error);
    }

    if (appId) {
      try {
        const panRes = await apiService.checkPanDocument(String(appId), {
          cache: false,
          skipDeduplication: true
        });
        if (panRes?.success && panRes.data?.hasPanDocument) {
          const profile = await apiService.getUserProfile();
          const fromProfile = profile.data?.user?.pan_number?.trim().toUpperCase();
          if (fromProfile && PAN_REGEX.test(fromProfile)) {
            return fromProfile;
          }
        }
      } catch (error) {
        console.warn('[EmploymentVerification] PAN document check failed:', error);
      }
    }

    return null;
  }, []);

  const runUanCheck = useCallback(
    async (appId: number | null, pan?: string) => {
      setCheckingUan(true);
      setPhase('uan-check');
      try {
        const panArg = pan?.trim().toUpperCase();
        console.log('[EmploymentVerification] Calling UAN-by-PAN API', { appId, hasPan: !!panArg });

        const response = await apiService.checkEmploymentUANByPAN(
          {
            applicationId: appId || undefined,
            pan: panArg
          },
          { skipDeduplication: true }
        );

        if (response.needsPan) {
          setPhase('pan');
          return;
        }

        if (response.verified) {
          toast.success('Employment verified successfully');
          setPhase('done');
          const progress = await getOnboardingProgress(appId, true);
          navigate(getStepRoute(progress.currentStep, appId, progress.prerequisites), { replace: true });
          return;
        }

        if (response.requiresPayslipOnly || response.uanFetched) {
          toast.success('UAN verified. Please upload your latest payslip.');
          navigate(uploadDocsRoute(appId, 'payslip_only'), { replace: true });
          return;
        }

        if (response.shouldShowManualFlow) {
          navigate(uploadDocsRoute(appId, 'full'), { replace: true });
          return;
        }

        navigate(uploadDocsRoute(appId, 'full'), { replace: true });
      } catch (error: any) {
        console.error('UAN check error:', error);
        toast.error(error.message || 'Employment verification failed. Please upload your documents.');
        navigate(uploadDocsRoute(appId, 'full'), { replace: true });
      } finally {
        setCheckingUan(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const appId = await resolveApplicationId();
        setApplicationId(appId);

        try {
          const statusRes = await apiService.getEmploymentVerificationStatus(appId || undefined, {
            cache: false,
            skipDeduplication: true
          });

          if (statusRes.success && statusRes.data) {
            if (statusRes.data.verified) {
              setPhase('done');
              const progress = await getOnboardingProgress(appId, true);
              navigate(getStepRoute(progress.currentStep, appId, progress.prerequisites), { replace: true });
              return;
            }
            if (statusRes.data.docs_verify) {
              navigate(
                `/loan-application/employment-docs-pending${appId ? `?applicationId=${appId}` : ''}`,
                { replace: true }
              );
              return;
            }
            if (statusRes.data.requires_payslip_only) {
              navigate(uploadDocsRoute(appId, 'payslip_only'), { replace: true });
              return;
            }
          }
        } catch (statusError) {
          console.warn('[EmploymentVerification] Status check failed (continuing to UAN):', statusError);
        }

        const resolvedPan = await resolvePanNumber(appId);
        if (resolvedPan) {
          await runUanCheck(appId, resolvedPan);
        } else {
          setPhase('pan');
        }
      } catch (error) {
        console.error('Employment verification init error:', error);
        setPhase('pan');
      }
    };

    init();
  }, [navigate, resolveApplicationId, resolvePanNumber, runUanCheck]);

  const handleValidatePan = async () => {
    const pan = panNumber.trim().toUpperCase();
    if (!PAN_REGEX.test(pan)) {
      toast.error('Please enter a valid PAN number (e.g. ABCDE1234F)');
      return;
    }
    setValidatingPan(true);
    try {
      const response = await apiService.validatePAN(pan);
      if (response.success || response.status === 'success') {
        toast.success('PAN validated successfully');
        apiService.clearCache('/digilocker/check-pan-document');
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Enter PAN Number</CardTitle>
          <p className="text-sm text-gray-600 text-center">
            PAN was not returned from DigiLocker. Please enter your PAN to continue employment verification.
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
};

export default EmploymentVerificationPage;
