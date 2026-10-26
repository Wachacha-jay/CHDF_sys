-- Migration 033: Reconcile Payroll Liabilities and Purge Stale Deduction Entries
-- Ensures PAYE (2121), NSSF (2122), NHIF (2123), Housing Levy (2124) only reflect active payroll runs

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Delete orphan payroll accrual journal entry lines where journal entry has no active paid run
DELETE jel FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE (je.entry_number LIKE 'PAY-ACC-%' OR je.description LIKE 'Payroll Accrual%' OR je.description LIKE 'Payroll processing for%')
  AND je.id NOT IN (
    SELECT DISTINCT journal_entry_id FROM payroll_runs WHERE journal_entry_id IS NOT NULL AND status = 'paid'
  );

-- 2. Delete orphan payroll accrual journal entries themselves
DELETE FROM journal_entries 
WHERE (entry_number LIKE 'PAY-ACC-%' OR description LIKE 'Payroll Accrual%' OR description LIKE 'Payroll processing for%')
  AND id NOT IN (
    SELECT DISTINCT journal_entry_id FROM payroll_runs WHERE journal_entry_id IS NOT NULL AND status = 'paid'
  );

-- 3. If there are no active paid payroll runs with PAYE tax, purge any lines for PAYE Payable (2121)
DELETE jel FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2121'
  AND (SELECT COALESCE(SUM(tax_deduction), 0) FROM payroll_runs WHERE status = 'paid') = 0;

-- 4. If there are no active paid payroll runs with NSSF, purge any lines for NSSF Payable (2122)
DELETE jel FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2122'
  AND (SELECT COALESCE(SUM(nssf_deduction), 0) FROM payroll_runs WHERE status = 'paid') = 0;

-- 5. If there are no active paid payroll runs with NHIF/SHIF, purge any lines for NHIF Payable (2123)
DELETE jel FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2123'
  AND (SELECT COALESCE(SUM(nhif_deduction), 0) FROM payroll_runs WHERE status = 'paid') = 0;

-- 6. If there are no active paid payroll runs with Housing Levy, purge any lines for Housing Levy Payable (2124)
DELETE jel FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2124'
  AND (SELECT COALESCE(SUM(housing_levy_deduction), 0) FROM payroll_runs WHERE status = 'paid') = 0;

-- 7. Clean up any orphaned journal entries left without lines
DELETE je FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
WHERE jel.id IS NULL;

-- 8. Record migration in _migrations table
CREATE TABLE IF NOT EXISTS _migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO _migrations (name) VALUES ('033_reconcile_payroll_liabilities');

SET FOREIGN_KEY_CHECKS = 1;
