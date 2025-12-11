const { initializeDatabase, executeQuery, closeConnections } = require('./config/database');

async function checkStatus() {
    try {
        await initializeDatabase();

        const loans = await executeQuery('SELECT id, status FROM loan_applications WHERE id = ?', [38]);

        if (loans.length > 0) {
            console.log(`STATUS: ${loans[0].status}`);
        } else {
            console.log('RESULT: NOT FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkStatus();
