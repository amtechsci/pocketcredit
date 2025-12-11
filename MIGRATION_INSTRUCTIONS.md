# Post-Disbursal Migration Instructions

## Quick Migration (Recommended)

### Option 1: Run SQL Directly (Easiest)

1. Open your MySQL client (phpMyAdmin, MySQL Workbench, or command line)
2. Select the `pocket_credit` database
3. Copy and paste the entire contents of `src/server/migrations/add_post_disbursal_columns.sql`
4. Execute the SQL

**Note:** If you get an error saying a column already exists, that's fine - just continue with the next ALTER TABLE statement.

### Option 2: Run Node.js Migration Script

```bash
cd src/server
node migrations/add_post_disbursal_status_and_progress.js
```

## What This Migration Does

1. **Adds new status value**: `ready_for_disbursement` to the `status` ENUM
2. **Adds 9 new columns** to `loan_applications` table:
   - `enach_done` - TINYINT(1) - E-NACH registration completed
   - `selfie_captured` - TINYINT(1) - Selfie image captured
   - `selfie_verified` - TINYINT(1) - Face match verification passed
   - `selfie_image_url` - VARCHAR(500) - S3 URL of captured selfie
   - `references_completed` - TINYINT(1) - 3 references and alternate number provided
   - `kfs_viewed` - TINYINT(1) - KFS document viewed
   - `agreement_signed` - TINYINT(1) - Loan agreement e-signed
   - `post_disbursal_step` - INT - Current step in post-disbursal flow (1-7)
   - `post_disbursal_progress` - JSON - Detailed progress tracking

## Verification

After running the migration, verify it worked by running:

```sql
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'pocket_credit' 
  AND TABLE_NAME = 'loan_applications' 
  AND COLUMN_NAME IN (
    'enach_done', 
    'selfie_captured', 
    'selfie_verified', 
    'selfie_image_url',
    'references_completed', 
    'kfs_viewed', 
    'agreement_signed', 
    'post_disbursal_step',
    'post_disbursal_progress'
  );
```

You should see 9 rows returned.

## Troubleshooting

### Error: "Column already exists"
- This means the column was already added. Skip that ALTER TABLE statement and continue.

### Error: "Unknown column 'status' in 'field list'"
- Make sure you're running this on the correct database (`pocket_credit`)

### Error: "Access denied"
- Make sure your MySQL user has ALTER TABLE permissions




