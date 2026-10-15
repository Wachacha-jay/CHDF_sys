-- Migration 029: Scrap Internal Transfer Accounts & Backfill Payroll Department Tags
-- 1. Scraps legacy internal transfer revenue and expense accounts (4900, 5900) and related GL entries
-- 2. Backfills department_id on employees and historical payroll journal entry lines

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Delete journal entry lines referencing legacy internal transfer revenue and expense accounts
DELETE jel FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.code IN ('4900', '5900') 
   OR LOWER(a.name) LIKE '%internal transfer%';

-- 2. Delete journal entry lines for legacy ITR internal transfer entries
DELETE jel FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE je.reference LIKE 'ITR-%' 
   OR je.entry_number LIKE 'ITR-%'
   OR LOWER(je.description) LIKE '%internal transfer%'
   OR LOWER(je.description) LIKE '%interdepartmental loan%'
   OR LOWER(je.description) LIKE '%interdepartmental grant%';

-- 3. Delete the journal entries themselves
DELETE FROM journal_entries 
WHERE reference LIKE 'ITR-%' 
   OR entry_number LIKE 'ITR-%'
   OR LOWER(description) LIKE '%internal transfer%'
   OR LOWER(description) LIKE '%interdepartmental loan%'
   OR LOWER(description) LIKE '%interdepartmental grant%';

-- 4. Clean up any orphaned journal entries left without lines
DELETE je FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
WHERE jel.id IS NULL;

-- 5. Clear legacy internal_transfers records for fresh start
DELETE FROM internal_transfers;

-- 6. Remove legacy internal transfer accounts from Chart of Accounts
DELETE FROM accounts 
WHERE code IN ('4900', '5900') 
   OR LOWER(name) LIKE '%internal transfer%';

-- 7. Backfill department_id on employees where name matches an active department
UPDATE employees e
JOIN departments d ON LOWER(e.department) = LOWER(d.name)
SET e.department_id = d.id
WHERE e.department_id IS NULL AND e.department IS NOT NULL;

-- 8. Backfill journal_entry_lines.department_id for historical payroll accruals and disbursements
-- a) Accrual entries linked to payroll_runs
UPDATE journal_entry_lines jel
JOIN payroll_runs pr ON jel.journal_entry_id = pr.journal_entry_id
JOIN employees e ON pr.employee_id = e.id
SET jel.department_id = COALESCE(e.department_id, (SELECT id FROM departments WHERE LOWER(name) = LOWER(e.department) LIMIT 1))
WHERE jel.department_id IS NULL;

-- b) Disbursement entries linked to payroll_runs.payment_journal_entry_id
UPDATE journal_entry_lines jel
JOIN payroll_runs pr ON jel.journal_entry_id = pr.payment_journal_entry_id
JOIN employees e ON pr.employee_id = e.id
SET jel.department_id = COALESCE(e.department_id, (SELECT id FROM departments WHERE LOWER(name) = LOWER(e.department) LIMIT 1))
WHERE jel.department_id IS NULL;

-- c) Disbursement entries linked to payroll_disbursements.journal_entry_id
UPDATE journal_entry_lines jel
JOIN payroll_disbursements pd ON jel.journal_entry_id = pd.journal_entry_id
JOIN payroll_runs pr ON pd.payroll_run_id = pr.id
JOIN employees e ON pr.employee_id = e.id
SET jel.department_id = COALESCE(e.department_id, (SELECT id FROM departments WHERE LOWER(name) = LOWER(e.department) LIMIT 1))
WHERE jel.department_id IS NULL;

-- d) Entries matched by employee code or name in journal entry description
UPDATE journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
JOIN employees e ON (
  (e.code IS NOT NULL AND e.code != '' AND je.description LIKE CONCAT('%', e.code, '%'))
  OR (e.first_name IS NOT NULL AND e.last_name IS NOT NULL AND je.description LIKE CONCAT('%', e.first_name, '%', e.last_name, '%'))
)
SET jel.department_id = COALESCE(e.department_id, (SELECT id FROM departments WHERE LOWER(name) = LOWER(e.department) LIMIT 1))
WHERE jel.department_id IS NULL;

-- e) Remaining payroll expense accounts (5210/5200) fallback to Administration
UPDATE journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
SET jel.department_id = (SELECT id FROM departments ORDER BY (LOWER(name) = 'administration') DESC LIMIT 1)
WHERE jel.department_id IS NULL AND a.code IN ('5210', '5200');

-- 9. Record migration in _migrations table
CREATE TABLE IF NOT EXISTS _migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO _migrations (name) VALUES ('029_scrapping_internal_transfer_accounts_and_backfill_payroll');

SET FOREIGN_KEY_CHECKS = 1;
