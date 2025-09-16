import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, ArrowRight, IndianRupee, Building2, Users, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface LoanApplication {
  id: number;
  application_number: string;
  loan_amount: number;
  loan_purpose: string;
  status: string;
  current_step: string;
  created_at: string;
}

interface LoanApplicationCardProps {
  application: LoanApplication;
}

export function LoanApplicationCard({ application }: LoanApplicationCardProps) {
  console.log('LoanApplicationCard: Rendering with application:', application);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const getStepInfo = (step: string) => {
    switch (step) {
      case 'bank_details':
        return {
          label: 'Bank Details',
          icon: Building2,
          description: 'Provide your bank account details',
          color: 'bg-blue-500'
        };
      case 'references':
        return {
          label: 'References',
          icon: Users,
          description: 'Add reference contact numbers',
          color: 'bg-orange-500'
        };
      case 'completed':
        return {
          label: 'Completed',
          icon: Check,
          description: 'Application submitted successfully',
          color: 'bg-green-500'
        };
      default:
        return {
          label: 'Application',
          icon: FileText,
          description: 'Loan application submitted',
          color: 'bg-gray-500'
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Submitted</Badge>;
      case 'bank_details_provided':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const handleContinueApplication = () => {
    setLoading(true);
    navigate(`/loan-application/steps?applicationId=${application.id}`);
  };

  const stepInfo = getStepInfo(application.current_step);
  const StepIcon = stepInfo.icon;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stepInfo.color}`}>
            <StepIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {application.application_number}
            </h3>
            <p className="text-sm text-gray-500">{stepInfo.description}</p>
          </div>
        </div>
        {getStatusBadge(application.status)}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Loan Amount</span>
          <div className="flex items-center space-x-1">
            <IndianRupee className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">
              {application.loan_amount.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Purpose</span>
          <span className="text-sm font-medium text-gray-900">{application.loan_purpose}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Applied On</span>
          <span className="text-sm text-gray-900">
            {new Date(application.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {application.current_step !== 'completed' && (
        <Button
          onClick={handleContinueApplication}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Loading...
            </>
          ) : (
            <>
              Continue Application
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {application.current_step === 'completed' && (
        <div className="text-center py-2">
          <p className="text-sm text-green-600 font-medium">
            ✓ Application completed successfully
          </p>
        </div>
      )}
    </Card>
  );
}
