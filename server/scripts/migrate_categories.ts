import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
  });

  try {
    console.log('Starting migration...');

    // 1. Run the base SQL
    const sqlPath = path.join(process.cwd(), 'database', 'migrations', '005_add_account_categories.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and run separately because mysql2 doesn't like multiple statements by default
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log('Schema updated.');

    // 2. Define categories to seed
    const categories = [
      // Assets
      { name: 'Current Assets', type: 'asset', desc: 'Cash, AR, Inventory' },
      { name: 'Fixed Assets', type: 'asset', desc: 'Laptops, Furniture, Equipment' },
      { name: 'Intangible Assets', type: 'asset', desc: 'Software, Patents' },
      
      // Liabilities
      { name: 'Current Liabilities', type: 'liability', desc: 'Accounts Payable, Accruals' },
      { name: 'Long-term Liabilities', type: 'liability', desc: 'Loans' },
      
      // Revenue
      { name: 'Sales Revenue', type: 'revenue', desc: 'Primary sales' },
      { name: 'Other Income', type: 'revenue', desc: 'Secondary income' },
      
      // Expenses
      { name: 'Operating Expenses', type: 'expense', desc: 'Rent, Utilities, Supplies' },
      { name: 'Cost of Goods Sold', type: 'expense', desc: 'Direct cost of inventory' },
      
      // KENYA PAYROLL SPECIFIC
      { name: 'Gross Salary/Basic Pay', type: 'expense', desc: 'Monthly basic pay and gross salaries' },
      { name: 'PAYE (Income Tax)', type: 'liability', desc: 'KRA Pay As You Earn' },
      { name: 'NSSF Contributions', type: 'liability', desc: 'National Social Security Fund' },
      { name: 'NHIF/SHIF Contributions', type: 'liability', desc: 'Social Health Insurance Fund' },
      { name: 'Housing Levy', type: 'liability', desc: 'Affordable Housing Levy (1.5%)' },
      { name: 'Payroll Allowances', type: 'expense', desc: 'House, Transport, and other allowances' },
      { name: 'Payroll Deductions', type: 'liability', desc: 'Other payroll-related deductions' },
    ];

    console.log('Seeding categories...');
    const categoryMap = new Map(); // name -> id

    for (const cat of categories) {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO account_categories (id, name, account_type, description) VALUES (?, ?, ?, ?)',
        [id, cat.name, cat.type, cat.desc]
      );
      categoryMap.set(cat.name, id);
    }

    // 3. Migrate existing accounts based on account_subtype
    console.log('Migrating existing accounts...');
    const [accounts]: any = await pool.query('SELECT id, account_type, account_subtype FROM accounts');

    for (const acc of accounts) {
      let categoryId = null;
      
      if (acc.account_subtype) {
        // Try to find a matching category by name (case insensitive)
        const matchedId = Array.from(categoryMap.entries()).find(
          ([name]) => name.toLowerCase() === acc.account_subtype.toLowerCase()
        )?.[1];
        
        if (matchedId) {
          categoryId = matchedId;
        } else {
          // Fallback to a generic one based on type
          if (acc.account_type === 'expense') categoryId = categoryMap.get('Operating Expenses');
          else if (acc.account_type === 'asset') categoryId = categoryMap.get('Current Assets');
          else if (acc.account_type === 'liability') categoryId = categoryMap.get('Current Liabilities');
          else if (acc.account_type === 'revenue') categoryId = categoryMap.get('Sales Revenue');
        }
      } else {
        // No subtype, assign generic based on type
        if (acc.account_type === 'expense') categoryId = categoryMap.get('Operating Expenses');
        else if (acc.account_type === 'asset') categoryId = categoryMap.get('Current Assets');
        else if (acc.account_type === 'liability') categoryId = categoryMap.get('Current Liabilities');
        else if (acc.account_type === 'revenue') categoryId = categoryMap.get('Sales Revenue');
      }

      if (categoryId) {
        await pool.query('UPDATE accounts SET category_id = ? WHERE id = ?', [categoryId, acc.id]);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
