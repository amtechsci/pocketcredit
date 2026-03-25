const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const {
    parseDateToString,
    calculateDaysBetween,
    formatDateToString,
    toDecimal2,
    getFullLoanCalculation
} = require('../utils/loanCalculations');

const router = express.Router();

/**
 * State code mapping for CIBIL format
 */
const STATE_CODES = {
    'andhra pradesh': '01',
    'arunachal pradesh': '02',
    'assam': '03',
    'bihar': '04',
    'chhattisgarh': '33',
    'goa': '05',
    'gujarat': '06',
    'haryana': '07',
    'himachal pradesh': '08',
    'jharkhand': '34',
    'karnataka': '09',
    'kerala': '10',
    'madhya pradesh': '11',
    'maharashtra': '12',
    'manipur': '13',
    'meghalaya': '14',
    'mizoram': '15',
    'nagaland': '16',
    'odisha': '17',
    'punjab': '18',
    'rajasthan': '19',
    'sikkim': '20',
    'tamil nadu': '21',
    'telangana': '36',
    'tripura': '22',
    'uttar pradesh': '23',
    'uttarakhand': '35',
    'west bengal': '24',
    'andaman and nicobar islands': '25',
    'chandigarh': '26',
    'dadra and nagar haveli': '27',
    'daman and diu': '28',
    'delhi': '29',
    'jammu and kashmir': '30',
    'ladakh': '37',
    'lakshadweep': '31',
    'puducherry': '32'
};

const getStateCode = (stateName) => {
    if (!stateName) return '';
    const normalized = stateName.toLowerCase().trim();
    return STATE_CODES[normalized] || '';
};

/** Use state_codes.id from DB for CIBIL state code (e.g. 29 for Karnataka); fallback to name→code map when id is null */
const formatStateCodeForCibil = (loan) => {
    const id = loan.state_id;
    if (id != null && id !== '') {
        const n = parseInt(String(id), 10);
        if (!isNaN(n) && n >= 0) return String(n).padStart(2, '0');
    }
    return getStateCode(loan.state);
};

/**
 * CIBIL address: Aadhar (Digilocker) only for Address Line 1, State Code, PIN Code.
 * Pick the same address id for all columns so we don't mix fields from different rows.
 */
const _CIBIL_ADDR_ORDER_A2 = `a2.is_primary DESC, a2.created_at DESC`;
const _CIBIL_CHOSEN_ADDRESS_ID = `(SELECT a2.id FROM addresses a2 WHERE a2.user_id = u.id AND a2.source = 'digilocker' ORDER BY ${_CIBIL_ADDR_ORDER_A2} LIMIT 1)`;
const CIBIL_ADDRESS_LINE1_SUBQUERY = `(SELECT a.address_line1 FROM addresses a WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
const CIBIL_ADDRESS_LINE2_SUBQUERY = `(SELECT a.address_line2 FROM addresses a WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
const CIBIL_STATE_NAME_SUBQUERY = `(SELECT COALESCE(sc.state_name, a.state) FROM addresses a LEFT JOIN state_codes sc ON sc.id = a.state WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
/** State code for CIBIL: resolve state_codes.id whether addresses.state is stored as id (e.g. 29) or as name (e.g. 'Karnataka'). Use COLLATE to avoid mix of collations (utf8mb4_0900_ai_ci vs utf8mb4_general_ci). */
const CIBIL_STATE_ID_SUBQUERY = `(SELECT sc.id FROM addresses a LEFT JOIN state_codes sc ON (sc.id = a.state OR (sc.state_name COLLATE utf8mb4_unicode_ci = TRIM(CAST(a.state AS CHAR)) COLLATE utf8mb4_unicode_ci)) WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
const CIBIL_PINCODE_SUBQUERY = `(SELECT a.pincode FROM addresses a WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
const CIBIL_COUNTRY_SUBQUERY = `(SELECT COALESCE(a.country, 'India') FROM addresses a WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;
const CIBIL_CITY_SUBQUERY = `(SELECT a.city FROM addresses a WHERE a.user_id = u.id AND a.id = ${_CIBIL_CHOSEN_ADDRESS_ID} LIMIT 1)`;

/** Build complete address for Address Line 1: address_line1, address_line2, city, state, pincode, country */
const formatFullAddress = (loan) => {
    const parts = [
        loan.address_line1,
        loan.address_line2,
        loan.city,
        loan.state,
        loan.pincode,
        loan.country || 'India'
    ].filter(p => p != null && String(p).trim() !== '');
    return parts.join(', ');
};

const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    // Parse ISO date (YYYY-MM-DD or with time) as calendar date so timezone never drops leading zero or shifts day
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const dd = String(day).padStart(2, '0');
            const mm = String(month).padStart(2, '0');
            return `${dd}${mm}${year}`;
        }
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let out = `${day}${month}${year}`;
    // Ensure 8 digits so leading zero is never missing (e.g. 05022026 not 5022026)
    if (out.length === 7 && /^\d{7}$/.test(out)) out = '0' + out;
    return out;
};

const getGenderCode = (gender) => {
    if (!gender) return '';
    const normalized = gender.toLowerCase().trim();
    const genderMap = { 'female': '1', 'f': '1', 'male': '2', 'm': '2', 'transgender': '3', 'other': '3' };
    return genderMap[normalized] || '';
};

const calculateDPD = (processedDate, loanDays) => {
    if (!processedDate) return 0;
    const processed = new Date(processedDate);
    processed.setDate(processed.getDate() - 1);
    const today = new Date();
    const diffTime = today - processed;
    const tday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dpd = tday - (loanDays || 30);
    return dpd > 0 ? dpd : 0;
};

/**
 * Calculate DPD using actual due date when available (processed_due_date), so extended loans
 * are not wrongly included in the default report. Falls back to processed_at + loanDays if no due date.
 */
const calculateDPDForDefault = (loan) => {
    let dueDate = null;
    if (loan.processed_due_date) {
        try {
            const parsed = typeof loan.processed_due_date === 'string' ? JSON.parse(loan.processed_due_date) : loan.processed_due_date;
            if (Array.isArray(parsed) && parsed.length > 0) {
                const dates = parsed.map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
                dueDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
            } else if (parsed && typeof parsed === 'object' && parsed.date) {
                dueDate = new Date(parsed.date);
            } else {
                dueDate = new Date(parsed);
            }
        } catch (e) {
            dueDate = new Date(loan.processed_due_date);
        }
    }
    if (dueDate && !isNaN(dueDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }
    let loanDays = 30;
    if (loan.plan_snapshot) {
        try {
            const plan = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
            loanDays = plan.repayment_days || plan.total_duration_days || 30;
        } catch (e) { }
    }
    return calculateDPD(loan.processed_at, loanDays);
};

const getAssetClassification = (dpd) => {
    if (dpd < 90) return '01';
    if (dpd >= 90 && dpd < 180) return '02';
    if (dpd >= 180 && dpd <= 360) return '03';
    return '04';
};

const CIBIL_HEADERS = [
    'Consumer Name', 'Date of Birth', 'Gender', 'Income Tax ID Number', 'Passport Number', 'Passport Issue Date',
    'Passport Expiry Date', 'Voter ID Number', 'Driving License Number', 'Driving License Issue Date',
    'Driving License Expiry Date', 'Ration Card Number', 'Universal ID Number', 'Additional ID #1', 'Additional ID #2',
    'Telephone No.Mobile', 'Telephone No.Residence', 'Telephone No.Office', 'Extension Office', 'Telephone No.Other',
    'Extension Other', 'Email ID 1', 'Email ID 2', 'Address Line 1', 'State Code 1', 'PIN Code 1', 'Address Category 1',
    'Residence Code 1', 'Address Line 2', 'State Code 2', 'PIN Code 2', 'Address Category 2', 'Residence Code 2',
    'Current/New Member Code', 'Current/New Member Short Name', 'Curr/New Account No', 'Account Type',
    'Ownership Indicator', 'Date Opened/Disbursed', 'Date of Last Payment', 'Date Closed', 'Date Reported',
    'High Credit/Sanctioned Amt', 'Current Balance', 'Amt Overdue', 'No of Days Past Due', 'Old Mbr Code',
    'Old Mbr Short Name', 'Old Acc No', 'Old Acc Type', 'Old Ownership Indicator', 'Suit Filed / Wilful Default',
    'Credit Facility Status', 'Asset Classification', 'Value of Collateral', 'Type of Collateral', 'Credit Limit',
    'Cash Limit', 'Rate of Interest', 'Repayment Tenure', 'EMI Amount', 'Written-off Amount (Total)',
    'Written-off Principal Amount', 'Settlement Amt', 'Payment Frequency', 'Actual Payment Amt', 'Occupation Code',
    'Income', 'Net/Gross Income Indicator', 'Monthly/Annual Income Indicator', 'CKYC', 'NREGA Card Number'
];

/**
 * Escape a value for CSV. For preserveLeadingZero columns (dates, state code, PIN, address category, etc.),
 * prefix with tab so Excel treats the cell as text and does not strip leading zeros (same as PHP fputcsv approach).
 */
const escapeCSV = (value, preserveLeadingZero = false) => {
    if (value === null || value === undefined) return '';
    let str = String(value);
    if (preserveLeadingZero && str.length > 0) {
        str = '\t' + str;
    }
    const needsQuoting = preserveLeadingZero || str.includes(',') || str.includes('"') || str.includes('\n');
    if (needsQuoting) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/** Latest YYYY-MM-DD from EMI schedule (due_date). */
const maxDueDateFromEmiSchedule = (emiScheduleRaw) => {
    if (!emiScheduleRaw) return null;
    let schedule = emiScheduleRaw;
    if (typeof schedule === 'string') {
        try {
            schedule = JSON.parse(schedule);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(schedule) || schedule.length === 0) return null;
    let max = null;
    for (const emi of schedule) {
        const d = emi.due_date || emi.dueDate;
        if (!d || typeof d !== 'string') continue;
        const ds = d.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
        if (!max || ds > max) max = ds;
    }
    return max;
};

/** Latest due date from processed_due_date (JSON array of dates or legacy shapes). */
const maxDueDateFromProcessedDueDate = (processedDueRaw) => {
    if (!processedDueRaw) return null;
    try {
        const parsed = typeof processedDueRaw === 'string' ? JSON.parse(processedDueRaw) : processedDueRaw;
        if (Array.isArray(parsed) && parsed.length > 0) {
            let max = null;
            for (const d of parsed) {
                const ds = typeof d === 'string' ? d.slice(0, 10) : null;
                if (ds && /^\d{4}-\d{2}-\d{2}$/.test(ds)) {
                    if (!max || ds > max) max = ds;
                }
            }
            return max;
        }
        if (parsed && typeof parsed === 'object' && parsed.date) {
            const ds = String(parsed.date).slice(0, 10);
            return /^\d{4}-\d{2}-\d{2}$/.test(ds) ? ds : null;
        }
    } catch {
        const s = String(processedDueRaw).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    }
    return null;
};

/**
 * Tenure (days): inclusive calendar days from disbursal (processed_at) to last EMI due date.
 * Falls back to exhausted_period_days when schedule/due dates are missing.
 */
const getBsDisbursalTenureDays = (row) => {
    const startStr = parseDateToString(row.processed_date);
    if (!startStr) return 0;
    let lastDue = maxDueDateFromEmiSchedule(row.emi_schedule);
    if (!lastDue) lastDue = maxDueDateFromProcessedDueDate(row.processed_due_date);
    if (!lastDue) {
        const ex = parseInt(row.exhausted_period, 10);
        return !Number.isNaN(ex) && ex > 0 ? ex : 0;
    }
    if (lastDue < startStr) return 0;
    return calculateDaysBetween(startStr, lastDue);
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Sums fee/GST from fees_breakdown by application_method (matches calculateCompleteLoanValues).
 */
const parseFeesBreakdownTotals = (raw) => {
    const out = { disbursalFee: 0, disbursalGst: 0, repayableFee: 0, repayableGst: 0 };
    if (!raw) return out;
    let arr = raw;
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        } catch {
            return out;
        }
    }
    if (!Array.isArray(arr)) return out;
    for (const line of arr) {
        const method = String(line.application_method || 'deduct_from_disbursal').toLowerCase();
        const feeAmt = parseFloat(line.fee_amount);
        const gstAmt = parseFloat(line.gst_amount);
        const fee = Number.isNaN(feeAmt) ? 0 : feeAmt;
        const gst = Number.isNaN(gstAmt) ? 0 : gstAmt;
        if (method === 'add_to_total') {
            out.repayableFee += fee;
            out.repayableGst += gst;
        } else {
            out.disbursalFee += fee;
            out.disbursalGst += gst;
        }
    }
    return out;
};

/**
 * Processing fees collected (pre-GST) and GST thereon for disbursal only — not post-service / EMI fees.
 * Prefers plan_snapshot × principal (matches product math); else fees_breakdown "processing fee" lines only; else full breakdown / processed_p_fee.
 */
const resolveBsDisbursalProcessingFeeAndGst = (row) => {
    const fromPlan = getDisbursalProcessingFeeAndGstFromPlanSnapshot(row);
    if (fromPlan) return fromPlan;

    const fromProcessingLinesOnly = sumFeesBreakdownDeductProcessingFeeOnly(row.fees_breakdown);
    if (fromProcessingLinesOnly) return fromProcessingLinesOnly;

    const b = parseFeesBreakdownTotals(row.fees_breakdown);

    if (b.disbursalFee > 0 || b.disbursalGst > 0) {
        let fee = round2(b.disbursalFee);
        let gst = round2(b.disbursalGst);
        if (fee <= 0 && gst > 0) fee = round2(gst / 0.18);
        else if (gst <= 0 && fee > 0) gst = round2(fee * 0.18);
        return { feeCollected: fee, gstOnFees: gst };
    }

    const pFee = parseFloat(row.processed_p_fee);
    const colFee = parseFloat(row.p_fee || row.processing_fees || 0);
    let fee = !Number.isNaN(pFee) && pFee > 0 ? pFee : (!Number.isNaN(colFee) ? colFee : 0);
    fee = round2(fee);

    const totalGst = parseFloat(row.processed_gst);
    let gst;
    if (!Number.isNaN(totalGst) && totalGst >= 0) {
        let repayGst = round2(b.repayableGst);
        if (repayGst <= 0 && b.repayableFee > 0) repayGst = round2(b.repayableFee * 0.18);
        if (repayGst <= 0) {
            const post = parseFloat(row.processed_post_service_fee);
            if (!Number.isNaN(post) && post > 0) repayGst = round2(post * 0.18);
        }
        if (repayGst > 0) gst = Math.max(0, round2(totalGst - repayGst));
        else gst = round2(totalGst);
    } else {
        gst = round2(fee * 0.18);
    }

    return { feeCollected: fee, gstOnFees: gst };
};

/**
 * Parse plan_snapshot JSON object (caller may pass string or object).
 */
const parsePlanSnapshotObject = (raw) => {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Processing fee % from plan: fees[].fee_percent where fee_name is "processing fee", else top-level processing_fee_percent.
 */
const getProcessingFeePercentFromPlanSnapshot = (ps) => {
    if (!ps) return null;
    if (ps.fees && Array.isArray(ps.fees)) {
        for (const f of ps.fees) {
            const name = String(f.fee_name || '')
                .trim()
                .toLowerCase();
            if (name === 'processing fee') {
                const pct = parseFloat(f.fee_percent);
                if (!Number.isNaN(pct)) return pct;
            }
        }
    }
    if (ps.processing_fee_percent != null && !Number.isNaN(parseFloat(ps.processing_fee_percent))) {
        return parseFloat(ps.processing_fee_percent);
    }
    return null;
};

/**
 * One-time disbursal processing fee + GST from plan_snapshot.fees (same formula as calculateCompleteLoanValues).
 * Prefer this over raw fees_breakdown sums when the stored breakdown double-counts duplicate lines.
 */
const getDisbursalProcessingFeeAndGstFromPlanSnapshot = (row) => {
    const ps = parsePlanSnapshotObject(row.plan_snapshot);
    if (!ps || !Array.isArray(ps.fees)) return null;
    const principal = parseFloat(row.amount || row.principal_amount || 0);
    if (!(principal > 0)) return null;
    for (const f of ps.fees) {
        const name = String(f.fee_name || '')
            .trim()
            .toLowerCase();
        const method = String(f.application_method || 'deduct_from_disbursal').toLowerCase();
        if (name !== 'processing fee' || method !== 'deduct_from_disbursal') continue;
        const pct = parseFloat(f.fee_percent);
        if (Number.isNaN(pct)) continue;
        const fee = round2((principal * pct) / 100);
        const gst = round2(fee * 0.18);
        return { feeCollected: fee, gstOnFees: gst };
    }
    return null;
};

/**
 * Sum only deduct_from_disbursal lines named "processing fee" (excludes post service and accidental double-count of other deduct lines).
 */
const sumFeesBreakdownDeductProcessingFeeOnly = (raw) => {
    if (!raw) return null;
    let arr = raw;
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(arr)) return null;
    let fee = 0;
    let gst = 0;
    for (const line of arr) {
        const method = String(line.application_method || 'deduct_from_disbursal').toLowerCase();
        const feeName = String(line.fee_name || '')
            .trim()
            .toLowerCase();
        if (method !== 'deduct_from_disbursal' || feeName !== 'processing fee') continue;
        const feeAmt = parseFloat(line.fee_amount);
        const gstAmt = parseFloat(line.gst_amount);
        if (!Number.isNaN(feeAmt)) fee += feeAmt;
        if (!Number.isNaN(gstAmt)) gst += gstAmt;
    }
    fee = round2(fee);
    gst = round2(gst);
    if (fee <= 0 && gst <= 0) return null;
    if (fee <= 0 && gst > 0) fee = round2(gst / 0.18);
    else if (gst <= 0 && fee > 0) gst = round2(fee * 0.18);
    return { feeCollected: fee, gstOnFees: gst };
};

/**
 * Processing fee % for BS CSV: loan column pro_fee_per; else plan_snapshot (fees + processing_fee_percent); else derive from fee/principal.
 * @param {number} [resolvedDisbursalFee] - pre-GST disbursal fee from resolveBsDisbursalProcessingFeeAndGst
 */
const resolveBsDisbursalProcessingFeePercent = (row, resolvedDisbursalFee) => {
    const stored = row.pro_fee_per;
    if (stored != null && stored !== '' && !Number.isNaN(parseFloat(stored))) {
        return parseFloat(stored).toFixed(2);
    }
    const ps = parsePlanSnapshotObject(row.plan_snapshot);
    const fromPlan = getProcessingFeePercentFromPlanSnapshot(ps);
    if (fromPlan != null) {
        return fromPlan.toFixed(2);
    }
    const principal = parseFloat(row.amount || row.principal_amount || 0);
    const fee =
        resolvedDisbursalFee != null && !Number.isNaN(parseFloat(resolvedDisbursalFee))
            ? parseFloat(resolvedDisbursalFee)
            : parseFloat(row.p_fee || row.processing_fees || 0);
    if (principal > 0 && fee > 0) {
        return ((fee / principal) * 100).toFixed(2);
    }
    return '';
};

/**
 * BS Repayment fallback when transactions.reference_number is unavailable:
 * prefer trailing numeric id from strings like ADMIN_262_emi_2nd_1774374857752.
 */
const extractBsRepaymentReferenceNumber = (raw) => {
    if (raw == null || raw === '') return '';
    const s = String(raw).trim();
    const tailDigits = s.match(/(\d{10,})$/);
    if (tailDigits) return tailDigits[1];
    const parts = s.split('_');
    const last = parts[parts.length - 1];
    if (last && /^\d+$/.test(last)) return last;
    return s;
};

/** Map payment_orders.payment_type → BS "LOAN CLOSURE TYPE" */
const mapPaymentTypeToClosureType = (pt) => {
    if (!pt) return 'part';
    const p = String(pt);
    if (p === 'emi_1st') return 'emi1';
    if (p === 'emi_2nd') return 'emi2';
    if (p === 'emi_3rd') return 'emi3';
    if (p === 'emi_4th') return 'emi4';
    if (p === 'pre-close') return 'preclose';
    if (p === 'full_payment') return 'full';
    if (p === 'settlement') return 'settlement';
    if (p === 'loan_repayment') return 'part';
    if (p === 'preclose') return 'preclose';
    if (p === 'full') return 'full';
    if (p === 'part') return 'part';
    return 'part';
};

const emiNumberFromPaymentType = (pt) => {
    if (!pt || typeof pt !== 'string') return null;
    if (pt === 'emi_1st') return 1;
    if (pt === 'emi_2nd') return 2;
    if (pt === 'emi_3rd') return 3;
    if (pt === 'emi_4th') return 4;
    return null;
};

/**
 * Per-EMI interest + post-service fee (base + GST) using same reducing-balance logic as processing;
 * repayable fee/GST split evenly per EMI from getFullLoanCalculation totals.
 */
const buildEmiBreakdownMap = (loanRow, fullCalc) => {
    const map = new Map();
    let plan = loanRow.plan_snapshot;
    if (typeof plan === 'string') {
        try {
            plan = JSON.parse(plan);
        } catch {
            plan = {};
        }
    }
    plan = plan || {};
    const emiCount = parseInt(plan.emi_count, 10) || 1;
    const processedAmount = parseFloat(loanRow.processed_amount || loanRow.loan_amount || 0);
    const rate = parseFloat(loanRow.interest_percent_per_day || 0.001);

    let repayFeePerEmi = 0;
    let repayGstPerEmi = 0;
    if (fullCalc && fullCalc.totals && emiCount > 0) {
        repayFeePerEmi = toDecimal2((fullCalc.totals.repayableFee || 0) / emiCount);
        repayGstPerEmi = toDecimal2((fullCalc.totals.repayableFeeGST || 0) / emiCount);
    }

    if (emiCount <= 1) {
        const intAmt =
            fullCalc && fullCalc.interest && fullCalc.interest.amount != null
                ? toDecimal2(fullCalc.interest.amount)
                : 0;
        map.set(1, { interest: intAmt, postFee: repayFeePerEmi, postGst: repayGstPerEmi });
        return map;
    }

    let sched = loanRow.emi_schedule;
    if (typeof sched === 'string') {
        try {
            sched = JSON.parse(sched);
        } catch {
            sched = null;
        }
    }
    if (!Array.isArray(sched) || sched.length < emiCount) {
        for (let k = 1; k <= emiCount; k++) {
            map.set(k, { interest: 0, postFee: repayFeePerEmi, postGst: repayGstPerEmi });
        }
        return map;
    }

    const principalPerEmi = toDecimal2(Math.floor((processedAmount / emiCount) * 100) / 100);
    const remainder = toDecimal2(processedAmount - principalPerEmi * emiCount);
    const baseDateStr = parseDateToString(loanRow.processed_at);
    if (!baseDateStr) {
        for (let k = 1; k <= emiCount; k++) {
            map.set(k, { interest: 0, postFee: repayFeePerEmi, postGst: repayGstPerEmi });
        }
        return map;
    }

    let outstandingPrincipal = processedAmount;
    for (let i = 0; i < emiCount; i++) {
        const emiDateStr = String(sched[i].due_date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(emiDateStr)) continue;

        let previousDateStr;
        if (i === 0) {
            previousDateStr = baseDateStr;
        } else {
            const prevStr = String(sched[i - 1].due_date || '').slice(0, 10);
            const [py, pm, pd] = prevStr.split('-').map(Number);
            const prevDueDate = new Date(py, pm - 1, pd);
            prevDueDate.setDate(prevDueDate.getDate() + 1);
            previousDateStr = formatDateToString(prevDueDate);
        }
        if (!previousDateStr) continue;

        const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
        const principalForThisEmi =
            i === emiCount - 1 ? toDecimal2(principalPerEmi + remainder) : principalPerEmi;
        const interestForPeriod = toDecimal2(outstandingPrincipal * rate * daysForPeriod);
        outstandingPrincipal = toDecimal2(outstandingPrincipal - principalForThisEmi);

        map.set(i + 1, {
            interest: interestForPeriod,
            postFee: repayFeePerEmi,
            postGst: repayGstPerEmi
        });
    }
    return map;
};

/** CIBIL CSV column indices (0-based) to prefix with tab + quote so Excel keeps leading zeros: DOB, State, PIN, Address Category, dates, Account Type, Ownership, Asset Classification */
const CIBIL_FORCE_QUOTE_INDICES = [1, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 53];

/**
 * GET /api/admin/reports/cibil/disbursal
 * Generate CIBIL Disbursal Report CSV
 * Includes all active loans with status = 'account_manager' (disbursed loans)
 */
router.get('/cibil/disbursal', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;

        let sql = `
            SELECT 
                u.id as user_id,
                COALESCE(u.first_name, '') as first_name,
                COALESCE(u.last_name, '') as last_name,
                u.date_of_birth, u.gender, u.pan_number, u.phone, u.email,
                u.personal_email, u.official_email,
                la.id as loan_id, la.application_number, la.loan_amount,
                la.disbursal_amount, la.processing_fee, la.total_interest,
                la.total_repayable, la.disbursed_at, la.processed_at,
                la.processed_due_date, la.processed_penalty, la.status, la.plan_snapshot, la.emi_schedule,
                ${CIBIL_ADDRESS_LINE1_SUBQUERY} as address_line1,
                ${CIBIL_ADDRESS_LINE2_SUBQUERY} as address_line2,
                ${CIBIL_CITY_SUBQUERY} as city,
                ${CIBIL_STATE_NAME_SUBQUERY} as state,
                ${CIBIL_STATE_ID_SUBQUERY} as state_id,
                ${CIBIL_PINCODE_SUBQUERY} as pincode,
                ${CIBIL_COUNTRY_SUBQUERY} as country
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            WHERE la.status = 'account_manager'
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(la.disbursed_at) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY la.disbursed_at DESC`;

        const loans = await executeQuery(sql, params);

        const rows = loans.map(loan => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth);
            const gender = getGenderCode(loan.gender);
            const stateCode = formatStateCodeForCibil(loan);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            const now = new Date();
            const dateReported = formatDateDDMMYYYY(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);

            const loanAmount = parseFloat(loan.loan_amount) || 0;
            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;
            let currentBalance = parseFloat(loan.total_repayable) || 0;
            if (loan.emi_schedule) {
                try {
                    const schedule = typeof loan.emi_schedule === 'string' ? JSON.parse(loan.emi_schedule) : loan.emi_schedule;
                    const arr = Array.isArray(schedule) ? schedule : [];
                    const emi1 = arr[0] && (arr[0].emi_amount != null ? arr[0].emi_amount : arr[0].amount);
                    const emi2 = arr[1] && (arr[1].emi_amount != null ? arr[1].emi_amount : arr[1].amount);
                    const sum = (parseFloat(emi1) || 0) + (parseFloat(emi2) || 0);
                    if (sum > 0) currentBalance = Math.round(sum);
                } catch (e) { }
            }

            return [
                consumerName, dob, gender, loan.pan_number || '',
                '', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', '', '', '', '',
                formatFullAddress(loan), stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB86590001', 'SPHEETIFINTECH', 'PLL' + loan.loan_id,
                '69', '1', dateOpened, '', '', dateReported,
                Math.round(loanAmount), Math.round(currentBalance), '', '',
                '', '', '', '', '', '',
                '', '01', '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        });

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map((val, i) => escapeCSV(val, CIBIL_FORCE_QUOTE_INDICES.includes(i))).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=loan_disbursal_cibil_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating CIBIL disbursal report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/cibil/cleared
 * Generate CIBIL Cleared Report CSV - excludes settlements
 */
router.get('/cibil/cleared', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;

        let sql = `
            SELECT 
                u.id as user_id,
                COALESCE(u.first_name, '') as first_name,
                COALESCE(u.last_name, '') as last_name,
                u.date_of_birth, u.gender, u.pan_number, u.phone, u.email,
                u.personal_email, u.official_email,
                la.id as loan_id, la.application_number, la.loan_amount,
                la.disbursal_amount, la.processing_fee, la.total_interest,
                la.total_repayable, la.disbursed_at, la.processed_at,
                la.closed_date,
                la.updated_at as cleared_at, la.exhausted_period_days,
                la.processed_penalty, la.status, la.plan_snapshot,
                ${CIBIL_ADDRESS_LINE1_SUBQUERY} as address_line1,
                ${CIBIL_ADDRESS_LINE2_SUBQUERY} as address_line2,
                ${CIBIL_CITY_SUBQUERY} as city,
                ${CIBIL_STATE_NAME_SUBQUERY} as state,
                ${CIBIL_STATE_ID_SUBQUERY} as state_id,
                ${CIBIL_PINCODE_SUBQUERY} as pincode,
                ${CIBIL_COUNTRY_SUBQUERY} as country
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            WHERE la.status = 'cleared'
            AND NOT EXISTS (
                SELECT 1 FROM payment_orders po 
                WHERE po.loan_id = la.id 
                AND po.payment_type = 'settlement' AND po.status = 'PAID'
            )
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(COALESCE(la.closed_date, la.updated_at)) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY COALESCE(la.closed_date, la.updated_at) DESC`;

        const loans = await executeQuery(sql, params);

        const rows = await Promise.all(loans.map(async (loan) => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth);
            const gender = getGenderCode(loan.gender);
            const stateCode = formatStateCodeForCibil(loan);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            // Use closed_date (actual last payment/closure date); fallback to updated_at for legacy rows
            const dateLastPayment = formatDateDDMMYYYY(loan.closed_date || loan.cleared_at);
            const dateCleared = formatDateDDMMYYYY(loan.closed_date || loan.cleared_at);
            const now = new Date();
            const dateReported = formatDateDDMMYYYY(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);

            const loanAmount = parseFloat(loan.loan_amount) || 0;
            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;

            let loanDays = 30;
            if (loan.plan_snapshot) {
                try {
                    const plan = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
                    loanDays = plan.repayment_days || plan.total_duration_days || 30;
                } catch (e) { }
            }

            const exhaustedPeriod = parseInt(loan.exhausted_period_days) || 0;
            const dpd = exhaustedPeriod > loanDays ? exhaustedPeriod - loanDays : 0;
            const assetClass = getAssetClassification(dpd);

            return [
                consumerName, dob, gender, loan.pan_number || '',
                '', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', '', '', '', '',
                formatFullAddress(loan), stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB86590001', 'SPHEETIFINTECH', 'PLL' + loan.loan_id,
                '69', '1', dateOpened, dateLastPayment, dateCleared, dateReported,
                Math.round(loanAmount), 0, '', '',
                '', '', '', '', '', '',
                '', assetClass, '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        }));

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map((val, i) => escapeCSV(val, CIBIL_FORCE_QUOTE_INDICES.includes(i))).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=loan_cleared_cibil_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating CIBIL cleared report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/cibil/settled
 * Generate CIBIL Settled Report CSV - includes Written-off calculations
 */
router.get('/cibil/settled', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;

        let sql = `
            SELECT 
                u.id as user_id,
                COALESCE(u.first_name, '') as first_name,
                COALESCE(u.last_name, '') as last_name,
                u.date_of_birth, u.gender, u.pan_number, u.phone, u.email,
                u.personal_email, u.official_email,
                la.id as loan_id, la.application_number, la.loan_amount,
                la.disbursal_amount, la.processing_fee, la.total_interest,
                la.total_repayable, la.disbursed_at, la.processed_at,
                la.updated_at as cleared_at, la.exhausted_period_days,
                la.processed_penalty, la.status, la.plan_snapshot,
                po.amount as settlement_amount, po.updated_at as settlement_date,
                ${CIBIL_ADDRESS_LINE1_SUBQUERY} as address_line1,
                ${CIBIL_ADDRESS_LINE2_SUBQUERY} as address_line2,
                ${CIBIL_CITY_SUBQUERY} as city,
                ${CIBIL_STATE_NAME_SUBQUERY} as state,
                ${CIBIL_STATE_ID_SUBQUERY} as state_id,
                ${CIBIL_PINCODE_SUBQUERY} as pincode,
                ${CIBIL_COUNTRY_SUBQUERY} as country
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            INNER JOIN payment_orders po ON po.loan_id = la.id AND po.payment_type = 'settlement' AND po.status = 'PAID'
            WHERE la.status IN ('cleared', 'settled')
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(po.updated_at) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY po.updated_at DESC`;

        const loans = await executeQuery(sql, params);

        const rows = await Promise.all(loans.map(async (loan) => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth);
            const gender = getGenderCode(loan.gender);
            const stateCode = formatStateCodeForCibil(loan);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            const dateCleared = formatDateDDMMYYYY(loan.cleared_at || loan.settlement_date);
            const now = new Date();
            const dateReported = formatDateDDMMYYYY(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);

            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;
            let loanAmount = parseFloat(loan.loan_amount) || 0;
            let totalAmount = loanAmount + processingFee + gst;
            let serviceCharge = parseFloat(loan.total_interest) || 0;
            let penaltyCharge = parseFloat(loan.processed_penalty) || 0;
            let settlementAmount = parseFloat(loan.settlement_amount) || 0;

            let totalOutstanding = loanAmount + processingFee + gst + serviceCharge + penaltyCharge;
            let writtenOffTotal = Math.max(0, Math.ceil(totalOutstanding - settlementAmount));

            const paidResult = await executeQuery(
                `SELECT COALESCE(SUM(amount), 0) as total_paid FROM loan_payments WHERE loan_id = ?`,
                [loan.loan_id]
            );
            const totalPaid = parseFloat(paidResult[0]?.total_paid) || 0;
            let writtenOffPrincipal = loanAmount - totalPaid;
            writtenOffPrincipal = writtenOffPrincipal <= 0 ? 1 : Math.ceil(writtenOffPrincipal);

            let loanDays = 30;
            if (loan.plan_snapshot) {
                try {
                    const plan = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
                    loanDays = plan.repayment_days || plan.total_duration_days || 30;
                } catch (e) { }
            }

            const exhaustedPeriod = parseInt(loan.exhausted_period_days) || 0;
            const dpd = exhaustedPeriod > loanDays ? exhaustedPeriod - loanDays : 0;
            const assetClass = getAssetClassification(dpd);

            return [
                consumerName, dob, gender, loan.pan_number || '',
                '', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', '', '', '', '',
                formatFullAddress(loan), stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB86590001', 'SPHEETIFINTECH', 'PLL' + loan.loan_id,
                '69', '1', dateOpened, dateCleared, dateCleared, dateReported,
                Math.round(loanAmount), 0, '', '',
                '', '', '', '', '', '',
                '03', assetClass, '', '', '', '',
                '', '', '', writtenOffTotal, writtenOffPrincipal,
                Math.round(settlementAmount), '', '', '', '',
                '', '', '', ''
            ];
        }));

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map((val, i) => escapeCSV(val, CIBIL_FORCE_QUOTE_INDICES.includes(i))).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=loan_settlement_cibil_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating CIBIL settled report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/cibil/default
 * Generate CIBIL Default Report CSV - loans with DPD > 0
 */
router.get('/cibil/default', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();

        let sql = `
            SELECT 
                u.id as user_id,
                COALESCE(u.first_name, '') as first_name,
                COALESCE(u.last_name, '') as last_name,
                u.date_of_birth, u.gender, u.pan_number, u.phone, u.email,
                u.personal_email, u.official_email,
                la.id as loan_id, la.application_number, la.loan_amount,
                la.disbursal_amount, la.processing_fee, la.total_interest,
                la.total_repayable, la.disbursed_at, la.processed_at,
                la.processed_due_date, la.exhausted_period_days,
                la.processed_penalty, la.status, la.plan_snapshot,
                ${CIBIL_ADDRESS_LINE1_SUBQUERY} as address_line1,
                ${CIBIL_ADDRESS_LINE2_SUBQUERY} as address_line2,
                ${CIBIL_CITY_SUBQUERY} as city,
                ${CIBIL_STATE_NAME_SUBQUERY} as state,
                ${CIBIL_STATE_ID_SUBQUERY} as state_id,
                ${CIBIL_PINCODE_SUBQUERY} as pincode,
                ${CIBIL_COUNTRY_SUBQUERY} as country
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            WHERE la.status = 'account_manager'
            ORDER BY la.processed_at DESC
        `;

        const loans = await executeQuery(sql, []);

        const defaultLoans = [];
        for (const loan of loans) {
            let loanDays = 30;
            if (loan.plan_snapshot) {
                try {
                    const plan = typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot;
                    loanDays = plan.repayment_days || plan.total_duration_days || 30;
                } catch (e) { }
            }
            // Use actual due date (processed_due_date) when available so extended loans are not wrongly included
            const dpd = calculateDPDForDefault(loan);
            if (dpd > 0) {
                defaultLoans.push({ ...loan, calculated_dpd: dpd, loan_days: loanDays });
            }
        }

        defaultLoans.sort((a, b) => b.calculated_dpd - a.calculated_dpd);

        const rows = defaultLoans.map(loan => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth) || '01011970';
            const gender = getGenderCode(loan.gender);
            const stateCode = formatStateCodeForCibil(loan);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at) || '01011970';
            const now = new Date();
            const dateReported = formatDateDDMMYYYY(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);

            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;
            let loanAmount = parseFloat(loan.loan_amount) || 0;
            let totalAmount = loanAmount + processingFee + gst;
            let serviceCharge = parseFloat(loan.total_interest) || 0;
            let penaltyCharge = parseFloat(loan.processed_penalty) || 0;
            let currentBalance = Math.ceil(totalAmount + serviceCharge + penaltyCharge);

            const dpd = loan.calculated_dpd;
            const suitFiled = dpd > 60 ? '01' : '';

            return [
                consumerName, dob, gender, loan.pan_number || '',
                '', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', '', '', '', '',
                formatFullAddress(loan), stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB86590001', 'SPHEETIFINTECH', 'PLL' + loan.loan_id,
                '69', '1', dateOpened, '', '', dateReported,
                Math.round(loanAmount), currentBalance, currentBalance, dpd,
                '', '', '', '', '', suitFiled,
                '', '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        });

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map((val, i) => escapeCSV(val, CIBIL_FORCE_QUOTE_INDICES.includes(i))).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=loan_default_cibil_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating CIBIL default report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/bs/repayment
 * Generate BS Repayment Report CSV - based on transaction_details
 */
router.get('/bs/repayment', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;

        const GST_RATE = 0.18;
        const GST_FACTOR = 1.18;
        const DAILY_INTEREST_RATE = 0.001; // 0.1% as a decimal

        // Try new structure first (payment_orders + loan_payments)
        // Join with state_codes table to convert state code to state name
        let sql = `
            SELECT 
                CONCAT('PC', LPAD(u.id, 5, '0')) as rcid, 
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as pan_name,
                ${CIBIL_STATE_NAME_SUBQUERY} as state_name,
                la.id as lid, la.disbursal_amount as processed_amount, 
                la.processing_fee as p_fee, la.total_interest as service_charge, 
                la.processed_penalty as penality_charge,
                la.loan_amount AS principal_amount,
                la.loan_amount AS amount,
                la.processing_fee as processing_fees, 
                la.processing_fee_percent as pro_fee_per, 
                COALESCE(la.interest_percent_per_day * 100, 0) as interest_percentage,
                COALESCE(lp.transaction_id, po.order_id) as transaction_number,
                (
                    SELECT t.reference_number
                    FROM transactions t
                    WHERE t.loan_application_id = la.id
                      AND t.transaction_type NOT IN ('loan_disbursement')
                      AND t.transaction_type NOT LIKE 'loan_extension%'
                      AND (
                          t.description LIKE CONCAT('%Order: ', po.order_id, '%')
                          OR t.reference_number = po.order_id
                      )
                    ORDER BY t.id DESC
                    LIMIT 1
                ) AS payment_reference_number,
                COALESCE(lp.payment_date, po.updated_at) as transaction_date, 
                po.payment_type as payment_type,
                COALESCE(lp.amount, po.amount) as transaction_amount,
                la.processed_at AS loan_start_date,
                la.fees_breakdown as fees_breakdown,
                la.processed_p_fee as processed_p_fee,
                la.processed_post_service_fee as processed_post_service_fee,
                la.processed_gst as processed_gst,
                la.plan_snapshot as plan_snapshot,
                la.emi_schedule as emi_schedule,
                la.interest_percent_per_day as interest_percent_per_day
            FROM payment_orders po
            INNER JOIN loan_applications la ON la.id = po.loan_id
            INNER JOIN users u ON u.id = la.user_id
            LEFT JOIN loan_payments lp ON lp.loan_id = po.loan_id AND lp.transaction_id = po.order_id
            WHERE po.status = 'PAID'
            AND po.payment_type IN ('settlement', 'pre-close', 'full_payment', 'loan_repayment', 'emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th')
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(COALESCE(lp.payment_date, po.updated_at)) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY COALESCE(lp.payment_date, po.updated_at) DESC`;

        let rows;
        try {
            rows = await executeQuery(sql, params);
        } catch (error) {
            // Fallback to old transaction_details structure if new structure doesn't work
            console.warn('New payment structure not found, trying old transaction_details:', error.message);
            sql = `
                SELECT 
                    u.rcid, u.pan_name, u.state_code,
                    l.lid, l.processed_amount, l.p_fee, l.service_charge, l.penality_charge,
                    la.amount AS principal_amount, la.amount AS amount, la.processing_fees, la.pro_fee_per, la.interest_percentage,
                    td.transaction_number, td.transaction_date, td.transaction_flow AS payment_type, td.transaction_amount,
                    l.processed_date AS loan_start_date,
                    NULL as fees_breakdown, NULL as processed_p_fee, NULL as processed_post_service_fee, NULL as processed_gst,
                    NULL as plan_snapshot, NULL as emi_schedule, NULL as interest_percent_per_day,
                    NULL AS payment_reference_number
                FROM transaction_details td
                INNER JOIN loan_apply la ON la.id = td.cllid
                INNER JOIN user u ON u.id = la.uid
                INNER JOIN loan l ON l.lid = td.cllid
                WHERE td.transaction_flow IN ('settlement', 'part', 'renew', 'full', 'preclose')
            `;

            const params2 = [];
            if (from_date && to_date) {
                sql += ` AND DATE(td.transaction_date) BETWEEN ? AND ?`;
                params2.push(from_date, to_date);
            }
            sql += ` ORDER BY td.transaction_date DESC`;
            rows = await executeQuery(sql, params2);
        }

        // State comes directly from addresses table, no mapping needed

        const csvRows = [];
        const headers = [
            'PCID', 'Name', 'Ledger Name', 'Reg.Type', 'Master type', 'Voucher No. (or PLLID)',
            'Loan Process Date', 'Exhausted Days',
            'Sanctioned Amount', 'Disbursal Amount', 'Narration Journal', 'Reference No. (or Payout ID)',
            'Mode', 'Status', 'LoanDate', 'Country', 'State', 'Processing fee %', 'Processing Fees Collected',
            'GST Amount on Processing Fees', 'Post Service Fee (ex GST)', 'GST on Post Service Fee', 'INTEREST (%)', 'LOAN CLOSURE TYPE',
            'INTEREST COLLECTED', 'PENALTY', 'GST On PENALTY',
            'REPAYMENT AMOUNT'
        ];
        /** BS Repayment CSV: preserve leading zeros for Voucher No (PLL+id), Loan Process Date, LoanDate */
        const BS_REPAYMENT_DATE_INDICES = [5, 6, 14];
        csvRows.push(headers.map(escapeCSV).join(','));

        const uniqueLids = [...new Set((rows || []).map((r) => r.lid))];
        const emiBreakdownByLoan = new Map();
        for (const lid of uniqueLids) {
            try {
                const fullCalc = await getFullLoanCalculation(lid);
                const [loanRow] = await executeQuery(
                    `SELECT id, loan_amount, processed_amount, processed_at, plan_snapshot, emi_schedule, interest_percent_per_day
                     FROM loan_applications WHERE id = ?`,
                    [lid]
                );
                if (loanRow) {
                    emiBreakdownByLoan.set(lid, buildEmiBreakdownMap(loanRow, fullCalc));
                }
            } catch (e) {
                console.warn(`BS repayment: EMI breakdown cache failed for loan ${lid}:`, e.message);
            }
        }

        for (const row of rows) {
            // Voucher No: PLL + loan_application.id (unique)
            const voucher_no = 'PLL' + row.lid;
            const paymentType = row.payment_type || '';
            const loan_closure_type = mapPaymentTypeToClosureType(paymentType);
            const isPreclosePayment =
                paymentType === 'pre-close' ||
                paymentType === 'preclose' ||
                loan_closure_type === 'preclose';

            const { feeCollected: processing_fee_collected, gstOnFees: gst_on_processing_fees } =
                resolveBsDisbursalProcessingFeeAndGst(row);
            const pro_fee_pct = resolveBsDisbursalProcessingFeePercent(row, processing_fee_collected);

            const principal_amt = parseFloat(row.principal_amount) || 0;
            const disbursed_amount = parseFloat(row.processed_amount) || 0;
            const sanctioned_amount = principal_amt; // Sanctioned Amount = Principal loan amount only

            let interest_collected = 0;
            let post_service_fee_ex_gst = 0;
            let post_service_fee_gst = 0;
            let penalty = 0;
            let gst_on_penalty = 0;
            let exhausted_days = 0;

            if (row.loan_start_date) {
                const loan_start_date = new Date(row.loan_start_date);
                const repayment_date = new Date(row.transaction_date);

                loan_start_date.setHours(0, 0, 0, 0);
                repayment_date.setHours(0, 0, 0, 0);

                const diffTime = repayment_date - loan_start_date;
                exhausted_days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }

            const repayment_amt = parseFloat(row.transaction_amount) || 0;
            const extra_amount = repayment_amt - sanctioned_amount;

            const emiNum = emiNumberFromPaymentType(paymentType);
            if (emiNum != null) {
                const bdMap = emiBreakdownByLoan.get(row.lid);
                const bd = bdMap?.get(emiNum);
                if (bd) {
                    interest_collected = bd.interest;
                    post_service_fee_ex_gst = toDecimal2(bd.postFee);
                    post_service_fee_gst = toDecimal2(bd.postGst);
                }
            } else if (
                row.loan_start_date &&
                (extra_amount > 0 || (isPreclosePayment && sanctioned_amount > 0))
            ) {
                const ratePerDay = parseFloat(row.interest_percent_per_day);
                const dailyRate =
                    !Number.isNaN(ratePerDay) && ratePerDay > 0 ? ratePerDay : DAILY_INTEREST_RATE;
                const calculated_interest = toDecimal2(sanctioned_amount * dailyRate * exhausted_days);

                // Pre-close: repayment = principal + interest till date + 10% pre-close fee + GST on that fee (payment.js).
                // Do not attribute full (repayment − principal) to interest — that double-counts fees already in Post Service columns.
                if (isPreclosePayment) {
                    interest_collected = calculated_interest;
                    penalty = 0;
                    gst_on_penalty = 0;
                } else if (extra_amount > 0 && extra_amount > calculated_interest && exhausted_days > 30) {
                    interest_collected = calculated_interest;
                    const remainder_for_penalty = extra_amount - calculated_interest;

                    penalty = remainder_for_penalty / GST_FACTOR;
                    gst_on_penalty = penalty * GST_RATE;
                } else if (extra_amount > 0) {
                    interest_collected = extra_amount;
                    penalty = 0;
                    gst_on_penalty = 0;
                }
            }

            // Pre-close (matches calculatePaymentAmount in payment.js): fixed 10% of sanctioned principal + 18% GST
            if (isPreclosePayment && sanctioned_amount > 0) {
                const preclosePostFee = toDecimal2(sanctioned_amount * 0.1);
                post_service_fee_ex_gst = preclosePostFee;
                post_service_fee_gst = toDecimal2(preclosePostFee * GST_RATE);
            }

            const loanDate = row.loan_start_date ? formatDateDDMMYYYY(row.loan_start_date) : '';
            const transactionDate = row.transaction_date ? formatDateDDMMYYYY(row.transaction_date) : '';
            const pr = row.payment_reference_number;
            const refNo =
                pr != null && String(pr).trim() !== ''
                    ? String(pr).trim()
                    : extractBsRepaymentReferenceNumber(row.transaction_number);

            const data = [
                row.rcid || '',
                row.pan_name || '',
                '', '', '',
                voucher_no,
                loanDate,
                exhausted_days,
                sanctioned_amount.toFixed(2),
                disbursed_amount,
                'REPAYMENT DONE',
                refNo,
                '',
                'received',
                transactionDate,
                'India',
                row.state_name || '',
                pro_fee_pct,
                processing_fee_collected.toFixed(2),
                gst_on_processing_fees.toFixed(2),
                emiNum != null || isPreclosePayment ? post_service_fee_ex_gst.toFixed(2) : (0).toFixed(2),
                emiNum != null || isPreclosePayment ? post_service_fee_gst.toFixed(2) : (0).toFixed(2),
                row.interest_percentage || '',
                loan_closure_type,
                interest_collected.toFixed(2),
                penalty.toFixed(2),
                gst_on_penalty.toFixed(2),
                repayment_amt.toFixed(2)
            ];

            csvRows.push(data.map((val, i) => escapeCSV(val, BS_REPAYMENT_DATE_INDICES.includes(i))).join(','));
        }

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=bs_repayment_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating BS repayment report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/bs/disbursal
 * Generate BS Disbursal Report CSV - based on transaction_details
 */
router.get('/bs/disbursal', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;
        
        console.log('📊 BS Disbursal Report - Date filters:', { from_date, to_date });

        // Try new structure first (loan_applications)
        // Join with state_codes table to convert state code to state name
        let sql = `
            SELECT 
                CONCAT('PC', LPAD(u.id, 5, '0')) as rcid,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as pan_name,
                ${CIBIL_STATE_NAME_SUBQUERY} as state_name,
                la.id as lid, la.loan_amount as amount, la.processing_fee as processing_fees,
                la.disbursal_amount as processed_amount, la.processing_fee as p_fee,
                la.exhausted_period_days as exhausted_period, la.processed_at as processed_date,
                la.processing_fee_percent as pro_fee_per,
                la.emi_schedule as emi_schedule,
                la.processed_due_date as processed_due_date,
                la.plan_snapshot as plan_snapshot,
                la.fees_breakdown as fees_breakdown,
                la.processed_p_fee as processed_p_fee,
                la.processed_post_service_fee as processed_post_service_fee,
                la.processed_gst as processed_gst
            FROM loan_applications la
            INNER JOIN users u ON u.id = la.user_id
            WHERE la.status IN ('account_manager', 'cleared')
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(la.processed_at) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }

        let rows;
        try {
            rows = await executeQuery(sql, params);
            console.log('📊 BS Disbursal Report - Query returned:', rows.length, 'rows');
        } catch (error) {
            // Fallback to old structure if new doesn't work
            console.warn('New loan_applications structure not found, trying old loan/loan_apply tables:', error.message);
            sql = `
                SELECT 
                    u.rcid, u.pan_name, u.state_code, 
                    l.lid, la.amount, la.processing_fees, l.processed_amount, l.p_fee, 
                    l.exhausted_period, l.processed_date, la.pro_fee_per,
                    NULL as emi_schedule, NULL as processed_due_date, NULL as plan_snapshot,
                    NULL as fees_breakdown, NULL as processed_p_fee, NULL as processed_post_service_fee, NULL as processed_gst
                FROM loan l 
                INNER JOIN loan_apply la ON la.id = l.lid 
                INNER JOIN user u ON u.id = la.uid 
                WHERE l.status_log IN ('account manager','cleared')
            `;

            const params2 = [];
            if (from_date && to_date) {
                sql += ` AND DATE(l.processed_date) BETWEEN ? AND ?`;
                params2.push(from_date, to_date);
            }
            rows = await executeQuery(sql, params2);
        }

        // State comes directly from addresses table, no mapping needed

        const csvRows = [];
        const headers = [
            'PCID (Account ID)', 'Name', 'Ledger Name', 'Reg.Type', 'Master type', 'Voucher No. (or PLLID)',
            'Sanctioned Amount', 'Disbursal Amount', 'Reference No. (or Payout ID)', 'Mode', 'Status', 'LoanDate',
            'Country', 'State', 'Processing fee %', 'Tenure', 'Processing Fees Collected', 'GST Amount on Processing Fees',
            'Check', 'Remarks'
        ];
        /** BS Disbursal CSV: preserve leading zeros for Voucher No (PLL+id), LoanDate */
        const BS_DISBURSAL_PRESERVE_INDICES = [5, 11];
        csvRows.push(headers.map(escapeCSV).join(','));

        for (const row of rows) {
            // Voucher No: PLL + loan_application.id (unique)
            const voucher_no = 'PLL' + row.lid;

            // Try to get transaction number from transactions table (loan_disbursement)
            let tno = 0;
            try {
                const trnum = await executeQuery(
                    `SELECT reference_number FROM transactions WHERE loan_application_id=? AND transaction_type='loan_disbursement' LIMIT 1`,
                    [row.lid]
                );
                if (trnum.length > 0 && trnum[0].reference_number) {
                    tno = trnum[0].reference_number;
                }
            } catch (error) {
                // Ignore if transactions table doesn't exist or query fails
                console.warn('Could not fetch transaction reference number:', error.message);
            }

            const sanctioned_amount = parseFloat(row.amount || 0); // Principal loan amount only
            const { feeCollected: processing_fee_collected, gstOnFees: gst_on_processing_fee } =
                resolveBsDisbursalProcessingFeeAndGst(row);

            const loanDate = row.processed_date ? formatDateDDMMYYYY(row.processed_date) : '';
            const proFeePct = resolveBsDisbursalProcessingFeePercent(row, processing_fee_collected);
            const tenureDays = getBsDisbursalTenureDays(row);

            const data = [
                row.rcid || '',
                row.pan_name || '',
                '', '', '',
                voucher_no,
                sanctioned_amount,
                row.processed_amount || 0,
                tno,
                '',
                'Disbursed',
                loanDate,
                'India',
                row.state_name || '',
                proFeePct,
                tenureDays > 0 ? tenureDays : '',
                processing_fee_collected.toFixed(2),
                gst_on_processing_fee.toFixed(2),
                '',
                ''
            ];

            csvRows.push(data.map((val, i) => escapeCSV(val, BS_DISBURSAL_PRESERVE_INDICES.includes(i))).join(','));
        }

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=bs_loan_disbursal_file_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error generating BS disbursal report:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate report', error: error.message });
    }
});

/**
 * GET /api/admin/reports/summary
 * Get report summary/statistics
 */
router.get('/summary', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();

        const stats = await executeQuery(`
            SELECT 
                COUNT(*) as total_loans,
                SUM(CASE WHEN status = 'account_manager' THEN 1 ELSE 0 END) as active_loans,
                SUM(CASE WHEN status = 'cleared' THEN 1 ELSE 0 END) as cleared_loans,
                SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_loans,
                SUM(CASE WHEN status IN ('default', 'overdue', 'delinquent') THEN 1 ELSE 0 END) as default_loans,
                SUM(CASE WHEN status = 'account_manager' THEN loan_amount ELSE 0 END) as active_amount,
                SUM(CASE WHEN status = 'cleared' THEN loan_amount ELSE 0 END) as cleared_amount
            FROM loan_applications
        `);

        res.json({ status: 'success', data: stats[0] });

    } catch (error) {
        console.error('Error getting report summary:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get report summary', error: error.message });
    }
});

/**
 * GET /api/admin/reports/disbursal-statistics
 * Disbursal statistics by account manager (synergi): count and total principal moved to account manager in date range.
 * Query: from_date, to_date (YYYY-MM-DD).
 */
router.get('/disbursal-statistics', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { from_date, to_date } = req.query;
        const today = new Date().toISOString().slice(0, 10);
        const fromDate = from_date || today;
        const toDate = to_date || today;

        const rows = await executeQuery(
            `SELECT 
                la.assigned_account_manager_id AS account_manager_id,
                a.name AS account_manager_name,
                COUNT(*) AS ids_moved,
                COALESCE(SUM(la.loan_amount), 0) AS total_principal
             FROM loan_applications la
             LEFT JOIN admins a ON a.id = la.assigned_account_manager_id COLLATE utf8mb4_unicode_ci
             WHERE la.status = 'account_manager'
               AND DATE(la.processed_at) BETWEEN ? AND ?
             GROUP BY la.assigned_account_manager_id, a.name
             ORDER BY ids_moved DESC`,
            [fromDate, toDate]
        );

        const data = (rows || []).map(r => ({
            account_manager_id: r.account_manager_id,
            account_manager_name: r.account_manager_name || 'Unassigned',
            ids_moved: Number(r.ids_moved) || 0,
            total_principal: Number(r.total_principal) || 0
        }));

        res.json({ status: 'success', data: { from_date: fromDate, to_date: toDate, synergi: data } });
    } catch (error) {
        console.error('Error getting disbursal statistics:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get disbursal statistics', error: error.message });
    }
});

module.exports = router;
