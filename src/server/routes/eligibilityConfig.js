const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// GET /api/admin/settings/eligibility-config - Get all eligibility configurations
router.get('/eligibility-config', async (req, res) => {
  try {
    await initializeDatabase();
    const configs = await executeQuery('SELECT id, config_key, config_value, description, data_type, updated_at FROM eligibility_config');

    const formattedConfigs = {};
    configs.forEach(config => {
      formattedConfigs[config.config_key] = {
        id: config.id,
        value: config.config_value,
        description: config.description,
        data_type: config.data_type,
        updated_at: config.updated_at
      };
    });

    res.json({ success: true, data: formattedConfigs });
  } catch (error) {
    console.error('Error fetching eligibility configurations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/admin/settings/eligibility-config - Update eligibility configurations
router.put('/eligibility-config', async (req, res) => {
  try {
    await initializeDatabase();
    const { configs } = req.body;

    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid configuration data provided' });
    }

    const updatedConfigs = [];
    for (const key in configs) {
      if (configs.hasOwnProperty(key) && configs[key].value !== undefined) {
        const { value, description } = configs[key];

        // Basic validation for numeric values
        if (['min_monthly_salary', 'hold_period_days', 'min_age_years', 'max_age_years'].includes(key)) {
          const numValue = parseInt(value);
          if (isNaN(numValue) || numValue < 0) {
            return res.status(400).json({ success: false, message: `Invalid numeric value for ${key}` });
          }
        }

        await executeQuery(
          `UPDATE eligibility_config SET config_value = ?, ${description ? 'description = ?,' : ''} updated_at = NOW() WHERE config_key = ?`,
          description ? [value, description, key] : [value, key]
        );
        updatedConfigs.push({ key, value, description: description || '' });
      }
    }

    res.json({ success: true, message: 'Eligibility configurations updated successfully', data: updatedConfigs });
  } catch (error) {
    console.error('Error updating eligibility configurations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Helper function to convert income_range to approximate monthly income
const getMonthlyIncomeFromRange = (range) => {
  if (!range) return 0;
  const rangeMap = {
    '1k-15k': 7500,
    '15k-25k': 20000,
    '25k-35k': 30000,
    'above-35k': 40000
  };
  return rangeMap[range] || 0;
};

// GET /api/eligibility/check - Public endpoint to check eligibility (for user-facing form)
router.get('/check', async (req, res) => {
  try {
    await initializeDatabase();
    
    const { employment_type, income_range, payment_mode } = req.query;
    
    // Get eligibility criteria
    const configs = await executeQuery('SELECT config_key, config_value FROM eligibility_config');
    const criteria = {};
    configs.forEach(c => {
      criteria[c.config_key] = c.config_value;
    });
    
    const minSalary = parseInt(criteria.min_monthly_salary || '30000');
    const allowedModes = (criteria.allowed_payment_modes || 'bank_transfer').split(',');
    const requiredEmployment = (criteria.required_employment_types || 'salaried').split(',');
    const holdDays = parseInt(criteria.hold_period_days || '45');
    
    // Convert income_range to monthly income for comparison
    const monthlyIncome = getMonthlyIncomeFromRange(income_range);
    
    // Check eligibility
    const issues = [];
    let eligible = true;
    
    if (income_range && monthlyIncome < minSalary) {
      eligible = false;
      issues.push(`Minimum monthly salary required is ₹${minSalary.toLocaleString()}`);
    }
    
    if (payment_mode && !allowedModes.includes(payment_mode.toLowerCase().replace(' ', '_'))) {
      eligible = false;
      issues.push(`Payment mode must be ${allowedModes.map(m => m.replace('_', ' ')).join(' or ')}`);
    }
    
    if (employment_type && !requiredEmployment.includes(employment_type.toLowerCase().replace('-', '_'))) {
      eligible = false;
      issues.push(`Employment type must be ${requiredEmployment.join(' or ')}`);
    }
    
    res.json({
      success: true,
      data: {
        eligible,
        issues,
        criteria: {
          min_salary: minSalary,
          allowed_payment_modes: allowedModes,
          required_employment_types: requiredEmployment,
          hold_period_days: holdDays
        }
      }
    });
    
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;


