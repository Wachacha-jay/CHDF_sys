import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Valid tables to allow generic CRUD access
const VALID_TABLES = [
  'products', 'categories', 'customers', 'suppliers', 'employees', 
  'sales', 'purchases', 'expenses', 'inventory', 'account_categories', 
  'accounts', 'roles', 'permissions', 'designations', 'units_of_measure', 'users',
  'business_settings', 'payroll_settings', 'payroll_periods', 'payroll_runs',
  'payroll_deductions', 'payroll_allowances', 'payroll_reports', 'payroll_journal_entries',
  'bank_reconciliations', 'journal_entries', 'journal_entry_lines',
  // NGO / Fund Accounting tables
  'departments', 'children', 'guardians', 'donors', 'sponsors', 'donor_clusters',
  'fund_accounts', 'donations', 'donation_items', 'sponsorships', 'internal_transfers', 'audit_logs',
  'fixed_assets', 'school_fee_payments', 'school_fee_structures'
];

// Self-healing schema for in-kind donations & distribution
let inKindSchemaEnsured = false;
async function ensureInKindSchema() {
  if (inKindSchemaEnsured) return;
  try {
    // 1. Ensure accounts exist
    await pool.query(`
      INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
        (UUID(), '1135', 'In-Kind Inventory', 'asset', 1),
        (UUID(), '1210', 'Fixed Assets - Equipment & Machinery', 'asset', 1),
        (UUID(), '1220', 'Fixed Assets - Furniture & Fixtures', 'asset', 1),
        (UUID(), '1230', 'Fixed Assets - Buildings & Infrastructure', 'asset', 1),
        (UUID(), '4260', 'In-Kind Donations', 'revenue', 1),
        (UUID(), '5335', 'Food & Consumables Distribution Expense', 'expense', 1)
    `);

    // 2. Ensure products.is_in_kind
    const [prodCols]: any = await pool.query('SHOW COLUMNS FROM products');
    const prodColNames = new Set(prodCols.map((c: any) => c.Field));
    if (!prodColNames.has('is_in_kind')) {
      await pool.query('ALTER TABLE products ADD COLUMN is_in_kind TINYINT(1) NOT NULL DEFAULT 0');
    }

    // 3. Ensure donations.is_in_kind & total_fair_market_value
    const [donCols]: any = await pool.query('SHOW COLUMNS FROM donations');
    const donColNames = new Set(donCols.map((c: any) => c.Field));
    if (!donColNames.has('is_in_kind')) {
      await pool.query('ALTER TABLE donations ADD COLUMN is_in_kind TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!donColNames.has('total_fair_market_value')) {
      await pool.query('ALTER TABLE donations ADD COLUMN total_fair_market_value DECIMAL(12,4) DEFAULT 0');
    }
    if (!donColNames.has('department_id')) {
      await pool.query('ALTER TABLE donations ADD COLUMN department_id CHAR(36) NULL');
    }

    // 4. Ensure sales table distribution columns & sale_type VARCHAR(50)
    const [saleCols]: any = await pool.query('SHOW COLUMNS FROM sales');
    const saleColNames = new Set(saleCols.map((c: any) => c.Field));
    if (!saleColNames.has('expense_account_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN expense_account_id CHAR(36) NULL');
    }
    if (!saleColNames.has('department_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN department_id CHAR(36) NULL');
    }
    if (!saleColNames.has('child_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN child_id CHAR(36) NULL');
    }
    if (!saleColNames.has('sale_type')) {
      await pool.query("ALTER TABLE sales ADD COLUMN sale_type VARCHAR(50) DEFAULT 'standard'");
    } else {
      try {
        await pool.query("ALTER TABLE sales MODIFY COLUMN sale_type VARCHAR(50) DEFAULT 'standard'");
      } catch (_) {}
    }

    // 5. Ensure business_settings logo_url and favicon_url are LONGTEXT for data/image URLs, and tax_rate / wht_rate exist
    try {
      await pool.query('ALTER TABLE business_settings MODIFY COLUMN logo_url LONGTEXT');
      await pool.query('ALTER TABLE business_settings MODIFY COLUMN favicon_url LONGTEXT');
      const [bsCols]: any = await pool.query('SHOW COLUMNS FROM business_settings');
      const bsColNames = new Set(bsCols.map((c: any) => c.Field));
      if (bsColNames.has('tax_rate')) {
        await pool.query('ALTER TABLE business_settings MODIFY COLUMN tax_rate DECIMAL(8,4) DEFAULT 0.0000');
      }
      if (!bsColNames.has('wht_rate')) {
        await pool.query('ALTER TABLE business_settings ADD COLUMN wht_rate DECIMAL(8,4) DEFAULT 0.0000');
      }
    } catch (err) {
      // Ignore if already adjusted
    }

    // 6. Ensure donation_items table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donation_items (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        donation_id CHAR(36) NOT NULL,
        item_description VARCHAR(255) NOT NULL,
        asset_class ENUM('consumable', 'fixed_asset', 'construction') NOT NULL,
        fair_market_value DECIMAL(12,4) NOT NULL DEFAULT 0,
        quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
        unit_of_measure VARCHAR(50) DEFAULT 'units',
        product_id CHAR(36) NULL,
        department_id CHAR(36) NULL,
        fixed_asset_id CHAR(36) NULL,
        project_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_donation_id (donation_id),
        INDEX idx_product_id (product_id),
        INDEX idx_dept_id (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. Ensure units_of_measure table exists (used by ProductForm unit dropdown)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units_of_measure (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [uomRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM units_of_measure');
    if (uomRows[0]?.cnt === 0) {
      await pool.query(`
        INSERT INTO units_of_measure (id, name, symbol) VALUES
          (UUID(), 'Pieces', 'pcs'),
          (UUID(), 'Kilograms', 'kg'),
          (UUID(), 'Grams', 'g'),
          (UUID(), 'Litres', 'L'),
          (UUID(), 'Millilitres', 'mL'),
          (UUID(), 'Metres', 'm'),
          (UUID(), 'Boxes', 'box'),
          (UUID(), 'Cartons', 'ctn'),
          (UUID(), 'Bags', 'bag'),
          (UUID(), 'Pairs', 'pair'),
          (UUID(), 'Sets', 'set'),
          (UUID(), 'Units', 'unit')
      `);
    }

    // 8. Ensure inter-departmental clearing and equity grant accounts exist
    await pool.query(`
      INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
        (UUID(), '1300', 'Inter-departmental Receivables', 'asset', 1),
        (UUID(), '2300', 'Inter-departmental Payables', 'liability', 1),
        (UUID(), '3810', 'Inter-departmental Grants Out (Equity)', 'equity', 1),
        (UUID(), '3820', 'Inter-departmental Grants In (Equity)', 'equity', 1),
        (UUID(), '4900', 'Internal Transfer In (Revenue)', 'revenue', 1),
        (UUID(), '5900', 'Internal Transfer Out (Expense)', 'expense', 1)
    `);

    // 9. Ensure internal_transfers columns (transfer_type, from_bank_account_id, to_bank_account_id)
    try {
      const [itCols]: any = await pool.query('SHOW COLUMNS FROM internal_transfers');
      const itColNames = new Set(itCols.map((c: any) => c.Field));
      if (!itColNames.has('transfer_type')) {
        await pool.query("ALTER TABLE internal_transfers ADD COLUMN transfer_type ENUM('direct_transfer', 'internal_loan', 'loan_repayment', 'grant_transfer') DEFAULT 'internal_loan'");
      } else {
        await pool.query("ALTER TABLE internal_transfers MODIFY COLUMN transfer_type ENUM('direct_transfer', 'internal_loan', 'loan_repayment', 'grant_transfer') DEFAULT 'internal_loan'");
      }
      if (!itColNames.has('from_bank_account_id')) {
        await pool.query('ALTER TABLE internal_transfers ADD COLUMN from_bank_account_id CHAR(36) NULL');
      }
      if (!itColNames.has('to_bank_account_id')) {
        await pool.query('ALTER TABLE internal_transfers ADD COLUMN to_bank_account_id CHAR(36) NULL');
      }
    } catch (itErr) {
      console.warn('Could not inspect or alter internal_transfers table:', itErr);
    }

    // 10. Ensure suppliers & purchases procurement columns
    try {
      await pool.query(`
        INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
          (UUID(), '2150', 'Withholding Tax (WHT) Payable', 'liability', 1),
          (UUID(), '1140', 'VAT Input Tax', 'asset', 1)
      `);

      const [suppCols]: any = await pool.query('SHOW COLUMNS FROM suppliers');
      const suppColNames = new Set(suppCols.map((c: any) => c.Field));
      if (!suppColNames.has('department_id')) {
        await pool.query('ALTER TABLE suppliers ADD COLUMN department_id CHAR(36) NULL');
      }
      if (!suppColNames.has('expense_account_id')) {
        await pool.query('ALTER TABLE suppliers ADD COLUMN expense_account_id CHAR(36) NULL');
      }
      if (!suppColNames.has('service_ids')) {
        await pool.query('ALTER TABLE suppliers ADD COLUMN service_ids JSON NULL');
      }
      if (!suppColNames.has('withholding_tax_rate')) {
        await pool.query('ALTER TABLE suppliers ADD COLUMN withholding_tax_rate DECIMAL(5,2) DEFAULT 0.00');
      }

      const [purchCols]: any = await pool.query('SHOW COLUMNS FROM purchases');
      const purchColNames = new Set(purchCols.map((c: any) => c.Field));
      if (!purchColNames.has('department_id')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN department_id CHAR(36) NULL');
      }
      if (!purchColNames.has('expense_account_id')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN expense_account_id CHAR(36) NULL');
      }
      if (!purchColNames.has('vat_rate')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 0.00');
      }
      if (!purchColNames.has('wht_rate')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN wht_rate DECIMAL(5,2) DEFAULT 0.00');
      }
      if (!purchColNames.has('wht_amount')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN wht_amount DECIMAL(12,4) DEFAULT 0.00');
      }
    } catch (procureErr) {
      console.warn('Could not inspect or alter suppliers/purchases procurement columns:', procureErr);
    }

    // 11. Ensure School Fee Management schema & historical data cleanup
    try {
      // a. Ensure 'Empower Hearts Special School' department
      let deptId: string | null = null;
      const [empowerDepts]: any = await pool.query("SELECT id, name FROM departments WHERE LOWER(name) LIKE '%empower%'");
      if (empowerDepts && empowerDepts.length > 0) {
        deptId = empowerDepts[0].id;
        await pool.query("UPDATE departments SET name = 'Empower Hearts Special School' WHERE id = ?", [deptId]);
      } else {
        deptId = crypto.randomUUID();
        await pool.query(`
          INSERT INTO departments (id, name, description, is_active)
          VALUES (?, 'Empower Hearts Special School', 'Empower Hearts Special School Educational Operations & Programs', 1)
        `, [deptId]);
      }

      // b. Ensure 'Equity Bank' account (Asset, code 1112)
      let equityBankId: string | null = null;
      const [equityAccs]: any = await pool.query("SELECT id, code, name FROM accounts WHERE LOWER(name) LIKE '%equity%' OR code = '1112'");
      if (equityAccs && equityAccs.length > 0) {
        equityBankId = equityAccs[0].id;
        await pool.query("UPDATE accounts SET name = 'Equity Bank', account_type = 'asset', code = '1112' WHERE id = ?", [equityBankId]);
      } else {
        equityBankId = crypto.randomUUID();
        await pool.query(`
          INSERT INTO accounts (id, code, name, account_type, is_system)
          VALUES (?, '1112', 'Equity Bank', 'asset', 1)
        `, [equityBankId]);
      }

      // c. Ensure 'School Fees Revenue' account (Revenue, code 4300)
      let feeRevId: string | null = null;
      const [feeRevAccs]: any = await pool.query("SELECT id, code, name FROM accounts WHERE code = '4300' OR LOWER(name) LIKE '%school fee%'");
      if (feeRevAccs && feeRevAccs.length > 0) {
        feeRevId = feeRevAccs[0].id;
        await pool.query("UPDATE accounts SET name = 'School Fees Revenue', account_type = 'revenue', code = '4300' WHERE id = ?", [feeRevId]);
      } else {
        feeRevId = crypto.randomUUID();
        await pool.query(`
          INSERT INTO accounts (id, code, name, account_type, is_system)
          VALUES (?, '4300', 'School Fees Revenue', 'revenue', 1)
        `, [feeRevId]);
      }

      // d. Ensure children table has expected fee columns
      const [childCols]: any = await pool.query('SHOW COLUMNS FROM children');
      const childColNames = new Set(childCols.map((c: any) => c.Field));
      if (!childColNames.has('expected_term_fee')) {
        await pool.query('ALTER TABLE children ADD COLUMN expected_term_fee DECIMAL(12,2) DEFAULT 0.00');
      }
      if (!childColNames.has('expected_annual_fee')) {
        await pool.query('ALTER TABLE children ADD COLUMN expected_annual_fee DECIMAL(12,2) DEFAULT 0.00');
      }

      // e. Ensure school_fee_structures table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS school_fee_structures (
          id CHAR(36) PRIMARY KEY,
          academic_year INT NOT NULL,
          term VARCHAR(20) NOT NULL,
          class_name VARCHAR(100) NULL,
          amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          description VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sfs_year_term (academic_year, term)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Seed default 3 terms for current year if empty
      const [sfsCount]: any = await pool.query('SELECT COUNT(*) as cnt FROM school_fee_structures');
      if (sfsCount[0]?.cnt === 0) {
        const currentYear = new Date().getFullYear();
        await pool.query(`
          INSERT INTO school_fee_structures (id, academic_year, term, class_name, amount, description) VALUES
            (UUID(), ?, 'Term 1', 'All', 15000.00, 'Term 1 Standard Expected Fee'),
            (UUID(), ?, 'Term 2', 'All', 15000.00, 'Term 2 Standard Expected Fee'),
            (UUID(), ?, 'Term 3', 'All', 15000.00, 'Term 3 Standard Expected Fee')
        `, [currentYear, currentYear, currentYear]);
      }

      // f. Ensure school_fee_payments table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS school_fee_payments (
          id CHAR(36) PRIMARY KEY,
          receipt_number VARCHAR(50) NOT NULL,
          child_id CHAR(36) NOT NULL,
          academic_year INT NOT NULL,
          term VARCHAR(20) NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          payment_date DATE NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'mpesa',
          reference_number VARCHAR(100) NULL,
          bank_account_id CHAR(36) NULL,
          department_id CHAR(36) NULL,
          fund_id CHAR(36) NULL,
          journal_entry_id CHAR(36) NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sfp_child (child_id),
          INDEX idx_sfp_year_term (academic_year, term)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // g. Historical Fee Data Cleanup & Migration for pre-existing payments
      const [feeEntries]: any = await pool.query(`
        SELECT DISTINCT je.*
        FROM journal_entries je
        LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
        LEFT JOIN accounts a ON jel.account_id = a.id
        WHERE LOWER(je.description) LIKE '%school fee%'
           OR LOWER(je.description) LIKE '%tuition%'
           OR a.code IN ('4300', '5310', '5350')
           OR (jel.child_id IS NOT NULL AND (a.account_type IN ('revenue', 'expense') OR a.code LIKE '4%' OR a.code LIKE '5%'))
      `);

      if (feeEntries && feeEntries.length > 0 && deptId && equityBankId && feeRevId) {
        const [children]: any = await pool.query('SELECT * FROM children');
        const childMap = new Map(children.map((c: any) => [c.id, c]));

        for (const entry of feeEntries) {
          const [lines]: any = await pool.query(
            'SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?',
            [entry.id]
          );

          let childId = lines.find((l: any) => l.child_id)?.child_id;
          let matchedChild = childId ? childMap.get(childId) : null;

          if (!matchedChild) {
            for (const c of children) {
              const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
              if (entry.description.toLowerCase().includes(fullName) || (c.code && entry.description.toLowerCase().includes(c.code.toLowerCase()))) {
                childId = c.id;
                matchedChild = c;
                break;
              }
            }
          }

          if (!childId && children.length > 0) {
            childId = children[0].id;
            matchedChild = children[0];
          }

          const studentName = matchedChild ? `${matchedChild.first_name} ${matchedChild.last_name}` : 'Student';
          const studentCode = matchedChild ? matchedChild.code : '';
          const amount = Number(entry.total_debit || entry.total_credit || 0);
          const entryYear = entry.entry_date ? new Date(entry.entry_date).getFullYear() : 2026;

          let ref = entry.reference || '';
          const mpesaMatch = entry.description.match(/([A-Z0-9]{8,12})/);
          if (!ref && mpesaMatch) ref = mpesaMatch[1];
          const receiptNo = entry.entry_number || `RCP-${Date.now().toString().slice(-6)}`;

          // Re-create lines: Debit Equity Bank, Credit School Fees Revenue, tagged with child and department
          await pool.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [entry.id]);

          const debitLineId = crypto.randomUUID();
          const creditLineId = crypto.randomUUID();

          await pool.query(`
            INSERT INTO journal_entry_lines 
              (id, journal_entry_id, account_id, description, debit_amount, credit_amount, department_id, child_id)
            VALUES 
              (?, ?, ?, ?, ?, 0, ?, ?),
              (?, ?, ?, ?, 0, ?, ?, ?)
          `, [
            debitLineId,
            entry.id,
            equityBankId,
            `School fee payment received into Equity Bank for ${studentName} (${studentCode}) - Term 2`,
            amount,
            deptId,
            childId,

            creditLineId,
            entry.id,
            feeRevId,
            `School fee revenue recognized for ${studentName} (${studentCode}) - Term 2`,
            amount,
            deptId,
            childId
          ]);

          const updatedDescription = `School Fee Payment (Guardian Inflow) - Term 2 ${entryYear}: ${studentName} (${studentCode}) - ${ref || receiptNo}`;
          await pool.query(`
            UPDATE journal_entries
            SET description = ?, is_posted = 1, total_debit = ?, total_credit = ?
            WHERE id = ?
          `, [updatedDescription, amount, amount, entry.id]);

          // Seed/Update school_fee_payments table
          const [existingSfp]: any = await pool.query(
            'SELECT id FROM school_fee_payments WHERE journal_entry_id = ? OR (child_id = ? AND payment_date = ? AND amount = ?)',
            [entry.id, childId, entry.entry_date, amount]
          );

          if (existingSfp && existingSfp.length > 0) {
            await pool.query(`
              UPDATE school_fee_payments
              SET bank_account_id = ?,
                  department_id = ?,
                  academic_year = ?,
                  term = 'Term 2',
                  amount = ?,
                  child_id = ?,
                  journal_entry_id = ?
              WHERE id = ?
            `, [equityBankId, deptId, entryYear, amount, childId, entry.id, existingSfp[0].id]);
          } else {
            const sfpId = crypto.randomUUID();
            await pool.query(`
              INSERT INTO school_fee_payments 
                (id, receipt_number, child_id, academic_year, term, amount, payment_date, payment_method, reference_number, bank_account_id, department_id, journal_entry_id, notes)
              VALUES 
                (?, ?, ?, ?, 'Term 2', ?, ?, 'mpesa', ?, ?, ?, ?, ?)
            `, [
              sfpId,
              receiptNo,
              childId,
              entryYear,
              amount,
              entry.entry_date,
              ref,
              equityBankId,
              deptId,
              entry.id,
              updatedDescription
            ]);
          }
        }
      }

      // Ensure all rows in school_fee_payments are linked to Empower Hearts Special School, Equity Bank, and Term 2
      if (deptId && equityBankId) {
        await pool.query(`
          UPDATE school_fee_payments
          SET department_id = ?,
              bank_account_id = ?,
              term = 'Term 2'
          WHERE department_id IS NULL OR bank_account_id IS NULL OR term != 'Term 2'
        `, [deptId, equityBankId]);
      }
    } catch (feeSchemaErr) {
      console.warn('Could not inspect or initialize school fee schema:', feeSchemaErr);
    }

    inKindSchemaEnsured = true;
  } catch (err) {
    console.error('ensureInKindSchema check encountered an issue (non-fatal):', err);
  }
}

// Attach ensureInKindSchema middleware to router
router.use(async (_req, _res, next) => {
  await ensureInKindSchema();
  next();
});

async function logCrudActivity(req: any, action: string, table: any, entityId: any, entityLabel?: string) {
  try {
    const user = req.user;
    const userName = user?.name || user?.email || 'System';
    const auditId = crypto.randomUUID();
    const strTable = String(table || '');
    const moduleName = strTable.charAt(0).toUpperCase() + strTable.slice(1).replace(/_/g, ' ');
    await pool.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [auditId, user?.id || null, userName, action, moduleName, entityId ? String(entityId) : null, entityLabel || `${action} ${moduleName}`, req.ip || '']
    );
  } catch (_) {}
}

// GET list
router.get('/:table', authenticate, async (req, res): Promise<void> => {
  const { table } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const { limit, offset, orderBy, orderDir, ...filters } = req.query;
    
    let query = `SELECT * FROM ${table}`;
    const queryParams: any[] = [];
    const filterKeys = Object.keys(filters);
    
    if (filterKeys.length > 0) {
      query += ' WHERE ';
      const conditions = filterKeys.map(key => {
        let val = filters[key];
        
        if (val === 'null') {
          return `${key} IS NULL`;
        }

        // Handle >= and <= filters
        let operator = '=';
        let column = key;
        
        if (key.endsWith('_gte')) {
          operator = '>=';
          column = key.replace('_gte', '');
        } else if (key.endsWith('_lte')) {
          operator = '<=';
          column = key.replace('_lte', '');
        } else if (key.endsWith('_neq')) {
          operator = '!=';
          column = key.replace('_neq', '');
        }

        // Convert query string booleans to MySQL TinyInt 1 or 0
        if (val === 'true') val = 1;
        if (val === 'false') val = 0;
        
        queryParams.push(val);
        return `${column} ${operator} ?`;
      });
      query += conditions.join(' AND ');
    }

    if (orderBy) {
      const dir = orderDir === 'ASC' ? 'ASC' : 'DESC';
      const sortBy = typeof orderBy === 'string' ? orderBy.replace(/[^a-zA-Z0-9_]/g, '') : 'id';
      query += ` ORDER BY ${sortBy} ${dir}`;
    }

    if (limit) {
      query += ' LIMIT ?';
      queryParams.push(Number(limit));
    }

    if (offset) {
      query += ' OFFSET ?';
      queryParams.push(Number(offset));
    }

    const [rows]: any = await pool.query(query, queryParams);
    
    // Handle special joins for list views if table is sales or purchases
    if (table === 'sales') {
        for (let row of rows) {
            const [customers]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [row.customer_id]);
            row.customer = customers[0] || null;
            try {
                const [itemStats]: any = await pool.query(
                    'SELECT COUNT(*) as items_count, COALESCE(SUM(quantity), 0) as total_quantity FROM sale_items WHERE sale_id = ?',
                    [row.id]
                );
                row.items_count = Number(itemStats[0]?.items_count || 0);
                row.total_quantity = Number(itemStats[0]?.total_quantity || 0);
            } catch (_) {
                row.items_count = 0;
                row.total_quantity = 0;
            }
        }
    } else if (table === 'purchases') {
        for (let row of rows) {
            const [suppliers]: any = await pool.query('SELECT * FROM suppliers WHERE id = ?', [row.supplier_id]);
            row.supplier = suppliers[0] || null;
            if (row.department_id) {
                const [depts]: any = await pool.query('SELECT id, name FROM departments WHERE id = ?', [row.department_id]);
                row.department = depts[0] || null;
            }
            if (row.expense_account_id) {
                const [accs]: any = await pool.query('SELECT id, code, name FROM accounts WHERE id = ?', [row.expense_account_id]);
                row.expense_account = accs[0] || null;
            }
        }
    } else if (table === 'suppliers') {
        for (let row of rows) {
            if (row.service_ids) {
                try {
                    row.service_ids = typeof row.service_ids === 'string' ? JSON.parse(row.service_ids) : row.service_ids;
                } catch (_) {
                    row.service_ids = [];
                }
            } else {
                row.service_ids = [];
            }
            if (row.department_id) {
                const [depts]: any = await pool.query('SELECT id, name FROM departments WHERE id = ?', [row.department_id]);
                row.department = depts[0] || null;
            }
            if (row.expense_account_id) {
                const [accs]: any = await pool.query('SELECT id, code, name FROM accounts WHERE id = ?', [row.expense_account_id]);
                row.expense_account = accs[0] || null;
            }
        }
    } else if (table === 'users') {
        for (let row of rows) {
            delete row.password_hash;
            row.name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || row.email;
        }
    } else if (table === 'school_fee_payments') {
        for (let row of rows) {
            if (row.child_id) {
                const [chRows]: any = await pool.query('SELECT id, code, first_name, last_name, class_name, guardian_id FROM children WHERE id = ?', [row.child_id]);
                if (chRows && chRows[0]) {
                    const child = chRows[0];
                    if (child.guardian_id) {
                        const [gRows]: any = await pool.query('SELECT id, name, relationship, phone FROM guardians WHERE id = ?', [child.guardian_id]);
                        child.guardian = gRows[0] || null;
                    }
                    row.child = child;
                }
            }
            if (row.bank_account_id) {
                const [accs]: any = await pool.query('SELECT id, code, name FROM accounts WHERE id = ?', [row.bank_account_id]);
                row.bank_account = accs[0] || null;
            }
            if (row.department_id) {
                const [depts]: any = await pool.query('SELECT id, name FROM departments WHERE id = ?', [row.department_id]);
                row.department = depts[0] || null;
            }
            if (row.fund_id) {
                const [funds]: any = await pool.query('SELECT id, name, code FROM fund_accounts WHERE id = ?', [row.fund_id]);
                row.fund = funds[0] || null;
            }
        }
    } else if (table === 'children') {
        for (let row of rows) {
            if (row.guardian_id) {
                const [gRows]: any = await pool.query('SELECT id, name, relationship, phone FROM guardians WHERE id = ?', [row.guardian_id]);
                row.guardian = gRows[0] || null;
            }
        }
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET by id
router.get('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const result = rows[0];

    // Handle special joins for detail views
    if (table === 'sales') {
        const [customers]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [result.customer_id]);
        result.customer = customers[0] || null;
        
        const [items]: any = await pool.query(`
            SELECT si.*, p.name as product_name, p.description as product_description 
            FROM sale_items si 
            LEFT JOIN products p ON si.product_id = p.id 
            WHERE si.sale_id = ?
        `, [id]);
        
        // Map backend flat names to nested product object for frontend compatibility
        result.items = items.map((item: any) => ({
            ...item,
            product: {
                id: item.product_id,
                name: item.product_name,
                description: item.product_description
            }
        }));
    } else if (table === 'purchases') {
        const [suppliers]: any = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.supplier_id]);
        result.supplier = suppliers[0] || null;
        
        const [items]: any = await pool.query(`
            SELECT pi.*, p.name as product_name, p.description as product_description 
            FROM purchase_items pi 
            LEFT JOIN products p ON pi.product_id = p.id 
            WHERE pi.purchase_id = ?
        `, [id]);
        
        result.items = items.map((item: any) => ({
            ...item,
            product: {
                id: item.product_id,
                name: item.product_name,
                description: item.product_description
            }
        }));
        if (result.department_id) {
            const [depts]: any = await pool.query('SELECT id, name FROM departments WHERE id = ?', [result.department_id]);
            result.department = depts[0] || null;
        }
        if (result.expense_account_id) {
            const [accs]: any = await pool.query('SELECT id, code, name FROM accounts WHERE id = ?', [result.expense_account_id]);
            result.expense_account = accs[0] || null;
        }
    } else if (table === 'suppliers' && result) {
        if (result.service_ids) {
            try {
                result.service_ids = typeof result.service_ids === 'string' ? JSON.parse(result.service_ids) : result.service_ids;
            } catch (_) {
                result.service_ids = [];
            }
        } else {
            result.service_ids = [];
        }
        if (result.department_id) {
            const [depts]: any = await pool.query('SELECT id, name FROM departments WHERE id = ?', [result.department_id]);
            result.department = depts[0] || null;
        }
        if (result.expense_account_id) {
            const [accs]: any = await pool.query('SELECT id, code, name FROM accounts WHERE id = ?', [result.expense_account_id]);
            result.expense_account = accs[0] || null;
        }
    } else if (table === 'users' && result) {
        delete result.password_hash;
        result.name = [result.first_name, result.last_name].filter(Boolean).join(' ') || result.username || result.email;
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST
router.post('/:table', authenticate, async (req, res): Promise<void> => {
  const { table } = req.params;
  // Let generic logic allow transaction child tables if passed directly
  // Note: we might want to let sale_items, purchase_items, inventory_movements through too
  const EXTENDED_TABLES = [...VALID_TABLES, 'sale_items', 'purchase_items', 'inventory_movements', 'journal_entries', 'journal_entry_lines'];
  if (!EXTENDED_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);

    // Handle ID generation
    let newId = req.body.id;
    if (!newId) {
        newId = crypto.randomUUID();
        keys.push('id');
        values.push(newId);
    } else {
        // ID provided, ensure it's in the keys/values if not already
        if (!keys.includes('id')) {
            keys.push('id');
            values.push(newId);
        }
    }

    // Auto-generate missing transaction numbers
    if (table === 'sales' && !keys.includes('sale_number')) {
      keys.push('sale_number');
      values.push(`SAL${Date.now()}${Math.floor(Math.random() * 1000)}`);
    } else if (table === 'purchases' && !keys.includes('purchase_number')) {
      keys.push('purchase_number');
      values.push(`PUR${Date.now()}${Math.floor(Math.random() * 1000)}`);
    } else if (table === 'expenses' && !keys.includes('expense_number')) {
      keys.push('expense_number');
      values.push(`EXP${Date.now()}${Math.floor(Math.random() * 1000)}`);
    } else if (table === 'school_fee_payments' && !keys.includes('receipt_number')) {
      keys.push('receipt_number');
      values.push(`RCP-${Date.now().toString().slice(-6)}`);
    }

    // Product-specific sanitization
    if (table === 'products') {
      // Remove unit_id — it's a form-only field; products table stores unit_of_measure (string)
      const unitIdIdx = keys.indexOf('unit_id');
      if (unitIdIdx !== -1) {
        keys.splice(unitIdIdx, 1);
        (values as any[]).splice(unitIdIdx, 1);
      }
      // Auto-generate product code if missing or empty
      const codeIdx = keys.indexOf('code');
      const codeVal = codeIdx !== -1 ? values[codeIdx] : undefined;
      if (!codeVal || String(codeVal).trim() === '') {
        const shortId = newId.replace(/-/g, '').substring(0, 8).toUpperCase();
        const generatedCode = `PRD-${shortId}`;
        if (codeIdx !== -1) {
          (values as any[])[codeIdx] = generatedCode;
        } else {
          keys.push('code');
          (values as any[]).push(generatedCode);
        }
      }
      // Null out empty barcode/sku to avoid UNIQUE constraint on empty string
      const barcodeIdx = keys.indexOf('barcode');
      if (barcodeIdx !== -1 && (!values[barcodeIdx] || String(values[barcodeIdx]).trim() === '')) {
        (values as any[])[barcodeIdx] = null;
      }
      const skuIdx = keys.indexOf('sku');
      if (skuIdx !== -1 && (!values[skuIdx] || String(values[skuIdx]).trim() === '')) {
        (values as any[])[skuIdx] = null;
      }
    }

    // Special-case: transactional create for journal_entries with lines
    if (table === 'journal_entries' && Array.isArray(req.body.lines)) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        let entryNumber = req.body.entry_number || `JNL${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        // Ensure entry_number is unique in DB before insert
        const [existingNumberRows]: any = await connection.query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber]);
        if (existingNumberRows && existingNumberRows.length > 0) {
          const prefix = `JE${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const [maxRows]: any = await connection.query(`SELECT entry_number FROM journal_entries WHERE entry_number LIKE ? ORDER BY id DESC LIMIT 10`, [`${prefix}%`]);
          let maxSuffix = 0;
          if (maxRows && maxRows.length > 0) {
            for (const r of maxRows) {
              const numPart = parseInt(r.entry_number.replace(prefix, ''), 10);
              if (!isNaN(numPart) && numPart > maxSuffix) maxSuffix = numPart;
            }
          }
          entryNumber = `${prefix}${String(maxSuffix + 1).padStart(4, '0')}`;
          // Final fallback
          const [checkAgain]: any = await connection.query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber]);
          if (checkAgain && checkAgain.length > 0) {
            entryNumber = `${prefix}${Date.now().toString().slice(-6)}`;
          }
        }

        // Build clean insert payload
        const entryPayload: Record<string, any> = {
          id: req.body.id || newId,
          entry_number: entryNumber,
          entry_date: req.body.entry_date || new Date().toISOString().split('T')[0],
          description: req.body.description || 'Journal Entry',
          reference: req.body.reference || null,
          total_debit: req.body.total_debit || 0,
          total_credit: req.body.total_credit || 0,
          is_posted: req.body.is_posted ? 1 : 0
        };

        const entryKeys = Object.keys(entryPayload);
        const entryValues = Object.values(entryPayload).map(v => v === undefined ? null : v);
        const placeholders = entryKeys.map(() => '?').join(', ');
        const insertQuery = `INSERT INTO journal_entries (${entryKeys.join(', ')}) VALUES (${placeholders})`;
        await connection.query(insertQuery, entryValues);

        // Insert lines
        const lines = req.body.lines;
        for (const line of lines) {
          const lineId = line.id || crypto.randomUUID();
          const lineKeys = [
            'id', 'journal_entry_id', 'account_id', 'description', 
            'debit_amount', 'credit_amount', 'department_id', 
            'child_id', 'donor_id', 'fund_id', 'sponsor_id'
          ];
          const lineValues = [
            lineId, entryPayload.id, line.account_id, line.description || null, 
            Number(line.debit_amount || 0), Number(line.credit_amount || 0),
            line.department_id || null, line.child_id || null, 
            line.donor_id || null, line.fund_id || null, line.sponsor_id || null
          ];
          const linePlaceholders = lineKeys.map(() => '?').join(', ');
          const lineQuery = `INSERT INTO journal_entry_lines (${lineKeys.join(', ')}) VALUES (${linePlaceholders})`;
          await connection.query(lineQuery, lineValues);
        }

        await connection.commit();

        const [entryRows]: any = await connection.query(`SELECT * FROM journal_entries WHERE id = ?`, [entryPayload.id]);
        const [linesRows]: any = await connection.query(`SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?`, [entryPayload.id]);

        const result = entryRows[0] || entryPayload;
        result.lines = linesRows || [];

        logCrudActivity(req, 'CREATE', 'journal_entries', entryPayload.id, `Created journal entry ${result.entry_number || entryPayload.id}`);

        res.json({ success: true, data: result });
      } catch (error: any) {
        await connection.rollback();
        console.error(`Error inserting journal entry transactionally:`, error);
        res.status(500).json({ success: false, error: error.message || 'Database error creating journal entry' });
      } finally {
        connection.release();
      }
      return;
    }

    // Special-case: transactional create for purchases with items
    if (table === 'purchases' && Array.isArray(req.body.items)) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        let purchaseNumber = req.body.purchase_number || `PUR${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const purchasePayload: Record<string, any> = {
          id: req.body.id || newId,
          purchase_number: purchaseNumber,
          supplier_id: req.body.supplier_id || null,
          purchase_date: req.body.purchase_date || new Date().toISOString().split('T')[0],
          due_date: req.body.due_date || null,
          subtotal: Number(req.body.subtotal || 0),
          tax_amount: Number(req.body.tax_amount || 0),
          discount_amount: Number(req.body.discount_amount || 0),
          total_amount: Number(req.body.total_amount || 0),
          paid_amount: Number(req.body.paid_amount || 0),
          payment_status: req.body.payment_status || 'pending',
          department_id: req.body.department_id || null,
          expense_account_id: req.body.expense_account_id || null,
          vat_rate: Number(req.body.vat_rate || 0),
          wht_rate: Number(req.body.wht_rate || 0),
          wht_amount: Number(req.body.wht_amount || 0),
          notes: req.body.notes || null,
          created_by: (req as any).user?.id || null
        };

        const pKeys = Object.keys(purchasePayload);
        const pValues = Object.values(purchasePayload).map(v => v === undefined ? null : v);
        const pPlaceholders = pKeys.map(() => '?').join(', ');
        await connection.query(`INSERT INTO purchases (${pKeys.join(', ')}) VALUES (${pPlaceholders})`, pValues);

        // Insert purchase items & update product inventory
        const items = req.body.items;
        for (const item of items) {
          if (!item.product_id) continue;
          const itemId = item.id || crypto.randomUUID();
          const qty = Number(item.quantity || 0);
          const unitCost = Number(item.unit_cost || 0);
          const totalLine = Number(item.total_amount || (qty * unitCost));

          await connection.query(`
            INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, discount_amount, tax_amount, total_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [itemId, purchasePayload.id, item.product_id, qty, unitCost, Number(item.discount_amount || 0), Number(item.tax_amount || 0), totalLine]);

          // Increment product inventory stock ONLY for physical goods (not services)
          await connection.query(`
            UPDATE products 
            SET current_stock = CASE WHEN is_service = 1 THEN current_stock ELSE current_stock + ? END,
                cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END
            WHERE id = ?
          `, [qty, unitCost, unitCost, item.product_id]);

          // Create inventory movement record
          const movementId = crypto.randomUUID();
          await connection.query(`
            INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, description, created_by)
            VALUES (?, ?, 'in', ?, ?, 'purchase', ?, ?, ?)
          `, [movementId, item.product_id, qty, unitCost, purchasePayload.id, `Stock added via purchase ${purchaseNumber}`, (req as any).user?.id || null]);
        }

        await connection.commit();

        const [pRows]: any = await connection.query(`SELECT * FROM purchases WHERE id = ?`, [purchasePayload.id]);
        const [pItemRows]: any = await connection.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchasePayload.id]);
        const result = pRows[0] || purchasePayload;
        result.items = pItemRows || [];

        logCrudActivity(req, 'CREATE', 'purchases', purchasePayload.id, `Created purchase ${purchaseNumber}`);
        res.json({ success: true, data: result });
      } catch (error: any) {
        await connection.rollback();
        console.error('Error inserting purchase transactionally:', error);
        res.status(500).json({ success: false, error: error.message || 'Database error creating purchase' });
      } finally {
        connection.release();
      }
      return;
    }

    // Generic insert for other tables
    if (table === 'journal_entries' && !keys.includes('entry_number')) {
      keys.push('entry_number');
      values.push(`JNL${Date.now()}${Math.floor(Math.random() * 1000)}`);
    }

    // Strip virtual/child relations like 'items' from single-table insert
    const itemsIdx = keys.indexOf('items');
    if (itemsIdx !== -1) {
      keys.splice(itemsIdx, 1);
      (values as any[]).splice(itemsIdx, 1);
    }

    if (table === 'suppliers') {
      const stripCols = ['department', 'expense_account', 'services', 'total_orders', 'total_purchases'];
      stripCols.forEach(col => {
        const idx = keys.indexOf(col);
        if (idx !== -1) {
          keys.splice(idx, 1);
          (values as any[]).splice(idx, 1);
        }
      });
      const sIdx = keys.indexOf('service_ids');
      if (sIdx !== -1 && (Array.isArray(values[sIdx]) || typeof values[sIdx] === 'object')) {
        values[sIdx] = JSON.stringify(values[sIdx]);
      }
      const dIdx = keys.indexOf('department_id');
      if (dIdx !== -1 && values[dIdx] === '') values[dIdx] = null;
      const eIdx = keys.indexOf('expense_account_id');
      if (eIdx !== -1 && values[eIdx] === '') values[eIdx] = null;
    }

    const placeholders = keys.map(() => '?').join(', ');
    const sanitizedValues = values.map(val => (val === '' ? null : val));

    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    await pool.query(query, sanitizedValues);
    
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [newId]);
    const label = rows[0]?.name || rows[0]?.title || rows[0]?.code || rows[0]?.entry_number || (rows[0]?.first_name ? `${rows[0].first_name} ${rows[0].last_name || ''}`.trim() : newId);
    logCrudActivity(req, 'CREATE', table, newId, `Created ${table}: ${label}`);
    
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error(`Error inserting into ${table}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT
router.put('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const updateData = { ...req.body };
    delete updateData.id; // Never update ID column
    // Product-specific: remove unit_id (form-only field, not in products table)
    if (table === 'products') {
      delete updateData.unit_id;
      // Null out empty barcode/sku to avoid UNIQUE constraint on empty string
      if (updateData.barcode !== undefined && (!updateData.barcode || String(updateData.barcode).trim() === '')) {
        updateData.barcode = null;
      }
      if (updateData.sku !== undefined && (!updateData.sku || String(updateData.sku).trim() === '')) {
        updateData.sku = null;
      }
    }

    // Supplier-specific handling
    if (table === 'suppliers') {
      delete updateData.department;
      delete updateData.expense_account;
      delete updateData.services;
      delete updateData.total_orders;
      delete updateData.total_purchases;
      if (Array.isArray(updateData.service_ids) || (updateData.service_ids && typeof updateData.service_ids === 'object')) {
        updateData.service_ids = JSON.stringify(updateData.service_ids);
      }
      if (updateData.department_id === '') updateData.department_id = null;
      if (updateData.expense_account_id === '') updateData.expense_account_id = null;
    }

    // User-specific handling
    if (table === 'users') {
      delete updateData.name; // virtual field, not in users table

      // Hash password if provided and not empty
      if (updateData.password !== undefined) {
        const rawPassword = String(updateData.password || '').trim();
        if (rawPassword.length > 0) {
          const salt = await bcrypt.genSalt(10);
          updateData.password_hash = await bcrypt.hash(rawPassword, salt);
        }
        delete updateData.password;
      }

      // Foreign keys: convert empty strings to null
      if (updateData.role_id === '') updateData.role_id = null;
      if (updateData.employee_id === '') updateData.employee_id = null;

      // Uniqueness check for email
      if (updateData.email) {
        const emailVal = String(updateData.email).trim();
        const [existingEmail]: any = await pool.query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [emailVal, id]
        );
        if (existingEmail && existingEmail.length > 0) {
          res.status(400).json({ success: false, error: 'Email is already used by another account' });
          return;
        }
        updateData.email = emailVal;
      }

      // Uniqueness check for username
      if (updateData.username) {
        const usernameVal = String(updateData.username).trim();
        const [existingUsername]: any = await pool.query(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [usernameVal, id]
        );
        if (existingUsername && existingUsername.length > 0) {
          res.status(400).json({ success: false, error: 'Username is already used by another account' });
          return;
        }
        updateData.username = usernameVal;
      }
    }
    
    const keys = Object.keys(updateData);
    const values = Object.values(updateData).map(val => (val === '' ? null : val));
    
    if (keys.length === 0) {
      res.status(400).json({ success: false, error: 'No data provided' });
      return;
    }

    const setString = keys.map(key => `${key} = ?`).join(', ');
    const query = `UPDATE ${table} SET ${setString} WHERE id = ?`;
    
    await pool.query(query, [...values, id]);
    
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    const updatedRow = rows[0];
    if (table === 'users' && updatedRow) {
      delete updatedRow.password_hash;
      updatedRow.name = [updatedRow.first_name, updatedRow.last_name].filter(Boolean).join(' ') || updatedRow.username || updatedRow.email;
    }
    const label = updatedRow?.name || updatedRow?.title || updatedRow?.code || updatedRow?.entry_number || (updatedRow?.first_name ? `${updatedRow.first_name} ${updatedRow.last_name || ''}`.trim() : id);
    logCrudActivity(req, 'UPDATE', table, id, `Updated ${table}: ${label}`);
    res.json({ success: true, data: updatedRow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE
router.delete('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  // Prevent self-deletion of currently logged in user
  if (table === 'users' && (req as any).user?.id === id) {
    res.status(400).json({ success: false, error: 'You cannot delete your own user account' });
    return;
  }

  try {
    if (table === 'sales') {
      await pool.query('DELETE FROM sale_items WHERE sale_id = ?', [id]);
    } else if (table === 'purchases') {
      await pool.query('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);
    }

    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    logCrudActivity(req, 'DELETE', table, id, `Deleted ${table} record`);
    res.json({ success: true, data: true });
  } catch (error: any) {
    // If foreign key constraint prevents deletion (e.g. user created sales, purchases, audit records), soft-deactivate instead
    if (table === 'users' && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451)) {
      try {
        await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
        logCrudActivity(req, 'DEACTIVATE', table, id, `Deactivated user account due to linked records`);
        res.json({
          success: true,
          data: true,
          message: 'Account has associated transaction records and has been deactivated instead of deleted.'
        });
        return;
      } catch (deactErr: any) {
        res.status(500).json({ success: false, error: deactErr.message });
        return;
      }
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
