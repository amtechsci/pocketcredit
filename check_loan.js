const { initializeDatabase, executeQuery, closeConnections } = require('./src/server/config/database');

async function checkLoan() {
    try {
        await initializeDatabase();

        // Check Loan 38
        console.log('--- Checking Loan #38 ---');
        const loans = await executeQuery('SELECT id, user_id, status FROM loan_applications WHERE id = ?', [38]);
        console.log('Loan Data:', loans);

        // Check User 58
        console.log('--- Checking User #58 ---');
        const users = await executeQuery('SELECT id, first_name, last_name FROM users WHERE id = ?', [58]);
        console.log('User Data:', users);

        if (loans.length > 0 && users.length > 0) {
            if (loans[0].user_id == users[0].id) {
                console.log('✅ Match! Loan #38 belongs to User #58.');
            } else {
                console.error(`❌ Mismatch! Loan #38 belongs to User #${loans[0].user_id}, NOT #${users[0].id}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await closeConnections();
    }
}

checkLoan();
