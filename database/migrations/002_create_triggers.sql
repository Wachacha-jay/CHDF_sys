-- MySQL Triggers for Business Management System
-- Auto-generate codes and maintain data integrity

DELIMITER $$

-- Function to generate next code
DROP FUNCTION IF EXISTS generate_next_code$$
CREATE FUNCTION generate_next_code(prefix VARCHAR(20), table_name VARCHAR(50))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE next_number INT;
    DECLARE next_code VARCHAR(50);
    
    SET @sql = CONCAT('SELECT COALESCE(MAX(CAST(SUBSTRING(code, ', LENGTH(prefix) + 1, ') AS UNSIGNED)), 0) + 1 INTO @next_num FROM ', table_name, ' WHERE code LIKE "', prefix, '%"');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    SET next_code = CONCAT(prefix, LPAD(@next_num, 6, '0'));
    RETURN next_code;
END$$

-- Trigger for auto-generating product codes
DROP TRIGGER IF EXISTS before_product_insert$$
CREATE TRIGGER before_product_insert
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        SET NEW.code = generate_next_code('PRD', 'products');
    END IF;
END$$

-- Trigger for auto-generating customer codes
DROP TRIGGER IF EXISTS before_customer_insert$$
CREATE TRIGGER before_customer_insert
BEFORE INSERT ON customers
FOR EACH ROW
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        SET NEW.code = generate_next_code('CUS', 'customers');
    END IF;
END$$

-- Trigger for auto-generating supplier codes
DROP TRIGGER IF EXISTS before_supplier_insert$$
CREATE TRIGGER before_supplier_insert
BEFORE INSERT ON suppliers
FOR EACH ROW
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        SET NEW.code = generate_next_code('SUP', 'suppliers');
    END IF;
END$$

-- Trigger for auto-generating employee codes
DROP TRIGGER IF EXISTS before_employee_insert$$
CREATE TRIGGER before_employee_insert
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        SET NEW.code = generate_next_code('EMP', 'employees');
    END IF;
END$$

-- Trigger to update product stock on sale
DROP TRIGGER IF EXISTS after_sale_item_insert$$
CREATE TRIGGER after_sale_item_insert
AFTER INSERT ON sale_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id;
    
    INSERT INTO inventory_movements (id, product_id, movement_type, quantity, reference_type, reference_id, created_at)
    VALUES (UUID(), NEW.product_id, 'out', NEW.quantity, 'sale', NEW.sale_id, NOW());
END$$

-- Trigger to update product stock on purchase
DROP TRIGGER IF EXISTS after_purchase_item_insert$$
CREATE TRIGGER after_purchase_item_insert
AFTER INSERT ON purchase_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
    
    INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_at)
    VALUES (UUID(), NEW.product_id, 'in', NEW.quantity, NEW.unit_cost, 'purchase', NEW.purchase_id, NOW());
END$$

-- Trigger to revert stock on sale item delete
DROP TRIGGER IF EXISTS after_sale_item_delete$$
CREATE TRIGGER after_sale_item_delete
AFTER DELETE ON sale_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET current_stock = current_stock + OLD.quantity
    WHERE id = OLD.product_id;
    
    INSERT INTO inventory_movements (id, product_id, movement_type, quantity, reference_type, reference_id, description, created_at)
    VALUES (UUID(), OLD.product_id, 'in', OLD.quantity, 'sale_reversal', OLD.sale_id, 'Sale item deleted', NOW());
END$$

-- Trigger to revert stock on purchase item delete
DROP TRIGGER IF EXISTS after_purchase_item_delete$$
CREATE TRIGGER after_purchase_item_delete
AFTER DELETE ON purchase_items
FOR EACH ROW
BEGIN
    UPDATE products 
    SET current_stock = current_stock - OLD.quantity
    WHERE id = OLD.product_id;
    
    INSERT INTO inventory_movements (id, product_id, movement_type, quantity, reference_type, reference_id, description, created_at)
    VALUES (UUID(), OLD.product_id, 'out', OLD.quantity, 'purchase_reversal', OLD.purchase_id, 'Purchase item deleted', NOW());
END$$

DELIMITER ;
