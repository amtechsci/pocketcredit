const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase, ensureLoanStatusHistoryTable } = require('../config/database');

const router = express.Router();

/**
 * GET /api/admin/performance
 * Returns Performance tab metrics for the current admin (role-based).
 * Query: from_date, to_date (YYYY-MM-DD). If omitted, to_date = today, from_date = today.
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    await ensureLoanStatusHistoryTable();

    const adminId = req.admin?.id;
    const role = req.admin?.role;
    const subCat = req.admin?.sub_admin_category || '';

    let fromDate = req.query.from_date;
    let toDate = req.query.to_date;
    const followUpUserId = req.query.follow_up_user || null;
    const today = new Date().toISOString().slice(0, 10);
    if (!toDate) toDate = today;
    if (!fromDate) fromDate = toDate;

    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
    const isFollowUp = subCat === 'follow_up_user' || isSuperAdmin;
    const isVerify = subCat === 'verify_user' || isSuperAdmin;
    const isQA = subCat === 'qa_user' || isSuperAdmin;
    const effectiveFollowUpAdminId = (isSuperAdmin && followUpUserId) ? followUpUserId : adminId;

    const out = {
      from_date: fromDate,
      to_date: toDate,
      fetch_time: new Date().toISOString(),
      followUp: null,
      verify: null,
      qa: null,
      follow_up_user: followUpUserId || null
    };

    const assignFollowUp = isSuperAdmin ? '' : `AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)`;
    const assignVerify = isSuperAdmin ? '' : `AND (la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)`;
    const assignQA = isSuperAdmin ? '' : `AND (la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)`;
    const params = (key) => (key === 'follow_up' || key === 'verify' || key === 'qa' ? (isSuperAdmin ? [] : [adminId, adminId]) : []);
    const followUpParams = (key) => (key === 'follow_up' ? (effectiveFollowUpAdminId ? [effectiveFollowUpAdminId, effectiveFollowUpAdminId] : []) : (isSuperAdmin ? [] : [adminId, adminId]));

    // ---- A) Follow-up user metrics (for follow_up_user role, or superadmin viewing a specific user via ?follow_up_user=) ----
    if (subCat === 'follow_up_user' || (isSuperAdmin && followUpUserId)) {
      const fp = followUpParams('follow_up');
      const followUpWhereClause = effectiveFollowUpAdminId ? ` AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)` : '';
      const followUpParamsArr = (extra = []) => [...fp, ...extra];

      const submittedRes = await executeQuery(
        `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'submitted'${followUpWhereClause}`,
        followUpParamsArr()
      ).catch(() => [{ c: 0 }]);
      const submittedCount = submittedRes && submittedRes[0] ? submittedRes[0] : { c: 0 };
      const followUpRes = await executeQuery(
        `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'follow_up'${followUpWhereClause}`,
        followUpParamsArr()
      ).catch(() => [{ c: 0 }]);
      const followUpCount = followUpRes && followUpRes[0] ? followUpRes[0] : { c: 0 };

      let tvrCount = 0;
      if (fp.length) {
        const [t] = await executeQuery(
          `SELECT COUNT(DISTINCT u.id) as c FROM users u
           INNER JOIN loan_applications la ON la.user_id = u.id AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)
           WHERE u.moved_to_tvr = 1`,
          [effectiveFollowUpAdminId, effectiveFollowUpAdminId]
        ).catch(() => [{ c: 0 }]);
        tvrCount = t && t[0] ? Number(t[0].c) : 0;
      } else {
        const [t] = await executeQuery(
          `SELECT COUNT(DISTINCT u.id) as c FROM users u INNER JOIN loan_applications la ON la.user_id = u.id WHERE u.moved_to_tvr = 1`
        ).catch(() => [{ c: 0 }]);
        tvrCount = t && t[0] ? Number(t[0].c) : 0;
      }

      let movedSubmittedToUnderReview = 0;
      let withLog = 0;
      let withoutLog = 0;
      let movedFollowUpToUnderReview = 0;
      let movedTvrToQa = 0;

      try {
        const historyRows = await executeQuery(
          `SELECT lsh.id, lsh.loan_application_id, lsh.from_status, lsh.to_status, lsh.admin_id, lsh.created_at, la.user_id,
                  la.assigned_follow_up_admin_id
           FROM loan_status_history lsh
           INNER JOIN loan_applications la ON la.id = lsh.loan_application_id
           WHERE lsh.to_status = 'under_review'
             AND DATE(lsh.created_at) BETWEEN ? AND ?
             ${fp.length ? 'AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)' : ''}`,
          fp.length ? [fromDate, toDate, effectiveFollowUpAdminId, effectiveFollowUpAdminId] : [fromDate, toDate]
        );
        movedSubmittedToUnderReview = historyRows.filter(r => r.from_status === 'submitted').length;
        movedFollowUpToUnderReview = historyRows.filter(r => r.from_status === 'follow_up').length;

        for (const row of historyRows.filter(r => r.from_status === 'submitted')) {
          const adminToCheck = row.admin_id || row.assigned_follow_up_admin_id || null;
          if (!adminToCheck) {
            withoutLog++;
            continue;
          }
          const transitionDate = row.created_at;
          const noteSameDay = await executeQuery(
            `SELECT 1 FROM user_notes WHERE user_id = ? AND created_by = ? AND DATE(created_at) = DATE(?) LIMIT 1`,
            [row.user_id, adminToCheck, transitionDate]
          );
          const followUpSameDay = await executeQuery(
            `SELECT 1 FROM user_follow_ups WHERE user_id = ? AND admin_id = ? AND DATE(created_at) = DATE(?) LIMIT 1`,
            [row.user_id, adminToCheck, transitionDate]
          );
          const hasLog = (noteSameDay && noteSameDay.length > 0) || (followUpSameDay && followUpSameDay.length > 0);
          if (hasLog) withLog++;
          else withoutLog++;
        }
      } catch (e) {
        console.error('Performance follow-up history:', e.message);
      }

      try {
        const qaRows = await executeQuery(
          `SELECT uvh.id FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type = 'qa_verification' AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${fp.length ? 'AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)' : ''}`,
          fp.length ? [fromDate, toDate, effectiveFollowUpAdminId, effectiveFollowUpAdminId] : [fromDate, toDate]
        );
        movedTvrToQa = Array.isArray(qaRows) ? qaRows.length : 0;
      } catch (e) {
        console.error('Performance TVR->QA:', e.message);
      }

      const zeroUpdateToday = { submitted: [], follow_up: [], tvr: [] };
      try {
        const statuses = ['submitted', 'follow_up'];
        for (const st of statuses) {
          const loanList = await executeQuery(
            `SELECT la.id, la.user_id FROM loan_applications la
             WHERE la.status = ?
             ${fp.length ? 'AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)' : ''}`,
            fp.length ? [st, effectiveFollowUpAdminId, effectiveFollowUpAdminId] : [st]
          );
          for (const loan of loanList || []) {
            const hasNote = await executeQuery(
              `SELECT 1 FROM user_notes WHERE user_id = ? AND DATE(created_at) = ? LIMIT 1`,
              [loan.user_id, today]
            );
            const hasFollowUp = await executeQuery(
              `SELECT 1 FROM user_follow_ups WHERE user_id = ? AND DATE(created_at) = ? LIMIT 1`,
              [loan.user_id, today]
            );
            const hasUpdate = (hasNote && hasNote.length > 0) || (hasFollowUp && hasFollowUp.length > 0);
            if (!hasUpdate) zeroUpdateToday[st].push(`PLL${loan.id}`);
          }
        }
        const tvrLoans = await executeQuery(
          `SELECT la.id, la.user_id FROM loan_applications la
           INNER JOIN users u ON u.id = la.user_id AND u.moved_to_tvr = 1
           WHERE la.status IN ('submitted','under_review','follow_up','disbursal','qa_verification')
             ${fp.length ? 'AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)' : ''}`,
          fp.length ? [effectiveFollowUpAdminId, effectiveFollowUpAdminId] : []
        );
        for (const loan of tvrLoans || []) {
          const hasNote = await executeQuery(
            `SELECT 1 FROM user_notes WHERE user_id = ? AND DATE(created_at) = ? LIMIT 1`,
            [loan.user_id, today]
          );
          const hasFollowUp = await executeQuery(
            `SELECT 1 FROM user_follow_ups WHERE user_id = ? AND DATE(created_at) = ? LIMIT 1`,
            [loan.user_id, today]
          );
          const hasUpdate = (hasNote && hasNote.length > 0) || (hasFollowUp && hasFollowUp.length > 0);
          if (!hasUpdate) zeroUpdateToday.tvr.push(`PLL${loan.id}`);
        }
      } catch (e) {
        console.error('Performance zeroUpdateToday:', e.message);
      }

      let hourly = [];
      try {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const noteCounts = await executeQuery(
          `SELECT HOUR(un.created_at) as h, COUNT(*) as c FROM user_notes un
           WHERE DATE(un.created_at) BETWEEN ? AND ?
             ${fp.length ? 'AND un.created_by = ?' : ''}
           GROUP BY HOUR(un.created_at)`,
          fp.length ? [fromDate, toDate, effectiveFollowUpAdminId] : [fromDate, toDate]
        );
        const followUpCounts = await executeQuery(
          `SELECT HOUR(uf.created_at) as h, COUNT(*) as c FROM user_follow_ups uf
           WHERE DATE(uf.created_at) BETWEEN ? AND ?
             ${fp.length ? 'AND uf.admin_id = ?' : ''}
           GROUP BY HOUR(uf.created_at)`,
          fp.length ? [fromDate, toDate, effectiveFollowUpAdminId] : [fromDate, toDate]
        );
        const refCounts = await executeQuery(
          `SELECT HOUR(r.updated_at) as h, COUNT(*) as c FROM references r
           WHERE r.status = 'verified' AND DATE(r.updated_at) BETWEEN ? AND ?
           GROUP BY HOUR(r.updated_at)`,
          [fromDate, toDate]
        );
        const byHour = {};
        hours.forEach(h => { byHour[h] = 0; });
        (noteCounts || []).forEach(r => { byHour[r.h] = (byHour[r.h] || 0) + Number(r.c); });
        (followUpCounts || []).forEach(r => { byHour[r.h] = (byHour[r.h] || 0) + Number(r.c); });
        (refCounts || []).forEach(r => { byHour[r.h] = (byHour[r.h] || 0) + Number(r.c); });
        hourly = hours.map(h => ({ hour: h, label: `${h}:00-${h + 1}:00`, count: byHour[h] || 0 }));
      } catch (e) {
        console.error('Performance hourly:', e.message);
      }

      out.followUp = {
        current: {
          submitted: Number(submittedCount.c) || 0,
          follow_up: Number(followUpCount.c) || 0,
          tvr: tvrCount
        },
        inRange: {
          movedSubmittedToUnderReview,
          movedSubmittedToUnderReviewWithLog: withLog,
          movedSubmittedToUnderReviewWithoutLog: withoutLog,
          movedFollowUpToUnderReview,
          movedTvrToQa
        },
        zeroUpdateToday: zeroUpdateToday,
        hourly
      };
    }

    // ---- B) Verify user metrics ----
    if (isVerify) {
      const vp = params('verify');
      let submittedCount = 0;
      try {
        const q = `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'submitted' ${assignVerify}`;
        const [r] = await executeQuery(q, vp);
        submittedCount = r && r.c != null ? Number(r.c) : 0;
      } catch (e) { }

      let hourlyVerify = [];
      try {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const needDoc = await executeQuery(
          `SELECT HOUR(uvh.created_at) as h, COUNT(*) as c FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type = 'need_document' AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${vp.length ? 'AND (la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)' : ''}
           GROUP BY HOUR(uvh.created_at)`,
          vp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const cancelled = await executeQuery(
          `SELECT HOUR(uvh.created_at) as h, COUNT(*) as c FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type IN ('cancel','re_process','not_process') AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${vp.length ? 'AND (la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)' : ''}
           GROUP BY HOUR(uvh.created_at)`,
          vp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const movedToTvr = await executeQuery(
          `SELECT HOUR(u.moved_to_tvr_at) as h, COUNT(*) as c FROM users u
           INNER JOIN loan_applications la ON la.user_id = u.id
           WHERE u.moved_to_tvr = 1 AND DATE(u.moved_to_tvr_at) BETWEEN ? AND ?
             ${vp.length ? 'AND (la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)' : ''}
           GROUP BY HOUR(u.moved_to_tvr_at)`,
          vp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const byHour = {};
        hours.forEach(h => { byHour[h] = { movedToTvr: 0, movedToFollowUp: 0, cancelled: 0 }; });
        (movedToTvr || []).forEach(r => { byHour[r.h].movedToTvr = Number(r.c); });
        (needDoc || []).forEach(r => { byHour[r.h].movedToFollowUp = Number(r.c); });
        (cancelled || []).forEach(r => { byHour[r.h].cancelled = Number(r.c); });
        hourlyVerify = hours.map(h => ({
          hour: h,
          label: `${h}:00-${h + 1}:00`,
          movedToTvr: byHour[h].movedToTvr,
          movedToFollowUp: byHour[h].movedToFollowUp,
          cancelled: byHour[h].cancelled
        }));
      } catch (e) {
        console.error('Performance verify hourly:', e.message);
      }

      out.verify = {
        current: { submitted: submittedCount },
        hourly: hourlyVerify
      };
    }

    // ---- C) QA user metrics ----
    if (isQA) {
      const qp = params('qa');
      let qaCount = 0;
      try {
        const q = `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'qa_verification' ${assignQA}`;
        const [r] = await executeQuery(q, qp);
        qaCount = r && r.c != null ? Number(r.c) : 0;
      } catch (e) { }

      let hourlyQA = [];
      try {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const toDisbursal = await executeQuery(
          `SELECT HOUR(uvh.created_at) as h, COUNT(*) as c FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type IN ('process','qa_approve') AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${qp.length ? 'AND (la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)' : ''}
           GROUP BY HOUR(uvh.created_at)`,
          qp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const needDoc = await executeQuery(
          `SELECT HOUR(uvh.created_at) as h, COUNT(*) as c FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type = 'need_document' AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${qp.length ? 'AND (la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)' : ''}
           GROUP BY HOUR(uvh.created_at)`,
          qp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const cancelled = await executeQuery(
          `SELECT HOUR(uvh.created_at) as h, COUNT(*) as c FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type IN ('cancel','re_process','not_process') AND DATE(uvh.created_at) BETWEEN ? AND ?
             ${qp.length ? 'AND (la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)' : ''}
           GROUP BY HOUR(uvh.created_at)`,
          qp.length ? [fromDate, toDate, adminId, adminId] : [fromDate, toDate]
        );
        const byHour = {};
        hours.forEach(h => { byHour[h] = { movedToDisbursal: 0, movedToFollowUp: 0, cancelled: 0 }; });
        (toDisbursal || []).forEach(r => { byHour[r.h].movedToDisbursal = Number(r.c); });
        (needDoc || []).forEach(r => { byHour[r.h].movedToFollowUp = Number(r.c); });
        (cancelled || []).forEach(r => { byHour[r.h].cancelled = Number(r.c); });
        hourlyQA = hours.map(h => ({
          hour: h,
          label: `${h}:00-${h + 1}:00`,
          movedToDisbursal: byHour[h].movedToDisbursal,
          movedToFollowUp: byHour[h].movedToFollowUp,
          cancelled: byHour[h].cancelled
        }));
      } catch (e) {
        console.error('Performance QA hourly:', e.message);
      }

      out.qa = {
        current: { qa: qaCount },
        hourly: hourlyQA
      };
    }

    res.json({ status: 'success', data: out });
  } catch (error) {
    console.error('Performance API error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to get performance data' });
  }
});

/**
 * GET /api/admin/performance/follow-up-users
 * User-wise report: one row per follow-up user (Synergi 1, 2, ...) with their assigned counts.
 * Only for superadmin / super_admin.
 * Query: from_date, to_date (YYYY-MM-DD).
 */
router.get('/follow-up-users', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    await ensureLoanStatusHistoryTable();

    const role = req.admin?.role;
    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
    if (!isSuperAdmin) {
      return res.status(403).json({ status: 'error', message: 'Only superadmin can view follow-up user-wise report' });
    }

    let fromDate = req.query.from_date;
    let toDate = req.query.to_date;
    const today = new Date().toISOString().slice(0, 10);
    if (!toDate) toDate = today;
    if (!fromDate) fromDate = toDate;

    const followUpAdmins = await executeQuery(
      `SELECT id, name, email FROM admins WHERE sub_admin_category = 'follow_up_user' AND is_active = 1 ORDER BY name ASC`
    );
    if (!followUpAdmins || followUpAdmins.length === 0) {
      return res.json({ status: 'success', data: { from_date: fromDate, to_date: toDate, users: [] } });
    }

    const users = [];
    for (const admin of followUpAdmins) {
      const aid = admin.id;
      const submittedRows = await executeQuery(
        `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'submitted' AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)`,
        [aid, aid]
      ).catch(() => [{ c: 0 }]);
      const followUpRows = await executeQuery(
        `SELECT COUNT(*) as c FROM loan_applications la WHERE la.status = 'follow_up' AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)`,
        [aid, aid]
      ).catch(() => [{ c: 0 }]);
      const tvrRows = await executeQuery(
        `SELECT COUNT(DISTINCT u.id) as c FROM users u
         INNER JOIN loan_applications la ON la.user_id = u.id AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)
         WHERE u.moved_to_tvr = 1`,
        [aid, aid]
      ).catch(() => [{ c: 0 }]);
      const totalAssignedRows = await executeQuery(
        `SELECT COUNT(*) as c FROM loan_applications la
         WHERE (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)
           AND la.status IN ('submitted','under_review','follow_up','disbursal')`,
        [aid, aid]
      ).catch(() => [{ c: 0 }]);

      let withLog = 0, withoutLog = 0, movedFollowUpToUnderReview = 0, movedTvrToQa = 0;
      try {
        const historyRows = await executeQuery(
          `SELECT lsh.loan_application_id, lsh.from_status, lsh.to_status, lsh.admin_id, lsh.created_at, la.user_id, la.assigned_follow_up_admin_id
           FROM loan_status_history lsh
           INNER JOIN loan_applications la ON la.id = lsh.loan_application_id
           WHERE lsh.to_status = 'under_review' AND DATE(lsh.created_at) BETWEEN ? AND ?
             AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)`,
          [fromDate, toDate, aid, aid]
        );
        movedFollowUpToUnderReview = historyRows.filter(r => r.from_status === 'follow_up').length;
        for (const row of historyRows.filter(r => r.from_status === 'submitted')) {
          const adminToCheck = row.admin_id || row.assigned_follow_up_admin_id || null;
          if (!adminToCheck) { withoutLog++; continue; }
          const [noteSameDay] = await executeQuery(
            `SELECT 1 FROM user_notes WHERE user_id = ? AND created_by = ? AND DATE(created_at) = DATE(?) LIMIT 1`,
            [row.user_id, adminToCheck, row.created_at]
          ).catch(() => []);
          const [followUpSameDay] = await executeQuery(
            `SELECT 1 FROM user_follow_ups WHERE user_id = ? AND admin_id = ? AND DATE(created_at) = DATE(?) LIMIT 1`,
            [row.user_id, adminToCheck, row.created_at]
          ).catch(() => []);
          const hasLog = (noteSameDay && noteSameDay.length > 0) || (followUpSameDay && followUpSameDay.length > 0);
          if (hasLog) withLog++; else withoutLog++;
        }
      } catch (e) {
        console.error('follow-up-users history:', e.message);
      }
      try {
        const qaRows = await executeQuery(
          `SELECT uvh.id FROM user_validation_history uvh
           INNER JOIN loan_applications la ON la.id = uvh.loan_application_id
           WHERE uvh.action_type = 'qa_verification' AND DATE(uvh.created_at) BETWEEN ? AND ?
             AND (la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)`,
          [fromDate, toDate, aid, aid]
        );
        movedTvrToQa = Array.isArray(qaRows) ? qaRows.length : 0;
      } catch (e) {
        console.error('follow-up-users TVR->QA:', e.message);
      }

      users.push({
        admin_id: admin.id,
        name: admin.name || admin.email || '—',
        email: admin.email || '—',
        totalAssigned: Number(totalAssignedRows && totalAssignedRows[0] ? totalAssignedRows[0].c : 0),
        submitted: Number(submittedRows && submittedRows[0] ? submittedRows[0].c : 0),
        follow_up: Number(followUpRows && followUpRows[0] ? followUpRows[0].c : 0),
        tvr: Number(tvrRows && tvrRows[0] ? tvrRows[0].c : 0),
        movedToUnderReviewWithLog: withLog,
        movedToUnderReviewWithoutLog: withoutLog,
        movedFollowUpToUnderReview,
        movedTvrToQa
      });
    }

    res.json({
      status: 'success',
      data: { from_date: fromDate, to_date: toDate, users }
    });
  } catch (error) {
    console.error('Performance follow-up-users error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to get follow-up user-wise report' });
  }
});

module.exports = router;
