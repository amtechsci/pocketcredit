const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/companies/search?q=query&limit=15
 * Search companies by name with autocomplete
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { q = '', limit = 15 } = req.query;
    const searchTerm = q.trim();
    
    // Parse and validate limit (must be a positive integer)
    const limitNum = Math.min(Math.max(parseInt(limit) || 15, 1), 50);
    
    if (!searchTerm) {
      // Return most searched/popular companies if no query
      const companies = await executeQuery(
        `SELECT id, company_name, industry, is_verified 
         FROM companies 
         ORDER BY search_count DESC, company_name ASC 
         LIMIT ${limitNum}`
      );
      
      return res.json({
        success: true,
        data: companies
      });
    }
    
    // Search companies by name (starts with or contains)
    const companies = await executeQuery(
      `SELECT id, company_name, industry, is_verified 
       FROM companies 
       WHERE company_name LIKE ? 
       ORDER BY 
         CASE 
           WHEN company_name LIKE ? THEN 1 
           ELSE 2 
         END,
         search_count DESC,
         company_name ASC 
       LIMIT ${limitNum}`,
      [`%${searchTerm}%`, `${searchTerm}%`]
    );
    
    // Increment search count for found companies (one by one to avoid SQL injection)
    if (companies.length > 0) {
      for (const company of companies) {
        await executeQuery(
          `UPDATE companies SET search_count = search_count + 1 WHERE id = ?`,
          [company.id]
        );
      }
    }
    
    res.json({
      success: true,
      data: companies,
      count: companies.length
    });
    
  } catch (error) {
    console.error('Company search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search companies',
      error: error.message
    });
  }
});

/**
 * POST /api/companies/add
 * Add a new company (user-submitted)
 */
router.post('/add', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { company_name, industry } = req.body;
    
    if (!company_name || company_name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required and must be at least 2 characters'
      });
    }
    
    // Check if company already exists
    const existing = await executeQuery(
      'SELECT id, company_name FROM companies WHERE company_name = ?',
      [company_name.trim()]
    );
    
    if (existing.length > 0) {
      return res.json({
        success: true,
        data: existing[0],
        message: 'Company already exists'
      });
    }
    
    // Insert new company (unverified)
    const result = await executeQuery(
      `INSERT INTO companies (company_name, industry, is_verified) 
       VALUES (?, ?, FALSE)`,
      [company_name.trim(), industry || null]
    );
    
    res.json({
      success: true,
      data: {
        id: result.insertId,
        company_name: company_name.trim(),
        industry: industry || null,
        is_verified: false
      },
      message: 'Company added successfully'
    });
    
  } catch (error) {
    console.error('Add company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add company',
      error: error.message
    });
  }
});

module.exports = router;

