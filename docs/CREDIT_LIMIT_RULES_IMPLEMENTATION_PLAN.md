# Credit Limit Rules – Dynamic DB-Driven Implementation Plan

This document plans how to make credit limit logic configurable via the database, with multiple “rules” that admins can create and assign to users.

---

## 1. Current State (Hardcoded)

- **Location:** `src/server/utils/creditLimitCalculator.js`
- **Values:**
  - Percentage tiers: `[8, 11, 15.2, 20.9, 28, 32.1]` (by disbursed loan count 0–5+)
  - First-time loan: 8% of salary, cap ₹45,600
  - Max regular limit: ₹45,600
  - Premium limit: ₹1,50,000 (24 months), when % ≥ 32.1 or calculated > 45,600
- **Used in:** `calculateCreditLimitFor2EMI`, `adjustFirstTimeLoanAmount`, `checkAndMarkCoolingPeriod`
- **Callers:** payout.js, creditLimit.js, userProfile.js, employment.js, payment.js, loanApplicationController.js

---

## 2. Database Schema

### 2.1 Table: `credit_limit_rules`

Stores each “logic” (rule) that defines how limit is calculated.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK AUTO_INCREMENT | |
| `rule_name` | VARCHAR(100) NOT NULL | e.g. "Default 2 EMI", "Conservative", "Partner X" |
| `rule_code` | VARCHAR(50) UNIQUE | Optional slug for code reference (e.g. `default_2emi`) |
| `description` | TEXT | Admin notes |
| `percentage_tiers` | JSON NOT NULL | Array of percentages by loan-count index. Example: `[8, 11, 15.2, 20.9, 28, 32.1]`. Index 0 = 0 disbursed, 1 = 1 disbursed, etc. |
| `first_time_percentage` | DECIMAL(5,2) NOT NULL DEFAULT 8 | % of salary for first-time pending loan (and initial limit). |
| `max_regular_cap` | DECIMAL(10,2) NOT NULL DEFAULT 45600 | Cap before premium (₹). |
| `premium_limit` | DECIMAL(10,2) DEFAULT 150000 | Limit when “premium” tier is reached (₹). |
| `premium_tenure_months` | INT DEFAULT 24 | Tenure for premium limit (e.g. 24 EMIs). |
| `triggers_cooling_period` | TINYINT(1) DEFAULT 1 | If 1, reaching premium/max cap marks user in cooling period. |
| `is_default` | TINYINT(1) DEFAULT 0 | Only one rule should be default; used when user has no assigned rule. |
| `is_active` | TINYINT(1) DEFAULT 1 | Inactive rules are not assignable and not used. |
| `sort_order` | INT DEFAULT 0 | For admin dropdown ordering. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Constraints:**

- At least one row must have `is_default = 1` (enforce in app or trigger).
- `percentage_tiers` must be non-empty JSON array of numbers.

**Example row (current behaviour):**

```json
{
  "rule_name": "Default 2 EMI",
  "rule_code": "default_2emi",
  "percentage_tiers": [8, 11, 15.2, 20.9, 28, 32.1],
  "first_time_percentage": 8,
  "max_regular_cap": 45600,
  "premium_limit": 150000,
  "premium_tenure_months": 24,
  "triggers_cooling_period": 1,
  "is_default": 1
}
```

### 2.2 Table: `users` – new column

| Column | Type | Description |
|--------|------|-------------|
| `credit_limit_rule_id` | INT NULL FK → `credit_limit_rules.id` | Assigned rule. NULL = use default rule. |

- Migration: `ALTER TABLE users ADD COLUMN credit_limit_rule_id INT NULL REFERENCES credit_limit_rules(id) ON DELETE SET NULL;`
- Index: `INDEX idx_users_credit_limit_rule_id (credit_limit_rule_id)` for joins.

### 2.3 Optional: `pending_credit_limits` / `credit_limit_history`

- Add `credit_limit_rule_id` (INT NULL) to both tables to record which rule was used when the limit was calculated (audit trail). Not strictly required for behaviour; can be Phase 2.

---

## 3. Seed Data (Migration / Seed Script)

- Insert one row into `credit_limit_rules` with the current hardcoded values and `is_default = 1`.
- Ensures existing users (with `credit_limit_rule_id = NULL`) behave exactly as today.

---

## 4. Calculator Changes (`creditLimitCalculator.js`)

### 4.1 New helper: get effective rule for a user

```js
/**
 * Get credit limit rule for user. If user has credit_limit_rule_id set and rule is active, use it; else use default rule.
 * @param {number} userId
 * @returns {Promise<object|null>} Rule row or null (caller falls back to hardcoded defaults)
 */
async function getCreditLimitRuleForUser(userId) { ... }
```

- Query: get `users.credit_limit_rule_id` for `userId`.
- If not null: `SELECT * FROM credit_limit_rules WHERE id = ? AND is_active = 1`.
- If null or not found: `SELECT * FROM credit_limit_rules WHERE is_default = 1 AND is_active = 1 LIMIT 1`.
- Return rule row; parse `percentage_tiers` JSON. If no rule found, return `null` and use existing in-code defaults (backward compatibility).

### 4.2 `calculateCreditLimitFor2EMI(userId, monthlySalary, currentLimit)`

- At start: `const rule = await getCreditLimitRuleForUser(userId);`.
- If `rule`:
  - Use `rule.percentage_tiers` instead of `[8, 11, 15.2, 20.9, 28, 32.1]`.
  - Use `rule.max_regular_cap` instead of `45600`.
  - Use `rule.premium_limit` and `rule.premium_tenure_months` for premium; derive “max percentage” from last tier (e.g. `rule.percentage_tiers[rule.percentage_tiers.length - 1]`) for `isMaxPercentageReached` / `wouldCrossMaxLimit` (compare with `max_regular_cap`).
- If no rule: keep current hardcoded logic (fallback).

### 4.3 `adjustFirstTimeLoanAmount(userId, monthlySalary)`

- At start: `const rule = await getCreditLimitRuleForUser(userId);`.
- First-time percentage: `rule ? rule.first_time_percentage : 8`.
- Cap: `rule ? rule.max_regular_cap : 45600`.
- Rest of logic unchanged (still 8% or rule’s first_time_percentage, cap, update loan and user limit).

### 4.4 `checkAndMarkCoolingPeriod(userId, loanId, creditLimitData)`

- Only mark cooling period if the rule has `triggers_cooling_period = 1`.
- Thresholds: use `creditLimitData` (already computed with rule’s caps in step 4.2). Optionally pass `rule` into this function and check `rule.premium_limit` / `rule.max_regular_cap` instead of hardcoded 150000/45600 so cooling logic stays aligned with rule.

### 4.5 Edge cases

- **Empty or invalid `percentage_tiers`:** Fall back to current hardcoded array in code when parsing fails or length is 0.
- **Rule deleted:** `users.credit_limit_rule_id` → SET NULL; next calculation uses default rule.
- **Default rule missing:** Keep in-code defaults when `getCreditLimitRuleForUser` returns null.

---

## 5. Admin API

### 5.1 New route file: `src/server/routes/adminCreditLimitRules.js`

Mount under `/api/admin/credit-limit-rules` (or `/api/admin/loan-tiers` sibling).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all rules (active + inactive), ordered by sort_order, name. |
| GET | `/:id` | Get one rule by id. |
| POST | `/` | Create rule (validate percentage_tiers, caps, ensure only one is_default if set). |
| PUT | `/:id` | Update rule (same validation). |
| PATCH | `/:id/toggle` | Toggle is_active. Prevent deactivating if is_default. |
| PATCH | `/:id/set-default` | Set this rule as default; set all others is_default = 0. |
| DELETE | `/:id` | Soft-delete or block if rule is assigned to any user; or set users’ credit_limit_rule_id to NULL and then delete. |

Validation for POST/PUT:

- `percentage_tiers`: required, array of numbers, length ≥ 1.
- `first_time_percentage` > 0, ≤ 100.
- `max_regular_cap` > 0.
- `premium_limit` >= `max_regular_cap` (optional business rule).
- If `is_default = 1`, unset default on other rows.

### 5.2 Assign rule to user

**Option A – Extend existing user profile update**

- In `userProfile.js` (or wherever user fields are updated by admin), add optional body field `credit_limit_rule_id` (null or number).
- `PUT /api/admin/user-profile/:userId` (or dedicated user update endpoint): if `credit_limit_rule_id` present, validate that it exists and is active, then `UPDATE users SET credit_limit_rule_id = ? WHERE id = ?`.

**Option B – Dedicated endpoint (recommended)**

- `PUT /api/admin/user-profile/:userId/credit-limit-rule`
- Body: `{ "credit_limit_rule_id": number | null }`.
- Validates rule exists and is_active (or null to “unassign” and use default).
- Updates `users.credit_limit_rule_id`.
- Response includes updated user snippet and assigned rule name/code.

Use same auth as other admin user-profile updates (`authenticateAdmin`).

### 5.3 Expose rule in user profile GET

- When admin (or app) fetches user profile, include `credit_limit_rule_id` and optionally `credit_limit_rule` (id, rule_name, rule_code) so admin UI can show current assignment and dropdown of available rules.

---

## 6. Server Registration

- In `server.js`:  
  `const adminCreditLimitRulesRoutes = require('./routes/adminCreditLimitRules');`  
  `app.use('/api/admin/credit-limit-rules', adminCreditLimitRulesRoutes);`

---

## 7. Files to Touch (Checklist)

| Area | File | Change |
|------|------|--------|
| DB | New migration or SQL file | Create `credit_limit_rules`, add `users.credit_limit_rule_id`, seed default rule. |
| Calculator | `src/server/utils/creditLimitCalculator.js` | Add `getCreditLimitRuleForUser`; use rule in `calculateCreditLimitFor2EMI`, `adjustFirstTimeLoanAmount`, `checkAndMarkCoolingPeriod`; keep in-code fallback when no rule. |
| Admin API | New `src/server/routes/adminCreditLimitRules.js` | CRUD + set-default + toggle. |
| Admin API | `src/server/server.js` | Register admin credit-limit-rules route. |
| User assignment | `src/server/routes/userProfile.js` (or new route) | PUT `:userId/credit-limit-rule` and/or include rule in GET profile. |
| Optional | `pending_credit_limits` / `credit_limit_history` | Add `credit_limit_rule_id` for audit (Phase 2). |

---

## 8. Backward Compatibility

- **No rows in `credit_limit_rules`:** Calculator returns null from `getCreditLimitRuleForUser`; existing hardcoded percentages and caps remain.
- **Users with `credit_limit_rule_id = NULL`:** Use default rule if exists; otherwise same hardcoded behaviour.
- **Existing flows:** Payout, credit-limit pending/next, salary update, cooling period – all go through same calculator; only the source of numbers (DB vs constants) changes.

---

## 9. Admin UI (Out of Scope Here)

- Settings (or “Credit limit rules”) page: list rules, add/edit, set default, toggle active.
- User detail / edit: dropdown “Credit limit rule” = list of active rules + “Default”; save calls `PUT .../credit-limit-rule`.

---

## 10. Summary

- **One new table:** `credit_limit_rules` (with JSON `percentage_tiers` and caps).
- **One new column:** `users.credit_limit_rule_id` (nullable FK).
- **Calculator:** Resolves rule per user (assigned or default), uses rule’s percentages and caps everywhere; fallback to current hardcoded values if no rule.
- **Admin:** CRUD for rules + endpoint to assign rule to user; optional profile GET enhancement to show assigned rule.

This keeps a single place (DB) to define multiple logics and assign them per user, while preserving current behaviour when no rule or default rule is configured.

---

## Appendix: SQL for schema and seed

```sql
-- Create credit_limit_rules table
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

-- Add user assignment column
ALTER TABLE users ADD COLUMN credit_limit_rule_id INT NULL AFTER loan_limit;
ALTER TABLE users ADD INDEX idx_users_credit_limit_rule_id (credit_limit_rule_id);
ALTER TABLE users ADD CONSTRAINT fk_users_credit_limit_rule
  FOREIGN KEY (credit_limit_rule_id) REFERENCES credit_limit_rules(id) ON DELETE SET NULL;

-- Seed default rule (current hardcoded behaviour)
INSERT INTO credit_limit_rules (
  rule_name, rule_code, description,
  percentage_tiers, first_time_percentage, max_regular_cap, premium_limit, premium_tenure_months,
  triggers_cooling_period, is_default, is_active, sort_order
) VALUES (
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
);
```
