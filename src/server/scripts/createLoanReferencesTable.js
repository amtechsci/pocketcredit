const { getConnection } = require('../utils/mysqlDatabase');

async function createLoanReferencesTable() {
  let connection;
  
  try {
    connection = await getConnection();
    console.log('Connected to database');

    // Create loan_references table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS loan_references (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        loan_application_id INT NOT NULL,
        reference1 VARCHAR(15) NOT NULL,
        reference2 VARCHAR(15) NOT NULL,
        reference3 VARCHAR(15) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_loan_application_id (loan_application_id),
        UNIQUE KEY unique_loan_references (loan_application_id)
      )
    `);

    console.log('Successfully created loan_references table');

  } catch (error) {
    console.error('Error creating loan_references table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
createLoanReferencesTable()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

