import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePartner } from '../../contexts/PartnerContext';
import { partnerApiService, PartnerLead } from '../../services/partnerApi';
import { ArrowLeft, RefreshCw, IndianRupee, Calendar, User, Phone, CreditCard } from 'lucide-react';

export function PartnerLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = usePartner();
  const [lead, setLead] = useState<PartnerLead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/partner/login');
      return;
    }
    if (leadId) {
      loadLeadDetails();
    }
  }, [leadId, isAuthenticated, navigate]);

  const loadLeadDetails = async () => {
    try {
      setLoading(true);
      const response = await partnerApiService.getLeadDetails(parseInt(leadId!));
      if (response.status && response.data) {
        setLead(response.data);
      }
    } catch (error: any) {
      console.error('Error loading lead details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Lead not found</p>
          <button
            onClick={() => navigate('/partner/dashboard')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/partner/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">
              {lead.first_name} {lead.last_name}
            </h1>
            <p className="text-blue-100 mt-1">Lead ID: {lead.id}</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Lead Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Mobile Number</p>
                    <p className="text-gray-900 font-medium">{lead.mobile_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">PAN Number</p>
                    <p className="text-gray-900 font-medium">{lead.pan_number}</p>
                  </div>
                </div>
                {lead.email && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-gray-900 font-medium">{lead.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status & Timeline */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status & Timeline</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Dedupe Status</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {lead.dedupe_status}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Lead Shared At</span>
                  <span className="text-sm text-gray-900">{formatDate(lead.lead_shared_at)}</span>
                </div>
                {lead.user_registered_at && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">User Registered At</span>
                    <span className="text-sm text-gray-900">{formatDate(lead.user_registered_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Loan Information */}
            {lead.loan_application_id && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Application Number</p>
                    <p className="text-gray-900 font-medium">{lead.application_number || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Loan Status</p>
                    <p className="text-gray-900 font-medium">{lead.loan_status || 'N/A'}</p>
                  </div>
                  {lead.disbursed_at && (
                    <>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Disbursed At</p>
                        <p className="text-gray-900 font-medium">{formatDate(lead.disbursed_at)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Disbursal Amount</p>
                        <p className="text-gray-900 font-medium">{formatCurrency(lead.disbursal_amount)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Payout Information */}
            {lead.payout_eligible && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout Information</h2>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Payout Amount</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(lead.payout_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Payout Grade</p>
                      <p className="text-lg font-semibold text-gray-900">{lead.payout_grade}</p>
                    </div>
                  </div>
                  <p className="text-sm text-green-700 mt-2">✅ Eligible for payout</p>
                </div>
              </div>
            )}

            {/* UTM Link */}
            {lead.utm_link && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">UTM Link</h2>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Tracking Link</p>
                  <a
                    href={lead.utm_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 break-all"
                  >
                    {lead.utm_link}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
