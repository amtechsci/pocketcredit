#!/usr/bin/env node
/**
 * Whitelist a mobile number for OTP rate limits (daily cap + cooldown).
 *
 * Usage:
 *   node src/server/scripts/whitelistOtpMobile.js 8800899875
 *   node src/server/scripts/whitelistOtpMobile.js 8800899875 --remove
 */

require('dotenv').config();
const { initializeRedis, getRedisClient, closeConnection } = require('../config/redis');
const { mobileWhitelistKey, WHITELIST_MOBILES_SET } = require('../middleware/otpMobileWhitelist');

async function main() {
  const mobile = process.argv[2];
  const remove = process.argv.includes('--remove');

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    console.error('Usage: node whitelistOtpMobile.js <10-digit-mobile> [--remove]');
    process.exit(1);
  }

  await initializeRedis();
  const client = getRedisClient();
  if (!client) {
    console.error('Redis unavailable — check REDIS_HOST / REDIS_PORT in .env');
    process.exit(1);
  }

  if (remove) {
    await client.del(mobileWhitelistKey(mobile));
    await client.srem(WHITELIST_MOBILES_SET, mobile);
    console.log(`Removed ${mobile} from OTP mobile whitelist`);
  } else {
    const meta = JSON.stringify({
      mobile,
      whitelisted_at: new Date().toISOString(),
      whitelisted_by: 'script',
      note: 'manual whitelist'
    });
    await client.set(mobileWhitelistKey(mobile), meta);
    await client.sadd(WHITELIST_MOBILES_SET, mobile);

    // Clear existing throttle counters so OTP works immediately
    await client.del(
      `otp_daily:${mobile}`,
      `otp_cooldown:${mobile}`,
      `admin_otp_daily:${mobile}`,
      `admin_otp_cooldown:${mobile}`
    );

    console.log(`Whitelisted ${mobile} for OTP (daily limit + cooldown bypassed)`);
  }

  await closeConnection();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
