// Run migration 011 via Node + mysql2
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true
  });

  console.log('Connected to DB:', process.env.DB_NAME);

  const sql = fs.readFileSync(
    path.join(__dirname, 'database/migrations/011_payroll_accounts_fix.sql'),
    'utf8'
  );

  // Filter out comment-only lines, run statement by statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  let ok = 0, errs = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log('  OK:', stmt.substring(0, 80).replace(/\n/g, ' '));
      ok++;
    } catch (e) {
      console.warn('  SKIP/ERR:', e.message.substring(0, 100));
      errs++;
    }
  }

  await conn.end();
  console.log(`\nDone. ${ok} statements OK, ${errs} skipped/errored.`);
}

run().catch(e => { console.error(e); process.exit(1); });
