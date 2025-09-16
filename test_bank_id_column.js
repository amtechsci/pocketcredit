const mysql = require('mysql2/promise');

async function testBankIdColumn() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'pocket_loan'
    });

    // Check if bank_id column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM loan_applications LIKE 'bank_id'"
    );

    if (columns.length === 0) {
      console.log('bank_id column does not exist. Adding it...');
      
      // Add bank_id column
      await connection.execute(
        'ALTER TABLE loan_applications ADD COLUMN bank_id INT NULL'
      );
      
      // Add foreign key constraint
      await connection.execute(
        'ALTER TABLE loan_applications ADD CONSTRAINT fk_loan_applications_bank_id FOREIGN KEY (bank_id) REFERENCES bank_details(id) ON DELETE SET NULL'
      );
      
      // Add index
      await connection.execute(
        'CREATE INDEX idx_loan_applications_bank_id ON loan_applications(bank_id)'
      );
      
      console.log('bank_id column added successfully!');
    } else {
      console.log('bank_id column already exists');
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBankIdColumn();
