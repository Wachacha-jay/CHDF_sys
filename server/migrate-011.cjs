const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
  });
  console.log('Connected to:', process.env.DB_NAME);

  const stmts = [
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'5210','Payroll Expense','expense',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'2121','PAYE Payable','liability',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'2122','NSSF Payable','liability',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'2123','NHIF/SHIF Payable','liability',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'2124','Housing Levy Payable','liability',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'2125','Net Salary Payable','liability',1)",
    "INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES (UUID(),'1111','Bank / Mpesa','asset',1)",
    "ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS journal_entry_id CHAR(36) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(12,2) DEFAULT 0",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS nhif_number VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_pin VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_method ENUM('bank','cash','mpesa') DEFAULT 'bank'",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_gross_pay DECIMAL(14,2) DEFAULT 0",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_net_pay DECIMAL(14,2) DEFAULT 0",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_tax DECIMAL(14,2) DEFAULT 0",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_nhif DECIMAL(14,2) DEFAULT 0",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_nssf DECIMAL(14,2) DEFAULT 0",
    "ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_housing_levy DECIMAL(14,2) DEFAULT 0",
  ];

  let ok = 0, skip = 0;
  for (const stmt of stmts) {
    try {
      await conn.query(stmt);
      console.log('  OK :', stmt.substring(0, 75));
      ok++;
    } catch (e) {
      console.log(' SKIP:', e.message.substring(0, 100));
      skip++;
    }
  }

  await conn.end();
  console.log('\nMigration complete —', ok, 'OK,', skip, 'skipped');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
