/**
 * Credit Report Parser
 * Parses Experian credit report JSON and extracts structured data
 */

/**
 * Extract unique mobile numbers and email IDs from credit report
 * @param {object} creditReport - Full credit report JSON
 * @returns {object} - { mobileNumbers: [], emails: [] }
 */
function extractContactDetails(creditReport) {
    const mobileNumbers = new Set();
    const emails = new Set();

    try {
        const profileResponse = creditReport?.result?.result_json?.INProfileResponse ||
            creditReport?.INProfileResponse ||
            creditReport;

        // Extract from CAIS_Account_DETAILS (loan accounts)
        const accounts = profileResponse?.CAIS_Account?.CAIS_Account_DETAILS || [];

        for (const account of accounts) {
            // From CAIS_Holder_Phone_Details
            const phoneDetails = account?.CAIS_Holder_Phone_Details || [];
            for (const phone of phoneDetails) {
                if (phone?.Mobile_Telephone_Number) {
                    // Clean mobile number (remove country code if present)
                    let mobile = String(phone.Mobile_Telephone_Number).replace(/\D/g, '');
                    if (mobile.startsWith('91') && mobile.length === 12) {
                        mobile = mobile.substring(2);
                    }
                    if (mobile.length === 10) {
                        mobileNumbers.add(mobile);
                    }
                }
                if (phone?.Telephone_Number) {
                    const tel = String(phone.Telephone_Number).replace(/\D/g, '');
                    if (tel.length >= 10) {
                        mobileNumbers.add(tel.slice(-10));
                    }
                }
                if (phone?.EMailId && phone.EMailId.includes('@')) {
                    emails.add(phone.EMailId.toUpperCase());
                }
            }

            // From CAIS_Holder_ID_Details
            const idDetails = account?.CAIS_Holder_ID_Details || [];
            for (const id of idDetails) {
                if (id?.EMailId && id.EMailId.includes('@')) {
                    emails.add(id.EMailId.toUpperCase());
                }
            }
        }

        // Extract from CAPS (Credit Application Details)
        const capsApplications = profileResponse?.CAPS?.CAPS_Application_Details || [];
        for (const app of capsApplications) {
            const applicantDetails = app?.CAPS_Applicant_Details || {};
            if (applicantDetails?.MobilePhoneNumber) {
                let mobile = String(applicantDetails.MobilePhoneNumber).replace(/\D/g, '');
                if (mobile.startsWith('91') && mobile.length === 12) {
                    mobile = mobile.substring(2);
                }
                if (mobile.length === 10) {
                    mobileNumbers.add(mobile);
                }
            }
            if (applicantDetails?.EMailId && applicantDetails.EMailId.includes('@')) {
                emails.add(applicantDetails.EMailId.toUpperCase());
            }
        }

        // Extract from Current_Application
        const currentApp = profileResponse?.Current_Application?.Current_Application_Details?.Current_Applicant_Details || {};
        if (currentApp?.MobilePhoneNumber) {
            let mobile = String(currentApp.MobilePhoneNumber).replace(/\D/g, '');
            if (mobile.startsWith('91') && mobile.length === 12) {
                mobile = mobile.substring(2);
            }
            if (mobile.length === 10) {
                mobileNumbers.add(mobile);
            }
        }
        if (currentApp?.EMailId && currentApp.EMailId.includes('@')) {
            emails.add(currentApp.EMailId.toUpperCase());
        }

    } catch (error) {
        console.error('Error extracting contact details:', error);
    }

    return {
        mobileNumbers: Array.from(mobileNumbers),
        emails: Array.from(emails)
    };
}

/**
 * Parse account status from Account_Status code
 * @param {string} status - Account status code
 * @returns {string} - 'active', 'closed', or 'other'
 */
function parseAccountStatus(status) {
    const statusCode = String(status || '');
    // 11 = Active/Current, 13 = Closed
    // Full list: 11=Current, 12=Delinquent, 13=Closed, 21=Writeoff, etc.
    const activeStatuses = ['11', '12', '21', '22', '23', '24', '25', '30', '31', '32', '40', '41', '42', '43', '44', '51', '52', '53', '54'];
    const closedStatuses = ['13', '14', '15', '16', '17'];

    if (closedStatuses.includes(statusCode)) {
        return 'closed';
    } else if (activeStatuses.includes(statusCode)) {
        return 'active';
    }
    return statusCode ? 'active' : 'unknown'; // Default to active if has status
}

/**
 * Get max days past due from account history
 * @param {array} history - CAIS_Account_History array
 * @returns {number} - Maximum days past due
 */
function getMaxDaysPastDue(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return 0;
    }

    let maxDPD = 0;
    for (const record of history) {
        const dpd = parseInt(record?.Days_Past_Due) || 0;
        if (dpd > maxDPD) {
            maxDPD = dpd;
        }
    }
    return maxDPD;
}

/**
 * Get current (latest) days past due
 * @param {array} history - CAIS_Account_History array
 * @returns {number} - Current days past due
 */
function getCurrentDaysPastDue(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return 0;
    }

    // Sort by Year and Month descending to get latest
    const sorted = [...history].sort((a, b) => {
        const yearA = parseInt(a.Year) || 0;
        const yearB = parseInt(b.Year) || 0;
        if (yearB !== yearA) return yearB - yearA;
        const monthA = parseInt(a.Month) || 0;
        const monthB = parseInt(b.Month) || 0;
        return monthB - monthA;
    });

    return parseInt(sorted[0]?.Days_Past_Due) || 0;
}

/**
 * Parse a single loan account
 * @param {object} account - CAIS_Account_DETAILS item
 * @returns {object} - Parsed account data
 */
function parseAccount(account) {
    const holderDetails = account?.CAIS_Holder_Details?.[0] || {};
    const phoneDetails = account?.CAIS_Holder_Phone_Details?.[0] || {};
    const addressDetails = account?.CAIS_Holder_Address_Details?.[0] || {};
    const history = account?.CAIS_Account_History || [];

    // Format dates from YYYYMMDD to YYYY-MM-DD
    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return null;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    };

    // Determine account status
    const status = parseAccountStatus(account?.Account_Status);
    const isClosed = status === 'closed' || account?.Date_Closed !== null;

    return {
        // Account identification
        account_number: account?.Account_Number || '',
        subscriber_name: account?.Subscriber_Name || '',
        account_type: account?.Account_Type || '',
        account_type_name: getAccountTypeName(account?.Account_Type),

        // Status
        account_status: account?.Account_Status || '',
        status_description: status,
        is_closed: isClosed,

        // Dates
        open_date: formatDate(account?.Open_Date),
        date_closed: formatDate(account?.Date_Closed),
        date_reported: formatDate(account?.Date_Reported),
        date_of_last_payment: formatDate(account?.Date_of_Last_Payment),

        // Amounts
        current_balance: parseInt(account?.Current_Balance) || 0,
        amount_past_due: parseInt(account?.Amount_Past_Due) || 0,
        highest_credit: parseInt(account?.Highest_Credit_or_Original_Loan_Amount) || 0,
        credit_limit: parseInt(account?.Credit_Limit_Amount) || 0,

        // Days Past Due
        days_past_due: getCurrentDaysPastDue(history),
        max_days_past_due: getMaxDaysPastDue(history),

        // Negative indicators
        written_off_settled_status: account?.Written_off_Settled_Status || null,
        written_off_amt_total: parseInt(account?.Written_Off_Amt_Total) || 0,
        written_off_amt_principal: parseInt(account?.Written_Off_Amt_Principal) || 0,
        suit_filed_wilful_default: account?.SuitFiled_WilfulDefault || null,
        settlement_amount: parseInt(account?.Settlement_Amount) || 0,

        // Tenure
        repayment_tenure: parseInt(account?.Repayment_Tenure) || 0,
        terms_duration: account?.Terms_Duration || '',

        // Other
        portfolio_type: account?.Portfolio_Type || '', // I = Individual, J = Joint
        ownership_type: account?.AccountHoldertypeCode || '',

        // Contact (for reference)
        email: phoneDetails?.EMailId || '',
        mobile: phoneDetails?.Mobile_Telephone_Number || '',

        // Address
        address: addressDetails?.First_Line_Of_Address_non_normalized || '',
        state: addressDetails?.State_non_normalized || '',
        pincode: addressDetails?.ZIP_Postal_Code_non_normalized || '',

        // Full history for detailed view
        payment_history: history,
        payment_history_profile: account?.Payment_History_Profile || ''
    };
}

/**
 * Get account type name from code
 * @param {string} code - Account type code
 * @returns {string} - Account type name
 */
function getAccountTypeName(code) {
    const accountTypes = {
        '01': 'Auto Loan',
        '02': 'Housing Loan',
        '03': 'Property Loan',
        '04': 'Loan Against Shares',
        '05': 'Personal Loan',
        '06': 'Consumer Loan',
        '07': 'Gold Loan',
        '08': 'Education Loan',
        '09': 'Loan to Professional',
        '10': 'Credit Card',
        '11': 'Leasing',
        '12': 'Overdraft',
        '13': 'Two Wheeler Loan',
        '14': 'Non-Funded Credit Facility',
        '15': 'Loan Against Bank Deposits',
        '16': 'Fleet Card',
        '17': 'Commercial Vehicle Loan',
        '18': 'Telco – Wireless',
        '19': 'Telco – Broadband',
        '20': 'Telco – Landline',
        '21': 'Others',
        '31': 'Kisan Credit Card',
        '32': 'Loan on Credit Card',
        '33': 'Prime Minister Jeevan Jyoti Bima Yojana',
        '34': 'Mudra Loans – Shishu / Kishor / Tarun',
        '35': 'Mudra Loans – Shishu',
        '36': 'Mudra Loans – Kishor',
        '37': 'Mudra Loans – Tarun',
        '38': 'Pradhan Mantri Awas Yojana – Credit Linked Subsidy Scheme MAY CLSS',
        '39': 'P2P Personal Loan',
        '40': 'P2P Auto Loan',
        '41': 'P2P Education Loan',
        '43': 'Microfinance – Business Loan',
        '44': 'Microfinance – Personal Loan',
        '45': 'Microfinance – Housing Loan',
        '46': 'Microfinance – Other',
        '51': 'Business Loan – General',
        '52': 'Business Loan – Priority Sector – Small Business',
        '53': 'Business Loan – Priority Sector – Agriculture',
        '54': 'Business Loan – Priority Sector – Others',
        '55': 'Business Non-Funded Credit Facility – General',
        '56': 'Business Loan against Bank Deposits',
        '57': 'Staff Loan',
        '61': 'Used Car Loan',
        '69': 'Personal Loan', // BNPL/Short-term personal loans
        '00': 'Other'
    };
    return accountTypes[code] || `Unknown (${code})`;
}

/**
 * Parse complete credit report and categorize accounts
 * @param {object} creditReport - Full credit report JSON
 * @returns {object} - Categorized accounts and summary
 */
function parseCreditReport(creditReport) {
    const result = {
        // Summary from report
        credit_score: 0,
        report_date: null,
        total_accounts: 0,
        active_accounts_count: 0,
        closed_accounts_count: 0,
        total_outstanding: 0,

        // Contact details
        contact_details: {
            mobile_numbers: [],
            emails: []
        },

        // Categorized accounts
        active_accounts: [],
        closed_accounts: [],

        // Flagged accounts
        written_off_accounts: [],
        suit_filed_accounts: [],

        // CAPS summary
        caps_summary: {
            last_7_days: 0,
            last_30_days: 0,
            last_90_days: 0,
            last_180_days: 0
        }
    };

    try {
        const profileResponse = creditReport?.result?.result_json?.INProfileResponse ||
            creditReport?.INProfileResponse ||
            creditReport;

        // Get credit score
        result.credit_score = parseInt(profileResponse?.SCORE?.BureauScore) || 0;

        // Get report date
        const reportDate = profileResponse?.CreditProfileHeader?.ReportDate;
        if (reportDate && reportDate.length === 8) {
            result.report_date = `${reportDate.substring(0, 4)}-${reportDate.substring(4, 6)}-${reportDate.substring(6, 8)}`;
        }

        // Get CAPS summary
        const capsSummary = profileResponse?.CAPS?.CAPS_Summary || {};
        result.caps_summary = {
            last_7_days: parseInt(capsSummary?.CAPSLast7Days) || 0,
            last_30_days: parseInt(capsSummary?.CAPSLast30Days) || 0,
            last_90_days: parseInt(capsSummary?.CAPSLast90Days) || 0,
            last_180_days: parseInt(capsSummary?.CAPSLast180Days) || 0
        };

        // Get credit summary
        const creditSummary = profileResponse?.CAIS_Account?.CAIS_Summary?.Credit_Account || {};
        result.total_accounts = parseInt(creditSummary?.CreditAccountTotal) || 0;
        result.active_accounts_count = parseInt(creditSummary?.CreditAccountActive) || 0;
        result.closed_accounts_count = parseInt(creditSummary?.CreditAccountClosed) || 0;

        // Get total outstanding
        const outstandingSummary = profileResponse?.CAIS_Account?.CAIS_Summary?.Total_Outstanding_Balance || {};
        result.total_outstanding = parseInt(outstandingSummary?.Outstanding_Balance_All) || 0;

        // Extract contact details
        result.contact_details = extractContactDetails(creditReport);

        // Parse all accounts
        const accounts = profileResponse?.CAIS_Account?.CAIS_Account_DETAILS || [];
        const currentYear = new Date().getFullYear();

        // Written_off_Settled_Status codes to flag (00-17)
        const writtenOffCodes = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

        // SuitFiled_WilfulDefault codes to flag (00-03)
        const suitFiledCodes = ['00', '01', '02', '03'];

        for (const account of accounts) {
            const parsed = parseAccount(account);

            // Categorize by status
            if (parsed.is_closed) {
                // Check if closed in current year based on Date_Reported
                const reportYear = parsed.date_reported ? parseInt(parsed.date_reported.substring(0, 4)) : 0;
                if (reportYear === currentYear || reportYear === currentYear - 1) {
                    result.closed_accounts.push(parsed);
                } else {
                    // Still add older closed accounts but they won't be in "latest 30"
                    result.closed_accounts.push(parsed);
                }
            } else {
                result.active_accounts.push(parsed);
            }

            // Check for written off status
            if (parsed.written_off_settled_status && writtenOffCodes.includes(parsed.written_off_settled_status)) {
                result.written_off_accounts.push(parsed);
            }

            // Check for suit filed
            if (parsed.suit_filed_wilful_default && suitFiledCodes.includes(parsed.suit_filed_wilful_default)) {
                result.suit_filed_accounts.push(parsed);
            }
        }

        // Sort closed accounts by Date_Reported (latest first) and limit to 30
        result.closed_accounts.sort((a, b) => {
            const dateA = a.date_reported || '0000-00-00';
            const dateB = b.date_reported || '0000-00-00';
            return dateB.localeCompare(dateA);
        });

        // Store full list and create separate "latest 30" field
        result.closed_accounts_latest_30 = result.closed_accounts.slice(0, 30);

        // Sort active accounts by current_balance (highest first)
        result.active_accounts.sort((a, b) => b.current_balance - a.current_balance);

    } catch (error) {
        console.error('Error parsing credit report:', error);
    }

    return result;
}

/**
 * Written_off_Settled_Status code meanings
 */
const WRITTEN_OFF_STATUS_CODES = {
    '00': 'Restructured Loan',
    '01': 'Restructured Loan - Loss',
    '02': 'Suit Filed',
    '03': 'Wilful Default',
    '04': 'Suit Filed (Wilful Default)',
    '05': 'Written-Off',
    '06': 'Written-Off (Wilful Default)',
    '07': 'Settled',
    '08': 'Settled (Wilful Default)',
    '09': 'Post (WO) Settled',
    '10': 'Post (WO) Settled (Wilful Default)',
    '11': 'Account Sold',
    '12': 'Account Sold (Wilful Default)',
    '13': 'Account Purchased',
    '14': 'Account Purchased (Wilful Default)',
    '15': 'RBI-DCCO',
    '16': 'RBI-DCCO (Wilful Default)',
    '17': 'Satisfaction of Decree'
};

/**
 * SuitFiled_WilfulDefault code meanings
 */
const SUIT_FILED_CODES = {
    '00': 'No Suit Filed',
    '01': 'Suit Filed',
    '02': 'Wilful Default',
    '03': 'Suit Filed and Wilful Default'
};

/**
 * Get description for Written_off_Settled_Status code
 * @param {string} code - Status code
 * @returns {string} - Description
 */
function getWrittenOffStatusDescription(code) {
    return WRITTEN_OFF_STATUS_CODES[code] || `Unknown (${code})`;
}

/**
 * Get description for SuitFiled_WilfulDefault code
 * @param {string} code - Status code
 * @returns {string} - Description
 */
function getSuitFiledDescription(code) {
    return SUIT_FILED_CODES[code] || `Unknown (${code})`;
}

module.exports = {
    extractContactDetails,
    parseAccount,
    parseCreditReport,
    getAccountTypeName,
    getWrittenOffStatusDescription,
    getSuitFiledDescription,
    WRITTEN_OFF_STATUS_CODES,
    SUIT_FILED_CODES
};
