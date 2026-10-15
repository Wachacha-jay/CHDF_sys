import pool from '../config/db';

async function inspect() {
  try {
    const [accs]: any = await pool.query(
      "SELECT id, code, name, account_type, is_system FROM accounts WHERE name LIKE '%transfer%' OR code IN ('4900', '5900')"
    );
    console.log('Matching Accounts:', accs);

    if (accs.length > 0) {
      const accIds = accs.map((a: any) => `'${a.id}'`).join(',');
      const [lines]: any = await pool.query(
        `SELECT jel.id, jel.journal_entry_id, jel.account_id, jel.debit_amount, jel.credit_amount, jel.description, je.entry_number, je.reference
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id IN (${accIds})`
      );
      console.log('Journal Entry Lines linked to these accounts:', lines.length);
      console.log(lines.slice(0, 10));

      const [transfers]: any = await pool.query("SELECT id, transfer_number, status, amount, transfer_type FROM internal_transfers");
      console.log('Internal transfers in table:', transfers);
    }
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

inspect();
