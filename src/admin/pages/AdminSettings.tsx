import React, { useEffect, useState } from 'react';
import adminApiService from '../../services/adminApi';
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

interface UserConfig {
  id: number;
  value: string;
  description: string;
  updated_at: string;
}

interface UserConfigData {
  default_credit_score: UserConfig;
  credit_limit_multiplier: UserConfig;
  min_credit_score: UserConfig;
  max_credit_score: UserConfig;
  credit_score_update_frequency: UserConfig;
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

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState('sms');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingConfig, setTestingConfig] = useState<ApiConfig | null>(null);
  const [userConfig, setUserConfig] = useState<UserConfigData | null>(null);
  const [userConfigLoading, setUserConfigLoading] = useState(false);
  const [userConfigSaving, setUserConfigSaving] = useState(false);
  
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

  // Member tiers state
  const [tiers, setTiers] = useState<Array<{ id: number; tier_name: string; processing_fee_percent: number; interest_percent_per_day: number }>>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tierForm, setTierForm] = useState<{ tier_name: string; processing_fee_percent: string; interest_percent_per_day: string }>({
    tier_name: '',
    processing_fee_percent: '',
    interest_percent_per_day: '0.01'
  });

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
    },
    {
      id: 'email-smtp-primary',
      name: 'Primary SMTP',
      type: 'email',
      status: 'active',
      description: 'Main SMTP server for sending emails',
      testEndpoint: '/api/test/email',
      fields: [
        { key: 'host', label: 'Host', type: 'text', value: 'smtp.gmail.com', required: true, description: 'SMTP server hostname' },
        { key: 'port', label: 'Port', type: 'number', value: '587', required: true, description: 'SMTP server port' },
        { key: 'encryption', label: 'Encryption', type: 'select', value: 'tls', required: true, options: [
          { value: 'tls', label: 'TLS' },
          { value: 'ssl', label: 'SSL' },
          { value: 'none', label: 'None' }
        ]},
        { key: 'username', label: 'Username', type: 'email', value: 'noreply@pocketcredit.com', required: true, description: 'SMTP username' },
        { key: 'password', label: 'Password', type: 'password', value: '', required: true, description: 'SMTP password' },
        { key: 'from_email', label: 'From Email', type: 'email', value: 'noreply@pocketcredit.com', required: true, description: 'From email address' },
        { key: 'from_name', label: 'From Name', type: 'text', value: 'Pocket Credit', required: true, description: 'From display name' },
        { key: 'status', label: 'Status', type: 'select', value: 'active', required: true, options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ]}
      ]
    },
    {
      id: 'email-smtp-backup',
      name: 'Backup SMTP',
      type: 'email',
      status: 'inactive',
      description: 'Backup SMTP server for redundancy',
      testEndpoint: '/api/test/email',
      fields: [
        { key: 'host', label: 'Host', type: 'text', value: 'smtp.mailgun.org', required: true, description: 'Backup SMTP server hostname' },
        { key: 'port', label: 'Port', type: 'number', value: '587', required: true, description: 'Backup SMTP server port' },
        { key: 'encryption', label: 'Encryption', type: 'select', value: 'tls', required: true, options: [
          { value: 'tls', label: 'TLS' },
          { value: 'ssl', label: 'SSL' },
          { value: 'none', label: 'None' }
        ]},
        { key: 'username', label: 'Username', type: 'email', value: '', required: true, description: 'Backup SMTP username' },
        { key: 'password', label: 'Password', type: 'password', value: '', required: true, description: 'Backup SMTP password' },
        { key: 'from_email', label: 'From Email', type: 'email', value: '', required: true, description: 'Backup from email address' },
        { key: 'from_name', label: 'From Name', type: 'text', value: 'Pocket Credit', required: true, description: 'Backup from display name' },
        { key: 'status', label: 'Status', type: 'select', value: 'inactive', required: true, options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ]}
      ]
    },
    {
      id: 'cloud-storage',
      name: 'Cloud Storage',
      type: 'cloud',
      status: 'active',
      description: 'File storage and document management',
      testEndpoint: '/api/test/cloud',
      fields: [
        { key: 'provider', label: 'Provider', type: 'select', value: 'aws', required: true, options: [
          { value: 'aws', label: 'AWS S3' },
          { value: 'gcp', label: 'Google Cloud Storage' },
          { value: 'azure', label: 'Azure Blob Storage' }
        ]},
        { key: 'bucket_name', label: 'Bucket Name', type: 'text', value: 'pocket-credit-documents', required: true, description: 'Storage bucket name' },
        { key: 'access_key', label: 'Access Key', type: 'password', value: '', required: true, description: 'Cloud storage access key' },
        { key: 'secret_key', label: 'Secret Key', type: 'password', value: '', required: true, description: 'Cloud storage secret key' },
        { key: 'region', label: 'Region', type: 'text', value: 'us-east-1', required: true, description: 'Storage region' },
        { key: 'base_url', label: 'Base URL', type: 'url', value: 'https://s3.amazonaws.com', required: true, description: 'Storage base URL' }
      ]
    }
  ];

  const tabs = [
    { id: 'sms', label: 'SMS APIs', icon: MessageSquare, count: 0 },
    { id: 'email', label: 'Email APIs', icon: Mail, count: 0 },
    { id: 'cloud', label: 'Cloud Storage', icon: Cloud, count: 0 },
    { id: 'members', label: 'Member Tiers', icon: Shield, count: 0 },
    { id: 'user-config', label: 'User Config', icon: Settings, count: 0 }
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

  const handleFieldChange = async (configId: string, fieldKey: string, value: string) => {
    if (activeTab === 'email') {
      // Find the email config and update it
      const config = emailConfigs.find(c => c.id.toString() === configId);
      if (config) {
        const updatedConfig = {
          ...config,
          [fieldKey]: value
        };
        
        // Save to database
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
      // Find the cloud config and update it
      const config = cloudConfigs.find(c => c.id.toString() === configId);
      if (config) {
        const updatedConfig = {
          ...config,
          [fieldKey]: value
        };
        
        // Save to database
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
    } else {
      // For other tabs, just log the change
      console.log(`Updating ${configId}.${fieldKey} to:`, value);
    }
  };

  const handleTestConnection = async (config: ApiConfig) => {
    setTestingConfig(config);
    setShowTestModal(true);
    setIsTesting(true);
    setTestResult(null);

    if (activeTab === 'email') {
      // For email configurations, we'll show a test modal
      // The actual test will be triggered from the modal
      setIsTesting(false);
    } else if (activeTab === 'cloud') {
      // For cloud configurations, we'll show a test modal
      // The actual test will be triggered from the modal
      setIsTesting(false);
    } else {
      // Simulate API test for other configurations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const success = Math.random() > 0.3; // 70% success rate for demo
      setTestResult({
        success,
        message: success 
          ? `Connection to ${config.name} successful!` 
          : `Connection failed: ${config.name} is not responding.`
      });
      setIsTesting(false);
    }
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

  const filteredConfigs = activeTab === 'email' 
    ? emailConfigs.map(config => ({
        id: config.id.toString(),
        name: config.config_name,
        type: 'email',
        status: config.status,
        description: `${config.provider} - ${config.host}:${config.port}`,
        testEndpoint: '/api/test/email',
        fields: [
          { key: 'host', label: 'Host', type: 'text', value: config.host, required: true, description: 'SMTP server hostname' },
          { key: 'port', label: 'Port', type: 'number', value: config.port.toString(), required: true, description: 'SMTP server port' },
          { key: 'encryption', label: 'Encryption', type: 'select', value: config.encryption, required: true, options: [
            { value: 'tls', label: 'TLS' },
            { value: 'ssl', label: 'SSL' },
            { value: 'none', label: 'None' }
          ]},
          { key: 'username', label: 'Username', type: 'email', value: config.username, required: true, description: 'SMTP username' },
          { key: 'password', label: 'Password', type: 'password', value: config.password, required: true, description: 'SMTP password' },
          { key: 'from_email', label: 'From Email', type: 'email', value: config.from_email, required: true, description: 'Sender email address' },
          { key: 'from_name', label: 'From Name', type: 'text', value: config.from_name, required: true, description: 'Sender display name' }
        ]
      }))
    : activeTab === 'cloud'
    ? cloudConfigs.map(config => ({
        id: config.id.toString(),
        name: config.config_name,
        type: 'cloud',
        status: config.status,
        description: `${config.provider.toUpperCase()} - ${config.bucket_name} (${config.region})`,
        testEndpoint: '/api/test/cloud',
        fields: [
          { key: 'provider', label: 'Provider', type: 'select', value: config.provider, required: true, options: [
            { value: 'aws', label: 'Amazon Web Services (AWS)' },
            { value: 'gcp', label: 'Google Cloud Platform (GCP)' },
            { value: 'azure', label: 'Microsoft Azure' }
          ]},
          { key: 'bucket_name', label: 'Bucket Name', type: 'text', value: config.bucket_name, required: true, description: 'Cloud storage bucket name' },
          { key: 'access_key', label: 'Access Key', type: 'text', value: config.access_key, required: true, description: 'Cloud provider access key' },
          { key: 'secret_key', label: 'Secret Key', type: 'password', value: config.secret_key, required: true, description: 'Cloud provider secret key' },
          { key: 'region', label: 'Region', type: 'text', value: config.region, required: true, description: 'Cloud provider region' },
          { key: 'base_url', label: 'Base URL', type: 'text', value: config.base_url, required: true, description: 'Cloud storage base URL' }
        ]
      }))
    : apiConfigs.filter(config => config.type === activeTab);

  // Member tiers helpers
  const loadTiers = async () => {
    setTiersLoading(true);
    const res = await adminApiService.getMemberTiers();
    if (res.status === 'success' && res.data) setTiers(res.data);
    setTiersLoading(false);
  };

  const seedDefaultTiers = async () => {
    setTiersLoading(true);
    await adminApiService.seedMemberTiers();
    await loadTiers();
  };

  const createTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.tier_name || !tierForm.processing_fee_percent) return;
    setTiersLoading(true);
    await adminApiService.createMemberTier({
      tier_name: tierForm.tier_name,
      processing_fee_percent: parseFloat(tierForm.processing_fee_percent),
      interest_percent_per_day: parseFloat(tierForm.interest_percent_per_day || '0.01')
    });
    setTierForm({ tier_name: '', processing_fee_percent: '', interest_percent_per_day: '0.01' });
    await loadTiers();
  };

  // Load user configuration
  const loadUserConfig = async () => {
    try {
      setUserConfigLoading(true);
      const response = await adminApiService.getUserConfig();
      if (response.success) {
        setUserConfig(response.data);
      }
    } catch (error) {
      console.error('Error loading user config:', error);
    } finally {
      setUserConfigLoading(false);
    }
  };

  // Save user configuration
  const saveUserConfig = async () => {
    if (!userConfig) return;
    
    try {
      setUserConfigSaving(true);
      const configs = {
        default_credit_score: { value: userConfig.default_credit_score.value },
        credit_limit_multiplier: { value: userConfig.credit_limit_multiplier.value },
        min_credit_score: { value: userConfig.min_credit_score.value },
        max_credit_score: { value: userConfig.max_credit_score.value },
        credit_score_update_frequency: { value: userConfig.credit_score_update_frequency.value }
      };
      
      const response = await adminApiService.updateUserConfig(configs);
      if (response.success) {
        alert('User configuration updated successfully!');
        loadUserConfig(); // Reload to get updated timestamps
      }
    } catch (error) {
      console.error('Error saving user config:', error);
      alert('Failed to save user configuration');
    } finally {
      setUserConfigSaving(false);
    }
  };

  // Update user config value
  const updateUserConfigValue = (key: keyof UserConfigData, value: string) => {
    if (!userConfig) return;
    setUserConfig({
      ...userConfig,
      [key]: {
        ...userConfig[key],
        value
      }
    });
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
        alert('Email configuration updated successfully!');
        loadEmailConfigs(); // Reload configurations
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
        alert('Cloud storage configuration updated successfully!');
        loadCloudConfigs(); // Reload configurations
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
      // Mock cloud storage test (replace with actual AWS S3 test)
      console.log(`☁️ Testing Cloud Storage: ${testFileName}`);
      console.log(`Using config ID: ${configId}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestResult({ success: true, message: 'Cloud storage test successful! File uploaded and verified.' });
    } catch (error) {
      console.error('Error testing cloud storage configuration:', error);
      setTestResult({ success: false, message: 'Failed to test cloud storage configuration' });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      loadTiers();
    } else if (activeTab === 'user-config') {
      loadUserConfig();
    } else if (activeTab === 'email') {
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

        {/* Member Tiers Settings */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Member Tiers</h2>
              </div>
              <form onSubmit={createTier} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <input className="border p-2 rounded" placeholder="Tier name (e.g., bronze)" value={tierForm.tier_name} onChange={e => setTierForm({ ...tierForm, tier_name: e.target.value })} />
                <input className="border p-2 rounded" placeholder="Processing fee % (e.g., 10)" value={tierForm.processing_fee_percent} onChange={e => setTierForm({ ...tierForm, processing_fee_percent: e.target.value })} />
                <input className="border p-2 rounded" placeholder="Interest %/day (e.g., 0.01)" value={tierForm.interest_percent_per_day} onChange={e => setTierForm({ ...tierForm, interest_percent_per_day: e.target.value })} />
                <button className="px-3 py-2 bg-green-600 text-white rounded" type="submit" disabled={tiersLoading}>Add Tier</button>
              </form>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Processing Fee %</th>
                      <th className="py-2 pr-4">Interest %/day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(t => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2 pr-4 capitalize">{t.tier_name}</td>
                        <td className="py-2 pr-4">{t.processing_fee_percent}</td>
                        <td className="py-2 pr-4">{t.interest_percent_per_day}</td>
                      </tr>
                    ))}
                    {tiers.length === 0 && !tiersLoading && (
                      <tr>
                        <td className="py-3" colSpan={3}>No tiers found. Click "Seed Defaults".</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* User Configuration Settings */}
        {activeTab === 'user-config' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">User Configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure default credit scores and credit limit calculations</p>
                </div>
                <button
                  onClick={saveUserConfig}
                  disabled={userConfigSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {userConfigSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {userConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading configuration...</span>
                </div>
              ) : userConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Default Credit Score */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Default Credit Score
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="850"
                      value={userConfig.default_credit_score.value}
                      onChange={(e) => updateUserConfigValue('default_credit_score', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="640"
                    />
                    <p className="text-xs text-gray-500">
                      {userConfig.default_credit_score.description}
                    </p>
                  </div>

                  {/* Credit Limit Multiplier */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Credit Limit Multiplier (%)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="500"
                      value={userConfig.credit_limit_multiplier.value}
                      onChange={(e) => updateUserConfigValue('credit_limit_multiplier', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="200"
                    />
                    <p className="text-xs text-gray-500">
                      {userConfig.credit_limit_multiplier.description}
                    </p>
                  </div>

                  {/* Minimum Credit Score */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Credit Score
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="850"
                      value={userConfig.min_credit_score.value}
                      onChange={(e) => updateUserConfigValue('min_credit_score', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="300"
                    />
                    <p className="text-xs text-gray-500">
                      {userConfig.min_credit_score.description}
                    </p>
                  </div>

                  {/* Maximum Credit Score */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Maximum Credit Score
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="850"
                      value={userConfig.max_credit_score.value}
                      onChange={(e) => updateUserConfigValue('max_credit_score', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="850"
                    />
                    <p className="text-xs text-gray-500">
                      {userConfig.max_credit_score.description}
                    </p>
                  </div>

                  {/* Credit Score Update Frequency */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Credit Score Update Frequency
                    </label>
                    <select
                      value={userConfig.credit_score_update_frequency.value}
                      onChange={(e) => updateUserConfigValue('credit_score_update_frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {userConfig.credit_score_update_frequency.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Failed to load user configuration</p>
                  <button
                    onClick={loadUserConfig}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuration Cards */}
        {activeTab !== 'members' && activeTab !== 'user-config' && (
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
        )}

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
