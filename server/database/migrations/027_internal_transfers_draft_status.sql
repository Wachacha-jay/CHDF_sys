-- Migration 027: Add draft to internal_transfers status enum
ALTER TABLE internal_transfers MODIFY COLUMN status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'pending';
