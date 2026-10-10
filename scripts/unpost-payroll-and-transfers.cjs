const path = require('path');
let mysql;
try {
  mysql = require('mysql2/promise');
} catch (_) {
  mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
}
let dotenv;
try {
  dotenv = require('dotenv');
} catch (_) {
  dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
}
dotenv.config({ path: path.join(__dirname, '../server/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function unpostPayrollAndTransfers() {
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
    await conn.beginTransaction();

    console.log('\n========================================');
    console.log('1. UNPOSTING INTERNAL TRANSFERS');
    console.log('========================================');

    // 1. Find all approved internal transfers
    const [transfers] = await conn.query("SELECT * FROM internal_transfers WHERE status = 'approved'");
    console.log(`Found ${transfers.length} approved internal transfer(s) to unpost.`);

    for (const t of transfers) {
      const refCode = (t.id || '').slice(0, 8).toUpperCase();
      console.log(`- Unposting transfer [${t.id}] Ref: ${refCode}, Amount: ${t.amount}, Desc: ${t.description}`);

      // Find matching journal entries
      const [jeRows] = await conn.query(
        `SELECT id, entry_number, reference, description FROM journal_entries 
         WHERE reference IN (?, ?)
            OR reference LIKE ?
            OR (description LIKE ? AND (description LIKE '%Interdepartmental Loan%' OR description LIKE '%Interdepartmental Grant%' OR description LIKE '%Loan Repayment%'))`,
        [`ITR-${refCode}-OUT`, `ITR-${refCode}-IN`, `%${refCode}%`, `%${t.description || '___none___'}%`]
      );

      console.log(`  Found ${jeRows.length} associated journal voucher(s).`);
      for (const je of jeRows) {
        console.log(`  Deleting lines and entry for JE [${je.entry_number}] ref: ${je.reference}`);
        await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [je.id]);
        await conn.query('DELETE FROM journal_entries WHERE id = ?', [je.id]);
      }

      // Revert status to 'draft' and clear approved_by
      await conn.query("UPDATE internal_transfers SET status = 'draft', approved_by = NULL WHERE id = ?", [t.id]);
      console.log(`  Transfer [${t.id}] reverted to 'draft' status.`);
    }

    // Also clean up any orphaned ITR vouchers
    const [orphanITRs] = await conn.query("SELECT id, entry_number, reference FROM journal_entries WHERE reference LIKE 'ITR-%'");
    if (orphanITRs.length > 0) {
      console.log(`Cleaning up ${orphanITRs.length} remaining/orphaned ITR journal voucher(s)...`);
      for (const je of orphanITRs) {
        await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [je.id]);
        await conn.query('DELETE FROM journal_entries WHERE id = ?', [je.id]);
      }
    }

    console.log('\n========================================');
    console.log('2. UNPOSTING PAYROLL RUNS');
    console.log('========================================');

    // 2. Find all paid payroll runs
    const [paidRuns] = await conn.query(`
      SELECT pr.*, e.first_name, e.last_name, e.code as employee_code, pp.period_name
      FROM payroll_runs pr
      LEFT JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
      WHERE pr.status = 'paid'
    `);
    console.log(`Found ${paidRuns.length} paid payroll run(s) to unpost.`);

    const journalIdsToDelete = new Set();

    for (const run of paidRuns) {
      const empLabel = `${run.first_name || ''} ${run.last_name || ''} (${run.employee_code || ''})`.trim();
      console.log(`- Unposting payroll run [${run.id}] for ${empLabel}, Period: ${run.period_name}, Net: ${run.net_pay}`);

      if (run.journal_entry_id) journalIdsToDelete.add(run.journal_entry_id);
      if (run.payment_journal_entry_id) journalIdsToDelete.add(run.payment_journal_entry_id);

      // Revert run to draft and nullify payment and journal fields
      await conn.query(`
        UPDATE payroll_runs SET 
          status = 'draft',
          paid_date = NULL,
          payment_account_id = NULL,
          payment_reference = NULL,
          journal_entry_id = NULL,
          payment_journal_entry_id = NULL
        WHERE id = ?
      `, [run.id]);
      console.log(`  Run [${run.id}] reverted to 'draft' status.`);
    }

    // Find any additional payroll journal entries by entry_number prefix or description
    const [payJEs] = await conn.query(`
      SELECT id, entry_number, description FROM journal_entries
      WHERE entry_number LIKE 'PAY-ACC-%'
         OR entry_number LIKE 'PAY-DISB-%'
         OR description LIKE 'Payroll Accrual%'
         OR description LIKE 'Salary payment to%'
    `);
    for (const pje of payJEs) {
      journalIdsToDelete.add(pje.id);
    }

    console.log(`Deleting ${journalIdsToDelete.size} payroll journal entry voucher(s) and lines...`);
    for (const jId of journalIdsToDelete) {
      await conn.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = ?', [jId]);
      await conn.query('DELETE FROM journal_entries WHERE id = ?', [jId]);
    }

    // Clean up payroll_journal_entries link table if it exists
    try {
      await conn.query('DELETE FROM payroll_journal_entries');
    } catch (_) {}

    // 3. Re-open any closed payroll periods back to 'processing'
    const [closedPeriods] = await conn.query("SELECT id, period_name FROM payroll_periods WHERE status = 'closed'");
    for (const period of closedPeriods) {
      console.log(`Re-opening closed payroll period [${period.id}] "${period.period_name}" back to 'processing'`);
      await conn.query("UPDATE payroll_periods SET status = 'processing' WHERE id = ?", [period.id]);
    }

    await conn.commit();
    console.log('\n========================================');
    console.log('✅ ALL MISTAKEN ENTRIES UNPOSTED SUCCESSFULLY!');
    console.log('   - Internal transfers reverted to DRAFT');
    console.log('   - Payroll runs reverted to DRAFT');
    console.log('   - General Ledger journal vouchers deleted');
    console.log('   - Closed payroll periods re-opened to PROCESSING');
    console.log('You can now edit and correct them before re-posting.');
    console.log('========================================\n');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error during unposting:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

unpostPayrollAndTransfers().catch(err => {
  console.error(err);
  process.exit(1);
});
