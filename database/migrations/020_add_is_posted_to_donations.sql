-- Migration 020: Add is_posted column to donations table
ALTER TABLE donations 
ADD COLUMN is_posted TINYINT(1) DEFAULT 0 AFTER is_anonymous;
