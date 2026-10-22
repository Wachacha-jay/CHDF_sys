-- Migration 032: Add payer columns to school_fee_payments
-- Adds payer_type, payer_name, and donor_id columns to school_fee_payments table

ALTER TABLE school_fee_payments 
  ADD COLUMN IF NOT EXISTS payer_type VARCHAR(50) DEFAULT 'guardian',
  ADD COLUMN IF NOT EXISTS payer_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS donor_id CHAR(36) NULL;

ALTER TABLE school_fee_payments
  ADD INDEX IF NOT EXISTS idx_sfp_donor (donor_id);
