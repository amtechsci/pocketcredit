const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * GET /api/check-table/user-bank-statements
 * Check if table exists and show schema
 */
router.get('/user-bank-statements', async (req, res) => {
  try {
    await initializeDatabase();

    // Check if table exists
    const tables = await executeQuery(`SHOW TABLES LIKE 'user_bank_statements'`);
    
    if (!tables || tables.length === 0) {
      return res.json({
        exists: false,
        message: 'Table does NOT exist'
      });
    }

    // Get table structure
    const columns = await executeQuery(`DESCRIBE user_bank_statements`);

    res.json({
      exists: true,
      message: 'Table exists',
      columns: columns.map(col => ({
        field: col.Field,
        type: col.Type,
        null: col.Null,
        key: col.Key,
        default: col.Default
      }))
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to check table'
    });
  }
});

module.exports = router;

