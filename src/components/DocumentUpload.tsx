import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../services/api';

interface DocumentUploadProps {
  documentType: string; // e.g., 'college_id_front', 'college_id_back', 'marks_memo'
  label: string;
  description?: string;
  accept?: string;
  maxSize?: number; // in MB
  onUploadSuccess?: (fileData: any) => void;
  onUploadError?: (error: string) => void;
  existingFile?: any;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentType,
  label,
  description = 'Supported formats: JPG, PNG, PDF',
  accept = '.jpg,.jpeg,.png,.pdf',
  maxSize = 5, // 5MB default
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
    if (!validateFile(file)) {
      return;
    }

    setSelectedFile(file);
    handleUpload(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
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
      formData.append('document_type', documentType);

      // Simulate progress (real progress tracking would require axios with onUploadProgress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiService.uploadStudentDocument(formData);

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
      const response = await apiService.deleteStudentDocument(uploadedFile.id);
      if (response.status === 'success') {
        setSelectedFile(null);
        setUploadedFile(null);
        toast.success('Document removed successfully');
      }
    } catch (error: any) {
      console.error('Document delete error:', error);
      toast.error('Failed to remove document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    return <FileText className="w-8 h-8 text-blue-500" />;
  };

  if (uploadedFile) {
    return (
      <div className="border border-green-300 bg-green-50 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-900">{label}</p>
              <p className="text-xs text-green-700 truncate">{uploadedFile.file_name}</p>
              {uploadedFile.file_size && (
                <p className="text-xs text-green-600">{formatFileSize(uploadedFile.file_size)}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-2 text-green-600 hover:text-red-600 transition-colors"
            title="Remove document"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} *
      </label>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
          ${uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{uploadProgress}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">
                <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
              <p className="text-xs text-gray-500">Max {maxSize}MB</p>
            </div>
          </div>
        )}
      </div>

      {selectedFile && !uploading && !uploadedFile && (
        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-200">
          {getFileIcon(selectedFile.name)}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
            }}
            className="text-gray-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

