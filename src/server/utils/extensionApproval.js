/**
 * Extension Approval Utility
 * Reusable function to approve extensions (used by admin and payment webhook)
 */

const { executeQuery } = require('../config/database');
const { 
  calculateDaysBetween, 
  formatDateToString,
  getTodayString,
  parseDateToString
} = require('./loanCalculations');

/**
 * Approve an extension
 * @param {number} extensionId - Extension ID
 * @param {string} referenceNumber - Optional reference number (UTR, order ID, etc.)
 * @param {number} createdBy - Optional admin/user ID who created the transaction
 * @returns {Promise<Object>} Approval result
 */
async function approveExtension(extensionId, referenceNumber = null, createdBy = null) {
  // Get extension details with user info and loan calculation data
  const extensions = await executeQuery(`
    SELECT 
      le.*,
      la.id as loan_id,
      la.user_id,
      la.loan_amount,
      la.processed_amount,
      la.processed_due_date,
      la.extension_count,
      la.plan_snapshot,
      la.emi_schedule,
      la.interest_paid,
      la.interest_percent_per_day,
      la.processed_post_service_fee,
      la.processed_gst,
      la.fees_breakdown
    FROM loan_extensions le
    INNER JOIN loan_applications la ON le.loan_application_id = la.id
    WHERE le.id = ?
  `, [extensionId]);

  if (!extensions || extensions.length === 0) {
    throw new Error('Extension request not found');
  }

  const extension = extensions[0];

  // Allow approval for both 'pending' (old) and 'pending_payment' (new) statuses
  if (extension.status !== 'pending' && extension.status !== 'pending_payment') {
    throw new Error(`Extension request is already ${extension.status}`);
  }

  // Determine transaction type based on extension number
  const transactionType = `loan_extension_${extension.extension_number === 1 ? '1st' : extension.extension_number === 2 ? '2nd' : extension.extension_number === 3 ? '3rd' : '4th'}`;

  // Get system admin ID for created_by (required foreign key to admins table)
  // If createdBy is provided (manual admin approval), use it; otherwise get system admin
  let createdById = createdBy;
  if (!createdById) {
    // Try to get superadmin first
    let systemAdmins = await executeQuery(
      'SELECT id FROM admins WHERE is_active = 1 AND role = ? ORDER BY created_at ASC LIMIT 1',
      ['superadmin']
    );
    
    // If no superadmin, try to get any active admin
    if (!systemAdmins || systemAdmins.length === 0) {
      systemAdmins = await executeQuery(
        'SELECT id FROM admins WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1'
      );
    }
    
    createdById = systemAdmins && systemAdmins.length > 0 ? systemAdmins[0].id : null;
    
    if (!createdById) {
      throw new Error('No active admin found. Cannot create transaction record.');
    }
  }

  // Create transaction automatically
  const transactionQuery = `
    INSERT INTO transactions (
      user_id, 
      loan_application_id, 
      transaction_type, 
      amount, 
      description, 
      reference_number,
      transaction_date, 
      status, 
      created_by, 
      created_at, 
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'completed', ?, NOW(), NOW())
  `;

  const transactionDescription = `Loan Extension #${extension.extension_number} - Extension Fee: ₹${extension.extension_fee}, GST: ₹${extension.gst_amount}, Interest: ₹${extension.interest_till_date}`;
  
  const transactionValues = [
    extension.user_id,
    extension.loan_application_id,
    transactionType,
    extension.total_extension_amount,
    transactionDescription,
    referenceNumber || `EXT-${extension.loan_application_id}-${extension.extension_number}-${Date.now()}`,
    createdById
  ];

  // Try to insert transaction with loan_extension type, fallback to 'other' if type not in ENUM
  let transactionResult;
  let paymentTransactionId;
  try {
    transactionResult = await executeQuery(transactionQuery, transactionValues);
    paymentTransactionId = transactionResult.insertId;
  } catch (transactionError) {
    // If transaction_type is not in ENUM, try with 'other' type
    if (transactionError.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || 
        transactionError.message?.includes('transaction_type')) {
      console.warn(`⚠️ Transaction type '${transactionType}' not in ENUM, using 'other' instead`);
      const fallbackValues = [
        extension.user_id,
        extension.loan_application_id,
        'other', // Use 'other' as fallback
        extension.total_extension_amount,
        `${transactionDescription} (Type: ${transactionType})`, // Include original type in description
        referenceNumber || `EXT-${extension.loan_application_id}-${extension.extension_number}-${Date.now()}`,
        createdById
      ];
      transactionResult = await executeQuery(transactionQuery, fallbackValues);
      paymentTransactionId = transactionResult.insertId;
    } else {
      // Re-throw if it's a different error (like foreign key constraint)
      throw transactionError;
    }
  }

  console.log(`✅ Created transaction ${paymentTransactionId} for extension ${extensionId}`);

  // Update extension status
  await executeQuery(
    `UPDATE loan_extensions 
     SET status = 'approved',
         payment_status = 'paid',
         updated_at = NOW()
     WHERE id = ?`,
    [extensionId]
  );
  
  console.log(`✅ Updated extension ${extensionId} status to approved. Transaction ID: ${paymentTransactionId}`);

  // Update loan application
  const newExtensionCount = (extension.extension_count || 0) + 1;
  const newDueDate = extension.new_due_date;
  
  // Parse newDueDate - it can be a JSON array for multi-EMI or a single date string
  let lastExtensionDueDate = null;
  let updatedProcessedDueDate = newDueDate;
  
  try {
    if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
      const dateArray = JSON.parse(newDueDate);
      if (Array.isArray(dateArray) && dateArray.length > 0) {
        lastExtensionDueDate = dateArray[dateArray.length - 1];
        updatedProcessedDueDate = newDueDate;
      } else {
        lastExtensionDueDate = newDueDate;
      }
    } else {
      lastExtensionDueDate = newDueDate;
      updatedProcessedDueDate = newDueDate;
    }
  } catch (parseError) {
    console.warn('Could not parse newDueDate as JSON, treating as single date:', parseError);
    lastExtensionDueDate = newDueDate;
    updatedProcessedDueDate = newDueDate;
  }

  // Update interest_paid: Add interest_till_date from extension
  const currentInterestPaid = parseFloat(extension.interest_paid || 0);
  const interestTillDate = parseFloat(extension.interest_till_date || 0);
  const updatedInterestPaid = currentInterestPaid + interestTillDate;
  
  console.log(`💰 Updating interest_paid: ${currentInterestPaid} + ${interestTillDate} = ${updatedInterestPaid}`);

  // Update emi_schedule with new due dates
  // Parse new due dates first
  let newDueDates = [];
  try {
    if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
      newDueDates = JSON.parse(newDueDate);
    } else if (newDueDate) {
      newDueDates = [newDueDate];
    }
  } catch (parseError) {
    console.error('❌ Error parsing newDueDate:', parseError);
  }

  let updatedEmiSchedule = extension.emi_schedule;
  let shouldUpdateEmiSchedule = false;
  
  // Only update if we have new due dates
  if (newDueDates.length > 0) {
    try {
      let emiScheduleArray = null;
      if (extension.emi_schedule) {
        emiScheduleArray = typeof extension.emi_schedule === 'string' 
          ? JSON.parse(extension.emi_schedule) 
          : extension.emi_schedule;
      }

      if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0) {
        // CRITICAL: Recalculate emi_amount from "next day" (today + 1) to new due date
        // Extension date is today, so recalculate from tomorrow to new due date
        
        // Get loan calculation data
        const principal = parseFloat(extension.processed_amount || extension.loan_amount || 0);
        const interestRatePerDay = parseFloat(extension.interest_percent_per_day || 0.001);
        
        // Parse plan snapshot for EMI count and fees
        let planSnapshot = {};
        let emiCount = emiScheduleArray.length;
        try {
          planSnapshot = typeof extension.plan_snapshot === 'string'
            ? JSON.parse(extension.plan_snapshot)
            : extension.plan_snapshot || {};
          emiCount = planSnapshot.emi_count || emiScheduleArray.length;
        } catch (e) {
          console.warn('Error parsing plan_snapshot, using emi_schedule length:', e);
        }
        
        // Get post service fee and GST (total, divide by EMI count for per-EMI)
        // fees_breakdown for add_to_total fees in multi-EMI: fee_amount is already TOTAL (multiplied by EMI count)
        // processed_post_service_fee: TOTAL (already multiplied by EMI count) - base fee only (GST separate)
        let postServiceFeeTotal = 0;
        let postServiceFeeGSTTotal = 0;
        
        if (extension.fees_breakdown) {
          try {
            const feesBreakdown = typeof extension.fees_breakdown === 'string'
              ? JSON.parse(extension.fees_breakdown)
              : extension.fees_breakdown;
            
            if (Array.isArray(feesBreakdown)) {
              const postServiceFeeEntry = feesBreakdown.find(f =>
                (f.name?.toLowerCase().includes('post service') ||
                 f.fee_name?.toLowerCase().includes('post service')) &&
                f.application_method === 'add_to_total'
              );
              
              if (postServiceFeeEntry) {
                // For add_to_total fees in multi-EMI, fee_amount is already TOTAL (multiplied by EMI count in loanCalculations.js)
                // gst_amount is also TOTAL (multiplied by EMI count)
                postServiceFeeTotal = parseFloat(postServiceFeeEntry.fee_amount || postServiceFeeEntry.amount || 0);
                postServiceFeeGSTTotal = parseFloat(postServiceFeeEntry.gst_amount || 0);
                
                console.log(`📊 Post service fee from fees_breakdown: Fee Total=₹${postServiceFeeTotal}, GST Total=₹${postServiceFeeGSTTotal} (already multiplied by ${emiCount} EMIs)`);
              }
            }
          } catch (e) {
            console.warn('Error parsing fees_breakdown:', e);
          }
        }
        
        // Fallback to processed_post_service_fee if fees_breakdown didn't work
        if (postServiceFeeTotal === 0 && extension.processed_post_service_fee) {
          // processed_post_service_fee is TOTAL base fee (already multiplied by EMI count, but without GST)
          postServiceFeeTotal = parseFloat(extension.processed_post_service_fee) || 0;
          // Calculate GST on total (18% of base fee total)
          postServiceFeeGSTTotal = Math.round(postServiceFeeTotal * 0.18 * 100) / 100;
          console.log(`📊 Post service fee from processed_post_service_fee: Fee Total=₹${postServiceFeeTotal}, GST Total=₹${postServiceFeeGSTTotal}`);
        }
        
        // Calculate per-EMI fees (divide total by EMI count)
        const postServiceFeePerEmi = Math.round((postServiceFeeTotal / emiCount) * 100) / 100;
        const postServiceFeeGSTPerEmi = Math.round((postServiceFeeGSTTotal / emiCount) * 100) / 100;
        
        console.log(`📊 Per-EMI fees: Post Service Fee=₹${postServiceFeePerEmi}, GST=₹${postServiceFeeGSTPerEmi}`);
        
        // Get extension date (today) and calculate "next day" (tomorrow)
        const todayStr = getTodayString();
        const todayDate = new Date(todayStr);
        todayDate.setDate(todayDate.getDate() + 1); // Tomorrow (next day)
        const nextDayStr = formatDateToString(todayDate);
        
        console.log(`📅 Extension approval: Recalculating EMI amounts from next day (${nextDayStr}) to new due dates`);
        
        // Calculate principal per EMI
        const principalPerEmi = Math.floor(principal / emiCount * 100) / 100;
        const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
        
        // Track outstanding principal for interest calculation (reducing balance)
        let outstandingPrincipal = principal;
        
        // Update all EMIs with new due dates AND recalculated amounts
        emiScheduleArray = emiScheduleArray.map((emi, index) => {
          if (index < newDueDates.length) {
            const newDueDateStr = newDueDates[index];
            
            // Calculate interest from "next day" to new due date
            // For first EMI: from next day to first new due date
            // For subsequent EMIs: from previous EMI due date + 1 day to new due date
            let interestStartDateStr = nextDayStr;
            if (index > 0) {
              // For subsequent EMIs, start from previous EMI due date + 1 day (inclusive counting)
              const prevDueDate = new Date(newDueDates[index - 1]);
              prevDueDate.setDate(prevDueDate.getDate() + 1);
              interestStartDateStr = formatDateToString(prevDueDate);
            }
            
            // Calculate days from start date to new due date (inclusive)
            const daysForPeriod = calculateDaysBetween(interestStartDateStr, newDueDateStr);
            
            // Calculate interest for this period on reducing balance
            const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
            
            // Calculate principal for this EMI (last EMI gets remainder)
            const principalForThisEmi = index === emiCount - 1
              ? Math.round((principalPerEmi + remainder) * 100) / 100
              : principalPerEmi;
            
            // Calculate new emi_amount: principal + interest + post service fee + GST
            const newEmiAmount = Math.round((principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi) * 100) / 100;
            
            // Reduce outstanding principal for next EMI
            outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
            
            console.log(`📊 EMI ${index + 1}: ${interestStartDateStr} to ${newDueDateStr} (${daysForPeriod} days), Principal: ₹${principalForThisEmi}, Interest: ₹${interestForPeriod}, Total: ₹${newEmiAmount}`);
            
            return {
              ...emi,
              due_date: newDueDateStr, // Update with new date
              emi_amount: newEmiAmount, // Recalculate amount from next day to new due date
              instalment_no: emi.instalment_no || emi.instalmentNo || emi.emi_number || (index + 1),
              emi_number: emi.emi_number || emi.instalment_no || (index + 1),
              status: emi.status || 'pending' // Preserve status (paid/pending)
            };
          }
          // If index >= newDueDates.length, keep original EMI (shouldn't happen in normal flow)
          return emi;
        });
        
        // For multi-EMI, ensure all dates are updated (if newDueDates has more entries than existing EMIs)
        if (newDueDates.length > emiScheduleArray.length) {
          for (let i = emiScheduleArray.length; i < newDueDates.length; i++) {
            const newDueDateStr = newDueDates[i];
            let interestStartDateStr = nextDayStr;
            if (i > 0) {
              // Parse previous due date string to Date object
              const prevDueDateStr = newDueDates[i - 1];
              const [prevYear, prevMonth, prevDay] = prevDueDateStr.split('-').map(Number);
              const prevDueDate = new Date(prevYear, prevMonth - 1, prevDay);
              prevDueDate.setDate(prevDueDate.getDate() + 1);
              interestStartDateStr = formatDateToString(prevDueDate);
            }
            
            const daysForPeriod = calculateDaysBetween(interestStartDateStr, newDueDateStr);
            const principalForThisEmi = Math.floor(principal / (i + 1) * 100) / 100;
            const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
            const newEmiAmount = Math.round((principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi) * 100) / 100;
            
            outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
            
            emiScheduleArray.push({
              emi_number: i + 1,
              instalment_no: i + 1,
              due_date: newDueDateStr,
              emi_amount: newEmiAmount,
              status: 'pending'
            });
          }
        }
        
        updatedEmiSchedule = JSON.stringify(emiScheduleArray);
        shouldUpdateEmiSchedule = true;
        console.log(`📅 Updated emi_schedule with new due dates and recalculated amounts: ${newDueDates.join(', ')}`);
      } else {
        // No existing emi_schedule, create one
        console.warn(`⚠️ emi_schedule not found, creating basic schedule with dates: ${newDueDates.join(', ')}`);
        const basicSchedule = newDueDates.map((date, index) => ({
          emi_number: index + 1,
          instalment_no: index + 1,
          due_date: date,
          status: 'pending'
        }));
        updatedEmiSchedule = JSON.stringify(basicSchedule);
        shouldUpdateEmiSchedule = true;
      }
    } catch (scheduleError) {
      console.error('❌ Error updating emi_schedule:', scheduleError);
      // On error, create basic schedule with new dates
      try {
        const basicSchedule = newDueDates.map((date, index) => ({
          emi_number: index + 1,
          instalment_no: index + 1,
          due_date: date,
          status: 'pending'
        }));
        updatedEmiSchedule = JSON.stringify(basicSchedule);
        shouldUpdateEmiSchedule = true;
        console.log(`📅 Created new emi_schedule after error with dates: ${newDueDates.join(', ')}`);
      } catch (fallbackError) {
        console.error('❌ Error creating fallback emi_schedule:', fallbackError);
      }
    }
  }

  // Update loan application
  const updateParams = [
    newExtensionCount,
    lastExtensionDueDate,
    updatedProcessedDueDate,
    updatedInterestPaid
  ];
  
  let updateQuery = `
    UPDATE loan_applications 
    SET extension_count = ?,
        extension_status = 'approved',
        last_extension_date = CURDATE(),
        last_extension_due_date = ?,
        processed_due_date = ?,
        interest_paid = ?`;
  
  // Always update emi_schedule if we have new due dates from extension
  // Extension approval should always update EMI dates when new dates are provided
  if (newDueDates.length > 0 && updatedEmiSchedule !== null && updatedEmiSchedule !== undefined) {
    updateQuery += `,
        emi_schedule = ?`;
    updateParams.push(updatedEmiSchedule);
    console.log(`📅 Will update emi_schedule in database with new dates: ${newDueDates.join(', ')}`);
    console.log(`📅 Updated emi_schedule JSON: ${updatedEmiSchedule}`);
  } else if (newDueDates.length > 0) {
    // Fallback: If we have new dates but emi_schedule update failed, create basic schedule
    console.warn(`⚠️ emi_schedule update was not completed, but we have new dates. Creating basic schedule.`);
    try {
      const basicSchedule = newDueDates.map((date, index) => ({
        emi_number: index + 1,
        instalment_no: index + 1,
        due_date: date,
        status: 'pending'
      }));
      updatedEmiSchedule = JSON.stringify(basicSchedule);
      updateQuery += `,
          emi_schedule = ?`;
      updateParams.push(updatedEmiSchedule);
      console.log(`📅 Force updating emi_schedule with basic schedule: ${newDueDates.join(', ')}`);
    } catch (fallbackError) {
      console.error('❌ Error creating basic emi_schedule:', fallbackError);
    }
  }
  
  updateQuery += `,
        updated_at = NOW()
    WHERE id = ?`;
  
  updateParams.push(extension.loan_application_id);
  
  await executeQuery(updateQuery, updateParams);
  
  console.log(`✅ Updated loan application ${extension.loan_application_id}: extension_count=${newExtensionCount}, last_extension_due_date=${lastExtensionDueDate}, interest_paid=${updatedInterestPaid}`);

  return {
    extension_id: extensionId,
    extension_number: extension.extension_number,
    new_due_date: newDueDate,
    transaction_id: paymentTransactionId,
    loan_application_id: extension.loan_application_id,
    user_id: extension.user_id
  };
}

module.exports = {
  approveExtension
};

