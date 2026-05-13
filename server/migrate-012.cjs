const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true,
  });
  console.log('Connected to:', process.env.DB_NAME);

  const sqlFile = path.join(__dirname, 'database/migrations/012_ngo_chart_of_accounts.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await conn.query(sql);
    console.log('Migration 012 executed successfully');
  } catch (e) {
    console.error('Migration 012 failed:', e.message);
  }

  await conn.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
