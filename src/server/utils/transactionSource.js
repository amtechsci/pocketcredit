/**
 * Label for admin Transaction History — who recorded / last updated txn details.
 * manual | PG normal | PG Enach
 */

const PG_NORMAL_MARKERS = ['[source:pg_normal]', '[updated_by:pg_normal]'];
const PG_ENACH_MARKERS = ['[source:pg_enach]', '[updated_by:pg_enach]'];
const MANUAL_MARKER = '[updated_by:manual]';

function isGatewayNormalTransaction({ description, payment_method, additional_notes, reference_number } = {}) {
  const notes = String(additional_notes || '').toLowerCase();
  if (PG_NORMAL_MARKERS.some((m) => notes.includes(m))) {
    return true;
  }

  const desc = String(description || '').toLowerCase();
  const method = String(payment_method || '').toLowerCase();
  const ref = String(reference_number || '').toLowerCase();

  if (desc.includes('enach')) {
    return false;
  }

  return (
    desc.includes('cashfree')
    || desc.includes('via cashfree')
    || desc.includes('order: loan_')
    || desc.includes('order: ext_')
    || desc.includes('order: recov')
    || method === 'cashfree'
    || method === 'cashfree_payout'
    || ref.startsWith('loan_')
    || ref.startsWith('ext_')
  );
}

function isGatewayEnachTransaction({ description, payment_method, additional_notes } = {}) {
  const notes = String(additional_notes || '').toLowerCase();
  if (PG_ENACH_MARKERS.some((m) => notes.includes(m))) {
    return true;
  }

  const desc = String(description || '').toLowerCase();
  const method = String(payment_method || '').toLowerCase();
  return desc.includes('enach') || method === 'enach';
}

function getTransactionUpdatedByLabel(tx = {}) {
  if (isGatewayEnachTransaction(tx)) {
    return 'PG Enach';
  }

  if (isGatewayNormalTransaction(tx)) {
    return 'PG normal';
  }

  const notes = String(tx.additional_notes || '');
  if (notes.includes(MANUAL_MARKER)) {
    return 'manual';
  }

  return 'manual';
}

function appendManualUpdateMarker(additionalNotes, transaction = {}) {
  if (isGatewayEnachTransaction(transaction) || isGatewayNormalTransaction(transaction)) {
    return String(additionalNotes || '').trim() || null;
  }

  const marker = MANUAL_MARKER;
  const existing = String(additionalNotes || '').trim();
  if (existing.includes(marker)) {
    return existing || null;
  }
  if (!existing) {
    return marker;
  }
  return `${existing}\n${marker}`;
}

module.exports = {
  getTransactionUpdatedByLabel,
  appendManualUpdateMarker,
  isGatewayNormalTransaction,
  isGatewayEnachTransaction,
  PG_NORMAL_MARKERS,
  PG_ENACH_MARKERS
};
