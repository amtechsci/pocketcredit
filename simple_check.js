const mysql = require('mysql2/promise');

async function run() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'pocket_credit'
        });

        console.log('Connected!');

        const [loans] = await connection.execute('SELECT id, user_id, status FROM loan_applications WHERE id = 38');
        console.log('Loan 38:', loans);

        const [users] = await connection.execute('SELECT id, first_name, last_name FROM users WHERE id = 58');
        console.log('User 58:', users);

        await connection.end();
    } catch (err) {
        console.error(err);
    }
}

run();
