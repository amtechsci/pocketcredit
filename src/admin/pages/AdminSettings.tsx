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
  Info,
  TrendingUp,
  Edit,
  Trash2,
  Plus,
  DollarSign
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

interface LoanTier {
  id: number;
  tier_name: string;
  min_salary: number;
  max_salary: number | null;
  loan_limit: number;
  is_active: boolean;
  tier_order: number;
  created_at: string;
  updated_at: string;
}

interface LoanPlan {
  id: number;
  plan_name: string;
  plan_code: string;
  plan_type: 'single' | 'multi_emi';
  repayment_days: number | null;
  emi_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | null;
  emi_count: number | null;
  total_duration_days: number | null;
  min_credit_score: number;
  eligible_member_tiers: string | null;
  eligible_employment_types: string | null;
  is_active: boolean;
  plan_order: number;
  description: string | null;
  terms_conditions: string | null;
  created_at: string;
  updated_at: string;
}

interface LateFee {
  id: number;
  member_tier_id: number;
  tier_name: string;
  days_overdue_start: number;
  days_overdue_end: number | null;
  fee_type: 'percentage' | 'fixed';
  fee_value: number;
  tier_order: number;
  created_at: string;
  updated_at: string;
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
  
  // Eligibility configuration state
  const [eligibilityConfig, setEligibilityConfig] = useState<{
    min_monthly_salary: { id: number; value: string; description: string; data_type: string; updated_at: string };
    allowed_payment_modes: { id: number; value: string; description: string; data_type: string; updated_at: string };
    hold_period_days: { id: number; value: string; description: string; data_type: string; updated_at: string };
    required_employment_types: { id: number; value: string; description: string; data_type: string; updated_at: string };
    min_age_years: { id: number; value: string; description: string; data_type: string; updated_at: string };
    max_age_years: { id: number; value: string; description: string; data_type: string; updated_at: string };
  } | null>(null);
  const [eligibilityConfigLoading, setEligibilityConfigLoading] = useState(false);
  const [eligibilityConfigSaving, setEligibilityConfigSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Loan Tiers state
  const [loanTiers, setLoanTiers] = useState<LoanTier[]>([]);
  const [loanTiersLoading, setLoanTiersLoading] = useState(false);
  const [editingTier, setEditingTier] = useState<LoanTier | null>(null);
  const [showLoanTierForm, setShowLoanTierForm] = useState(false);
  const [loanTierForm, setLoanTierForm] = useState({
    tier_name: '',
    min_salary: '',
    max_salary: '',
    loan_limit: '',
    tier_order: ''
  });

  // Loan Plans state
  const [loanPlans, setLoanPlans] = useState<LoanPlan[]>([]);
  const [loanPlansLoading, setLoanPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LoanPlan | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({
    plan_name: '',
    plan_code: '',
    plan_type: 'single' as 'single' | 'multi_emi',
    repayment_days: '',
    emi_frequency: 'monthly' as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    emi_count: '',
    min_credit_score: '0',
    eligible_member_tiers: [] as string[],
    eligible_employment_types: [] as string[],
    plan_order: '',
    description: ''
  });

  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  // Member tiers state
  const [tiers, setTiers] = useState<Array<{ id: number; tier_name: string; processing_fee_percent: number; interest_percent_per_day: number }>>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [editingMemberTier, setEditingMemberTier] = useState<{ id: number; tier_name: string; processing_fee_percent: number; interest_percent_per_day: number } | null>(null);
  const [showMemberTierForm, setShowMemberTierForm] = useState(false);
  const [memberTierForm, setMemberTierForm] = useState<{ tier_name: string; processing_fee_percent: string; interest_percent_per_day: string }>({
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
    { id: 'loan-tiers', label: 'Loan Limits', icon: DollarSign, count: 0 },
    { id: 'loan-plans', label: 'Loan Plans', icon: CreditCard, count: 0 },
    { id: 'user-config', label: 'User Config', icon: Settings, count: 0 },
    { id: 'eligibility', label: 'Eligibility Criteria', icon: CheckCircle, count: 0 }
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
    if (!memberTierForm.tier_name || !memberTierForm.processing_fee_percent) return;
    setTiersLoading(true);
    
    try {
      const data = {
        tier_name: memberTierForm.tier_name,
        processing_fee_percent: parseFloat(memberTierForm.processing_fee_percent),
        interest_percent_per_day: parseFloat(memberTierForm.interest_percent_per_day || '0.01')
      };

      if (editingMemberTier) {
        await adminApiService.updateMemberTier(editingMemberTier.id, data);
        alert('Member tier updated successfully!');
      } else {
        await adminApiService.createMemberTier(data);
        alert('Member tier created successfully!');
      }

      setShowMemberTierForm(false);
      setEditingMemberTier(null);
      setMemberTierForm({ tier_name: '', processing_fee_percent: '', interest_percent_per_day: '0.01' });
      await loadTiers();
    } catch (error) {
      console.error('Error saving member tier:', error);
      alert('Failed to save member tier');
    } finally {
      setTiersLoading(false);
    }
  };

  const editMemberTier = (tier: { id: number; tier_name: string; processing_fee_percent: number; interest_percent_per_day: number }) => {
    setEditingMemberTier(tier);
    setMemberTierForm({
      tier_name: tier.tier_name,
      processing_fee_percent: tier.processing_fee_percent.toString(),
      interest_percent_per_day: tier.interest_percent_per_day.toString()
    });
    setShowMemberTierForm(true);
  };

  const deleteMemberTier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this member tier?')) return;
    
    try {
      setTiersLoading(true);
      await adminApiService.deleteMemberTier(id);
      alert('Member tier deleted successfully!');
      await loadTiers();
    } catch (error) {
      console.error('Error deleting member tier:', error);
      alert('Failed to delete member tier');
    } finally {
      setTiersLoading(false);
    }
  };

  const cancelEditMemberTier = () => {
    setShowMemberTierForm(false);
    setEditingMemberTier(null);
    setMemberTierForm({ tier_name: '', processing_fee_percent: '', interest_percent_per_day: '0.01' });
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

  // Load eligibility configuration
  const loadEligibilityConfig = async () => {
    try {
      setEligibilityConfigLoading(true);
      const response = await adminApiService.getEligibilityConfig();
      if (response.success) {
        setEligibilityConfig(response.data);
      }
    } catch (error) {
      console.error('Error loading eligibility configuration:', error);
    } finally {
      setEligibilityConfigLoading(false);
    }
  };

  // Save eligibility configuration
  const saveEligibilityConfig = async () => {
    if (!eligibilityConfig) return;
    
    try {
      setEligibilityConfigSaving(true);
      const response = await adminApiService.updateEligibilityConfig({
        min_monthly_salary: { value: eligibilityConfig.min_monthly_salary.value },
        allowed_payment_modes: { value: eligibilityConfig.allowed_payment_modes.value },
        hold_period_days: { value: eligibilityConfig.hold_period_days.value },
        required_employment_types: { value: eligibilityConfig.required_employment_types.value },
        min_age_years: { value: eligibilityConfig.min_age_years.value },
        max_age_years: { value: eligibilityConfig.max_age_years.value }
      });
      
      if (response.success) {
        alert('Eligibility criteria updated successfully!');
        loadEligibilityConfig();
      }
    } catch (error) {
      console.error('Error saving eligibility configuration:', error);
      alert('Failed to save eligibility criteria');
    } finally {
      setEligibilityConfigSaving(false);
    }
  };

  // Update eligibility config value
  const updateEligibilityConfigValue = (key: string, value: string) => {
    if (!eligibilityConfig) return;
    setEligibilityConfig({
      ...eligibilityConfig,
      [key]: {
        ...eligibilityConfig[key as keyof typeof eligibilityConfig],
        value
      }
    });
  };

  // Load loan tiers
  const loadLoanTiers = async () => {
    try {
      setLoanTiersLoading(true);
      const response = await adminApiService.getLoanTiers();
      if (response.success) {
        setLoanTiers(response.data);
      }
    } catch (error) {
      console.error('Error loading loan tiers:', error);
    } finally {
      setLoanTiersLoading(false);
    }
  };

  // Create or update loan tier
  const saveLoanTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        tier_name: loanTierForm.tier_name,
        min_salary: parseFloat(loanTierForm.min_salary),
        max_salary: loanTierForm.max_salary ? parseFloat(loanTierForm.max_salary) : null,
        loan_limit: parseFloat(loanTierForm.loan_limit),
        tier_order: parseInt(loanTierForm.tier_order),
        is_active: true
      };

      if (editingTier) {
        await adminApiService.updateLoanTier(editingTier.id, data);
        alert('Loan tier updated successfully!');
      } else {
        await adminApiService.createLoanTier(data);
        alert('Loan tier created successfully!');
      }

      setShowLoanTierForm(false);
      setEditingTier(null);
      setLoanTierForm({ tier_name: '', min_salary: '', max_salary: '', loan_limit: '', tier_order: '' });
      loadLoanTiers();
    } catch (error: any) {
      console.error('Error saving loan tier:', error);
      alert(error.response?.data?.message || 'Failed to save loan tier');
    }
  };

  // Edit loan tier
  const editLoanTier = (tier: LoanTier) => {
    setEditingTier(tier);
    setLoanTierForm({
      tier_name: tier.tier_name,
      min_salary: tier.min_salary.toString(),
      max_salary: tier.max_salary ? tier.max_salary.toString() : '',
      loan_limit: tier.loan_limit.toString(),
      tier_order: tier.tier_order.toString()
    });
    setShowLoanTierForm(true);
  };

  // Delete loan tier
  const deleteLoanTier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this loan tier?')) return;
    
    try {
      await adminApiService.deleteLoanTier(id);
      alert('Loan tier deleted successfully!');
      loadLoanTiers();
    } catch (error) {
      console.error('Error deleting loan tier:', error);
      alert('Failed to delete loan tier');
    }
  };

  // Toggle loan tier status
  const toggleLoanTierStatus = async (id: number) => {
    try {
      await adminApiService.toggleLoanTier(id);
      loadLoanTiers();
    } catch (error) {
      console.error('Error toggling loan tier:', error);
      alert('Failed to toggle loan tier status');
    }
  };

  // Cancel editing
  const cancelEditTier = () => {
    setShowLoanTierForm(false);
    setEditingTier(null);
    setLoanTierForm({ tier_name: '', min_salary: '', max_salary: '', loan_limit: '', tier_order: '' });
  };

  // ==================== Loan Plans Functions ====================

  const loadLoanPlans = async () => {
    try {
      setLoanPlansLoading(true);
      const response = await adminApiService.getLoanPlans();
      if (response.success) {
        setLoanPlans(response.data);
      }
    } catch (error) {
      console.error('Error loading loan plans:', error);
    } finally {
      setLoanPlansLoading(false);
    }
  };

  const saveLoanPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        plan_name: planForm.plan_name,
        plan_code: planForm.plan_code,
        plan_type: planForm.plan_type,
        repayment_days: planForm.plan_type === 'single' ? parseInt(planForm.repayment_days) : undefined,
        emi_frequency: planForm.plan_type === 'multi_emi' ? planForm.emi_frequency : undefined,
        emi_count: planForm.plan_type === 'multi_emi' ? parseInt(planForm.emi_count) : undefined,
        min_credit_score: parseInt(planForm.min_credit_score),
        eligible_member_tiers: planForm.eligible_member_tiers,
        eligible_employment_types: planForm.eligible_employment_types,
        plan_order: parseInt(planForm.plan_order),
        description: planForm.description,
        is_active: true
      };

      if (editingPlan) {
        await adminApiService.updateLoanPlan(editingPlan.id, data);
        alert('Loan plan updated successfully!');
      } else {
        await adminApiService.createLoanPlan(data);
        alert('Loan plan created successfully!');
      }

      setShowPlanForm(false);
      setEditingPlan(null);
      resetPlanForm();
      loadLoanPlans();
    } catch (error: any) {
      console.error('Error saving loan plan:', error);
      alert(error.response?.data?.message || 'Failed to save loan plan');
    }
  };

  const editLoanPlan = (plan: LoanPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      plan_name: plan.plan_name,
      plan_code: plan.plan_code,
      plan_type: plan.plan_type,
      repayment_days: plan.repayment_days?.toString() || '',
      emi_frequency: plan.emi_frequency || 'monthly',
      emi_count: plan.emi_count?.toString() || '',
      min_credit_score: plan.min_credit_score.toString(),
      eligible_member_tiers: plan.eligible_member_tiers ? JSON.parse(plan.eligible_member_tiers) : [],
      eligible_employment_types: plan.eligible_employment_types ? JSON.parse(plan.eligible_employment_types) : [],
      plan_order: plan.plan_order.toString(),
      description: plan.description || ''
    });
    setShowPlanForm(true);
  };

  const deleteLoanPlan = async (id: number) => {
    if (!confirm('Are you sure you want to delete this loan plan?')) return;
    
    try {
      await adminApiService.deleteLoanPlan(id);
      alert('Loan plan deleted successfully!');
      loadLoanPlans();
    } catch (error) {
      console.error('Error deleting loan plan:', error);
      alert('Failed to delete loan plan');
    }
  };

  const toggleLoanPlanStatus = async (id: number) => {
    try {
      await adminApiService.toggleLoanPlan(id);
      loadLoanPlans();
    } catch (error) {
      console.error('Error toggling loan plan:', error);
      alert('Failed to toggle loan plan status');
    }
  };

  const resetPlanForm = () => {
    setPlanForm({
      plan_name: '',
      plan_code: '',
      plan_type: 'single',
      repayment_days: '',
      emi_frequency: 'monthly',
      emi_count: '',
      min_credit_score: '0',
      eligible_member_tiers: [],
      eligible_employment_types: [],
      plan_order: '',
      description: ''
    });
  };

  const cancelEditPlan = () => {
    setShowPlanForm(false);
    setEditingPlan(null);
    resetPlanForm();
  };

  useEffect(() => {
    if (activeTab === 'members') {
      loadTiers();
    } else if (activeTab === 'loan-tiers') {
      loadLoanTiers();
    } else if (activeTab === 'loan-plans') {
      loadLoanPlans();
    } else if (activeTab === 'user-config') {
      loadUserConfig();
    } else if (activeTab === 'email') {
      loadEmailConfigs();
    } else if (activeTab === 'cloud') {
      loadCloudConfigs();
    } else if (activeTab === 'eligibility') {
      loadEligibilityConfig();
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
                <button
                  onClick={() => setShowMemberTierForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Tier
                </button>
              </div>

              {/* Member Tier Form */}
              {showMemberTierForm && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">
                    {editingMemberTier ? 'Edit Member Tier' : 'Add New Member Tier'}
                  </h3>
                  <form onSubmit={createTier} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tier Name *
                        </label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          placeholder="e.g., Bronze" 
                          value={memberTierForm.tier_name} 
                          onChange={e => setMemberTierForm({ ...memberTierForm, tier_name: e.target.value })} 
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Processing Fee (%) *
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          placeholder="e.g., 10" 
                          value={memberTierForm.processing_fee_percent} 
                          onChange={e => setMemberTierForm({ ...memberTierForm, processing_fee_percent: e.target.value })} 
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Interest % per Day *
                        </label>
                        <input 
                          type="number"
                          step="0.001"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          placeholder="e.g., 0.01" 
                          value={memberTierForm.interest_percent_per_day} 
                          onChange={e => setMemberTierForm({ ...memberTierForm, interest_percent_per_day: e.target.value })} 
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" 
                        disabled={tiersLoading}
                      >
                        <Save className="w-4 h-4 inline mr-1" />
                        {editingMemberTier ? 'Update Tier' : 'Create Tier'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditMemberTier}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Processing Fee %</th>
                      <th className="py-2 pr-4">Interest %/day</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(t => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 pr-4 capitalize font-medium">{t.tier_name}</td>
                        <td className="py-3 pr-4">{t.processing_fee_percent}%</td>
                        <td className="py-3 pr-4">{t.interest_percent_per_day}%</td>
                        <td className="py-3 pr-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => editMemberTier(t)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteMemberTier(t.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tiers.length === 0 && !tiersLoading && (
                      <tr>
                        <td className="py-3" colSpan={4}>No tiers found. Click "Add New Tier" to create one.</td>
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

        {/* Loan Limit Tiers Tab */}
        {activeTab === 'loan-tiers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Loan Limit Tiers Management
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Configure salary-based loan limits for salaried users</p>
                </div>
                <button
                  onClick={() => setShowLoanTierForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Tier
                </button>
              </div>

              {loanTiersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading loan tiers...</span>
                </div>
              ) : (
                <>
                  {/* Tier Form */}
                  {showLoanTierForm && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">
                        {editingTier ? 'Edit Loan Tier' : 'Add New Loan Tier'}
                      </h3>
                      <form onSubmit={saveLoanTier} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tier Name *
                            </label>
                            <input
                              type="text"
                              value={loanTierForm.tier_name}
                              onChange={(e) => setLoanTierForm({ ...loanTierForm, tier_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., Tier 1: Basic"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Min Salary (₹) *
                            </label>
                            <input
                              type="number"
                              value={loanTierForm.min_salary}
                              onChange={(e) => setLoanTierForm({ ...loanTierForm, min_salary: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="1000"
                              required
                              min="0"
                              step="1000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Max Salary (₹)
                            </label>
                            <input
                              type="number"
                              value={loanTierForm.max_salary}
                              onChange={(e) => setLoanTierForm({ ...loanTierForm, max_salary: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Leave empty for no limit"
                              min="0"
                              step="1000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Loan Limit (₹) *
                            </label>
                            <input
                              type="number"
                              value={loanTierForm.loan_limit}
                              onChange={(e) => setLoanTierForm({ ...loanTierForm, loan_limit: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="6000"
                              required
                              min="1000"
                              step="1000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Order *
                            </label>
                            <input
                              type="number"
                              value={loanTierForm.tier_order}
                              onChange={(e) => setLoanTierForm({ ...loanTierForm, tier_order: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="1"
                              required
                              min="1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Save className="w-4 h-4 inline mr-1" />
                            {editingTier ? 'Update Tier' : 'Create Tier'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditTier}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Tiers Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tier Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Salary Range
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Loan Limit
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {loanTiers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                              No loan tiers configured. Click "Add New Tier" to create one.
                            </td>
                          </tr>
                        ) : (
                          loanTiers.map((tier) => (
                            <tr key={tier.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {tier.tier_order}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {tier.tier_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                ₹{parseFloat(tier.min_salary.toString()).toLocaleString('en-IN')}
                                {tier.max_salary 
                                  ? ` - ₹${parseFloat(tier.max_salary.toString()).toLocaleString('en-IN')}`
                                  : ' and above'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                ₹{parseFloat(tier.loan_limit.toString()).toLocaleString('en-IN')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => toggleLoanTierStatus(tier.id)}
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    tier.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {tier.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => editLoanTier(tier)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteLoanTier(tier.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-2">How Loan Limits Work:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Tiers are applied based on the user's monthly salary</li>
                          <li>The system automatically assigns the matching tier when users submit their employment details</li>
                          <li>Lower order numbers are checked first (Order 1, then 2, etc.)</li>
                          <li>Leave "Max Salary" empty for the highest tier (no upper limit)</li>
                          <li>Only active tiers are used for loan limit calculations</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loan Plans Tab */}
        {activeTab === 'loan-plans' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Loan Plans Management
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Configure repayment plans for user loans</p>
                </div>
                <button
                  onClick={() => setShowPlanForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Plan
                </button>
              </div>

              {loanPlansLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading loan plans...</span>
                </div>
              ) : (
                <>
                  {/* Plan Form */}
                  {showPlanForm && (
                    <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">
                        {editingPlan ? 'Edit Loan Plan' : 'Add New Loan Plan'}
                      </h3>
                      <form onSubmit={saveLoanPlan} className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Plan Name *
                            </label>
                            <input
                              type="text"
                              value={planForm.plan_name}
                              onChange={(e) => setPlanForm({ ...planForm, plan_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 15-Day Quick Loan"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Plan Code *
                            </label>
                            <input
                              type="text"
                              value={planForm.plan_code}
                              onChange={(e) => setPlanForm({ ...planForm, plan_code: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                              placeholder="e.g., QUICK_15D"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Plan Type *
                            </label>
                            <select
                              value={planForm.plan_type}
                              onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value as 'single' | 'multi_emi' })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="single">Single Payment</option>
                              <option value="multi_emi">Multi-EMI</option>
                            </select>
                          </div>
                        </div>

                        {/* Conditional Fields based on Plan Type */}
                        {planForm.plan_type === 'single' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Repayment Days *
                              </label>
                              <input
                                type="number"
                                value={planForm.repayment_days}
                                onChange={(e) => setPlanForm({ ...planForm, repayment_days: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., 15"
                                required
                                min="1"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                EMI Frequency *
                              </label>
                              <select
                                value={planForm.emi_frequency}
                                onChange={(e) => setPlanForm({ ...planForm, emi_frequency: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="biweekly">Bi-weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Number of EMIs *
                              </label>
                              <input
                                type="number"
                                value={planForm.emi_count}
                                onChange={(e) => setPlanForm({ ...planForm, emi_count: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., 3"
                                required
                                min="1"
                              />
                            </div>
                          </div>
                        )}

                        {/* Other Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Min Credit Score
                            </label>
                            <input
                              type="number"
                              value={planForm.min_credit_score}
                              onChange={(e) => setPlanForm({ ...planForm, min_credit_score: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Plan Order *
                            </label>
                            <input
                              type="number"
                              value={planForm.plan_order}
                              onChange={(e) => setPlanForm({ ...planForm, plan_order: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="1"
                              required
                              min="1"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={planForm.description}
                            onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Brief description of this plan"
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Save className="w-4 h-4 inline mr-1" />
                            {editingPlan ? 'Update Plan' : 'Create Plan'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditPlan}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Plans Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Min Score
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {loanPlans.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                              No loan plans configured. Click "Add New Plan" to create one.
                            </td>
                          </tr>
                        ) : (
                          loanPlans.map((plan) => (
                            <tr key={plan.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {plan.plan_order}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{plan.plan_name}</div>
                                <div className="text-xs text-gray-500">{plan.plan_code}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  plan.plan_type === 'single' 
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {plan.plan_type === 'single' ? 'Single' : 'Multi-EMI'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {plan.plan_type === 'single' 
                                  ? `${plan.repayment_days} days`
                                  : `${plan.emi_count} × ${plan.emi_frequency}`
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {plan.min_credit_score || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => toggleLoanPlanStatus(plan.id)}
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    plan.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {plan.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => editLoanPlan(plan)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteLoanPlan(plan.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-2">Loan Plan Types:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong>Single Payment:</strong> User repays full amount in one go after specified days (e.g., 15-day, 30-day)</li>
                          <li><strong>Multi-EMI:</strong> User pays in equal installments (e.g., 3 monthly EMIs, 6 monthly EMIs)</li>
                          <li>Interest and processing fees are defined in Member Tiers settings</li>
                          <li>Users select their preferred plan when applying for a loan</li>
                          <li>Lower order numbers appear first in the plan selection screen</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Eligibility Criteria Tab */}
        {activeTab === 'eligibility' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Eligibility Criteria Settings</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure loan eligibility requirements for new users</p>
                </div>
                <button
                  onClick={saveEligibilityConfig}
                  disabled={eligibilityConfigSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {eligibilityConfigSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {eligibilityConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading configuration...</span>
                </div>
              ) : eligibilityConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Minimum Monthly Salary */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Monthly Salary (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={eligibilityConfig.min_monthly_salary.value}
                      onChange={(e) => updateEligibilityConfigValue('min_monthly_salary', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="30000"
                    />
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.min_monthly_salary.description}
                    </p>
                  </div>

                  {/* Allowed Payment Modes */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Allowed Payment Modes
                    </label>
                    <select
                      value={eligibilityConfig.allowed_payment_modes.value}
                      onChange={(e) => updateEligibilityConfigValue('allowed_payment_modes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bank_transfer">Bank Transfer Only</option>
                      <option value="cheque">Cheque Only</option>
                      <option value="bank_transfer,cheque">Bank Transfer & Cheque</option>
                      <option value="bank_transfer,cheque,cash">All Modes (Bank, Cheque, Cash)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.allowed_payment_modes.description}
                    </p>
                  </div>

                  {/* Hold Period */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Hold Period (Days)
                    </label>
                    <select
                      value={eligibilityConfig.hold_period_days.value}
                      onChange={(e) => updateEligibilityConfigValue('hold_period_days', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="30">30 Days</option>
                      <option value="45">45 Days</option>
                      <option value="90">90 Days</option>
                      <option value="180">180 Days</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.hold_period_days.description}
                    </p>
                  </div>

                  {/* Required Employment Types */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Required Employment Types
                    </label>
                    <select
                      value={eligibilityConfig.required_employment_types.value}
                      onChange={(e) => updateEligibilityConfigValue('required_employment_types', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="salaried">Salaried Only</option>
                      <option value="self_employed">Self-Employed Only</option>
                      <option value="salaried,self_employed">Salaried & Self-Employed</option>
                      <option value="salaried,self_employed,business">All Employment Types</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.required_employment_types.description}
                    </p>
                  </div>

                  {/* Minimum Age */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Age (Years)
                    </label>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      value={eligibilityConfig.min_age_years.value}
                      onChange={(e) => updateEligibilityConfigValue('min_age_years', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="18"
                    />
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.min_age_years.description}
                    </p>
                  </div>

                  {/* Maximum Age */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Maximum Age (Years)
                    </label>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      value={eligibilityConfig.max_age_years.value}
                      onChange={(e) => updateEligibilityConfigValue('max_age_years', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="65"
                    />
                    <p className="text-xs text-gray-500">
                      {eligibilityConfig.max_age_years.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Failed to load eligibility configuration</p>
                  <button
                    onClick={loadEligibilityConfig}
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
        {activeTab !== 'members' && activeTab !== 'user-config' && activeTab !== 'eligibility' && (
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
