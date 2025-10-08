const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// =====================================================
// USER CONFIGURATION MANAGEMENT
// =====================================================

// GET /api/admin/settings/user-config - Get all user configurations
router.get('/user-config', async (req, res) => {
  try {
    await initializeDatabase();
    
    const configs = await executeQuery(
      'SELECT * FROM user_config ORDER BY config_key'
    );
    
    // Transform the data into a more frontend-friendly format
    const configMap = {};
    configs.forEach(config => {
      configMap[config.config_key] = {
        id: config.id,
        value: config.config_value,
        description: config.description,
        updated_at: config.updated_at
      };
    });
    
    res.json({
      success: true,
      data: configMap
    });
    
  } catch (error) {
    console.error('Error fetching user configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user configurations'
    });
  }
});

// PUT /api/admin/settings/user-config - Update user configurations
router.put('/user-config', async (req, res) => {
  try {
    await initializeDatabase();
    const { configs } = req.body;
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Configurations object is required'
      });
    }
    
    const updatedConfigs = [];
    
    for (const [key, configData] of Object.entries(configs)) {
      // Validate the configuration
      if (!configData.value) {
        return res.status(400).json({
          success: false,
          message: `Value is required for configuration: ${key}`
        });
      }
      
      // Validate specific configurations
      if (key === 'default_credit_score' || key === 'min_credit_score' || key === 'max_credit_score') {
        const score = parseInt(configData.value);
        if (isNaN(score) || score < 300 || score > 850) {
          return res.status(400).json({
            success: false,
            message: `${key} must be a number between 300 and 850`
          });
        }
      }
      
      if (key === 'credit_limit_multiplier') {
        const multiplier = parseInt(configData.value);
        if (isNaN(multiplier) || multiplier < 50 || multiplier > 500) {
          return res.status(400).json({
            success: false,
            message: 'Credit limit multiplier must be between 50 and 500'
          });
        }
      }
      
      if (key === 'credit_score_update_frequency') {
        const validFrequencies = ['monthly', 'quarterly', 'yearly'];
        if (!validFrequencies.includes(configData.value)) {
          return res.status(400).json({
            success: false,
            message: 'Credit score update frequency must be monthly, quarterly, or yearly'
          });
        }
      }
      
      // Update the configuration
      const result = await executeQuery(
        'UPDATE user_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?',
        [configData.value, key]
      );
      
      if (result.affectedRows > 0) {
        updatedConfigs.push({
          key,
          value: configData.value,
          description: configData.description
        });
      }
    }
    
    res.json({
      success: true,
      message: 'User configurations updated successfully',
      data: updatedConfigs
    });
    
  } catch (error) {
    console.error('Error updating user configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating user configurations'
    });
  }
});

// GET /api/admin/settings/user-config/calculate-credit-limit - Calculate credit limit for a user
router.get('/user-config/calculate-credit-limit', async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, monthlySalary } = req.query;
    
    if (!userId || !monthlySalary) {
      return res.status(400).json({
        success: false,
        message: 'User ID and monthly salary are required'
      });
    }
    
    // Get credit limit multiplier from config
    const configs = await executeQuery(
      'SELECT config_value FROM user_config WHERE config_key = ?',
      ['credit_limit_multiplier']
    );
    
    if (!configs || configs.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Credit limit multiplier not configured'
      });
    }
    
    const multiplier = parseInt(configs[0].config_value);
    const salary = parseFloat(monthlySalary);
    const creditLimit = Math.round((salary * multiplier) / 100);
    
    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        monthlySalary: salary,
        creditLimitMultiplier: multiplier,
        calculatedCreditLimit: creditLimit,
        calculation: `${salary} × ${multiplier}% = ₹${creditLimit.toLocaleString()}`
      }
    });
    
  } catch (error) {
    console.error('Error calculating credit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while calculating credit limit'
    });
  }
});

module.exports = router;
