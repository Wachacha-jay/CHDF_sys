import pool from '../config/db';

async function inspectFees() {
  try {
    console.log('=== 1. SCHOOL FEE PAYMENTS TABLE ===');
    const [sfpRows]: any = await pool.query('SELECT * FROM school_fee_payments ORDER BY payment_date DESC LIMIT 50');
    console.log(`Found ${sfpRows.length} rows in school_fee_payments:`);
    console.log(JSON.stringify(sfpRows, null, 2));

    console.log('=== 2. JOURNAL ENTRIES WITH CHILD_ID OR FEE MENTION ===');
    const [feeEntries]: any = await pool.query(`
      SELECT je.id, je.entry_number, je.entry_date, je.description, je.reference, je.total_debit, je.total_credit,
             jel.id as line_id, jel.account_id, a.code as account_code, a.name as account_name, a.account_type,
             jel.debit_amount, jel.credit_amount, jel.child_id, c.first_name, c.last_name, jel.description as line_desc
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      LEFT JOIN accounts a ON jel.account_id = a.id
      LEFT JOIN children c ON jel.child_id = c.id
      WHERE jel.child_id IS NOT NULL 
         OR LOWER(je.description) LIKE '%school fee%'
         OR LOWER(je.description) LIKE '%tuition%'
         OR LOWER(je.description) LIKE '%outflow%'
         OR LOWER(je.description) LIKE '%ngo pay%'
         OR a.code IN ('4300', '5310', '5350', '4240')
      ORDER BY je.entry_date DESC, je.id, jel.id
      LIMIT 100
    `);
    console.log(`Found ${feeEntries.length} fee-related lines in journal entries:`);
    console.log(JSON.stringify(feeEntries, null, 2));

    console.log('=== 3. DONATIONS RESTRICTED TO CHILDREN ===');
    const [childDonations]: any = await pool.query(`
      SELECT d.*, c.first_name, c.last_name
      FROM donations d
      LEFT JOIN children c ON d.restricted_to_child_id = c.id
      WHERE d.restricted_to_child_id IS NOT NULL
      LIMIT 50
    `);
    console.log(`Found ${childDonations.length} donations restricted to children:`);
    console.log(JSON.stringify(childDonations, null, 2));

  } catch (err) {
    console.error('Inspect fee error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

inspectFees();
