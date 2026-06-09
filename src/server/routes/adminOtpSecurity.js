const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { getRedisClient } = require('../config/redis');
const { blockedKey, whitelistKey, BLOCKED_SET, WHITELIST_SET } = require('../middleware/otpIpGuard');

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

module.exports = router;
