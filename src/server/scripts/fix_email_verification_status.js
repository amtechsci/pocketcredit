/**
 * Script to fix email verification status in users table
 * This script updates users.personal_email_verified and users.official_email_verified
 * based on verified records in email_otp_verification table
 */

const { executeQuery, initializeDatabase } = require('../config/database');

async function fixEmailVerificationStatus() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find all verified email OTP records
    const verifiedEmails = await executeQuery(`
      SELECT user_id, email, type 
      FROM email_otp_verification 
      WHERE verified = TRUE
      ORDER BY user_id, type, created_at DESC
    `);

    console.log(`📧 Found ${verifiedEmails.length} verified email records`);

    // Group by user_id and type to get the latest verified email for each type
    const userEmailMap = {};
    for (const record of verifiedEmails) {
      const key = `${record.user_id}_${record.type}`;
      if (!userEmailMap[key]) {
        userEmailMap[key] = record;
      }
    }

    // Update users table
    let updatedCount = 0;
    for (const key in userEmailMap) {
      const record = userEmailMap[key];
      const { user_id, email, type } = record;

      const emailField = type === 'personal' ? 'personal_email' : 'official_email';
      const verifiedField = type === 'personal' ? 'personal_email_verified' : 'official_email_verified';

      // Check if user already has this email verified
      const userCheck = await executeQuery(
        `SELECT ${emailField}, ${verifiedField} FROM users WHERE id = ?`,
        [user_id]
      );

      if (userCheck && userCheck.length > 0) {
        const user = userCheck[0];
        const currentEmail = user[emailField];
        const currentVerified = user[verifiedField];

        // Update if email doesn't match or verified status is false
        if (currentEmail !== email || !currentVerified) {
          await executeQuery(
            `UPDATE users 
             SET ${emailField} = ?, ${verifiedField} = TRUE, updated_at = NOW() 
             WHERE id = ?`,
            [email, user_id]
          );
          console.log(`✅ Updated ${type} email for user ${user_id}: ${email}`);
          updatedCount++;
        } else {
          console.log(`ℹ️  User ${user_id} already has ${type} email verified: ${email}`);
        }
      }
    }

    console.log(`\n✅ Fix completed! Updated ${updatedCount} user records.`);
  } catch (error) {
    console.error('❌ Error fixing email verification status:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixEmailVerificationStatus()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixEmailVerificationStatus };

