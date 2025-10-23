const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Migration Script: Create Companies Table
 * Creates a table to store company names for autocomplete suggestions
 */

async function createCompaniesTable() {
  try {
    console.log('Starting companies table creation...');
    
    await initializeDatabase();

    // Create companies table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(100) DEFAULT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        employee_count_range VARCHAR(50) DEFAULT NULL,
        search_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company_name (company_name),
        INDEX idx_search_count (search_count),
        UNIQUE KEY unique_company_name (company_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Companies table created successfully');

    // Insert some popular Indian companies as seed data
    const popularCompanies = [
      ['Tata Consultancy Services', 'Information Technology', true, '100000+'],
      ['Infosys', 'Information Technology', true, '100000+'],
      ['Wipro', 'Information Technology', true, '50000-100000'],
      ['HCL Technologies', 'Information Technology', true, '50000-100000'],
      ['Tech Mahindra', 'Information Technology', true, '10000-50000'],
      ['Reliance Industries', 'Conglomerate', true, '100000+'],
      ['ICICI Bank', 'Banking & Financial Services', true, '50000-100000'],
      ['HDFC Bank', 'Banking & Financial Services', true, '50000-100000'],
      ['State Bank of India', 'Banking & Financial Services', true, '100000+'],
      ['Axis Bank', 'Banking & Financial Services', true, '10000-50000'],
      ['Kotak Mahindra Bank', 'Banking & Financial Services', true, '10000-50000'],
      ['Amazon India', 'E-commerce', true, '50000-100000'],
      ['Flipkart', 'E-commerce', true, '10000-50000'],
      ['Accenture India', 'Information Technology', true, '50000-100000'],
      ['Cognizant', 'Information Technology', true, '100000+'],
      ['Capgemini India', 'Information Technology', true, '10000-50000'],
      ['IBM India', 'Information Technology', true, '10000-50000'],
      ['Microsoft India', 'Information Technology', true, '5000-10000'],
      ['Google India', 'Information Technology', true, '5000-10000'],
      ['Deloitte India', 'Consulting', true, '10000-50000'],
      ['PwC India', 'Consulting', true, '10000-50000'],
      ['EY India', 'Consulting', true, '10000-50000'],
      ['KPMG India', 'Consulting', true, '5000-10000'],
      ['Mahindra & Mahindra', 'Automotive', true, '50000-100000'],
      ['Tata Motors', 'Automotive', true, '50000-100000'],
      ['Maruti Suzuki', 'Automotive', true, '10000-50000'],
      ['Hyundai Motor India', 'Automotive', true, '5000-10000'],
      ['Honda India', 'Automotive', true, '5000-10000'],
      ['Bharti Airtel', 'Telecommunications', true, '10000-50000'],
      ['Vodafone Idea', 'Telecommunications', true, '10000-50000'],
    ];

    console.log('Inserting seed data...');
    
    for (const [name, industry, verified, empCount] of popularCompanies) {
      await executeQuery(
        `INSERT IGNORE INTO companies (company_name, industry, is_verified, employee_count_range) 
         VALUES (?, ?, ?, ?)`,
        [name, industry, verified, empCount]
      );
    }
    
    console.log(`✅ Inserted ${popularCompanies.length} companies as seed data`);
    console.log('✅ Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

createCompaniesTable();

