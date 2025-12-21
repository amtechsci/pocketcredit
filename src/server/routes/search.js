const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Global search endpoint - search by name, PAN, number, alt number, ref numbers, bank loan id, PC id
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const exactSearch = q.trim();

    // Search across multiple tables
    const allResults = [];
    const seenUserIds = new Set();

    // 1. Search by user name, mobile, email, PAN, CLID
    try {
      const userResults = await executeQuery(`
        SELECT 
          u.id as user_id,
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as customer_name,
          u.phone as number,
          u.alternate_mobile as alt_number,
          u.pan_number as pan,
          CONCAT('PC', LPAD(u.id, 5, '0')) as clid,
          'user' as source,
          CASE 
            WHEN CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) LIKE ? THEN 'name'
            WHEN u.phone LIKE ? THEN 'number'
            WHEN u.alternate_mobile LIKE ? THEN 'alt number'
            WHEN u.pan_number LIKE ? THEN 'pan'
            WHEN CONCAT('PC', LPAD(u.id, 5, '0')) LIKE ? THEN 'CLID'
            ELSE 'user data'
          END as found_in
        FROM users u
        WHERE 
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) LIKE ?
          OR u.phone LIKE ?
          OR u.alternate_mobile LIKE ?
          OR u.pan_number LIKE ?
          OR CONCAT('PC', LPAD(u.id, 5, '0')) LIKE ?
      `, [
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm
      ]);

      for (const result of userResults) {
        if (!seenUserIds.has(result.user_id)) {
          seenUserIds.add(result.user_id);
          allResults.push(result);
        }
      }
    } catch (error) {
      console.error('Error in user search:', error);
    }

    // 2. Search by reference numbers (phone, name)
    try {
      const refResults = await executeQuery(`
        SELECT 
          r.user_id,
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as customer_name,
          u.phone as number,
          u.alternate_mobile as alt_number,
          u.pan_number as pan,
          CONCAT('PC', LPAD(u.id, 5, '0')) as clid,
          'reference' as source,
          CONCAT('Reference: ', r.name, ' (', r.phone, ')') as found_in
        FROM \`references\` r
        INNER JOIN users u ON r.user_id = u.id
        WHERE 
          r.name LIKE ?
          OR r.phone LIKE ?
      `, [searchTerm, searchTerm]);

      for (const result of refResults) {
        if (!seenUserIds.has(result.user_id)) {
          seenUserIds.add(result.user_id);
          allResults.push(result);
        } else {
          const existing = allResults.find(r => r.user_id === result.user_id);
          if (existing && !existing.found_in.includes(result.found_in)) {
            existing.found_in += `, ${result.found_in}`;
          }
        }
      }
    } catch (error) {
      console.error('Error in reference search:', error);
    }

    // 3. Search by loan application number (both full and short format)
    try {
      const loanResults = await executeQuery(`
        SELECT 
          la.user_id,
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as customer_name,
          u.phone as number,
          u.alternate_mobile as alt_number,
          u.pan_number as pan,
          CONCAT('PC', LPAD(u.id, 5, '0')) as clid,
          'loan' as source,
          CONCAT('Loan ID: ', la.application_number) as found_in
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE 
          la.application_number LIKE ?
          OR CONCAT('PLL', RIGHT(la.application_number, 4)) LIKE ?
          OR CONCAT('PLL', LPAD(la.id, 4, '0')) LIKE ?
      `, [searchTerm, exactSearch, exactSearch]);

      for (const result of loanResults) {
        if (!seenUserIds.has(result.user_id)) {
          seenUserIds.add(result.user_id);
          allResults.push(result);
        } else {
          const existing = allResults.find(r => r.user_id === result.user_id);
          if (existing && !existing.found_in.includes(result.found_in)) {
            existing.found_in += `, ${result.found_in}`;
          }
        }
      }
    } catch (error) {
      console.error('Error in loan search:', error);
    }

        for (const result of results) {
          if (!seenUserIds.has(result.user_id)) {
            seenUserIds.add(result.user_id);
            allResults.push(result);
          } else {
            // If user already exists, update found_in to include multiple sources
            const existing = allResults.find(r => r.user_id === result.user_id);
            if (existing && !existing.found_in.includes(result.found_in)) {
              existing.found_in += `, ${result.found_in}`;
            }
          }
        }
      } catch (error) {
        console.error('Error executing search query:', error);
        // Continue with other queries even if one fails
      }
    }

    // Format results
    const formattedResults = allResults.map(result => ({
      userId: result.user_id,
      customerName: result.customer_name || 'N/A',
      number: result.number || 'N/A',
      altNumber: result.alt_number || 'N/A',
      pan: result.pan || 'N/A',
      clid: result.clid || 'N/A',
      foundIn: result.found_in || 'User data'
    }));

    res.json({
      status: 'success',
      data: formattedResults,
      count: formattedResults.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform search'
    });
  }
});

module.exports = router;

