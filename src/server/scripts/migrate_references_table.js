const { executeQuery, initializeDatabase } = require('../config/database');

async function migrate() {
  try {
    await initializeDatabase();

    const steps = [
      { sql: "ALTER TABLE `references` DROP COLUMN loan_application_id", optional: true },
      { sql: "ALTER TABLE `references` ADD COLUMN admin_id INT NULL AFTER status", optional: true },
      { sql: "ALTER TABLE `references` ADD CONSTRAINT fk_refs_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL", optional: true },
      { sql: "DROP TABLE IF EXISTS user_references" },
      { sql: "DROP TABLE IF EXISTS loan_references" }
    ];

    for (const step of steps) {
      try {
        console.log('RUN:', step.sql);
        await executeQuery(step.sql);
        console.log('OK');
      } catch (err) {
        if (step.optional) {
          console.log('SKIP (optional):', err.message);
        } else {
          console.log('ERR:', err.message);
        }
      }
    }

    const desc = await executeQuery('DESCRIBE `references`');
    console.log('\nDESCRIBE `references`:', desc);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

migrate();


