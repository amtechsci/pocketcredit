import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';
import { toast } from 'sonner';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  category: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

export function DocumentUploadPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const userData = {
    name: 'Rajesh Kumar'
  };

  const documentCategories = [
    { value: 'identity', label: 'Identity Proof', examples: 'Aadhaar, PAN Card, Passport' },
    { value: 'address', label: 'Address Proof', examples: 'Utility Bills, Rental Agreement' },
    { value: 'income', label: 'Income Proof', examples: 'Salary Slips, Bank Statements' },
    { value: 'bank', label: 'Bank Documents', examples: 'Bank Statements, Cheques' },
    { value: 'other', label: 'Other Documents', examples: 'Any other relevant documents' }
  ];

  const acceptedFormats = ['.pdf', '.jpg', '.jpeg', '.png'];
  const maxFileSize = 5; // MB

  const handleFileSelect = (files: FileList | null) => {
    if (!files || !selectedCategory) {
      if (!selectedCategory) {
        toast.error('Please select a document category first');
      }
      return;
    }

    Array.from(files).forEach(file => {
      // Validate file size
      if (file.size > maxFileSize * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is ${maxFileSize}MB`);
        return;
      }

      // Validate file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedFormats.includes(fileExtension)) {
        toast.error(`${file.name} format not supported. Use PDF, JPG, or PNG`);
        return;
      }

      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: file.type,
        category: selectedCategory,
        status: 'uploading',
        progress: 0
      };

      setUploadedFiles(prev => [...prev, newFile]);

      // Simulate file upload
      simulateUpload(newFile.id);
    });
  };

  const simulateUpload = (fileId: string) => {
    const interval = setInterval(() => {
      setUploadedFiles(prev => 
        prev.map(file => {
          if (file.id === fileId) {
            const newProgress = Math.min(file.progress + Math.random() * 20, 100);
            const newStatus = newProgress === 100 ? 'uploaded' : 'uploading';
            
            if (newProgress === 100) {
              clearInterval(interval);
              toast.success(`${file.name} uploaded successfully`);
            }
            
            return { ...file, progress: newProgress, status: newStatus };
          }
          return file;
        })
      );
    }, 500);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={userData.name} 
      />
      
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Upload Documents</h1>
            <p className="text-gray-600">Upload your documents for verification</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Category Selection */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Document Category</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="category">Document Type</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose document category" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentCategories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          <div>
                            <div className="font-medium">{category.label}</div>
                            <div className="text-xs text-gray-500">{category.examples}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* File Upload Area */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
              
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                } ${!selectedCategory ? 'opacity-50 pointer-events-none' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-medium mb-2">Drop files here or click to browse</h4>
                <p className="text-gray-600 mb-4">
                  Support for PDF, JPG, PNG files up to {maxFileSize}MB each
                </p>
                
                <input
                  type="file"
                  multiple
                  accept={acceptedFormats.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="file-upload"
                  disabled={!selectedCategory}
                />
                <Button asChild disabled={!selectedCategory}>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Choose Files
                  </label>
                </Button>
                
                {!selectedCategory && (
                  <p className="text-red-500 text-sm mt-2">Please select a document category first</p>
                )}
              </div>
            </Card>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
                
                <div className="space-y-4">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {file.size} • {documentCategories.find(c => c.value === file.category)?.label}
                        </p>
                        
                        {file.status === 'uploading' && (
                          <div className="mt-2">
                            <Progress value={file.progress} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">{Math.round(file.progress)}% uploaded</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {file.status === 'uploaded' && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile(file.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={uploadedFiles.some(f => f.status === 'uploading')}
                  >
                    Submit Documents
                  </Button>
                  <Button variant="outline" onClick={() => setUploadedFiles([])}>
                    Clear All
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upload Guidelines */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Guidelines</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Ensure documents are clear and readable</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>File size should be less than {maxFileSize}MB</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Supported formats: PDF, JPG, PNG</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Avoid blurred or cropped images</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Upload original documents only</span>
                </div>
              </div>
            </Card>

            {/* Required Documents */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Required Documents</h3>
              
              <div className="space-y-3">
                {documentCategories.slice(0, 4).map(category => (
                  <div key={category.value} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{category.label}</p>
                      <p className="text-xs text-gray-600">{category.examples}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Help */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Having trouble uploading documents? Our support team is here to help.
              </p>
              
              <Button variant="outline" size="sm" className="w-full">
                Contact Support
              </Button>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}