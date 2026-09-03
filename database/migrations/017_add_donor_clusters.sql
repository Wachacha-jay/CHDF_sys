-- Migration 017: Add Donor Clusters
CREATE TABLE IF NOT EXISTS donor_clusters (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default clusters
INSERT IGNORE INTO donor_clusters (id, name, description) VALUES
  ('cls-1', 'Individual Monthly Donors', 'Regular recurring individual supporters'),
  ('cls-2', 'Corporate CSR Grants', 'Corporate partners and CSR funding programs'),
  ('cls-3', 'Child Education Sponsors', 'Sponsors dedicated to child tuition and welfare'),
  ('cls-4', 'Emergency Relief Donors', 'Contributors to disaster and emergency relief funds'),
  ('cls-5', 'In-Kind Goods Donors', 'Donors contributing physical items, food, and supplies'),
  ('cls-6', 'High Net Worth Donors', 'Major donors and philanthropist foundations');

ALTER TABLE donors ADD COLUMN IF NOT EXISTS cluster_id CHAR(36);
ALTER TABLE donors ADD CONSTRAINT fk_donor_cluster FOREIGN KEY IF NOT EXISTS (cluster_id) REFERENCES donor_clusters(id);
