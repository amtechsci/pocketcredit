/**
 * CreditLab Pocket S3 Bridge — HTTP client for pocket/ storage via CreditLab API.
 * Pocket does not need AWS credentials when this service is configured.
 *
 * @see CREDITLAB_POCKET_API_BASE_URL, CREDITLAB_POCKET_API_TOKEN
 */

const BASE_URL = (
  process.env.CREDITLAB_POCKET_API_BASE_URL || 'https://creditlab.in/api/pocket/'
).replace(/\/?$/, '/');

const TOKEN = process.env.CREDITLAB_POCKET_API_TOKEN;

const MIN_PRESIGN_EXPIRES = 60;
const MAX_PRESIGN_EXPIRES = 604800; // 7 days

function isCreditLabStorageEnabled() {
  return Boolean(TOKEN);
}

/**
 * Normalize a storage key for API calls. Keys are relative to pocket/.
 * Strips leading slash and legacy pocket/ prefix from older DB records.
 */
function normalizeStorageKey(key) {
  if (!key) {
    throw new Error('Storage key is required');
  }

  let normalized = String(key).trim();
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('pocket/')) {
    normalized = normalized.slice('pocket/'.length);
  }
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid storage key');
  }

  return normalized;
}

function clampPresignExpires(expiresIn) {
  const value = Number(expiresIn) || 3600;
  return Math.min(MAX_PRESIGN_EXPIRES, Math.max(MIN_PRESIGN_EXPIRES, value));
}

function getAuthHeaders(extraHeaders = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    ...extraHeaders,
  };
}

function buildActionUrl(action, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('action', action);
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(name, String(value));
    }
  }
  return url;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from CreditLab storage API (${response.status})`);
  }

  if (!response.ok || data.ok === false) {
    const message = data.error || `CreditLab storage API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function presign(key, expiresIn = 3600) {
  const normalizedKey = normalizeStorageKey(key);
  const url = buildActionUrl('presign', {
    key: normalizedKey,
    expires: clampPresignExpires(expiresIn),
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data.url;
}

async function upload(fileBuffer, key, mimeType, originalFileName) {
  const normalizedKey = normalizeStorageKey(key);
  const url = buildActionUrl('upload', { key: normalizedKey });
  const formData = new FormData();
  const blob = new Blob([fileBuffer], {
    type: mimeType || 'application/octet-stream',
  });
  formData.append(
    'file',
    blob,
    originalFileName || normalizedKey.split('/').pop() || 'file'
  );

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await parseJsonResponse(response);
  return {
    success: true,
    key: data.key,
    s3_key: data.s3_key,
  };
}

async function download(key) {
  const url = await presign(key);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function deleteFile(key) {
  const normalizedKey = normalizeStorageKey(key);
  const url = buildActionUrl('delete', { key: normalizedKey });

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  await parseJsonResponse(response);
  return { success: true, message: 'File deleted successfully' };
}

async function list(prefix = '') {
  const normalizedPrefix = prefix ? normalizeStorageKey(prefix) : '';
  const url = buildActionUrl('list', normalizedPrefix ? { prefix: normalizedPrefix } : {});

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return parseJsonResponse(response);
}

function validateCreditLabStorageConfig() {
  if (!TOKEN) {
    console.warn('⚠️  Missing CreditLab storage configuration: CREDITLAB_POCKET_API_TOKEN');
    return false;
  }

  console.log('✅ CreditLab Pocket storage configuration is valid');
  return true;
}

module.exports = {
  isCreditLabStorageEnabled,
  normalizeStorageKey,
  presign,
  upload,
  download,
  deleteFile,
  list,
  validateCreditLabStorageConfig,
};
