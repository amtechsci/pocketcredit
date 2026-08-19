/**
 * Label for admin Transaction History — who recorded / last updated txn details.
 * manual | PG normal | PG Enach
 */
function getTransactionUpdatedByLabel({ description, payment_method, additional_notes } = {}) {
  const notes = String(additional_notes || '');
  if (notes.includes('[updated_by:manual]')) {
    return 'manual';
  }

  const desc = String(description || '').toLowerCase();
  if (desc.includes('enach')) {
    return 'PG Enach';
  }

  const method = String(payment_method || '').toLowerCase();
  if (desc.includes('cashfree') || method === 'cashfree_payout') {
    return 'PG normal';
  }

  return 'manual';
}

function appendManualUpdateMarker(additionalNotes) {
  const marker = '[updated_by:manual]';
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
  appendManualUpdateMarker
};
