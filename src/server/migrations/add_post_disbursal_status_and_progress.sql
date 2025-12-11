-- Migration: Add 'ready_for_disbursement' status and post-disbursal progress tracking
-- This adds the new status and fields to track user progress through post-disbursal steps

-- 1. Add new status to loan_applications table
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

-- 2. Add post-disbursal progress tracking fields
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS enach_done TINYINT(1) DEFAULT 0 COMMENT 'E-NACH registration completed',
ADD COLUMN IF NOT EXISTS selfie_captured TINYINT(1) DEFAULT 0 COMMENT 'Selfie image captured',
ADD COLUMN IF NOT EXISTS selfie_verified TINYINT(1) DEFAULT 0 COMMENT 'Face match verification passed',
ADD COLUMN IF NOT EXISTS selfie_image_url VARCHAR(500) NULL COMMENT 'S3 URL of captured selfie',
ADD COLUMN IF NOT EXISTS references_completed TINYINT(1) DEFAULT 0 COMMENT '3 references and alternate number provided',
ADD COLUMN IF NOT EXISTS kfs_viewed TINYINT(1) DEFAULT 0 COMMENT 'KFS document viewed',
ADD COLUMN IF NOT EXISTS agreement_signed TINYINT(1) DEFAULT 0 COMMENT 'Loan agreement e-signed',
ADD COLUMN IF NOT EXISTS post_disbursal_step INT DEFAULT 1 COMMENT 'Current step in post-disbursal flow (1-7)',
ADD COLUMN IF NOT EXISTS post_disbursal_progress JSON NULL COMMENT 'Detailed progress tracking for each step';




