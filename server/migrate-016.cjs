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
    console.log('Running migration 016: Add payment_account_id to expenses...');
    await connection.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_account_id CHAR(36)');
    
    // Check if foreign key exists or ignore error if it exists
    try {
      await connection.query('ALTER TABLE expenses ADD CONSTRAINT fk_expense_payment_account FOREIGN KEY (payment_account_id) REFERENCES accounts(id)');
    } catch (e) {
      // Foreign key might already exist
    }

    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['016_add_payment_account_id_to_expenses.sql']);
    console.log('Migration 016 completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
