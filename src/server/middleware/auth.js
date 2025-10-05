const jwt = require('jsonwebtoken');
const { executeQuery, initializeDatabase } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  });
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if admin exists in MySQL database
    const { executeQuery, initializeDatabase } = require('../config/database');
    await initializeDatabase();
    
    const admins = await executeQuery(
      'SELECT id, name, email, role, permissions, is_active FROM admins WHERE id = ?',
      [decoded.id]
    );
    
    if (admins.length === 0 || !admins[0].is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    const admin = admins[0];
    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
    };

    next();
  } catch (error) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired admin token'
    });
  }
};

// Role-based permission middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    const admin = req.admin;
    
    if (!admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Admin authentication required'
      });
    }

    // Super admin has all permissions
    if (admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has specific permission
    if (!admin.permissions.includes(permission)) {
      return res.status(403).json({
        status: 'error',
        message: `Permission '${permission}' required`
      });
    }

    next();
  };
};

// Generate JWT token
const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  requirePermission,
  generateToken,
  verifyToken
};