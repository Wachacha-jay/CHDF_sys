-- Migration 018: Add optional fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);
