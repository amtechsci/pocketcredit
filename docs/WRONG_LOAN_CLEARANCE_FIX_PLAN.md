# Loan clearance — audit conclusion & code fix

**Last updated:** 2026-05-23  
**Monitoring SQL:** [`sql/wrong-loan-clearance-audit.sql`](./sql/wrong-loan-clearance-audit.sql)

---

## Conclusion (no customer reverts)

Production audit (807 cleared loans, Mar–May 2026) after v3 SQL:

| Flag | Count | Action |
|------|------:|--------|
| `PRECLOSE_OK` | 290 | **Correct** — intentional lower settlement |
| `AMOUNT_MATCHES` | 404 | **Correct** |
| `OVER_COLLECTED_REVIEW` | 100 | Ledger duplicate / review only |
| `WRONG_CLEAR_UNDERPAID` | 13 | **Test accounts only** — not production wrong data |

**No manual loan reverts required.** Remaining “underpaid” rows are test accounts (PLL258x / PLL416x batch). The real issue was **transaction saving + eNACH auto-clearance logic**, which is fixed in code.

---

## Admin vs eNACH — different rules (by design)

### Admin — write-off, discount, pre-close (allowed)

Ops may accept **less than full EMI** when the customer agrees. Example: EMI due **₹3,455**, customer pays **₹3,000**, admin records it — that is a **write-off / discount** on EMI1, not a system bug.

Also includes:

- **Pre-close** (Cashfree `pre-close` or admin **Credit** transaction)
- **Settlement** / manual EMI with negotiated amount
- Closing below full `total_repayable` when admin decides

These paths are **human decisions**. The audit SQL flags them as `PRECLOSE_OK` or `AMOUNT_MATCHES` — not wrong clears.

### eNACH — automated (strict)

eNACH must **not** behave like admin write-off:

| Rule | Behaviour |
|------|-----------|
| Partial debit | EMI stays **partial** (`paid_amount` only) — not fully `paid` |
| Loan clear | Only when **all EMIs fully paid** AND **total collected ≥ amount due** |
| Ledger | Each successful debit also writes a row in **`transactions`** |

Example: eNACH debits ₹3,000 on ₹3,455 EMI → EMI **pending**, loan **not cleared**. That was the PLL2657-class bug; fixed in code.

---

## What was fixed in code

| File | Change |
|------|--------|
| `src/server/utils/loanClearance.js` | Shared clearance rules: `applyPaymentToEmi()`, `evaluateLoanClearanceEligibility()`, `getTotalRepaymentsReceived()`, `recordEnachLedgerTransaction()` |
| `src/server/services/enachChargeService.js` | Partial EMI tracking; conditional clear; eNACH → `transactions` ledger |
| `src/server/routes/payment.js` | Removed unsafe `calculateOutstandingBalance()` clearance fallback |
| `src/server/routes/userProfile.js` | Admin EMI uses shared clearance rules |

---

## Deploy checklist

- [ ] Deploy the files above to production
- [ ] Restart Node server / PM2
- [ ] Confirm one eNACH success creates both `loan_payments` and `transactions` rows
- [ ] Confirm partial eNACH does **not** clear the loan

Optional: exclude test `user_id`s from future audit exports.

---

## Audit SQL (monitoring only)

Use [`sql/wrong-loan-clearance-audit.sql`](./sql/wrong-loan-clearance-audit.sql) to monitor new clears. It:

- Dedupes `loan_payments` + admin `transactions` (no double-count)
- Marks **pre-close** as `PRECLOSE_OK` (not underpaid)
- Flags true underpaid only for non–pre-close loans

Do **not** treat `collected < closed_amount` alone as wrong when the loan was pre-close or admin write-off.
