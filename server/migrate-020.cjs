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
    console.log('Running migration 020: Add is_posted column to donations table...');
    // Check if column already exists
    const [cols] = await connection.query("SHOW COLUMNS FROM donations LIKE 'is_posted'");
    if (cols.length === 0) {
      const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/020_add_is_posted_to_donations.sql'), 'utf8');
      await connection.query(sql);
      console.log('Column is_posted added to donations.');
    } else {
      console.log('Column is_posted already exists on donations.');
    }
    
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['020_add_is_posted_to_donations.sql']);
    console.log('Migration 020 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
