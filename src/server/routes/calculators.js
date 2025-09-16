const express = require('express');
const router = express.Router();

// EMI Calculator
router.post('/emi', async (req, res) => {
  try {
    const { amount, interestRate, tenure } = req.body;

    // Validation
    if (!amount || !interestRate || !tenure) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount, interest rate, and tenure are required'
      });
    }

    if (amount <= 0 || interestRate <= 0 || tenure <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'All values must be positive numbers'
      });
    }

    // Calculate EMI using the formula
    const principal = parseFloat(amount);
    const rate = parseFloat(interestRate) / (12 * 100); // Monthly interest rate
    const time = parseInt(tenure);

    let emi;
    if (rate === 0) {
      // If interest rate is 0, EMI is simply principal divided by tenure
      emi = principal / time;
    } else {
      emi = (principal * rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
    }

    const totalAmount = emi * time;
    const totalInterest = totalAmount - principal;

    // Generate amortization schedule
    const schedule = [];
    let remainingPrincipal = principal;

    for (let month = 1; month <= time; month++) {
      const interestPayment = remainingPrincipal * rate;
      const principalPayment = emi - interestPayment;
      remainingPrincipal -= principalPayment;

      schedule.push({
        month,
        emi: Math.round(emi),
        principalPayment: Math.round(principalPayment),
        interestPayment: Math.round(interestPayment),
        remainingBalance: Math.max(0, Math.round(remainingPrincipal))
      });

      if (remainingPrincipal <= 0) break;
    }

    res.json({
      status: 'success',
      data: {
        emi: Math.round(emi),
        totalAmount: Math.round(totalAmount),
        totalInterest: Math.round(totalInterest),
        principal: Math.round(principal),
        interestRate: parseFloat(interestRate),
        tenure: parseInt(tenure),
        schedule: schedule
      }
    });

  } catch (error) {
    console.error('EMI calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate EMI'
    });
  }
});

// Loan Eligibility Calculator
router.post('/eligibility', async (req, res) => {
  try {
    const { 
      monthlyIncome, 
      existingEmi = 0, 
      age, 
      employmentType, 
      creditScore = 750,
      loanType = 'personal'
    } = req.body;

    // Validation
    if (!monthlyIncome || !age || !employmentType) {
      return res.status(400).json({
        status: 'error',
        message: 'Monthly income, age, and employment type are required'
      });
    }

    if (monthlyIncome <= 0 || age <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Income and age must be positive values'
      });
    }

    // Age eligibility check
    const minAge = 21;
    const maxAge = employmentType === 'salaried' ? 60 : 65;
    
    if (age < minAge || age > maxAge) {
      return res.json({
        status: 'success',
        data: {
          eligible: false,
          reason: `Age should be between ${minAge} and ${maxAge} years`,
          eligibleAmount: 0
        }
      });
    }

    // Income eligibility
    const minIncome = loanType === 'personal' ? 25000 : 50000;
    if (monthlyIncome < minIncome) {
      return res.json({
        status: 'success',
        data: {
          eligible: false,
          reason: `Minimum monthly income required: ₹${minIncome.toLocaleString()}`,
          eligibleAmount: 0
        }
      });
    }

    // Calculate FOIR (Fixed Obligation to Income Ratio)
    const maxFoir = 0.6; // 60%
    const availableIncome = monthlyIncome - existingEmi;
    const maxAffordableEmi = availableIncome * maxFoir;

    // Determine interest rate based on credit score and loan type
    let interestRate;
    if (loanType === 'personal') {
      interestRate = creditScore >= 750 ? 12 : creditScore >= 700 ? 14 : 16;
    } else if (loanType === 'business') {
      interestRate = creditScore >= 750 ? 14 : creditScore >= 700 ? 16 : 18;
    } else {
      interestRate = 14; // default
    }

    // Calculate maximum eligible amount for different tenures
    const tenureOptions = [12, 24, 36, 48, 60];
    const eligibilityByTenure = tenureOptions.map(tenure => {
      const monthlyRate = interestRate / (12 * 100);
      const maxAmount = maxAffordableEmi * (Math.pow(1 + monthlyRate, tenure) - 1) / 
                       (monthlyRate * Math.pow(1 + monthlyRate, tenure));

      return {
        tenure,
        maxAmount: Math.floor(maxAmount),
        emi: Math.round(maxAffordableEmi),
        interestRate,
        totalInterest: Math.round((maxAffordableEmi * tenure) - maxAmount),
        totalAmount: Math.round(maxAffordableEmi * tenure)
      };
    });

    // Find the best eligible amount
    const bestOption = eligibilityByTenure.reduce((best, current) => 
      current.maxAmount > best.maxAmount ? current : best
    );

    // Multiplier based on profile
    let multiplier = 10; // Base multiplier
    if (employmentType === 'salaried') multiplier += 2;
    if (creditScore >= 750) multiplier += 3;
    else if (creditScore >= 700) multiplier += 1;

    const maxEligibleAmount = Math.min(bestOption.maxAmount, monthlyIncome * multiplier);

    res.json({
      status: 'success',
      data: {
        eligible: maxEligibleAmount >= 50000, // Minimum loan amount
        eligibleAmount: Math.round(maxEligibleAmount),
        maxAffordableEmi: Math.round(maxAffordableEmi),
        interestRate,
        recommendedTenure: bestOption.tenure,
        eligibilityByTenure,
        factors: {
          monthlyIncome,
          availableIncome: Math.round(availableIncome),
          creditScore,
          age,
          employmentType,
          foir: Math.round((maxAffordableEmi / monthlyIncome) * 100)
        }
      }
    });

  } catch (error) {
    console.error('Eligibility calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate eligibility'
    });
  }
});

// Interest Rate Calculator
router.get('/interest-rates', async (req, res) => {
  try {
    const { loanType = 'personal', amount = 500000, creditScore = 750 } = req.query;

    // Interest rate matrix based on loan type and credit score
    const rateMatrix = {
      personal: {
        excellent: { min: 10.5, max: 12.5 }, // 750+
        good: { min: 12.5, max: 15.5 },      // 700-749
        fair: { min: 15.5, max: 18.5 },      // 650-699
        poor: { min: 18.5, max: 24.0 }       // <650
      },
      business: {
        excellent: { min: 12.0, max: 14.0 },
        good: { min: 14.0, max: 17.0 },
        fair: { min: 17.0, max: 20.0 },
        poor: { min: 20.0, max: 26.0 }
      }
    };

    // Determine credit category
    let creditCategory;
    if (creditScore >= 750) creditCategory = 'excellent';
    else if (creditScore >= 700) creditCategory = 'good';
    else if (creditScore >= 650) creditCategory = 'fair';
    else creditCategory = 'poor';

    const rates = rateMatrix[loanType]?.[creditCategory] || rateMatrix.personal.fair;

    // Calculate sample EMIs for different tenures
    const sampleCalculations = [12, 24, 36, 48, 60].map(tenure => {
      const rate = rates.min; // Use best rate for calculation
      const monthlyRate = rate / (12 * 100);
      const emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                  (Math.pow(1 + monthlyRate, tenure) - 1);

      return {
        tenure,
        interestRate: rate,
        emi: Math.round(emi),
        totalInterest: Math.round((emi * tenure) - amount),
        totalAmount: Math.round(emi * tenure)
      };
    });

    res.json({
      status: 'success',
      data: {
        loanType,
        creditScore: parseInt(creditScore),
        creditCategory,
        interestRates: rates,
        factors: [
          'Credit Score',
          'Income Stability',
          'Employment Type',
          'Loan Amount',
          'Tenure',
          'Existing Obligations'
        ],
        sampleCalculations
      }
    });

  } catch (error) {
    console.error('Interest rate calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate interest rates'
    });
  }
});

// Comparison Calculator
router.post('/compare', async (req, res) => {
  try {
    const { loans } = req.body;

    if (!loans || !Array.isArray(loans) || loans.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Array of loans is required for comparison'
      });
    }

    if (loans.length > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 5 loans can be compared at once'
      });
    }

    const comparison = loans.map((loan, index) => {
      const { amount, interestRate, tenure, processingFee = 0, otherCharges = 0 } = loan;

      // Validation
      if (!amount || !interestRate || !tenure) {
        throw new Error(`Loan ${index + 1}: Amount, interest rate, and tenure are required`);
      }

      const principal = parseFloat(amount);
      const rate = parseFloat(interestRate) / (12 * 100);
      const time = parseInt(tenure);
      const fees = parseFloat(processingFee) + parseFloat(otherCharges);

      // Calculate EMI
      const emi = (principal * rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
      const totalAmount = emi * time;
      const totalInterest = totalAmount - principal;
      const totalCost = totalAmount + fees;
      const apr = ((totalCost - principal) / principal / (time / 12)) * 100; // Approximate APR

      return {
        loanIndex: index + 1,
        principal: Math.round(principal),
        interestRate: parseFloat(interestRate),
        tenure: time,
        processingFee: parseFloat(processingFee),
        otherCharges: parseFloat(otherCharges),
        emi: Math.round(emi),
        totalInterest: Math.round(totalInterest),
        totalAmount: Math.round(totalAmount),
        totalCost: Math.round(totalCost),
        apr: Math.round(apr * 100) / 100 // Round to 2 decimal places
      };
    });

    // Find best options
    const bestEmi = comparison.reduce((min, curr) => curr.emi < min.emi ? curr : min);
    const bestInterest = comparison.reduce((min, curr) => curr.totalInterest < min.totalInterest ? curr : min);
    const bestTotalCost = comparison.reduce((min, curr) => curr.totalCost < min.totalCost ? curr : min);
    const lowestAPR = comparison.reduce((min, curr) => curr.apr < min.apr ? curr : min);

    res.json({
      status: 'success',
      data: {
        comparison,
        recommendations: {
          lowestEmi: bestEmi.loanIndex,
          lowestInterest: bestInterest.loanIndex,
          lowestTotalCost: bestTotalCost.loanIndex,
          lowestAPR: lowestAPR.loanIndex
        },
        summary: {
          emiRange: {
            min: Math.min(...comparison.map(l => l.emi)),
            max: Math.max(...comparison.map(l => l.emi))
          },
          interestRange: {
            min: Math.min(...comparison.map(l => l.totalInterest)),
            max: Math.max(...comparison.map(l => l.totalInterest))
          },
          totalCostRange: {
            min: Math.min(...comparison.map(l => l.totalCost)),
            max: Math.max(...comparison.map(l => l.totalCost))
          }
        }
      }
    });

  } catch (error) {
    console.error('Comparison calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to compare loans'
    });
  }
});

// Prepayment Calculator
router.post('/prepayment', async (req, res) => {
  try {
    const { 
      loanAmount, 
      interestRate, 
      tenure, 
      paidEmis = 0, 
      prepaymentAmount,
      prepaymentType = 'partial' // 'partial' or 'full'
    } = req.body;

    // Validation
    if (!loanAmount || !interestRate || !tenure || !prepaymentAmount) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan amount, interest rate, tenure, and prepayment amount are required'
      });
    }

    const principal = parseFloat(loanAmount);
    const rate = parseFloat(interestRate) / (12 * 100);
    const totalTenure = parseInt(tenure);
    const paidMonths = parseInt(paidEmis);
    const prepayAmount = parseFloat(prepaymentAmount);

    // Calculate original EMI
    const originalEmi = (principal * rate * Math.pow(1 + rate, totalTenure)) / 
                        (Math.pow(1 + rate, totalTenure) - 1);

    // Calculate outstanding principal after paid EMIs
    let outstandingPrincipal = principal;
    for (let i = 1; i <= paidMonths; i++) {
      const interestPortion = outstandingPrincipal * rate;
      const principalPortion = originalEmi - interestPortion;
      outstandingPrincipal -= principalPortion;
    }

    // Prepayment charges (typically 2-4% of prepayment amount)
    const prepaymentCharges = prepayAmount * 0.02;
    const effectivePrepayment = prepayAmount - prepaymentCharges;

    if (prepaymentType === 'full') {
      // Full prepayment - close the loan
      const totalPrepaymentAmount = outstandingPrincipal + prepaymentCharges;
      const remainingTenure = totalTenure - paidMonths;
      const savedInterest = (originalEmi * remainingTenure) - outstandingPrincipal;
      const netSaving = savedInterest - prepaymentCharges;

      res.json({
        status: 'success',
        data: {
          type: 'full_prepayment',
          outstandingPrincipal: Math.round(outstandingPrincipal),
          prepaymentCharges: Math.round(prepaymentCharges),
          totalPrepaymentAmount: Math.round(totalPrepaymentAmount),
          savedInterest: Math.round(savedInterest),
          netSaving: Math.round(netSaving),
          remainingTenure: remainingTenure
        }
      });
    } else {
      // Partial prepayment
      if (effectivePrepayment >= outstandingPrincipal) {
        return res.status(400).json({
          status: 'error',
          message: 'Prepayment amount cannot be greater than outstanding principal'
        });
      }

      const newOutstandingPrincipal = outstandingPrincipal - effectivePrepayment;
      const remainingTenure = totalTenure - paidMonths;

      // Option 1: Reduce EMI, keep same tenure
      const newEmiSameTenure = (newOutstandingPrincipal * rate * Math.pow(1 + rate, remainingTenure)) / 
                               (Math.pow(1 + rate, remainingTenure) - 1);

      // Option 2: Keep same EMI, reduce tenure
      let newTenure = remainingTenure;
      if (originalEmi > newOutstandingPrincipal * rate) {
        newTenure = Math.log(1 + (newOutstandingPrincipal * rate) / (originalEmi - newOutstandingPrincipal * rate)) / 
                    Math.log(1 + rate);
        newTenure = Math.ceil(newTenure);
      }

      // Calculate savings for both options
      const savingsOption1 = (originalEmi - newEmiSameTenure) * remainingTenure - prepaymentCharges;
      const savingsOption2 = originalEmi * (remainingTenure - newTenure) - prepaymentCharges;

      res.json({
        status: 'success',
        data: {
          type: 'partial_prepayment',
          currentOutstanding: Math.round(outstandingPrincipal),
          prepaymentAmount: Math.round(prepayAmount),
          prepaymentCharges: Math.round(prepaymentCharges),
          effectivePrepayment: Math.round(effectivePrepayment),
          newOutstanding: Math.round(newOutstandingPrincipal),
          
          option1: {
            description: 'Reduce EMI, same tenure',
            currentEmi: Math.round(originalEmi),
            newEmi: Math.round(newEmiSameTenure),
            tenure: remainingTenure,
            monthlySaving: Math.round(originalEmi - newEmiSameTenure),
            totalSaving: Math.round(savingsOption1)
          },
          
          option2: {
            description: 'Same EMI, reduce tenure',
            emi: Math.round(originalEmi),
            currentTenure: remainingTenure,
            newTenure: newTenure,
            tenureReduction: remainingTenure - newTenure,
            totalSaving: Math.round(savingsOption2)
          }
        }
      });
    }

  } catch (error) {
    console.error('Prepayment calculation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate prepayment benefits'
    });
  }
});

module.exports = router;