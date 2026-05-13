-- Add missing professional accounting accounts
INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
  (UUID(), '1111', 'Bank - Mpesa/Card', 'asset', 1),
  (UUID(), '2150', 'Sales Tax Payable', 'liability', 1),
  (UUID(), '5210', 'Payroll Expense', 'expense', 1),
  (UUID(), '2121', 'PAYE Payable', 'liability', 1),
  (UUID(), '2122', 'NSSF Payable', 'liability', 1),
  (UUID(), '2123', 'NHIF/SHIF Payable', 'liability', 1),
  (UUID(), '2124', 'Housing Levy Payable', 'liability', 1),
  (UUID(), '2125', 'Net Salary Payable', 'liability', 1);
