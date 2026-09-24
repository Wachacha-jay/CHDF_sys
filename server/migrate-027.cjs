const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
  let connection;
  try {
    console.log('Connecting to MySQL at', process.env.DB_HOST || 'localhost', '...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'business_management',
      multipleStatements: true,
      connectTimeout: 5000
    });

    console.log('Connected! Running migration 027...');
    const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/027_internal_transfers_draft_status.sql'), 'utf8');
    await connection.query(sql);
    await connection.query('INSERT IGNORE INTO _migrations (name) VALUES (?)', ['027_internal_transfers_draft_status.sql']);
    console.log('Migration 027 completed successfully.');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

migrate();
