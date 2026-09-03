-- Create account_categories table
CREATE TABLE IF NOT EXISTS account_categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add category_id to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category_id CHAR(36);
ALTER TABLE accounts ADD CONSTRAINT fk_category FOREIGN KEY IF NOT EXISTS (category_id) REFERENCES account_categories(id);

-- Seed default categories if none exist
INSERT IGNORE INTO account_categories (id, name, account_type, description) VALUES
  ('cat-asset-1', 'Current Assets', 'asset', 'Cash, Bank, Accounts Receivable, Inventory'),
  ('cat-asset-2', 'Fixed Assets', 'asset', 'Equipment, Vehicles, Furniture, Laptops'),
  ('cat-asset-3', 'Intangible Assets', 'asset', 'Software, Patents, Goodwill'),
  ('cat-liab-1', 'Current Liabilities', 'liability', 'Accounts Payable, Accruals, Short-term debt'),
  ('cat-liab-2', 'Long-term Liabilities', 'liability', 'Long-term Loans, Mortgages'),
  ('cat-liab-3', 'Statutory & Tax Liabilities', 'liability', 'PAYE, NSSF, NHIF/SHIF, Housing Levy'),
  ('cat-equity-1', 'Owner\'s Equity', 'equity', 'Capital and Owner Funds'),
  ('cat-equity-2', 'Retained Earnings', 'equity', 'Accumulated Profits or Losses'),
  ('cat-equity-3', 'Reserves & Net Assets', 'equity', 'Restricted and Unrestricted Net Assets'),
  ('cat-rev-1', 'Sales Revenue', 'revenue', 'Primary sales income'),
  ('cat-rev-2', 'Donations & Grants', 'revenue', 'NGO donations, sponsorships, grants'),
  ('cat-rev-3', 'Other Income', 'revenue', 'Secondary income'),
  ('cat-exp-1', 'Operating Expenses', 'expense', 'Rent, Utilities, Office Supplies'),
  ('cat-exp-2', 'Cost of Goods Sold', 'expense', 'Direct inventory costs'),
  ('cat-exp-3', 'Payroll & Salaries', 'expense', 'Basic salaries, wages, allowances'),
  ('cat-exp-4', 'Program Expenses', 'expense', 'Education, medical, social welfare programs');
