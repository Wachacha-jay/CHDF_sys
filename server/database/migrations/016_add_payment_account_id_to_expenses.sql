-- Migration 016: Add payment_account_id to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_account_id CHAR(36);
ALTER TABLE expenses ADD CONSTRAINT fk_expense_payment_account FOREIGN KEY IF NOT EXISTS (payment_account_id) REFERENCES accounts(id);
