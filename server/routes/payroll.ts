import { Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// SELF-HEALING DATABASE SCHEMA INITIALIZER
// ─────────────────────────────────────────────────────────────────────────────
let schemaEnsured = false;
async function ensurePayrollSchema() {
  if (schemaEnsured) return;
  try {
    // 1. Ensure Sacco / Welfare Payable GL account (2126) exists
    await pool.query(`
      INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) 
      VALUES (UUID(), '2126', 'Sacco / Welfare Payable', 'liability', 1)
    `);

    // 2. Ensure payroll_settings columns
    const [settingsCols]: any = await pool.query('SHOW COLUMNS FROM payroll_settings');
    const setColNames = new Set(settingsCols.map((c: any) => c.Field));
    if (!setColNames.has('sacco_welfare_rate')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN sacco_welfare_rate DECIMAL(5,2) DEFAULT 0.00');
    }
    if (!setColNames.has('sacco_welfare_amount')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN sacco_welfare_amount DECIMAL(12,2) DEFAULT 0.00');
    }
    if (!setColNames.has('tax_enabled')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN tax_enabled TINYINT(1) DEFAULT 1');
    }
    if (!setColNames.has('nhif_enabled')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN nhif_enabled TINYINT(1) DEFAULT 1');
    }
    if (!setColNames.has('nssf_enabled')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN nssf_enabled TINYINT(1) DEFAULT 1');
    }
    if (!setColNames.has('housing_levy_enabled')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN housing_levy_enabled TINYINT(1) DEFAULT 1');
    }
    if (!setColNames.has('sacco_welfare_enabled')) {
      await pool.query('ALTER TABLE payroll_settings ADD COLUMN sacco_welfare_enabled TINYINT(1) DEFAULT 0');
    }

    // 3. Ensure payroll_runs columns
    const [runCols]: any = await pool.query('SHOW COLUMNS FROM payroll_runs');
    const runColNames = new Set(runCols.map((c: any) => c.Field));
    if (!runColNames.has('sacco_welfare_deduction')) {
      await pool.query('ALTER TABLE payroll_runs ADD COLUMN sacco_welfare_deduction DECIMAL(12,2) DEFAULT 0.00');
    }
    if (!runColNames.has('payment_account_id')) {
      await pool.query('ALTER TABLE payroll_runs ADD COLUMN payment_account_id CHAR(36) DEFAULT NULL');
    }
    if (!runColNames.has('payment_reference')) {
      await pool.query('ALTER TABLE payroll_runs ADD COLUMN payment_reference VARCHAR(100) DEFAULT NULL');
    }
    if (!runColNames.has('payment_journal_entry_id')) {
      await pool.query('ALTER TABLE payroll_runs ADD COLUMN payment_journal_entry_id CHAR(36) DEFAULT NULL');
    }

    // 4. Ensure payroll_periods columns
    const [periodCols]: any = await pool.query('SHOW COLUMNS FROM payroll_periods');
    const periodColNames = new Set(periodCols.map((c: any) => c.Field));
    if (!periodColNames.has('total_sacco_welfare')) {
      await pool.query('ALTER TABLE payroll_periods ADD COLUMN total_sacco_welfare DECIMAL(14,2) DEFAULT 0.00');
    }

    // 5. Ensure employees columns
    const [empCols]: any = await pool.query('SHOW COLUMNS FROM employees');
    const empColNames = new Set(empCols.map((c: any) => c.Field));
    if (!empColNames.has('department_id')) {
      await pool.query('ALTER TABLE employees ADD COLUMN department_id CHAR(36) DEFAULT NULL');
    }

    schemaEnsured = true;
  } catch (err) {
    console.error('Error in ensurePayrollSchema:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: fetch payroll settings (with defaults & non-mandatory checks)
// ─────────────────────────────────────────────────────────────────────────────
async function getSettings() {
  await ensurePayrollSchema();
  const [rows]: any = await pool.query('SELECT * FROM payroll_settings LIMIT 1');
  const s = rows[0] || {};
  return {
    id: s.id,
    pay_period: s.pay_period || 'monthly',
    pay_day: s.pay_day !== undefined ? Number(s.pay_day) : 25,
    overtime_rate: s.overtime_rate !== undefined ? Number(s.overtime_rate) : 1.5,
    holiday_pay_rate: s.holiday_pay_rate !== undefined ? Number(s.holiday_pay_rate) : 2.0,
    tax_deduction_rate: s.tax_deduction_rate !== undefined ? Number(s.tax_deduction_rate) : 30.0,
    nhif_rate: s.nhif_rate !== undefined ? Number(s.nhif_rate) : 2.5,
    nssf_rate: s.nssf_rate !== undefined ? Number(s.nssf_rate) : 6.0,
    housing_levy_rate: s.housing_levy_rate !== undefined ? Number(s.housing_levy_rate) : 1.5,
    sacco_welfare_rate: s.sacco_welfare_rate !== undefined ? Number(s.sacco_welfare_rate) : 0.0,
    sacco_welfare_amount: s.sacco_welfare_amount !== undefined ? Number(s.sacco_welfare_amount) : 0.0,
    tax_enabled: s.tax_enabled !== undefined ? Boolean(s.tax_enabled) : true,
    nhif_enabled: s.nhif_enabled !== undefined ? Boolean(s.nhif_enabled) : true,
    nssf_enabled: s.nssf_enabled !== undefined ? Boolean(s.nssf_enabled) : true,
    housing_levy_enabled: s.housing_levy_enabled !== undefined ? Boolean(s.housing_levy_enabled) : true,
    sacco_welfare_enabled: s.sacco_welfare_enabled !== undefined ? Boolean(s.sacco_welfare_enabled) : false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Post Payroll Accrual Journal Entry
// Debit: Salary Expense (5210) [Gross Pay]
// Credit: Net Salary Payable (2125) [Net Pay]
// Credit: PAYE Payable (2121) [Tax]
// Credit: NSSF Payable (2122) [NSSF]
// Credit: NHIF/SHIF Payable (2123) [NHIF]
// Credit: Housing Levy Payable (2124) [Housing Levy]
// Credit: Sacco / Welfare Payable (2126) [Sacco / Welfare]
// Credit: Accrued Deductions / Other (2120) [Other Deductions]
// ─────────────────────────────────────────────────────────────────────────────
async function postPayrollAccrualJournalEntry(
  connection: any,
  periodName: string,
  payDate: string,
  gross: number,
  net: number,
  tax: number,
  nssf: number,
  nhif: number,
  housingLevy: number,
  saccoWelfare: number,
  otherDeductions: number,
  createdBy: string,
  empLabel?: string
) {
  const accountCodes = ['5210', '2125', '2121', '2122', '2123', '2124', '2126', '2120'];
  const [accountRows]: any = await connection.query(
    `SELECT id, code FROM accounts WHERE code IN (${accountCodes.map(() => '?').join(',')})`,
    accountCodes
  );

  const accountMap: Record<string, string> = {};
  for (const a of accountRows) {
    accountMap[a.code] = a.id;
  }

  const salaryExpenseId = accountMap['5210'];
  const netSalaryPayableId = accountMap['2125'];
  const payeId = accountMap['2121'];
  const nssfId = accountMap['2122'];
  const nhifId = accountMap['2123'];
  const housingLevyId = accountMap['2124'];
  const saccoId = accountMap['2126'];
  const otherDedId = accountMap['2120'] || netSalaryPayableId;

  if (!salaryExpenseId || !netSalaryPayableId) {
    console.warn('Essential payroll accounts (5210, 2125) not found — skipping accrual journal entry');
    return null;
  }

  const journalId = crypto.randomUUID();
  const entryNumber = `PAY-ACC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  const desc = empLabel 
    ? `Payroll Accrual: ${empLabel} - ${periodName}` 
    : `Payroll Accrual for ${periodName}`;

  await connection.query(
    `INSERT INTO journal_entries (id, entry_number, entry_date, description, reference, total_debit, total_credit, is_posted, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [journalId, entryNumber, payDate, desc, periodName, gross, gross, createdBy]
  );

  const lines: Array<{ account_id: string; description: string; debit: number; credit: number }> = [
    { account_id: salaryExpenseId, description: `Gross Salary - ${periodName}${empLabel ? ' (' + empLabel + ')' : ''}`, debit: gross, credit: 0 },
    { account_id: netSalaryPayableId, description: `Net Salary Payable - ${periodName}${empLabel ? ' (' + empLabel + ')' : ''}`, debit: 0, credit: net },
  ];

  if (tax > 0 && payeId) lines.push({ account_id: payeId, description: `PAYE Income Tax - ${periodName}`, debit: 0, credit: tax });
  if (nssf > 0 && nssfId) lines.push({ account_id: nssfId, description: `NSSF Contribution - ${periodName}`, debit: 0, credit: nssf });
  if (nhif > 0 && nhifId) lines.push({ account_id: nhifId, description: `NHIF/SHA Contribution - ${periodName}`, debit: 0, credit: nhif });
  if (housingLevy > 0 && housingLevyId) lines.push({ account_id: housingLevyId, description: `Housing Levy - ${periodName}`, debit: 0, credit: housingLevy });
  if (saccoWelfare > 0 && saccoId) lines.push({ account_id: saccoId, description: `Sacco & Welfare - ${periodName}`, debit: 0, credit: saccoWelfare });
  if (otherDeductions > 0 && otherDedId) lines.push({ account_id: otherDedId, description: `Other Payroll Deductions - ${periodName}`, debit: 0, credit: otherDeductions });

  for (const line of lines) {
    const lineId = crypto.randomUUID();
    await connection.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [lineId, journalId, line.account_id, line.description, line.debit, line.credit]
    );
  }

  return journalId;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Post Payroll Disbursement Journal Entry (Individual Payment)
// Debit: Net Salary Payable (2125) [Net Pay]
// Credit: Paying Account (e.g., Bank / Cash Asset Account) [Net Pay]
// ─────────────────────────────────────────────────────────────────────────────
async function postPayrollDisbursementJournalEntry(
  connection: any,
  periodName: string,
  payDate: string,
  netPay: number,
  paymentAccountId: string,
  reference: string,
  notes: string,
  createdBy: string,
  empLabel: string
) {
  // Find Net Salary Payable account (2125)
  const [netSalaryRows]: any = await connection.query(
    'SELECT id FROM accounts WHERE code = ? LIMIT 1',
    ['2125']
  );
  if (netSalaryRows.length === 0) {
    throw new Error('Account 2125 (Net Salary Payable) not found');
  }
  const netSalaryPayableId = netSalaryRows[0].id;

  // Verify payment account is valid
  const [payAccRows]: any = await connection.query(
    'SELECT id, name, code, account_type FROM accounts WHERE id = ? LIMIT 1',
    [paymentAccountId]
  );
  if (payAccRows.length === 0) {
    throw new Error('Selected paying account not found');
  }

  const payAcc = payAccRows[0];
  const journalId = crypto.randomUUID();
  const entryNumber = `PAY-DISB-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  const desc = `Salary payment to ${empLabel} for ${periodName}${notes ? ' - ' + notes : ''}`;

  await connection.query(
    `INSERT INTO journal_entries (id, entry_number, entry_date, description, reference, total_debit, total_credit, is_posted, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [journalId, entryNumber, payDate, desc, reference || entryNumber, netPay, netPay, createdBy]
  );

  // Line 1: Debit Net Salary Payable (clearing the liability)
  await connection.query(
    `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [crypto.randomUUID(), journalId, netSalaryPayableId, `Salary disbursement: ${empLabel}`, netPay]
  );

  // Line 2: Credit Bank / Cash Asset Account (money outflow)
  await connection.query(
    `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [crypto.randomUUID(), journalId, paymentAccountId, `Paid from [${payAcc.code}] ${payAcc.name} to ${empLabel}`, netPay]
  );

  return journalId;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET payroll settings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/settings', authenticate, async (req, res): Promise<void> => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE payroll settings (all deduction rates editable & none mandatory)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/settings', authenticate, async (req, res): Promise<void> => {
  try {
    await ensurePayrollSchema();
    const {
      pay_period = 'monthly',
      pay_day = 25,
      overtime_rate = 1.5,
      holiday_pay_rate = 2.0,
      tax_deduction_rate = 30.0,
      nhif_rate = 2.5,
      nssf_rate = 6.0,
      housing_levy_rate = 1.5,
      sacco_welfare_rate = 0.0,
      sacco_welfare_amount = 0.0,
      tax_enabled = 1,
      nhif_enabled = 1,
      nssf_enabled = 1,
      housing_levy_enabled = 1,
      sacco_welfare_enabled = 0,
    } = req.body;

    const [existing]: any = await pool.query('SELECT id FROM payroll_settings LIMIT 1');
    if (existing.length > 0) {
      await pool.query(
        `UPDATE payroll_settings SET
          pay_period = ?, pay_day = ?, overtime_rate = ?, holiday_pay_rate = ?,
          tax_deduction_rate = ?, nhif_rate = ?, nssf_rate = ?, housing_levy_rate = ?,
          sacco_welfare_rate = ?, sacco_welfare_amount = ?,
          tax_enabled = ?, nhif_enabled = ?, nssf_enabled = ?, housing_levy_enabled = ?, sacco_welfare_enabled = ?
         WHERE id = ?`,
        [
          pay_period, pay_day, overtime_rate, holiday_pay_rate,
          tax_deduction_rate, nhif_rate, nssf_rate, housing_levy_rate,
          sacco_welfare_rate, sacco_welfare_amount,
          tax_enabled ? 1 : 0, nhif_enabled ? 1 : 0, nssf_enabled ? 1 : 0, housing_levy_enabled ? 1 : 0, sacco_welfare_enabled ? 1 : 0,
          existing[0].id
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO payroll_settings (
          id, pay_period, pay_day, overtime_rate, holiday_pay_rate,
          tax_deduction_rate, nhif_rate, nssf_rate, housing_levy_rate,
          sacco_welfare_rate, sacco_welfare_amount,
          tax_enabled, nhif_enabled, nssf_enabled, housing_levy_enabled, sacco_welfare_enabled
        ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pay_period, pay_day, overtime_rate, holiday_pay_rate,
          tax_deduction_rate, nhif_rate, nssf_rate, housing_levy_rate,
          sacco_welfare_rate, sacco_welfare_amount,
          tax_enabled ? 1 : 0, nhif_enabled ? 1 : 0, nssf_enabled ? 1 : 0, housing_levy_enabled ? 1 : 0, sacco_welfare_enabled ? 1 : 0
        ]
      );
    }

    const updated = await getSettings();
    res.json({ success: true, message: 'Payroll settings updated', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET payroll runs with employee & payment account info joined
// ─────────────────────────────────────────────────────────────────────────────
router.get('/runs', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { payroll_period_id } = req.query;
  try {
    let query = `
      SELECT 
        pr.*,
        e.first_name, e.last_name, e.email, e.position, e.department, e.code as employee_code,
        e.bank_name, e.bank_account, e.payment_method,
        pa.name as payment_account_name, pa.code as payment_account_code
      FROM payroll_runs pr
      LEFT JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN accounts pa ON pr.payment_account_id = pa.id
    `;
    const params: any[] = [];

    if (payroll_period_id) {
      query += ' WHERE pr.payroll_period_id = ?';
      params.push(payroll_period_id);
    }

    query += ' ORDER BY e.first_name, e.last_name';

    const [rows]: any = await pool.query(query, params);

    const data = rows.map((row: any) => ({
      id: row.id,
      payroll_period_id: row.payroll_period_id,
      employee_id: row.employee_id,
      basic_salary: Number(row.basic_salary) || 0,
      overtime_hours: Number(row.overtime_hours) || 0,
      overtime_pay: Number(row.overtime_pay) || 0,
      holiday_hours: Number(row.holiday_hours) || 0,
      holiday_pay: Number(row.holiday_pay) || 0,
      allowances: Number(row.allowances) || 0,
      bonuses: Number(row.bonuses) || 0,
      gross_pay: Number(row.gross_pay) || 0,
      tax_deduction: Number(row.tax_deduction) || 0,
      nhif_deduction: Number(row.nhif_deduction) || 0,
      nssf_deduction: Number(row.nssf_deduction) || 0,
      housing_levy_deduction: Number(row.housing_levy_deduction) || 0,
      sacco_welfare_deduction: Number(row.sacco_welfare_deduction) || 0,
      other_deductions: Number(row.other_deductions) || 0,
      net_pay: Number(row.net_pay) || 0,
      notes: row.notes,
      status: row.status,
      paid_date: row.paid_date,
      journal_entry_id: row.journal_entry_id,
      payment_account_id: row.payment_account_id,
      payment_reference: row.payment_reference,
      payment_journal_entry_id: row.payment_journal_entry_id,
      payment_account: row.payment_account_id ? {
        id: row.payment_account_id,
        name: row.payment_account_name || 'Account',
        code: row.payment_account_code || ''
      } : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      employee: {
        id: row.employee_id,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        email: row.email || '',
        position: row.position || '',
        department: row.department || '',
        code: row.employee_code || '',
        bank_name: row.bank_name || '',
        bank_account: row.bank_account || '',
        payment_method: row.payment_method || 'bank',
      }
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching payroll runs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GENERATE Payroll for a period (honors editable, non-mandatory deductions + Sacco)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/periods/:id/generate', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { id: periodId } = req.params;
  const createdBy = (req as any).user?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [periodRows]: any = await connection.query('SELECT * FROM payroll_periods WHERE id = ?', [periodId]);
    if (periodRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Payroll period not found' });
      return;
    }

    const [existingRuns]: any = await connection.query('SELECT id FROM payroll_runs WHERE payroll_period_id = ?', [periodId]);
    if (existingRuns.length > 0) {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'Payroll already generated for this period' });
      return;
    }

    const settings = await getSettings();

    // Rates: if disabled, 0. If enabled, respect rate exactly without forcing arbitrary non-zero defaults
    const taxRate = settings.tax_enabled ? (Number(settings.tax_deduction_rate) || 0) : 0;
    const nhifRate = settings.nhif_enabled ? (Number(settings.nhif_rate) || 0) : 0;
    const nssfRate = settings.nssf_enabled ? (Number(settings.nssf_rate) || 0) : 0;
    const housingLevyRate = settings.housing_levy_enabled ? (Number(settings.housing_levy_rate) || 0) : 0;
    const saccoRate = settings.sacco_welfare_enabled ? (Number(settings.sacco_welfare_rate) || 0) : 0;
    const saccoAmount = settings.sacco_welfare_enabled ? (Number(settings.sacco_welfare_amount) || 0) : 0;

    const [employees]: any = await connection.query(
      'SELECT * FROM employees WHERE is_active = 1'
    );

    if (employees.length === 0) {
      await connection.rollback();
      res.json({ success: true, message: 'No active employees to process', generated: 0 });
      return;
    }

    let grandGross = 0, grandNet = 0, grandTax = 0;
    let grandNHIF = 0, grandNSSF = 0, grandHousingLevy = 0, grandSacco = 0;

    for (const emp of employees) {
      const basicSalary = Number(emp.basic_salary) || 0;
      const grossPay = basicSalary;

      const taxDeduction = (grossPay * taxRate) / 100;
      const nhifDeduction = (grossPay * nhifRate) / 100;
      const nssfDeduction = (grossPay * nssfRate) / 100;
      const housingLevy = (grossPay * housingLevyRate) / 100;
      const saccoDeduction = saccoAmount > 0 ? saccoAmount : (grossPay * saccoRate) / 100;

      const netPay = grossPay - taxDeduction - nhifDeduction - nssfDeduction - housingLevy - saccoDeduction;

      const runId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO payroll_runs (
          id, payroll_period_id, employee_id, basic_salary,
          overtime_hours, overtime_pay, holiday_hours, holiday_pay, allowances, bonuses,
          gross_pay, tax_deduction, nhif_deduction, nssf_deduction, housing_levy_deduction,
          sacco_welfare_deduction, other_deductions,
          net_pay, notes, status, created_by
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, 0, ?, 'Auto-generated', 'draft', ?)`,
        [
          runId, periodId, emp.id, basicSalary,
          grossPay, taxDeduction, nhifDeduction, nssfDeduction, housingLevy,
          saccoDeduction, netPay, createdBy
        ]
      );

      grandGross += grossPay;
      grandNet += netPay;
      grandTax += taxDeduction;
      grandNHIF += nhifDeduction;
      grandNSSF += nssfDeduction;
      grandHousingLevy += housingLevy;
      grandSacco += saccoDeduction;
    }

    await connection.query(
      `UPDATE payroll_periods SET 
        total_gross_pay = ?, total_net_pay = ?, total_tax = ?,
        total_nhif = ?, total_nssf = ?, total_housing_levy = ?, total_sacco_welfare = ?,
        status = 'processing'
      WHERE id = ?`,
      [grandGross, grandNet, grandTax, grandNHIF, grandNSSF, grandHousingLevy, grandSacco, periodId]
    );

    await connection.commit();

    // Audit log
    try {
      const createdByName = (req as any).user?.name || (req as any).user?.email || 'System';
      const auditId = crypto.randomUUID();
      const periodRow = periodRows[0];
      await pool.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, details, ip_address) VALUES (?, ?, ?, 'GENERATE', 'Payroll', ?, ?, ?, '')`,
        [auditId, createdBy, createdByName, periodId, `Payroll generated for ${periodRow.period_name}`, JSON.stringify({ period_name: periodRow.period_name, runs_created: employees.length })]
      );
    } catch (_) {}

    res.json({
      success: true,
      message: `Payroll generated for ${employees.length} employee(s)`,
      generated: employees.length,
      totals: { grandGross, grandNet, grandTax, grandNHIF, grandNSSF, grandHousingLevy, grandSacco }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error generating payroll:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate payroll' });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UPDATE a single payroll run (edit hours, earnings, AND any deduction)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/runs/:id', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { id } = req.params;

  try {
    const [runRows]: any = await pool.query('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    if (runRows.length === 0) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }
    const run = runRows[0];
    const settings = await getSettings();

    const otHours = req.body.overtime_hours !== undefined ? Number(req.body.overtime_hours) : Number(run.overtime_hours || 0);
    const holHours = req.body.holiday_hours !== undefined ? Number(req.body.holiday_hours) : Number(run.holiday_hours || 0);
    const allow = req.body.allowances !== undefined ? Number(req.body.allowances) : Number(run.allowances || 0);
    const bonus = req.body.bonuses !== undefined ? Number(req.body.bonuses) : Number(run.bonuses || 0);
    const notes = req.body.notes !== undefined ? req.body.notes : run.notes;
    const basicSalary = req.body.basic_salary !== undefined 
      ? Number(req.body.basic_salary) 
      : (Number(run.basic_salary) || 0);

    const hourlyRate = basicSalary / 160;
    const overtimePay = otHours * hourlyRate * (Number(settings.overtime_rate) || 1.5);
    const holidayPay = holHours * hourlyRate * (Number(settings.holiday_pay_rate) || 2.0);
    const grossPay = basicSalary + overtimePay + holidayPay + allow + bonus;

    // Deductions: if explicitly passed in body, respect the value directly (none mandatory!)
    // If not provided in body, keep run value or calculate from rates
    const taxDeduction = req.body.tax_deduction !== undefined 
      ? Number(req.body.tax_deduction) 
      : (settings.tax_enabled ? (grossPay * (Number(settings.tax_deduction_rate) || 0)) / 100 : 0);

    const nhifDeduction = req.body.nhif_deduction !== undefined 
      ? Number(req.body.nhif_deduction) 
      : (settings.nhif_enabled ? (grossPay * (Number(settings.nhif_rate) || 0)) / 100 : 0);

    const nssfDeduction = req.body.nssf_deduction !== undefined 
      ? Number(req.body.nssf_deduction) 
      : (settings.nssf_enabled ? (grossPay * (Number(settings.nssf_rate) || 0)) / 100 : 0);

    const housingLevy = req.body.housing_levy_deduction !== undefined 
      ? Number(req.body.housing_levy_deduction) 
      : (settings.housing_levy_enabled ? (grossPay * (Number(settings.housing_levy_rate) || 0)) / 100 : 0);

    const saccoDeduction = req.body.sacco_welfare_deduction !== undefined
      ? Number(req.body.sacco_welfare_deduction)
      : (settings.sacco_welfare_enabled 
          ? (settings.sacco_welfare_amount > 0 ? settings.sacco_welfare_amount : (grossPay * (Number(settings.sacco_welfare_rate) || 0)) / 100)
          : 0);

    const otherDed = req.body.other_deductions !== undefined ? Number(req.body.other_deductions) : Number(run.other_deductions || 0);

    const netPay = grossPay - taxDeduction - nhifDeduction - nssfDeduction - housingLevy - saccoDeduction - otherDed;

    await pool.query(
      `UPDATE payroll_runs SET
        basic_salary = ?, overtime_hours = ?, overtime_pay = ?, holiday_hours = ?, holiday_pay = ?,
        allowances = ?, bonuses = ?, gross_pay = ?, tax_deduction = ?,
        nhif_deduction = ?, nssf_deduction = ?, housing_levy_deduction = ?,
        sacco_welfare_deduction = ?, other_deductions = ?, net_pay = ?, notes = ?
      WHERE id = ?`,
      [
        basicSalary, otHours, overtimePay, holHours, holidayPay,
        allow, bonus, grossPay, taxDeduction,
        nhifDeduction, nssfDeduction, housingLevy,
        saccoDeduction, otherDed, netPay, notes, id
      ]
    );

    // Recalculate period totals
    const pId = run.payroll_period_id;
    const [totals]: any = await pool.query(
      `SELECT 
        SUM(gross_pay) as tg, SUM(net_pay) as tn, SUM(tax_deduction) as tt,
        SUM(nhif_deduction) as tnhif, SUM(nssf_deduction) as tnssf,
        SUM(housing_levy_deduction) as thl, SUM(sacco_welfare_deduction) as tsacco
       FROM payroll_runs WHERE payroll_period_id = ?`, [pId]
    );

    if (totals.length > 0) {
      await pool.query(
        `UPDATE payroll_periods SET 
          total_gross_pay=?, total_net_pay=?, total_tax=?,
          total_nhif=?, total_nssf=?, total_housing_levy=?, total_sacco_welfare=? 
         WHERE id=?`,
        [
          totals[0].tg || 0, totals[0].tn || 0, totals[0].tt || 0,
          totals[0].tnhif || 0, totals[0].tnssf || 0, totals[0].thl || 0,
          totals[0].tsacco || 0, pId
        ]
      );
    }

    const [updated]: any = await pool.query('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payroll run updated', data: updated[0] });
  } catch (error: any) {
    console.error('Error updating payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5B. CLEAR ALL PAYROLL RUNS (Start fresh)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/clear-runs', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Delete deductions and allowances linked to runs
    await connection.query('DELETE FROM payroll_deductions');
    await connection.query('DELETE FROM payroll_allowances');

    // 2. Delete all payroll runs
    const [runDeleteResult]: any = await connection.query('DELETE FROM payroll_runs');

    // 3. Delete payroll journal entries linked to periods
    try {
      await connection.query('DELETE FROM payroll_journal_entries');
    } catch (_) {}

    // 4. Reset payroll periods totals and status back to 'open'
    await connection.query(`
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

    await connection.commit();

    // Audit log
    try {
      const user = (req as any).user;
      const auditId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, details, ip_address) VALUES (?, ?, ?, 'RESET', 'Payroll', 'ALL', 'Cleared all payroll runs for fresh start', ?, '')`,
        [auditId, user?.id || null, user?.name || user?.email || 'System', JSON.stringify({ runs_deleted: runDeleteResult?.affectedRows || 0 })]
      );
    } catch (_) {}

    res.json({
      success: true,
      message: `Successfully cleared all payroll runs (${runDeleteResult?.affectedRows || 0} run(s) deleted). All pay periods have been reset to open status.`,
      runs_deleted: runDeleteResult?.affectedRows || 0
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error clearing payroll runs:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to clear payroll runs' });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. APPROVE a payroll run (draft → approved)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/runs/:id/approve', authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }
    if (rows[0].status !== 'draft') {
      res.status(400).json({ success: false, error: 'Only draft runs can be approved' });
      return;
    }
    const [approveRows]: any = await pool.query('SELECT pr.*, e.first_name, e.last_name, e.code as employee_code FROM payroll_runs pr JOIN employees e ON pr.employee_id = e.id WHERE pr.id = ?', [id]);
    await pool.query('UPDATE payroll_runs SET status = ? WHERE id = ?', ['approved', id]);
    // Audit log
    try {
      const approvedBy = (req as any).user?.id;
      const approvedByName = (req as any).user?.name || (req as any).user?.email || 'System';
      const auditId = crypto.randomUUID();
      const empLabel = approveRows[0] ? approveRows[0].first_name + ' ' + approveRows[0].last_name + ' (' + approveRows[0].employee_code + ')' : id;
      await pool.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, details, ip_address) VALUES (?, ?, ?, 'APPROVE', 'Payroll', ?, ?, ?, '')`,
        [auditId, approvedBy, approvedByName, id, `Approved payroll for ${empLabel}`, JSON.stringify({ run_id: id, emp: empLabel })]
      );
    } catch (_) {}
    res.json({ success: true, message: 'Payroll run approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PAY an individual payroll run with Chosen Paying Account & Balanced GL Double-Entry
// ─────────────────────────────────────────────────────────────────────────────
router.put('/runs/:id/pay', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { id } = req.params;
  const { payment_account_id, payment_date, payment_reference, notes } = req.body;
  const createdBy = (req as any).user?.id;

  if (!payment_account_id) {
    res.status(400).json({ success: false, error: 'Please choose the paying account (Bank/Cash) to disburse salary' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      `SELECT pr.*, pp.period_name, pp.pay_date as period_pay_date,
              e.first_name, e.last_name, e.code as employee_code
       FROM payroll_runs pr
       JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
       JOIN employees e ON pr.employee_id = e.id
       WHERE pr.id = ?`, [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }

    const run = rows[0];
    if (run.status === 'paid') {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'This payroll run has already been paid' });
      return;
    }

    const payDate = payment_date || run.period_pay_date || new Date().toISOString().split('T')[0];
    const empLabel = `${run.first_name} ${run.last_name} (${run.employee_code})`;

    // 1. Post Accrual Journal Entry if not yet created
    let accrualJournalId = run.journal_entry_id;
    if (!accrualJournalId) {
      accrualJournalId = await postPayrollAccrualJournalEntry(
        connection,
        run.period_name,
        payDate,
        Number(run.gross_pay),
        Number(run.net_pay),
        Number(run.tax_deduction),
        Number(run.nssf_deduction),
        Number(run.nhif_deduction),
        Number(run.housing_levy_deduction),
        Number(run.sacco_welfare_deduction || 0),
        Number(run.other_deductions),
        createdBy,
        empLabel
      );
    }

    // 2. Post Disbursement Journal Entry (Debit 2125 Net Salary Payable, Credit Paying Account)
    const disbursementJournalId = await postPayrollDisbursementJournalEntry(
      connection,
      run.period_name,
      payDate,
      Number(run.net_pay),
      payment_account_id,
      payment_reference,
      notes || '',
      createdBy,
      empLabel
    );

    // 3. Mark run as paid with paying account & journal linkages
    await connection.query(
      `UPDATE payroll_runs SET 
        status = 'paid',
        paid_date = ?,
        payment_account_id = ?,
        payment_reference = ?,
        journal_entry_id = ?,
        payment_journal_entry_id = ?,
        notes = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE notes END
       WHERE id = ?`,
      [
        payDate,
        payment_account_id,
        payment_reference || null,
        accrualJournalId,
        disbursementJournalId,
        notes, notes, notes,
        id
      ]
    );

    await connection.commit();
    // Audit log
    try {
      const paidByName = (req as any).user?.name || (req as any).user?.email || 'System';
      const auditId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, details, ip_address) VALUES (?, ?, ?, 'PAY', 'Payroll', ?, ?, ?, '')`,
        [auditId, createdBy, paidByName, id, `Paid salary to ${empLabel}`, JSON.stringify({ run_id: id, net_pay: run.net_pay, emp: empLabel })]
      );
    } catch (_) {}
    res.json({
      success: true,
      message: `Payroll payment disbursed and posted to General Ledger for ${empLabel}`,
      journal_entry_id: accrualJournalId,
      payment_journal_entry_id: disbursementJournalId
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error paying payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. CLOSE a payroll period
// ─────────────────────────────────────────────────────────────────────────────
router.put('/periods/:id/close', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { id: periodId } = req.params;
  const createdBy = (req as any).user?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [periodRows]: any = await connection.query('SELECT * FROM payroll_periods WHERE id = ?', [periodId]);
    if (periodRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Payroll period not found' });
      return;
    }
    const period = periodRows[0];

    const [runsRows]: any = await connection.query(
      'SELECT * FROM payroll_runs WHERE payroll_period_id = ?', [periodId]
    );

    if (runsRows.length === 0) {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'No payroll runs found for this period. Generate payroll first.' });
      return;
    }

    const totalGross = runsRows.reduce((s: number, r: any) => s + Number(r.gross_pay || 0), 0);
    const totalNet = runsRows.reduce((s: number, r: any) => s + Number(r.net_pay || 0), 0);
    const totalTax = runsRows.reduce((s: number, r: any) => s + Number(r.tax_deduction || 0), 0);
    const totalNSSF = runsRows.reduce((s: number, r: any) => s + Number(r.nssf_deduction || 0), 0);
    const totalNHIF = runsRows.reduce((s: number, r: any) => s + Number(r.nhif_deduction || 0), 0);
    const totalHousingLevy = runsRows.reduce((s: number, r: any) => s + Number(r.housing_levy_deduction || 0), 0);
    const totalSacco = runsRows.reduce((s: number, r: any) => s + Number(r.sacco_welfare_deduction || 0), 0);

    // Update period status and totals
    await connection.query(
      `UPDATE payroll_periods SET 
        status = 'closed',
        total_gross_pay = ?, total_net_pay = ?, total_tax = ?,
        total_nhif = ?, total_nssf = ?, total_housing_levy = ?, total_sacco_welfare = ?
      WHERE id = ?`,
      [totalGross, totalNet, totalTax, totalNHIF, totalNSSF, totalHousingLevy, totalSacco, periodId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Payroll period closed' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error closing payroll period:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET payslip (single run with employee, period & payment details)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/runs/:id/payslip', authenticate, async (req, res): Promise<void> => {
  await ensurePayrollSchema();
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query(
      `SELECT 
        pr.*,
        e.first_name, e.last_name, e.email, e.position, e.department, e.code as employee_code,
        e.bank_name, e.bank_account, e.payment_method,
        e.nhif_number, e.nssf_number, e.tax_pin,
        pp.period_name, pp.start_date, pp.end_date, pp.pay_date as period_pay_date,
        pa.name as payment_account_name, pa.code as payment_account_code
       FROM payroll_runs pr
       LEFT JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
       LEFT JOIN accounts pa ON pr.payment_account_id = pa.id
       WHERE pr.id = ?`, [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }

    const row = rows[0];
    const payslip = {
      ...row,
      sacco_welfare_deduction: Number(row.sacco_welfare_deduction) || 0,
      employee: {
        id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        position: row.position,
        department: row.department,
        code: row.employee_code,
        bank_name: row.bank_name,
        bank_account: row.bank_account,
        payment_method: row.payment_method,
        nhif_number: row.nhif_number,
        nssf_number: row.nssf_number,
        tax_pin: row.tax_pin,
      },
      period: {
        period_name: row.period_name,
        start_date: row.start_date,
        end_date: row.end_date,
        pay_date: row.period_pay_date,
      },
      payment_account: row.payment_account_id ? {
        id: row.payment_account_id,
        name: row.payment_account_name,
        code: row.payment_account_code
      } : null
    };

    res.json({ success: true, data: payslip });
  } catch (error: any) {
    console.error('Error fetching payslip:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Summary stats for dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', authenticate, async (req, res): Promise<void> => {
  try {
    const [periodStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_periods,
        SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open_periods,
        SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) as processing_periods,
        SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed_periods
      FROM payroll_periods
    `);
    const [runStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft_runs,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved_runs,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_runs,
        SUM(gross_pay) as total_gross,
        SUM(net_pay) as total_net
      FROM payroll_runs
    `);

    res.json({
      success: true,
      data: { periods: periodStats[0], runs: runStats[0] }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P9 FORM - Annual tax deduction summary for an employee
// ─────────────────────────────────────────────────────────────────────────────
router.get('/employees/:id/p9', authenticate, async (req, res): Promise<void> => {
  const { id: employee_id } = req.params;
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear() - 1;
  try {
    const [empRows]: any = await pool.query('SELECT * FROM employees WHERE id = ?', [employee_id]);
    if (empRows.length === 0) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }
    const emp = empRows[0];

    const [bizRows]: any = await pool.query('SELECT * FROM business_settings LIMIT 1');
    const biz = bizRows[0] || {};

    const [runs]: any = await pool.query(`
      SELECT
        pr.gross_pay, pr.tax_deduction, pr.nhif_deduction, pr.nssf_deduction,
        pr.housing_levy_deduction, pr.sacco_welfare_deduction, pr.other_deductions, pr.net_pay,
        pp.period_name, pp.start_date
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
      WHERE pr.employee_id = ?
        AND pp.start_date >= ?
        AND pp.end_date <= ?
      ORDER BY pp.start_date ASC
    `, [employee_id, year + '-01-01', year + '-12-31']);

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    const monthly_data = runs.map((r: any) => {
      const d = new Date(r.start_date);
      return {
        month: d.getMonth() + 1,
        month_name: MONTHS[d.getMonth()],
        gross_pay: Number(r.gross_pay) || 0,
        tax_deduction: Number(r.tax_deduction) || 0,
        nhif_deduction: Number(r.nhif_deduction) || 0,
        nssf_deduction: Number(r.nssf_deduction) || 0,
        housing_levy_deduction: Number(r.housing_levy_deduction) || 0,
        sacco_welfare_deduction: Number(r.sacco_welfare_deduction) || 0,
        other_deductions: Number(r.other_deductions) || 0,
        net_pay: Number(r.net_pay) || 0,
        period_name: r.period_name,
      };
    });

    const totals = monthly_data.reduce((acc: any, m: any) => {
      acc.total_gross += m.gross_pay;
      acc.total_tax += m.tax_deduction;
      acc.total_nhif += m.nhif_deduction;
      acc.total_nssf += m.nssf_deduction;
      acc.total_housing_levy += m.housing_levy_deduction;
      acc.total_sacco_welfare += m.sacco_welfare_deduction;
      acc.total_net += m.net_pay;
      return acc;
    }, { total_gross: 0, total_tax: 0, total_nhif: 0, total_nssf: 0, total_housing_levy: 0, total_sacco_welfare: 0, total_net: 0 });

    res.json({
      success: true,
      year,
      employee_id,
      employee: {
        name: (emp.first_name + ' ' + emp.last_name).trim(),
        tax_pin: emp.tax_pin || '',
        nssf_number: emp.nssf_number || '',
        nhif_number: emp.nhif_number || '',
        department: emp.department || '',
        position: emp.position || '',
        code: emp.code || emp.employee_code || '',
      },
      business: {
        business_name: biz.business_name || '',
        kra_pin: biz.kra_pin || '',
      },
      monthly_data,
      totals,
    });
  } catch (error: any) {
    console.error('Error fetching P9 data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
