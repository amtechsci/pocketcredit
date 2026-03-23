/**
 * Admin-facing onboarding + post-disbursal step.
 * Early flow must match src/hooks/useLoanApplicationStepManager.ts (credit → employment → bank → … → aa-consent).
 * onboardingProgressEngine.ts order differs — admin uses the live app guard order.
 */

const ONBOARDING_STEP_ORDER = [
  'application',
  'kyc-verification',
  'pan-verification',
  'credit-analytics',
  'employment-details',
  'bank-statement',
  'bank-details',
  'email-verification',
  'references',
  'aa-consent',
  'upload-documents',
  'steps'
];

/** Pre-disbursal mandate phase (E-NACH + selfie before full review) */
const EARLY_MANDATE_STATUSES = ['submitted', 'under_review', 'follow_up', 'qa_verification'];

/** Full post-disbursal product flow after disbursal decision */
const DISBURSAL_POST_FLOW_STATUSES = ['disbursal', 'repeat_disbursal', 'ready_to_repeat_disbursal'];

/**
 * True when the borrower is past (or in) the post-disbursal / mandate flow so we must not
 * show Digilocker/PAN/etc. from stale early-prerequisite checks.
 */
function shouldPrioritizePostDisbursal(app, hasRefs) {
  if (!app) return false;
  const st = app.status || '';
  const refsDone = Number(app.references_completed) === 1;
  const touchedEnach = Number(app.enach_done) === 1;
  const touchedSelfie = Number(app.selfie_captured) === 1 || Number(app.selfie_verified) === 1;
  return (
    refsDone ||
    hasRefs ||
    touchedEnach ||
    touchedSelfie ||
    DISBURSAL_POST_FLOW_STATUSES.includes(st) ||
    st === 'repeat_disbursal' ||
    (EARLY_MANDATE_STATUSES.includes(st) && (refsDone || hasRefs))
  );
}

/**
 * First incomplete post-disbursal step for admin display (e-nach, selfie, kfs, …).
 * @param {object|null} app - Latest loan_application row with flags
 * @param {boolean} isRepeatCustomer - User has at least one cleared loan (same as post-disbursal API)
 * @returns {string|null} step id or null if no post-disbursal step pending
 */
function computePostDisbursalAdminStep(app, isRepeatCustomer) {
  if (!app) return null;

  const st = app.status || '';
  const enach = Number(app.enach_done) === 1;
  const selfieOk = Number(app.selfie_captured) === 1 && Number(app.selfie_verified) === 1;
  const refsDone = Number(app.references_completed) === 1;
  const kfs = Number(app.kfs_viewed) === 1;
  const agr = Number(app.agreement_signed) === 1;
  const bankConfirm = Number(app.bank_confirm_done) === 1;

  if (isRepeatCustomer) {
    if (!bankConfirm) return 'bank-confirm';
    if (!kfs) return 'kfs';
    if (!agr) return 'agreement';
    return null;
  }

  if (EARLY_MANDATE_STATUSES.includes(st)) {
    if (!refsDone) return 'references';
    if (!enach) return 'e-nach';
    if (!selfieOk) return 'selfie';
    return null;
  }

  if (DISBURSAL_POST_FLOW_STATUSES.includes(st)) {
    if (!enach) return 'e-nach';
    if (!selfieOk) return 'selfie';
    if (!refsDone) return 'references';
    if (!kfs) return 'kfs';
    if (!agr) return 'agreement';
    return null;
  }

  return null;
}

/**
 * @param {object} user - users row
 * @param {object|null} latestApplication - latest loan_application with status + post-disbursal columns
 * @param {number} referencesCount - ref count (excl. Self / Credit%)
 * @param {object} opts - kycData, kycDocuments, employment, bankStatementRecords, creditCheck, aaOrBankStatement (late-step AA), isRepeatCustomer
 */
function hasPanVerifiedForAdmin(user, kycDocuments) {
  const fromDocs = Array.isArray(kycDocuments) && kycDocuments.some(d => (d.document_type || '').toUpperCase().includes('PAN'));
  if (fromDocs) return true;
  const pan = user && user.pan_number != null ? String(user.pan_number).trim().toUpperCase() : '';
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

function computeOnboardingCurrentStep(user, latestApplication, referencesCount, opts = {}) {
  if (!latestApplication) return null;

  const hasVerifiedEmail = !!(
    (user.email && String(user.email).trim() !== '' && user.email_verified) ||
    (user.personal_email && String(user.personal_email).trim() !== '' && user.personal_email_verified) ||
    (user.official_email && String(user.official_email).trim() !== '' && user.official_email_verified)
  );
  const hasRefs = referencesCount >= 3 && !!(user.alternate_mobile && String(user.alternate_mobile).trim() !== '');

  // Post-disbursal first when loan/user clearly left onboarding (avoids false KYC/PAN when user is on e-nach/selfie)
  if (shouldPrioritizePostDisbursal(latestApplication, hasRefs)) {
    const postStep = computePostDisbursalAdminStep(latestApplication, !!opts.isRepeatCustomer);
    if (postStep) return postStep;
    return 'complete';
  }

  const kycData = opts.kycData || null;
  const kycDocuments = opts.kycDocuments || [];
  const employment = opts.employment || [];
  const bankStatementRecords = opts.bankStatementRecords || [];
  const creditCheck = opts.creditCheck || null;
  const aaOrBankStatement = opts.aaOrBankStatement || false;

  const rekycRequired = !!(kycData && kycData.verification_data && (typeof kycData.verification_data === 'string'
    ? (() => { try { const v = JSON.parse(kycData.verification_data); return v && v.rekyc_required === true; } catch (e) { return false; } })()
    : (kycData.verification_data.rekyc_required === true)));

  const kycVerified = (user.kyc_completed || (kycData && kycData.status === 'verified')) && !rekycRequired;
  const hasPanDocument = hasPanVerifiedForAdmin(user, kycDocuments);
  const aaConsentGiven = aaOrBankStatement;
  const creditAnalyticsCompleted = !!(creditCheck && creditCheck.credit_score != null && Number(creditCheck.credit_score) > 450);
  const employmentCompleted = !!(
    (user.employment_type && String(user.employment_type).trim() !== '') &&
    (user.income_range != null && String(user.income_range).trim() !== '') &&
    (employment.length === 0 || employment.some(e => (e.salary_payment_mode != null && e.salary_payment_mode !== '') || (e.monthly_salary_old != null && Number(e.monthly_salary_old) > 0)))
  );
  const bankStatementCompleted = bankStatementRecords.some(r => r.status === 'completed' || r.upload_method === 'manual');
  const bankDetailsCompleted = !!(latestApplication.user_bank_id != null && latestApplication.user_bank_id !== '');

  const checks = [
    true,
    kycVerified,
    hasPanDocument,
    creditAnalyticsCompleted,
    employmentCompleted,
    bankStatementCompleted,
    bankDetailsCompleted,
    hasVerifiedEmail,
    hasRefs,
    aaConsentGiven,
    true,
    true
  ];

  const stepOrder = ONBOARDING_STEP_ORDER;
  for (let i = 0; i < stepOrder.length; i++) {
    if (!checks[i]) return stepOrder[i];
  }

  const postStep = computePostDisbursalAdminStep(latestApplication, !!opts.isRepeatCustomer);
  if (postStep) return postStep;

  return 'complete';
}

module.exports = {
  computeOnboardingCurrentStep,
  computePostDisbursalAdminStep,
  shouldPrioritizePostDisbursal,
  ONBOARDING_STEP_ORDER
};
