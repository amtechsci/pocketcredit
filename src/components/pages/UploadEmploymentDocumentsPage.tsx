import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Upload, Loader2, FileText, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';

export const UploadEmploymentDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const [payslip, setPayslip] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!payslip || !companyId) {
      toast.error('Please upload both documents to proceed');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('payslip', payslip);
      formData.append('company_id', companyId);
      if (applicationId) {
        formData.append('applicationId', applicationId);
      }

      const response = await apiService.uploadEmploymentDocuments(formData);
      if (response.success) {
        toast.success(response.message || 'Documents submitted successfully');
        navigate(`/loan-application/employment-docs-pending${applicationId ? `?applicationId=${applicationId}` : ''}`, { replace: true });
      } else {
        toast.error(response.message || 'Failed to upload documents');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload documents');
    } finally {
      setSubmitting(false);
    }
  };

  const FileField = ({
    label,
    file,
    onChange,
    id
  }: {
    label: string;
    file: File | null;
    onChange: (f: File | null) => void;
    id: string;
  }) => (
    <div>
      <Label htmlFor={id}>{label} *</Label>
      <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          id={id}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        <label htmlFor={id} className="cursor-pointer flex flex-col items-center gap-2">
          {file ? (
            <>
              <FileText className="w-8 h-8 text-green-600" />
              <span className="text-sm text-green-700 font-medium">{file.name}</span>
              <span className="text-xs text-gray-500">Click to change</span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600">Click to upload (JPG, PNG, PDF)</span>
            </>
          )}
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">UPLOAD EMPLOYMENT DOCUMENTS</CardTitle>
            <p className="text-sm text-gray-600 text-center">Upload both documents to proceed with verification</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileField
              id="payslip"
              label="Latest month Payslip"
              file={payslip}
              onChange={setPayslip}
            />
            <FileField
              id="company_id"
              label="Company ID card"
              file={companyId}
              onChange={setCompanyId}
            />
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Documents'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadEmploymentDocumentsPage;
