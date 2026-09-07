-- Migration 021: Add payment_account_id to donations table
ALTER TABLE donations ADD COLUMN payment_account_id CHAR(36);
