-- Fix: Add 6th tier to V2 credit limit rules
-- Salary <= 1L: add 50% tier (applied after 5th loan disbursement)
-- Salary > 1L: add 50000 tier (applied after 5th loan disbursement)
-- Cooling period will trigger when the 5th loan is CLEARED (block_after_tier=5 stays the same)

UPDATE credit_limit_rules
SET percentage_tiers = '[15, 18, 21, 25, 30, 50]',
    description = 'For new users with salary <= 1 lakh. Percentage-based: 15%, 18%, 21%, 25%, 30%, 50%. Block after 5th loan.',
    updated_at = NOW()
WHERE rule_code = 'new_sal_upto_1l';

UPDATE credit_limit_rules
SET fixed_amount_tiers = '[15000, 18000, 22000, 27000, 33000, 50000]',
    description = 'For new users with salary > 1 lakh. Fixed amounts: 15000, 18000, 22000, 27000, 33000, 50000. Block after 5th loan.',
    updated_at = NOW()
WHERE rule_code = 'new_sal_above_1l';
