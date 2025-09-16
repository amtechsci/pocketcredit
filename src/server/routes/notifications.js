const express = require('express');
const { SmsLog, User, Loan } = require('../utils/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

// Mock SMS service
const sendSMS = async (mobile, message, type = 'general') => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock success/failure (95% success rate)
  const isSuccess = Math.random() > 0.05;
  
  return {
    success: isSuccess,
    messageId: `SMS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    status: isSuccess ? 'delivered' : 'failed',
    failureReason: isSuccess ? null : 'Network error'
  };
};

// Mock email service
const sendEmail = async (email, subject, message, type = 'general') => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Mock success/failure (98% success rate)
  const isSuccess = Math.random() > 0.02;
  
  return {
    success: isSuccess,
    messageId: `EMAIL_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    status: isSuccess ? 'delivered' : 'failed',
    failureReason: isSuccess ? null : 'SMTP error'
  };
};

// Send SMS to user
router.post('/sms/send', authenticateToken, async (req, res) => {
  try {
    const { message, type = 'custom' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    if (message.length > 160) {
      return res.status(400).json({
        status: 'error',
        message: 'SMS message cannot exceed 160 characters'
      });
    }

    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Send SMS
    const smsResult = await sendSMS(user.mobile, message, type);

    // Log SMS
    const smsLog = SmsLog.create({
      userId: req.user.id,
      mobile: user.mobile,
      message,
      type,
      status: smsResult.status,
      messageId: smsResult.messageId,
      failureReason: smsResult.failureReason
    });

    res.json({
      status: 'success',
      message: smsResult.success ? 'SMS sent successfully' : 'SMS failed to send',
      data: {
        smsLog,
        delivered: smsResult.success
      }
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

// Get SMS templates
router.get('/sms/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'welcome',
        name: 'Welcome Message',
        content: 'Welcome to Pocket Credit! Your account has been created successfully. Start your loan journey with us.',
        type: 'welcome',
        variables: ['name']
      },
      {
        id: 'otp_verification',
        name: 'OTP Verification',
        content: 'Your Pocket Credit OTP is: {{otp}}. Valid for 10 minutes. Do not share this OTP with anyone.',
        type: 'otp',
        variables: ['otp']
      },
      {
        id: 'loan_applied',
        name: 'Loan Application Received',
        content: 'Thank you for applying for {{loan_type}} loan. Your application {{loan_id}} is under review. We will update you within 24-48 hours.',
        type: 'application_received',
        variables: ['loan_type', 'loan_id']
      },
      {
        id: 'loan_approved',
        name: 'Loan Approved',
        content: 'Congratulations! Your loan of ₹{{amount}} has been approved. Funds will be disbursed within 2-3 working days.',
        type: 'loan_approved',
        variables: ['amount']
      },
      {
        id: 'loan_rejected',
        name: 'Loan Rejected',
        content: 'We regret to inform you that your loan application {{loan_id}} cannot be approved at this time. Please contact support for details.',
        type: 'loan_rejected',
        variables: ['loan_id']
      },
      {
        id: 'document_request',
        name: 'Document Required',
        content: 'Please upload {{document_name}} to complete your loan application. Upload at: https://pocketcredit.com/upload',
        type: 'document_request',
        variables: ['document_name']
      },
      {
        id: 'emi_reminder',
        name: 'EMI Reminder',
        content: 'Your EMI of ₹{{emi_amount}} for loan {{loan_id}} is due on {{due_date}}. Pay now to avoid late charges.',
        type: 'emi_reminder',
        variables: ['emi_amount', 'loan_id', 'due_date']
      },
      {
        id: 'emi_overdue',
        name: 'EMI Overdue',
        content: 'Your EMI of ₹{{emi_amount}} for loan {{loan_id}} is overdue. Please pay immediately to avoid penalty charges.',
        type: 'emi_overdue',
        variables: ['emi_amount', 'loan_id']
      },
      {
        id: 'payment_success',
        name: 'Payment Successful',
        content: 'Your payment of ₹{{amount}} has been received successfully. Thank you! Transaction ID: {{transaction_id}}',
        type: 'payment_success',
        variables: ['amount', 'transaction_id']
      },
      {
        id: 'kyc_complete',
        name: 'KYC Completed',
        content: 'Your KYC verification has been completed successfully. You can now apply for loans up to ₹{{eligible_amount}}.',
        type: 'kyc_complete',
        variables: ['eligible_amount']
      }
    ];

    res.json({
      status: 'success',
      data: templates
    });

  } catch (error) {
    console.error('Get SMS templates error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch SMS templates'
    });
  }
});

// Get user's SMS history
router.get('/sms/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    let filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const result = SmsLog.findWithPagination(
      filter,
      parseInt(page),
      parseInt(limit),
      'createdAt',
      'desc'
    );

    // Calculate statistics
    const allSms = SmsLog.findAll({ userId: req.user.id });
    const stats = {
      total: allSms.length,
      delivered: allSms.filter(sms => sms.status === 'delivered').length,
      failed: allSms.filter(sms => sms.status === 'failed').length,
      pending: allSms.filter(sms => sms.status === 'pending').length,
      thisMonth: allSms.filter(sms => {
        const smsDate = new Date(sms.createdAt);
        const now = new Date();
        return smsDate.getMonth() === now.getMonth() && 
               smsDate.getFullYear() === now.getFullYear();
      }).length
    };

    res.json({
      status: 'success',
      data: result.data,
      pagination: result.pagination,
      stats
    });

  } catch (error) {
    console.error('Get SMS history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch SMS history'
    });
  }
});

// Admin: Send SMS to user
router.post('/admin/sms/send/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { message, type = 'admin_message' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    const user = User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Send SMS
    const smsResult = await sendSMS(user.mobile, message, type);

    // Log SMS with admin info
    const smsLog = SmsLog.create({
      userId: user.id,
      adminId: req.admin.id,
      mobile: user.mobile,
      message,
      type,
      status: smsResult.status,
      messageId: smsResult.messageId,
      failureReason: smsResult.failureReason
    });

    res.json({
      status: 'success',
      message: smsResult.success ? 'SMS sent successfully' : 'SMS failed to send',
      data: {
        smsLog,
        delivered: smsResult.success,
        recipient: {
          name: user.name,
          mobile: user.mobile
        }
      }
    });

  } catch (error) {
    console.error('Admin send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

// Admin: Bulk SMS
router.post('/admin/sms/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { userIds, message, type = 'bulk_message' } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User IDs array is required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    if (userIds.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 100 users allowed per bulk SMS'
      });
    }

    const results = [];
    const users = userIds.map(id => User.findById(id)).filter(user => user);

    for (const user of users) {
      try {
        const smsResult = await sendSMS(user.mobile, message, type);
        
        const smsLog = SmsLog.create({
          userId: user.id,
          adminId: req.admin.id,
          mobile: user.mobile,
          message,
          type,
          status: smsResult.status,
          messageId: smsResult.messageId,
          failureReason: smsResult.failureReason
        });

        results.push({
          userId: user.id,
          name: user.name,
          mobile: user.mobile,
          status: smsResult.status,
          smsLogId: smsLog.id
        });

      } catch (error) {
        results.push({
          userId: user.id,
          name: user.name,
          mobile: user.mobile,
          status: 'failed',
          error: error.message
        });
      }
    }

    const summary = {
      total: results.length,
      delivered: results.filter(r => r.status === 'delivered').length,
      failed: results.filter(r => r.status === 'failed').length,
      successRate: Math.round((results.filter(r => r.status === 'delivered').length / results.length) * 100)
    };

    res.json({
      status: 'success',
      message: 'Bulk SMS completed',
      data: {
        results,
        summary
      }
    });

  } catch (error) {
    console.error('Bulk SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send bulk SMS'
    });
  }
});

// Send automated notifications
router.post('/automated/loan-status', async (req, res) => {
  try {
    const { loanId, status, userId } = req.body;

    if (!loanId || !status || !userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan ID, status, and user ID are required'
      });
    }

    const user = User.findById(userId);
    const loan = Loan.findOne({ loanId, userId });

    if (!user || !loan) {
      return res.status(404).json({
        status: 'error',
        message: 'User or loan not found'
      });
    }

    let message;
    let type;

    switch (status) {
      case 'approved':
        message = `Congratulations! Your loan of ₹${loan.amount.toLocaleString()} has been approved. Funds will be disbursed within 2-3 working days.`;
        type = 'loan_approved';
        break;
      case 'rejected':
        message = `We regret to inform you that your loan application ${loanId} cannot be approved at this time. Please contact support for details.`;
        type = 'loan_rejected';
        break;
      case 'disbursed':
        message = `Your loan amount of ₹${loan.amount.toLocaleString()} has been disbursed to your account. First EMI due date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`;
        type = 'loan_disbursed';
        break;
      default:
        message = `Your loan application ${loanId} status has been updated to ${status.replace('_', ' ')}.`;
        type = 'status_update';
    }

    // Send SMS
    const smsResult = await sendSMS(user.mobile, message, type);

    // Log SMS
    const smsLog = SmsLog.create({
      userId,
      mobile: user.mobile,
      message,
      type,
      status: smsResult.status,
      messageId: smsResult.messageId,
      failureReason: smsResult.failureReason,
      automated: true
    });

    res.json({
      status: 'success',
      message: 'Automated notification sent',
      data: {
        smsLog,
        delivered: smsResult.success
      }
    });

  } catch (error) {
    console.error('Automated notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send automated notification'
    });
  }
});

// Schedule EMI reminders
router.post('/schedule/emi-reminders', authenticateAdmin, async (req, res) => {
  try {
    // Get all active loans with upcoming EMIs
    const activeLoans = Loan.findAll({ status: 'active' });
    const remindersSent = [];

    for (const loan of activeLoans) {
      const user = User.findById(loan.userId);
      if (!user) continue;

      // Calculate next EMI date
      const disbursalDate = new Date(loan.disbursalDate);
      const nextEmiDate = new Date(disbursalDate);
      nextEmiDate.setMonth(nextEmiDate.getMonth() + (loan.paidEmis || 0) + 1);

      // Send reminder if EMI is due within 3 days
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      if (nextEmiDate <= threeDaysFromNow && nextEmiDate >= new Date()) {
        const message = `Your EMI of ₹${loan.emi.toLocaleString()} for loan ${loan.loanId} is due on ${nextEmiDate.toLocaleDateString('en-IN')}. Pay now to avoid late charges.`;
        
        try {
          const smsResult = await sendSMS(user.mobile, message, 'emi_reminder');
          
          const smsLog = SmsLog.create({
            userId: user.id,
            adminId: req.admin?.id || 'system',
            mobile: user.mobile,
            message,
            type: 'emi_reminder',
            status: smsResult.status,
            messageId: smsResult.messageId,
            failureReason: smsResult.failureReason,
            automated: true
          });

          remindersSent.push({
            userId: user.id,
            loanId: loan.loanId,
            name: user.name,
            mobile: user.mobile,
            emiAmount: loan.emi,
            dueDate: nextEmiDate.toISOString(),
            status: smsResult.status,
            smsLogId: smsLog.id
          });

        } catch (error) {
          console.error(`Failed to send EMI reminder to user ${user.id}:`, error);
        }
      }
    }

    res.json({
      status: 'success',
      message: `EMI reminders processed for ${remindersSent.length} users`,
      data: {
        remindersSent,
        summary: {
          total: remindersSent.length,
          delivered: remindersSent.filter(r => r.status === 'delivered').length,
          failed: remindersSent.filter(r => r.status === 'failed').length
        }
      }
    });

  } catch (error) {
    console.error('Schedule EMI reminders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to schedule EMI reminders'
    });
  }
});

// Get notification statistics
router.get('/statistics', authenticateAdmin, async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    
    let fromDate;
    switch (period) {
      case '7days':
        fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const allSms = SmsLog.findAll()
      .filter(sms => new Date(sms.createdAt) >= fromDate);

    // Overall statistics
    const stats = {
      total: allSms.length,
      delivered: allSms.filter(sms => sms.status === 'delivered').length,
      failed: allSms.filter(sms => sms.status === 'failed').length,
      pending: allSms.filter(sms => sms.status === 'pending').length,
      automated: allSms.filter(sms => sms.automated).length,
      manual: allSms.filter(sms => !sms.automated).length
    };

    stats.deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

    // Type breakdown
    const typeStats = {};
    allSms.forEach(sms => {
      if (!typeStats[sms.type]) {
        typeStats[sms.type] = { count: 0, delivered: 0, failed: 0 };
      }
      typeStats[sms.type].count++;
      if (sms.status === 'delivered') typeStats[sms.type].delivered++;
      if (sms.status === 'failed') typeStats[sms.type].failed++;
    });

    // Daily breakdown for charting
    const dailyStats = {};
    allSms.forEach(sms => {
      const date = sms.createdAt.split('T')[0]; // YYYY-MM-DD
      if (!dailyStats[date]) {
        dailyStats[date] = { date, total: 0, delivered: 0, failed: 0 };
      }
      dailyStats[date].total++;
      if (sms.status === 'delivered') dailyStats[date].delivered++;
      if (sms.status === 'failed') dailyStats[date].failed++;
    });

    res.json({
      status: 'success',
      data: {
        period,
        overview: stats,
        typeBreakdown: Object.entries(typeStats).map(([type, data]) => ({
          type,
          ...data,
          deliveryRate: data.count > 0 ? Math.round((data.delivered / data.count) * 100) : 0
        })),
        dailyTrend: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))
      }
    });

  } catch (error) {
    console.error('Get notification statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notification statistics'
    });
  }
});

module.exports = router;