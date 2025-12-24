const { getPool } = require('../config/database');

/**
 * Loan Application Model
 * Handles all database interactions for the loan_applications table
 */

/**
 * Generate unique application number
 * @returns {string} Unique application number
 */
const generateApplicationNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PC${timestamp}${random}`;
};

/**
 * Create a new loan application
 * @param {number} userId - User ID
 * @param {Object} applicationData - Application data
 * @returns {Promise<Object>} Created application object
 */
const createApplication = async (userId, applicationData) => {
  try {
    const pool = getPool();
    const {
      loan_amount,
      loan_purpose,
      plan_id,
      loan_plan_id, // alias for plan_id
      plan_code,
      plan_snapshot,
      processing_fee,
      processing_fee_percent,
      fees, // Dynamic fees array
      fees_breakdown, // Full fees breakdown JSON
      total_deduct_from_disbursal, // Total fees deducted from disbursal
      total_add_to_total, // Total fees added to repayable
      disbursal_amount, // Amount actually disbursed
      total_interest,
      interest_percent_per_day,
      total_repayable,
      late_fee_structure,
      emi_schedule,
      // Legacy fields (kept for backward compatibility)
      tenure_months = null,
      emi_amount = null
    } = applicationData;

    // Generate unique application number
    const application_number = generateApplicationNumber();

    // Use plan_id or loan_plan_id (whichever is provided)
    let planId = plan_id || loan_plan_id || null;

    // If no plan_id provided, try to get user's selected plan or default plan
    if (!planId) {
      try {
        const { executeQuery } = require('../config/database');
        // Get user's selected plan
        const users = await executeQuery(
          'SELECT selected_loan_plan_id FROM users WHERE id = ?',
          [userId]
        );
        
        if (users && users.length > 0 && users[0].selected_loan_plan_id) {
          planId = users[0].selected_loan_plan_id;
          console.log(`✅ Using user's selected plan ID: ${planId}`);
        } else {
          // Get system default plan
          const defaultPlans = await executeQuery(
            'SELECT id FROM loan_plans WHERE is_default = 1 AND is_active = 1 LIMIT 1'
          );
          if (defaultPlans && defaultPlans.length > 0) {
            planId = defaultPlans[0].id;
            console.log(`✅ Using system default plan ID: ${planId}`);
          } else {
            console.warn('⚠️ No plan_id provided and no default plan found. Application will be created without plan.');
          }
        }
      } catch (planError) {
        console.error('Error fetching fallback plan:', planError);
        // Continue without plan - application will be created with null plan_id
      }
    }

    // If we have a planId but plan_snapshot is incomplete or missing, fetch full plan details
    let finalPlanSnapshot = plan_snapshot;
    let finalPlanCode = plan_code;
    
    if (planId && (!plan_snapshot || !plan_snapshot.plan_code || !plan_snapshot.fees)) {
      try {
        const { executeQuery } = require('../config/database');
        console.log(`📋 Fetching full plan details for plan ID: ${planId}`);
        
        // Fetch plan details
        const plans = await executeQuery(
          'SELECT * FROM loan_plans WHERE id = ? AND is_active = 1',
          [planId]
        );
        
        if (plans && plans.length > 0) {
          const plan = plans[0];
          
          // Fetch plan fees
          const planFees = await executeQuery(
            `SELECT 
              lpf.fee_percent,
              ft.fee_name,
              ft.application_method,
              ft.description
             FROM loan_plan_fees lpf
             INNER JOIN fee_types ft ON lpf.fee_type_id = ft.id
             WHERE lpf.loan_plan_id = ? AND ft.is_active = 1
             ORDER BY ft.fee_name ASC`,
            [planId]
          );
          
          // Create complete plan snapshot (same format as admin assignment)
          finalPlanSnapshot = {
            plan_id: plan.id,
            plan_name: plan.plan_name,
            plan_code: plan.plan_code,
            plan_type: plan.plan_type,
            repayment_days: plan.repayment_days,
            total_duration_days: plan.total_duration_days,
            interest_percent_per_day: parseFloat(plan.interest_percent_per_day || 0.001),
            calculate_by_salary_date: plan.calculate_by_salary_date === 1 || plan.calculate_by_salary_date === true,
            emi_count: plan.emi_count,
            emi_frequency: plan.emi_frequency,
            allow_extension: plan.allow_extension === 1 || plan.allow_extension === true,
            extension_show_from_days: plan.extension_show_from_days,
            extension_show_till_days: plan.extension_show_till_days,
            fees: planFees.map(pf => ({
              fee_name: pf.fee_name,
              fee_percent: parseFloat(pf.fee_percent),
              application_method: pf.application_method
            }))
          };
          
          // Also set plan_code if not provided
          if (!finalPlanCode) {
            finalPlanCode = plan.plan_code;
          }
          
          console.log(`✅ Created complete plan snapshot for plan: ${plan.plan_code}`);
        } else {
          console.warn(`⚠️ Plan ID ${planId} not found or inactive. Using provided plan_snapshot.`);
        }
      } catch (snapshotError) {
        console.error('Error creating plan snapshot:', snapshotError);
        // Continue with provided plan_snapshot or null
      }
    }

    const query = `
      INSERT INTO loan_applications (
        user_id, application_number, loan_amount, loan_purpose,
        loan_plan_id, plan_code, plan_snapshot,
        processing_fee, processing_fee_percent,
        fees_breakdown, disbursal_amount,
        total_interest, interest_percent_per_day,
        total_repayable, late_fee_structure, emi_schedule,
        tenure_months, emi_amount,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW(), NOW())
    `;

    // Prepare fees_breakdown JSON (use provided fees_breakdown or construct from fees array)
    let feesBreakdownJson = null;
    if (fees_breakdown) {
      feesBreakdownJson = typeof fees_breakdown === 'string' ? fees_breakdown : JSON.stringify(fees_breakdown);
    } else if (fees && Array.isArray(fees)) {
      feesBreakdownJson = JSON.stringify(fees);
    }

    // Calculate disbursal_amount if not provided
    const calculatedDisbursalAmount = disbursal_amount !== undefined
      ? disbursal_amount
      : (total_deduct_from_disbursal !== undefined
        ? loan_amount - total_deduct_from_disbursal
        : (processing_fee ? loan_amount - processing_fee : null));

    const values = [
      userId,
      application_number,
      loan_amount,
      loan_purpose,
      planId,
      finalPlanCode || null,
      finalPlanSnapshot ? JSON.stringify(finalPlanSnapshot) : null,
      processing_fee || null,
      processing_fee_percent || null,
      feesBreakdownJson,
      calculatedDisbursalAmount,
      total_interest || null,
      interest_percent_per_day || null,
      total_repayable || null,
      late_fee_structure ? JSON.stringify(late_fee_structure) : null,
      emi_schedule ? JSON.stringify(emi_schedule) : null,
      tenure_months,
      emi_amount
    ];

    const [result] = await pool.execute(query, values);

    // Return the created application
    return await findApplicationById(result.insertId);
  } catch (error) {
    console.error('Error creating loan application:', error.message);
    throw error;
  }
};

/**
 * Find loan application by ID
 * @param {number} applicationId - Application ID
 * @returns {Promise<Object|null>} Application object or null if not found
 */
const findApplicationById = async (applicationId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT la.*, u.first_name, u.last_name, u.phone, u.email
      FROM loan_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `;
    const [rows] = await pool.execute(query, [applicationId]);

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding application by ID:', error.message);
    throw error;
  }
};

/**
 * Find all loan applications by user ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of application objects
 */
const findApplicationsByUserId = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        la.id,
        la.application_number,
        la.loan_amount,
        la.loan_purpose,
        la.tenure_months,
        la.emi_amount,
        la.status,
        la.rejection_reason,
        la.approved_at,
        la.disbursed_at,
        la.created_at,
        la.updated_at
      FROM loan_applications la
      WHERE la.user_id = ?
      ORDER BY la.created_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);

    return rows;
  } catch (error) {
    console.error('Error finding applications by user ID:', error.message);
    throw error;
  }
};

/**
 * Find loan application by application number
 * @param {string} applicationNumber - Application number
 * @returns {Promise<Object|null>} Application object or null if not found
 */
const findApplicationByNumber = async (applicationNumber) => {
  try {
    const pool = getPool();
    const query = `
      SELECT la.*, u.first_name, u.last_name, u.phone, u.email
      FROM loan_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.application_number = ?
    `;
    const [rows] = await pool.execute(query, [applicationNumber]);

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding application by number:', error.message);
    throw error;
  }
};

/**
 * Update loan application status
 * @param {number} applicationId - Application ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object|null>} Updated application or null if not found
 */
const updateApplication = async (applicationId, updateData) => {
  try {
    const pool = getPool();

    // Build dynamic query based on provided fields
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(applicationId);
    const query = `UPDATE loan_applications SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return null;
    }

    return await findApplicationById(applicationId);
  } catch (error) {
    console.error('Error updating application:', error.message);
    throw error;
  }
};

/**
 * Get loan application statistics for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Application statistics
 */
const getApplicationStats = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) as disbursed_count,
        SUM(CASE WHEN status = 'approved' OR status = 'disbursed' THEN loan_amount ELSE 0 END) as total_approved_amount
      FROM loan_applications 
      WHERE user_id = ?
    `;
    const [rows] = await pool.execute(query, [userId]);

    return rows[0] || {
      total_applications: 0,
      submitted_count: 0,
      under_review_count: 0,
      approved_count: 0,
      rejected_count: 0,
      disbursed_count: 0,
      total_approved_amount: 0
    };
  } catch (error) {
    console.error('Error getting application stats:', error.message);
    throw error;
  }
};

/**
 * Check if user has pending applications
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if user has pending applications
 */
const hasPendingApplications = async (userId) => {
  try {
    const pool = getPool();
    const query = `
      SELECT COUNT(*) as count
      FROM loan_applications 
      WHERE user_id = ? 
      AND status IN ('submitted', 'under_review')
    `;
    const [rows] = await pool.execute(query, [userId]);

    return rows[0].count > 0;
  } catch (error) {
    console.error('Error checking pending applications:', error.message);
    throw error;
  }
};

/**
 * Get application summary for response
 * @param {Object} application - Application object
 * @returns {Object} Application summary
 */
const getApplicationSummary = (application) => {
  return {
    id: application.id,
    application_number: application.application_number,
    loan_amount: application.loan_amount,
    loan_purpose: application.loan_purpose,
    tenure_months: application.tenure_months,
    emi_amount: application.emi_amount,
    status: application.status,
    rejection_reason: application.rejection_reason,
    approved_at: application.approved_at,
    disbursed_at: application.disbursed_at,
    created_at: application.created_at,
    updated_at: application.updated_at
  };
};

module.exports = {
  createApplication,
  findApplicationById,
  findApplicationsByUserId,
  findApplicationByNumber,
  updateApplication,
  getApplicationStats,
  hasPendingApplications,
  getApplicationSummary,
  generateApplicationNumber
};
