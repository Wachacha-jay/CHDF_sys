import pool from '../config/db';

async function migrate() {
  try {
    console.log('Adding housing_levy columns...');
    
    try { await pool.query('ALTER TABLE payroll_settings ADD COLUMN housing_levy_rate DECIMAL(10,2) DEFAULT 1.5;'); } catch(e) { console.log('payroll_settings', e.message); }
    try { await pool.query('ALTER TABLE payroll_periods ADD COLUMN total_housing_levy DECIMAL(10,2) DEFAULT 0;'); } catch(e) { console.log('payroll_periods', e.message); }
    try { await pool.query('ALTER TABLE payroll_runs ADD COLUMN housing_levy_deduction DECIMAL(10,2) DEFAULT 0;'); } catch(e) { console.log('payroll_runs', e.message); }

    // Let's also check designations table for is_active column
    console.log('Checking designations is_active...');
    try { await pool.query('ALTER TABLE designations ADD COLUMN is_active TINYINT(1) DEFAULT 1;'); } catch(e) { console.log('designations', e.message); }
    
    console.log('Done altering tables.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

migrate();
