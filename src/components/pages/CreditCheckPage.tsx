import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Shield, CheckCircle, XCircle, Loader2, AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const CreditCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId } = location.state || {};

  // Format date as DD/MM/YYYY without timezone conversion
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '') return 'N/A';

    // Extract date part from datetime string (e.g., "2025-12-25 23:19:50" -> "2025-12-25")
    let datePart = String(dateString);
    if (typeof dateString === 'string' && dateString.includes(' ')) {
      datePart = dateString.split(' ')[0];
    }

    // Handle ISO date format: "2025-12-25" or "2025-12-25T00:00:00.000Z"
    if (datePart.includes('T')) {
      datePart = datePart.split('T')[0];
    }

    // Format as DD/MM/YYYY (Indian format) - no timezone conversion, just string manipulation
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      // Ensure day and month are zero-padded
      const formattedDay = String(day).padStart(2, '0');
      const formattedMonth = String(month).padStart(2, '0');
      return `${formattedDay}/${formattedMonth}/${year}`;
    }

    return datePart; // Return as-is if format is unexpected
  };

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [creditData, setCreditData] = useState<{
    completed: boolean;
    credit_score: number | null;
    is_eligible: boolean | null;
    checked_at: string | null;
  } | null>(null);

  // Check if credit check already completed
  useEffect(() => {
    const checkCreditStatus = async () => {
      try {
        const response = await apiService.getCreditCheckStatus();
        
        if (response.status === 'success' && response.data) {
          setCreditData(response.data);
          
          if (response.data.completed) {
            // Credit check already done
            // Handle both boolean and number (0/1) formats from database
            const isEligible = response.data.is_eligible === true || 
                              (typeof response.data.is_eligible === 'number' && response.data.is_eligible === 1);
            if (isEligible) {
              setTimeout(() => {
                navigate(`/loan-application/bank-statement?applicationId=${applicationId}`);
              }, 2000);
            } else {
              // User is not eligible (on hold)
              toast.error('Your profile is currently on hold due to credit check results');
              setTimeout(() => {
                navigate('/dashboard');
              }, 3000);
            }
          } else {
            // Not completed yet - show the check button
            setChecking(false);
          }
        } else {
          setChecking(false);
        }
      } catch (error) {
        console.error('Error checking credit status:', error);
        setChecking(false);
      }
    };

    checkCreditStatus();
  }, [applicationId, navigate]);

  const handlePerformCreditCheck = async () => {
    setLoading(true);

    try {
      const response = await apiService.performCreditCheck();

        if (response.status === 'success' && response.data) {
        // Handle both boolean and number (0/1) formats from database
        const isEligible = response.data.is_eligible === true || 
                          (typeof response.data.is_eligible === 'number' && response.data.is_eligible === 1);
        
        setCreditData({
          completed: true,
          credit_score: response.data.credit_score,
          is_eligible: isEligible,
          checked_at: new Date().toISOString()
        });

        if (isEligible) {
          toast.success(`Credit check passed! Your score: ${response.data.credit_score}`);
          setTimeout(() => {
            navigate(`/loan-application/bank-statement?applicationId=${applicationId}`);
          }, 2000);
        } else {
          toast.error(`Credit check failed. ${response.data.reasons?.join(', ') || 'Please contact support.'}`);
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      } else {
        toast.error(response.message || 'Failed to perform credit check');
      }
    } catch (error: any) {
      console.error('Credit check error:', error);
      toast.error(error.response?.data?.message || 'Failed to perform credit check');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking status
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking credit status...</p>
        </div>
      </div>
    );
  }

  // Show result if already completed
  if (creditData?.completed) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  creditData.is_eligible ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {creditData.is_eligible ? (
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-600" />
                  )}
                </div>
              </div>
              <CardTitle className="text-2xl">
                {creditData.is_eligible ? 'Credit Check Passed' : 'Credit Check Failed'}
              </CardTitle>
              <CardDescription>
                {creditData.is_eligible 
                  ? 'Your credit profile meets our requirements'
                  : 'Your profile is currently on hold'
                }
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Credit Score Display */}
              {creditData.credit_score && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Your Credit Score</span>
                  </div>
                  <div className="text-5xl font-bold text-blue-600 mb-2">
                    {creditData.credit_score}
                  </div>
                  <div className="text-xs text-gray-500">
                    Checked on {formatDate(creditData.checked_at!)}
                  </div>
                </div>
              )}

              {/* Status Message */}
              <div className={`p-4 rounded-lg ${
                creditData.is_eligible 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm ${
                  creditData.is_eligible ? 'text-green-800' : 'text-red-800'
                }`}>
                  {creditData.is_eligible
                    ? '✓ You are eligible to proceed with your loan application'
                    : '✗ Your profile is on hold for 60 days. Please contact support for more information.'
                  }
                </p>
              </div>

              {/* Redirect message */}
              <div className="text-center text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Redirecting you automatically...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show credit check initiation form
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Check</h1>
          <p className="text-gray-600">
            We need to verify your credit profile to process your loan application
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Credit Verification
            </CardTitle>
            <CardDescription>
              This is a one-time check. Your credit score will be fetched from Experian.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Information Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                What happens during credit check?
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>We fetch your credit report from Experian</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Your credit score must be 630 or above</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>This is a soft inquiry and won't affect your score</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>The check is performed only once per user</span>
                </li>
              </ul>
            </div>

            {/* Eligibility Criteria */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Eligibility Criteria</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Credit score must be 630 or higher</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>No active settlements or write-offs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>No suit files or wilful defaults</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <Button
                onClick={handlePerformCreditCheck}
                disabled={loading}
                className="w-full h-12 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Performing Credit Check...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Perform Credit Check
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center mt-3">
                By clicking, you authorize us to fetch your credit report from Experian
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

