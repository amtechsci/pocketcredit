const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateLoanTables() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pocket_credit'
    });

    console.log('Connected to database successfully');

    // 1. Update loan_applications table - add new status values
    console.log('\n1. Updating loan_applications table status enum...');
    await connection.execute(`
      ALTER TABLE loan_applications 
      MODIFY COLUMN status ENUM('submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'closed', 'settled') 
      NOT NULL DEFAULT 'submitted'
    `);
    console.log('✅ Added closed and settled status to loan_applications');

    // 2. Update loans table - add settled status
    console.log('\n2. Updating loans table status enum...');
    await connection.execute(`
      ALTER TABLE loans 
      MODIFY COLUMN status ENUM('active', 'closed', 'settled') 
      NOT NULL DEFAULT 'active'
    `);
    console.log('✅ Added settled status to loans');

    // 3. Remove emi_amount from loan_applications
    console.log('\n3. Removing emi_amount from loan_applications...');
    try {
      await connection.execute(`
        ALTER TABLE loan_applications 
        DROP COLUMN emi_amount
      `);
      console.log('✅ Removed emi_amount from loan_applications');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️  emi_amount column does not exist in loan_applications (already removed)');
      } else {
        throw error;
      }
    }

    // 4. Remove emi_amount from loans
    console.log('\n4. Removing emi_amount from loans...');
    try {
      await connection.execute(`
        ALTER TABLE loans 
        DROP COLUMN emi_amount
      `);
      console.log('✅ Removed emi_amount from loans');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️  emi_amount column does not exist in loans (already removed)');
      } else {
        throw error;
      }
    }

    // 5. Remove first_emi_date and last_emi_date from loans
    console.log('\n5. Removing first_emi_date and last_emi_date from loans...');
    try {
      await connection.execute(`
        ALTER TABLE loans 
        DROP COLUMN first_emi_date,
        DROP COLUMN last_emi_date
      `);
      console.log('✅ Removed first_emi_date and last_emi_date from loans');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️  first_emi_date and last_emi_date columns do not exist in loans (already removed)');
      } else {
        throw error;
      }
    }

    // 6. Rename loan_references table to references
    console.log('\n6. Renaming loan_references table to references...');
    try {
      await connection.execute(`
        RENAME TABLE loan_references TO \`references\`
      `);
      console.log('✅ Renamed loan_references table to references');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS') {
        console.log('ℹ️  references table already exists, skipping rename');
      } else if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️  loan_references table does not exist, creating references table...');
        await connection.execute(`
          CREATE TABLE \`references\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            loan_application_id INT NOT NULL,
            reference1 VARCHAR(15) NOT NULL,
            reference2 VARCHAR(15) NOT NULL,
            reference3 VARCHAR(15) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
          )
        `);
        console.log('✅ Created references table');
      } else {
        throw error;
      }
    }

    // 7. Update any existing foreign key references
    console.log('\n7. Updating foreign key references...');
    try {
      // Check if bank_details table references loan_references
      const [bankDetailsColumns] = await connection.execute(`
        SHOW COLUMNS FROM bank_details LIKE '%loan_application_id%'
      `);
      
      if (bankDetailsColumns.length > 0) {
        console.log('✅ bank_details already has loan_application_id foreign key');
      }
    } catch (error) {
      console.log('ℹ️  No foreign key updates needed');
    }

    console.log('\n🎉 All database updates completed successfully!');

  } catch (error) {
    console.error('❌ Error updating database:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run the migration
updateLoanTables()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
