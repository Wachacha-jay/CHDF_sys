-- Migration 023: Add Sacco Welfare Deduction and Individual Payroll Payment Accounts
-- Date: 2026-09-09

-- 1. Ensure Sacco / Welfare Payable GL account exists
INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) 
VALUES (UUID(), '2126', 'Sacco / Welfare Payable', 'liability', 1);

-- 2. Add Sacco Welfare and enabled toggles to payroll_settings
ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS sacco_welfare_rate DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sacco_welfare_amount DECIMAL(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_enabled TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nhif_enabled TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nssf_enabled TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS housing_levy_enabled TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sacco_welfare_enabled TINYINT(1) DEFAULT 0;

-- 3. Add Sacco Welfare deduction, payment account, and payment reference to payroll_runs
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS sacco_welfare_deduction DECIMAL(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payment_account_id CHAR(36) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_journal_entry_id CHAR(36) DEFAULT NULL;

-- 4. Add total_sacco_welfare to payroll_periods
ALTER TABLE payroll_periods
  ADD COLUMN IF NOT EXISTS total_sacco_welfare DECIMAL(14,2) DEFAULT 0.00;

-- 5. Add department_id to employees table if not present
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS department_id CHAR(36) DEFAULT NULL;
