-- Recovery payment links (admin-generated Cashfree pay links)
-- Run manually against the Pocket Credit MySQL database.

CREATE TABLE IF NOT EXISTS recovery_payment_links (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_slug CHAR(36) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  loan_application_id INT UNSIGNED NOT NULL,
  payment_type VARCHAR(32) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status ENUM('pending', 'paid', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  created_by VARCHAR(36) NULL COMMENT 'admins.id (UUID)',
  paid_at DATETIME NULL,
  last_order_id VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_recovery_public_slug (public_slug),
  KEY idx_recovery_user (user_id),
  KEY idx_recovery_loan (loan_application_id),
  KEY idx_recovery_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link Cashfree orders back to recovery rows (nullable for non-recovery orders)
ALTER TABLE payment_orders
  ADD COLUMN recovery_link_id INT UNSIGNED NULL AFTER extension_id;

-- Optional FK — skip if your DB user lacks privileges or types differ; app enforces integrity.
-- ALTER TABLE payment_orders ADD CONSTRAINT fk_payment_orders_recovery_link
--   FOREIGN KEY (recovery_link_id) REFERENCES recovery_payment_links(id) ON DELETE SET NULL;
