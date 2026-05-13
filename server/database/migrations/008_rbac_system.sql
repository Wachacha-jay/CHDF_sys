-- Migration: 008_rbac_system.sql (FIXED)
-- Description: Professional Role-Based Access Control System
-- Author: Antigravity (Senior Software Engineer)

USE business_management;

-- 1. Create Roles Table with correct collation to match users table
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system TINYINT(1) DEFAULT 0, -- 1 for protected system roles
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Permissions Table
DROP TABLE IF EXISTS permissions;
CREATE TABLE permissions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'inventory_view', 'sales_create'
  module VARCHAR(50) NOT NULL,       -- e.g., 'Inventory', 'Sales'
  action VARCHAR(50) NOT NULL,       -- e.g., 'view', 'create', 'edit', 'delete'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Role_Permissions Join Table
CREATE TABLE role_permissions (
  role_id CHAR(36),
  permission_id CHAR(36),
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Update Users Table
-- Using a procedure to safely add columns if they don't exist
DELIMITER //
CREATE PROCEDURE AddColumnsIfNotExist()
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id' AND TABLE_SCHEMA = 'business_management') THEN
        ALTER TABLE users ADD COLUMN role_id CHAR(36) AFTER password_hash;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'employee_id' AND TABLE_SCHEMA = 'business_management') THEN
        ALTER TABLE users ADD COLUMN employee_id CHAR(36) AFTER role_id;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'username' AND TABLE_SCHEMA = 'business_management') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE AFTER email;
    END IF;
END //
DELIMITER ;
CALL AddColumnsIfNotExist();
DROP PROCEDURE AddColumnsIfNotExist;

-- Add Foreign Key Constraints (safely)
-- Drop if they exist first to avoid errors on retry
ALTER TABLE users DROP FOREIGN KEY IF EXISTS fk_user_role;
ALTER TABLE users DROP FOREIGN KEY IF EXISTS fk_user_employee;

ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 5. Seed Initial Roles
INSERT INTO roles (id, name, description, is_system) VALUES
(UUID(), 'Super Admin', 'Full system access override', 1),
(UUID(), 'Admin', 'Management and configuration access', 1),
(UUID(), 'Manager', 'Operational management access', 0),
(UUID(), 'Cashier', 'Sales and POS access only', 0),
(UUID(), 'Accountant', 'Financial and accounting access', 0);

-- 6. Seed Permissions
INSERT INTO permissions (id, name, module, action, description) VALUES
(UUID(), 'dashboard_view', 'Dashboard', 'view', 'View dashboard statistics'),
(UUID(), 'pos_view', 'POS', 'view', 'Access POS interface'),
(UUID(), 'sales_view', 'Sales', 'view', 'View sales and invoices'),
(UUID(), 'sales_create', 'Sales', 'create', 'Process new sales'),
(UUID(), 'sales_edit', 'Sales', 'edit', 'Modify existing sales'),
(UUID(), 'sales_delete', 'Sales', 'delete', 'Cancel/Delete sales'),
(UUID(), 'inventory_view', 'Inventory', 'view', 'View products and stock'),
(UUID(), 'inventory_create', 'Inventory', 'create', 'Add new products'),
(UUID(), 'inventory_edit', 'Inventory', 'edit', 'Modify products and stock'),
(UUID(), 'inventory_delete', 'Inventory', 'delete', 'Delete products'),
(UUID(), 'customers_view', 'Customers', 'view', 'View customer list'),
(UUID(), 'customers_manage', 'Customers', 'manage', 'Add/Edit customers'),
(UUID(), 'suppliers_view', 'Suppliers', 'view', 'View supplier list'),
(UUID(), 'suppliers_manage', 'Suppliers', 'manage', 'Add/Edit suppliers'),
(UUID(), 'employees_view', 'Employees', 'view', 'View employee list'),
(UUID(), 'employees_manage', 'Employees', 'manage', 'Manage employee profiles'),
(UUID(), 'accounting_view', 'Accounting', 'view', 'Access financial statements'),
(UUID(), 'accounting_manage', 'Accounting', 'manage', 'Manage accounts and journal entries'),
(UUID(), 'expenses_view', 'Expenses', 'view', 'View expenses'),
(UUID(), 'expenses_manage', 'Expenses', 'manage', 'Record and approve expenses'),
(UUID(), 'reports_view', 'Reports', 'view', 'Access system reports'),
(UUID(), 'settings_manage', 'Settings', 'manage', 'Modify system settings'),
(UUID(), 'user_management_manage', 'User Management', 'manage', 'Manage users and roles');

-- 7. Assign ALL permissions to 'Super Admin'
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Super Admin'), id FROM permissions;

-- 8. Assign basic permissions to 'Admin'
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Admin'), id FROM permissions 
WHERE name NOT LIKE 'user_management_manage';

-- 9. Assign 'Cashier' permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Cashier'), id FROM permissions 
WHERE module IN ('POS', 'Sales', 'Dashboard') AND action IN ('view', 'create');

-- 10. Update existing admin user to be 'Super Admin'
SET @super_admin_role_id = (SELECT id FROM roles WHERE name = 'Super Admin');
UPDATE users SET role_id = @super_admin_role_id WHERE email = 'admin@business.com';
UPDATE users SET username = 'admin' WHERE email = 'admin@business.com';
