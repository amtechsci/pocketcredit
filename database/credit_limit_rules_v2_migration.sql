-- Credit Limit Rules V2: fixed-amount tiers, block-after-N, auto-assignment
-- Run AFTER credit_limit_rules_migration.sql has been applied.
-- Safe to re-run: uses IF NOT EXISTS / conditional logic where possible.

-- 1. Make percentage_tiers nullable (needed for fixed-amount-only rules)
ALTER TABLE credit_limit_rules MODIFY COLUMN percentage_tiers JSON DEFAULT NULL COMMENT 'Array of % by loan count (used when calculation_mode=percentage)';

-- 2. Add new columns (IF NOT EXISTS: MySQL 8.0.29+, safe to re-run)
ALTER TABLE credit_limit_rules
  ADD COLUMN IF NOT EXISTS calculation_mode VARCHAR(20) NOT NULL DEFAULT 'percentage' COMMENT 'percentage or fixed' AFTER description,
  ADD COLUMN IF NOT EXISTS fixed_amount_tiers JSON DEFAULT NULL COMMENT 'Array of fixed rupee amounts by loan count (used when calculation_mode=fixed)' AFTER percentage_tiers,
  ADD COLUMN IF NOT EXISTS block_after_tier INT DEFAULT NULL COMMENT 'Block profile after this many loans cleared (NULL = use premium/max logic)' AFTER triggers_cooling_period,
  ADD COLUMN IF NOT EXISTS salary_min DECIMAL(12,2) DEFAULT NULL COMMENT 'Auto-assign: minimum salary (inclusive)' AFTER sort_order,
  ADD COLUMN IF NOT EXISTS salary_max DECIMAL(12,2) DEFAULT NULL COMMENT 'Auto-assign: maximum salary (inclusive, NULL = no upper bound)' AFTER salary_min,
  ADD COLUMN IF NOT EXISTS auto_assign TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = participates in salary-based auto-assignment' AFTER salary_max;

-- 3. Mark existing default rule as NOT auto-assign (old users stay on this)
UPDATE credit_limit_rules
SET auto_assign = 0, calculation_mode = 'percentage'
WHERE rule_code = 'default_2emi';

-- 4. Seed new rule: Salary <= 1 lakh (percentage mode)
INSERT INTO credit_limit_rules (
  rule_name, rule_code, description,
  calculation_mode, percentage_tiers, fixed_amount_tiers,
  first_time_percentage, max_regular_cap, premium_limit, premium_tenure_months,
  triggers_cooling_period, block_after_tier,
  is_default, is_active, sort_order,
  salary_min, salary_max, auto_assign
)
SELECT
  'New User - Salary up to 1L',
  'new_sal_upto_1l',
  'For new users with salary <= 1 lakh. Percentage-based: 15%, 18%, 21%, 25%, 30%, 50%. Block after 5th loan.',
  'percentage',
  '[15, 18, 21, 25, 30, 50]',
  NULL,
  15,
  999999,
  NULL,
  NULL,
  1,
  5,
  0,
  1,
  1,
  0,
  100000,
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM credit_limit_rules WHERE rule_code = 'new_sal_upto_1l' LIMIT 1);

-- 5. Seed new rule: Salary > 1 lakh (fixed mode)
INSERT INTO credit_limit_rules (
  rule_name, rule_code, description,
  calculation_mode, percentage_tiers, fixed_amount_tiers,
  first_time_percentage, max_regular_cap, premium_limit, premium_tenure_months,
  triggers_cooling_period, block_after_tier,
  is_default, is_active, sort_order,
  salary_min, salary_max, auto_assign
)
SELECT
  'New User - Salary above 1L',
  'new_sal_above_1l',
  'For new users with salary > 1 lakh. Fixed amounts: 15000, 18000, 22000, 27000, 33000, 50000. Block after 5th loan.',
  'fixed',
  NULL,
  '[15000, 18000, 22000, 27000, 33000, 50000]',
  15,
  999999,
  NULL,
  NULL,
  1,
  5,
  0,
  1,
  2,
  100001,
  NULL,
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM credit_limit_rules WHERE rule_code = 'new_sal_above_1l' LIMIT 1);
