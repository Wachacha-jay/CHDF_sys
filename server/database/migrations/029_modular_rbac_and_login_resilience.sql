-- Migration: 029_modular_rbac_and_login_resilience.sql
-- Description: Modular RBAC permissions matching the Enterprise Sidebar and Login Resilience

-- 1. Ensure users table has proper is_active default and constraints
UPDATE users SET is_active = 1 WHERE is_active IS NULL;
ALTER TABLE users MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- 2. Insert missing permissions used by the modular sidebar & route gates
INSERT IGNORE INTO permissions (id, name, module, action, description) VALUES
('perm-invoices-view', 'invoices_view', 'Sales & Invoicing', 'view', 'View customer sales invoices and orders'),
('perm-bank-recon-view-alias', 'bank_reconciliation_view', 'Accounting', 'view', 'Access bank reconciliation module'),
('perm-fund-acct-view', 'fund_accounting_view', 'Fund Accounting', 'view', 'Access NGO fund accounting dashboard and balance overviews'),
('perm-fund-acct-manage', 'fund_accounting_manage', 'Fund Accounting', 'manage', 'Manage internal transfers, NGO billing, and fund/department setup'),
('perm-fund-reports-view', 'fund_reports_view', 'Fund Accounting', 'view', 'View NGO fund accounting financial and donor reports'),
('perm-school-fees-view', 'school_fees_view', 'Fund Accounting', 'view', 'View student school fee payment records'),
('perm-audit-logs-view', 'audit_logs_view', 'Security & Logs', 'view', 'View system audit trails and security activity logs');

-- 3. Harmonize module classifications to match the Enterprise Sidebar
UPDATE permissions SET module = 'Core' WHERE name IN ('dashboard_view');
UPDATE permissions SET module = 'Point of Sale' WHERE name IN ('pos_view');
UPDATE permissions SET module = 'Inventory' WHERE name LIKE 'inventory_%';
UPDATE permissions SET module = 'Sales & Invoicing' WHERE name LIKE 'sales_%' OR name = 'invoices_view';
UPDATE permissions SET module = 'Expenses' WHERE name LIKE 'expenses_%';
UPDATE permissions SET module = 'Accounting' WHERE name LIKE 'accounting_%' OR name LIKE 'chart_of_accounts_%' OR name LIKE 'journal_entries_%' OR name LIKE 'bank_recon_%' OR name = 'bank_reconciliation_view' OR name LIKE 'fixed_assets_%';
UPDATE permissions SET module = 'Fund Accounting' WHERE name LIKE 'donations_%' OR name LIKE 'child_support_%' OR name LIKE 'children_%' OR name LIKE 'transfers_%' OR name LIKE 'fund_%' OR name = 'school_fees_view';
UPDATE permissions SET module = 'CRM & Vendors' WHERE name LIKE 'customers_%' OR name LIKE 'suppliers_%' OR name LIKE 'purchases_%';
UPDATE permissions SET module = 'HR & Payroll' WHERE name LIKE 'employees_%' OR name LIKE 'payroll_%';
UPDATE permissions SET module = 'Security & Logs' WHERE name IN ('user_management_manage', 'audit_logs_view');
UPDATE permissions SET module = 'Settings & Reports' WHERE name IN ('settings_manage', 'reports_view');

-- 4. Assign ALL permissions to Super Admin
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Super Admin'), id FROM permissions;

-- 5. Assign system permissions to Admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Admin'), id FROM permissions;

-- 6. Assign Fund Accounting and Accounting permissions to Finance Manager (Checker/Approver)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Finance Manager'), id FROM permissions
WHERE name IN (
  'dashboard_view', 'reports_view', 'invoices_view', 'sales_view',
  'accounting_view', 'bank_reconciliation_view', 'bank_recon_view', 'bank_recon_manage',
  'fund_accounting_view', 'fund_accounting_manage', 'fund_reports_view', 'school_fees_view',
  'child_support_view', 'child_support_record', 'child_support_post', 'children_manage',
  'donations_view', 'donations_record', 'donations_post', 'donations_edit', 'donations_delete',
  'transfers_view', 'transfers_create', 'transfers_approve', 'fund_setup_view', 'fund_setup_manage',
  'audit_logs_view'
);

-- 7. Assign Accountant permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Accountant'), id FROM permissions
WHERE name IN (
  'dashboard_view', 'reports_view', 'invoices_view', 'sales_view',
  'accounting_view', 'accounting_manage', 'chart_of_accounts_view', 'chart_of_accounts_manage',
  'journal_entries_view', 'journal_entries_record', 'journal_entries_post',
  'bank_reconciliation_view', 'bank_recon_view', 'bank_recon_manage',
  'fixed_assets_view', 'fixed_assets_manage',
  'fund_accounting_view', 'fund_reports_view'
);

-- 8. Assign Data Entry Officer permissions (Maker)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Data Entry Officer'), id FROM permissions
WHERE name IN (
  'dashboard_view', 'pos_view', 'sales_view', 'sales_create', 'invoices_view',
  'donations_view', 'donations_record', 'child_support_view', 'child_support_record', 'school_fees_view',
  'transfers_view', 'transfers_create', 'fund_accounting_view'
);
