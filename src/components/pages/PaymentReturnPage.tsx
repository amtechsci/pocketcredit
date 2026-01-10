import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export const PaymentReturnPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending' | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('orderId');
  const paymentStatusParam = searchParams.get('status');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!orderId) {
      setError('Order ID not found');
      setLoading(false);
      return;
    }

    // Check payment status from URL params first
    if (paymentStatusParam === 'SUCCESS' || paymentStatusParam === 'PAID') {
      setPaymentStatus('success');
      fetchOrderStatus();
    } else if (paymentStatusParam === 'FAILED' || paymentStatusParam === 'CANCELLED') {
      setPaymentStatus('failed');
      fetchOrderStatus();
    } else {
      // Fetch order status from backend
      fetchOrderStatus();
    }
  }, [orderId, paymentStatusParam, isAuthenticated, navigate]);

  const fetchOrderStatus = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const response = await apiService.getPaymentOrderStatus(orderId);

      if (response.success && response.data) {
        setOrderDetails(response.data);
        
        // Determine status
        const status = response.data.status || response.data.cashfreeStatus?.order_status;
        if (status === 'PAID' || status === 'paid') {
          setPaymentStatus('success');
          toast.success('Payment successful!');
        } else if (status === 'FAILED' || status === 'failed') {
          setPaymentStatus('failed');
        } else {
          setPaymentStatus('pending');
        }
      } else {
        setError('Failed to fetch payment status');
        setPaymentStatus('failed');
      }
    } catch (err: any) {
      console.error('Error fetching payment status:', err);
      setError(err.message || 'Failed to fetch payment status');
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <DashboardHeader userName={user?.first_name || 'User'} />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Verifying payment status...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <DashboardHeader userName={user?.first_name || 'User'} />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-xl">
          <CardContent className="p-8">
            {paymentStatus === 'success' && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
                  <p className="text-gray-600 mb-6">
                    Your payment has been processed successfully.
                  </p>
                </div>

                {orderDetails && (
                  <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                    <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-medium">{orderDetails.order_id || orderId}</span>
                      </div>
                      {orderDetails.amount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount:</span>
                          <span className="font-medium">
                            ₹{parseFloat(orderDetails.amount).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      )}
                      {orderDetails.payment_method && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Method:</span>
                          <span className="font-medium">{orderDetails.payment_method}</span>
                        </div>
                      )}
                      {orderDetails.transaction_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transaction ID:</span>
                          <span className="font-medium text-sm">{orderDetails.transaction_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Only show "View Repayment Schedule" if loan status is 'account_manager' and not 'cleared' */}
                  {orderDetails?.loan_status === 'account_manager' && orderDetails?.loan_status !== 'cleared' && (
                    <Button
                      onClick={() => {
                        if (orderDetails?.loan_id) {
                          navigate(`/repayment-schedule?applicationId=${orderDetails.loan_id}`);
                        } else {
                          navigate('/repayment-schedule');
                        }
                      }}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      View Repayment Schedule
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-12 h-12 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
                  <p className="text-gray-600 mb-6">
                    {error || 'Your payment could not be processed. Please try again.'}
                  </p>
                </div>

                {orderDetails && orderDetails.order_id && (
                  <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-medium">{orderDetails.order_id}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      if (orderDetails?.loan_id) {
                        navigate(`/repayment-schedule?applicationId=${orderDetails.loan_id}`);
                      } else {
                        navigate('/repayment-schedule');
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'pending' && (
              <div className="text-center">
                <div className="mb-6">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Pending</h2>
                  <p className="text-gray-600 mb-6">
                    Your payment is being processed. Please wait a few moments and refresh this page.
                  </p>
                </div>

                <Button
                  onClick={fetchOrderStatus}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Refresh Status
                </Button>
              </div>
            )}

            {!paymentStatus && error && (
              <div className="text-center">
                <div className="mb-6">
                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
                  <p className="text-gray-600 mb-6">{error}</p>
                </div>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

