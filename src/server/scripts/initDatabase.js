const { writeDatabase, readDatabase } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Initialize database with sample data
const initializeDatabase = () => {
  console.log('🔄 Initializing database...');
  
  try {
    const db = readDatabase();
    
    // Check if database is already initialized
    if (db.users.length > 0 || db.admins.length > 0) {
      console.log('✅ Database already initialized with data');
      return;
    }

    // Create admin users
    const admins = [
      {
        id: uuidv4(),
        name: 'Sarah Johnson',
        email: 'admin@pocketcredit.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'superadmin',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Raj Patel',
        email: 'manager@pocketcredit.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'manager',
        permissions: ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_documents'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Priya Singh',
        email: 'officer@pocketcredit.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'officer',
        permissions: ['view_loans', 'view_users', 'add_notes', 'verify_documents'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create sample users
    const users = [
      {
        id: uuidv4(),
        name: 'Rajesh Kumar Singh',
        email: 'rajesh.kumar@email.com',
        mobile: '9876543210',
        password: bcrypt.hashSync('password123', 10),
        dateOfBirth: '1990-05-15',
        panNumber: 'ABCDE1234F',
        kycStatus: 'completed',
        isEmailVerified: true,
        isMobileVerified: true,
        creditScore: 720,
        riskCategory: 'low',
        memberLevel: 'silver',
        personalInfo: {
          fatherName: 'Mohan Kumar Singh',
          motherName: 'Sunita Singh',
          spouseName: 'Priya Singh',
          address: '123, MG Road, Koramangala',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560034',
          maritalStatus: 'married',
          education: 'B.Tech Computer Science',
          employment: 'Software Engineer',
          company: 'TCS Limited',
          monthlyIncome: 75000,
          workExperience: '5 years'
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Anjali Sharma',
        email: 'anjali.sharma@email.com',
        mobile: '9876543211',
        password: bcrypt.hashSync('password123', 10),
        dateOfBirth: '1988-08-22',
        panNumber: 'FGHIJ5678K',
        kycStatus: 'pending',
        isEmailVerified: true,
        isMobileVerified: true,
        creditScore: 650,
        riskCategory: 'medium',
        memberLevel: 'bronze',
        personalInfo: {
          fatherName: 'Ramesh Sharma',
          motherName: 'Kavita Sharma',
          address: '456, Park Street, Sector 18',
          city: 'Noida',
          state: 'Uttar Pradesh',
          pincode: '201301',
          maritalStatus: 'single',
          education: 'MBA Finance',
          employment: 'Business Analyst',
          company: 'Infosys Limited',
          monthlyIncome: 85000,
          workExperience: '6 years'
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create sample loan applications
    const loans = [
      {
        id: uuidv4(),
        loanId: 'CL250912',
        userId: users[0].id,
        type: 'personal',
        amount: 500000,
        tenure: 36,
        purpose: 'Home Renovation',
        interestRate: 14,
        emi: 17094,
        status: 'under_review',
        applicationData: {
          monthlyIncome: 75000,
          employmentType: 'salaried',
          companyName: 'TCS Limited',
          workExperience: '5 years',
          existingLoans: 0,
          cibilScore: 720
        },
        processingFee: 5000,
        insurance: 2500,
        createdAt: '2025-01-09T10:00:00.000Z',
        updatedAt: '2025-01-09T10:00:00.000Z'
      },
      {
        id: uuidv4(),
        loanId: 'CL240815',
        userId: users[0].id,
        type: 'personal',
        amount: 200000,
        tenure: 24,
        purpose: 'Medical Emergency',
        interestRate: 16,
        emi: 9578,
        status: 'closed',
        applicationData: {
          monthlyIncome: 75000,
          employmentType: 'salaried',
          companyName: 'TCS Limited',
          workExperience: '4 years',
          existingLoans: 0,
          cibilScore: 710
        },
        processingFee: 2000,
        insurance: 1000,
        disbursalDate: '2024-08-20T10:00:00.000Z',
        closedDate: '2024-12-05T10:00:00.000Z',
        createdAt: '2024-08-15T10:00:00.000Z',
        updatedAt: '2024-12-05T10:00:00.000Z'
      }
    ];

    // Create sample transactions
    const transactions = [
      {
        id: uuidv4(),
        userId: users[0].id,
        loanId: loans[0].loanId,
        type: 'debit',
        amount: -999,
        description: 'Application Fee',
        status: 'completed',
        reference: 'APP_FEE_CL250912',
        method: 'UPI',
        createdAt: '2025-01-09T10:30:00.000Z',
        updatedAt: '2025-01-09T10:30:00.000Z'
      },
      {
        id: uuidv4(),
        userId: users[0].id,
        loanId: loans[1].loanId,
        type: 'debit',
        amount: -9578,
        description: 'Final EMI Payment',
        status: 'completed',
        reference: 'EMI_24_CL240815',
        method: 'Auto Debit',
        createdAt: '2024-12-05T10:00:00.000Z',
        updatedAt: '2024-12-05T10:00:00.000Z'
      }
    ];

    // Create sample documents
    const documents = [
      {
        id: uuidv4(),
        userId: users[0].id,
        name: 'PAN Card',
        type: 'identity',
        status: 'verified',
        fileName: 'pan_card.pdf',
        fileSize: '1.2 MB',
        uploadPath: '/uploads/documents/',
        verifiedBy: admins[1].id,
        verificationDate: '2025-01-09T10:00:00.000Z',
        remarks: 'Clear and valid PAN card',
        createdAt: '2025-01-09T09:00:00.000Z',
        updatedAt: '2025-01-09T10:00:00.000Z'
      },
      {
        id: uuidv4(),
        userId: users[0].id,
        name: 'Aadhaar Card',
        type: 'identity',
        status: 'verified',
        fileName: 'aadhaar_card.pdf',
        fileSize: '0.8 MB',
        uploadPath: '/uploads/documents/',
        verifiedBy: admins[1].id,
        verificationDate: '2025-01-09T10:00:00.000Z',
        remarks: 'Address matches with application',
        createdAt: '2025-01-09T09:00:00.000Z',
        updatedAt: '2025-01-09T10:00:00.000Z'
      }
    ];

    // Create sample bank information
    const bankInfo = [
      {
        id: uuidv4(),
        userId: users[0].id,
        bankName: 'HDFC Bank',
        accountNumber: '50100123456789',
        ifscCode: 'HDFC0001234',
        accountType: 'savings',
        accountHolderName: 'Rajesh Kumar Singh',
        branchName: 'Koramangala Branch',
        averageBalance: 125000,
        relationshipLength: '5 years',
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create sample references
    const references = [
      {
        id: uuidv4(),
        userId: users[0].id,
        name: 'Amit Sharma',
        relationship: 'friend',
        phone: '9988776655',
        email: 'amit.sharma@email.com',
        address: 'HSR Layout, Bangalore',
        verificationStatus: 'verified',
        contactedDate: '2025-01-09T10:00:00.000Z',
        feedback: 'Confirmed employment and character. Positive reference.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create sample admin notes
    const notes = [
      {
        id: uuidv4(),
        userId: users[0].id,
        adminId: admins[1].id,
        note: 'Customer has good employment history and stable income. CIBIL score is satisfactory. Previous loan repayment record is excellent.',
        type: 'assessment',
        category: 'positive',
        visibility: 'internal',
        createdAt: '2025-01-09T10:00:00.000Z',
        updatedAt: '2025-01-09T10:00:00.000Z'
      }
    ];

    // Create sample CIBIL data
    const cibilData = [
      {
        id: uuidv4(),
        userId: users[0].id,
        score: 720,
        lastUpdated: '2024-12-15T10:00:00.000Z',
        trend: 'improving',
        factors: {
          paymentHistory: { score: 85, status: 'good' },
          creditUtilization: { score: 78, status: 'fair' },
          creditLength: { score: 82, status: 'good' },
          creditMix: { score: 75, status: 'fair' },
          newCredit: { score: 88, status: 'excellent' }
        },
        accounts: [
          {
            type: 'Credit Card',
            bank: 'HDFC Bank',
            limit: 500000,
            outstanding: 125000,
            utilization: 25,
            status: 'active',
            monthsReported: 36
          }
        ],
        inquiries: [
          { date: '2025-01-07', type: 'Personal Loan', inquiredBy: 'Pocket Credit' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create sample PAN data
    const panData = [
      {
        id: uuidv4(),
        userId: users[0].id,
        panNumber: 'ABCDE1234F',
        name: 'RAJESH KUMAR SINGH',
        dateOfBirth: '15/05/1990',
        status: 'valid',
        lastVerified: '2025-01-09T10:00:00.000Z',
        linkingStatus: {
          aadhaar: true,
          bank: true,
          mobile: true,
          email: false
        },
        filings: [
          { year: '2023-24', status: 'filed', income: 900000 },
          { year: '2022-23', status: 'filed', income: 850000 },
          { year: '2021-22', status: 'filed', income: 750000 }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Update database with sample data
    db.admins = admins;
    db.users = users;
    db.loans = loans;
    db.transactions = transactions;
    db.documents = documents;
    db.bankInfo = bankInfo;
    db.references = references;
    db.notes = notes;
    db.cibilData = cibilData;
    db.panData = panData;

    // Initialize sequences
    db.sequences = {
      loanId: 250912,
      applicationId: 100001,
      transactionId: 200001
    };

    // Write to database
    writeDatabase(db);
    
    console.log('✅ Database initialized successfully with sample data');
    console.log(`   - ${admins.length} admin users created`);
    console.log(`   - ${users.length} regular users created`);
    console.log(`   - ${loans.length} loan applications created`);
    console.log(`   - ${transactions.length} transactions created`);
    console.log(`   - ${documents.length} documents created`);
    console.log('   - Sample admin credentials:');
    console.log('     Super Admin: admin@pocketcredit.com / admin123');
    console.log('     Manager: manager@pocketcredit.com / admin123');
    console.log('     Officer: officer@pocketcredit.com / admin123');
    console.log('   - Sample user credentials:');
    console.log('     User: rajesh.kumar@email.com / password123');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;