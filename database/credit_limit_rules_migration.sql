-- Credit Limit Rules: dynamic DB-driven logic (see docs/CREDIT_LIMIT_RULES_IMPLEMENTATION_PLAN.md)
-- Run this migration once. Safe to run if table already exists (CREATE IF NOT EXISTS).

-- 1. Create credit_limit_rules table
CREATE TABLE IF NOT EXISTS credit_limit_rules (
  id INT NOT NULL AUTO_INCREMENT,
  rule_name VARCHAR(100) NOT NULL,
  rule_code VARCHAR(50) DEFAULT NULL,
  description TEXT,
  percentage_tiers JSON NOT NULL COMMENT 'Array of % by loan count, e.g. [8, 11, 15.2, 20.9, 28, 32.1]',
  first_time_percentage DECIMAL(5,2) NOT NULL DEFAULT 8,
  max_regular_cap DECIMAL(10,2) NOT NULL DEFAULT 45600,
  premium_limit DECIMAL(10,2) DEFAULT 150000,
  premium_tenure_months INT DEFAULT 24,
  triggers_cooling_period TINYINT(1) DEFAULT 1,
  is_default TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_rule_code (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed default rule (current hardcoded behaviour) - only if no default exists
INSERT INTO credit_limit_rules (
  rule_name, rule_code, description,
  percentage_tiers, first_time_percentage, max_regular_cap, premium_limit, premium_tenure_months,
  triggers_cooling_period, is_default, is_active, sort_order
)
SELECT
  'Default 2 EMI',
  'default_2emi',
  'Current production logic: 8%, 11%, 15.2%, 20.9%, 28%, 32.1% by loan count; cap 45600; premium 150000.',
  '[8, 11, 15.2, 20.9, 28, 32.1]',
  8,
  45600,
  150000,
  24,
  1,
  1,
  1,
  0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM credit_limit_rules WHERE is_default = 1 LIMIT 1);

-- 3. Add user assignment column and FK (run only once).
--    If column already exists, skip the three ALTER statements below or run them individually.
ALTER TABLE users ADD COLUMN credit_limit_rule_id INT NULL AFTER loan_limit;
ALTER TABLE users ADD INDEX idx_users_credit_limit_rule_id (credit_limit_rule_id);
ALTER TABLE users ADD CONSTRAINT fk_users_credit_limit_rule
  FOREIGN KEY (credit_limit_rule_id) REFERENCES credit_limit_rules(id) ON DELETE SET NULL;
