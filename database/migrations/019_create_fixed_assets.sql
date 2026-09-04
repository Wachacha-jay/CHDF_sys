-- Fixed Assets Table
CREATE TABLE IF NOT EXISTS fixed_assets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  asset_name VARCHAR(255) NOT NULL,
  description TEXT,
  serial_number VARCHAR(100),
  asset_type VARCHAR(100),
  purchase_date DATE NOT NULL,
  purchase_cost DECIMAL(12,4) NOT NULL,
  current_value DECIMAL(12,4) NOT NULL,
  salvage_value DECIMAL(12,4) DEFAULT 0,
  useful_life_years INT DEFAULT 5,
  department_id CHAR(36),
  status ENUM('Active', 'Disposed', 'Maintenance') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
