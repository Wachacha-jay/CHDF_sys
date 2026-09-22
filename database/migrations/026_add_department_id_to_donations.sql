-- Migration 026: Add department_id to donations table
-- Allows assigning donations directly to specific departments for accurate departmental accounting

ALTER TABLE donations 
  ADD COLUMN IF NOT EXISTS department_id CHAR(36) NULL;

-- Add index and foreign key if possible
ALTER TABLE donations
  ADD INDEX IF NOT EXISTS idx_donations_department_id (department_id);
