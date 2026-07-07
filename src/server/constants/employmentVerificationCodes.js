/**
 * UAN API response code mapping — update here when Digitap contract is confirmed.
 */
const UAN_SUCCESS = 101;
const UAN_NOT_FOUND_CODES = [102, 103];
const UAN_SOURCE_UNAVAILABLE_PHRASES = ['source unavailable', 'not found'];

const BLOCKED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com'
];

function shouldShowManualEmploymentFlow(resultCode, message) {
  const msg = String(message || '').toLowerCase();
  if (UAN_NOT_FOUND_CODES.includes(Number(resultCode))) {
    return true;
  }
  return UAN_SOURCE_UNAVAILABLE_PHRASES.some((phrase) => msg.includes(phrase));
}

function isUANSuccess(resultCode) {
  return Number(resultCode) === UAN_SUCCESS;
}

function isBlockedEmailDomain(email) {
  if (!email || typeof email !== 'string') return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  return BLOCKED_EMAIL_DOMAINS.includes(parts[1]);
}

/** Shown when UAN-by-number API returns 102/103 or source unavailable / not found */
const UAN_USER_ENTRY_ERROR_MESSAGE =
  'Enter your valid UAN number or enter your company mail id in the above step to proceed';

function isUANUserEntryFailure(resultCode, message) {
  const msg = String(message || '').toLowerCase();
  if (UAN_NOT_FOUND_CODES.includes(Number(resultCode))) {
    return true;
  }
  return UAN_SOURCE_UNAVAILABLE_PHRASES.some((phrase) => msg.includes(phrase));
}

module.exports = {
  UAN_SUCCESS,
  UAN_NOT_FOUND_CODES,
  UAN_SOURCE_UNAVAILABLE_PHRASES,
  UAN_USER_ENTRY_ERROR_MESSAGE,
  BLOCKED_EMAIL_DOMAINS,
  shouldShowManualEmploymentFlow,
  isUANSuccess,
  isUANUserEntryFailure,
  isBlockedEmailDomain
};
