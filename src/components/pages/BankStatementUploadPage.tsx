import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, Cloud, FileText, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const BankStatementUploadPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const applicationId = location.state?.applicationId;

  const [uploadMethod, setUploadMethod] = useState<'online' | 'manual'>('online');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const banks = [
    'ICICI Bank',
    'HDFC Bank',
    'State Bank of India',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'IndusInd Bank Ltd.',
    'IDFC FIRST BANK',
    'Canara Bank',
    'Union Bank Of India',
    'Punjab National Bank',
    'Bank of Baroda',
    'Yes Bank'
  ];

  const handleOnlineUpload = async () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!selectedBank) {
      toast.error('Please select your bank');
      return;
    }

    // Navigate to complete AA flow
    navigate('/loan-application/aa-flow', {
      state: {
        applicationId,
        mobileNumber,
        selectedBank
      }
    });

    /* PRODUCTION CODE - Uncomment when backend is ready
    try {
      const response = await apiService.initiateAccountAggregator({
        mobile_number: mobileNumber,
        bank_name: selectedBank,
        application_id: applicationId
      });

      if (response.success) {
        window.location.href = response.data.aaUrl;
      } else {
        toast.error(response.message || 'Failed to initiate bank statement upload');
      }
    } catch (error) {
      console.error('AA initiation error:', error);
      toast.error('Failed to connect to Account Aggregator');
    } finally {
      setIsLoading(false);
    }
    */
  };

  const handleManualUpload = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file');
      return;
    }

    if (pdfFile.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    setIsLoading(true);
    
    // DEMO MODE - Frontend only, no backend calls
    setTimeout(() => {
      toast.success(`Bank statement "${pdfFile.name}" uploaded successfully!`);
      toast.info('File size: ' + (pdfFile.size / 1024).toFixed(2) + ' KB');
      setIsLoading(false);
      
      console.log('Demo Manual Upload:', {
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        fileType: pdfFile.type,
        message: 'In production, this would be uploaded to S3 and saved to database'
      });
      
      // Optional: Navigate to next step after 2 seconds
      // setTimeout(() => {
      //   navigate('/loan-application/employment-details', { state: { applicationId } });
      // }, 2000);
    }, 1500);

    /* PRODUCTION CODE - Uncomment when backend is ready
    try {
      const formData = new FormData();
      formData.append('statement', pdfFile);
      formData.append('application_id', applicationId.toString());

      const response = await apiService.uploadBankStatementPDF(formData);

      if (response.success) {
        toast.success('Bank statement uploaded successfully');
        navigate('/loan-application/employment-details', { state: { applicationId } });
      } else {
        toast.error(response.message || 'Failed to upload bank statement');
      }
    } catch (error) {
      console.error('Manual upload error:', error);
      toast.error('Failed to upload bank statement');
    } finally {
      setIsLoading(false);
    }
    */
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">BANK_ACCOUNT_STATEMENT</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Method Tabs */}
        <div className="relative">
          <div className="flex gap-3">
            <button
              onClick={() => setUploadMethod('online')}
              className={`flex-1 relative py-3 px-4 rounded-lg font-medium transition-all ${
                uploadMethod === 'online'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Online Upload
              {uploadMethod === 'online' && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5">
                  For Faster Processing
                </Badge>
              )}
            </button>
            <button
              onClick={() => setUploadMethod('manual')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                uploadMethod === 'manual'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual Upload
            </button>
          </div>
        </div>

        {/* Online Upload Section */}
        {uploadMethod === 'online' && (
          <>
            {/* Mobile Number Input */}
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Enter Mobile no. linked with your bank</h3>
              </div>
              <div className="relative">
                <Input
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="pl-10 h-12 text-base"
                  maxLength={10}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📱</span>
              </div>
            </Card>

            {/* Bank Selection */}
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Select your Bank Name</h3>
                <p className="text-sm text-gray-600">Choose Your bank where salary is created</p>
              </div>
              <div>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Salaried Bank account name</option>
                  {banks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Upload Button */}
            <Button
              onClick={handleOnlineUpload}
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <Cloud className="mr-2 h-5 w-5" />
              {isLoading ? 'Connecting...' : 'Upload'}
            </Button>

            {/* How AA Works */}
            <Card className="p-6 space-y-3">
              <h3 className="font-semibold text-base">How Account Aggregator Works</h3>
              <p className="text-sm text-gray-600">
                If you are facing any kind of problem in using the Account Aggregator then this are the following
                links for you to use.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-semibold">IN ENGLISH</p>
                <a
                  href="https://youtu.be/7eSxyKe0WZ4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline block"
                >
                  https://youtu.be/7eSxyKe0WZ4
                </a>
              </div>
            </Card>
          </>
        )}

        {/* Manual Upload Section */}
        {uploadMethod === 'manual' && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex items-start gap-2">
                <h3 className="text-lg font-semibold flex-1">Upload Bank Statement PDF</h3>
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">
                Upload last 6 months Bank Statement. Download the statement from your bank account and upload the PDF
                file.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ Do Not create PDF files from photos of your Bank Statement
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-upload" className="text-sm font-medium">
                  Select PDF File
                </Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Choose File
                  </label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="text-sm text-gray-600">
                    {pdfFile ? pdfFile.name : 'no file selected'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Upload Button */}
            <Button
              onClick={handleManualUpload}
              disabled={isLoading || !pdfFile}
              className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="mr-2 h-5 w-5" />
              {isLoading ? 'Uploading...' : 'Upload Statement'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

