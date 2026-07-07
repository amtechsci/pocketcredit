import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

const BLOCKED_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'rediffmail.com'];

interface CompanyEmailVerificationProps {
  applicationId: number | null;
  onVerified: () => void;
}

export function CompanyEmailVerification({ applicationId, onVerified }: CompanyEmailVerificationProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const isBlockedDomain = (value: string) => {
    const parts = value.trim().toLowerCase().split('@');
    if (parts.length !== 2) return false;
    return BLOCKED_DOMAINS.includes(parts[1]);
  };

  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (isBlockedDomain(email)) {
      toast.error('Please enter your company / official mail ID or enter your UAN number in the below step to proceed');
      return;
    }

    setSending(true);
    try {
      const response = await apiService.sendEmploymentCompanyEmailOtp({
        email,
        applicationId: applicationId || undefined
      });
      if (response.success) {
        setOtpSent(true);
        setTimer(300);
        setResendTimer(60);
        toast.success('OTP sent to your company email');
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setVerifying(true);
    try {
      const response = await apiService.verifyEmploymentCompanyEmailOtp({
        email,
        otp,
        applicationId: applicationId || undefined
      });
      if (response.success && response.verified) {
        toast.success('Company email verified successfully');
        onVerified();
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setVerifying(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="company_email">Official / Company Mail ID</Label>
        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          <Input
            id="company_email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setOtpSent(false);
              setOtp('');
            }}
            placeholder="xyz@yourcompany.com"
            disabled={otpSent}
            className="flex-1"
          />
          {!otpSent && (
            <Button onClick={handleSendOtp} disabled={sending || !email}>
              {sending ? 'Sending...' : 'Send OTP'}
            </Button>
          )}
        </div>
      </div>

      {otpSent && (
        <>
          <div>
            <Label htmlFor="company_otp">Enter OTP</Label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <Input
                id="company_otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                maxLength={6}
                className="flex-1"
              />
              <Button onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6}>
                {verifying ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              {timer > 0 ? (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  OTP expires in {formatTimer(timer)}
                </p>
              ) : (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  OTP has expired
                </p>
              )}
              {resendTimer === 0 && (
                <Button variant="link" size="sm" onClick={handleSendOtp} disabled={sending}>
                  Resend OTP
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
