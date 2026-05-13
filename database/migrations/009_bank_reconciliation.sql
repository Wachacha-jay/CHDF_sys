-- 009_bank_reconciliation.sql

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  account_id CHAR(36) NOT NULL,
  statement_date DATE NOT NULL,
  statement_balance DECIMAL(12,4) NOT NULL DEFAULT 0,
  ledger_balance DECIMAL(12,4) NOT NULL DEFAULT 0,
  difference DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('draft', 'completed') DEFAULT 'draft',
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_account (account_id),
  INDEX idx_statement_date (statement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE journal_entry_lines 
ADD COLUMN is_reconciled TINYINT(1) DEFAULT 0,
ADD COLUMN bank_reconciliation_id CHAR(36),
ADD CONSTRAINT fk_bank_reconciliation FOREIGN KEY (bank_reconciliation_id) REFERENCES bank_reconciliations(id) ON DELETE SET NULL;
