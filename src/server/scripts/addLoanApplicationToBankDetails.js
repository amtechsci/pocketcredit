const { getConnection } = require('../utils/mysqlDatabase');

async function addLoanApplicationToBankDetails() {
  let connection;
  
  try {
    connection = await getConnection();
    console.log('Connected to database');

    // Check if the column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'bank_details' 
      AND COLUMN_NAME = 'loan_application_id'
    `);

    if (columns.length > 0) {
      console.log('Column loan_application_id already exists in bank_details table');
      return;
    }

    // Add the loan_application_id column
    await connection.execute(`
      ALTER TABLE bank_details 
      ADD COLUMN loan_application_id INT NULL,
      ADD FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE SET NULL,
      ADD INDEX idx_loan_application_id (loan_application_id)
    `);

    console.log('Successfully added loan_application_id column to bank_details table');

  } catch (error) {
    console.error('Error adding loan_application_id column:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
addLoanApplicationToBankDetails()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

