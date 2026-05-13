-- Business Management System - MySQL Schema
-- Migration from Supabase PostgreSQL to MySQL
-- Compatible with Hostinger shared hosting

-- Create database (run separately if needed)
-- CREATE DATABASE IF NOT EXISTS business_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE business_management;

-- Users Table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Business Settings Table
CREATE TABLE IF NOT EXISTS business_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  business_name VARCHAR(255) NOT NULL DEFAULT 'My Business',
  business_address TEXT,
  business_phone VARCHAR(50),
  business_email VARCHAR(255),
  business_website VARCHAR(255),
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  default_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  tax_rate DECIMAL(5,4) DEFAULT 0.0000,
  receipt_prefix VARCHAR(20) DEFAULT 'RCP',
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  product_code_prefix VARCHAR(20) DEFAULT 'PRD',
  customer_code_prefix VARCHAR(20) DEFAULT 'CUS',
  supplier_code_prefix VARCHAR(20) DEFAULT 'SUP',
  employee_code_prefix VARCHAR(20) DEFAULT 'EMP',
  fiscal_year_start INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories Table (Hierarchical)
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id CHAR(36),
  code VARCHAR(50) UNIQUE,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_parent_id (parent_id),
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id CHAR(36),
  subcategory_id CHAR(36),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'pcs',
  cost_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  current_stock DECIMAL(12,4) DEFAULT 0,
  minimum_stock DECIMAL(12,4) DEFAULT 0,
  maximum_stock DECIMAL(12,4),
  barcode VARCHAR(100) UNIQUE,
  sku VARCHAR(100) UNIQUE,
  image_url VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  is_service TINYINT(1) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_category (category_id),
  INDEX idx_code (code),
  INDEX idx_barcode (barcode),
  INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  tax_number VARCHAR(100),
  credit_limit DECIMAL(12,4) DEFAULT 0,
  payment_terms INT DEFAULT 30,
  is_active TINYINT(1) DEFAULT 1,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_code (code),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  tax_number VARCHAR(100),
  payment_terms INT DEFAULT 30,
  is_active TINYINT(1) DEFAULT 1,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_code (code),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  department VARCHAR(100),
  position VARCHAR(100),
  salary DECIMAL(12,4),
  hire_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_code (code),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  account_subtype VARCHAR(100),
  parent_id CHAR(36),
  is_active TINYINT(1) DEFAULT 1,
  is_system TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES accounts(id),
  INDEX idx_code (code),
  INDEX idx_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal Entries (General Ledger)
CREATE TABLE IF NOT EXISTS journal_entries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(255),
  total_debit DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_credit DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_posted TINYINT(1) DEFAULT 0,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_entry_number (entry_number),
  INDEX idx_entry_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  journal_entry_id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  description TEXT,
  debit_amount DECIMAL(12,4) DEFAULT 0,
  credit_amount DECIMAL(12,4) DEFAULT 0,
  department_id CHAR(36),
  child_id CHAR(36),
  donor_id CHAR(36),
  fund_id CHAR(36),
  sponsor_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_journal_entry (journal_entry_id),
  INDEX idx_account (account_id),
  INDEX idx_dept (department_id),
  INDEX idx_child (child_id),
  INDEX idx_fund (fund_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  sale_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id CHAR(36),
  sale_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(12,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,4) DEFAULT 0,
  discount_amount DECIMAL(12,4) DEFAULT 0,
  total_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,4) DEFAULT 0,
  payment_status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sale_number (sale_number),
  INDEX idx_sale_date (sale_date),
  INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  sale_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL,
  discount_amount DECIMAL(12,4) DEFAULT 0,
  tax_amount DECIMAL(12,4) DEFAULT 0,
  total_amount DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_sale (sale_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  purchase_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id CHAR(36),
  purchase_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(12,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,4) DEFAULT 0,
  discount_amount DECIMAL(12,4) DEFAULT 0,
  total_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,4) DEFAULT 0,
  payment_status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_purchase_number (purchase_number),
  INDEX idx_purchase_date (purchase_date),
  INDEX idx_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  purchase_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL,
  discount_amount DECIMAL(12,4) DEFAULT 0,
  tax_amount DECIMAL(12,4) DEFAULT 0,
  total_amount DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_purchase (purchase_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  expense_number VARCHAR(50) UNIQUE NOT NULL,
  account_id CHAR(36) NOT NULL,
  supplier_id CHAR(36),
  expense_date DATE NOT NULL,
  amount DECIMAL(12,4) NOT NULL,
  tax_amount DECIMAL(12,4) DEFAULT 0,
  description TEXT NOT NULL,
  reference VARCHAR(255),
  receipt_url VARCHAR(500),
  is_approved TINYINT(1) DEFAULT 0,
  approved_by CHAR(36),
  created_by CHAR(36),
  department_id CHAR(36),
  child_id CHAR(36),
  donor_id CHAR(36),
  fund_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_expense_number (expense_number),
  INDEX idx_expense_date (expense_date),
  INDEX idx_exp_dept (department_id),
  INDEX idx_exp_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  movement_type ENUM('in', 'out', 'adjustment') NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,4),
  reference_type VARCHAR(50),
  reference_id CHAR(36),
  description TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_product (product_id),
  INDEX idx_movement_type (movement_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NGO & Fund Accounting Tables
CREATE TABLE IF NOT EXISTS departments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manager_id CHAR(36),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guardians (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS children (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  guardian_id CHAR(36),
  status ENUM('active', 'graduated', 'inactive') DEFAULT 'active',
  enrollment_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (guardian_id) REFERENCES guardians(id),
  INDEX idx_child_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS donors (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  donor_type ENUM('individual', 'corporate', 'foundation') NOT NULL,
  address TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsors (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  donor_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES donors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fund_accounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  restriction_type ENUM('unrestricted', 'temporarily_restricted', 'permanently_restricted') NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsorships (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  child_id CHAR(36) NOT NULL,
  sponsor_id CHAR(36) NOT NULL,
  amount DECIMAL(12,4) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('active', 'cancelled', 'on_hold') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id),
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS donations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  donor_id CHAR(36) NOT NULL,
  fund_id CHAR(36),
  amount DECIMAL(12,4) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  donation_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference_number VARCHAR(100),
  is_anonymous TINYINT(1) DEFAULT 0,
  restricted_to_child_id CHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES donors(id),
  FOREIGN KEY (fund_id) REFERENCES fund_accounts(id),
  FOREIGN KEY (restricted_to_child_id) REFERENCES children(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_transfers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  from_department_id CHAR(36) NOT NULL,
  to_department_id CHAR(36) NOT NULL,
  amount DECIMAL(12,4) NOT NULL,
  transfer_date DATE NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by CHAR(36),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (from_department_id) REFERENCES departments(id),
  FOREIGN KEY (to_department_id) REFERENCES departments(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36),
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default business settings
INSERT INTO business_settings (id) VALUES (UUID());

-- Insert default chart of accounts
INSERT INTO accounts (code, name, account_type, is_system) VALUES
  ('1000', 'Assets', 'asset', 1),
  ('1100', 'Current Assets', 'asset', 1),
  ('1110', 'Cash', 'asset', 1),
  ('1120', 'Accounts Receivable', 'asset', 1),
  ('1130', 'Inventory', 'asset', 1),
  ('1200', 'Fixed Assets', 'asset', 1),
  ('2000', 'Liabilities', 'liability', 1),
  ('2100', 'Current Liabilities', 'liability', 1),
  ('2110', 'Accounts Payable', 'liability', 1),
  ('2120', 'Accrued Expenses', 'liability', 1),
  ('3000', 'Equity', 'equity', 1),
  ('3100', 'Owner\'s Equity', 'equity', 1),
  ('4000', 'Revenue', 'revenue', 1),
  ('4100', 'Sales Revenue', 'revenue', 1),
  ('5000', 'Expenses', 'expense', 1),
  ('5100', 'Cost of Goods Sold', 'expense', 1),
  ('5200', 'Operating Expenses', 'expense', 1);
