-- Create Superadmin User
-- This migration creates a default superadmin account for initial system access
-- Run this after 003_seed_data.sql

-- USE business_management;

-- Create superadmin user
-- Email: admin@business.com
-- Password: admin123 (hashed with PHP password_hash using PASSWORD_DEFAULT)
-- IMPORTANT: Change this password after first login!

INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at) 
VALUES (
  UUID(), 
  'admin@business.com', 
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Super', 
  'Admin', 
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Verify the user was created
SELECT id, email, first_name, last_name, is_active, created_at 
FROM users 
WHERE email = 'admin@business.com';

-- Display login credentials
SELECT 
  '==================================' AS '',
  'SUPERADMIN LOGIN CREDENTIALS' AS '',
  '==================================' AS '',
  'Email: admin@business.com' AS '',
  'Password: admin123' AS '',
  '==================================' AS '',
  'IMPORTANT: Change password after first login!' AS '';
