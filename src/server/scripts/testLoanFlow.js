const { getConnection } = require('../utils/mysqlDatabase');

async function testLoanFlow() {
  let connection;
  
  try {
    connection = await getConnection();
    console.log('Connected to database');

    // Test 1: Check if loan_applications table exists and has data
    console.log('\n=== Test 1: Check loan_applications table ===');
    const [applications] = await connection.execute('SELECT * FROM loan_applications ORDER BY created_at DESC LIMIT 5');
    console.log('Recent loan applications:', applications);

    // Test 2: Check if bank_details table exists and has data
    console.log('\n=== Test 2: Check bank_details table ===');
    const [bankDetails] = await connection.execute('SELECT * FROM bank_details ORDER BY created_at DESC LIMIT 5');
    console.log('Recent bank details:', bankDetails);

    // Test 3: Check if loan_references table exists and has data
    console.log('\n=== Test 3: Check loan_references table ===');
    const [references] = await connection.execute('SELECT * FROM loan_references ORDER BY created_at DESC LIMIT 5');
    console.log('Recent loan references:', references);

    // Test 4: Test the step determination query
    console.log('\n=== Test 4: Test step determination query ===');
    const [stepTest] = await connection.execute(`
      SELECT la.*, 
              CASE 
                WHEN bd.id IS NOT NULL AND lr.id IS NOT NULL THEN 'completed'
                WHEN bd.id IS NOT NULL THEN 'references'
                ELSE 'bank_details'
              END as current_step
       FROM loan_applications la
       LEFT JOIN bank_details bd ON la.id = bd.loan_application_id
       LEFT JOIN loan_references lr ON la.id = lr.loan_application_id
       ORDER BY la.created_at DESC
       LIMIT 5
    `);
    console.log('Step determination test:', stepTest);

    // Test 5: Check pending applications query
    console.log('\n=== Test 5: Check pending applications query ===');
    const [pendingTest] = await connection.execute(`
      SELECT la.*, 
              CASE 
                WHEN bd.id IS NOT NULL AND lr.id IS NOT NULL THEN 'completed'
                WHEN bd.id IS NOT NULL THEN 'references'
                ELSE 'bank_details'
              END as current_step
       FROM loan_applications la
       LEFT JOIN bank_details bd ON la.id = bd.loan_application_id
       LEFT JOIN loan_references lr ON la.id = lr.loan_application_id
       WHERE la.status != 'completed'
       ORDER BY la.created_at DESC
    `);
    console.log('Pending applications test:', pendingTest);

  } catch (error) {
    console.error('Error testing loan flow:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testLoanFlow()
  .then(() => {
    console.log('\n=== Test completed successfully ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

