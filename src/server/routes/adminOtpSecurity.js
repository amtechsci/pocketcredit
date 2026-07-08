const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { getRedisClient } = require('../config/redis');
const { blockedKey, whitelistKey, BLOCKED_SET, WHITELIST_SET } = require('../middleware/otpIpGuard');
const { mobileWhitelistKey, WHITELIST_MOBILES_SET } = require('../middleware/otpMobileWhitelist');

const router = express.Router();
router.use(authenticateAdmin);

// ── helpers ──────────────────────────────────────────────────────────────────

function parseOrRaw(str) {
  try { return JSON.parse(str); } catch { return { raw: str }; }
}

async function getSetMembers(client, setKey) {
  try {
    return await client.smembers(setKey);
  } catch {
    return [];
  }
}

// ── GET /api/admin/otp-security/blocked-ips ──────────────────────────────────
// List every permanently blocked IP with its metadata.
router.get('/blocked-ips', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  try {
    const ips = await getSetMembers(client, BLOCKED_SET);

    const results = await Promise.all(
      ips.map(async (ip) => {
        const raw = await client.get(blockedKey(ip));
        return raw ? { ...parseOrRaw(raw), ip } : null;
      })
    );

    res.json({
      status: 'success',
      count: results.filter(Boolean).length,
      data: results.filter(Boolean).sort((a, b) =>
        new Date(b.blocked_at || 0) - new Date(a.blocked_at || 0)
      )
    });
  } catch (err) {
    console.error('List blocked IPs error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch blocked IPs' });
  }
});

// ── POST /api/admin/otp-security/unblock ─────────────────────────────────────
// Unblock one or more IPs.  Body: { ip: "1.2.3.4" }  or  { ips: ["1.2.3.4", ...] }
router.post('/unblock', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  const targets = req.body.ips
    ? req.body.ips
    : req.body.ip
    ? [req.body.ip]
    : [];

  if (targets.length === 0) {
    return res.status(400).json({ status: 'error', message: '`ip` or `ips` is required' });
  }

  try {
    await Promise.all(
      targets.map(async (ip) => {
        await client.del(blockedKey(ip));
        await client.srem(BLOCKED_SET, ip);
      })
    );

    const admin = req.admin || req.user || {};
    console.log(`✅ [OTP Guard] IPs unblocked by admin ${admin.email || admin.id}: ${targets.join(', ')}`);

    res.json({
      status: 'success',
      message: `${targets.length} IP${targets.length !== 1 ? 's' : ''} unblocked`,
      unblocked: targets
    });
  } catch (err) {
    console.error('Unblock IP error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to unblock IPs' });
  }
});

// ── GET /api/admin/otp-security/whitelisted-ips ──────────────────────────────
// List every whitelisted IP.
router.get('/whitelisted-ips', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  try {
    const ips = await getSetMembers(client, WHITELIST_SET);

    const results = await Promise.all(
      ips.map(async (ip) => {
        const raw = await client.get(whitelistKey(ip));
        return raw ? { ...parseOrRaw(raw), ip } : { ip };
      })
    );

    res.json({
      status: 'success',
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('List whitelisted IPs error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch whitelisted IPs' });
  }
});

// ── POST /api/admin/otp-security/whitelist ───────────────────────────────────
// Whitelist an IP so it is never blocked.  Body: { ip: "1.2.3.4", note: "office" }
router.post('/whitelist', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  const { ip, note } = req.body;
  if (!ip) {
    return res.status(400).json({ status: 'error', message: '`ip` is required' });
  }

  try {
    const admin = req.admin || req.user || {};
    const meta = JSON.stringify({
      ip,
      whitelisted_at: new Date().toISOString(),
      whitelisted_by: admin.email || admin.id || 'unknown',
      note: note || ''
    });

    await client.set(whitelistKey(ip), meta);   // no TTL = permanent
    await client.sadd(WHITELIST_SET, ip);

    // If it was previously blocked, remove the block
    const wasBlocked = await client.exists(blockedKey(ip));
    if (wasBlocked) {
      await client.del(blockedKey(ip));
      await client.srem(BLOCKED_SET, ip);
    }

    console.log(`✅ [OTP Guard] IP whitelisted by admin ${admin.email || admin.id}: ${ip}`);

    res.json({
      status: 'success',
      message: `IP ${ip} whitelisted${wasBlocked ? ' and removed from block list' : ''}`,
      data: { ip, note: note || '' }
    });
  } catch (err) {
    console.error('Whitelist IP error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to whitelist IP' });
  }
});

// ── DELETE /api/admin/otp-security/whitelist ─────────────────────────────────
// Remove an IP from the whitelist.  Body: { ip: "1.2.3.4" }
router.delete('/whitelist', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  const ip = req.body.ip || req.query.ip;
  if (!ip) {
    return res.status(400).json({ status: 'error', message: '`ip` is required' });
  }

  try {
    await client.del(whitelistKey(ip));
    await client.srem(WHITELIST_SET, ip);

    const admin = req.admin || req.user || {};
    console.log(`✅ [OTP Guard] IP removed from whitelist by admin ${admin.email || admin.id}: ${ip}`);

    res.json({
      status: 'success',
      message: `IP ${ip} removed from whitelist`
    });
  } catch (err) {
    console.error('Remove whitelist IP error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to remove IP from whitelist' });
  }
});

// ── GET /api/admin/otp-security/whitelisted-mobiles ────────────────────────
router.get('/whitelisted-mobiles', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  try {
    const mobiles = await getSetMembers(client, WHITELIST_MOBILES_SET);

    const results = await Promise.all(
      mobiles.map(async (mobile) => {
        const raw = await client.get(mobileWhitelistKey(mobile));
        return raw ? { ...parseOrRaw(raw), mobile } : { mobile };
      })
    );

    res.json({
      status: 'success',
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('List whitelisted mobiles error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch whitelisted mobiles' });
  }
});

// ── POST /api/admin/otp-security/whitelist-mobile ──────────────────────────
// Whitelist a mobile so it bypasses OTP daily/cooldown limits. Body: { mobile: "9876543210", note: "test" }
router.post('/whitelist-mobile', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  const { mobile, note } = req.body;
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ status: 'error', message: 'Valid 10-digit `mobile` is required' });
  }

  try {
    const admin = req.admin || req.user || {};
    const meta = JSON.stringify({
      mobile,
      whitelisted_at: new Date().toISOString(),
      whitelisted_by: admin.email || admin.id || 'unknown',
      note: note || ''
    });

    await client.set(mobileWhitelistKey(mobile), meta);
    await client.sadd(WHITELIST_MOBILES_SET, mobile);

    await client.del(
      `otp_daily:${mobile}`,
      `otp_cooldown:${mobile}`,
      `admin_otp_daily:${mobile}`,
      `admin_otp_cooldown:${mobile}`
    );

    console.log(`✅ [OTP Guard] Mobile whitelisted by admin ${admin.email || admin.id}: ${mobile}`);

    res.json({
      status: 'success',
      message: `Mobile ${mobile} whitelisted for OTP`,
      data: { mobile, note: note || '' }
    });
  } catch (err) {
    console.error('Whitelist mobile error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to whitelist mobile' });
  }
});

// ── DELETE /api/admin/otp-security/whitelist-mobile ────────────────────────
router.delete('/whitelist-mobile', async (req, res) => {
  const client = getRedisClient();
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Redis unavailable' });
  }

  const mobile = req.body.mobile || req.query.mobile;
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ status: 'error', message: 'Valid 10-digit `mobile` is required' });
  }

  try {
    await client.del(mobileWhitelistKey(mobile));
    await client.srem(WHITELIST_MOBILES_SET, mobile);

    const admin = req.admin || req.user || {};
    console.log(`✅ [OTP Guard] Mobile removed from whitelist by admin ${admin.email || admin.id}: ${mobile}`);

    res.json({
      status: 'success',
      message: `Mobile ${mobile} removed from OTP whitelist`
    });
  } catch (err) {
    console.error('Remove whitelist mobile error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to remove mobile from whitelist' });
  }
});

module.exports = router;
