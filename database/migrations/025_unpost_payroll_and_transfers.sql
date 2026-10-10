-- Migration 025: Unpost mistaken Payroll Runs and Internal Transfers
-- Reverts status to 'draft', clears GL linkages, deletes journal vouchers and lines

-- 1. Detach payroll journal entry references before deleting them
UPDATE payroll_runs 
SET journal_entry_id = NULL, payment_journal_entry_id = NULL 
WHERE status = 'paid';

-- 2. Delete Journal Entry Lines for Internal Transfers (ITR-*)
DELETE jel FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE je.reference LIKE 'ITR-%';

-- 3. Delete Journal Entries for Internal Transfers (ITR-*)
DELETE FROM journal_entries WHERE reference LIKE 'ITR-%';

-- 4. Delete Journal Entry Lines for Payroll (PAY-ACC-*, PAY-DISB-*)
DELETE jel FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE je.entry_number LIKE 'PAY-ACC-%' 
   OR je.entry_number LIKE 'PAY-DISB-%'
   OR je.description LIKE 'Payroll Accrual%'
   OR je.description LIKE 'Salary payment to%';

-- 5. Delete Journal Entries for Payroll
DELETE FROM journal_entries 
WHERE entry_number LIKE 'PAY-ACC-%' 
   OR entry_number LIKE 'PAY-DISB-%'
   OR description LIKE 'Payroll Accrual%'
   OR description LIKE 'Salary payment to%';

-- 6. Revert Internal Transfers back to 'draft'
UPDATE internal_transfers 
SET status = 'draft', approved_by = NULL 
WHERE status = 'approved';

-- 7. Revert Payroll Runs back to 'draft'
UPDATE payroll_runs 
SET status = 'draft', 
    paid_date = NULL, 
    payment_account_id = NULL, 
    payment_reference = NULL, 
    journal_entry_id = NULL, 
    payment_journal_entry_id = NULL 
WHERE status = 'paid';

-- 8. Re-open closed payroll periods to 'processing'
UPDATE payroll_periods 
SET status = 'processing' 
WHERE status = 'closed';
