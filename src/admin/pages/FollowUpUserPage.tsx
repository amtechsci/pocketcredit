import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoanApplicationsQueue } from './LoanApplicationsQueue';
import { TvrIdsPage } from './TvrIdsPage';

export function FollowUpUserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'submitted';

  const tabs = [
    { id: 'submitted', label: 'Submitted', status: 'submitted' },
    { id: 'follow_up', label: 'Follow Up', status: 'follow_up' },
    { id: 'disbursal', label: 'Disbursal', status: 'disbursal' },
    { id: 'tvr', label: 'TVR IDs' }
  ];

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'tvr' ? (
          <TvrIdsPage />
        ) : (
          <LoanApplicationsQueue initialStatus={tabs.find(t => t.id === activeTab)?.status as any} hideDownloads />
        )}
      </div>
    </div>
  );
}
