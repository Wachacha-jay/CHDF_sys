-- Migration 013: Inter-departmental Accounting
-- Adds accounts for tracking internal loans and transfers between departments

USE business_management;

-- Only run if not already executed
INSERT IGNORE INTO _migrations (name) VALUES ('013_inter_departmental_accounting.sql');

-- ============================================================
-- INTER-DEPARTMENTAL CLEARING / LOAN ACCOUNTS
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  -- Asset: Due from other Departments
  ('1300', 'Inter-departmental Receivables', 'asset', 1),
  ('1310', 'Due from Education Department', 'asset', 0),
  ('1320', 'Due from Health Department', 'asset', 0),
  ('1330', 'Due from Social Welfare', 'asset', 0),
  
  -- Liability: Due to other Departments
  ('2300', 'Inter-departmental Payables', 'liability', 1),
  ('2310', 'Due to Education Department', 'liability', 0),
  ('2320', 'Due to Health Department', 'liability', 0),
  ('2330', 'Due to Social Welfare', 'liability', 0);

-- ============================================================
-- INTERNAL TRANSFER REVENUE/EXPENSE (Optional, for non-loan transfers)
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('4900', 'Internal Transfer In (Revenue)', 'revenue', 1),
  ('5900', 'Internal Transfer Out (Expense)', 'expense', 1);

SELECT 'Migration 013 complete: Inter-departmental Loan & Transfer accounts added.' AS status;
