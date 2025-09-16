/**
 * Session-based authentication middleware
 * Checks if user is authenticated via session
 */

const requireAuth = (req, res, next) => {
  // Check if user has a valid session
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authenticated. Please login first.'
    });
  }

  // User is authenticated, proceed to next middleware
  next();
};

module.exports = {
  requireAuth
};
