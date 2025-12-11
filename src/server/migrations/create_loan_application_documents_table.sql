-- Migration: Create loan_application_documents table
-- Stores documents uploaded for loan applications (e.g., bank statements, salary slips, Aadhar, PAN)

CREATE TABLE IF NOT EXISTS loan_application_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_application_id INT NOT NULL,
  user_id INT NOT NULL,
  document_name VARCHAR(255) NOT NULL COMMENT 'Human-readable document name (e.g., "Last 3 month bank statement")',
  document_type VARCHAR(100) NOT NULL COMMENT 'Document type identifier (e.g., "bank_statement", "salary_slip", "aadhar_front")',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  s3_key VARCHAR(500),
  s3_bucket VARCHAR(255),
  file_size INT COMMENT 'File size in bytes',
  mime_type VARCHAR(100),
  upload_status ENUM('pending', 'uploaded', 'verified', 'rejected') DEFAULT 'uploaded',
  verification_notes TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  verified_by INT NULL COMMENT 'Admin user ID who verified',
  FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_loan_application_id (loan_application_id),
  INDEX idx_user_id (user_id),
  INDEX idx_upload_status (upload_status),
  INDEX idx_document_type (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores documents uploaded for loan applications';




