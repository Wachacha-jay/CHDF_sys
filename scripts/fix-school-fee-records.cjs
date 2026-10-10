const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function fixRecords() {
  console.log('Connecting to MySQL database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
    multipleStatements: true
  });

  console.log('Connected to database:', process.env.DB_NAME || 'business_management');

  try {
    // 1. Ensure Empower Hearts Special School department exists
    let deptId = null;
    const [empowerDepts] = await conn.query("SELECT id, name FROM departments WHERE LOWER(name) LIKE '%empower%'");
    if (empowerDepts.length > 0) {
      deptId = empowerDepts[0].id;
      await conn.query("UPDATE departments SET name = 'Empower Hearts Special School' WHERE id = ?", [deptId]);
      console.log(`Updated department [${deptId}] name to 'Empower Hearts Special School'`);
    } else {
      deptId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO departments (id, name, description, is_active)
        VALUES (?, 'Empower Hearts Special School', 'Empower Hearts Special School Educational Operations & Programs', 1)
      `, [deptId]);
      console.log(`Created new department [${deptId}] 'Empower Hearts Special School'`);
    }

    // 2. Ensure Equity Bank asset account (code 1112) exists
    let equityBankId = null;
    const [equityAccs] = await conn.query("SELECT id, code, name FROM accounts WHERE LOWER(name) LIKE '%equity%' OR code = '1112'");
    if (equityAccs.length > 0) {
      equityBankId = equityAccs[0].id;
      await conn.query("UPDATE accounts SET name = 'Equity Bank', account_type = 'asset', code = '1112' WHERE id = ?", [equityBankId]);
      console.log(`Found Equity Bank account [${equityBankId}]`);
    } else {
      equityBankId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO accounts (id, code, name, account_type, is_system)
        VALUES (?, '1112', 'Equity Bank', 'asset', 1)
      `, [equityBankId]);
      console.log(`Created Equity Bank account [${equityBankId}]`);
    }

    // 3. Ensure School Fees Revenue account (code 4300) exists
    let feeRevId = null;
    const [feeRevAccs] = await conn.query("SELECT id, code, name FROM accounts WHERE code = '4300' OR LOWER(name) LIKE '%school fee%'");
    if (feeRevAccs.length > 0) {
      feeRevId = feeRevAccs[0].id;
      await conn.query("UPDATE accounts SET name = 'School Fees Revenue', account_type = 'revenue', code = '4300' WHERE id = ?", [feeRevId]);
      console.log(`Found School Fees Revenue account [${feeRevId}]`);
    } else {
      feeRevId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO accounts (id, code, name, account_type, is_system)
        VALUES (?, '4300', 'School Fees Revenue', 'revenue', 1)
      `, [feeRevId]);
      console.log(`Created School Fees Revenue account [${feeRevId}]`);
    }

    // 4. Ensure school_fee_payments table exists
    await conn.query(`
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

    // 5. Ensure school_fee_structures table exists
    await conn.query(`
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

    // 6. Find all existing school fee journal entries
    const [feeEntries] = await conn.query(`
      SELECT DISTINCT je.*
      FROM journal_entries je
      LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      LEFT JOIN accounts a ON jel.account_id = a.id
      WHERE LOWER(je.description) LIKE '%school fee%'
         OR LOWER(je.description) LIKE '%tuition%'
         OR a.code IN ('4300', '5310', '5350')
         OR (jel.child_id IS NOT NULL AND (a.account_type IN ('revenue', 'expense') OR a.code LIKE '4%' OR a.code LIKE '5%'))
    `);

    console.log(`Found ${feeEntries.length} fee-related journal entries to inspect and fix.`);

    // Load children to resolve names and guardian details
    const [children] = await conn.query('SELECT * FROM children');
    const childMap = new Map(children.map(c => [c.id, c]));

    let fixedCount = 0;

    for (const entry of feeEntries) {
      const [lines] = await conn.query(
        'SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?',
        [entry.id]
      );

      // Identify the child
      let childId = lines.find(l => l.child_id)?.child_id;
      let matchedChild = childId ? childMap.get(childId) : null;

      if (!matchedChild) {
        // Try to match from description
        for (const c of children) {
          const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
          if (entry.description.toLowerCase().includes(fullName) || entry.description.toLowerCase().includes(c.code.toLowerCase())) {
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

      // Determine year
      const entryYear = entry.entry_date ? new Date(entry.entry_date).getFullYear() : 2026;

      // Extract reference
      let ref = entry.reference || '';
      const mpesaMatch = entry.description.match(/([A-Z0-9]{8,12})/);
      if (!ref && mpesaMatch) ref = mpesaMatch[1];
      const receiptNo = entry.entry_number || `RCP-${Date.now().toString().slice(-6)}`;

      // FIX JOURNAL ENTRY LINES:
      // Ensure Line 1: Debit Equity Bank
      // Ensure Line 2: Credit School Fees Revenue
      // Both lines tagged with child_id, department_id = Empower Hearts Special School
      await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [entry.id]);

      const debitLineId = crypto.randomUUID();
      const creditLineId = crypto.randomUUID();

      await conn.query(`
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

      // Update journal entry
      const updatedDescription = `School Fee Payment (Guardian Inflow) - Term 2 ${entryYear}: ${studentName} (${studentCode}) - ${ref || receiptNo}`;
      await conn.query(`
        UPDATE journal_entries
        SET description = ?, is_posted = 1, total_debit = ?, total_credit = ?
        WHERE id = ?
      `, [updatedDescription, amount, amount, entry.id]);

      // Seed / Update school_fee_payments table
      const [existingSfp] = await conn.query(
        'SELECT id FROM school_fee_payments WHERE journal_entry_id = ? OR (child_id = ? AND payment_date = ? AND amount = ?)',
        [entry.id, childId, entry.entry_date, amount]
      );

      if (existingSfp.length > 0) {
        await conn.query(`
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
        console.log(`  Updated existing school_fee_payments row [${existingSfp[0].id}] for ${studentName}`);
      } else {
        const sfpId = crypto.randomUUID();
        await conn.query(`
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
        console.log(`  Seeded new school_fee_payments row [${sfpId}] for ${studentName} - Term 2 (KSh ${amount})`);
      }

      fixedCount++;
    }

    // Also update any existing rows in school_fee_payments to ensure department, bank and term are Term 2
    await conn.query(`
      UPDATE school_fee_payments
      SET department_id = ?,
          bank_account_id = ?,
          term = 'Term 2'
      WHERE department_id IS NULL OR bank_account_id IS NULL OR term != 'Term 2'
    `, [deptId, equityBankId]);

    console.log(`\nSUCCESS! Fixed ${fixedCount} school fee records.`);
    console.log(`Department: Empower Hearts Special School [${deptId}]`);
    console.log(`Receiving Bank: Equity Bank [${equityBankId}]`);
    console.log(`Revenue Account: School Fees Revenue [${feeRevId}]`);
    console.log(`All set to Term 2 with proper double-entry accounting.`);

  } catch (err) {
    console.error('Error fixing records:', err);
  } finally {
    await conn.end();
  }
}

fixRecords().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
