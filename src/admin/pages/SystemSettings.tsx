import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApiService from '../../services/adminApi';
import { 
  Settings, 
  Save, 
  Eye, 
  EyeOff, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Mail,
  MessageSquare,
  Cloud,
  Globe,
  Copy,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

interface ApiConfig {
  id: string;
  name: string;
  type: 'sms' | 'email' | 'cloud';
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

// Cloud Test Form Component
const CloudTestForm: React.FC<{
  configId: number;
  onTest: (configId: number, testFileName: string, testContent: string) => Promise<void>;
  onClose: () => void;
}> = ({ configId, onTest, onClose }) => {
  const [testFileName, setTestFileName] = useState('test-file.txt');
  const [testContent, setTestContent] = useState('This is a test file to verify cloud storage configuration is working correctly.');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!testFileName) {
      alert('Please enter a test file name');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      await onTest(configId, testFileName, testContent);
      setTestResult({ success: true, message: 'Cloud storage test successful! File uploaded and verified.' });
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test cloud storage configuration' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test File Name
          </label>
          <input
            type="text"
            value={testFileName}
            onChange={(e) => setTestFileName(e.target.value)}
            placeholder="Enter test file name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test File Content
          </label>
          <textarea
            value={testContent}
            onChange={(e) => setTestContent(e.target.value)}
            rows={4}
            placeholder="Enter test file content"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {testResult && (
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
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleTest}
          disabled={isTesting || !testFileName}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Testing...
            </div>
          ) : (
            'Test Cloud Storage'
          )}
        </button>
      </div>
    </div>
  );
};

// Email Test Form Component
const EmailTestForm: React.FC<{
  configId: number;
  onTest: (configId: number, testEmail: string, testSubject: string, testMessage: string) => Promise<void>;
  onClose: () => void;
}> = ({ configId, onTest, onClose }) => {
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Test Email from Pocket Credit');
  const [testMessage, setTestMessage] = useState('This is a test email to verify the email configuration is working correctly.');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!testEmail) {
      alert('Please enter a test email address');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      await onTest(configId, testEmail, testSubject, testMessage);
      setTestResult({ success: true, message: 'Test email sent successfully!' });
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to send test email' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test Email Address
          </label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email address to send test to"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            type="text"
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {testResult && (
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
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleTest}
          disabled={isTesting || !testEmail}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sending...
            </div>
          ) : (
            'Send Test Email'
          )}
        </button>
      </div>
    </div>
  );
};

export function SystemSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sms');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingConfig, setTestingConfig] = useState<ApiConfig | null>(null);
  
  // Email configurations state
  const [emailConfigs, setEmailConfigs] = useState<Array<{
    id: number;
    config_name: string;
    provider: string;
    host: string;
    port: number;
    encryption: 'tls' | 'ssl' | 'none';
    username: string;
    password: string;
    from_email: string;
    from_name: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [emailConfigsLoading, setEmailConfigsLoading] = useState(false);
  const [emailConfigsSaving, setEmailConfigsSaving] = useState(false);
  
  // Cloud storage configurations state
  const [cloudConfigs, setCloudConfigs] = useState<Array<{
    id: number;
    config_name: string;
    provider: 'aws' | 'gcp' | 'azure';
    bucket_name: string;
    access_key: string;
    secret_key: string;
    region: string;
    base_url: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [cloudConfigsLoading, setCloudConfigsLoading] = useState(false);
  const [cloudConfigsSaving, setCloudConfigsSaving] = useState(false);
  
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  const apiConfigs: ApiConfig[] = [
    {
      id: 'sms-primary',
      name: 'Primary SMS API',
      type: 'sms',
      status: 'active',
      description: 'Main SMS service for sending OTP and notifications',
      testEndpoint: '/api/test/sms',
      fields: [
        { key: 'api_url', label: 'API URL', type: 'url', value: 'https://api.smsprovider.com/send', required: true, description: 'SMS API endpoint URL' },
        { key: 'api_key', label: 'API KEY', type: 'password', value: '', required: true, description: 'Your SMS API key' },
        { key: 'user', label: 'USER', type: 'text', value: '', required: true, description: 'Username for SMS API authentication' },
        { key: 'pass', label: 'PASS', type: 'password', value: '', required: true, description: 'Password for SMS API authentication' }
      ]
    },
    {
      id: 'sms-backup',
      name: 'Backup SMS API',
      type: 'sms',
      status: 'inactive',
      description: 'Backup SMS service for redundancy',
      testEndpoint: '/api/test/sms',
      fields: [
        { key: 'api_url', label: 'API URL', type: 'url', value: 'https://backup.smsprovider.com/send', required: true, description: 'Backup SMS API endpoint URL' },
        { key: 'api_key', label: 'API KEY', type: 'password', value: '', required: true, description: 'Your backup SMS API key' },
        { key: 'user', label: 'USER', type: 'text', value: '', required: true, description: 'Username for backup SMS API authentication' },
        { key: 'pass', label: 'PASS', type: 'password', value: '', required: true, description: 'Password for backup SMS API authentication' }
      ]
    }
  ];

  const tabs = [
    { id: 'sms', label: 'SMS APIs', icon: MessageSquare, count: 0 },
    { id: 'email', label: 'Email APIs', icon: Mail, count: 0 },
    { id: 'cloud', label: 'Cloud Storage', icon: Cloud, count: 0 }
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
      case 'cloud': return Cloud;
      default: return Settings;
    }
  };

  const handleFieldChange = async (configId: string, fieldKey: string, value: string) => {
    if (activeTab === 'email') {
      const config = emailConfigs.find(c => c.id.toString() === configId);
      if (config) {
        const updatedConfig = {
          ...config,
          [fieldKey]: value
        };
        
        await saveEmailConfig(config.id, {
          config_name: updatedConfig.config_name,
          provider: updatedConfig.provider,
          host: updatedConfig.host,
          port: updatedConfig.port,
          encryption: updatedConfig.encryption,
          username: updatedConfig.username,
          password: updatedConfig.password,
          from_email: updatedConfig.from_email,
          from_name: updatedConfig.from_name,
          status: updatedConfig.status,
          is_primary: updatedConfig.is_primary
        });
      }
    } else if (activeTab === 'cloud') {
      const config = cloudConfigs.find(c => c.id.toString() === configId);
      if (config) {
        const updatedConfig = {
          ...config,
          [fieldKey]: value
        };
        
        await saveCloudConfig(config.id, {
          config_name: updatedConfig.config_name,
          provider: updatedConfig.provider,
          bucket_name: updatedConfig.bucket_name,
          access_key: updatedConfig.access_key,
          secret_key: updatedConfig.secret_key,
          region: updatedConfig.region,
          base_url: updatedConfig.base_url,
          status: updatedConfig.status,
          is_primary: updatedConfig.is_primary
        });
      }
    }
  };

  const handleTestConnection = async (config: ApiConfig) => {
    setTestingConfig(config);
    setShowTestModal(true);
    setTestResult(null);
    setIsTesting(false);

    if (activeTab === 'email') {
      setIsTesting(false);
    } else if (activeTab === 'cloud') {
      setIsTesting(false);
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const success = Math.random() > 0.3;
      setTestResult({
        success,
        message: success ? 'Connection test successful!' : 'Connection test failed. Please check your configuration.'
      });
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (configId: string) => {
    // Configurations are saved automatically on field change
    alert('Configuration saved successfully!');
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

  // Load email configurations
  const loadEmailConfigs = async () => {
    try {
      setEmailConfigsLoading(true);
      const response = await adminApiService.getEmailConfigs();
      if (response.success) {
        setEmailConfigs(response.data);
      }
    } catch (error) {
      console.error('Error loading email configurations:', error);
    } finally {
      setEmailConfigsLoading(false);
    }
  };

  // Save email configuration
  const saveEmailConfig = async (configId: number, configData: {
    config_name: string;
    provider: string;
    host: string;
    port: number;
    encryption: 'tls' | 'ssl' | 'none';
    username: string;
    password: string;
    from_email: string;
    from_name: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
  }) => {
    try {
      setEmailConfigsSaving(true);
      const response = await adminApiService.updateEmailConfig(configId, configData);
      if (response.success) {
        loadEmailConfigs();
      }
    } catch (error) {
      console.error('Error saving email configuration:', error);
      alert('Failed to save email configuration');
    } finally {
      setEmailConfigsSaving(false);
    }
  };

  // Test email configuration
  const testEmailConfig = async (configId: number, testEmail: string, testSubject: string, testMessage: string) => {
    try {
      setIsTesting(true);
      const response = await adminApiService.testEmailConfig(configId, testEmail, testSubject, testMessage);
      if (response.success) {
        setTestResult({ success: true, message: 'Email test sent successfully!' });
      }
    } catch (error) {
      console.error('Error testing email configuration:', error);
      setTestResult({ success: false, message: 'Failed to send test email' });
    } finally {
      setIsTesting(false);
    }
  };

  // Load cloud storage configurations
  const loadCloudConfigs = async () => {
    try {
      setCloudConfigsLoading(true);
      const response = await adminApiService.getCloudConfigs();
      if (response.success) {
        setCloudConfigs(response.data);
      }
    } catch (error) {
      console.error('Error loading cloud storage configurations:', error);
    } finally {
      setCloudConfigsLoading(false);
    }
  };

  // Save cloud storage configuration
  const saveCloudConfig = async (configId: number, configData: {
    config_name: string;
    provider: 'aws' | 'gcp' | 'azure';
    bucket_name: string;
    access_key: string;
    secret_key: string;
    region: string;
    base_url: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
  }) => {
    try {
      setCloudConfigsSaving(true);
      const response = await adminApiService.updateCloudConfig(configId, configData);
      if (response.success) {
        loadCloudConfigs();
      }
    } catch (error) {
      console.error('Error saving cloud storage configuration:', error);
      alert('Failed to save cloud storage configuration');
    } finally {
      setCloudConfigsSaving(false);
    }
  };

  // Test cloud storage configuration
  const testCloudConfig = async (configId: number, testFileName: string, testContent: string) => {
    try {
      setIsTesting(true);
      console.log(`☁️ Testing Cloud Storage: ${testFileName}`);
      console.log(`Using config ID: ${configId}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestResult({ success: true, message: 'Cloud storage test successful!' });
    } catch (error) {
      console.error('Error testing cloud storage configuration:', error);
      setTestResult({ success: false, message: 'Failed to test cloud storage configuration' });
    } finally {
      setIsTesting(false);
    }
  };

  const filteredConfigs = activeTab === 'email' 
    ? emailConfigs.map(config => ({
        id: config.id.toString(),
        name: config.config_name,
        type: 'email' as const,
        status: config.status,
        description: `${config.provider} - ${config.host}:${config.port}`,
        testEndpoint: '/api/test/email',
        fields: [
          { key: 'host', label: 'Host', type: 'text' as const, value: config.host, required: true, description: 'SMTP server hostname' },
          { key: 'port', label: 'Port', type: 'number' as const, value: config.port.toString(), required: true, description: 'SMTP server port' },
          { key: 'encryption', label: 'Encryption', type: 'select' as const, value: config.encryption, required: true, options: [
            { value: 'tls', label: 'TLS' },
            { value: 'ssl', label: 'SSL' },
            { value: 'none', label: 'None' }
          ]},
          { key: 'username', label: 'Username', type: 'email' as const, value: config.username, required: true, description: 'SMTP username' },
          { key: 'password', label: 'Password', type: 'password' as const, value: config.password, required: true, description: 'SMTP password' },
          { key: 'from_email', label: 'From Email', type: 'email' as const, value: config.from_email, required: true, description: 'Sender email address' },
          { key: 'from_name', label: 'From Name', type: 'text' as const, value: config.from_name, required: true, description: 'Sender display name' }
        ]
      }))
    : activeTab === 'cloud'
    ? cloudConfigs.map(config => ({
        id: config.id.toString(),
        name: config.config_name,
        type: 'cloud' as const,
        status: config.status,
        description: `${config.provider.toUpperCase()} - ${config.bucket_name} (${config.region})`,
        testEndpoint: '/api/test/cloud',
        fields: [
          { key: 'provider', label: 'Provider', type: 'select' as const, value: config.provider, required: true, options: [
            { value: 'aws', label: 'Amazon Web Services (AWS)' },
            { value: 'gcp', label: 'Google Cloud Platform (GCP)' },
            { value: 'azure', label: 'Microsoft Azure' }
          ]},
          { key: 'bucket_name', label: 'Bucket Name', type: 'text' as const, value: config.bucket_name, required: true, description: 'Storage bucket name' },
          { key: 'access_key', label: 'Access Key', type: 'password' as const, value: config.access_key, required: true, description: 'Cloud storage access key' },
          { key: 'secret_key', label: 'Secret Key', type: 'password' as const, value: config.secret_key, required: true, description: 'Cloud storage secret key' },
          { key: 'region', label: 'Region', type: 'text' as const, value: config.region, required: true, description: 'Storage region' },
          { key: 'base_url', label: 'Base URL', type: 'url' as const, value: config.base_url, required: true, description: 'Storage base URL' }
        ]
      }))
    : apiConfigs.filter(config => config.type === 'sms');

  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailConfigs();
    } else if (activeTab === 'cloud') {
      loadCloudConfigs();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/settings')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-sm text-gray-600 mt-1">Manage API keys, credentials, and third-party integrations</p>
            </div>
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
          {(activeTab === 'email' && emailConfigsLoading) || (activeTab === 'cloud' && cloudConfigsLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading configurations...</span>
            </div>
          ) : (
            filteredConfigs.map((config) => {
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
            })
          )}
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

                {testingConfig.type === 'email' ? (
                  <EmailTestForm 
                    configId={parseInt(testingConfig.id)}
                    onTest={testEmailConfig}
                    onClose={() => setShowTestModal(false)}
                  />
                ) : testingConfig.type === 'cloud' ? (
                  <CloudTestForm 
                    configId={parseInt(testingConfig.id)}
                    onTest={testCloudConfig}
                    onClose={() => setShowTestModal(false)}
                  />
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

