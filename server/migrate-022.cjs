const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true
  });

  try {
    console.log('Running migration 022: Expand RBAC permissions with Maker-Checker separation...');
    const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/022_expand_rbac_permissions.sql'), 'utf8');
    await connection.query(sql);
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['022_expand_rbac_permissions.sql']);
    console.log('Migration 022 completed successfully.');
  } catch (error) {
    console.error('Migration 022 failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
