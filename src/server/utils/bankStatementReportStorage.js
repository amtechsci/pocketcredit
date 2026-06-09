const axios = require('axios');
const { retrieveBankStatementReport } = require('../services/digitapBankStatementService');

const ALLOWED_TABLES = new Set(['user_bank_statements', 'digitap_bank_statements']);

const ALLOWED_WHERE_COLUMNS = {
  user_bank_statements: new Set(['id', 'request_id', 'client_ref_num']),
  digitap_bank_statements: new Set(['id', 'client_ref_num'])
};

const ALLOWED_EXTRA_SET_COLUMNS = {
  user_bank_statements: new Set(['verification_status']),
  digitap_bank_statements: new Set([])
};

function validateSqlIdentifier(name, allowedSet, label) {
  if (!allowedSet.has(name)) {
    return { valid: false, error: `Invalid ${label}: ${name}` };
  }
  return { valid: true };
}

async function ensureReportXmlColumn(executeQuery, table) {
  const rows = await executeQuery(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'report_xml'`,
    [table]
  );
  if (Number(rows[0]?.c) === 0) {
    await executeQuery(
      `ALTER TABLE ${table} ADD COLUMN report_xml LONGTEXT NULL COMMENT 'Raw AA/FI XML from Digitap' AFTER report_data`
    );
    console.log(`✅ Added ${table}.report_xml column`);
  }
}

/** Ensure report_xml exists — always checks DB (no module-level cache). */
async function ensureReportXmlColumns(executeQuery, table = null) {
  const tables = table ? [table] : [...ALLOWED_TABLES];
  for (const t of tables) {
    await ensureReportXmlColumn(executeQuery, t);
  }
}

function serializeJsonReport(report) {
  return typeof report === 'string' ? report : JSON.stringify(report);
}

function parseReportObject(report) {
  if (!report) return null;
  if (typeof report === 'string') {
    try {
      return JSON.parse(report);
    } catch {
      return null;
    }
  }
  return report;
}

function mergeTransactionsFromSourceReport(report) {
  const source = report.source_report;
  if (!source || typeof source !== 'object' || !Array.isArray(report.banks)) {
    return;
  }

  const sourceBanks = Array.isArray(source.banks) ? source.banks : null;
  if (!sourceBanks) {
    return;
  }

  for (let i = 0; i < report.banks.length; i++) {
    const bank = report.banks[i];
    const sourceBank = sourceBanks[i] || sourceBanks[0];
    if (!bank?.accounts || !sourceBank?.accounts) continue;

    for (let j = 0; j < bank.accounts.length; j++) {
      const account = bank.accounts[j];
      const sourceAccount = sourceBank.accounts[j] || sourceBank.accounts[0];
      if (!account || !Array.isArray(sourceAccount?.transactions) || sourceAccount.transactions.length === 0) {
        continue;
      }
      if (!Array.isArray(account.transactions) || account.transactions.length === 0) {
        account.transactions = sourceAccount.transactions;
      }
    }
  }
}

/**
 * Digitap JSON often includes source_report as a pre-signed S3 URL (expires ~12h).
 * Fetch and inline it while the URL is still valid so report_data remains usable later.
 */
async function fetchAndInlineSourceReport(report) {
  const parsed = parseReportObject(report);
  if (!parsed) {
    return report;
  }

  const sourceReport = parsed.source_report;
  if (!sourceReport || typeof sourceReport !== 'string' || !/^https?:\/\//i.test(sourceReport.trim())) {
    return parsed;
  }

  const originalUrl = sourceReport.trim();

  try {
    const response = await axios.get(originalUrl, {
      timeout: 60000,
      responseType: 'json',
      maxContentLength: 50 * 1024 * 1024,
      validateStatus: (status) => status === 200
    });

    parsed.source_report_url = originalUrl;
    parsed.source_report_fetched_at = new Date().toISOString();
    parsed.source_report = response.data;
    mergeTransactionsFromSourceReport(parsed);

    const size = JSON.stringify(response.data).length;
    console.log(`✅ Inlined source_report from S3 (${size} chars)`);
  } catch (err) {
    console.warn('⚠️  Failed to fetch source_report URL (non-fatal):', err.message);
    parsed.source_report_fetch_error = err.message;
  }

  return parsed;
}

async function fetchDigitapJsonReport(clientRefNum, txnId) {
  return txnId
    ? await retrieveBankStatementReport(null, 'json', txnId)
    : await retrieveBankStatementReport(clientRefNum, 'json');
}

async function fetchDigitapXmlReport(clientRefNum, txnId) {
  try {
    const xmlResult = txnId
      ? await retrieveBankStatementReport(null, 'xml', txnId)
      : await retrieveBankStatementReport(clientRefNum, 'xml');

    if (xmlResult.success && xmlResult.data?.report) {
      const xml = xmlResult.data.report;
      return typeof xml === 'string' ? xml : String(xml);
    }

    console.log('⚠️  XML report not available:', xmlResult.error || 'empty response');
    return null;
  } catch (err) {
    console.warn('⚠️  XML report fetch failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Fetch JSON report from Digitap, optionally fetch XML, and persist both.
 */
async function fetchAndSaveBankStatementReports(options) {
  const {
    executeQuery,
    clientRefNum = null,
    txnId = null,
    table = 'user_bank_statements',
    whereColumn,
    whereValue,
    extraSet = {},
    fetchXml = true
  } = options;

  if (!whereColumn || whereValue === undefined || whereValue === null) {
    return { success: false, error: 'whereColumn and whereValue are required' };
  }

  if (!txnId && !clientRefNum) {
    return { success: false, error: 'Either txnId or clientRefNum is required' };
  }

  const tableCheck = validateSqlIdentifier(table, ALLOWED_TABLES, 'table');
  if (!tableCheck.valid) {
    return { success: false, error: tableCheck.error };
  }

  const whereCheck = validateSqlIdentifier(
    whereColumn,
    ALLOWED_WHERE_COLUMNS[table] || new Set(),
    'whereColumn'
  );
  if (!whereCheck.valid) {
    return { success: false, error: whereCheck.error };
  }

  const allowedExtra = ALLOWED_EXTRA_SET_COLUMNS[table] || new Set();
  for (const column of Object.keys(extraSet)) {
    const extraCheck = validateSqlIdentifier(column, allowedExtra, 'extraSet column');
    if (!extraCheck.valid) {
      return { success: false, error: extraCheck.error };
    }
  }

  await ensureReportXmlColumns(executeQuery, table);

  const jsonResult = await fetchDigitapJsonReport(clientRefNum, txnId);
  if (!jsonResult.success || !jsonResult.data?.report) {
    return { success: false, error: jsonResult.error || 'Failed to retrieve JSON report' };
  }

  const reportWithSource = await fetchAndInlineSourceReport(jsonResult.data.report);
  const reportJsonString = serializeJsonReport(reportWithSource);
  const reportXml = fetchXml ? await fetchDigitapXmlReport(clientRefNum, txnId) : null;

  const setParts = ['report_data = ?', 'report_xml = ?', "status = 'completed'", 'updated_at = NOW()'];
  const setValues = [reportJsonString, reportXml];

  for (const [column, value] of Object.entries(extraSet)) {
    setParts.push(`${column} = ?`);
    setValues.push(value);
  }

  await executeQuery(
    `UPDATE ${table} SET ${setParts.join(', ')} WHERE ${whereColumn} = ?`,
    [...setValues, whereValue]
  );

  console.log(
    `✅ Saved bank statement reports (${table}): JSON ${reportJsonString.length} chars` +
    (reportXml ? `, XML ${reportXml.length} chars` : ', no XML')
  );

  return {
    success: true,
    report: reportWithSource,
    reportXml,
    reportJsonString
  };
}

module.exports = {
  ensureReportXmlColumns,
  fetchAndSaveBankStatementReports,
  fetchAndInlineSourceReport,
  fetchDigitapXmlReport,
  serializeJsonReport
};
