const express = require('express');
const { Transaction, Loan, User, getNextSequence } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const { validateQuery, querySchemas } = require('../middleware/validation');
const router = express.Router();

// Get user's transactions with pagination and filters
router.get('/', authenticateToken, validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder } = req.validatedQuery;
    const { type, status, loanId, fromDate, toDate, minAmount, maxAmount } = req.query;

    // Build filter
    let filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (loanId) filter.loanId = loanId;

    let transactions = Transaction.findAll(filter);

    // Apply additional filters
    if (fromDate || toDate || minAmount || maxAmount) {
      transactions = transactions.filter(transaction => {
        if (fromDate && new Date(transaction.createdAt) < new Date(fromDate)) return false;
        if (toDate && new Date(transaction.createdAt) > new Date(toDate)) return false;
        if (minAmount && Math.abs(transaction.amount) < parseFloat(minAmount)) return false;
        if (maxAmount && Math.abs(transaction.amount) > parseFloat(maxAmount)) return false;
        return true;
      });
    }

    // Sort transactions
    transactions.sort((a, b) => {
      const aVal = sortBy === 'amount' ? Math.abs(a.amount) : a[sortBy] || '';
      const bVal = sortBy === 'amount' ? Math.abs(b.amount) : b[sortBy] || '';
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Manual pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Calculate summary
    const summary = {
      totalTransactions: transactions.length,
      totalCredits: transactions.filter(t => t.type === 'credit').length,
      totalDebits: transactions.filter(t => t.type === 'debit').length,
      totalCreditAmount: transactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalDebitAmount: transactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      pendingTransactions: transactions.filter(t => t.status === 'pending').length
    };

    res.json({
      status: 'success',
      data: paginatedTransactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(transactions.length / limit),
        totalRecords: transactions.length,
        hasNext: endIndex < transactions.length,
        hasPrev: startIndex > 0,
        limit
      },
      summary
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions'
    });
  }
});

// Get transaction by ID
router.get('/:transactionId', authenticateToken, async (req, res) => {
  try {
    const transaction = Transaction.findById(req.params.transactionId);
    
    if (!transaction || transaction.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }

    // Get related loan details if applicable
    let loan = null;
    if (transaction.loanId) {
      loan = Loan.findOne({ loanId: transaction.loanId });
    }

    res.json({
      status: 'success',
      data: {
        transaction,
        loan: loan ? {
          loanId: loan.loanId,
          type: loan.type,
          amount: loan.amount,
          status: loan.status
        } : null
      }
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transaction'
    });
  }
});

// Create EMI payment transaction
router.post('/emi-payment', authenticateToken, async (req, res) => {
  try {
    const { loanId, amount, method = 'UPI' } = req.body;

    if (!loanId || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan ID and amount are required'
      });
    }

    // Verify loan belongs to user
    const loan = Loan.findOne({ loanId, userId: req.user.id });
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    // Check if loan is active
    if (!['active', 'disbursed'].includes(loan.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'EMI payment not allowed for current loan status'
      });
    }

    // Verify amount matches EMI
    if (Math.abs(amount - loan.emi) > 1) { // Allow 1 rupee difference for rounding
      return res.status(400).json({
        status: 'error',
        message: `EMI amount should be ₹${loan.emi}`
      });
    }

    // Generate transaction reference
    const transactionRef = `EMI_${getNextSequence('transactionId')}_${loanId}`;

    // Create EMI payment transaction
    const transaction = Transaction.create({
      userId: req.user.id,
      loanId,
      type: 'debit',
      amount: -Math.abs(amount),
      description: `EMI Payment - ${loanId}`,
      status: 'processing', // Start as processing, then update to completed
      reference: transactionRef,
      method,
      paymentGateway: method === 'UPI' ? 'RAZORPAY' : method === 'NEFT' ? 'BANK_TRANSFER' : 'OTHER'
    });

    // Simulate payment processing (in real app, integrate with payment gateway)
    setTimeout(async () => {
      try {
        // Simulate success/failure (95% success rate)
        const isSuccess = Math.random() > 0.05;
        
        if (isSuccess) {
          // Update transaction as completed
          Transaction.update(transaction.id, {
            status: 'completed',
            completedAt: new Date().toISOString()
          });

          // Update loan - increment paid EMIs
          const currentPaidEmis = loan.paidEmis || 0;
          const updatedLoan = Loan.update(loan.id, {
            paidEmis: currentPaidEmis + 1,
            lastPaymentDate: new Date().toISOString()
          });

          // Check if loan is fully paid
          if (updatedLoan.paidEmis >= updatedLoan.tenure) {
            Loan.update(loan.id, {
              status: 'closed',
              closedDate: new Date().toISOString()
            });
          }
        } else {
          // Mark as failed
          Transaction.update(transaction.id, {
            status: 'failed',
            failureReason: 'Payment gateway error'
          });
        }
      } catch (error) {
        console.error('EMI payment processing error:', error);
        Transaction.update(transaction.id, {
          status: 'failed',
          failureReason: 'Internal processing error'
        });
      }
    }, 3000); // 3 second delay to simulate processing

    res.status(201).json({
      status: 'success',
      message: 'EMI payment initiated successfully',
      data: {
        transaction,
        estimatedProcessingTime: '2-3 minutes',
        trackingId: transactionRef
      }
    });

  } catch (error) {
    console.error('EMI payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process EMI payment'
    });
  }
});

// Create prepayment transaction
router.post('/prepayment', authenticateToken, async (req, res) => {
  try {
    const { loanId, amount, type = 'partial', method = 'NEFT' } = req.body;

    if (!loanId || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan ID and amount are required'
      });
    }

    // Verify loan belongs to user
    const loan = Loan.findOne({ loanId, userId: req.user.id });
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    // Check if loan is active
    if (!['active', 'disbursed'].includes(loan.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Prepayment not allowed for current loan status'
      });
    }

    // Calculate outstanding amount
    const paidAmount = (loan.paidEmis || 0) * loan.emi;
    const outstanding = loan.amount - paidAmount;

    if (type === 'full' && amount < outstanding * 0.98) { // Allow 2% variance
      return res.status(400).json({
        status: 'error',
        message: `Full prepayment amount should be approximately ₹${outstanding}`
      });
    }

    if (type === 'partial' && amount >= outstanding) {
      return res.status(400).json({
        status: 'error',
        message: 'Partial prepayment amount cannot exceed outstanding balance'
      });
    }

    // Calculate prepayment charges (2% of prepayment amount)
    const prepaymentCharges = Math.round(amount * 0.02);
    const totalAmount = amount + prepaymentCharges;

    // Generate transaction reference
    const transactionRef = `PREPAY_${getNextSequence('transactionId')}_${loanId}`;

    // Create prepayment transaction
    const transaction = Transaction.create({
      userId: req.user.id,
      loanId,
      type: 'debit',
      amount: -totalAmount,
      description: `${type === 'full' ? 'Full' : 'Partial'} Prepayment - ${loanId}`,
      status: 'processing',
      reference: transactionRef,
      method,
      metadata: {
        prepaymentAmount: amount,
        prepaymentCharges,
        prepaymentType: type,
        outstandingBeforePayment: outstanding
      }
    });

    // Also create a separate entry for prepayment charges
    Transaction.create({
      userId: req.user.id,
      loanId,
      type: 'debit',
      amount: -prepaymentCharges,
      description: `Prepayment Charges - ${loanId}`,
      status: 'processing',
      reference: `CHARGES_${transactionRef}`,
      method
    });

    // Simulate payment processing
    setTimeout(async () => {
      try {
        const isSuccess = Math.random() > 0.02; // 98% success rate for prepayment
        
        if (isSuccess) {
          // Update transaction as completed
          Transaction.update(transaction.id, {
            status: 'completed',
            completedAt: new Date().toISOString()
          });

          if (type === 'full') {
            // Close the loan
            Loan.update(loan.id, {
              status: 'closed',
              closedDate: new Date().toISOString(),
              closureType: 'prepayment'
            });
          } else {
            // Update loan with prepayment (partial)
            // This would typically recalculate EMI or tenure
            const newOutstanding = outstanding - amount;
            const updatedPrincipal = loan.amount - (paidAmount + amount);
            
            Loan.update(loan.id, {
              amount: updatedPrincipal, // Reduce principal
              lastPaymentDate: new Date().toISOString(),
              prepaymentHistory: [
                ...(loan.prepaymentHistory || []),
                {
                  date: new Date().toISOString(),
                  amount,
                  charges: prepaymentCharges,
                  outstandingAfter: newOutstanding
                }
              ]
            });
          }
        } else {
          // Mark as failed
          Transaction.update(transaction.id, {
            status: 'failed',
            failureReason: 'Payment processing failed'
          });
        }
      } catch (error) {
        console.error('Prepayment processing error:', error);
        Transaction.update(transaction.id, {
          status: 'failed',
          failureReason: 'Internal processing error'
        });
      }
    }, 5000); // 5 second delay for prepayment processing

    res.status(201).json({
      status: 'success',
      message: 'Prepayment initiated successfully',
      data: {
        transaction,
        summary: {
          prepaymentAmount: amount,
          prepaymentCharges,
          totalAmount,
          type,
          savingsEstimate: type === 'full' ? 
            (loan.emi * (loan.tenure - (loan.paidEmis || 0))) - outstanding - prepaymentCharges : 
            null
        },
        estimatedProcessingTime: '5-10 minutes',
        trackingId: transactionRef
      }
    });

  } catch (error) {
    console.error('Prepayment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process prepayment'
    });
  }
});

// Get transaction summary/analytics
router.get('/summary/analytics', authenticateToken, async (req, res) => {
  try {
    const { period = '6months' } = req.query;
    
    let fromDate;
    switch (period) {
      case '1month':
        fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    }

    const transactions = Transaction.findAll({ userId: req.user.id })
      .filter(transaction => new Date(transaction.createdAt) >= fromDate);

    // Monthly breakdown
    const monthlyData = {};
    transactions.forEach(transaction => {
      const month = transaction.createdAt.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          credits: 0,
          debits: 0,
          creditAmount: 0,
          debitAmount: 0,
          transactions: 0
        };
      }
      
      monthlyData[month].transactions++;
      if (transaction.type === 'credit') {
        monthlyData[month].credits++;
        monthlyData[month].creditAmount += Math.abs(transaction.amount);
      } else {
        monthlyData[month].debits++;
        monthlyData[month].debitAmount += Math.abs(transaction.amount);
      }
    });

    // Transaction type breakdown
    const typeBreakdown = {};
    transactions.forEach(transaction => {
      const description = transaction.description.split(' ')[0]; // First word
      if (!typeBreakdown[description]) {
        typeBreakdown[description] = {
          count: 0,
          totalAmount: 0,
          avgAmount: 0
        };
      }
      
      typeBreakdown[description].count++;
      typeBreakdown[description].totalAmount += Math.abs(transaction.amount);
      typeBreakdown[description].avgAmount = Math.round(
        typeBreakdown[description].totalAmount / typeBreakdown[description].count
      );
    });

    // Recent trends
    const last30Days = transactions.filter(t => 
      new Date(t.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const previous30Days = transactions.filter(t => {
      const date = new Date(t.createdAt);
      return date >= new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) &&
             date < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    });

    const currentSpending = last30Days
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const previousSpending = previous30Days
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const spendingTrend = previousSpending > 0 
      ? ((currentSpending - previousSpending) / previousSpending) * 100
      : 0;

    res.json({
      status: 'success',
      data: {
        period,
        summary: {
          totalTransactions: transactions.length,
          totalCredits: transactions.filter(t => t.type === 'credit').length,
          totalDebits: transactions.filter(t => t.type === 'debit').length,
          totalCreditAmount: transactions
            .filter(t => t.type === 'credit')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0),
          totalDebitAmount: transactions
            .filter(t => t.type === 'debit')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0),
          avgTransactionAmount: transactions.length > 0 ? 
            Math.round(transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length) : 0
        },
        monthlyTrend: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
        typeBreakdown: Object.entries(typeBreakdown)
          .map(([type, data]) => ({ type, ...data }))
          .sort((a, b) => b.totalAmount - a.totalAmount),
        trends: {
          spendingTrend: Math.round(spendingTrend * 100) / 100,
          currentMonthSpending: currentSpending,
          previousMonthSpending: previousSpending,
          transactionFrequency: last30Days.length,
          avgDailySpending: Math.round(currentSpending / 30)
        }
      }
    });

  } catch (error) {
    console.error('Transaction analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate transaction analytics'
    });
  }
});

// Retry failed transaction
router.post('/:transactionId/retry', authenticateToken, async (req, res) => {
  try {
    const transaction = Transaction.findById(req.params.transactionId);
    
    if (!transaction || transaction.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'failed') {
      return res.status(400).json({
        status: 'error',
        message: 'Only failed transactions can be retried'
      });
    }

    // Update transaction status to processing
    const updatedTransaction = Transaction.update(transaction.id, {
      status: 'processing',
      retryCount: (transaction.retryCount || 0) + 1,
      lastRetryAt: new Date().toISOString()
    });

    // Simulate retry processing
    setTimeout(async () => {
      try {
        // Higher success rate for retries (90%)
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess) {
          Transaction.update(transaction.id, {
            status: 'completed',
            completedAt: new Date().toISOString()
          });
        } else {
          Transaction.update(transaction.id, {
            status: 'failed',
            failureReason: 'Retry failed - please contact support'
          });
        }
      } catch (error) {
        console.error('Transaction retry processing error:', error);
        Transaction.update(transaction.id, {
          status: 'failed',
          failureReason: 'Retry processing error'
        });
      }
    }, 2000);

    res.json({
      status: 'success',
      message: 'Transaction retry initiated',
      data: updatedTransaction
    });

  } catch (error) {
    console.error('Transaction retry error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retry transaction'
    });
  }
});

module.exports = router;