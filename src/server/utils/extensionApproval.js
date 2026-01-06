/**
 * Extension Approval Utility
 * Reusable function to approve extensions (used by admin and payment webhook)
 */

const { executeQuery } = require('../config/database');

/**
 * Approve an extension
 * @param {number} extensionId - Extension ID
 * @param {string} referenceNumber - Optional reference number (UTR, order ID, etc.)
 * @param {number} createdBy - Optional admin/user ID who created the transaction
 * @returns {Promise<Object>} Approval result
 */
async function approveExtension(extensionId, referenceNumber = null, createdBy = null) {
  // Get extension details with user info
  const extensions = await executeQuery(`
    SELECT 
      le.*,
      la.id as loan_id,
      la.user_id,
      la.processed_due_date,
      la.extension_count,
      la.plan_snapshot,
      la.emi_schedule,
      la.interest_paid
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
    createdBy
  ];

  const transactionResult = await executeQuery(transactionQuery, transactionValues);
  const paymentTransactionId = transactionResult.insertId;

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
  let updatedEmiSchedule = extension.emi_schedule;
  try {
    let emiScheduleArray = null;
    if (extension.emi_schedule) {
      emiScheduleArray = typeof extension.emi_schedule === 'string' 
        ? JSON.parse(extension.emi_schedule) 
        : extension.emi_schedule;
    }

    let newDueDates = [];
    if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
      newDueDates = JSON.parse(newDueDate);
    } else {
      newDueDates = [newDueDate];
    }

    if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0 && newDueDates.length > 0) {
      emiScheduleArray = emiScheduleArray.map((emi, index) => {
        if (index < newDueDates.length) {
          return {
            ...emi,
            due_date: newDueDates[index]
          };
        }
        return emi;
      });
      updatedEmiSchedule = JSON.stringify(emiScheduleArray);
      console.log(`📅 Updated emi_schedule with new due dates: ${newDueDates.join(', ')}`);
    } else if (newDueDates.length > 0) {
      console.warn(`⚠️ emi_schedule not found, creating basic schedule with dates: ${newDueDates.join(', ')}`);
      const basicSchedule = newDueDates.map((date, index) => ({
        emi_number: index + 1,
        due_date: date,
        status: 'pending'
      }));
      updatedEmiSchedule = JSON.stringify(basicSchedule);
    }
  } catch (scheduleError) {
    console.error('❌ Error updating emi_schedule:', scheduleError);
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
  
  if (updatedEmiSchedule !== extension.emi_schedule && updatedEmiSchedule !== null) {
    updateQuery += `,
        emi_schedule = ?`;
    updateParams.push(updatedEmiSchedule);
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

