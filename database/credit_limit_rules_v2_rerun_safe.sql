-- Use this if credit_limit_rules_v2_migration.sql fails with "Duplicate column"
-- (columns already exist from a previous run). Run only the data updates.

-- 3. Mark existing default rule as NOT auto-assign
UPDATE credit_limit_rules
SET auto_assign = 0, calculation_mode = 'percentage'
WHERE rule_code = 'default_2emi';

-- 4. Update tiers for Salary <= 1L (add 6th tier: 50%)
UPDATE credit_limit_rules
SET percentage_tiers = '[15, 18, 21, 25, 30, 50]',
    description = 'For new users with salary <= 1 lakh. Percentage-based: 15%, 18%, 21%, 25%, 30%, 50%. Block after 5th loan.',
    updated_at = NOW()
WHERE rule_code = 'new_sal_upto_1l';

-- 5. Update tiers for Salary > 1L (add 6th tier: 50000)
UPDATE credit_limit_rules
SET fixed_amount_tiers = '[15000, 18000, 22000, 27000, 33000, 50000]',
    description = 'For new users with salary > 1 lakh. Fixed amounts: 15000, 18000, 22000, 27000, 33000, 50000. Block after 5th loan.',
    updated_at = NOW()
WHERE rule_code = 'new_sal_above_1l';
