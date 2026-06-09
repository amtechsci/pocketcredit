const axios = require('axios');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

/**
 * reCAPTCHA v3 verification middleware.
 *
 * Reads `recaptcha_token` from req.body, verifies it with Google, and rejects
 * requests whose score falls below MIN_SCORE (default 0.5).
 *
 * Skip conditions (fail-open so development is not blocked):
 *   - RECAPTCHA_SECRET_KEY env var is not set
 *   - NODE_ENV !== 'production'  (optional override via RECAPTCHA_ENFORCE=true)
 *
 * Required env vars:
 *   RECAPTCHA_SECRET_KEY   – server-side secret from Google reCAPTCHA console
 *   RECAPTCHA_MIN_SCORE    – (optional) threshold, default 0.5
 *   RECAPTCHA_ENFORCE      – set to "true" to enforce in non-production envs
 */
async function recaptchaVerify(req, res, next) {
  const enforce =
    process.env.RECAPTCHA_ENFORCE === 'true' ||
    process.env.NODE_ENV === 'production';

  // Skip if not configured or not in an enforced environment
  if (!RECAPTCHA_SECRET || !enforce) {
    return next();
  }

  const token = req.body?.recaptcha_token;
  if (!token) {
    return res.status(400).json({
      status: 'error',
      message: 'reCAPTCHA verification required.'
    });
  }

  try {
    const { data } = await axios.post(
      RECAPTCHA_VERIFY_URL,
      new URLSearchParams({
        secret: RECAPTCHA_SECRET,
        response: token,
        remoteip: req.ip || ''
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
    );

    if (!data.success) {
      console.warn(`[reCAPTCHA] Verification failed for IP ${req.ip}:`, data['error-codes']);
      return res.status(403).json({
        status: 'error',
        message: 'reCAPTCHA verification failed. Please refresh and try again.'
      });
    }

    if (data.score < MIN_SCORE) {
      console.warn(`[reCAPTCHA] Low score ${data.score} for IP ${req.ip} — likely bot`);
      return res.status(403).json({
        status: 'error',
        message: 'Request blocked as suspicious activity. Please try again.'
      });
    }

    // Attach score for logging/debugging downstream
    req.recaptchaScore = data.score;
    next();
  } catch (err) {
    // Google API unreachable — fail-open to avoid blocking real users
    console.error('[reCAPTCHA] Verification API error (failing open):', err.message);
    next();
  }
}

module.exports = { recaptchaVerify };
