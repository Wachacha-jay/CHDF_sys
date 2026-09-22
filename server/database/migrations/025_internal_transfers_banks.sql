-- Migration 025: Add Bank Accounts to Internal Transfers & Ensure Inter-Departmental Accounts
-- Adds from_bank_account_id and to_bank_account_id to internal_transfers table

ALTER TABLE internal_transfers 
  ADD COLUMN IF NOT EXISTS transfer_type ENUM('direct_transfer', 'internal_loan', 'loan_repayment') DEFAULT 'direct_transfer',
  ADD COLUMN IF NOT EXISTS from_bank_account_id CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS to_bank_account_id CHAR(36) NULL;

-- Ensure system clearing accounts exist
INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
  (UUID(), '1300', 'Inter-departmental Receivables', 'asset', 1),
  (UUID(), '2300', 'Inter-departmental Payables', 'liability', 1),
  (UUID(), '4900', 'Internal Transfer In (Revenue)', 'revenue', 1),
  (UUID(), '5900', 'Internal Transfer Out (Expense)', 'expense', 1);
