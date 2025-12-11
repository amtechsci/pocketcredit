-- Simple SQL to add post-disbursal columns
-- Run this directly in your MySQL database if the Node.js migration fails

-- Add status value first
ALTER TABLE loan_applications 
MODIFY COLUMN status ENUM(
  'submitted', 
  'under_review', 
  'follow_up', 
  'approved', 
  'disbursal', 
  'ready_for_disbursement',
  'disbursed', 
  'account_manager', 
  'cleared', 
  'rejected', 
  'cancelled'
) NOT NULL DEFAULT 'submitted';

-- Add columns one by one (check if they exist first manually)
ALTER TABLE loan_applications
ADD COLUMN enach_done TINYINT(1) DEFAULT 0 COMMENT 'E-NACH registration completed';

ALTER TABLE loan_applications
ADD COLUMN selfie_captured TINYINT(1) DEFAULT 0 COMMENT 'Selfie image captured';

ALTER TABLE loan_applications
ADD COLUMN selfie_verified TINYINT(1) DEFAULT 0 COMMENT 'Face match verification passed';

ALTER TABLE loan_applications
ADD COLUMN selfie_image_url VARCHAR(500) NULL COMMENT 'S3 URL of captured selfie';

ALTER TABLE loan_applications
ADD COLUMN references_completed TINYINT(1) DEFAULT 0 COMMENT '3 references and alternate number provided';

ALTER TABLE loan_applications
ADD COLUMN kfs_viewed TINYINT(1) DEFAULT 0 COMMENT 'KFS document viewed';

ALTER TABLE loan_applications
ADD COLUMN agreement_signed TINYINT(1) DEFAULT 0 COMMENT 'Loan agreement e-signed';

ALTER TABLE loan_applications
ADD COLUMN post_disbursal_step INT DEFAULT 1 COMMENT 'Current step in post-disbursal flow (1-7)';

ALTER TABLE loan_applications
ADD COLUMN post_disbursal_progress JSON NULL COMMENT 'Detailed progress tracking for each step';




