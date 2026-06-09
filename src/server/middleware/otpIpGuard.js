const { getRedisClient } = require('../config/redis');

const WINDOW_SECONDS = 10 * 60;  // 10-minute sliding window
const MAX_REQUESTS   = 10;        // requests allowed before auto-block

// Redis key helpers
const blockedKey    = (ip) => `otp_ip_blocked:${ip}`;
const whitelistKey  = (ip) => `otp_ip_whitelist:${ip}`;
const countKey      = (ip) => `otp_ip_count:${ip}`;
const BLOCKED_SET   = 'otp_blocked_ips';
const WHITELIST_SET = 'otp_whitelisted_ips';

/**
 * Redis-based OTP IP guard.
 *
 * - Whitelisted IPs always pass through (no throttle).
 * - Blocked IPs are rejected permanently until an admin unblocks them.
 * - On the 11th request in any 10-minute window the IP is auto-blocked permanently.
 *
 * Admin management: see routes/adminOtpSecurity.js
 */
async function otpIpGuard(req, res, next) {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return next(); // fail-open if Redis unavailable
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  try {
    // 1. Whitelisted IPs skip all checks
    const whitelisted = await redisClient.get(whitelistKey(ip));
    if (whitelisted) {
      return next();
    }

    // 2. Check permanent block
    const blockData = await redisClient.get(blockedKey(ip));
    if (blockData) {
      return res.status(429).json({
        status: 'error',
        message: 'Your IP has been blocked due to repeated OTP abuse. Please contact support.'
      });
    }

    // 3. Increment request counter in the sliding window
    const count = await redisClient.incr(countKey(ip));
    if (count === 1) {
      await redisClient.expire(countKey(ip), WINDOW_SECONDS);
    }

    // 4. Auto-block permanently on threshold breach
    if (count > MAX_REQUESTS) {
      const meta = JSON.stringify({
        ip,
        blocked_at: new Date().toISOString(),
        request_count: count,
        reason: 'auto — exceeded 10 OTP requests in 10 minutes'
      });
      await redisClient.set(blockedKey(ip), meta);       // no TTL = permanent
      await redisClient.sadd(BLOCKED_SET, ip);
      await redisClient.del(countKey(ip));

      console.warn(`🚫 [OTP Guard] IP permanently blocked: ${ip} (${count} req / 10 min)`);

      return res.status(429).json({
        status: 'error',
        message: 'Too many OTP requests. Your IP has been permanently blocked. Contact support to unblock.'
      });
    }
  } catch (err) {
    console.error('otpIpGuard Redis error (failing open):', err.message);
  }

  next();
}

module.exports = { otpIpGuard, blockedKey, whitelistKey, BLOCKED_SET, WHITELIST_SET };
