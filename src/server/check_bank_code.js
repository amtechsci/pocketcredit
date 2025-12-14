const mysql = require('mysql2/promise');

async function check() {
    const config = {
        host: '13.235.251.238',
        user: 'pocket',
        password: 'Pocket@9988',
        database: 'pocket_credit',
        port: 3306
    };

    try {
        const conn = await mysql.createConnection(config);
        console.log('Connected!');

        // Get user ID for application 46
        const [apps] = await conn.execute('SELECT user_id FROM loan_applications WHERE id = 46');
        if (apps.length > 0) {
            const userId = apps[0].user_id;
            console.log(`User ID: ${userId}`);

            // Get primary bank details
            const [banks] = await conn.execute('SELECT bank_name, account_number, ifsc_code FROM bank_details WHERE user_id = ? AND is_primary = 1', [userId]);
            if (banks.length > 0) {
                const bank = banks[0];
                console.log('Bank details:', bank);
                console.log('Extracted bank code (first 4 chars):', bank.ifsc_code.substring(0, 4));
            }
        }

        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
