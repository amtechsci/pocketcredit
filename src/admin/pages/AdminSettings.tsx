import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Eye, 
  EyeOff, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Key,
  Mail,
  MessageSquare,
  CreditCard,
  Shield,
  Cloud,
  Smartphone,
  Globe,
  Lock,
  Unlock,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';

interface ApiConfig {
  id: string;
  name: string;
  type: 'sms' | 'email' | 'payment' | 'database' | 'cloud' | 'security' | 'webhook';
  status: 'active' | 'inactive' | 'error';
  description: string;
  fields: ApiField[];
  testEndpoint?: string;
  documentation?: string;
}

interface ApiField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'select' | 'textarea';
  value: string;
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  description?: string;
}

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState('sms');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingConfig, setTestingConfig] = useState<ApiConfig | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  const apiConfigs: ApiConfig[] = [
    {
      id: 'sms-twilio',
      name: 'Twilio SMS',
      type: 'sms',
      status: 'active',
      description: 'Send SMS notifications and alerts via Twilio',
      testEndpoint: '/api/test/sms',
      documentation: 'https://www.twilio.com/docs',
      fields: [
        { key: 'account_sid', label: 'Account SID', type: 'text', value: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, description: 'Your Twilio Account SID' },
        { key: 'auth_token', label: 'Auth Token', type: 'password', value: 'your_auth_token_here', required: true, description: 'Your Twilio Auth Token' },
        { key: 'phone_number', label: 'Phone Number', type: 'text', value: '+1234567890', required: true, description: 'Your Twilio phone number' },
        { key: 'webhook_url', label: 'Webhook URL', type: 'url', value: 'https://yourdomain.com/webhook/sms', required: false, description: 'Optional webhook for delivery status' }
      ]
    },
    {
      id: 'sms-textlocal',
      name: 'TextLocal SMS',
      type: 'sms',
      status: 'inactive',
      description: 'Alternative SMS provider for backup',
      testEndpoint: '/api/test/sms',
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', value: '', required: true, description: 'Your TextLocal API key' },
        { key: 'sender_id', label: 'Sender ID', type: 'text', value: 'POCKET', required: true, description: 'Sender name for SMS' },
        { key: 'country_code', label: 'Country Code', type: 'select', value: 'IN', required: true, options: [
          { value: 'IN', label: 'India (+91)' },
          { value: 'US', label: 'United States (+1)' },
          { value: 'UK', label: 'United Kingdom (+44)' }
        ]}
      ]
    },
    {
      id: 'email-smtp',
      name: 'SMTP Email',
      type: 'email',
      status: 'active',
      description: 'Send emails via SMTP server',
      testEndpoint: '/api/test/email',
      fields: [
        { key: 'host', label: 'SMTP Host', type: 'text', value: 'smtp.gmail.com', required: true, description: 'SMTP server hostname' },
        { key: 'port', label: 'Port', type: 'number', value: '587', required: true, description: 'SMTP server port' },
        { key: 'username', label: 'Username', type: 'email', value: 'noreply@pocketcredit.com', required: true, description: 'SMTP username' },
        { key: 'password', label: 'Password', type: 'password', value: 'your_app_password', required: true, description: 'SMTP password or app password' },
        { key: 'encryption', label: 'Encryption', type: 'select', value: 'tls', required: true, options: [
          { value: 'tls', label: 'TLS' },
          { value: 'ssl', label: 'SSL' },
          { value: 'none', label: 'None' }
        ]},
        { key: 'from_name', label: 'From Name', type: 'text', value: 'Pocket Credit', required: true, description: 'Display name for outgoing emails' }
      ]
    },
    {
      id: 'email-sendgrid',
      name: 'SendGrid Email',
      type: 'email',
      status: 'inactive',
      description: 'Send emails via SendGrid API',
      testEndpoint: '/api/test/email',
      documentation: 'https://docs.sendgrid.com',
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', value: '', required: true, description: 'Your SendGrid API key' },
        { key: 'from_email', label: 'From Email', type: 'email', value: 'noreply@pocketcredit.com', required: true, description: 'Verified sender email' },
        { key: 'from_name', label: 'From Name', type: 'text', value: 'Pocket Credit', required: true, description: 'Display name for outgoing emails' }
      ]
    },
    {
      id: 'payment-razorpay',
      name: 'Razorpay Payment',
      type: 'payment',
      status: 'active',
      description: 'Process payments via Razorpay',
      testEndpoint: '/api/test/payment',
      documentation: 'https://razorpay.com/docs',
      fields: [
        { key: 'key_id', label: 'Key ID', type: 'text', value: 'rzp_test_xxxxxxxxxxxxx', required: true, description: 'Your Razorpay Key ID' },
        { key: 'key_secret', label: 'Key Secret', type: 'password', value: 'your_key_secret_here', required: true, description: 'Your Razorpay Key Secret' },
        { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', value: 'your_webhook_secret', required: false, description: 'Webhook secret for payment verification' },
        { key: 'environment', label: 'Environment', type: 'select', value: 'test', required: true, options: [
          { value: 'test', label: 'Test' },
          { value: 'live', label: 'Live' }
        ]}
      ]
    },
    {
      id: 'cloud-aws',
      name: 'AWS S3 Storage',
      type: 'cloud',
      status: 'active',
      description: 'File storage and document management',
      testEndpoint: '/api/test/cloud',
      fields: [
        { key: 'access_key', label: 'Access Key ID', type: 'text', value: 'AKIAIOSFODNN7EXAMPLE', required: true, description: 'AWS Access Key ID' },
        { key: 'secret_key', label: 'Secret Access Key', type: 'password', value: 'your_secret_access_key', required: true, description: 'AWS Secret Access Key' },
        { key: 'bucket_name', label: 'Bucket Name', type: 'text', value: 'pocket-credit-documents', required: true, description: 'S3 bucket name' },
        { key: 'region', label: 'Region', type: 'text', value: 'us-east-1', required: true, description: 'AWS region' }
      ]
    },
    {
      id: 'security-jwt',
      name: 'JWT Authentication',
      type: 'security',
      status: 'active',
      description: 'JSON Web Token configuration',
      fields: [
        { key: 'secret', label: 'JWT Secret', type: 'password', value: 'your_jwt_secret_key_here', required: true, description: 'Secret key for JWT signing' },
        { key: 'expires_in', label: 'Token Expiry', type: 'text', value: '24h', required: true, description: 'Token expiration time' },
        { key: 'refresh_expires_in', label: 'Refresh Token Expiry', type: 'text', value: '7d', required: true, description: 'Refresh token expiration time' }
      ]
    },
    {
      id: 'webhook-loan-status',
      name: 'Loan Status Webhook',
      type: 'webhook',
      status: 'active',
      description: 'Notify external systems about loan status changes',
      testEndpoint: '/api/test/webhook',
      fields: [
        { key: 'url', label: 'Webhook URL', type: 'url', value: 'https://external-system.com/webhook/loan-status', required: true, description: 'External system webhook URL' },
        { key: 'secret', label: 'Webhook Secret', type: 'password', value: 'your_webhook_secret', required: false, description: 'Secret for webhook verification' },
        { key: 'events', label: 'Events', type: 'textarea', value: 'loan.approved,loan.rejected,loan.disbursed', required: true, description: 'Comma-separated list of events to send' }
      ]
    }
  ];

  const tabs = [
    { id: 'sms', label: 'SMS APIs', icon: MessageSquare, count: apiConfigs.filter(c => c.type === 'sms').length },
    { id: 'email', label: 'Email APIs', icon: Mail, count: apiConfigs.filter(c => c.type === 'email').length },
    { id: 'payment', label: 'Payment APIs', icon: CreditCard, count: apiConfigs.filter(c => c.type === 'payment').length },
    { id: 'cloud', label: 'Cloud Storage', icon: Cloud, count: apiConfigs.filter(c => c.type === 'cloud').length },
    { id: 'security', label: 'Security', icon: Shield, count: apiConfigs.filter(c => c.type === 'security').length },
    { id: 'webhook', label: 'Webhooks', icon: Globe, count: apiConfigs.filter(c => c.type === 'webhook').length }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sms': return MessageSquare;
      case 'email': return Mail;
      case 'payment': return CreditCard;
      case 'cloud': return Cloud;
      case 'security': return Shield;
      case 'webhook': return Globe;
      default: return Settings;
    }
  };

  const handleFieldChange = (configId: string, fieldKey: string, value: string) => {
    // In a real app, this would update the state
    console.log(`Updating ${configId}.${fieldKey} to:`, value);
  };

  const handleTestConnection = async (config: ApiConfig) => {
    setTestingConfig(config);
    setShowTestModal(true);
    setIsTesting(true);
    setTestResult(null);

    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = Math.random() > 0.3; // 70% success rate for demo
    setTestResult({
      success,
      message: success 
        ? `Connection to ${config.name} successful!` 
        : `Connection failed: ${config.name} is not responding.`
    });
    setIsTesting(false);
  };

  const handleSaveConfig = (configId: string) => {
    alert(`Configuration for ${configId} saved successfully!`);
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const filteredConfigs = apiConfigs.filter(config => config.type === activeTab);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Manage API keys, credentials, and third-party integrations</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Save className="w-4 h-4" />
              Save All Changes
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Configuration Cards */}
        <div className="space-y-6">
          {filteredConfigs.map((config) => {
            const TypeIcon = getTypeIcon(config.type);
            return (
              <div key={config.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <TypeIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                        <p className="text-sm text-gray-600">{config.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(config.status)}`}>
                        {config.status.toUpperCase()}
                      </span>
                      {config.testEndpoint && (
                        <button
                          onClick={() => handleTestConnection(config)}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <TestTube className="w-4 h-4" />
                          Test
                        </button>
                      )}
                      {config.documentation && (
                        <a
                          href={config.documentation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Docs
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Configuration Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        
                        {field.type === 'select' ? (
                          <select
                            value={field.value}
                            onChange={(e) => handleFieldChange(config.id, field.key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {field.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            value={field.value}
                            onChange={(e) => handleFieldChange(config.id, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="relative">
                            <input
                              type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                              value={field.value}
                              onChange={(e) => handleFieldChange(config.id, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                              {field.type === 'password' && (
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(field.key)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(field.value)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {field.description && (
                          <p className="text-xs text-gray-500">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleSaveConfig(config.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Test Connection Modal */}
        {showTestModal && testingConfig && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000024' }}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 ring-1 ring-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Test Connection</h4>
                <button 
                  onClick={() => setShowTestModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    {React.createElement(getTypeIcon(testingConfig.type), { className: "w-5 h-5 text-blue-600" })}
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">{testingConfig.name}</h5>
                    <p className="text-sm text-gray-600">{testingConfig.description}</p>
                  </div>
                </div>

                {isTesting ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Testing connection...</p>
                    </div>
                  </div>
                ) : testResult ? (
                  <div className={`p-4 rounded-lg ${
                    testResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <p className={`text-sm font-medium ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResult.message}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowTestModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                  {!isTesting && (
                    <button
                      onClick={() => handleTestConnection(testingConfig)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Test Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
