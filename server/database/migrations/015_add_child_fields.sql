-- Migration 015: Add class_name and disability_type to children table
ALTER TABLE children ADD COLUMN IF NOT EXISTS class_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE children ADD COLUMN IF NOT EXISTS disability_type VARCHAR(255) DEFAULT 'None';
