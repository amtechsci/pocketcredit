import { useState, useEffect } from 'react';
import { Calculator, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Slider } from './ui/slider';
import { Label } from './ui/label';

export function EMICalculator() {
  const [loanAmount, setLoanAmount] = useState([500000]);
  const [interestRate, setInterestRate] = useState([14]);
  const [tenure, setTenure] = useState([24]);
  
  const [emiDetails, setEmiDetails] = useState({
    emi: 0,
    totalInterest: 0,
    totalAmount: 0,
  });

  const calculateEMI = () => {
    const principal = loanAmount[0];
    const rate = interestRate[0] / 12 / 100; // Monthly interest rate
    const months = tenure[0];

    if (rate === 0) {
      const emi = principal / months;
      setEmiDetails({
        emi: Math.round(emi),
        totalInterest: 0,
        totalAmount: principal,
      });
    } else {
      const emi = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
      const totalAmount = emi * months;
      const totalInterest = totalAmount - principal;

      setEmiDetails({
        emi: Math.round(emi),
        totalInterest: Math.round(totalInterest),
        totalAmount: Math.round(totalAmount),
      });
    }
  };

  useEffect(() => {
    calculateEMI();
  }, [loanAmount, interestRate, tenure]);

  const interestPercentage = ((emiDetails.totalInterest / emiDetails.totalAmount) * 100).toFixed(1);
  const principalPercentage = ((loanAmount[0] / emiDetails.totalAmount) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E2A3B' }}>
          EMI Calculator
        </h3>
        <p className="text-gray-600">Calculate your monthly EMI instantly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Controls */}
        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Loan Amount</Label>
              <span className="text-sm font-medium" style={{ color: '#0052FF' }}>
                ₹{loanAmount[0].toLocaleString()}
              </span>
            </div>
            <Slider
              value={loanAmount}
              onValueChange={setLoanAmount}
              min={50000}
              max={1000000}
              step={10000}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>₹50K</span>
              <span>₹10L</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Interest Rate (per annum)</Label>
              <span className="text-sm font-medium" style={{ color: '#0052FF' }}>
                {interestRate[0]}%
              </span>
            </div>
            <Slider
              value={interestRate}
              onValueChange={setInterestRate}
              min={10}
              max={36}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10%</span>
              <span>36%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Loan Tenure</Label>
              <span className="text-sm font-medium" style={{ color: '#0052FF' }}>
                {tenure[0]} months ({Math.round(tenure[0] / 12)} years)
              </span>
            </div>
            <Slider
              value={tenure}
              onValueChange={setTenure}
              min={6}
              max={60}
              step={6}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>6M</span>
              <span>5Y</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <Card className="border-2" style={{ borderColor: '#0052FF' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-center" style={{ color: '#1E2A3B' }}>
                Your EMI Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Calculator className="w-5 h-5" style={{ color: '#0052FF' }} />
                  <span className="text-sm text-gray-600">Monthly EMI</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#0052FF' }}>
                  ₹{emiDetails.emi.toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                  <p className="text-xs text-gray-600 mb-1">Total Interest</p>
                  <p className="font-semibold" style={{ color: '#1E2A3B' }}>
                    ₹{emiDetails.totalInterest.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F0F4F8' }}>
                  <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                  <p className="font-semibold" style={{ color: '#1E2A3B' }}>
                    ₹{emiDetails.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Visual Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PieChart className="w-4 h-4" style={{ color: '#0052FF' }} />
                  <span className="text-sm font-medium" style={{ color: '#1E2A3B' }}>Payment Breakdown</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Principal Amount</span>
                      <span style={{ color: '#1E2A3B' }}>{principalPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          backgroundColor: '#0052FF',
                          width: `${principalPercentage}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Total Interest</span>
                      <span style={{ color: '#1E2A3B' }}>{interestPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          backgroundColor: '#00C49A',
                          width: `${interestPercentage}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0052FF' }}></div>
                    <span className="text-gray-600">Principal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#00C49A' }}></div>
                    <span className="text-gray-600">Interest</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              *EMI calculations are approximate. Actual EMI may vary based on the lender's terms and conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}