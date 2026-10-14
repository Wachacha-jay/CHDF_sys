-- Migration 027: Payroll Disbursement Lines (Split Cheques & Dates)
-- Allows paying an individual employee across multiple cheques/dates with full GL reconciliation

CREATE TABLE IF NOT EXISTS payroll_disbursements (
  id CHAR(36) PRIMARY KEY,
  payroll_run_id CHAR(36) NOT NULL,
  payment_account_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_date DATE NOT NULL,
  payment_reference VARCHAR(100) DEFAULT NULL,
  journal_entry_id CHAR(36) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payroll_disb_run (payroll_run_id),
  INDEX idx_payroll_disb_je (journal_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
