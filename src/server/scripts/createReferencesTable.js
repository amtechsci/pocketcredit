const { getConnection } = require('../utils/mysqlDatabase');

async function createReferencesTable() {
  let connection;
  
  try {
    connection = await getConnection();
    console.log('Connected to database');

    // Drop existing references table if it exists (to recreate with new structure)
    await connection.execute(`DROP TABLE IF EXISTS \`references\``);
    console.log('Dropped existing references table');

    // Create new references table with detailed structure
    await connection.execute(`
      CREATE TABLE \`references\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        loan_application_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        relation VARCHAR(50) NOT NULL,
        status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_loan_application_id (loan_application_id),
        INDEX idx_status (status)
      )
    `);

    console.log('Successfully created references table with new structure');

  } catch (error) {
    console.error('Error creating references table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
createReferencesTable()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
