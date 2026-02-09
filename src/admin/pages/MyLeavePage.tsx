import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Loader2, ArrowLeft } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { adminApiService } from '../../services/adminApi';

const DAYS = [
  { v: 0, label: 'Sun' },
  { v: 1, label: 'Mon' },
  { v: 2, label: 'Tue' },
  { v: 3, label: 'Wed' },
  { v: 4, label: 'Thu' },
  { v: 5, label: 'Fri' },
  { v: 6, label: 'Sat' }
];

export function MyLeavePage() {
  const navigate = useNavigate();
  const { currentUser } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [tempInactiveFrom, setTempInactiveFrom] = useState('');
  const [tempInactiveTo, setTempInactiveTo] = useState('');

  const isSubAdmin = currentUser?.role === 'sub_admin' && currentUser?.sub_admin_category && currentUser.sub_admin_category !== 'debt_agency';

  useEffect(() => {
    if (!isSubAdmin) return;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await adminApiService.getMyAdminProfile();
        if (res.status === 'success' && res.data?.admin) {
          const a = res.data.admin;
          const weekly = a.weekly_off_days;
          const arr = weekly == null || weekly === ''
            ? []
            : Array.isArray(weekly)
              ? weekly
              : String(weekly).split(',').map((d: string) => parseInt(d.trim(), 10)).filter((n: number) => !Number.isNaN(n));
          setWeeklyOffDays(arr);
          setTempInactiveFrom(a.temp_inactive_from ? String(a.temp_inactive_from).slice(0, 10) : '');
          setTempInactiveTo(a.temp_inactive_to ? String(a.temp_inactive_to).slice(0, 10) : '');
        }
      } catch (e) {
        setError('Failed to load leave settings');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isSubAdmin]);

  const handleSave = async () => {
    if (!isSubAdmin) return;
    try {
      setSaving(true);
      setError(null);
      const res = await adminApiService.updateMyLeave({
        weekly_off_days: weeklyOffDays.length ? weeklyOffDays : null,
        temp_inactive_from: tempInactiveFrom || null,
        temp_inactive_to: tempInactiveTo || null
      });
      if (res.status === 'success') {
        alert('Leave settings saved. Your assignments will be covered when you are on leave.');
      } else {
        setError((res as any).message || 'Failed to save');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (v: number) => {
    if (weeklyOffDays.includes(v)) {
      setWeeklyOffDays(weeklyOffDays.filter(d => d !== v));
    } else {
      setWeeklyOffDays([...weeklyOffDays, v].sort((a, b) => a - b));
    }
  };

  if (currentUser && !isSubAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-600">Leave settings are only for sub-admins (Verify User, QA User, Account Manager, Recovery Officer).</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-amber-600" />
          My leave & weekly off
        </h1>
      </div>
      <p className="text-gray-600 mb-6">
        When you set weekly off or a leave date range, your assigned applications are temporarily covered by other active sub-admins. When you are back, they are reassigned to you.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weekly off (select days you are off)</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(({ v, label }) => (
                <label
                  key={v}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-md cursor-pointer ${
                    weeklyOffDays.includes(v) ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={weeklyOffDays.includes(v)}
                    onChange={() => toggleDay(v)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leave from (date)</label>
              <input
                type="date"
                value={tempInactiveFrom}
                onChange={(e) => setTempInactiveFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leave to (date)</label>
              <input
                type="date"
                value={tempInactiveTo}
                onChange={(e) => setTempInactiveTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save leave settings
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
