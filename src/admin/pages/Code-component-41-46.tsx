import { useState } from 'react';
import { 
  Download, 
  FileText, 
  Users, 
  Building, 
  IndianRupee, 
  Star, 
  AlertTriangle, 
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Database,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import type { AdminPage, AdminUser } from '../../AdminApp';

interface AdminReportsProps {
  onNavigate: (page: AdminPage) => void;
  currentUser: AdminUser;
}

export function AdminReports({ onNavigate, currentUser }: AdminReportsProps) {
  const [selectedDateRange, setSelectedDateRange] = useState('last-30-days');
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { canEditUsers } = useAdmin();

  const handleReportDownload = async (reportType: string, format: string = selectedFormat) => {
    setIsGenerating(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const reportData = generateReportData(reportType);
    const fileName = `${reportType}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
    
    if (format === 'excel' || format === 'csv') {
      downloadAsCSV(reportData, fileName);
    } else if (format === 'pdf') {
      downloadAsPDF(reportData, fileName);
    }
    
    setIsGenerating(false);
  };

  const generateReportData = (reportType: string) => {
    const baseData = {
      'cibil-loan-data': [
        { 'Customer ID': 'CL250912', 'Name': 'Rajesh Kumar Singh', 'Loan Amount': '₹5,00,000', 'EMI': '₹17,094', 'CIBIL Score': '720', 'Status': 'Active', 'Tenure': '36 months', 'Interest Rate': '14%' },
        { 'Customer ID': 'CL240815', 'Name': 'Priya Sharma', 'Loan Amount': '₹2,00,000', 'EMI': '₹9,578', 'CIBIL Score': '750', 'Status': 'Active', 'Tenure': '24 months', 'Interest Rate': '16%' },
        { 'Customer ID': 'CL230521', 'Name': 'Amit Kumar', 'Loan Amount': '₹1,50,000', 'EMI': '₹9,167', 'CIBIL Score': '680', 'Status': 'Completed', 'Tenure': '18 months', 'Interest Rate': '15%' },
        { 'Customer ID': 'CL231015', 'Name': 'Sunita Patel', 'Loan Amount': '₹3,00,000', 'EMI': '₹8,394', 'CIBIL Score': '700', 'Status': 'Cancelled', 'Tenure': '48 months', 'Interest Rate': '18%' },
        { 'Customer ID': 'CL220812', 'Name': 'Vikram Singh', 'Loan Amount': '₹2,50,000', 'EMI': '₹9,532', 'CIBIL Score': '650', 'Status': 'Default', 'Tenure': '30 months', 'Interest Rate': '17%' },
      ],
      'user-data': [
        { 'Customer ID': 'CL250912', 'Name': 'Rajesh Kumar Singh', 'Email': 'rajesh.kumar@email.com', 'Phone': '+91 98765 43210', 'City': 'Bangalore', 'State': 'Karnataka', 'KYC Status': 'Completed', 'Registration Date': '2025-01-09' },
        { 'Customer ID': 'CL240815', 'Name': 'Priya Sharma', 'Email': 'priya.sharma@email.com', 'Phone': '+91 87654 32109', 'City': 'Mumbai', 'State': 'Maharashtra', 'KYC Status': 'Completed', 'Registration Date': '2024-08-15' },
        { 'Customer ID': 'CL230521', 'Name': 'Amit Kumar', 'Email': 'amit.kumar@email.com', 'Phone': '+91 76543 21098', 'City': 'Delhi', 'State': 'Delhi', 'KYC Status': 'Completed', 'Registration Date': '2023-05-21' },
        { 'Customer ID': 'CL231015', 'Name': 'Sunita Patel', 'Email': 'sunita.patel@email.com', 'Phone': '+91 65432 10987', 'City': 'Pune', 'State': 'Maharashtra', 'KYC Status': 'Pending', 'Registration Date': '2023-10-15' },
        { 'Customer ID': 'CL220812', 'Name': 'Vikram Singh', 'Email': 'vikram.singh@email.com', 'Phone': '+91 54321 09876', 'City': 'Chennai', 'State': 'Tamil Nadu', 'KYC Status': 'Completed', 'Registration Date': '2022-08-12' },
      ],
      'transaction-data': [
        { 'Transaction ID': 'TXN001', 'Customer ID': 'CL250912', 'Date': '2025-01-09', 'Type': 'Debit', 'Amount': '-₹999', 'Description': 'Application Processing Fee', 'Status': 'Completed' },
        { 'Transaction ID': 'TXN002', 'Customer ID': 'CL240815', 'Date': '2024-12-05', 'Type': 'Debit', 'Amount': '-₹9,578', 'Description': 'EMI Payment #16', 'Status': 'Completed' },
        { 'Transaction ID': 'TXN003', 'Customer ID': 'CL240815', 'Date': '2024-08-20', 'Type': 'Credit', 'Amount': '+₹2,00,000', 'Description': 'Loan Disbursement', 'Status': 'Completed' },
        { 'Transaction ID': 'TXN004', 'Customer ID': 'CL230521', 'Date': '2024-11-05', 'Type': 'Debit', 'Amount': '-₹9,167', 'Description': 'Final EMI Payment', 'Status': 'Completed' },
        { 'Transaction ID': 'TXN005', 'Customer ID': 'CL220812', 'Date': '2023-08-05', 'Type': 'Debit', 'Amount': '-₹9,532', 'Description': 'EMI Payment (Failed)', 'Status': 'Failed' },
      ],
      'risk-analysis': [
        { 'Customer ID': 'CL250912', 'Name': 'Rajesh Kumar Singh', 'Risk Score': '15', 'Risk Category': 'Low', 'Income Stability': 'High', 'Employment Type': 'Salaried', 'Debt-to-Income': '25%', 'Previous Defaults': '0' },
        { 'Customer ID': 'CL240815', 'Name': 'Priya Sharma', 'Risk Score': '12', 'Risk Category': 'Low', 'Income Stability': 'High', 'Employment Type': 'Salaried', 'Debt-to-Income': '20%', 'Previous Defaults': '0' },
        { 'Customer ID': 'CL230521', 'Name': 'Amit Kumar', 'Risk Score': '22', 'Risk Category': 'Medium', 'Income Stability': 'Medium', 'Employment Type': 'Self-Employed', 'Debt-to-Income': '35%', 'Previous Defaults': '0' },
        { 'Customer ID': 'CL231015', 'Name': 'Sunita Patel', 'Risk Score': '18', 'Risk Category': 'Low', 'Income Stability': 'High', 'Employment Type': 'Salaried', 'Debt-to-Income': '30%', 'Previous Defaults': '0' },
        { 'Customer ID': 'CL220812', 'Name': 'Vikram Singh', 'Risk Score': '45', 'Risk Category': 'High', 'Income Stability': 'Low', 'Employment Type': 'Self-Employed', 'Debt-to-Income': '65%', 'Previous Defaults': '1' },
      ]
    };

    return baseData[reportType as keyof typeof baseData] || [];
  };

  const downloadAsCSV = (data: any[], fileName: string) => {
    const csvContent = convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPDF = (data: any[], fileName: string) => {
    alert(`PDF generation would be implemented here for ${fileName}`);
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ];
    
    return csvRows.join('\n');
  };

  const handleCustomReportGenerate = async () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one data category');
      return;
    }

    setIsGenerating(true);
    
    // Simulate custom report generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const customData = selectedCategories.map(category => ({
      'Category': category,
      'Date Range': selectedDateRange,
      'Generated By': currentUser.name,
      'Generated On': new Date().toISOString(),
      'Format': selectedFormat
    }));

    const fileName = `Custom_Report_${new Date().toISOString().split('T')[0]}.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat}`;
    downloadAsCSV(customData, fileName);
    
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Generate and download comprehensive reports for CIBIL, user data, and business analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">2,543</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                <Building className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">1,234</div>
            <div className="text-sm text-gray-600">Active Loans</div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-purple-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-600 mb-1">₹45.2Cr</div>
            <div className="text-sm text-gray-600">Total Disbursed</div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-orange-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-600 mb-1">98.5%</div>
            <div className="text-sm text-gray-600">Collection Rate</div>
          </div>
        </div>

        {/* Main Report Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CIBIL & Credit Reports */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CIBIL & Credit Reports</h3>
                <p className="text-sm text-gray-600">Credit bureau data and risk analysis reports</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleReportDownload('cibil-loan-data')}
                disabled={isGenerating}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">CIBIL Loan Data Export</div>
                    <div className="text-sm text-gray-500">Complete loan portfolio with CIBIL scores</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Excel</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">CSV</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => handleReportDownload('risk-analysis')}
                disabled={isGenerating}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Risk Analysis Report</div>
                    <div className="text-sm text-gray-500">Detailed risk scoring and categorization</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Excel</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">PDF</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => alert('CIBIL Bureau Integration Report - Available in Premium Version')}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">CIBIL Bureau Integration</div>
                    <div className="text-sm text-gray-500">Direct bureau data export for compliance</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Premium</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            </div>
          </div>

          {/* User Data Reports */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Data Reports</h3>
                <p className="text-sm text-gray-600">Customer information and demographics</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleReportDownload('user-data')}
                disabled={isGenerating}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Complete User Database</div>
                    <div className="text-sm text-gray-500">All registered users with contact details</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Excel</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">CSV</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => alert('KYC Status Report - Available Soon')}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">KYC Status Report</div>
                    <div className="text-sm text-gray-500">Document verification and compliance status</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Coming Soon</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => alert('Demographics Analysis - Available Soon')}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PieChart className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Demographics Analysis</div>
                    <div className="text-sm text-gray-500">Age, location, and income distribution</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Coming Soon</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Financial Reports */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Financial & Transaction Reports</h3>
              <p className="text-sm text-gray-600">Loan performance, transactions, and financial analytics</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => handleReportDownload('transaction-data')}
              disabled={isGenerating}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Transaction History</div>
                  <div className="text-sm text-gray-500">All platform transactions</div>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Excel</span>
            </button>

            <button
              onClick={() => alert('Loan Performance Report - Available Soon')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Loan Performance</div>
                  <div className="text-sm text-gray-500">EMI collection rates</div>
                </div>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Soon</span>
            </button>

            <button
              onClick={() => alert('Revenue Analytics - Available Soon')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LineChart className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Revenue Analytics</div>
                  <div className="text-sm text-gray-500">Income and profit analysis</div>
                </div>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Soon</span>
            </button>
          </div>
        </div>

        {/* Custom Report Builder */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Filter className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Custom Report Builder</h3>
              <p className="text-sm text-gray-600">Create personalized reports with specific data categories and date ranges</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Data Categories */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Select Data Categories</h4>
              <div className="space-y-2">
                {[
                  'User Demographics',
                  'Loan Applications',
                  'Credit Scores',
                  'Transaction Records', 
                  'KYC Documents',
                  'Risk Assessments',
                  'Collection Data',
                  'Revenue Metrics'
                ].map((category) => (
                  <label key={category} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedCategories.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, category]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== category));
                        }
                      }}
                    />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range & Format */}
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-gray-900 mb-2">Date Range</label>
                <select 
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="last-7-days">Last 7 Days</option>
                  <option value="last-30-days">Last 30 Days</option>
                  <option value="last-90-days">Last 90 Days</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="last-year">Last Year</option>
                  <option value="all-time">All Time</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-900 mb-2">Export Format</label>
                <select 
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="json">JSON (.json)</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex flex-col justify-end">
              <button
                onClick={handleCustomReportGenerate}
                disabled={isGenerating || selectedCategories.length === 0}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Custom Report
                  </>
                )}
              </button>
              
              <div className="mt-3 text-xs text-gray-500">
                {selectedCategories.length} categories selected • {selectedDateRange} • {selectedFormat.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Report</h3>
              <p className="text-sm text-gray-600">Please wait while we compile your data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}