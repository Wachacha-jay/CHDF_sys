-- Migration 011: Ensure payroll GL accounts and fix journal entry number sequence
-- Run this once to ensure the accounts needed for payroll journal entries exist

INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
  (UUID(), '5210', 'Payroll / Salary Expense',  'expense',    1),
  (UUID(), '2121', 'PAYE Payable',               'liability',  1),
  (UUID(), '2122', 'NSSF Payable',               'liability',  1),
  (UUID(), '2123', 'NHIF/SHIF Payable',          'liability',  1),
  (UUID(), '2124', 'Housing Levy Payable',        'liability',  1),
  (UUID(), '2125', 'Net Salary Payable',          'liability',  1),
  (UUID(), '1111', 'Bank / Mpesa',                'asset',      1),
  (UUID(), '2150', 'Sales Tax Payable',           'liability',  1);

-- Add journal_entry_id to payroll_runs if it was not created in migration 010
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS journal_entry_id CHAR(36) DEFAULT NULL;

-- Ensure payroll_periods has all required columns
ALTER TABLE payroll_periods
  ADD COLUMN IF NOT EXISTS total_gross_pay   DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_net_pay     DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tax         DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_nhif        DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_nssf        DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_housing_levy DECIMAL(14,2) DEFAULT 0;

-- Ensure employees table has all payroll columns
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS basic_salary    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name       VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account    VARCHAR(50)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nhif_number     VARCHAR(50)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nssf_number     VARCHAR(50)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_pin         VARCHAR(50)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method  ENUM('bank','cash','mpesa') DEFAULT 'bank';

-- Alias columns for backward compatibility (some code uses nhif_no / nssf_no)
-- These are generated columns so no data is duplicated
-- (skip if your MySQL version < 5.7.6)
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS nhif_no VARCHAR(50) AS (nhif_number) VIRTUAL;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS nssf_no VARCHAR(50) AS (nssf_number) VIRTUAL;
