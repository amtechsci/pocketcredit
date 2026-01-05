/**
 * Cashfree Payout API Routes
 * Handles loan disbursement via Cashfree Payout API
 */

const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const cashfreePayout = require('../services/cashfreePayout');

/**
 * POST /api/payout/disburse-loan
 * Disburse loan amount to user's bank account via Cashfree Payout API
 * 
 * This endpoint:
 * 1. Validates loan and user details
 * 2. Gets user's bank account details
 * 3. Creates/verifies beneficiary in Cashfree
 * 4. Initiates transfer
 * 5. Saves transaction record
 * 6. Updates loan status
 */
router.post('/disburse-loan', authenticateAdmin, async (req, res) => {
    let transferId = null;
    
    try {
        await initializeDatabase();
        const adminId = req.admin.id;
        const { loanApplicationId } = req.body;

        if (!loanApplicationId) {
            return res.status(400).json({
                success: false,
                message: 'Loan application ID is required'
            });
        }

        // Fetch loan application details
        const loanQuery = `
            SELECT 
                la.*,
                u.id as user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.personal_email,
                u.official_email
            FROM loan_applications la
            JOIN users u ON la.user_id = u.id
            WHERE la.id = ?
        `;

        const loans = await executeQuery(loanQuery, [loanApplicationId]);

        if (!loans || loans.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Loan application not found'
            });
        }

        const loan = loans[0];

        // Validate loan status
        if (loan.status !== 'ready_for_disbursement') {
            return res.status(400).json({
                success: false,
                message: `Loan must be in 'ready_for_disbursement' status. Current status: ${loan.status}`
            });
        }

        // Fetch user's primary bank account details
        const bankQuery = `
            SELECT * FROM bank_details
            WHERE user_id = ? AND is_primary = 1
            ORDER BY updated_at DESC
            LIMIT 1
        `;

        const banks = await executeQuery(bankQuery, [loan.user_id]);

        if (!banks || banks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User does not have a primary bank account. Please add bank details first.'
            });
        }

        const bank = banks[0];

        // Validate bank details
        if (!bank.account_number || !bank.ifsc_code) {
            return res.status(400).json({
                success: false,
                message: 'Bank account number and IFSC code are required'
            });
        }

        // Get email (priority: personal_email > official_email > email)
        const customerEmail = loan.personal_email || loan.official_email || loan.email;

        // Generate beneficiary ID (unique per user)
        const beneId = `BENE_${loan.user_id}_${Date.now()}`;
        
        // Generate transfer ID (unique per loan disbursement)
        transferId = `TRANSFER_LOAN_${loanApplicationId}_${Date.now()}`;

        console.log(`[Payout] Starting disbursement for loan ${loanApplicationId}`, {
            userId: loan.user_id,
            amount: loan.loan_amount,
            beneId,
            transferId
        });

        // Step 1: Create/Add beneficiary in Cashfree
        try {
            await cashfreePayout.createBeneficiary({
                beneId: beneId,
                name: `${loan.first_name} ${loan.last_name}`,
                email: customerEmail || '',
                phone: loan.phone,
                bankAccount: bank.account_number,
                ifsc: bank.ifsc_code,
                address1: bank.address_line1 || '',
                address2: bank.address_line2 || '',
                city: bank.city || '',
                state: bank.state || '',
                pincode: bank.pincode || ''
            });
            console.log(`[Payout] Beneficiary created/verified: ${beneId}`);
        } catch (beneficiaryError) {
            // If beneficiary already exists (409), that's fine - continue
            if (beneficiaryError.status === 409 || 
                beneficiaryError.message?.includes('already exists') ||
                beneficiaryError.message?.includes('duplicate')) {
                console.log(`[Payout] Beneficiary ${beneId} already exists, continuing...`);
            } else {
                throw beneficiaryError;
            }
        }

        // Step 2: Initiate transfer
        const transferResponse = await cashfreePayout.initiateTransfer({
            transferId: transferId,
            beneId: beneId,
            amount: parseFloat(loan.loan_amount),
            transferMode: 'NEFT', // Default to NEFT, can be made configurable
            remarks: `Loan disbursement - Loan ID: ${loanApplicationId}, Application: ${loan.application_number || loanApplicationId}`,
            transferMeta: {
                loan_application_id: loanApplicationId.toString(),
                loan_amount: loan.loan_amount.toString(),
                application_number: loan.application_number || ''
            }
        });

        console.log(`[Payout] Transfer initiated: ${transferId}`, {
            status: transferResponse.status,
            referenceId: transferResponse.referenceId
        });

        // Step 3: Save payout transaction to database
        const insertPayoutQuery = `
            INSERT INTO payout_transactions (
                loan_application_id,
                user_id,
                transfer_id,
                reference_id,
                bene_id,
                amount,
                transfer_mode,
                status,
                cashfree_response,
                remarks,
                created_by,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        await executeQuery(insertPayoutQuery, [
            loanApplicationId,
            loan.user_id,
            transferId,
            transferResponse.referenceId || null,
            beneId,
            loan.loan_amount,
            'NEFT',
            transferResponse.status || 'PENDING',
            JSON.stringify(transferResponse.data),
            transferResponse.data?.remarks || '',
            adminId
        ]);

        // Step 4: Save transaction record (for admin view)
        const insertTransactionQuery = `
            INSERT INTO transactions (
                user_id, loan_application_id, transaction_type, amount, description,
                category, payment_method, reference_number, transaction_date,
                status, priority, bank_name, account_number, additional_notes,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        await executeQuery(insertTransactionQuery, [
            loan.user_id,
            loanApplicationId,
            'loan_disbursement',
            loan.loan_amount,
            `Loan disbursement via Cashfree Payout - Transfer ID: ${transferId}`,
            'loan',
            'cashfree_payout',
            transferResponse.referenceId || transferId,
            new Date().toISOString().split('T')[0],
            'completed', // Mark as completed, actual status tracked in payout_transactions
            'high',
            bank.bank_name || '',
            bank.account_number,
            `Cashfree Transfer ID: ${transferId}, Reference: ${transferResponse.referenceId || 'N/A'}`
        ]);

        // Step 5: Update loan status to account_manager
        await executeQuery(`
            UPDATE loan_applications 
            SET 
                status = 'account_manager',
                disbursed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `, [loanApplicationId]);

        console.log(`[Payout] Loan ${loanApplicationId} status updated to account_manager`);

        // Return success response
        res.json({
            success: true,
            message: 'Loan disbursement initiated successfully',
            data: {
                transferId: transferId,
                referenceId: transferResponse.referenceId,
                status: transferResponse.status,
                amount: loan.loan_amount,
                beneficiary: {
                    name: `${loan.first_name} ${loan.last_name}`,
                    accountNumber: bank.account_number,
                    ifsc: bank.ifsc_code
                },
                loanStatus: 'account_manager',
                disbursedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[Payout] Error processing loan disbursement:', {
            loanApplicationId: req.body.loanApplicationId,
            transferId,
            error: error.response?.data || error.message,
            status: error.status || error.response?.status
        });

        // Provide helpful error messages
        let errorMessage = 'Failed to process loan disbursement';
        let statusCode = 500;

        if (error.message?.includes('authentication')) {
            errorMessage = 'Cashfree Payout API authentication failed. Please verify credentials.';
            statusCode = 503;
        } else if (error.message) {
            errorMessage = error.message;
            if (error.status) statusCode = error.status;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: error.response?.data?.message || error.message,
            transferId: transferId
        });
    }
});

/**
 * GET /api/payout/transfer-status/:transferId
 * Get status of a payout transfer
 */
router.get('/transfer-status/:transferId', authenticateAdmin, async (req, res) => {
    try {
        const { transferId } = req.params;

        const statusResponse = await cashfreePayout.getTransferStatus(transferId);

        // Update database with latest status
        await initializeDatabase();
        await executeQuery(`
            UPDATE payout_transactions 
            SET 
                status = ?,
                cashfree_response = ?,
                updated_at = NOW()
            WHERE transfer_id = ?
        `, [
            statusResponse.status,
            JSON.stringify(statusResponse.data),
            transferId
        ]);

        res.json({
            success: true,
            data: statusResponse.data
        });

    } catch (error) {
        console.error(`[Payout] Error fetching transfer status:`, error.response?.data || error.message);
        res.status(error.status || 500).json({
            success: false,
            message: 'Failed to fetch transfer status',
            error: error.response?.data?.message || error.message
        });
    }
});

/**
 * GET /api/payout/loan/:loanApplicationId
 * Get payout details for a loan
 */
router.get('/loan/:loanApplicationId', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        const { loanApplicationId } = req.params;

        const payoutQuery = `
            SELECT * FROM payout_transactions
            WHERE loan_application_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const payouts = await executeQuery(payoutQuery, [loanApplicationId]);

        if (!payouts || payouts.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No payout transaction found for this loan'
            });
        }

        res.json({
            success: true,
            data: payouts[0]
        });

    } catch (error) {
        console.error('[Payout] Error fetching payout details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payout details',
            error: error.message
        });
    }
});

/**
 * GET /api/payout/ready-for-disbursement
 * Get all loans ready for disbursement with user and bank details
 */
router.get('/ready-for-disbursement', authenticateAdmin, async (req, res) => {
    try {
        await initializeDatabase();
        
        const loansQuery = `
            SELECT 
                la.id,
                la.application_number,
                la.loan_amount,
                la.loan_purpose,
                la.status,
                la.created_at,
                la.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.personal_email,
                u.official_email,
                bd.id as bank_id,
                bd.account_number,
                bd.ifsc_code,
                bd.bank_name,
                bd.account_holder_name,
                bd.is_primary
            FROM loan_applications la
            JOIN users u ON la.user_id = u.id
            LEFT JOIN bank_details bd ON u.id = bd.user_id AND bd.is_primary = 1
            WHERE la.status = 'ready_for_disbursement'
            ORDER BY la.created_at DESC
        `;

        const loans = await executeQuery(loansQuery);

        // Format the response
        const formattedLoans = loans.map(loan => ({
            id: loan.id,
            applicationNumber: loan.application_number,
            loanAmount: parseFloat(loan.loan_amount) || 0,
            loanPurpose: loan.loan_purpose || 'Not specified',
            status: loan.status,
            createdAt: loan.created_at,
            user: {
                id: loan.user_id,
                firstName: loan.first_name,
                lastName: loan.last_name,
                fullName: `${loan.first_name || ''} ${loan.last_name || ''}`.trim(),
                email: loan.personal_email || loan.official_email || loan.email,
                phone: loan.phone
            },
            bank: loan.bank_id ? {
                id: loan.bank_id,
                accountNumber: loan.account_number,
                ifscCode: loan.ifsc_code,
                bankName: loan.bank_name,
                accountHolderName: loan.account_holder_name,
                isPrimary: loan.is_primary
            } : null
        }));

        res.json({
            success: true,
            data: formattedLoans,
            count: formattedLoans.length
        });

    } catch (error) {
        console.error('[Payout] Error fetching ready for disbursement loans:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch loans ready for disbursement',
            error: error.message
        });
    }
});

module.exports = router;

