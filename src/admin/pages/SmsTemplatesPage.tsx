import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Copy,
  Eye
} from 'lucide-react';

interface SmsTemplate {
  id: number;
  template_key: string;
  template_name: string;
  template_id: string | null;
  sender_id: string;
  message_template: string;
  trigger_type: 'dpd' | 'status' | 'event' | 'salary_day' | 'commitment';
  dpd_values: number[] | { min: number; max: number } | null;
  status_values: string[] | null;
  scheduled_times: string[];
  send_to: 'primary' | 'both' | 'alternate' | 'reference';
  is_active: boolean;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const TRIGGER_TYPES = [
  { value: 'dpd', label: 'DPD Based' },
  { value: 'status', label: 'Status Based' },
  { value: 'event', label: 'Event Based' },
  { value: 'salary_day', label: 'Salary Day' },
  { value: 'commitment', label: 'Commitment Day' }
];

const SEND_TO_OPTIONS = [
  { value: 'primary', label: 'Primary Only' },
  { value: 'both', label: 'Primary & Alternate' },
  { value: 'alternate', label: 'Alternate Only' },
  { value: 'reference', label: 'Reference' }
];

const CATEGORIES = [
  { value: 'collection', label: 'Collection' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'notification', label: 'Notification' }
];

const STATUS_OPTIONS = [
  'submitted', 'follow_up', 'ready_to_disburse', 'repeat_disbursal',
  'account_manager', 'overdue', 'cleared', 'rejected', 'hold'
];

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export function SmsTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTriggerType, setFilterTriggerType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<SmsTemplate>>({});
  
  // Preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<SmsTemplate | null>(null);

  // Load templates
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/admin/sms-templates?';
      if (filterCategory) url += `category=${filterCategory}&`;
      if (filterTriggerType) url += `trigger_type=${filterTriggerType}&`;
      if (filterActive) url += `is_active=${filterActive}&`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data);
      } else {
        setError(result.message || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Toggle template active status
  const toggleTemplateStatus = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/sms-templates/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTemplates(prev => prev.map(t => 
          t.id === id ? { ...t, is_active: result.data.is_active } : t
        ));
      }
    } catch (err) {
      console.error('Error toggling template:', err);
    }
  };

  // Save template
  const saveTemplate = async () => {
    try {
      setSaving(true);
      
      const url = editingTemplate 
        ? `/api/admin/sms-templates/${editingTemplate.id}`
        : '/api/admin/sms-templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowEditModal(false);
        setEditingTemplate(null);
        setFormData({});
        loadTemplates();
      } else {
        alert(result.message || 'Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const deleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const response = await fetch(`/api/admin/sms-templates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        loadTemplates();
      } else {
        alert(result.message || 'Failed to delete template');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template');
    }
  };

  // Open edit modal
  const openEditModal = (template?: SmsTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        template_key: template.template_key,
        template_name: template.template_name,
        template_id: template.template_id || '',
        sender_id: template.sender_id,
        message_template: template.message_template,
        trigger_type: template.trigger_type,
        dpd_values: template.dpd_values,
        status_values: template.status_values,
        scheduled_times: template.scheduled_times,
        send_to: template.send_to,
        category: template.category,
        description: template.description
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        template_key: '',
        template_name: '',
        template_id: '',
        sender_id: 'PKTCRD',
        message_template: '',
        trigger_type: 'dpd',
        dpd_values: { min: 0, max: 5 },
        scheduled_times: ['09:00', '14:00', '18:00'],
        send_to: 'both',
        category: 'collection'
      });
    }
    setShowEditModal(true);
  };

  // Copy template ID
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Format DPD values for display
  const formatDpdValues = (dpd: number[] | { min: number; max: number } | null): string => {
    if (!dpd) return 'N/A';
    if (Array.isArray(dpd)) {
      return dpd.join(', ');
    }
    return `${dpd.min} to ${dpd.max}`;
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    if (searchTerm && !t.template_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !t.template_key.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    loadTemplates();
  }, [filterCategory, filterTriggerType, filterActive]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/stpl/settings')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                SMS Templates
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage automated SMS templates for notifications and collections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openEditModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Template
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            
            <select
              value={filterTriggerType}
              onChange={(e) => setFilterTriggerType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Trigger Types</option>
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{templates.length}</div>
            <div className="text-sm text-gray-600">Total Templates</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {templates.filter(t => t.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">
              {templates.filter(t => !t.template_id).length}
            </div>
            <div className="text-sm text-gray-600">Missing DLT ID</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">
              {templates.filter(t => t.trigger_type === 'dpd').length}
            </div>
            <div className="text-sm text-gray-600">DPD Based</div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Loading templates...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-4">
              {templates.length === 0 
                ? 'No SMS templates configured yet. Click "Add Template" to create one.'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          /* Templates Table */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">DLT Template ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trigger</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">DPD Range</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Send To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className={`hover:bg-gray-50 ${!template.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleTemplateStatus(template.id)}
                          className="flex items-center"
                        >
                          {template.is_active ? (
                            <ToggleRight className="w-8 h-8 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{template.template_name}</div>
                          <div className="text-xs text-gray-500">{template.template_key}</div>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                            template.category === 'collection' ? 'bg-red-100 text-red-700' :
                            template.category === 'reminder' ? 'bg-yellow-100 text-yellow-700' :
                            template.category === 'marketing' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {template.category || 'uncategorized'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {template.template_id ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {template.template_id.substring(0, 15)}...
                            </code>
                            <button
                              onClick={() => copyToClipboard(template.template_id!)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Not configured
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          template.trigger_type === 'dpd' ? 'bg-blue-100 text-blue-700' :
                          template.trigger_type === 'status' ? 'bg-green-100 text-green-700' :
                          template.trigger_type === 'salary_day' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {template.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {template.trigger_type === 'status' 
                          ? (template.status_values?.join(', ') || 'N/A')
                          : formatDpdValues(template.dpd_values)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {template.scheduled_times.slice(0, 3).map((time, i) => (
                            <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              {time}
                            </span>
                          ))}
                          {template.scheduled_times.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{template.scheduled_times.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {template.send_to}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPreviewTemplate(template);
                              setShowPreviewModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(template)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Add New Template'}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Key *
                  </label>
                  <input
                    type="text"
                    value={formData.template_key || ''}
                    onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                    placeholder="e.g., dpd_0_alert"
                    disabled={!!editingTemplate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.template_name || ''}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    placeholder="e.g., DPD 0 Alert"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DLT Template ID
                  </label>
                  <input
                    type="text"
                    value={formData.template_id || ''}
                    onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                    placeholder="e.g., 10071563371411XXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required for SMS to be sent</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender ID
                  </label>
                  <input
                    type="text"
                    value={formData.sender_id || 'PKTCRD'}
                    onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Template *
                </label>
                <textarea
                  value={formData.message_template || ''}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  rows={3}
                  placeholder="Use variables: {name}, {url}, {due_date}, {emi_amount}, {days_passed}, {savings}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: {'{name}'}, {'{url}'}, {'{due_date}'}, {'{emi_amount}'}, {'{days_passed}'}, {'{savings}'}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Type
                  </label>
                  <select
                    value={formData.trigger_type || 'dpd'}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRIGGER_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send To
                  </label>
                  <select
                    value={formData.send_to || 'both'}
                    onChange={(e) => setFormData({ ...formData, send_to: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SEND_TO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Times (comma separated)
                </label>
                <input
                  type="text"
                  value={Array.isArray(formData.scheduled_times) ? formData.scheduled_times.join(', ') : ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scheduled_times: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., 09:00, 14:00, 18:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {formData.trigger_type === 'dpd' || formData.trigger_type === 'salary_day' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DPD Min
                    </label>
                    <input
                      type="number"
                      value={typeof formData.dpd_values === 'object' && !Array.isArray(formData.dpd_values) 
                        ? formData.dpd_values?.min || 0 
                        : 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dpd_values: { 
                          min: parseInt(e.target.value) || 0, 
                          max: typeof formData.dpd_values === 'object' && !Array.isArray(formData.dpd_values)
                            ? formData.dpd_values?.max || 0
                            : 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DPD Max
                    </label>
                    <input
                      type="number"
                      value={typeof formData.dpd_values === 'object' && !Array.isArray(formData.dpd_values) 
                        ? formData.dpd_values?.max || 0 
                        : 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dpd_values: { 
                          min: typeof formData.dpd_values === 'object' && !Array.isArray(formData.dpd_values)
                            ? formData.dpd_values?.min || 0
                            : 0,
                          max: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : formData.trigger_type === 'status' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Values
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(status => (
                      <label key={status} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.status_values?.includes(status) || false}
                          onChange={(e) => {
                            const current = formData.status_values || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, status_values: [...current, status] });
                            } else {
                              setFormData({ ...formData, status_values: current.filter(s => s !== status) });
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Template Name</div>
                <div className="text-gray-900">{previewTemplate.template_name}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500">Message</div>
                <div className="bg-gray-50 rounded-lg p-4 text-gray-900 whitespace-pre-wrap">
                  {previewTemplate.message_template}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-500">Trigger Type</div>
                  <div className="text-gray-900">{previewTemplate.trigger_type}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-500">Send To</div>
                  <div className="text-gray-900">{previewTemplate.send_to}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-500">DPD Range</div>
                  <div className="text-gray-900">{formatDpdValues(previewTemplate.dpd_values)}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-500">Category</div>
                  <div className="text-gray-900">{previewTemplate.category || 'N/A'}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500 mb-2">Scheduled Times</div>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.scheduled_times.map((time, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
