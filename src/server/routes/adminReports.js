const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');

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

const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
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

const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

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
                la.processed_due_date, la.processed_penalty, la.status, la.plan_snapshot,
                (SELECT a.address_line1 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line1,
                (SELECT a.address_line2 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line2,
                (SELECT a.city FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as city,
                (SELECT a.state FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state,
                (SELECT a.pincode FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as pincode
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
            const stateCode = getStateCode(loan.state);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            const dateReported = formatDateDDMMYYYY(new Date());

            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;
            let totalAmount = (parseFloat(loan.loan_amount) || 0) + processingFee + gst;
            let currentBalance = parseFloat(loan.total_repayable) || totalAmount;

            return [
                consumerName, dob, gender, loan.pan_number || '',
                '', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', '', '', '', '',
                loan.address_line1 || '', stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB36250001', 'POCKETCR', loan.application_number || `PC${loan.loan_id}`,
                '69', '1', dateOpened, '', '', dateReported,
                Math.round(totalAmount), Math.round(currentBalance), '', '',
                '', '', '', '', '', '',
                '', '01', '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        });

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

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
                la.updated_at as cleared_at, la.exhausted_period_days,
                la.processed_penalty, la.status, la.plan_snapshot,
                (SELECT a.address_line1 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line1,
                (SELECT a.address_line2 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line2,
                (SELECT a.city FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as city,
                (SELECT a.state FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state,
                (SELECT a.pincode FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as pincode
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            WHERE la.status = 'cleared'
            AND NOT EXISTS (
                SELECT 1 FROM loan_payments lp 
                WHERE lp.loan_application_id = la.id 
                AND lp.payment_type = 'settlement'
            )
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(la.updated_at) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY la.updated_at DESC`;

        const loans = await executeQuery(sql, params);

        const rows = await Promise.all(loans.map(async (loan) => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth);
            const gender = getGenderCode(loan.gender);
            const stateCode = getStateCode(loan.state);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            const dateCleared = formatDateDDMMYYYY(loan.cleared_at);
            const dateReported = formatDateDDMMYYYY(new Date());

            let processingFee = parseFloat(loan.processing_fee) || 0;
            let gst = processingFee * 0.18;
            let totalAmount = (parseFloat(loan.loan_amount) || 0) + processingFee + gst;

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
                loan.address_line1 || '', stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB36250001', 'POCKETCR', loan.application_number || `PC${loan.loan_id}`,
                '69', '1', dateOpened, dateCleared, dateCleared, dateReported,
                Math.round(totalAmount), 0, '', '',
                '', '', '', '', '', '',
                '', assetClass, '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        }));

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

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
                lp.amount as settlement_amount, lp.payment_date as settlement_date,
                (SELECT a.address_line1 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line1,
                (SELECT a.address_line2 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line2,
                (SELECT a.city FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as city,
                (SELECT a.state FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state,
                (SELECT a.pincode FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as pincode
            FROM loan_applications la
            INNER JOIN users u ON la.user_id = u.id
            INNER JOIN loan_payments lp ON lp.loan_application_id = la.id AND lp.payment_type = 'settlement'
            WHERE la.status IN ('cleared', 'settled')
        `;

        const params = [];
        if (from_date && to_date) {
            sql += ` AND DATE(lp.payment_date) BETWEEN ? AND ?`;
            params.push(from_date, to_date);
        }
        sql += ` ORDER BY lp.payment_date DESC`;

        const loans = await executeQuery(sql, params);

        const rows = await Promise.all(loans.map(async (loan) => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth);
            const gender = getGenderCode(loan.gender);
            const stateCode = getStateCode(loan.state);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at);
            const dateCleared = formatDateDDMMYYYY(loan.cleared_at || loan.settlement_date);
            const dateReported = formatDateDDMMYYYY(new Date());

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
                `SELECT COALESCE(SUM(amount), 0) as total_paid FROM loan_payments WHERE loan_application_id = ?`,
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
                loan.address_line1 || '', stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB36250001', 'POCKETCR', loan.application_number || `PC${loan.loan_id}`,
                '69', '1', dateOpened, dateCleared, dateCleared, dateReported,
                Math.round(totalAmount), 0, '', '',
                '', '', '', '', '', '',
                '03', assetClass, '', '', '', '',
                '', '', '', writtenOffTotal, writtenOffPrincipal,
                Math.round(settlementAmount), '', '', '', '',
                '', '', '', ''
            ];
        }));

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

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
                (SELECT a.address_line1 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line1,
                (SELECT a.address_line2 FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as address_line2,
                (SELECT a.city FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as city,
                (SELECT a.state FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state,
                (SELECT a.pincode FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as pincode
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

            const dpd = calculateDPD(loan.processed_at, loanDays);
            if (dpd > 0) {
                defaultLoans.push({ ...loan, calculated_dpd: dpd, loan_days: loanDays });
            }
        }

        defaultLoans.sort((a, b) => b.calculated_dpd - a.calculated_dpd);

        const rows = defaultLoans.map(loan => {
            const consumerName = `${loan.first_name} ${loan.last_name}`.trim();
            const dob = formatDateDDMMYYYY(loan.date_of_birth) || '01011970';
            const gender = getGenderCode(loan.gender);
            const stateCode = getStateCode(loan.state);
            const dateOpened = formatDateDDMMYYYY(loan.disbursed_at || loan.processed_at) || '01011970';
            const dateReported = formatDateDDMMYYYY(new Date());

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
                loan.address_line1 || '', stateCode, loan.pincode || '', '02', '',
                '', '', '', '', '',
                'NB36250001', 'POCKETCR', loan.application_number || `PC${loan.loan_id}`,
                '69', '1', dateOpened, '', '', dateReported,
                Math.round(totalAmount), currentBalance, currentBalance, dpd,
                '', '', '', '', '', suitFiled,
                '', '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', '', '',
                '', '', '', ''
            ];
        });

        const csvContent = [CIBIL_HEADERS.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');

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
                (SELECT sc.state_name FROM addresses a 
                 LEFT JOIN state_codes sc ON sc.id = a.state 
                 WHERE a.user_id = u.id 
                 ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state_name,
                la.id as lid, la.disbursal_amount as processed_amount, 
                la.processing_fee as p_fee, la.total_interest as service_charge, 
                la.processed_penalty as penality_charge,
                la.loan_amount AS principal_amount, la.processing_fee as processing_fees, 
                la.processing_fee_percent as pro_fee_per, 
                COALESCE(la.interest_percent_per_day * 100, 0) as interest_percentage,
                COALESCE(lp.transaction_id, po.order_id) as transaction_number, 
                COALESCE(lp.payment_date, po.updated_at) as transaction_date, 
                CASE 
                    WHEN po.payment_type = 'pre-close' THEN 'preclose'
                    WHEN po.payment_type = 'full_payment' THEN 'full'
                    WHEN po.payment_type = 'settlement' THEN 'settlement'
                    ELSE 'part'
                END as transaction_flow,
                COALESCE(lp.amount, po.amount) as transaction_amount,
                la.processed_at AS loan_start_date
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
                    la.amount AS principal_amount, la.processing_fees, la.pro_fee_per, la.interest_percentage,
                    td.transaction_number, td.transaction_date, td.transaction_flow, td.transaction_amount,
                    l.processed_date AS loan_start_date
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
            'Mode', 'Status', 'LoanDate', 'Country', 'State', 'Processing fee(%)', 'Processing Fees Collected',
            'GST Amount on Processing Fees', 'INTEREST (%)', 'LOAN CLOSURE TYPE', 'INTEREST COLLECTED', 'PENALTY', 'GST On PENALTY',
            'REPAYMENT AMOUNT'
        ];
        csvRows.push(headers.map(escapeCSV).join(','));

        for (const row of rows) {
            // Voucher No: PLL + loan_application.id (unique)
            const voucher_no = 'PLL' + row.lid;
            const loan_closure_type = row.transaction_flow;

            const processing_fee_collected = row.transaction_flow === 'part' ? 'P.P' : (row.processing_fees || row.p_fee || 0);
            const gst_on_processing_fees = row.transaction_flow === 'part' ? 'P.P' : ((row.processing_fees || row.p_fee || 0) * GST_RATE);

            const principal_amt = parseFloat(row.principal_amount) || 0;
            const disbursed_amount = parseFloat(row.processed_amount) || 0;
            const sanctioned_amount = principal_amt; // Sanctioned Amount = Principal loan amount only

            const pf_numeric = isNaN(row.processing_fees) ? (parseFloat(row.p_fee) || 0) : (parseFloat(row.processing_fees) || 0);

            let interest_collected = 0;
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

            if (extra_amount > 0 && row.loan_start_date) {
                const calculated_interest = sanctioned_amount * DAILY_INTEREST_RATE * exhausted_days;

                if ((extra_amount > calculated_interest) && (exhausted_days > 30)) {
                    interest_collected = calculated_interest;
                    const remainder_for_penalty = extra_amount - calculated_interest;

                    penalty = remainder_for_penalty / GST_FACTOR;
                    gst_on_penalty = penalty * GST_RATE;
                } else {
                    interest_collected = extra_amount;
                    penalty = 0;
                    gst_on_penalty = 0;
                }
            }

            const loanDate = row.loan_start_date ? new Date(row.loan_start_date).toLocaleDateString('en-GB').replace(/\//g, '-') : '';
            const transactionDate = row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('en-GB').replace(/\//g, '-') : '';

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
                row.transaction_number || '',
                '',
                'received',
                transactionDate,
                'India',
                row.state_name || '',
                row.pro_fee_per || '',
                processing_fee_collected === 'P.P' ? 'P.P' : processing_fee_collected.toFixed(2),
                gst_on_processing_fees === 'P.P' ? 'P.P' : gst_on_processing_fees.toFixed(2),
                row.interest_percentage || '',
                loan_closure_type,
                interest_collected.toFixed(2),
                penalty.toFixed(2),
                gst_on_penalty.toFixed(2),
                repayment_amt.toFixed(2)
            ];

            csvRows.push(data.map(escapeCSV).join(','));
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
                (SELECT sc.state_name FROM addresses a 
                 LEFT JOIN state_codes sc ON sc.id = a.state 
                 WHERE a.user_id = u.id 
                 ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as state_name,
                la.id as lid, la.loan_amount as amount, la.processing_fee as processing_fees,
                la.disbursal_amount as processed_amount, la.processing_fee as p_fee,
                la.exhausted_period_days as exhausted_period, la.processed_at as processed_date,
                la.processing_fee_percent as pro_fee_per
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
                    l.exhausted_period, l.processed_date, la.pro_fee_per
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
            'Country', 'State', 'Processing fee(%)', 'Tenure', 'Processing Fees Collected', 'GST Amount on Processing Fees',
            'Check', 'Remarks'
        ];
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
            const processing_fee = parseFloat(row.p_fee || row.processing_fees || 0);
            const gst_amount = processing_fee * 0.18;
            
            let loanDate = '';
            if (row.processed_date) {
                const date = new Date(row.processed_date);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                loanDate = `${day}/${month}/${year}`;
            }

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
                row.pro_fee_per || '',
                30,
                processing_fee,
                gst_amount.toFixed(2),
                '',
                ''
            ];

            csvRows.push(data.map(escapeCSV).join(','));
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

module.exports = router;
