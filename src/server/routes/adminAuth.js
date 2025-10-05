const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { executeQuery, initializeDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Initialize database connection
let dbInitialized = false;
const ensureDbInitialized = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

console.log('Admin auth routes loaded - MySQL VERSION');

// Admin Login
router.post('/login', validate(schemas.adminLogin), async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    console.log('Admin login attempt:', { email, password: '***' });

    // Ensure database is initialized
    await ensureDbInitialized();

    // Find admin in MySQL
    console.log('Querying MySQL for admin...');
    const admins = await executeQuery(
      'SELECT id, name, email, password, role, permissions, is_active FROM admins WHERE email = ?',
      [email]
    );
    console.log('MySQL query result:', admins.length, 'admins found');
    
    console.log('Found admin:', admins.length > 0 ? 'Yes' : 'No');
    
    if (admins.length === 0) {
      console.log('Admin not found for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    const admin = admins[0];

    // Check if admin is active
    if (!admin.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    }, '8h'); // Admin tokens expire in 8 hours

    // Log admin login in MySQL
    const loginId = uuidv4();
    await executeQuery(`
      INSERT INTO admin_login_history (id, admin_id, login_time, ip_address, user_agent, success)
      VALUES (?, ?, NOW(), ?, ?, ?)
    `, [
      loginId,
      admin.id,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent'),
      true
    ]);

    // Update last login time
    await executeQuery(
      'UPDATE admins SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );

    res.json({
      status: 'success',
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
        },
        token
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Admin login failed'
    });
  }
});

// Admin Logout
router.post('/logout', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin logged out successfully'
  });
});

// Verify Admin Token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    
    // Ensure database is initialized
    await ensureDbInitialized();
    
    // Find admin in MySQL to ensure they still exist and are active
    const admins = await executeQuery(
      'SELECT id, name, email, role, permissions, is_active FROM admins WHERE id = ?',
      [decoded.id]
    );
    
    if (admins.length === 0 || !admins[0].is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Admin not found or inactive'
      });
    }

    const admin = admins[0];

    res.json({
      status: 'success',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
        }
      }
    });

  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
});

module.exports = router;
