-- Migration: Add Payroll System Tables
-- Author: Antigravity
-- Date: 2026-04-16

-- 1. Payroll Settings
CREATE TABLE IF NOT EXISTS payroll_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  pay_period ENUM('weekly', 'bi-weekly', 'monthly') DEFAULT 'monthly',
  pay_day TINYINT DEFAULT 25,
  overtime_rate DECIMAL(5,2) DEFAULT 1.5,
  holiday_pay_rate DECIMAL(5,2) DEFAULT 2.0,
  tax_deduction_rate DECIMAL(5,2) DEFAULT 30.0,
  nhif_rate DECIMAL(5,2) DEFAULT 2.5,
  nssf_rate DECIMAL(5,2) DEFAULT 6.0,
  housing_levy_rate DECIMAL(5,2) DEFAULT 1.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Payroll Periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE,
  status ENUM('open', 'processing', 'closed') DEFAULT 'open',
  total_gross_pay DECIMAL(14,2) DEFAULT 0,
  total_net_pay DECIMAL(14,2) DEFAULT 0,
  total_tax DECIMAL(14,2) DEFAULT 0,
  total_nhif DECIMAL(14,2) DEFAULT 0,
  total_nssf DECIMAL(14,2) DEFAULT 0,
  total_housing_levy DECIMAL(14,2) DEFAULT 0,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Payroll Runs (Individual Employee Payroll)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payroll_period_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  basic_salary DECIMAL(12,2) DEFAULT 0,
  overtime_hours DECIMAL(8,2) DEFAULT 0,
  overtime_pay DECIMAL(12,2) DEFAULT 0,
  holiday_hours DECIMAL(8,2) DEFAULT 0,
  holiday_pay DECIMAL(12,2) DEFAULT 0,
  allowances DECIMAL(12,2) DEFAULT 0,
  bonuses DECIMAL(12,2) DEFAULT 0,
  gross_pay DECIMAL(12,2) DEFAULT 0,
  tax_deduction DECIMAL(12,2) DEFAULT 0,
  nhif_deduction DECIMAL(12,2) DEFAULT 0,
  nssf_deduction DECIMAL(12,2) DEFAULT 0,
  housing_levy_deduction DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  status ENUM('draft', 'approved', 'paid') DEFAULT 'draft',
  paid_date DATETIME,
  journal_entry_id CHAR(36),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_employee_period (employee_id, payroll_period_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Payroll Deductions
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payroll_run_id CHAR(36) NOT NULL,
  deduction_type ENUM('loan', 'advance', 'insurance', 'other') DEFAULT 'other',
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Payroll Allowances
CREATE TABLE IF NOT EXISTS payroll_allowances (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payroll_run_id CHAR(36) NOT NULL,
  allowance_type ENUM('housing', 'transport', 'meal', 'other') DEFAULT 'other',
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Payroll Journal Entries (Tracking the batch postings)
CREATE TABLE IF NOT EXISTS payroll_journal_entries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payroll_period_id CHAR(36) NOT NULL,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  total_amount DECIMAL(14,2) DEFAULT 0,
  status ENUM('draft', 'posted') DEFAULT 'draft',
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize Payroll Settings if not exists
INSERT IGNORE INTO payroll_settings (id) VALUES (UUID());

-- Update Employee Table for missing payroll fields
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS nhif_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_pin VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method ENUM('bank', 'cash', 'mpesa') DEFAULT 'bank';
