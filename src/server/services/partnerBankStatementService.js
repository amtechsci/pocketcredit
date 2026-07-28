const crypto = require('crypto');
const axios = require('axios');
const { executeQuery } = require('../config/database');
const {
  generateBankStatementURL,
  generatePartnerClientRefNum,
  getBankDataCallbackUrls,
  checkBankStatementStatus
} = require('./digitapBankStatementService');
const { fetchAndSaveBankStatementReports } = require('../utils/bankStatementReportStorage');
const { findPartnerById } = require('../models/partner');

const PARTNER_TABLE = 'partner_bank_statement_requests';
const VALID_DESTINATIONS = new Set(['accountaggregator', 'netbanking', 'statementupload']);
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const COMPLETED_STATUSES = new Set(['completed', 'ReportGenerated']);

function formatDateYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCompletedStatus(status) {
  if (!status) return false;
  return COMPLETED_STATUSES.has(String(status));
}

function isActivePendingRow(row) {
  if (!row || !row.digitap_url) return false;
  if (isCompletedStatus(row.status)) return false;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
  return true;
}

async function findPartnerRequest(partnerId, { requestId, partnerRef }) {
  if (requestId) {
    const rows = await executeQuery(
      `SELECT * FROM ${PARTNER_TABLE} WHERE partner_id = ? AND request_id = ? LIMIT 1`,
      [partnerId, requestId]
    );
    return rows[0] || null;
  }
  if (partnerRef) {
    const rows = await executeQuery(
      `SELECT * FROM ${PARTNER_TABLE} WHERE partner_id = ? AND partner_ref = ? LIMIT 1`,
      [partnerId, partnerRef]
    );
    return rows[0] || null;
  }
  return null;
}

function buildInitiateResponseData(row) {
  return {
    redirect_url: row.digitap_url,
    request_id: row.request_id,
    client_ref_num: row.client_ref_num,
    partner_ref: row.partner_ref,
    expires_at: row.expires_at,
    status: row.status
  };
}

/**
 * Initiate or return idempotent partner bank-statement / AA session.
 */
async function initiateForPartner(partner, payload) {
  const partnerRef = String(payload.partner_ref || '').trim();
  const mobileNumber = String(payload.mobile_number || '').trim();
  const returnUrl = String(payload.return_url || '').trim();
  const callbackUrl = payload.callback_url ? String(payload.callback_url).trim() : null;
  const destination = payload.destination || 'accountaggregator';
  const bankName = payload.bank_name ? String(payload.bank_name).trim() : null;

  if (!partnerRef) {
    return { ok: false, status: 400, code: 2003, message: 'partner_ref is required' };
  }
  if (!returnUrl) {
    return { ok: false, status: 400, code: 2003, message: 'return_url is required' };
  }
  if (!MOBILE_REGEX.test(mobileNumber)) {
    return { ok: false, status: 400, code: 2003, message: 'Invalid mobile_number format' };
  }
  if (!VALID_DESTINATIONS.has(destination)) {
    return {
      ok: false,
      status: 400,
      code: 2003,
      message: 'Invalid destination. Must be: accountaggregator, netbanking, or statementupload'
    };
  }

  const existing = await findPartnerRequest(partner.id, { partnerRef });
  if (existing) {
    if (isCompletedStatus(existing.status)) {
      return {
        ok: true,
        status: 200,
        code: 2000,
        message: 'Request already completed',
        data: buildInitiateResponseData(existing)
      };
    }
    if (isActivePendingRow(existing)) {
      return {
        ok: true,
        status: 200,
        code: 2000,
        message: 'Existing session returned',
        data: buildInitiateResponseData(existing)
      };
    }
  }

  const clientRefNum = generatePartnerClientRefNum(partner.id);
  const { webhookUrl } = getBankDataCallbackUrls();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  const digitapResult = await generateBankStatementURL({
    client_ref_num: clientRefNum,
    return_url: returnUrl,
    txn_completed_cburl: webhookUrl,
    mobile_num: mobileNumber,
    start_date: formatDateYmd(startDate),
    end_date: formatDateYmd(endDate),
    destination
  });

  if (!digitapResult.success) {
    return {
      ok: false,
      status: 503,
      code: 5001,
      message: digitapResult.error || 'Failed to initiate bank statement collection'
    };
  }

  const expiryTime = digitapResult.data.expiry_time || digitapResult.data.expires;
  const expiresAt = expiryTime ? new Date(expiryTime) : null;
  const requestId = digitapResult.data.request_id;

  if (existing) {
    await executeQuery(
      `UPDATE ${PARTNER_TABLE}
       SET client_ref_num = ?, request_id = ?, mobile_number = ?, bank_name = ?,
           destination = ?, return_url = ?, callback_url = ?, digitap_url = ?,
           expires_at = ?, status = 'pending', updated_at = NOW()
       WHERE id = ? AND partner_id = ?`,
      [
        clientRefNum,
        requestId,
        mobileNumber,
        bankName,
        destination,
        returnUrl,
        callbackUrl,
        digitapResult.data.url,
        expiresAt,
        existing.id,
        partner.id
      ]
    );
    const updated = await findPartnerRequest(partner.id, { partnerRef });
    return {
      ok: true,
      status: 200,
      code: 2000,
      message: 'Bank statement collection initiated successfully',
      data: buildInitiateResponseData(updated)
    };
  }

  await executeQuery(
    `INSERT INTO ${PARTNER_TABLE}
     (partner_id, partner_ref, client_ref_num, request_id, mobile_number, bank_name,
      destination, return_url, callback_url, digitap_url, expires_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [
      partner.id,
      partnerRef,
      clientRefNum,
      requestId,
      mobileNumber,
      bankName,
      destination,
      returnUrl,
      callbackUrl,
      digitapResult.data.url,
      expiresAt
    ]
  );

  const row = await findPartnerRequest(partner.id, { partnerRef });
  return {
    ok: true,
    status: 200,
    code: 2000,
    message: 'Bank statement collection initiated successfully',
    data: buildInitiateResponseData(row)
  };
}

async function refreshPartnerStatusFromDigitap(row) {
  if (!row.request_id) return row;
  const pendingLike = ['pending', 'processing', 'InProgress'].includes(String(row.status));
  if (!pendingLike) return row;

  const digitapStatus = await checkBankStatementStatus(row.request_id);
  if (digitapStatus.success && digitapStatus.data) {
    const newStatus =
      digitapStatus.data.overall_status ||
      digitapStatus.data.status ||
      row.status;
    await executeQuery(
      `UPDATE ${PARTNER_TABLE} SET status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, row.id]
    );
    row.status = newStatus;
  }
  return row;
}

async function getStatusForPartner(partner, { requestId, partnerRef }) {
  if (!requestId && !partnerRef) {
    return { ok: false, status: 400, code: 2003, message: 'Provide request_id or partner_ref' };
  }
  if (requestId && partnerRef) {
    return { ok: false, status: 400, code: 2003, message: 'Provide only one of request_id or partner_ref' };
  }

  let row = await findPartnerRequest(partner.id, {
    requestId: requestId ? Number(requestId) : undefined,
    partnerRef
  });

  if (!row) {
    return { ok: false, status: 404, code: 4040, message: 'Request not found' };
  }

  row = await refreshPartnerStatusFromDigitap(row);

  const hasReport = !!(row.report_data && String(row.report_data).length > 0);

  return {
    ok: true,
    status: 200,
    code: 2000,
    message: 'Success',
    data: {
      partner_ref: row.partner_ref,
      request_id: row.request_id,
      client_ref_num: row.client_ref_num,
      status: row.status,
      has_report: hasReport || isCompletedStatus(row.status),
      destination: row.destination,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  };
}

function parseReportJson(reportData) {
  if (!reportData) return null;
  if (typeof reportData === 'object') return reportData;
  try {
    return JSON.parse(reportData);
  } catch {
    return null;
  }
}

async function getReportForPartner(partner, { requestId, partnerRef, includeXml }) {
  const statusResult = await getStatusForPartner(partner, { requestId, partnerRef });
  if (!statusResult.ok) return statusResult;

  let row = await findPartnerRequest(partner.id, {
    requestId: requestId ? Number(requestId) : undefined,
    partnerRef
  });

  if (!row) {
    return { ok: false, status: 404, code: 4040, message: 'Request not found' };
  }

  if (!isCompletedStatus(row.status) && !row.report_data) {
    return {
      ok: false,
      status: 409,
      code: 4090,
      message: 'Report is not ready yet',
      data: { status: row.status }
    };
  }

  if (!row.report_data && row.request_id) {
    const saveResult = await fetchAndSaveBankStatementReports({
      executeQuery,
      clientRefNum: row.txn_id ? null : row.client_ref_num,
      txnId: row.txn_id || null,
      table: PARTNER_TABLE,
      whereColumn: 'id',
      whereValue: row.id
    });

    if (!saveResult.success) {
      return {
        ok: false,
        status: 409,
        code: 4090,
        message: saveResult.error || 'Report is still processing',
        data: { status: row.status }
      };
    }

    row = await findPartnerRequest(partner.id, {
      requestId: row.request_id,
      partnerRef: row.partner_ref
    });
  }

  const report = parseReportJson(row.report_data);
  const data = {
    partner_ref: row.partner_ref,
    request_id: row.request_id,
    client_ref_num: row.client_ref_num,
    status: row.status,
    report
  };

  if (includeXml && row.report_xml) {
    data.report_xml = row.report_xml;
  }

  return {
    ok: true,
    status: 200,
    code: 2000,
    message: 'Success',
    data
  };
}

/**
 * Notify CompA callback URL (non-blocking caller should .catch).
 * X-Pocket-Signature: sha256=<hmac hex of JSON body using PARTNER_JWT_SECRET:partner_uuid>
 */
async function notifyPartnerCallback(partnerId, requestRow, event, status) {
  if (!requestRow.callback_url) return;

  const partner = await findPartnerById(partnerId);
  if (!partner) return;

  const payload = {
    event,
    partner_ref: requestRow.partner_ref,
    request_id: requestRow.request_id,
    client_ref_num: requestRow.client_ref_num,
    status
  };

  const body = JSON.stringify(payload);
  const jwtSecret = process.env.PARTNER_JWT_SECRET || process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
  const signature = crypto
    .createHmac('sha256', `${jwtSecret}:${partner.partner_uuid}`)
    .update(body)
    .digest('hex');

  await axios.post(requestRow.callback_url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Pocket-Signature': `sha256=${signature}`
    },
    timeout: 10000,
    validateStatus: () => true
  });
}

module.exports = {
  PARTNER_TABLE,
  findPartnerRequest,
  initiateForPartner,
  getStatusForPartner,
  getReportForPartner,
  notifyPartnerCallback,
  isCompletedStatus
};
