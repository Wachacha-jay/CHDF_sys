import pool from './config/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const migrationPath = path.join(__dirname, 'database', 'migrations', '009_bank_reconciliation.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration...');
  
  // Split by semicolon but ignore ones inside quotes if any (simple split here as the SQL is clean)
  // Actually, multiple statements in one query usually fail in mysql2 without multipleStatements: true
  // But we can split by semicolon.
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const connection = await pool.getConnection();
  try {
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await connection.query(statement);
    }
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    connection.release();
    process.exit();
  }
}

runMigration();
