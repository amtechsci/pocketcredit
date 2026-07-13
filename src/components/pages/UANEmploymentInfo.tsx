import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, CheckCircle, XCircle, Building2, Briefcase, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { adminApiService } from '../../services/adminApi';

interface UANEmploymentInfoProps {
  aadharLinkedMobile?: string | null;
  panNumber?: string | null;
  userId?: string | number;
  onDataReceived?: (data: any) => void;
  maskMobile?: boolean;
}

function extractUANData(data: any) {
  const result = data?.result || data;
  const uanArray = result?.uan || [];
  const matchingUan = result?.summary?.matching_uan || (uanArray.length > 0 ? uanArray[0] : null);
  const uanDetails = matchingUan ? result?.uan_details?.[matchingUan] : null;
  const basicDetails = uanDetails?.basic_details || {};
  const employmentDetails = uanDetails?.employment_details || {};
  const summary = result?.summary || {};
  const recentEmployerData = summary?.recent_employer_data || {};

  return {
    matchingUan,
    uanCount: summary?.uan_count,
    isEmployed: summary?.is_employed,
    dateOfExitMarked: summary?.date_of_exit_marked,
    name: basicDetails?.name,
    dateOfBirth: basicDetails?.date_of_birth,
    mobile: data?.mobile || basicDetails?.mobile,
    gender: basicDetails?.gender,
    aadhaarVerificationStatus: basicDetails?.aadhaar_verification_status,
    establishmentId: recentEmployerData?.establishment_id || employmentDetails?.establishment_id,
    establishmentName: recentEmployerData?.establishment_name || employmentDetails?.establishment_name,
    dateOfJoining: recentEmployerData?.date_of_joining || employmentDetails?.date_of_joining,
    dateOfExit: recentEmployerData?.date_of_exit || employmentDetails?.date_of_exit,
    memberId: recentEmployerData?.member_id || employmentDetails?.member_id,
  };
}

function maskMobileLast4(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return value ?? '—';
  const s = String(value).trim();
  if (s.length <= 4) return 'XXXX';
  return 'XXXXXX' + s.slice(-4);
}

export function UANEmploymentInfo({
  aadharLinkedMobile,
  panNumber,
  userId,
  onDataReceived,
  maskMobile
}: UANEmploymentInfoProps) {
  const isAdminMode = !!userId;
  const [mobile, setMobile] = useState('');
  const [pan, setPan] = useState('');
  const [uanNumber, setUanNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [responseData, setResponseData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const callbackCalledRef = useRef(false);

  useEffect(() => {
    if (responseData && onDataReceived && !callbackCalledRef.current) {
      callbackCalledRef.current = true;
      onDataReceived(responseData);
    }
  }, [responseData, onDataReceived]);

  useEffect(() => {
    let isMounted = true;

    const loadStoredUANData = async () => {
      try {
        const response =
          isAdminMode && userId
            ? await adminApiService.getStoredUANData(String(userId))
            : await apiService.getStoredUANData();

        if (isMounted && response.success && response.data) {
          setResponseData(response.data);
        }
      } catch (error) {
        console.error('Error loading stored UAN data:', error);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    loadStoredUANData();
    return () => {
      isMounted = false;
    };
  }, [isAdminMode, userId]);

  useEffect(() => {
    if (aadharLinkedMobile) setMobile(aadharLinkedMobile);
  }, [aadharLinkedMobile]);

  useEffect(() => {
    if (panNumber) setPan(panNumber.toUpperCase());
  }, [panNumber]);

  const handleSubmit = async () => {
    const uanTrimmed = uanNumber.trim();
    const useUanLookup = /^\d{12}$/.test(uanTrimmed);

    if (!useUanLookup) {
      if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        toast.error('Please enter a valid 10-digit mobile number');
        return;
      }
      const panValue = pan.trim().toUpperCase();
      if (!panValue || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panValue)) {
        toast.error('Please enter a valid PAN number');
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);
    setResponseData(null);

    try {
      const payload = {
        mobile: mobile || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        uan: useUanLookup ? uanTrimmed : undefined
      };

      const response =
        isAdminMode && userId
          ? await adminApiService.getUANBasic(String(userId), payload)
          : await apiService.getUANBasic({ mobile, pan: payload.pan });

      const resultCode = response.data?.result_code;
      const httpResponseCode = response.data?.http_response_code || response.data?.http_status_code;

      if (httpResponseCode === 200 && resultCode === 101) {
        setResponseData(response.data);
      } else if (httpResponseCode === 200) {
        const errorMsg = response.data?.message || response.message || 'No records found';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      } else {
        const errorMsg = response.data?.message || response.message || 'Failed to get UAN data';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to get UAN data';
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

  const uanData = responseData ? extractUANData(responseData) : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Employment Info
        </CardTitle>
        {!responseData && (
          <CardDescription>
            {isAdminMode
              ? 'Manually fetch UAN data using mobile, PAN, or UAN number'
              : 'Retrieve your EPFO passbook using your Aadhaar-linked mobile number'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {initialLoading && (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Checking for existing data...</p>
          </div>
        )}

        {!initialLoading && !responseData && !errorMessage && (
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
            </div>

            {isAdminMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="uppercase"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uan_number">UAN Number (optional)</Label>
                  <Input
                    id="uan_number"
                    type="text"
                    inputMode="numeric"
                    value={uanNumber}
                    onChange={(e) => setUanNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="12-digit UAN (lookup by UAN)"
                    maxLength={12}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500">
                    Enter UAN to fetch by UAN number, or leave blank and use mobile + PAN.
                  </p>
                </div>
              </>
            )}

            {!isAdminMode && (
              <p className="text-xs text-gray-500">
                This should be the mobile number registered with your Aadhaar card
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                (isAdminMode
                  ? !/^\d{12}$/.test(uanNumber.trim()) &&
                    (!mobile || mobile.length !== 10 || !pan || pan.length !== 10)
                  : !mobile || mobile.length !== 10)
              }
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Fetch UAN Data'
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

        {responseData && uanData && (
          <div className="space-y-4">
            {uanData.matchingUan && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">UAN Data Retrieved</span>
                </div>
                <div className="text-xs text-gray-600 mb-1">Universal Account Number (UAN)</div>
                <div className="text-2xl font-bold text-green-700 font-mono">{uanData.matchingUan}</div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {uanData.uanCount !== undefined && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">UAN Count</div>
                  <div className="font-semibold">{uanData.uanCount}</div>
                </div>
              )}
              {uanData.isEmployed !== undefined && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Is Employed</div>
                  <div className={`font-semibold ${uanData.isEmployed ? 'text-green-600' : 'text-red-600'}`}>
                    {uanData.isEmployed ? 'Yes' : 'No'}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                Basic Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {uanData.name && (
                  <div>
                    <span className="text-gray-500">Name:</span>{' '}
                    <span className="font-medium">{uanData.name}</span>
                  </div>
                )}
                {uanData.mobile && (
                  <div>
                    <span className="text-gray-500">Mobile:</span>{' '}
                    <span className="font-medium">
                      {maskMobile ? maskMobileLast4(uanData.mobile) : uanData.mobile}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {(uanData.establishmentName || uanData.establishmentId) && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Employment Details
                </h4>
                <div className="space-y-2 text-sm">
                  {uanData.establishmentName && (
                    <div>
                      <span className="text-gray-500">Establishment:</span>{' '}
                      <span className="font-medium">{uanData.establishmentName}</span>
                    </div>
                  )}
                  {uanData.dateOfJoining && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-500">Joined:</span>{' '}
                      <span className="font-medium">{uanData.dateOfJoining}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
