import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Smartphone, Building2, CheckCircle, Info, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { DashboardHeader } from '../DashboardHeader';
import { DashboardSidebar } from '../DashboardSidebar';
import { toast } from 'sonner';

export function PayEMIPage() {
  const navigate = useNavigate();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('auto-pay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Mock loan data
  const loanData = {
    id: 'PL001',
    type: 'Personal Loan',
    emiAmount: 15000,
    dueDate: '2024-01-15',
    lateCharges: 0,
    totalAmount: 15000,
    outstandingAmount: 245000,
    nextEmiDate: '2024-02-15'
  };

  const userData = {
    name: 'Rajesh Kumar',
    accountBalance: 25000
  };

  const paymentMethods = [
    {
      id: 'auto-pay',
      name: 'Auto Pay (Recommended)',
      description: 'Automatic debit from your registered bank account',
      icon: <Building2 className="w-5 h-5" />,
      fee: 0,
      processingTime: 'Instant'
    },
    {
      id: 'debit-card',
      name: 'Debit Card',
      description: 'Pay using your debit card',
      icon: <CreditCard className="w-5 h-5" />,
      fee: 0,
      processingTime: 'Instant'
    },
    {
      id: 'upi',
      name: 'UPI',
      description: 'Pay using UPI (PhonePe, Google Pay, Paytm)',
      icon: <Smartphone className="w-5 h-5" />,
      fee: 0,
      processingTime: 'Instant'
    },
    {
      id: 'net-banking',
      name: 'Net Banking',
      description: 'Pay using your internet banking',
      icon: <Building2 className="w-5 h-5" />,
      fee: 0,
      processingTime: '2-3 minutes'
    }
  ];

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      setShowConfirmation(true);
      toast.success('EMI payment successful!');
    }, 3000);
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    navigate('/dashboard');
  };

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader 
          userName={userData.name} 
        />
        
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">Your EMI payment has been processed successfully</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Transaction ID</p>
                  <p className="font-semibold">TXN{Date.now()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Amount Paid</p>
                  <p className="font-semibold">₹{loanData.emiAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Payment Method</p>
                  <p className="font-semibold">Auto Pay</p>
                </div>
                <div>
                  <p className="text-gray-600">Next EMI Date</p>
                  <p className="font-semibold">{loanData.nextEmiDate}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/payment-history')}
              >
                View Receipt
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleConfirmationClose}
              >
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-semibold">Pay EMI</h1>
            <p className="text-gray-600">Make your monthly EMI payment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Details */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Loan Details</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Loan ID</span>
                  <span className="font-semibold">{loanData.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Loan Type</span>
                  <span className="font-semibold">{loanData.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">EMI Amount</span>
                  <span className="font-semibold text-lg">₹{loanData.emiAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Due Date</span>
                  <Badge variant="outline" className="border-orange-300 text-orange-600">
                    {loanData.dueDate}
                  </Badge>
                </div>
                
                {loanData.lateCharges > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span>Late Charges</span>
                    <span className="font-semibold">₹{loanData.lateCharges}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold">₹{loanData.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Payment Method</h3>
              
              <RadioGroup value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {method.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{method.name}</p>
                              {method.id === 'auto-pay' && (
                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{method.description}</p>
                            <p className="text-xs text-gray-500">{method.processingTime}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </Card>

            {/* Additional Payment Details */}
            {selectedPaymentMethod !== 'auto-pay' && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
                
                {selectedPaymentMethod === 'debit-card' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input id="expiry" placeholder="MM/YY" />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV</Label>
                        <Input id="cvv" placeholder="123" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="cardName">Name on Card</Label>
                      <Input id="cardName" placeholder="Enter name as on card" />
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === 'upi' && (
                  <div>
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input id="upiId" placeholder="yourname@paytm" />
                  </div>
                )}

                {selectedPaymentMethod === 'net-banking' && (
                  <div>
                    <Label htmlFor="bank">Select Bank</Label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option value="">Choose your bank</option>
                      <option value="hdfc">HDFC Bank</option>
                      <option value="icici">ICICI Bank</option>
                      <option value="sbi">State Bank of India</option>
                      <option value="axis">Axis Bank</option>
                    </select>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Payment Summary */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>EMI Amount</span>
                  <span>₹{loanData.emiAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Late Charges</span>
                  <span>₹{loanData.lateCharges}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Fee</span>
                  <span>₹0</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span>₹{loanData.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              <Button 
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white"
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : `Pay ₹${loanData.totalAmount.toLocaleString()}`}
              </Button>
            </Card>

            {/* Security Info */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold">Secure Payment</h4>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• 256-bit SSL encryption</p>
                <p>• PCI DSS compliant</p>
                <p>• Your payment data is secure</p>
                <p>• Instant confirmation</p>
              </div>
            </Card>

            {/* Help */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold">Need Help?</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Having trouble making payment? Contact our support team.
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