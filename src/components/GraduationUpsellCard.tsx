import React, { useState } from 'react';
import { GraduationCap, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { apiService } from '../services/api';

interface GraduationUpsellCardProps {
  currentLoanLimit: number;
  onSuccess?: () => void;
}

export const GraduationUpsellCard: React.FC<GraduationUpsellCardProps> = ({
  currentLoanLimit,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [graduationDate, setGraduationDate] = useState('');

  const newLoanLimit = 25000;
  const increase = newLoanLimit - currentLoanLimit;

  const handleGraduate = async () => {
    if (!graduationDate) {
      toast.error('Please enter your graduation date');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateGraduationStatus({
        graduation_status: 'graduated',
        graduation_date: graduationDate
      });

      if (response.status === 'success') {
        toast.success(response.message || '🎉 Congratulations! Your loan limit has been increased!');
        setShowForm(false);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(response.message || 'Failed to update graduation status');
      }
    } catch (error: any) {
      console.error('Graduation update error:', error);
      toast.error(error.message || 'Failed to update graduation status');
    } finally {
      setLoading(false);
    }
  };

  if (showForm) {
    return (
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <GraduationCap className="w-6 h-6" />
            Update Your Graduation Status
          </CardTitle>
          <CardDescription>
            Enter your graduation date to increase your loan limit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="graduation_date">Graduation Date *</Label>
            <Input
              id="graduation_date"
              type="date"
              value={graduationDate}
              onChange={(e) => setGraduationDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="h-11"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleGraduate}
              disabled={loading || !graduationDate}
              className="flex-1 bg-green-600 hover:bg-green-700 h-11"
            >
              {loading ? 'Updating...' : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Graduation
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowForm(false)}
              variant="outline"
              disabled={loading}
              className="h-11"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-blue-900">
                Graduated? Unlock Higher Limit!
              </CardTitle>
              <CardDescription className="text-blue-700">
                Increase your borrowing power
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current vs New Limit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Current Limit</p>
            <p className="text-2xl font-bold text-gray-900">
              ₹{currentLoanLimit.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
            <p className="text-sm text-green-700 mb-1">After Graduation</p>
            <p className="text-2xl font-bold text-green-700">
              ₹{newLoanLimit.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="p-4 bg-white rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="font-semibold text-gray-900">Benefits</p>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Increase your loan limit by <strong>₹{increase.toLocaleString('en-IN')}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Access more funds for your needs</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Same easy repayment terms</span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => setShowForm(true)}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-base font-semibold"
        >
          <GraduationCap className="w-5 h-5 mr-2" />
          I've Graduated - Upgrade Now
        </Button>

        <p className="text-xs text-center text-gray-500">
          This will update your profile and increase your loan limit immediately
        </p>
      </CardContent>
    </Card>
  );
};

