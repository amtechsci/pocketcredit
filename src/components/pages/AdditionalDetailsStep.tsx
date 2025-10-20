import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowRight, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

interface AdditionalDetailsFormData {
  personal_email: string;
  personal_email_verified: boolean;
  marital_status: string;
  salary_date: string;
  official_email: string;
  official_email_verified: boolean;
}

interface AdditionalDetailsStepProps {
  onComplete: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const AdditionalDetailsStep: React.FC<AdditionalDetailsStepProps> = ({
  onComplete,
  loading,
  setLoading,
}) => {
  const [formData, setFormData] = useState<AdditionalDetailsFormData>({
    personal_email: '',
    personal_email_verified: false,
    marital_status: '',
    salary_date: '',
    official_email: '',
    official_email_verified: false,
  });

  const [personalOtpSent, setPersonalOtpSent] = useState(false);
  const [officialOtpSent, setOfficialOtpSent] = useState(false);
  const [personalOtp, setPersonalOtp] = useState('');
  const [officialOtp, setOfficialOtp] = useState('');

  // Generate array of days 1-31
  const salaryDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSendPersonalOtp = async () => {
    if (!formData.personal_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personal_email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.sendEmailOtp(formData.personal_email, 'personal');
      if (response.success) {
        setPersonalOtpSent(true);
        toast.success('OTP sent to your personal email');
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Personal OTP send error:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPersonalOtp = async () => {
    if (!personalOtp || personalOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyEmailOtp(formData.personal_email, personalOtp, 'personal');
      if (response.success) {
        setFormData(prev => ({ ...prev, personal_email_verified: true }));
        toast.success('Personal email verified successfully');
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Personal OTP verify error:', error);
      toast.error(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOfficialOtp = async () => {
    if (!formData.official_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.official_email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.sendEmailOtp(formData.official_email, 'official');
      if (response.success) {
        setOfficialOtpSent(true);
        toast.success('OTP sent to your official email');
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Official OTP send error:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOfficialOtp = async () => {
    if (!officialOtp || officialOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyEmailOtp(formData.official_email, officialOtp, 'official');
      if (response.success) {
        setFormData(prev => ({ ...prev, official_email_verified: true }));
        toast.success('Official email verified successfully');
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Official OTP verify error:', error);
      toast.error(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.personal_email_verified) {
      toast.error('Please verify your personal email address');
      return;
    }

    if (!formData.official_email_verified) {
      toast.error('Please verify your official email address');
      return;
    }

    if (!formData.marital_status) {
      toast.error('Please select your marital status');
      return;
    }

    if (!formData.salary_date) {
      toast.error('Please select your salary date');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateAdditionalDetails({
        personal_email: formData.personal_email,
        marital_status: formData.marital_status,
        salary_date: formData.salary_date,
        official_email: formData.official_email,
      });

      if (response.success) {
        toast.success('Additional details saved successfully');
        onComplete();
      } else {
        toast.error(response.message || 'Failed to save details');
      }
    } catch (error: any) {
      console.error('Additional details submission error:', error);
      toast.error(error.response?.data?.message || 'Failed to save details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Email Verification */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Email Verification *</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="personal_email">Personal Email Address *</Label>
            <div className="flex gap-2">
              <Input
                id="personal_email"
                type="email"
                value={formData.personal_email}
                onChange={(e) => setFormData(prev => ({ ...prev, personal_email: e.target.value }))}
                placeholder="Enter your personal email"
                disabled={formData.personal_email_verified}
                required
                className="h-11 flex-1"
              />
              {formData.personal_email_verified ? (
                <Button type="button" disabled className="bg-green-600 h-11">
                  <Check className="w-4 h-4 mr-2" />
                  Verified
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSendPersonalOtp}
                  disabled={loading || !formData.personal_email || personalOtpSent}
                  className="h-11"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {personalOtpSent ? 'Resend OTP' : 'Send OTP'}
                </Button>
              )}
            </div>
          </div>

          {personalOtpSent && !formData.personal_email_verified && (
            <div className="space-y-2">
              <Label htmlFor="personal_otp">Enter OTP</Label>
              <div className="flex gap-2">
                <Input
                  id="personal_otp"
                  value={personalOtp}
                  onChange={(e) => setPersonalOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="h-11 flex-1"
                />
                <Button
                  type="button"
                  onClick={handleVerifyPersonalOtp}
                  disabled={loading || personalOtp.length !== 6}
                  className="h-11"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-gray-500">Please check your email for the verification code</p>
            </div>
          )}
        </div>
      </div>

      {/* Marital Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Marital Status *</h3>
        <div className="space-y-2">
          <Label htmlFor="marital_status">Select your marital status</Label>
          <select
            id="marital_status"
            value={formData.marital_status}
            onChange={(e) => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
            className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select status</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widow">Widow</option>
          </select>
        </div>
      </div>

      {/* Salary Date */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Salary Date *</h3>
        <div className="space-y-2">
          <Label htmlFor="salary_date">Select your monthly salary date</Label>
          <select
            id="salary_date"
            value={formData.salary_date}
            onChange={(e) => setFormData(prev => ({ ...prev, salary_date: e.target.value }))}
            className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select day of month</option>
            {salaryDays.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Select the day of the month you receive your salary</p>
        </div>
      </div>

      {/* Official Email Verification */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Official Email Verification *</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="official_email">Official Email Address *</Label>
            <div className="flex gap-2">
              <Input
                id="official_email"
                type="email"
                value={formData.official_email}
                onChange={(e) => setFormData(prev => ({ ...prev, official_email: e.target.value }))}
                placeholder="Enter your official/work email"
                disabled={formData.official_email_verified}
                required
                className="h-11 flex-1"
              />
              {formData.official_email_verified ? (
                <Button type="button" disabled className="bg-green-600 h-11">
                  <Check className="w-4 h-4 mr-2" />
                  Verified
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSendOfficialOtp}
                  disabled={loading || !formData.official_email || officialOtpSent}
                  className="h-11"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {officialOtpSent ? 'Resend OTP' : 'Send OTP'}
                </Button>
              )}
            </div>
          </div>

          {officialOtpSent && !formData.official_email_verified && (
            <div className="space-y-2">
              <Label htmlFor="official_otp">Enter OTP</Label>
              <div className="flex gap-2">
                <Input
                  id="official_otp"
                  value={officialOtp}
                  onChange={(e) => setOfficialOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="h-11 flex-1"
                />
                <Button
                  type="button"
                  onClick={handleVerifyOfficialOtp}
                  disabled={loading || officialOtp.length !== 6}
                  className="h-11"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-gray-500">Please check your email for the verification code</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={loading || !formData.personal_email_verified || !formData.official_email_verified}
          className="bg-blue-600 hover:bg-blue-700 h-11 w-full md:w-auto"
        >
          {loading ? 'Saving...' : 'Continue'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
};
