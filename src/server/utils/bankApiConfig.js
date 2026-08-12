const JWT_FALLBACK = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';

/** Bank API JWT issuer secret: env only (not stored in user_config or api_clients). */
function getBankApiJwtSecret() {
  return (
    process.env.BANK_API_JWT_SECRET ||
    process.env.API_CLIENT_JWT_SECRET ||
    JWT_FALLBACK
  );
}

module.exports = {
  getBankApiJwtSecret
};
