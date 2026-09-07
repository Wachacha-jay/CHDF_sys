-- Migration: 022_expand_rbac_permissions.sql
-- Description: Expand RBAC permissions with Maker-Checker (Creator-Approver) separation across all system modules

-- Insert or Update Roles
INSERT IGNORE INTO roles (id, name, description, is_system) VALUES
('role-super-admin', 'Super Admin', 'Full system access override', 1),
('role-admin', 'Admin', 'System configuration and user management', 1),
('role-finance-manager', 'Finance Manager', 'Approver/Checker for expenses, donations, transfers, and ledger posting', 0),
('role-accountant', 'Accountant', 'General ledger, chart of accounts, fixed assets, and financial statements', 0),
('role-data-entry', 'Data Entry Officer', 'Maker/Creator for draft donations, pending expenses, transfer requests, and fee entries', 0),
('role-cashier', 'Cashier', 'POS sales counter and customer payments', 0);

-- Insert or Update Granular Permissions
INSERT IGNORE INTO permissions (id, name, module, action, description) VALUES
-- Fund Accounting - Donations
(UUID(), 'donations_view', 'Donations', 'view', 'View donation records'),
(UUID(), 'donations_record', 'Donations', 'create', 'Record new contribution in draft status (Maker)'),
(UUID(), 'donations_post', 'Donations', 'approve', 'Post unposted draft donation to General Ledger (Checker)'),
(UUID(), 'donations_edit', 'Donations', 'edit', 'Modify donation contribution details'),
(UUID(), 'donations_delete', 'Donations', 'delete', 'Void or delete donation record'),

-- Fund Accounting - Child Support & Fees
(UUID(), 'child_support_view', 'Child Support', 'view', 'View registered children and fee payment history'),
(UUID(), 'child_support_record', 'Child Support', 'create', 'Submit school fee payment request (Maker)'),
(UUID(), 'child_support_post', 'Child Support', 'approve', 'Approve and post school fee payment to G/L (Checker)'),
(UUID(), 'children_manage', 'Child Support', 'manage', 'Register and edit child and guardian profiles'),

-- Fund Accounting - Internal Transfers & Loans
(UUID(), 'transfers_view', 'Internal Transfers', 'view', 'View internal transfer and loan history'),
(UUID(), 'transfers_create', 'Internal Transfers', 'create', 'Request internal transfer or loan (Maker)'),
(UUID(), 'transfers_approve', 'Internal Transfers', 'approve', 'Approve internal transfer/loan and post G/L entry (Checker)'),

-- Fund Accounting - Setup
(UUID(), 'fund_setup_view', 'Fund Setup', 'view', 'View departments, fund accounts, and donor clusters'),
(UUID(), 'fund_setup_manage', 'Fund Setup', 'manage', 'Manage departments, fund accounts, and donor clusters'),

-- Expense Management
(UUID(), 'expenses_view', 'Expenses', 'view', 'View expense list and statistics'),
(UUID(), 'expenses_record', 'Expenses', 'create', 'Submit new expense in pending status (Maker)'),
(UUID(), 'expenses_approve', 'Expenses', 'approve', 'Approve pending expense and post to G/L (Checker)'),
(UUID(), 'expenses_delete', 'Expenses', 'delete', 'Delete expense record'),

-- Accounting & General Ledger
(UUID(), 'chart_of_accounts_view', 'Accounting', 'view', 'View Chart of Accounts tree'),
(UUID(), 'chart_of_accounts_manage', 'Accounting', 'manage', 'Add, edit, or delete accounts in Chart of Accounts'),
(UUID(), 'journal_entries_view', 'Accounting', 'view', 'View general ledger journal entries'),
(UUID(), 'journal_entries_record', 'Accounting', 'create', 'Draft manual journal entries (Maker)'),
(UUID(), 'journal_entries_post', 'Accounting', 'approve', 'Post manual journal entries to G/L (Checker)'),
(UUID(), 'bank_recon_view', 'Accounting', 'view', 'View bank reconciliation statements'),
(UUID(), 'bank_recon_manage', 'Accounting', 'manage', 'Perform and finalize bank reconciliation'),
(UUID(), 'fixed_assets_view', 'Accounting', 'view', 'View fixed asset register'),
(UUID(), 'fixed_assets_manage', 'Accounting', 'manage', 'Manage fixed assets and depreciation calculations'),

-- POS & Sales
(UUID(), 'pos_view', 'POS', 'view', 'Access POS terminal'),
(UUID(), 'sales_view', 'Sales', 'view', 'View sales history and invoices'),
(UUID(), 'sales_create', 'Sales', 'create', 'Process new sales invoice (Maker)'),
(UUID(), 'sales_edit', 'Sales', 'edit', 'Modify unposted sales invoices'),
(UUID(), 'sales_delete', 'Sales', 'delete', 'Void sales invoice (Checker)'),

-- Purchasing & Inventory
(UUID(), 'inventory_view', 'Inventory', 'view', 'View product stock levels'),
(UUID(), 'inventory_manage', 'Inventory', 'manage', 'Manage products and stock adjustments'),
(UUID(), 'purchases_view', 'Purchases', 'view', 'View purchase orders and bills'),
(UUID(), 'purchases_create', 'Purchases', 'create', 'Create purchase orders/bills (Maker)'),
(UUID(), 'suppliers_manage', 'Suppliers', 'manage', 'Add and edit supplier profiles'),

-- HR & Payroll
(UUID(), 'employees_view', 'Employees', 'view', 'View employee directory'),
(UUID(), 'employees_manage', 'Employees', 'manage', 'Manage employee profiles and salary setup'),
(UUID(), 'payroll_view', 'Payroll', 'view', 'View payroll periods and slips'),
(UUID(), 'payroll_run', 'Payroll', 'approve', 'Process payroll runs and post payroll journal entries (Checker)'),

-- Administration
(UUID(), 'user_management_manage', 'User Management', 'manage', 'Manage user accounts, roles, and permissions'),
(UUID(), 'settings_manage', 'Settings', 'manage', 'Modify company and system settings'),
(UUID(), 'reports_view', 'Reports', 'view', 'Access system financial and operational reports'),
(UUID(), 'dashboard_view', 'Dashboard', 'view', 'View dashboard overview and metrics');

-- Assign ALL permissions to Super Admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Super Admin'), id FROM permissions;

-- Assign permissions to Finance Manager (Checker/Approver Role)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Finance Manager'), id FROM permissions
WHERE name IN (
  'donations_view', 'donations_record', 'donations_post', 'donations_edit', 'donations_delete',
  'child_support_view', 'child_support_record', 'child_support_post', 'children_manage',
  'transfers_view', 'transfers_create', 'transfers_approve',
  'fund_setup_view', 'fund_setup_manage',
  'expenses_view', 'expenses_record', 'expenses_approve', 'expenses_delete',
  'chart_of_accounts_view', 'chart_of_accounts_manage',
  'journal_entries_view', 'journal_entries_record', 'journal_entries_post',
  'bank_recon_view', 'bank_recon_manage',
  'fixed_assets_view', 'fixed_assets_manage',
  'sales_view', 'purchases_view', 'inventory_view',
  'reports_view', 'dashboard_view'
);

-- Assign permissions to Data Entry Officer (Maker Role)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Data Entry Officer'), id FROM permissions
WHERE name IN (
  'donations_view', 'donations_record',
  'child_support_view', 'child_support_record',
  'transfers_view', 'transfers_create',
  'fund_setup_view',
  'expenses_view', 'expenses_record',
  'journal_entries_view', 'journal_entries_record',
  'pos_view', 'sales_view', 'sales_create',
  'inventory_view', 'purchases_view', 'purchases_create',
  'dashboard_view'
);
