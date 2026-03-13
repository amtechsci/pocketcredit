-- Loan status history for Performance tab and reporting.
-- Run this once to create the table (or it is created automatically on first use).

CREATE TABLE IF NOT EXISTS `loan_status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_application_id` int NOT NULL,
  `from_status` varchar(50) DEFAULT NULL,
  `to_status` varchar(50) NOT NULL,
  `admin_id` varchar(36) DEFAULT NULL,
  `source` enum('status_api','validation_submit') DEFAULT 'status_api',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_loan_status_history_loan_id` (`loan_application_id`),
  KEY `idx_loan_status_history_created_at` (`created_at`),
  KEY `idx_loan_status_history_admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: extend user_validation_history.action_type if your DB still has the original enum.
-- ALTER TABLE user_validation_history MODIFY COLUMN action_type
--   enum('need_document','process','not_process','cancel','re_process','qa_verification','qa_approve','move_to_tvr') NOT NULL;
