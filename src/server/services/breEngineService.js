/**
 * BRE (Business Rules Engine) Service
 * Evaluates credit analytics data against business rules
 * Auto-triggered when user selects salary date on employment-details page
 * 
 * BRE CONDITIONS FOR REJECTION:
 * 1. More than 4 loans with "Amount Overdue" in last 6 months of date_reported
 * 2. Enquiry count > 6 in last 30 days
 * 3. More than 2 accounts with Written_off_Settled_Status (00-17) in last 6 months
 * 4. More than 2 accounts with SuitFiled_WilfulDefault (01, 02, 03) in last 6 months
 * 5. Experian score < 580
 */

class BREEngineService {
  /**
   * Evaluate all BRE conditions
   * @param {Object} creditReport - Full credit report from Experian API
   * @returns {Object} BRE evaluation result
   */
  evaluateBREConditions(creditReport) {
    if (!creditReport) {
      return {
        passed: false,
        reasons: ['Credit report data not available'],
        breResults: {}
      };
    }

    const breResults = {
      amountOverdueCheck: this.checkAmountOverdue(creditReport),
      enquiryCountCheck: this.checkEnquiryCount(creditReport),
      writtenOffCheck: this.checkWrittenOffSettledStatus(creditReport),
      suitFiledCheck: this.checkSuitFiledWilfulDefault(creditReport),
      creditScoreCheck: this.checkCreditScore(creditReport)
    };

    const allPassed = Object.values(breResults).every(result => result.passed);
    const failedReasons = Object.values(breResults)
      .filter(result => !result.passed)
      .flatMap(result => result.reasons);

    console.log('📊 BRE Engine Evaluation Complete:');
    console.log(`   - Amount Overdue: ${breResults.amountOverdueCheck.passed ? '✅ PASS' : '❌ FAIL'} (${breResults.amountOverdueCheck.count}/${breResults.amountOverdueCheck.threshold})`);
    console.log(`   - Enquiry Count: ${breResults.enquiryCountCheck.passed ? '✅ PASS' : '❌ FAIL'} (${breResults.enquiryCountCheck.count}/${breResults.enquiryCountCheck.threshold})`);
    console.log(`   - Written Off/Settled: ${breResults.writtenOffCheck.passed ? '✅ PASS' : '❌ FAIL'} (${breResults.writtenOffCheck.count}/${breResults.writtenOffCheck.threshold})`);
    console.log(`   - Suit Filed/Wilful Default: ${breResults.suitFiledCheck.passed ? '✅ PASS' : '❌ FAIL'} (${breResults.suitFiledCheck.count}/${breResults.suitFiledCheck.threshold})`);
    console.log(`   - Credit Score: ${breResults.creditScoreCheck.passed ? '✅ PASS' : '❌ FAIL'} (Score: ${breResults.creditScoreCheck.score}, Min: ${breResults.creditScoreCheck.threshold})`);
    console.log(`   - Overall Result: ${allPassed ? '✅ PASSED' : '❌ REJECTED'}`);

    return {
      passed: allPassed,
      reasons: failedReasons,
      breResults
    };
  }

  /**
   * Parse date from YYYYMMDD format
   * @param {string} dateStr - Date string in YYYYMMDD format
   * @returns {Date|null} - Parsed date or null
   */
  parseExperianDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Check if date is within last N months
   * @param {Date} date - Date to check
   * @param {number} months - Number of months ago
   * @returns {boolean}
   */
  isWithinLastMonths(date, months) {
    if (!date) return false;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return date >= cutoffDate;
  }

  /**
   * Get CAIS account details from credit report
   */
  getAccountDetails(creditReport) {
    return creditReport?.result?.result_json?.INProfileResponse?.CAIS_Account?.CAIS_Account_DETAILS ||
      creditReport?.INProfileResponse?.CAIS_Account?.CAIS_Account_DETAILS ||
      [];
  }

  /**
   * BRE RULE 1: Amount Overdue loans > 4 in last 6 months (by date_reported)
   * Checks loans where Amount_Past_Due > 0 and Date_Reported is within last 6 months
   */
  checkAmountOverdue(creditReport) {
    try {
      const accounts = this.getAccountDetails(creditReport);

      if (!accounts || accounts.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 4,
          reasons: []
        };
      }

      let overdueCount = 0;
      const overdueAccounts = [];

      accounts.forEach(account => {
        // Check if account has overdue amount
        const amountPastDue = parseFloat(account.Amount_Past_Due) || 0;

        if (amountPastDue > 0) {
          // Check if date_reported is within last 6 months
          const reportedDate = this.parseExperianDate(account.Date_Reported);

          if (this.isWithinLastMonths(reportedDate, 6)) {
            overdueCount++;
            overdueAccounts.push({
              subscriber: account.Subscriber_Name,
              accountNumber: account.Account_Number,
              amountOverdue: amountPastDue,
              reportedDate: account.Date_Reported
            });
          }
        }
      });

      // RULE: More than 4 overdue accounts = REJECT
      const passed = overdueCount <= 4;

      return {
        passed,
        count: overdueCount,
        threshold: 4,
        reasons: passed ? [] : [`Amount Overdue loans (${overdueCount}) exceed threshold (4) in last 6 months`],
        details: overdueAccounts
      };
    } catch (error) {
      console.error('BRE: Error checking Amount Overdue:', error);
      return {
        passed: true, // Don't fail on error - allow manual review
        count: 0,
        threshold: 4,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * BRE RULE 2: Enquiry count > 6 in last 30 days
   * Checks CAPS_Application_Details for recent enquiries
   */
  checkEnquiryCount(creditReport) {
    try {
      const capsData = creditReport?.result?.result_json?.INProfileResponse?.CAPS ||
        creditReport?.INProfileResponse?.CAPS || {};

      // Use CAPS Summary for 30-day count (most reliable)
      const capsLast30Days = parseInt(capsData?.CAPS_Summary?.CAPSLast30Days) || 0;

      // If summary is available, use it directly
      if (capsLast30Days > 0) {
        const passed = capsLast30Days <= 6;
        return {
          passed,
          count: capsLast30Days,
          threshold: 6,
          reasons: passed ? [] : [`Enquiry count (${capsLast30Days}) exceeds threshold (6) in last 30 days`],
          source: 'CAPS_Summary'
        };
      }

      // Fallback: Count from CAPS_Application_Details manually
      const enquiryDetails = capsData.CAPS_Application_Details || [];

      if (!enquiryDetails || enquiryDetails.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 6,
          reasons: []
        };
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let enquiryCount = 0;
      const recentEnquiries = [];

      enquiryDetails.forEach(enquiry => {
        const enquiryDate = this.parseExperianDate(enquiry.Date_of_Request);

        if (enquiryDate && enquiryDate >= thirtyDaysAgo) {
          enquiryCount++;
          recentEnquiries.push({
            subscriber: enquiry.Subscriber_Name,
            enquiryDate: enquiry.Date_of_Request,
            reason: enquiry.Enquiry_Reason
          });
        }
      });

      // RULE: More than 6 enquiries = REJECT
      const passed = enquiryCount <= 6;

      return {
        passed,
        count: enquiryCount,
        threshold: 6,
        reasons: passed ? [] : [`Enquiry count (${enquiryCount}) exceeds threshold (6) in last 30 days`],
        details: recentEnquiries
      };
    } catch (error) {
      console.error('BRE: Error checking Enquiry Count:', error);
      return {
        passed: true, // Don't fail on error
        count: 0,
        threshold: 6,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * BRE RULE 3: More than 2 accounts with Written_off_Settled_Status (00-17) in last 6 months
   * 
   * Written_off_Settled_Status codes:
   * 00 - Restructured Loan
   * 01 - Restructured Loan - Loss
   * 02 - Suit Filed
   * 03 - Wilful Default
   * 04 - Suit Filed (Wilful Default)
   * 05 - Written-Off
   * 06 - Written-Off (Wilful Default)
   * 07 - Settled
   * 08 - Settled (Wilful Default)
   * 09 - Post (WO) Settled
   * 10 - Post (WO) Settled (Wilful Default)
   * 11 - Account Sold
   * 12 - Account Sold (Wilful Default)
   * 13 - Account Purchased
   * 14 - Account Purchased (Wilful Default)
   * 15 - RBI-DCCO
   * 16 - RBI-DCCO (Wilful Default)
   * 17 - Satisfaction of Decree
   */
  checkWrittenOffSettledStatus(creditReport) {
    try {
      const accounts = this.getAccountDetails(creditReport);

      if (!accounts || accounts.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 2,
          reasons: []
        };
      }

      // Valid Written_off_Settled_Status codes (00-17)
      const writtenOffCodes = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

      let flaggedCount = 0;
      const flaggedAccounts = [];

      accounts.forEach(account => {
        const status = account.Written_off_Settled_Status;

        // Check if status is in the flagged codes list
        if (status && writtenOffCodes.includes(status)) {
          // Check if date_reported is within last 6 months
          const reportedDate = this.parseExperianDate(account.Date_Reported);

          if (this.isWithinLastMonths(reportedDate, 6)) {
            flaggedCount++;
            flaggedAccounts.push({
              subscriber: account.Subscriber_Name,
              accountNumber: account.Account_Number,
              writtenOffStatus: status,
              statusDescription: this.getWrittenOffStatusDescription(status),
              reportedDate: account.Date_Reported,
              currentBalance: account.Current_Balance
            });
          }
        }
      });

      // RULE: More than 2 written-off/settled accounts = REJECT
      const passed = flaggedCount <= 2;

      return {
        passed,
        count: flaggedCount,
        threshold: 2,
        reasons: passed ? [] : [`Written-off/Settled accounts (${flaggedCount}) exceed threshold (2) in last 6 months`],
        details: flaggedAccounts
      };
    } catch (error) {
      console.error('BRE: Error checking Written Off Settled Status:', error);
      return {
        passed: true, // Don't fail on error
        count: 0,
        threshold: 2,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * BRE RULE 4: More than 2 accounts with SuitFiled_WilfulDefault (01, 02, 03) in last 6 months
   * 
   * SuitFiled_WilfulDefault codes:
   * 00 - No Suit Filed (ALLOWED)
   * 01 - Suit Filed (FLAGGED)
   * 02 - Wilful Default (FLAGGED)
   * 03 - Suit Filed and Wilful Default (FLAGGED)
   */
  checkSuitFiledWilfulDefault(creditReport) {
    try {
      const accounts = this.getAccountDetails(creditReport);

      if (!accounts || accounts.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 2,
          reasons: []
        };
      }

      // SuitFiled_WilfulDefault codes to flag (01, 02, 03) - NOT 00 which means "No Suit Filed"
      const suitFiledCodes = ['01', '02', '03'];

      let flaggedCount = 0;
      const flaggedAccounts = [];

      accounts.forEach(account => {
        const status = account.SuitFiled_WilfulDefault;

        // Check if status is in the flagged codes list (01, 02, 03)
        if (status && suitFiledCodes.includes(status)) {
          // Check if date_reported is within last 6 months
          const reportedDate = this.parseExperianDate(account.Date_Reported);

          if (this.isWithinLastMonths(reportedDate, 6)) {
            flaggedCount++;
            flaggedAccounts.push({
              subscriber: account.Subscriber_Name,
              accountNumber: account.Account_Number,
              suitFiledStatus: status,
              statusDescription: this.getSuitFiledStatusDescription(status),
              reportedDate: account.Date_Reported,
              currentBalance: account.Current_Balance,
              amountOverdue: account.Amount_Past_Due
            });
          }
        }
      });

      // RULE: More than 2 suit-filed/wilful default accounts = REJECT
      const passed = flaggedCount <= 2;

      return {
        passed,
        count: flaggedCount,
        threshold: 2,
        reasons: passed ? [] : [`Suit Filed/Wilful Default accounts (${flaggedCount}) exceed threshold (2) in last 6 months`],
        details: flaggedAccounts
      };
    } catch (error) {
      console.error('BRE: Error checking Suit Filed Wilful Default:', error);
      return {
        passed: true, // Don't fail on error
        count: 0,
        threshold: 2,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * BRE RULE 5: Experian score < 580 = REJECT
   */
  checkCreditScore(creditReport) {
    try {
      const creditScore = creditReport?.result?.result_json?.INProfileResponse?.SCORE?.BureauScore ||
        creditReport?.INProfileResponse?.SCORE?.BureauScore;
      const score = creditScore ? parseInt(creditScore) : null;

      if (score === null || isNaN(score)) {
        return {
          passed: false,
          score: null,
          threshold: 580,
          reasons: ['Credit score not available in report']
        };
      }

      // RULE: Score < 580 = REJECT
      const passed = score >= 580;

      return {
        passed,
        score,
        threshold: 580,
        reasons: passed ? [] : [`Credit score (${score}) is below minimum requirement (580)`]
      };
    } catch (error) {
      console.error('BRE: Error checking Credit Score:', error);
      return {
        passed: false,
        score: null,
        threshold: 580,
        reasons: ['Error evaluating Credit Score condition'],
        error: error.message
      };
    }
  }

  /**
   * Get description for Written_off_Settled_Status code
   */
  getWrittenOffStatusDescription(code) {
    const descriptions = {
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
    return descriptions[code] || `Unknown (${code})`;
  }

  /**
   * Get description for SuitFiled_WilfulDefault code
   */
  getSuitFiledStatusDescription(code) {
    const descriptions = {
      '00': 'No Suit Filed',
      '01': 'Suit Filed',
      '02': 'Wilful Default',
      '03': 'Suit Filed and Wilful Default'
    };
    return descriptions[code] || `Unknown (${code})`;
  }
}

module.exports = new BREEngineService();
