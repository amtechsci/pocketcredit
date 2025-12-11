const { initializeDatabase, executeQuery, closeConnections } = require('./config/database');

async function checkLoan() {
    try {
        await initializeDatabase();

        const loans = await executeQuery('SELECT id, user_id, status FROM loan_applications WHERE id = ?', [38]);

        if (loans.length > 0) {
            const userId = loans[0].user_id;

            // Also check User 58 specifically
            // console.log('User #58 Data:', user58);

            if (userId === 58 || userId === '58') {
                console.log('RESULT: MATCH');
            } else {
                console.log(`RESULT: MISMATCH (Loan User: ${userId})`);
            }
        } else {
            console.log('RESULT: NOT FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Force exit to ensure flush
        process.exit(0);
    }
}

checkLoan();
