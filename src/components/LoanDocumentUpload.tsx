import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../services/api';

interface LoanDocumentUploadProps {
  loanApplicationId: number;
  documentName: string; // Human-readable name (e.g., "Last 3 month bank statement")
  documentType: string; // Document type identifier (e.g., "bank_statement")
  label?: string;
  description?: string;
  accept?: string;
  maxSize?: number; // in MB
  onUploadSuccess?: (fileData: any) => void;
  onUploadError?: (error: string) => void;
  existingFile?: any;
}

export const LoanDocumentUpload: React.FC<LoanDocumentUploadProps> = ({
  loanApplicationId,
  documentName,
  documentType,
  label = '',
  description = 'Supported formats: JPG, PNG, PDF',
  accept = '.jpg,.jpeg,.png,.pdf',
  maxSize = 10, // 10MB default
  onUploadSuccess,
  onUploadError,
  existingFile
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<any>(existingFile || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type. Please upload ${accept}`);
      if (onUploadError) onUploadError('Invalid file type');
      return false;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      toast.error(`File size must be less than ${maxSize}MB`);
      if (onUploadError) onUploadError(`File too large (${fileSizeMB.toFixed(2)}MB)`);
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('document', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiService.uploadLoanDocument(
        formData,
        loanApplicationId,
        documentName,
        documentType
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.status === 'success' && response.data) {
        setUploadedFile(response.data.document);
        toast.success('Document uploaded successfully!');
        if (onUploadSuccess) onUploadSuccess(response.data.document);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Document upload error:', error);
      const errorMessage = error.message || 'Failed to upload document';
      toast.error(errorMessage);
      if (onUploadError) onUploadError(errorMessage);
      setSelectedFile(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = async () => {
    if (!uploadedFile || !uploadedFile.id) {
      setSelectedFile(null);
      setUploadedFile(null);
      return;
    }

    try {
      await apiService.deleteLoanDocument(uploadedFile.id);
      setUploadedFile(null);
      setSelectedFile(null);
      toast.success('Document removed successfully');
    } catch (error: any) {
      console.error('Delete document error:', error);
      toast.error('Failed to remove document');
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      handleUpload(selectedFile);
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {description && (
        <p className="text-xs text-gray-500 mb-2">{description}</p>
      )}

      {uploadedFile ? (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  {uploadedFile.file_name || documentName}
                </p>
                {uploadedFile.file_size && (
                  <p className="text-xs text-green-700">
                    {(uploadedFile.file_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-red-600 hover:text-red-800 p-1"
              disabled={uploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileInputChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-3">
                <FileText className="w-8 h-8 text-blue-600 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={uploading}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="flex items-center">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </span>
                    ) : (
                      'Upload'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm text-gray-600">
                    Drag and drop a file here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {accept} (max {maxSize}MB)
                  </p>
                </div>
              </div>
            )}

            {uploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {selectedFile && !uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>Click "Upload" to submit the file</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};




