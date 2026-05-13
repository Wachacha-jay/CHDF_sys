const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/014_ngo_invoicing.sql'), 'utf8');
    console.log('Running migration 014...');
    await connection.query(sql);
    
    // Log migration
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['014_ngo_invoicing.sql']);
    
    console.log('Migration 014 completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
