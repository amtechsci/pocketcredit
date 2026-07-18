const { executeQuery } = require('../config/database');
const { getUANBasic, getUANByNumber, generateUANClientRefNum } = require('./digitapService');
const {
  shouldShowManualEmploymentFlow,
  isUANSuccess,
  isUANUserEntryFailure,
  UAN_USER_ENTRY_ERROR_MESSAGE
} = require('../constants/employmentVerificationCodes');

async function resolveLoanApplicationId(userId, applicationId) {
  if (applicationId) {
    const rows = await executeQuery(
      'SELECT id FROM loan_applications WHERE id = ? AND user_id = ? LIMIT 1',
      [applicationId, userId]
    );
    if (rows.length > 0) return rows[0].id;
  }

  const active = await executeQuery(
    `SELECT id FROM loan_applications
     WHERE user_id = ?
       AND status NOT IN ('rejected', 'cancelled', 'cleared')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return active[0]?.id || null;
}

async function getLatestRecord(userId, loanApplicationId) {
  if (loanApplicationId) {
    const rows = await executeQuery(
      `SELECT * FROM employment_verification_records
       WHERE user_id = ? AND loan_application_id = ?
       ORDER BY id DESC LIMIT 1`,
      [userId, loanApplicationId]
    );
    if (rows.length > 0) return rows[0];
  }

  const rows = await executeQuery(
    `SELECT * FROM employment_verification_records
     WHERE user_id = ?
     ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getOrCreateRecord(userId, loanApplicationId) {
  const existing = await getLatestRecord(userId, loanApplicationId);
  if (existing) {
    // Reuse latest row for this user/loan — never insert a new pending row after docs were
    // approved (that would hide them from Submitted → DOCS VERIFIED via MAX(id) join).
    if (
      existing.loan_application_id == null &&
      loanApplicationId != null
    ) {
      await executeQuery(
        `UPDATE employment_verification_records
         SET loan_application_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [loanApplicationId, existing.id]
      );
      existing.loan_application_id = loanApplicationId;
    }
    if (
      existing.loan_application_id === loanApplicationId ||
      existing.loan_application_id == null ||
      loanApplicationId == null
    ) {
      return existing;
    }
  }

  const result = await executeQuery(
    `INSERT INTO employment_verification_records
     (user_id, loan_application_id, status, created_at, updated_at)
     VALUES (?, ?, 'pending', NOW(), NOW())`,
    [userId, loanApplicationId]
  );
  const rows = await executeQuery(
    'SELECT * FROM employment_verification_records WHERE id = ?',
    [result.insertId]
  );
  return rows[0];
}

async function markVerified(recordId, method, extra = {}) {
  const {
    pan_used,
    uan_number,
    company_email,
    uan_api_result_code,
    uan_api_response,
    verified_by_admin_id
  } = extra;

  await executeQuery(
    `UPDATE employment_verification_records
     SET status = 'verified',
         method = ?,
         pan_used = COALESCE(?, pan_used),
         uan_number = COALESCE(?, uan_number),
         company_email = COALESCE(?, company_email),
         uan_api_result_code = COALESCE(?, uan_api_result_code),
         uan_api_response = COALESCE(?, uan_api_response),
         verified_at = NOW(),
         verified_by_admin_id = COALESCE(?, verified_by_admin_id),
         updated_at = NOW()
     WHERE id = ?`,
    [
      method,
      pan_used || null,
      uan_number || null,
      company_email || null,
      uan_api_result_code ?? null,
      uan_api_response ? JSON.stringify(uan_api_response) : null,
      verified_by_admin_id || null,
      recordId
    ]
  );
}

function getIsEmployed(uanResponse) {
  if (!uanResponse) return null;

  let response = uanResponse;
  if (typeof response === 'string') {
    try {
      response = JSON.parse(response);
    } catch {
      return null;
    }
  }

  const value =
    response?.result?.summary?.is_employed ??
    response?.data?.result?.summary?.is_employed ??
    response?.summary?.is_employed;

  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') {
    return false;
  }
  return null;
}

async function checkUANByPAN(userId, mobile, pan, loanApplicationId) {
  const clientRefNum = generateUANClientRefNum(userId);
  const result = await getUANBasic(mobile, clientRefNum, pan);
  const resultCode = result.data?.result_code;
  const message = result.data?.message || result.error || '';

  const record = await getOrCreateRecord(userId, loanApplicationId);

  await executeQuery(
    `UPDATE employment_verification_records
     SET pan_used = ?,
         uan_api_result_code = ?,
         uan_api_response = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      pan?.toUpperCase() || null,
      resultCode ?? null,
      result.data ? JSON.stringify(result.data) : null,
      record.id
    ]
  );

  // Persist UAN passbook audit (same as digitap route)
  await storeUANPassbookAudit(userId, clientRefNum, {
    mobile,
    requestPayload: { mobile, client_ref_num: clientRefNum, pan },
    result,
    resultCode
  });

  if (result.success && isUANSuccess(resultCode)) {
    const isEmployed = getIsEmployed(result.data);

    // UAN fetched. If EPFO explicitly reports that the user is not employed,
    // both employment documents must be reviewed by an admin.
    await executeQuery(
      `UPDATE employment_verification_records
       SET method = 'uan_pan_api', updated_at = NOW()
       WHERE id = ?`,
      [record.id]
    );

    if (isEmployed === false) {
      return {
        success: true,
        verified: false,
        uanFetched: true,
        requiresPayslipOnly: false,
        requiresFullDocs: true,
        result_code: resultCode,
        message: 'Current employment could not be confirmed. Please upload your latest payslip and company ID card.',
        shouldShowManualFlow: true,
        data: result.data
      };
    }

    return {
      success: true,
      verified: false,
      uanFetched: true,
      requiresPayslipOnly: true,
      result_code: resultCode,
      message: message || 'UAN verified. Please upload your latest payslip to continue.',
      shouldShowManualFlow: false,
      data: result.data
    };
  }

  const manual = shouldShowManualEmploymentFlow(resultCode, message);
  return {
    success: true,
    verified: false,
    result_code: resultCode,
    message,
    shouldShowManualFlow: manual,
    data: result.data || null
  };
}

async function storeUANPassbookAudit(userId, clientRefNum, payload) {
  const { mobile, requestPayload, result, resultCode } = payload;
  try {
    let status = 'failed';
    if (resultCode === 101) status = 'success';
    else if (resultCode === 103) status = 'no_records';

    await executeQuery(
      `INSERT INTO uan_passbook_requests
       (user_id, client_ref_num, txn_id, mobile, status, result_code, request_data, response_data, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        clientRefNum,
        result.data?.request_id || null,
        mobile || null,
        status,
        resultCode || null,
        JSON.stringify(requestPayload),
        JSON.stringify(result.data || {}),
        result.error || null
      ]
    );
  } catch (dbErr) {
    console.error('Error storing UAN passbook request:', dbErr.message);
  }
}

async function checkUANByNumber(userId, uanNumber, loanApplicationId) {
  const uanTrimmed = String(uanNumber || '').trim();
  const clientRefNum = generateUANClientRefNum(userId);
  const result = await getUANByNumber(uanTrimmed, clientRefNum);
  const resultCode = result.data?.result_code ?? result.result_code;
  const message = result.data?.message || result.error || '';

  const record = await getOrCreateRecord(userId, loanApplicationId);

  await executeQuery(
    `UPDATE employment_verification_records
     SET uan_number = ?,
         uan_api_result_code = ?,
         uan_api_response = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      uanTrimmed,
      resultCode ?? null,
      result.data ? JSON.stringify(result.data) : null,
      record.id
    ]
  );

  await storeUANPassbookAudit(userId, clientRefNum, {
    mobile: null,
    requestPayload: { uan: uanTrimmed, client_ref_num: clientRefNum },
    result,
    resultCode
  });

  if (result.success && isUANSuccess(resultCode)) {
    await markVerified(record.id, 'uan_number_manual', {
      uan_number: uanTrimmed,
      uan_api_result_code: resultCode,
      uan_api_response: result.data
    });
    return {
      success: true,
      verified: true,
      result_code: resultCode,
      message: message || 'UAN verified successfully',
      data: result.data
    };
  }

  if (isUANUserEntryFailure(resultCode, message)) {
    return {
      success: false,
      verified: false,
      result_code: resultCode,
      message: UAN_USER_ENTRY_ERROR_MESSAGE
    };
  }

  return {
    success: false,
    verified: false,
    result_code: resultCode,
    message: message || UAN_USER_ENTRY_ERROR_MESSAGE
  };
}

async function getEmploymentVerificationStatus(userId, loanApplicationId) {
  const appId = await resolveLoanApplicationId(userId, loanApplicationId);
  const record = await getLatestRecord(userId, appId);

  if (!record) {
    return {
      loan_application_id: appId,
      status: 'pending',
      verified: false,
      docs_verify: false,
      uan_fetched: false,
      requires_payslip_only: false,
      requires_full_docs: false,
      method: null
    };
  }

  const uanFetched = isUANSuccess(record.uan_api_result_code);
  const requiresFullDocs =
    record.status === 'pending' &&
    uanFetched &&
    getIsEmployed(record.uan_api_response) === false;
  const requiresPayslipOnly = record.status === 'pending' && uanFetched && !requiresFullDocs;

  return {
    loan_application_id: appId,
    record_id: record.id,
    status: record.status,
    verified: record.status === 'verified',
    docs_verify: record.status === 'docs_verify',
    uan_fetched: uanFetched,
    requires_payslip_only: requiresPayslipOnly,
    requires_full_docs: requiresFullDocs,
    method: record.method,
    company_email: record.company_email,
    uan_number: record.uan_number,
    pan_used: record.pan_used,
    uan_api_result_code: record.uan_api_result_code
  };
}

async function assertNotAwaitingDocsReview(userId, loanApplicationId) {
  const status = await getEmploymentVerificationStatus(userId, loanApplicationId);
  if (status.docs_verify) {
    const err = new Error('DOCS_VERIFY_PENDING');
    err.code = 'DOCS_VERIFY_PENDING';
    err.status = status;
    throw err;
  }
  return status;
}

module.exports = {
  resolveLoanApplicationId,
  getLatestRecord,
  getOrCreateRecord,
  markVerified,
  checkUANByPAN,
  checkUANByNumber,
  getIsEmployed,
  getEmploymentVerificationStatus,
  assertNotAwaitingDocsReview
};
