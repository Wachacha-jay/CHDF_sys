-- Migration 024: School Fee Management (3-term logic, Empower School, Equity Bank, Fee Structures & Payments)

-- 1. Ensure Empower Hearts Special School Department exists
INSERT INTO departments (id, name, description, is_active)
SELECT UUID(), 'Empower Hearts Special School', 'Empower Hearts Special School Educational Operations & Programs', 1
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE LOWER(name) LIKE '%empower%');

-- 2. Ensure Equity Bank Asset Account (code 1112) exists
INSERT INTO accounts (id, code, name, account_type, is_system)
SELECT UUID(), '1112', 'Equity Bank', 'asset', 1
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE LOWER(name) LIKE '%equity%' OR code = '1112');

-- 3. Ensure School Fees Revenue Account (code 4300) exists
INSERT INTO accounts (id, code, name, account_type, is_system)
SELECT UUID(), '4300', 'School Fees Revenue', 'revenue', 1
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '4300' OR LOWER(name) LIKE '%school fee%');

-- 4. Add expected fee columns to children table if not present
SET @col_term = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'children' AND COLUMN_NAME = 'expected_term_fee');
SET @sql_term = IF(@col_term = 0, 'ALTER TABLE children ADD COLUMN expected_term_fee DECIMAL(12,2) DEFAULT 0.00', 'SELECT 1');
PREPARE stmt_term FROM @sql_term;
EXECUTE stmt_term;
DEALLOCATE PREPARE stmt_term;

SET @col_ann = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'children' AND COLUMN_NAME = 'expected_annual_fee');
SET @sql_ann = IF(@col_ann = 0, 'ALTER TABLE children ADD COLUMN expected_annual_fee DECIMAL(12,2) DEFAULT 0.00', 'SELECT 1');
PREPARE stmt_ann FROM @sql_ann;
EXECUTE stmt_ann;
DEALLOCATE PREPARE stmt_ann;

-- 5. Create school_fee_structures table
CREATE TABLE IF NOT EXISTS school_fee_structures (
  id CHAR(36) PRIMARY KEY,
  academic_year INT NOT NULL,
  term VARCHAR(20) NOT NULL,
  class_name VARCHAR(100) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sfs_year_term (academic_year, term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create school_fee_payments table
CREATE TABLE IF NOT EXISTS school_fee_payments (
  id CHAR(36) PRIMARY KEY,
  receipt_number VARCHAR(50) NOT NULL,
  child_id CHAR(36) NOT NULL,
  academic_year INT NOT NULL,
  term VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'mpesa',
  reference_number VARCHAR(100) NULL,
  bank_account_id CHAR(36) NULL,
  department_id CHAR(36) NULL,
  fund_id CHAR(36) NULL,
  journal_entry_id CHAR(36) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sfp_child (child_id),
  INDEX idx_sfp_year_term (academic_year, term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
