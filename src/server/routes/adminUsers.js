const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Get all users with filters and pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 Users request:', { search, status, page, limit });

    // Build the base query
    let baseQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone as mobile,
        u.status,
        u.kyc_completed,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        u.last_login_at as lastLogin,
        COUNT(la.id) as totalApplications,
        SUM(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END) as approvedApplications,
        SUM(CASE WHEN la.status = 'rejected' THEN 1 ELSE 0 END) as rejectedApplications
      FROM users u
      LEFT JOIN loan_applications la ON u.id = la.user_id
    `;

    const whereConditions = [];
    const queryParams = [];

    // Search filter
    if (search) {
      whereConditions.push(`(
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push('u.status = ?');
      queryParams.push(status);
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add GROUP BY
    baseQuery += ' GROUP BY u.id';

    // Add ORDER BY clause
    const validSortFields = {
      'name': 'u.first_name',
      'email': 'u.email',
      'status': 'u.status',
      'createdAt': 'u.created_at',
      'lastLogin': 'u.last_login_at'
    };

    const sortField = validSortFields[sortBy] || 'u.created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY ${sortField} ${sortDirection}`;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    
    const countResult = await executeQuery(countQuery, queryParams);
    const totalUsers = countResult[0].total;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    baseQuery += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    // Execute the main query
    console.log('🔍 Executing users query with params:', queryParams);
    console.log('🔍 Query:', baseQuery);
    
    let users;
    try {
      users = await executeQuery(baseQuery, queryParams);
      console.log('🔍 Users query executed successfully, got', users.length, 'results');
    } catch (queryError) {
      console.error('❌ Users query execution error:', queryError);
      throw queryError;
    }

    // Transform the data to match the expected format
    const usersWithData = users.map(user => ({
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
      email: user.email || '',
      mobile: user.mobile || '',
      status: user.status || 'active',
      kycCompleted: user.kyc_completed || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      totalApplications: parseInt(user.totalApplications) || 0,
      approvedApplications: parseInt(user.approvedApplications) || 0,
      rejectedApplications: parseInt(user.rejectedApplications) || 0
    }));

    res.json({
      status: 'success',
      data: {
        users: usersWithData,
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

// Get user details by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { id } = req.params;
    
    const userQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone as mobile,
        u.status,
        u.kyc_completed,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        u.last_login_at as lastLogin,
        u.date_of_birth,
        u.gender,
        u.marital_status,
        u.pan_number,
        u.aadhar_number,
        COUNT(la.id) as totalApplications,
        SUM(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END) as approvedApplications,
        SUM(CASE WHEN la.status = 'rejected' THEN 1 ELSE 0 END) as rejectedApplications
      FROM users u
      LEFT JOIN loan_applications la ON u.id = la.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `;
    
    const users = await executeQuery(userQuery, [id]);
    
    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    const user = users[0];
    const userData = {
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
      email: user.email || '',
      mobile: user.mobile || '',
      status: user.status || 'active',
      kycCompleted: user.kyc_completed || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      maritalStatus: user.marital_status,
      panNumber: user.pan_number,
      aadharNumber: user.aadhar_number,
      totalApplications: parseInt(user.totalApplications) || 0,
      approvedApplications: parseInt(user.approvedApplications) || 0,
      rejectedApplications: parseInt(user.rejectedApplications) || 0
    };
    
    res.json({
      status: 'success',
      data: userData
    });
    
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user details'
    });
  }
});

// Update user status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be active, inactive, or pending'
      });
    }
    
    const updateQuery = 'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?';
    const result = await executeQuery(updateQuery, [status, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'User status updated successfully'
    });
    
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status'
    });
  }
});

// Delete user
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { id } = req.params;
    
    // Check if user has any applications
    const applicationsQuery = 'SELECT COUNT(*) as count FROM loan_applications WHERE user_id = ?';
    const applicationsResult = await executeQuery(applicationsQuery, [id]);
    
    if (applicationsResult[0].count > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete user with existing loan applications'
      });
    }
    
    const deleteQuery = 'DELETE FROM users WHERE id = ?';
    const result = await executeQuery(deleteQuery, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user'
    });
  }
});

module.exports = router;
