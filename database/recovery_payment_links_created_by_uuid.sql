-- Fix created_by: admins.id is UUID (VARCHAR), not INT.
-- Run if recovery_payment_links.created_by was created as INT (wrong parse e.g. 487 from UUID 0487e207-...).

ALTER TABLE recovery_payment_links
  MODIFY COLUMN created_by VARCHAR(36) NULL COMMENT 'admins.id (UUID)';
