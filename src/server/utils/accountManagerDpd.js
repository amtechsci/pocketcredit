/**
 * DPD (days past due) helpers for Account Manager / overdue loans.
 * DPD = calendar days from first unpaid EMI due date to today (negative = before due).
 */

function getFirstPendingEmiDueDate(row) {
  if (row.emi_schedule) {
    try {
      const schedule = typeof row.emi_schedule === 'string' ? JSON.parse(row.emi_schedule) : row.emi_schedule;
      if (Array.isArray(schedule) && schedule.length > 0) {
        const unpaid = schedule.filter((emi) => (emi.status || '').toLowerCase() !== 'paid');
        if (unpaid.length > 0) {
          unpaid.sort((a, b) => {
            const da = String(a.due_date || a.dueDate || '');
            const db = String(b.due_date || b.dueDate || '');
            return da.localeCompare(db);
          });
          const d = unpaid[0].due_date || unpaid[0].dueDate;
          return d ? String(d).split('T')[0].split(' ')[0] : null;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }
  if (row.processed_due_date) {
    try {
      const pd = typeof row.processed_due_date === 'string' ? JSON.parse(row.processed_due_date) : row.processed_due_date;
      if (Array.isArray(pd) && pd.length > 0) return String(pd[0]).split('T')[0];
      if (typeof pd === 'string') return pd.split('T')[0];
    } catch (e) {
      return String(row.processed_due_date).split('T')[0];
    }
  }
  if (row.processed_at) {
    const d = new Date(row.processed_at);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function daysDiff(dueStr, todayStr) {
  if (!dueStr) return null;
  const due = new Date(dueStr);
  const cur = new Date(todayStr || new Date().toISOString().slice(0, 10));
  return Math.floor((cur - due) / (24 * 60 * 60 * 1000));
}

function computeDpdForLoanRow(row, todayStr) {
  const t = todayStr || new Date().toISOString().slice(0, 10);
  return daysDiff(getFirstPendingEmiDueDate(row), t);
}

/**
 * @param {number|null|undefined} dpd
 * @param {string} segment — lt_m2 | m2_5 | 6_10 | 11_15 | 16_plus | all
 */
function matchesDpdSegment(dpd, segment) {
  const seg = segment && String(segment).trim() ? String(segment).trim() : 'all';
  if (seg === 'all') return true;
  if (dpd === null || dpd === undefined) return false;
  if (seg === 'lt_m2') return dpd < -2;
  if (seg === 'm2_5') return dpd >= -2 && dpd <= 5;
  if (seg === '6_10') return dpd >= 6 && dpd <= 10;
  if (seg === '11_15') return dpd >= 11 && dpd <= 15;
  if (seg === '16_plus') return dpd > 15;
  return true;
}

function passesRecoveryOfficerScope(dpd) {
  if (dpd === null || dpd === undefined) return false;
  return dpd >= -2;
}

module.exports = {
  getFirstPendingEmiDueDate,
  daysDiff,
  computeDpdForLoanRow,
  matchesDpdSegment,
  passesRecoveryOfficerScope
};
