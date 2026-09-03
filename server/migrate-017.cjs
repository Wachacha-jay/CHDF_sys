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
    console.log('Running migration 017: Add donor_clusters...');
    const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/017_add_donor_clusters.sql'), 'utf8');
    await connection.query(sql);
    
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['017_add_donor_clusters.sql']);
    console.log('Migration 017 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
