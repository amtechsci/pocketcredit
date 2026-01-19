/**
 * BRE (Business Rules Engine) Service
 * Evaluates credit analytics data against business rules
 * Auto-triggered when user selects salary date on employment-details page
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
      creditFacilityCheck: this.checkCreditFacilityAndSuitFiled(creditReport),
      creditScoreCheck: this.checkCreditScore(creditReport)
    };

    const allPassed = Object.values(breResults).every(result => result.passed);
    const failedReasons = Object.values(breResults)
      .filter(result => !result.passed)
      .flatMap(result => result.reasons);

    return {
      passed: allPassed,
      reasons: failedReasons,
      breResults
    };
  }

  /**
   * Check: Amount Overdue loans > 4 in last 6 months (by reported date)
   */
  checkAmountOverdue(creditReport) {
    try {
      const accounts = creditReport?.result?.result_json?.INProfileResponse?.CAIS_Account?.CAIS_Account_DETAILS || [];
      
      if (!accounts || accounts.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 4,
          reasons: []
        };
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let overdueCount = 0;
      const overdueAccounts = [];

      accounts.forEach(account => {
        // Check if account has overdue amount
        const amountPastDue = parseFloat(account.Amount_Past_Due || account.Amount_Overdue || 0);
        
        if (amountPastDue > 0) {
          // Check reported date (Date_Reported format: YYYYMMDD)
          const reportedDateStr = account.Date_Reported;
          if (reportedDateStr) {
            const year = parseInt(reportedDateStr.substring(0, 4));
            const month = parseInt(reportedDateStr.substring(4, 6)) - 1; // Month is 0-indexed
            const day = parseInt(reportedDateStr.substring(6, 8));
            const reportedDate = new Date(year, month, day);

            if (reportedDate >= sixMonthsAgo) {
              overdueCount++;
              overdueAccounts.push({
                subscriber: account.Subscriber_Name,
                accountNumber: account.Account_Number,
                amountOverdue: amountPastDue,
                reportedDate: reportedDateStr
              });
            }
          }
        }
      });

      const passed = overdueCount <= 4;
      
      return {
        passed,
        count: overdueCount,
        threshold: 4,
        reasons: passed ? [] : [`Amount Overdue loans (${overdueCount}) exceed threshold (4) in last 6 months`],
        details: overdueAccounts
      };
    } catch (error) {
      console.error('Error checking Amount Overdue:', error);
      return {
        passed: false,
        count: 0,
        threshold: 4,
        reasons: ['Error evaluating Amount Overdue condition']
      };
    }
  }

  /**
   * Check: Enquiry count > 6 in last 30 days
   */
  checkEnquiryCount(creditReport) {
    try {
      const enquiryData = creditReport?.result?.result_json?.INProfileResponse?.CAPS || {};
      // Fixed: Use CAPS_Application_Details (actual field name in Experian response)
      const enquiryDetails = enquiryData.CAPS_Application_Details || enquiryData.CAPS_Details || enquiryData.CAPS_Enquiry_Details || [];
      
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
        // Fixed: Use Date_of_Request (actual field name in Experian response)
        const enquiryDateStr = enquiry.Date_of_Request || enquiry.Date_Of_Enquiry || enquiry.Enquiry_Date || enquiry.Date;
        
        if (enquiryDateStr) {
          let enquiryDate;
          
          // Handle YYYYMMDD format
          if (enquiryDateStr.length === 8 && /^\d+$/.test(enquiryDateStr)) {
            const year = parseInt(enquiryDateStr.substring(0, 4));
            const month = parseInt(enquiryDateStr.substring(4, 6)) - 1;
            const day = parseInt(enquiryDateStr.substring(6, 8));
            enquiryDate = new Date(year, month, day);
          } else {
            // Try parsing as ISO date string
            enquiryDate = new Date(enquiryDateStr);
          }

          if (!isNaN(enquiryDate.getTime()) && enquiryDate >= thirtyDaysAgo) {
            enquiryCount++;
            recentEnquiries.push({
              subscriber: enquiry.Subscriber_Name || enquiry.Enquirer_Name,
              enquiryDate: enquiryDateStr,
              purpose: enquiry.Purpose_Of_Enquiry || enquiry.Purpose
            });
          }
        }
      });

      const passed = enquiryCount <= 6;
      
      return {
        passed,
        count: enquiryCount,
        threshold: 6,
        reasons: passed ? [] : [`Enquiry count (${enquiryCount}) exceeds threshold (6) in last 30 days`],
        details: recentEnquiries
      };
    } catch (error) {
      console.error('Error checking Enquiry Count:', error);
      return {
        passed: false,
        count: 0,
        threshold: 6,
        reasons: ['Error evaluating Enquiry Count condition']
      };
    }
  }

  /**
   * Check: Credit facility "03" OR "SuitFiled Willful Default" > 3 in last 6 months
   */
  checkCreditFacilityAndSuitFiled(creditReport) {
    try {
      const accounts = creditReport?.result?.result_json?.INProfileResponse?.CAIS_Account?.CAIS_Account_DETAILS || [];
      
      if (!accounts || accounts.length === 0) {
        return {
          passed: true,
          count: 0,
          threshold: 3,
          reasons: []
        };
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let violationCount = 0;
      const violations = [];

      accounts.forEach(account => {
        let hasViolation = false;
        let violationType = '';

        // Fixed: Use Account_Type (actual field name in Experian response)
        // Account_Type "03" = Credit Card
        if (account.Account_Type === '03' || account.Credit_Facility === '03' || account.Credit_Facility_Type === '03') {
          hasViolation = true;
          violationType = 'Credit Facility 03';
        }

        // Check SuitFiled Willful Default (not "00")
        if (account.SuitFiled_WilfulDefault && account.SuitFiled_WilfulDefault !== '00') {
          hasViolation = true;
          violationType = violationType ? `${violationType} & SuitFiled Willful Default` : 'SuitFiled Willful Default';
        }

        if (hasViolation) {
          // Check reported date
          const reportedDateStr = account.Date_Reported;
          if (reportedDateStr) {
            const year = parseInt(reportedDateStr.substring(0, 4));
            const month = parseInt(reportedDateStr.substring(4, 6)) - 1;
            const day = parseInt(reportedDateStr.substring(6, 8));
            const reportedDate = new Date(year, month, day);

            if (reportedDate >= sixMonthsAgo) {
              violationCount++;
              violations.push({
                subscriber: account.Subscriber_Name,
                accountNumber: account.Account_Number,
                violationType,
                reportedDate: reportedDateStr,
                accountType: account.Account_Type,
                creditFacility: account.Credit_Facility || account.Credit_Facility_Type,
                suitFiled: account.SuitFiled_WilfulDefault
              });
            }
          }
        }
      });

      const passed = violationCount <= 3;
      
      return {
        passed,
        count: violationCount,
        threshold: 3,
        reasons: passed ? [] : [`Credit Facility 03 or SuitFiled Willful Default violations (${violationCount}) exceed threshold (3) in last 6 months`],
        details: violations
      };
    } catch (error) {
      console.error('Error checking Credit Facility and SuitFiled:', error);
      return {
        passed: false,
        count: 0,
        threshold: 3,
        reasons: ['Error evaluating Credit Facility/SuitFiled condition']
      };
    }
  }

  /**
   * Check: Experian score < 580
   */
  checkCreditScore(creditReport) {
    try {
      const creditScore = creditReport?.result?.result_json?.INProfileResponse?.SCORE?.BureauScore;
      const score = creditScore ? parseInt(creditScore) : null;

      if (score === null) {
        return {
          passed: false,
          score: null,
          threshold: 580,
          reasons: ['Credit score not available']
        };
      }

      const passed = score >= 580;
      
      return {
        passed,
        score,
        threshold: 580,
        reasons: passed ? [] : [`Credit score (${score}) is below minimum requirement (580)`]
      };
    } catch (error) {
      console.error('Error checking Credit Score:', error);
      return {
        passed: false,
        score: null,
        threshold: 580,
        reasons: ['Error evaluating Credit Score condition']
      };
    }
  }
}

module.exports = new BREEngineService();
