import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Running migration: 006_add_missing_accounts.sql...');
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '006_add_missing_accounts.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and run each command
    const commands = sql.split(';').filter(cmd => cmd.trim());
    for (const cmd of commands) {
      await pool.query(cmd);
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
