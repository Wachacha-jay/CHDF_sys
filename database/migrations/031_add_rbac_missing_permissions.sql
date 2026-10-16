-- Migration: 031_add_rbac_missing_permissions.sql
-- Description: Expand RBAC permissions to include School Fees, Fund Accounting, Audit Logs, Invoicing, and Bank Reconciliation
-- Author: Antigravity

-- 1. Insert missing permissions (Idempotent)
INSERT IGNORE INTO permissions (id, name, module, action, description) VALUES
-- Audit Logs
(UUID(), 'audit_logs_view', 'Audit Log', 'view', 'View system audit trails and security activity logs'),

-- Fund Accounting & Child Support
(UUID(), 'fund_accounting_view', 'Fund Accounting', 'view', 'Access Fund Accounting module and dashboard'),
(UUID(), 'fund_accounting_manage', 'Fund Accounting', 'manage', 'Manage departments, funds setup, billing and transfers'),
(UUID(), 'school_fees_view', 'Fund Accounting', 'view', 'View child school fee payments, balances and fee structures'),
(UUID(), 'school_fees_manage', 'Fund Accounting', 'manage', 'Record, process and manage child school fee payments'),
(UUID(), 'child_support_view', 'Fund Accounting', 'view', 'View enrolled child support profiles and records'),
(UUID(), 'child_support_manage', 'Fund Accounting', 'manage', 'Enroll, update and manage child support beneficiaries'),
(UUID(), 'donations_view', 'Fund Accounting', 'view', 'View donations and donor contributions'),
(UUID(), 'donations_manage', 'Fund Accounting', 'manage', 'Record, edit and manage donor contributions'),
(UUID(), 'fund_reports_view', 'Fund Accounting', 'view', 'View fund accounting and project financial reports'),

-- Invoices
(UUID(), 'invoices_view', 'Invoices', 'view', 'View sales and purchase invoices'),
(UUID(), 'invoices_manage', 'Invoices', 'manage', 'Create, edit and manage invoices and payments'),

-- Bank Reconciliation
(UUID(), 'bank_reconciliation_view', 'Accounting', 'view', 'Access bank reconciliation workspaces'),
(UUID(), 'bank_reconciliation_manage', 'Accounting', 'manage', 'Perform and approve bank reconciliations');

-- 2. Assign ALL permissions to 'Super Admin'
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin';

-- 3. Assign permissions to 'Admin' (all except user_management_manage)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.name != 'user_management_manage';

-- 4. Assign permissions to 'Accountant'
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Accountant' AND p.name IN (
  'dashboard_view',
  'accounting_view', 'accounting_manage',
  'expenses_view', 'expenses_manage',
  'reports_view',
  'invoices_view', 'invoices_manage',
  'bank_reconciliation_view', 'bank_reconciliation_manage',
  'fund_accounting_view', 'fund_accounting_manage',
  'school_fees_view', 'school_fees_manage',
  'child_support_view',
  'donations_view', 'donations_manage',
  'fund_reports_view',
  'customers_view',
  'suppliers_view'
);

-- 5. Assign permissions to 'Manager'
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager' AND p.name IN (
  'dashboard_view',
  'pos_view',
  'sales_view', 'sales_create', 'sales_edit',
  'inventory_view', 'inventory_create', 'inventory_edit',
  'expenses_view', 'expenses_manage',
  'invoices_view', 'invoices_manage',
  'customers_view', 'customers_manage',
  'suppliers_view', 'suppliers_manage',
  'employees_view',
  'reports_view',
  'audit_logs_view',
  'fund_accounting_view',
  'school_fees_view',
  'child_support_view',
  'donations_view'
);

-- 6. Assign permissions to 'Cashier'
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier' AND p.name IN (
  'dashboard_view',
  'pos_view',
  'sales_view', 'sales_create',
  'customers_view',
  'invoices_view'
);
