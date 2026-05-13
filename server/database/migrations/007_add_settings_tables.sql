-- Migration: Add Units of Measure and User Designations
-- Author: Antigravity
-- Date: 2026-04-07

-- 1. Create Units of Measure Table
CREATE TABLE IF NOT EXISTS units_of_measure (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Designations Table
CREATE TABLE IF NOT EXISTS designations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Seed Default Units
INSERT IGNORE INTO units_of_measure (id, name, symbol) VALUES
(UUID(), 'Pieces', 'pcs'),
(UUID(), 'Kilograms', 'kg'),
(UUID(), 'Grams', 'g'),
(UUID(), 'Liters', 'l'),
(UUID(), 'Milliliters', 'ml'),
(UUID(), 'Box', 'box'),
(UUID(), 'Pack', 'pack'),
(UUID(), 'Dozen', 'dz'),
(UUID(), 'Meters', 'm');

-- 4. Add foreign key columns to products and employees
ALTER TABLE products ADD COLUMN unit_id CHAR(36) AFTER unit_of_measure;
ALTER TABLE employees ADD COLUMN designation_id CHAR(36) AFTER position;

-- 5. Migrate existing units from products
-- Create unique entries for any free-text units that aren't in the seeds
INSERT IGNORE INTO units_of_measure (id, name, symbol)
SELECT DISTINCT UUID(), unit_of_measure, LEFT(unit_of_measure, 10)
FROM products
WHERE unit_of_measure NOT IN (SELECT symbol FROM units_of_measure)
  AND unit_of_measure NOT IN (SELECT name FROM units_of_measure);

-- Update products.unit_id based on matching name or symbol
UPDATE products p
JOIN units_of_measure u ON (p.unit_of_measure = u.name OR p.unit_of_measure = u.symbol)
SET p.unit_id = u.id;

-- 6. Migrate existing positions from employees
INSERT IGNORE INTO designations (id, name)
SELECT DISTINCT UUID(), position
FROM employees
WHERE position IS NOT NULL AND position != '';

-- Update employees.designation_id
UPDATE employees e
JOIN designations d ON e.position = d.name
SET e.designation_id = d.id;

-- 7. Constraints (Optional: only if you want strict enforcement)
-- ALTER TABLE products ADD CONSTRAINT fk_product_unit FOREIGN KEY (unit_id) REFERENCES units_of_measure(id);
-- ALTER TABLE employees ADD CONSTRAINT fk_employee_designation FOREIGN KEY (designation_id) REFERENCES designations(id);
