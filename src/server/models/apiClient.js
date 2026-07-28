const bcrypt = require('bcrypt');
const { executeQuery, initializeDatabase } = require('../config/database');

const findApiClientByClientId = async (clientId) => {
  await initializeDatabase();
  const rows = await executeQuery(
    'SELECT * FROM api_clients WHERE client_id = ? AND is_active = 1',
    [clientId]
  );
  return rows?.[0] || null;
};

const findApiClientByUuid = async (clientUuid) => {
  await initializeDatabase();
  const rows = await executeQuery(
    'SELECT * FROM api_clients WHERE client_uuid = ? AND is_active = 1',
    [clientUuid]
  );
  return rows?.[0] || null;
};

const findApiClientById = async (id) => {
  await initializeDatabase();
  const rows = await executeQuery(
    `SELECT id, client_uuid, client_id, name, email, public_key_path, allowed_ips, is_active, created_at, updated_at
     FROM api_clients WHERE id = ?`,
    [id]
  );
  return rows?.[0] || null;
};

const findAllApiClients = async () => {
  await initializeDatabase();
  return executeQuery(
    `SELECT id, client_uuid, client_id, name, email, public_key_path, allowed_ips, is_active, created_at, updated_at
     FROM api_clients ORDER BY created_at DESC`
  );
};

const verifyApiClientCredentials = async (clientId, clientSecret) => {
  const client = await findApiClientByClientId(clientId);
  if (!client) return null;
  const isValid = await bcrypt.compare(clientSecret, client.client_secret);
  return isValid ? client : null;
};

const createApiClient = async (data) => {
  await initializeDatabase();
  const {
    client_uuid,
    client_id,
    client_secret,
    name,
    email = null,
    public_key_path = null,
    allowed_ips = null
  } = data;

  const hashedSecret = await bcrypt.hash(client_secret, 10);
  const result = await executeQuery(
    `INSERT INTO api_clients
     (client_uuid, client_id, client_secret, name, email, public_key_path, allowed_ips, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [client_uuid, client_id, hashedSecret, name, email, public_key_path, allowed_ips]
  );

  return {
    id: result.insertId,
    client_uuid,
    client_id,
    name,
    email,
    is_active: true
  };
};

const updateApiClient = async (id, updates) => {
  await initializeDatabase();
  const existing = await findApiClientById(id);
  if (!existing) return null;

  const allowed = ['name', 'email', 'public_key_path', 'allowed_ips', 'is_active', 'client_secret'];
  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key) || value === undefined) continue;
    if (key === 'client_secret' && value) {
      setClauses.push('client_secret = ?');
      values.push(await bcrypt.hash(value, 10));
    } else if (key !== 'client_secret') {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return existing;

  setClauses.push('updated_at = NOW()');
  values.push(id);
  await executeQuery(`UPDATE api_clients SET ${setClauses.join(', ')} WHERE id = ?`, values);
  return findApiClientById(id);
};

module.exports = {
  findApiClientByClientId,
  findApiClientByUuid,
  findApiClientById,
  findAllApiClients,
  verifyApiClientCredentials,
  createApiClient,
  updateApiClient
};
