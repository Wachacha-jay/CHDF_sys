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
    console.log('Running migration 018: Add optional supplier fields...');
    const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/018_add_supplier_fields.sql'), 'utf8');
    await connection.query(sql);
    
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['018_add_supplier_fields.sql']);
    console.log('Migration 018 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
