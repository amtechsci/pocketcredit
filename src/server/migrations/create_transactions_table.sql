-- Migration: Create transactions table
-- Stores all financial transactions including loan disbursements
-- Linked to admins table for created_by

CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  loan_application_id INT NULL COMMENT 'Linked loan application (for loan-related transactions)',
  transaction_type ENUM(
    'credit', 
    'debit', 
    'emi_payment', 
    'loan_disbursement', 
    'refund', 
    'penalty', 
    'interest', 
    'processing_fee', 
    'other'
  ) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description VARCHAR(500),
  category VARCHAR(100),
  payment_method ENUM(
    'upi', 
    'net_banking', 
    'debit_card', 
    'credit_card', 
    'neft', 
    'rtgs', 
    'imps', 
    'cash', 
    'cheque', 
    'other'
  ),
  reference_number VARCHAR(100),
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  status ENUM(
    'pending', 
    'completed', 
    'failed', 
    'processing', 
    'cancelled'
  ) DEFAULT 'completed',
  priority ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
  bank_name VARCHAR(255),
  account_number VARCHAR(50),
  additional_notes TEXT,
  created_by VARCHAR(36) NOT NULL COMMENT 'Admin ID who created the transaction',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE RESTRICT,
  INDEX idx_user_id (user_id),
  INDEX idx_loan_application_id (loan_application_id),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_transaction_date (transaction_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores all financial transactions';
