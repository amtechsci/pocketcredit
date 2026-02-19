const jwt = require('jsonwebtoken');
const { executeQuery, initializeDatabase } = require('../config/database');
const { get, set, del } = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes in milliseconds
const WARNING_THRESHOLD = 58 * 60 * 1000; // 58 minutes in milliseconds

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

// Admin authentication middleware with inactivity tracking
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
      'SELECT id, name, email, role, sub_admin_category, permissions, is_active FROM admins WHERE id = ?',
      [decoded.id]
    );
    
    if (admins.length === 0 || !admins[0].is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    const admin = admins[0];
    const adminId = admin.id;
    
    // Check inactivity timeout using Redis
    // Note: Multiple devices can login simultaneously - each gets its own JWT token
    // The Redis activity key is shared but only tracks last activity, not session count
    const activityKey = `admin:activity:${adminId}`;
    const lastActivity = await get(activityKey);
    const now = Date.now();
    
    if (lastActivity) {
      const timeSinceLastActivity = now - parseInt(lastActivity, 10);
      
      // If inactive for more than INACTIVITY_TIMEOUT, reject the request
      if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
        // Clear the activity record
        await del(activityKey);
        
        return res.status(401).json({
          status: 'error',
          message: 'Session expired due to inactivity. Please login again.',
          code: 'SESSION_EXPIRED'
        });
      }
      
      // Check if we should send a warning close to inactivity timeout
      const timeUntilExpiry = INACTIVITY_TIMEOUT - timeSinceLastActivity;
      if (timeSinceLastActivity > WARNING_THRESHOLD && timeUntilExpiry > 0) {
        // Add warning header to response
        res.setHeader('X-Session-Warning', 'true');
        res.setHeader('X-Session-Time-Remaining', Math.ceil(timeUntilExpiry / 1000).toString()); // seconds
      }
    }
    // If lastActivity doesn't exist (new login, Redis cleared, etc.), 
    // still allow the request if JWT token is valid (checked above)
    // This allows multiple simultaneous logins from different devices
    
    // Update last activity timestamp (extend TTL to 60 minutes)
    // This is safe to do even if another device just updated it - 
    // it just means this device is active now
    await set(activityKey, now.toString(), 60 * 60); // 60 minutes TTL in seconds
    
    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      sub_admin_category: admin.sub_admin_category || null,
      permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
    };

    next();
  } catch (error) {
    // Handle JWT errors specifically
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid or expired admin token'
      });
    }
    
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