-- Migration 028: Inter-departmental Grants (Equity / Net Assets) & Transfer Types
-- Adds accounts for non-repayable grants between departments / funds
-- and updates transfer_type ENUM to include 'grant_transfer'.

-- 1. Ensure Equity accounts for Inter-departmental Grants exist
INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
  (UUID(), '3810', 'Inter-departmental Grants Out (Equity)', 'equity', 1),
  (UUID(), '3820', 'Inter-departmental Grants In (Equity)', 'equity', 1);

-- 2. Expand transfer_type ENUM on internal_transfers to support grant_transfer and default to internal_loan
ALTER TABLE internal_transfers 
  MODIFY COLUMN transfer_type ENUM('direct_transfer', 'internal_loan', 'loan_repayment', 'grant_transfer') DEFAULT 'internal_loan';
