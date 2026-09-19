import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function clearRuns() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    port: 3306
  });
  try {
    await pool.query('DELETE FROM payroll_deductions');
    await pool.query('DELETE FROM payroll_allowances');
    const [res]: any = await pool.query('DELETE FROM payroll_runs');
    try {
      await pool.query('DELETE FROM payroll_journal_entries');
    } catch (_) {}
    await pool.query(`
      UPDATE payroll_periods SET 
        total_gross_pay = 0,
        total_net_pay = 0,
        total_tax = 0,
        total_nhif = 0,
        total_nssf = 0,
        total_housing_levy = 0,
        total_sacco_welfare = 0,
        status = 'open'
    `);
    console.log('SUCCESS: Cleared all payroll runs. Deleted runs count:', res.affectedRows);
  } catch (err) {
    console.error('ERROR in clearRuns:', err);
  } finally {
    await pool.end();
  }
}

clearRuns();
