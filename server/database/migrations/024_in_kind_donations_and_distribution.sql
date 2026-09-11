-- Migration 024: In-Kind Donations & Stock Distribution (V2)
-- Adds multi-class in-kind donation routing and inventory ring-fencing

-- 1. Extend products table with is_in_kind flag
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_in_kind TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Extend donations table with is_in_kind and total_fair_market_value
ALTER TABLE donations 
ADD COLUMN IF NOT EXISTS is_in_kind TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_fair_market_value DECIMAL(12,4) DEFAULT 0;

-- 3. Create donation_items table for multi-line in-kind donations
CREATE TABLE IF NOT EXISTS donation_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  donation_id CHAR(36) NOT NULL,
  item_description VARCHAR(255) NOT NULL,
  asset_class ENUM('consumable', 'fixed_asset', 'construction') NOT NULL,
  fair_market_value DECIMAL(12,4) NOT NULL DEFAULT 0,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(50) DEFAULT 'units',
  product_id CHAR(36) NULL,
  department_id CHAR(36) NULL,
  fixed_asset_id CHAR(36) NULL,
  project_name VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
  INDEX idx_donation_id (donation_id),
  INDEX idx_product_id (product_id),
  INDEX idx_dept_id (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed In-Kind and Fixed Asset Accounts in Chart of Accounts if not present
INSERT IGNORE INTO accounts (code, name, account_type, is_system) VALUES
  ('1135', 'In-Kind Inventory', 'asset', 1),
  ('1210', 'Fixed Assets - Equipment & Machinery', 'asset', 1),
  ('1220', 'Fixed Assets - Furniture & Fixtures', 'asset', 1),
  ('1230', 'Fixed Assets - Buildings & Infrastructure', 'asset', 1),
  ('4260', 'In-Kind Donations', 'revenue', 1),
  ('5335', 'Food & Consumables Distribution Expense', 'expense', 1);

-- 5. Record distribution voucher support in sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS expense_account_id CHAR(36) NULL;
