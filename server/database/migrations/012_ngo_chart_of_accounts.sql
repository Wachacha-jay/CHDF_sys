-- Migration 012: NGO Chart of Accounts Extension
-- Adds accounts specifically for Fund Accounting & Child Support module
-- Run after 011_payroll_accounts_fix.sql

USE business_management;

-- Create _migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS _migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Only run if not already executed
INSERT IGNORE INTO _migrations (name) VALUES ('012_ngo_chart_of_accounts.sql');

-- ============================================================
-- NGO REVENUE ACCOUNTS (under 4000 Revenue)
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('4200', 'Donation Revenue', 'revenue', 1),
  ('4210', 'Unrestricted Donations', 'revenue', 1),
  ('4220', 'Temporarily Restricted Donations', 'revenue', 1),
  ('4230', 'Permanently Restricted Donations', 'revenue', 1),
  ('4240', 'Child Sponsorship Revenue', 'revenue', 1),
  ('4250', 'Grant Revenue', 'revenue', 1),
  ('4260', 'In-Kind Donations', 'revenue', 1);

-- ============================================================
-- NGO EXPENSE ACCOUNTS (under 5000 Expenses)
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('5300', 'Program Expenses', 'expense', 1),
  ('5310', 'Education Program Expenses', 'expense', 1),
  ('5320', 'Health & Medical Program Expenses', 'expense', 1),
  ('5330', 'Feeding Program Expenses', 'expense', 1),
  ('5340', 'Social Welfare Expenses', 'expense', 1),
  ('5350', 'Child Sponsorship Disbursements', 'expense', 1),
  ('5360', 'Fundraising Expenses', 'expense', 1),
  ('5370', 'Administrative Overhead (NGO)', 'expense', 1);

-- ============================================================
-- NGO ASSET ACCOUNTS — Restricted Fund Holding
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('1150', 'Restricted Fund Cash', 'asset', 1),
  ('1160', 'Temporarily Restricted Assets', 'asset', 1),
  ('1170', 'Permanently Restricted Assets', 'asset', 1);

-- ============================================================
-- NGO EQUITY/FUND BALANCE ACCOUNTS
-- ============================================================
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('3200', 'Unrestricted Net Assets', 'equity', 1),
  ('3210', 'Temporarily Restricted Net Assets', 'equity', 1),
  ('3220', 'Permanently Restricted Net Assets', 'equity', 1);

-- ============================================================
-- Seed some default Fund Accounts (logical fund buckets)
-- ============================================================
INSERT IGNORE INTO fund_accounts (id, name, code, description, restriction_type, is_active) VALUES
  (UUID(), 'General Fund', 'FUND-GEN', 'Unrestricted general operations fund', 'unrestricted', 1),
  (UUID(), 'Education Fund', 'FUND-EDU', 'Restricted to education programs and scholarships', 'temporarily_restricted', 1),
  (UUID(), 'Health Fund', 'FUND-MED', 'Restricted to medical and health program expenses', 'temporarily_restricted', 1),
  (UUID(), 'Emergency Relief Fund', 'FUND-EMG', 'Permanently restricted emergency assistance fund', 'permanently_restricted', 1);

-- ============================================================
-- Seed default Departments
-- ============================================================
INSERT IGNORE INTO departments (id, name, description, is_active) VALUES
  (UUID(), 'Education Department', 'Manages school programs, scholarships, and educational support', 1),
  (UUID(), 'Health & Medical', 'Oversees medical programs, health clinics, and wellness initiatives', 1),
  (UUID(), 'Social Welfare', 'Manages feeding programs, clothing drives, and community outreach', 1),
  (UUID(), 'Administration', 'Corporate governance, finance, HR, and administrative operations', 1);

SELECT 'Migration 012 complete: NGO Chart of Accounts, Fund Accounts, and Departments seeded.' AS status;
