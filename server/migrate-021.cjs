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
    console.log('Running migration 021: Add payment_account_id column to donations table...');
    // Check if column already exists
    const [cols] = await connection.query("SHOW COLUMNS FROM donations LIKE 'payment_account_id'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE donations ADD COLUMN payment_account_id CHAR(36)");
      console.log('Column payment_account_id added to donations.');
    } else {
      console.log('Column payment_account_id already exists on donations.');
    }
    
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['021_add_payment_account_id_to_donations.sql']);
    console.log('Migration 021 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
