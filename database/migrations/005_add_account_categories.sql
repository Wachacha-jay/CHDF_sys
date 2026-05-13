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

-- Note: Seeding and data migration will be handled via a script to ensure correct ID mapping.
