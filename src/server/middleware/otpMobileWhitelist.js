const { getRedisClient } = require('../config/redis');

const mobileWhitelistKey = (mobile) => `otp_mobile_whitelist:${mobile}`;
const WHITELIST_MOBILES_SET = 'otp_whitelisted_mobiles';

async function isMobileWhitelisted(mobile) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const entry = await client.get(mobileWhitelistKey(mobile));
    return !!entry;
  } catch (err) {
    console.error('otpMobileWhitelist check error:', err.message);
    return false;
  }
}

module.exports = { mobileWhitelistKey, WHITELIST_MOBILES_SET, isMobileWhitelisted };
