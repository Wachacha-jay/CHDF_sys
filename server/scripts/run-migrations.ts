import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true,
  });

  console.log('🚀 Starting professional migration runner...');

  try {
    // 1. Create migrations table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Get executed migrations
    const [rows]: any = await connection.query('SELECT name FROM _migrations');
    const executedMigrations = new Set(rows.map((r: any) => r.name));

    // 3. Read migration files
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure order

    console.log(`Found ${migrationFiles.length} migration files.`);

    for (const file of migrationFiles) {
      if (executedMigrations.has(file)) {
        console.log(`✅ Skipping already executed: ${file}`);
        continue;
      }

      console.log(`⏳ Executing migration: ${file}...`);
      let sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');

      // --- IMPROVED SQL SPLITTING ---
      let currentDelimiter = ';';
      const lines = sql.split(/\r?\n/);
      const statements: string[] = [];
      let currentStatement = '';

      for (let line of lines) {
        const trimmedLine = line.trim();
        
        // Robust DELIMITER detection
        const delimMatch = trimmedLine.match(/^DELIMITER\s+(.+)$/i);
        if (delimMatch) {
          currentDelimiter = delimMatch[1].trim();
          // console.log(`   [Debug] Changed delimiter to: ${currentDelimiter}`);
          continue;
        }

        currentStatement += line + '\n';

        // Check for delimiter at the end of the trimmed line
        if (trimmedLine.endsWith(currentDelimiter)) {
          const stmt = currentStatement.trim();
          // Extract statement without the delimiter
          const statementToExecute = stmt.slice(0, -currentDelimiter.length).trim();
          
          if (statementToExecute) {
            statements.push(statementToExecute);
          }
          currentStatement = '';
        }
      }
      
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
      }

      // Execute statements
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        
        try {
          await connection.query(stmt);
        } catch (err: any) {
          console.error(`❌ Error in ${file} at statement:`);
          console.error(`--- SQL START ---`);
          console.error(stmt.substring(0, 500) + (stmt.length > 500 ? '...' : ''));
          console.error(`--- SQL END ---`);
          console.error(`Error message: ${err.message}`);
          process.exit(1);
        }
      }
      
      // Record migration
      await connection.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
      console.log(`✨ Successfully executed: ${file}`);
    }

    console.log('\n🏁 All migrations are up to date.');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
