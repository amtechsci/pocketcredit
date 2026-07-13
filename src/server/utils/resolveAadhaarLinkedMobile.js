/**
 * Resolve Aadhaar-linked mobile for third-party fetch APIs (Experian, AA, UAN, etc.).
 * Does not fall back to primary phone unless explicitly allowed.
 */

function normalizeIndianMobile(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

function resolveAadhaarLinkedMobile(userRow, options = {}) {
  const { allowPrimaryFallback = false } = options;
  const aadhaarMobile = normalizeIndianMobile(userRow?.aadhar_linked_mobile);
  if (aadhaarMobile) return aadhaarMobile;
  if (allowPrimaryFallback) {
    return normalizeIndianMobile(userRow?.phone);
  }
  return null;
}

async function fetchAadhaarLinkedMobile(executeQuery, userId, options = {}) {
  const rows = await executeQuery(
    'SELECT aadhar_linked_mobile, phone FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!rows.length) return null;
  return resolveAadhaarLinkedMobile(rows[0], options);
}

module.exports = {
  normalizeIndianMobile,
  resolveAadhaarLinkedMobile,
  fetchAadhaarLinkedMobile
};
