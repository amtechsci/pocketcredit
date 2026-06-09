const crypto = require('crypto');

/**
 * Secret used for internal server-to-server calls (e.g. PDF generation hitting /api/kfs/:id).
 * Set INTERNAL_API_SECRET in env for a stable value; otherwise a random token is generated
 * each process start so external callers can never guess it.
 */
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || crypto.randomBytes(32).toString('hex');

module.exports = { INTERNAL_API_SECRET };
