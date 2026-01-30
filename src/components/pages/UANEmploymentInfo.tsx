import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, CheckCircle, XCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { adminApiService } from '../../services/adminApi';

interface UANEmploymentInfoProps {
  aadharLinkedMobile?: string | null;
  userId?: string | number; // Required when using admin API
  onDataReceived?: (data: any) => void;
}

export function UANEmploymentInfo({ aadharLinkedMobile, userId, onDataReceived }: UANEmploymentInfoProps) {
  // Determine if we're in admin mode (userId provided means admin is making request on behalf of user)
  const isAdminMode = !!userId;
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-fill mobile number from aadhar_linked_mobile
  useEffect(() => {
    if (aadharLinkedMobile) {
      setMobile(aadharLinkedMobile);
    }
  }, [aadharLinkedMobile]);

  const handleSubmit = async () => {
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResponseData(null);

    try {
      console.log('UAN Basic Request:', { isAdminMode, userId, mobile });
      
      // Call synchronous UAN Basic V3 API
      const response = isAdminMode && userId
        ? await adminApiService.getUANBasic(String(userId), { mobile })
        : await apiService.getUANBasic({ mobile });

      const resultCode = response.data?.result_code;
      const httpResponseCode = response.data?.http_response_code || response.data?.http_status_code;

      // Check if HTTP response is 200 and result_code is 101 (success)
      if (httpResponseCode === 200 && resultCode === 101) {
        // Success - data found
        // The result data might be in response.data.result or directly in response.data
        const result = response.data.result || response.data;
        setResponseData(result);
        toast.success('UAN data retrieved successfully');
        
        // Call callback if provided
        if (onDataReceived) {
          onDataReceived(result);
        }
      } else if (httpResponseCode === 200) {
        // API returned 200 but with error result_code (e.g., 103 = No records found)
        const errorMsg = response.data?.message || response.message || 'No records found';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      } else {
        // HTTP error
        const errorMsg = response.data?.message || response.message || 'Failed to get UAN data';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error getting UAN Basic:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to get UAN data';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResponseData(null);
    setErrorMessage(null);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Employment Info
        </CardTitle>
        <CardDescription>
          Retrieve your EPFO passbook using your Aadhaar-linked mobile number
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!responseData && !errorMessage && (
          <>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  +91
                </div>
                <Input
                  id="mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="pl-14"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                This should be the mobile number registered with your Aadhaar card
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading || !mobile || mobile.length !== 10}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Fetching UAN data. This may take a few moments...</p>
          </div>
        )}

        {responseData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">UAN data retrieved successfully!</span>
            </div>

            {/* Employee Details */}
            {responseData.employee_details && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Employee Details</h4>
                <div className="text-sm space-y-1">
                  {responseData.employee_details.member_name && (
                    <div>
                      <span className="text-gray-500">Name:</span>{' '}
                      <span className="font-medium">{responseData.employee_details.member_name}</span>
                    </div>
                  )}
                  {responseData.employee_details.father_name && (
                    <div>
                      <span className="text-gray-500">Father's Name:</span>{' '}
                      <span className="font-medium">{responseData.employee_details.father_name}</span>
                    </div>
                  )}
                  {responseData.employee_details.dob && (
                    <div>
                      <span className="text-gray-500">Date of Birth:</span>{' '}
                      <span className="font-medium">{responseData.employee_details.dob}</span>
                    </div>
                  )}
                  {responseData.employee_details.uan && (
                    <div>
                      <span className="text-gray-500">UAN:</span>{' '}
                      <span className="font-medium">{responseData.employee_details.uan}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Establishment Details */}
            {responseData.est_details && responseData.est_details.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <h4 className="font-semibold text-sm">Employment History</h4>
                {responseData.est_details.map((est: any, index: number) => (
                  <div key={index} className="border-l-2 border-blue-500 pl-4 space-y-2">
                    <div className="font-medium text-sm">{est.est_name}</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {est.member_id && (
                        <div>Member ID: {est.member_id}</div>
                      )}
                      {est.office && (
                        <div>Office: {est.office}</div>
                      )}
                      {est.doj_epf && (
                        <div>Date of Joining: {est.doj_epf}</div>
                      )}
                      {est.doc_epf && (
                        <div>Date of Check: {est.doc_epf}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Overall PF Balance */}
            {responseData.overall_pf_balance && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Overall PF Balance</h4>
                <div className="text-sm space-y-1">
                  {responseData.overall_pf_balance.current_pf_balance !== undefined && (
                    <div>
                      <span className="text-gray-500">Current PF Balance:</span>{' '}
                      <span className="font-medium text-blue-600">
                        ₹{parseFloat(responseData.overall_pf_balance.current_pf_balance).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {responseData.overall_pf_balance.pension_balance !== undefined && (
                    <div>
                      <span className="text-gray-500">Pension Balance:</span>{' '}
                      <span className="font-medium">
                        ₹{parseFloat(responseData.overall_pf_balance.pension_balance).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleReset} variant="outline" className="w-full">
              Retrieve Another Passbook
            </Button>
          </div>
        )}

        {errorMessage && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
