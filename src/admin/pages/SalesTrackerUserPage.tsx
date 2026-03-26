import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { LoanApplicationsQueue } from './LoanApplicationsQueue';
import { TvrIdsPage } from './TvrIdsPage';
import { PerformancePage } from './PerformancePage';
import { adminApiService } from '../../services/adminApi';
import { toast } from 'sonner';

export function SalesTrackerUserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'under_review';
  const [tvrCount, setTvrCount] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    adminApiService.getApplicationStats().then((res) => {
      if (res.status === 'success' && res.data?.tvrUserCount != null) {
        setTvrCount(res.data.tvrUserCount);
      }
    }).catch(() => {});
  }, []);

  const tabs: Array<{
    id: string;
    label: string;
    status?: 'submitted' | 'under_review' | 'follow_up';
    downloadSegment?: 'submitted' | 'under_review' | 'follow_up' | 'tvr' | 'performance';
  }> = [
    { id: 'under_review', label: 'Under Review', status: 'under_review', downloadSegment: 'under_review' },
    { id: 'tvr', label: 'TVR', downloadSegment: 'tvr' },
    { id: 'follow_up', label: 'Follow Up', status: 'follow_up', downloadSegment: 'follow_up' },
    { id: 'submitted', label: 'Submitted', status: 'submitted', downloadSegment: 'submitted' },
    { id: 'performance', label: 'Performance', downloadSegment: 'performance' }
  ];

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const handleDownload = async (segment: 'submitted' | 'under_review' | 'follow_up' | 'tvr' | 'performance') => {
    try {
      setDownloading(segment);
      const blob = await adminApiService.exportSalesTrackerMinimal(segment);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // UTF-8 CSV opens in Excel; columns are Customer Id (PC…) and Loan ID (PLL…) only
      link.download = `sales_tracker_${segment}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded (Customer Id & Loan ID only)');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {tabs.map((tab) => (
              <div key={tab.id} className="flex items-center gap-1 py-4">
                <button
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-1 pb-3 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'tvr' && tvrCount != null && (
                    <span className="ml-1.5 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      {tvrCount}
                    </span>
                  )}
                </button>
                {tab.downloadSegment && (
                  <button
                    type="button"
                    onClick={() => handleDownload(tab.downloadSegment!)}
                    disabled={downloading === tab.downloadSegment}
                    className="p-1.5 mb-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50"
                    title="Download Excel (Customer Id & Loan ID)"
                    aria-label={`Download Excel for ${tab.label}`}
                  >
                    <Download className={`w-4 h-4 ${downloading === tab.downloadSegment ? 'animate-pulse' : ''}`} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'tvr' ? (
          <TvrIdsPage />
        ) : activeTab === 'performance' ? (
          <PerformancePage />
        ) : (
          <LoanApplicationsQueue
            initialStatus={tabs.find((t) => t.id === activeTab)?.status}
            hideDownloads
          />
        )}
      </div>
    </div>
  );
}
