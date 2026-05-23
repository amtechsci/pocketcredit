-- Wrong loan clearance audit (production) — v3
--
-- Repayment total: loan_payments + admin transactions (ref-deduped, mirror-deduped)
-- Pre-close: intentionally settles below full total_repayable — NOT flagged as underpaid
--
-- Pre-close detection:
--   1) payment_orders.payment_type = 'pre-close'
--   2) Admin settlement via transactions.transaction_type = 'credit' (UI "Credit")
--      with no separate emi_payment / part_payment rows on the loan

SELECT
  base.*,
  ROUND(base.closed_amount - base.total_collected, 2) AS shortfall_vs_full_closed_amount,
  CASE
    WHEN base.is_preclose = 1
      THEN 'PRECLOSE_OK'
    WHEN base.total_collected < base.closed_amount - 0.01
      THEN 'WRONG_CLEAR_UNDERPAID'
    WHEN base.total_collected > base.closed_amount + 0.01
      THEN 'OVER_COLLECTED_REVIEW'
    ELSE 'AMOUNT_MATCHES'
  END AS audit_flag
FROM (
  SELECT
    la.id,
    CONCAT('PLL', la.id) AS display_loan_id,
    la.application_number,
    la.user_id,
    la.closed_date,
    la.closed_amount,
    la.total_repayable,
    COALESCE(lp.payment_count, 0) AS loan_payment_count,
    COALESCE(lp.loan_payments_total, 0) AS loan_payments_total,
    COALESCE(tx.admin_only_total, 0) AS admin_transactions_total,
    CASE
      WHEN pc.loan_id IS NOT NULL OR pc_admin.loan_application_id IS NOT NULL THEN 1
      ELSE 0
    END AS is_preclose,
    ROUND(
      CASE
        WHEN ABS(COALESCE(lp.loan_payments_total, 0) - COALESCE(tx.admin_only_total, 0)) <= 0.01
          AND COALESCE(lp.loan_payments_total, 0) > 0
          THEN COALESCE(lp.loan_payments_total, 0)
        WHEN COALESCE(tx.admin_only_total, 0) >= la.closed_amount - 0.01
          AND COALESCE(lp.loan_payments_total, 0) < la.closed_amount - 0.01
          THEN COALESCE(tx.admin_only_total, 0)
        WHEN COALESCE(lp.loan_payments_total, 0) >= la.closed_amount - 0.01
          THEN COALESCE(lp.loan_payments_total, 0)
        WHEN COALESCE(lp.loan_payments_total, 0) = 0
          THEN COALESCE(tx.admin_only_total, 0)
        WHEN COALESCE(tx.admin_only_total, 0) = 0
          THEN COALESCE(lp.loan_payments_total, 0)
        ELSE COALESCE(lp.loan_payments_total, 0) + COALESCE(tx.admin_only_total, 0)
      END,
      2
    ) AS total_collected
  FROM loan_applications la
  LEFT JOIN (
    SELECT
      loan_id,
      COUNT(*) AS payment_count,
      COALESCE(SUM(amount), 0) AS loan_payments_total
    FROM loan_payments
    WHERE status = 'SUCCESS'
    GROUP BY loan_id
  ) lp ON lp.loan_id = la.id
  LEFT JOIN (
    SELECT
      t.loan_application_id,
      COALESCE(SUM(t.amount), 0) AS admin_only_total
    FROM transactions t
    WHERE t.transaction_type IN (
      'emi_payment',
      'part_payment',
      'full_payment',
      'settlement',
      'credit'
    )
      AND NOT EXISTS (
        SELECT 1
        FROM loan_payments lp2
        WHERE lp2.loan_id = t.loan_application_id
          AND lp2.status = 'SUCCESS'
          AND lp2.transaction_id IS NOT NULL
          AND lp2.transaction_id != ''
          AND lp2.transaction_id = t.reference_number
      )
    GROUP BY t.loan_application_id
  ) tx ON tx.loan_application_id = la.id
  LEFT JOIN (
    SELECT DISTINCT loan_id
    FROM payment_orders
    WHERE payment_type = 'pre-close'
      AND status IN ('SUCCESS', 'PAID', 'paid', 'success')
  ) pc ON pc.loan_id = la.id
  LEFT JOIN (
    SELECT DISTINCT t.loan_application_id
    FROM transactions t
    WHERE t.transaction_type = 'credit'
      AND (t.status = 'completed' OR t.status IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM transactions t2
        WHERE t2.loan_application_id = t.loan_application_id
          AND t2.transaction_type IN ('emi_payment', 'part_payment')
      )
  ) pc_admin ON pc_admin.loan_application_id = la.id
  WHERE la.status = 'cleared'
    AND la.closed_date >= '2026-03-01'
) base
ORDER BY
  CASE WHEN base.is_preclose = 1 THEN 1 ELSE 0 END,
  (base.closed_amount - base.total_collected) DESC,
  base.closed_date DESC;


-- P1 wrong clears only (excludes pre-close):
-- SELECT * FROM ( ... paste query above ... ) x
-- WHERE x.audit_flag = 'WRONG_CLEAR_UNDERPAID';

-- Pre-close only:
-- SELECT * FROM ( ... ) x WHERE x.audit_flag = 'PRECLOSE_OK';

-- Per-loan drill-down (replace :loan_id):
/*
SELECT 'loan_payments' AS source, lp.id, lp.amount, lp.payment_method, lp.transaction_id AS ref, lp.created_at
FROM loan_payments lp
WHERE lp.loan_id = :loan_id AND lp.status = 'SUCCESS'
UNION ALL
SELECT 'transactions', t.id, t.amount, t.transaction_type, t.reference_number, t.created_at
FROM transactions t
WHERE t.loan_application_id = :loan_id
  AND t.transaction_type IN ('emi_payment','part_payment','full_payment','settlement','credit')
ORDER BY created_at;

SELECT payment_type, amount, status, created_at
FROM payment_orders WHERE loan_id = :loan_id;
*/
