-- NGO Invoicing Extensions
ALTER TABLE sales 
ADD COLUMN sale_type ENUM('standard', 'school_fees', 'child_support', 'sponsorship') DEFAULT 'standard' AFTER sale_number,
ADD COLUMN child_id CHAR(36) AFTER customer_id,
ADD COLUMN department_id CHAR(36) AFTER child_id,
ADD COLUMN fund_id CHAR(36) AFTER department_id,
ADD COLUMN donor_id CHAR(36) AFTER fund_id,
ADD CONSTRAINT fk_sales_child FOREIGN KEY (child_id) REFERENCES children(id),
ADD CONSTRAINT fk_sales_dept FOREIGN KEY (department_id) REFERENCES departments(id),
ADD CONSTRAINT fk_sales_fund FOREIGN KEY (fund_id) REFERENCES fund_accounts(id),
ADD CONSTRAINT fk_sales_donor FOREIGN KEY (donor_id) REFERENCES donors(id);

-- Add Fee-related accounts if missing
INSERT IGNORE INTO accounts (id, code, name, account_type, account_subtype, is_system) VALUES
('43000000-0000-0000-0000-000000004300', '4300', 'School Fees Revenue', 'revenue', 'Operating Revenue', 0),
('44000000-0000-0000-0000-000000004400', '4400', 'Child Support Revenue', 'revenue', 'Operating Revenue', 0);

-- Add System Product for NGO Services/Fees
INSERT IGNORE INTO products (id, code, name, description, unit_of_measure, selling_price, is_active, is_service) VALUES
('SERVICE-FEES-0000-0000-000000000001', 'NGO-SRV-001', 'NGO Service/Fee', 'System product for school fees, child support, and sponsorship obligations', 'unit', 0, 1, 1);

