import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Building2, Briefcase, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { CompanyEmailVerification } from '../employment/CompanyEmailVerification';
import { getOnboardingProgress, getStepRoute } from '../../utils/onboardingProgressEngine';

interface VerifyEmploymentPageProps {
  applicationId: number | null;
}

export function VerifyEmploymentPage({ applicationId }: VerifyEmploymentPageProps) {
  const navigate = useNavigate();
  const [uanNumber, setUanNumber] = useState('');
  const [submittingUan, setSubmittingUan] = useState(false);
  const [activeTab, setActiveTab] = useState('company-email');

  const proceedToNextStep = async () => {
    try {
      const progress = await getOnboardingProgress(applicationId, true);
      const nextRoute = getStepRoute(progress.currentStep, applicationId);
      navigate(nextRoute, { replace: true });
    } catch {
      navigate(`/loan-application/credit-analytics${applicationId ? `?applicationId=${applicationId}` : ''}`, { replace: true });
    }
  };

  const handleUanSubmit = async () => {
    if (!/^\d{12}$/.test(uanNumber.trim())) {
      toast.error('Enter your valid UAN number or enter your company mail id in the above step to proceed');
      return;
    }
    setSubmittingUan(true);
    try {
      const response = await apiService.submitEmploymentUANNumber({
        uanNumber: uanNumber.trim(),
        applicationId: applicationId || undefined
      });
      if (response.success && response.verified) {
        toast.success('UAN verified successfully');
        await proceedToNextStep();
      } else {
        toast.error(
          response.message ||
            'Enter your valid UAN number or enter your company mail id in the above step to proceed'
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit UAN number');
    } finally {
      setSubmittingUan(false);
    }
  };

  const handleManualDocs = async () => {
    try {
      await apiService.skipToManualEmploymentDocs({ applicationId: applicationId || undefined });
      navigate(`/loan-application/upload-employment-documents${applicationId ? `?applicationId=${applicationId}` : ''}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to proceed');
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-center">VERIFY YOUR EMPLOYMENT</CardTitle>
        <p className="text-sm text-gray-600 text-center">
          Choose one of the options below to verify your employment
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-1">
            <TabsTrigger value="company-email" className="text-xs sm:text-sm py-2">
              <Building2 className="w-4 h-4 mr-1 hidden sm:inline" />
              Company Email
            </TabsTrigger>
            <TabsTrigger value="uan" className="text-xs sm:text-sm py-2">
              <Briefcase className="w-4 h-4 mr-1 hidden sm:inline" />
              UAN Number
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs sm:text-sm py-2">
              <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
              Upload Docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company-email" className="mt-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">Quick Approval with higher loan limit</p>
              <p className="text-xs text-blue-700 mt-1">Verify using your official company email address</p>
            </div>
            <CompanyEmailVerification applicationId={applicationId} onVerified={proceedToNextStep} />
          </TabsContent>

          <TabsContent value="uan" className="mt-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">Quick Approval with higher loan limit</p>
              <p className="text-xs text-blue-700 mt-1">Enter your 12-digit UAN number</p>
            </div>
            <div>
              <Label htmlFor="uan_number">UAN Number</Label>
              <Input
                id="uan_number"
                type="text"
                inputMode="numeric"
                value={uanNumber}
                onChange={(e) => setUanNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="Enter 12-digit UAN"
                maxLength={12}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-2">Your UAN number will be displayed on your payslip.</p>
            </div>
            <Button onClick={handleUanSubmit} disabled={submittingUan || uanNumber.length !== 12} className="w-full">
              {submittingUan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit UAN Number'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="mt-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium">I don&apos;t have UAN number / Official mail id</p>
              <p className="text-xs text-amber-800 mt-2">
                If you select this option to proceed, your profile review will take more time than expected.
                Hence only if you don&apos;t have the above 2 options, select this.
              </p>
            </div>
            <Button onClick={handleManualDocs} variant="outline" className="w-full">
              Proceed to Upload Employment Documents
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default VerifyEmploymentPage;
