/**
 * Utility functions to parse login data from request
 */

/**
 * Parse user agent string to extract browser and device info
 * @param {string} userAgent - User agent string from request
 * @returns {Object} Parsed browser and device information
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser_name: 'Unknown',
      browser_version: null,
      device_type: 'unknown',
      os_name: 'Unknown',
      os_version: null
    };
  }

  const ua = userAgent.toLowerCase();
  let browser_name = 'Unknown';
  let browser_version = null;
  let device_type = 'desktop';
  let os_name = 'Unknown';
  let os_version = null;

  // Detect browser
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser_name = 'Chrome';
    const match = ua.match(/chrome\/([\d.]+)/);
    browser_version = match ? match[1] : null;
  } else if (ua.includes('firefox')) {
    browser_name = 'Firefox';
    const match = ua.match(/firefox\/([\d.]+)/);
    browser_version = match ? match[1] : null;
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser_name = 'Safari';
    const match = ua.match(/version\/([\d.]+)/);
    browser_version = match ? match[1] : null;
  } else if (ua.includes('edg')) {
    browser_name = 'Edge';
    const match = ua.match(/edg\/([\d.]+)/);
    browser_version = match ? match[1] : null;
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser_name = 'Opera';
    const match = ua.match(/(?:opera|opr)\/([\d.]+)/);
    browser_version = match ? match[1] : null;
  }

  // Detect device type
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device_type = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'tablet';
  }

  // Detect OS
  if (ua.includes('windows')) {
    os_name = 'Windows';
    const match = ua.match(/windows nt ([\d.]+)/);
    if (match) {
      const version = match[1];
      if (version === '10.0') os_version = '10';
      else if (version === '6.3') os_version = '8.1';
      else if (version === '6.2') os_version = '8';
      else if (version === '6.1') os_version = '7';
      else os_version = version;
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os_name = 'macOS';
    const match = ua.match(/mac os x ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : null;
  } else if (ua.includes('android')) {
    os_name = 'Android';
    const match = ua.match(/android ([\d.]+)/);
    os_version = match ? match[1] : null;
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os_name = 'iOS';
    const match = ua.match(/os ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : null;
  } else if (ua.includes('linux')) {
    os_name = 'Linux';
  }

  return {
    browser_name,
    browser_version,
    device_type,
    os_name,
    os_version
  };
}

/**
 * Get IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getIpAddress(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         'Unknown';
}

/**
 * Get location from IP (basic implementation - can be enhanced with IP geolocation service)
 * For now, returns null values. Can integrate with services like ipapi.co, ip-api.com, etc.
 * @param {string} ip - IP address
 * @returns {Promise<Object>} Location information
 */
async function getLocationFromIp(ip) {
  // Skip private/local IPs
  if (!ip || ip === 'Unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
    return {
      location_country: null,
      location_city: null,
      location_region: null,
      latitude: null,
      longitude: null
    };
  }

  // For production, integrate with IP geolocation service
  // Example: ipapi.co, ip-api.com, maxmind, etc.
  // For now, return null - can be enhanced later
  try {
    // Optional: Add IP geolocation service integration here
    // const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    // return {
    //   location_country: response.data.country_name,
    //   location_city: response.data.city,
    //   location_region: response.data.region,
    //   latitude: response.data.latitude,
    //   longitude: response.data.longitude
    // };
  } catch (error) {
    console.error('Error getting location from IP:', error);
  }

  return {
    location_country: null,
    location_city: null,
    location_region: null,
    latitude: null,
    longitude: null
  };
}

/**
 * Extract login data from request
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Login data object
 */
async function extractLoginData(req) {
  const ipAddress = getIpAddress(req);
  const userAgent = req.get('User-Agent') || '';
  const parsedUA = parseUserAgent(userAgent);
  const location = await getLocationFromIp(ipAddress);

  return {
    ip_address: ipAddress,
    user_agent: userAgent,
    ...parsedUA,
    ...location
  };
}

module.exports = {
  parseUserAgent,
  getIpAddress,
  getLocationFromIp,
  extractLoginData
};

