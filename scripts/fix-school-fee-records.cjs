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

    // 2. Restore Co-operative Bank on code 1112 and ensure all banks exist independently
    let coopBankId = null;
    await conn.query("UPDATE accounts SET name = 'Co-operative Bank' WHERE code = '1112' AND name = 'Equity Bank'");
    const [coopAccs] = await conn.query("SELECT id FROM accounts WHERE code = '1112' OR LOWER(name) LIKE '%cooperative%' OR LOWER(name) LIKE '%co-operative%'");
    if (coopAccs.length > 0) {
      coopBankId = coopAccs[0].id;
      await conn.query("UPDATE accounts SET name = 'Co-operative Bank', account_type = 'asset' WHERE id = ?", [coopBankId]);
      console.log(`Preserved/Restored Co-operative Bank [${coopBankId}]`);
    } else {
      coopBankId = crypto.randomUUID();
      await conn.query("INSERT INTO accounts (id, code, name, account_type, is_system) VALUES (?, '1112', 'Co-operative Bank', 'asset', 1)", [coopBankId]);
      console.log(`Created Co-operative Bank [${coopBankId}]`);
    }

    // 3. Ensure Equity Bank exists as a SEPARATE account (code 1115) specifically for Empower Hearts Special School
    let equityBankId = null;
    const [equityAccs] = await conn.query("SELECT id, code, name FROM accounts WHERE LOWER(name) LIKE '%equity%' AND id != ?", [coopBankId]);
    if (equityAccs.length > 0) {
      equityBankId = equityAccs[0].id;
      console.log(`Found Equity Bank account [${equityBankId}]`);
    } else {
      const [c1115] = await conn.query("SELECT id FROM accounts WHERE code = '1115'");
      const equityCode = (c1115 && c1115.length > 0) ? '1116' : '1115';
      equityBankId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO accounts (id, code, name, account_type, is_system)
        VALUES (?, ?, 'Equity Bank', 'asset', 1)
      `, [equityBankId, equityCode]);
      console.log(`Created dedicated Equity Bank account [${equityBankId}] code: ${equityCode}`);
    }

    // 4. Ensure School Fees Revenue account (code 4300) exists
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

    // Resolve Donation Revenue & Program Expense accounts
    const [dRevAccs] = await conn.query("SELECT id FROM accounts WHERE code = '4200' OR LOWER(name) LIKE '%donation revenue%' OR code = '4000'");
    const donRevId = dRevAccs[0]?.id || null;

    const [pExpAccs] = await conn.query("SELECT id FROM accounts WHERE code = '5310' OR code = '5300' OR LOWER(name) LIKE '%child support%' OR LOWER(name) LIKE '%program%'");
    const progExpId = pExpAccs[0]?.id || null;

    // 5. Ensure tables exist
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

    // 6. RESTORE DONATIONS that were accidentally converted to school fees
    console.log('\n--- Restoring any overwritten donations ---');
    const [allDonations] = await conn.query("SELECT * FROM donations");
    for (const don of allDonations) {
      const donBankId = don.payment_account_id || coopBankId;
      const donAmt = Number(don.amount || don.total_fair_market_value || 0);

      const [matchingJEs] = await conn.query(`
        SELECT DISTINCT je.id, je.description 
        FROM journal_entries je
        JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
        WHERE (je.reference = ? OR (je.entry_date = ? AND ABS(je.total_debit - ?) < 0.01))
          AND (LOWER(je.description) LIKE '%school fee%' OR jel.account_id = ?)
      `, [don.reference_number || don.id, don.donation_date, donAmt, feeRevId]);

      for (const je of matchingJEs) {
        await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [je.id]);
        const drLineId = crypto.randomUUID();
        const crLineId = crypto.randomUUID();
        await conn.query(`
          INSERT INTO journal_entry_lines 
            (id, journal_entry_id, account_id, description, debit_amount, credit_amount, department_id, child_id, donor_id, fund_id)
          VALUES 
            (?, ?, ?, ?, ?, 0, ?, ?, ?, ?),
            (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `, [
          drLineId, je.id, donBankId, `Donation received into Bank (${don.payment_method || 'bank'})`, donAmt, don.department_id || null, don.restricted_to_child_id || null, don.donor_id || null, don.fund_id || null,
          crLineId, je.id, donRevId || feeRevId, `Donation revenue recognised`, donAmt, don.department_id || null, don.restricted_to_child_id || null, don.donor_id || null, don.fund_id || null
        ]);

        const restoredDesc = `Donation Received - ${don.reference_number || 'Donation'}: KSh ${donAmt}`;
        await conn.query('UPDATE journal_entries SET description = ? WHERE id = ?', [restoredDesc, je.id]);
        await conn.query('DELETE FROM school_fee_payments WHERE journal_entry_id = ?', [je.id]);
        console.log(`  Restored Donation journal entry [${je.id}] to original bank [${donBankId}]`);
      }

      if (don.restricted_to_child_id) {
        await conn.query(`
          DELETE FROM school_fee_payments 
          WHERE child_id = ? AND payment_date = ? AND ABS(amount - ?) < 0.01
        `, [don.restricted_to_child_id, don.donation_date, donAmt]);
      }
    }

    // 7. RESTORE EXPENSES that were accidentally converted to school fees
    console.log('\n--- Restoring any overwritten expenses ---');
    const [allExpenses] = await conn.query("SELECT * FROM expenses");
    for (const exp of allExpenses) {
      const expBankId = exp.payment_account_id || coopBankId;
      const expAccountId = exp.account_id || progExpId;
      const expAmt = Number(exp.amount || 0);

      const [matchingJEs] = await conn.query(`
        SELECT DISTINCT je.id, je.description 
        FROM journal_entries je
        JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
        WHERE (je.reference = ? OR je.reference = ? OR (je.entry_date = ? AND ABS(je.total_debit - ?) < 0.01))
          AND (LOWER(je.description) LIKE '%school fee%' OR jel.account_id = ?)
      `, [exp.expense_number, exp.reference, exp.expense_date, expAmt, feeRevId]);

      for (const je of matchingJEs) {
        await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [je.id]);
        const drLineId = crypto.randomUUID();
        const crLineId = crypto.randomUUID();
        await conn.query(`
          INSERT INTO journal_entry_lines 
            (id, journal_entry_id, account_id, description, debit_amount, credit_amount, department_id, child_id, fund_id)
          VALUES 
            (?, ?, ?, ?, ?, 0, ?, ?, ?),
            (?, ?, ?, ?, 0, ?, ?, ?, ?)
        `, [
          drLineId, je.id, expAccountId, `Expense: ${exp.description || exp.expense_number}`, expAmt, exp.department_id || null, exp.child_id || null, exp.fund_id || null,
          crLineId, je.id, expBankId, `Disbursement from Bank`, expAmt, exp.department_id || null, exp.child_id || null, exp.fund_id || null
        ]);

        const restoredDesc = `Expense: ${exp.expense_number} - ${exp.description || 'Program Disbursement'}`;
        await conn.query('UPDATE journal_entries SET description = ? WHERE id = ?', [restoredDesc, je.id]);
        await conn.query('DELETE FROM school_fee_payments WHERE journal_entry_id = ?', [je.id]);
        console.log(`  Restored Expense journal entry [${je.id}] to original bank [${expBankId}]`);
      }

      if (exp.child_id) {
        await conn.query(`
          DELETE FROM school_fee_payments 
          WHERE child_id = ? AND payment_date = ? AND ABS(amount - ?) < 0.01
        `, [exp.child_id, exp.expense_date, expAmt]);
      }
    }

    // 8. Handle GENUINE school fee entries ONLY
    console.log('\n--- Processing genuine school fee records ---');
    const [genuineFeePayments] = await conn.query(`
      SELECT DISTINCT je.*
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      WHERE (LOWER(je.description) LIKE '%school fee%' OR LOWER(je.description) LIKE '%tuition%')
        AND LOWER(je.description) NOT LIKE '%donation%'
        AND LOWER(je.description) NOT LIKE '%expense%'
        AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.reference_number = je.reference OR (d.donation_date = je.entry_date AND ABS(d.amount - je.total_debit) < 0.01))
        AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.expense_number = je.reference OR e.reference = je.reference OR (e.expense_date = je.entry_date AND ABS(e.amount - je.total_debit) < 0.01))
    `);

    const [children] = await conn.query('SELECT id, code, first_name, last_name FROM children');
    const childMap = new Map(children.map(c => [c.id, c]));

    for (const entry of genuineFeePayments) {
      const [lines] = await conn.query('SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?', [entry.id]);
      let childId = lines.find(l => l.child_id)?.child_id;
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
        debitLineId, entry.id, equityBankId, `School fee payment received into Equity Bank for ${studentName} (${studentCode}) - Term 2`, amount, deptId, childId,
        creditLineId, entry.id, feeRevId, `School fee revenue recognized for ${studentName} (${studentCode}) - Term 2`, amount, deptId, childId
      ]);

      const updatedDescription = `School Fee Payment (Guardian Inflow) - Term 2 ${entryYear}: ${studentName} (${studentCode}) - ${ref || receiptNo}`;
      await conn.query(`
        UPDATE journal_entries
        SET description = ?, is_posted = 1, total_debit = ?, total_credit = ?
        WHERE id = ?
      `, [updatedDescription, amount, amount, entry.id]);

      const [existingSfp] = await conn.query('SELECT id FROM school_fee_payments WHERE journal_entry_id = ?', [entry.id]);
      if (existingSfp.length > 0) {
        await conn.query(`
          UPDATE school_fee_payments
          SET bank_account_id = ?, department_id = ?, academic_year = ?, term = 'Term 2', amount = ?, child_id = ?
          WHERE id = ?
        `, [equityBankId, deptId, entryYear, amount, childId, existingSfp[0].id]);
      } else {
        await conn.query(`
          INSERT INTO school_fee_payments 
            (id, receipt_number, child_id, academic_year, term, amount, payment_date, payment_method, reference_number, bank_account_id, department_id, journal_entry_id, notes)
          VALUES 
            (?, ?, ?, ?, 'Term 2', ?, ?, 'mpesa', ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(), receiptNo, childId, entryYear, amount, entry.entry_date, ref, equityBankId, deptId, entry.id, updatedDescription
        ]);
      }
    }

    // Ensure all genuine rows in school_fee_payments point to Equity Bank & Empower Hearts Special School
    await conn.query(`
      UPDATE school_fee_payments
      SET department_id = ?, bank_account_id = ?
      WHERE department_id != ? OR bank_account_id != ?
    `, [deptId, equityBankId, deptId, equityBankId]);

    console.log(`\nSUCCESSFULLY RESOLVED!`);
    console.log(`1. Co-operative Bank restored on [${coopBankId}]`);
    console.log(`2. Equity Bank created as separate dedicated account on [${equityBankId}]`);
    console.log(`3. Overwritten Donations and Expenses restored to original accounts & descriptions`);
    console.log(`4. Empower Hearts Special School fee revenue strictly connected to Equity Bank`);

  } catch (err) {
    console.error('Error fixing records:', err);
  } finally {
    await conn.end();
  }
}

fixRecords().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
