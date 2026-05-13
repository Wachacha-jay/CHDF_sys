import { Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: fetch payroll settings (with defaults)
// ─────────────────────────────────────────────────────────────────────────────
async function getSettings() {
  const [rows]: any = await pool.query('SELECT * FROM payroll_settings LIMIT 1');
  return rows[0] || {
    overtime_rate: 1.5,
    holiday_pay_rate: 2.0,
    tax_deduction_rate: 30.0,
    nhif_rate: 2.5,
    nssf_rate: 6.0,
    housing_levy_rate: 1.5
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: create a payroll journal entry in the accounts system
// ─────────────────────────────────────────────────────────────────────────────
async function postPayrollJournalEntry(
  connection: any,
  periodId: string,
  periodName: string,
  payDate: string,
  totalGross: number,
  totalNet: number,
  totalTax: number,
  totalNSSF: number,
  totalNHIF: number,
  totalHousingLevy: number,
  createdBy: string
) {
  // Find account IDs by code
  const accountCodes = ['5210', '2125', '2121', '2122', '2123', '2124'];
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

  if (!salaryExpenseId || !netSalaryPayableId) {
    console.warn('Payroll accounts (5210, 2125) not found — skipping journal entry');
    return null;
  }

  const journalId = crypto.randomUUID();
  const entryNumber = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;

  await connection.query(
    `INSERT INTO journal_entries (id, entry_number, entry_date, description, reference, total_debit, total_credit, is_posted, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      journalId,
      entryNumber,
      payDate,
      `Payroll processing for ${periodName}`,
      periodName,
      totalGross,
      totalGross,
      createdBy
    ]
  );

  const lines = [
    { account_id: salaryExpenseId,   description: `Gross Salary - ${periodName}`, debit: totalGross, credit: 0 },
    { account_id: netSalaryPayableId, description: `Net Salary Payable - ${periodName}`, debit: 0, credit: totalNet },
  ];

  if (totalTax > 0 && payeId)         lines.push({ account_id: payeId,          description: `PAYE - ${periodName}`,         debit: 0, credit: totalTax });
  if (totalNSSF > 0 && nssfId)        lines.push({ account_id: nssfId,           description: `NSSF - ${periodName}`,         debit: 0, credit: totalNSSF });
  if (totalNHIF > 0 && nhifId)        lines.push({ account_id: nhifId,           description: `NHIF/SHIF - ${periodName}`,    debit: 0, credit: totalNHIF });
  if (totalHousingLevy > 0 && housingLevyId) lines.push({ account_id: housingLevyId, description: `Housing Levy - ${periodName}`, debit: 0, credit: totalHousingLevy });

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
// 1. GET payroll runs with employee info joined
// ─────────────────────────────────────────────────────────────────────────────
router.get('/runs', authenticate, async (req, res): Promise<void> => {
  const { payroll_period_id } = req.query;
  try {
    let query = `
      SELECT 
        pr.*,
        e.first_name, e.last_name, e.email, e.position, e.department, e.code as employee_code,
        e.bank_name, e.bank_account, e.payment_method
      FROM payroll_runs pr
      LEFT JOIN employees e ON pr.employee_id = e.id
    `;
    const params: any[] = [];

    if (payroll_period_id) {
      query += ' WHERE pr.payroll_period_id = ?';
      params.push(payroll_period_id);
    }

    query += ' ORDER BY e.first_name, e.last_name';

    const [rows]: any = await pool.query(query, params);

    // Shape each row so the frontend gets run + nested employee object
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
      other_deductions: Number(row.other_deductions) || 0,
      net_pay: Number(row.net_pay) || 0,
      notes: row.notes,
      status: row.status,
      paid_date: row.paid_date,
      journal_entry_id: row.journal_entry_id,
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
// 2. Generate Payroll for a period
// ─────────────────────────────────────────────────────────────────────────────
router.post('/periods/:id/generate', authenticate, async (req, res): Promise<void> => {
  const { id: periodId } = req.params;
  const createdBy = (req as any).user?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check period exists
    const [periodRows]: any = await connection.query('SELECT * FROM payroll_periods WHERE id = ?', [periodId]);
    if (periodRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Payroll period not found' });
      return;
    }
    const period = periodRows[0];

    // Check not already generated
    const [existingRuns]: any = await connection.query('SELECT id FROM payroll_runs WHERE payroll_period_id = ?', [periodId]);
    if (existingRuns.length > 0) {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'Payroll already generated for this period' });
      return;
    }

    const settings = await getSettings();

    // Get all active employees with a salary
    const [employees]: any = await connection.query(
      'SELECT * FROM employees WHERE is_active = 1'
    );

    if (employees.length === 0) {
      await connection.rollback();
      res.json({ success: true, message: 'No active employees to process', generated: 0 });
      return;
    }

    let grandGross = 0, grandNet = 0, grandTax = 0;
    let grandNHIF = 0, grandNSSF = 0, grandHousingLevy = 0;

    for (const emp of employees) {
      const basicSalary = Number(emp.basic_salary) || 0;
      const grossPay = basicSalary;
      const taxDeduction = (grossPay * (Number(settings.tax_deduction_rate) || 30)) / 100;
      const nhifDeduction = (grossPay * (Number(settings.nhif_rate) || 2.5)) / 100;
      const nssfDeduction = (grossPay * (Number(settings.nssf_rate) || 6.0)) / 100;
      const housingLevy = (grossPay * (Number(settings.housing_levy_rate) || 1.5)) / 100;
      const netPay = grossPay - taxDeduction - nhifDeduction - nssfDeduction - housingLevy;

      const runId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO payroll_runs (
          id, payroll_period_id, employee_id, basic_salary,
          overtime_hours, overtime_pay, holiday_hours, holiday_pay, allowances, bonuses,
          gross_pay, tax_deduction, nhif_deduction, nssf_deduction, housing_levy_deduction, other_deductions,
          net_pay, notes, status, created_by
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, 0, ?, 'Auto-generated', 'draft', ?)`,
        [runId, periodId, emp.id, basicSalary, grossPay, taxDeduction, nhifDeduction, nssfDeduction, housingLevy, netPay, createdBy]
      );

      grandGross += grossPay;
      grandNet += netPay;
      grandTax += taxDeduction;
      grandNHIF += nhifDeduction;
      grandNSSF += nssfDeduction;
      grandHousingLevy += housingLevy;
    }

    // Update period totals & set to processing
    await connection.query(
      `UPDATE payroll_periods SET 
        total_gross_pay = ?, total_net_pay = ?, total_tax = ?,
        total_nhif = ?, total_nssf = ?, total_housing_levy = ?,
        status = 'processing'
      WHERE id = ?`,
      [grandGross, grandNet, grandTax, grandNHIF, grandNSSF, grandHousingLevy, periodId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Payroll generated for ${employees.length} employee(s)`,
      generated: employees.length,
      totals: { grandGross, grandNet, grandTax, grandNHIF, grandNSSF, grandHousingLevy }
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
// 3. Update a single payroll run (OT, allowances, bonuses, deductions)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/runs/:id', authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;

  try {
    const [runRows]: any = await pool.query('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    if (runRows.length === 0) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }
    const run = runRows[0];
    const settings = await getSettings();

    const otHours = req.body.overtime_hours !== undefined ? Number(req.body.overtime_hours) : Number(run.overtime_hours);
    const holHours = req.body.holiday_hours !== undefined ? Number(req.body.holiday_hours) : Number(run.holiday_hours);
    const allow = req.body.allowances !== undefined ? Number(req.body.allowances) : Number(run.allowances);
    const bonus = req.body.bonuses !== undefined ? Number(req.body.bonuses) : Number(run.bonuses);
    const otherDed = req.body.other_deductions !== undefined ? Number(req.body.other_deductions) : Number(run.other_deductions);
    const notes = req.body.notes !== undefined ? req.body.notes : run.notes;
    const basicSalary = Number(run.basic_salary) || 0;

    const hourlyRate = basicSalary / 160;
    const overtimePay = otHours * hourlyRate * Number(settings.overtime_rate);
    const holidayPay = holHours * hourlyRate * Number(settings.holiday_pay_rate);
    const grossPay = basicSalary + overtimePay + holidayPay + allow + bonus;
    const taxDeduction = (grossPay * Number(settings.tax_deduction_rate)) / 100;
    const nhifDeduction = (grossPay * Number(settings.nhif_rate)) / 100;
    const nssfDeduction = (grossPay * Number(settings.nssf_rate)) / 100;
    const housingLevy = (grossPay * Number(settings.housing_levy_rate)) / 100;
    const netPay = grossPay - taxDeduction - nhifDeduction - nssfDeduction - housingLevy - otherDed;

    await pool.query(
      `UPDATE payroll_runs SET
        overtime_hours = ?, overtime_pay = ?, holiday_hours = ?, holiday_pay = ?,
        allowances = ?, bonuses = ?, gross_pay = ?, tax_deduction = ?,
        nhif_deduction = ?, nssf_deduction = ?, housing_levy_deduction = ?,
        other_deductions = ?, net_pay = ?, notes = ?
      WHERE id = ?`,
      [otHours, overtimePay, holHours, holidayPay, allow, bonus, grossPay, taxDeduction,
       nhifDeduction, nssfDeduction, housingLevy, otherDed, netPay, notes, id]
    );

    // Recalculate period totals
    const [periodRuns]: any = await pool.query(
      'SELECT payroll_period_id FROM payroll_runs WHERE id = ?', [id]
    );
    if (periodRuns.length > 0) {
      const pId = periodRuns[0].payroll_period_id;
      const [totals]: any = await pool.query(
        `SELECT SUM(gross_pay) as tg, SUM(net_pay) as tn, SUM(tax_deduction) as tt,
                SUM(nhif_deduction) as tnhif, SUM(nssf_deduction) as tnssf, SUM(housing_levy_deduction) as thl
         FROM payroll_runs WHERE payroll_period_id = ?`, [pId]
      );
      if (totals.length > 0) {
        await pool.query(
          `UPDATE payroll_periods SET total_gross_pay=?, total_net_pay=?, total_tax=?,
           total_nhif=?, total_nssf=?, total_housing_levy=? WHERE id=?`,
          [totals[0].tg||0, totals[0].tn||0, totals[0].tt||0,
           totals[0].tnhif||0, totals[0].tnssf||0, totals[0].thl||0, pId]
        );
      }
    }

    const [updated]: any = await pool.query('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payroll run updated', data: updated[0] });
  } catch (error: any) {
    console.error('Error updating payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Approve a payroll run (draft → approved)
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
    await pool.query('UPDATE payroll_runs SET status = ? WHERE id = ?', ['approved', id]);
    res.json({ success: true, message: 'Payroll run approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mark a payroll run as paid (approved → paid) — posts journal entry
// ─────────────────────────────────────────────────────────────────────────────
router.put('/runs/:id/pay', authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const createdBy = (req as any).user?.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      `SELECT pr.*, pp.period_name, pp.pay_date
       FROM payroll_runs pr
       JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
       WHERE pr.id = ?`, [id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }
    if (rows[0].status !== 'approved') {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'Only approved runs can be marked as paid' });
      return;
    }

    const run = rows[0];
    const payDate = run.pay_date || new Date().toISOString().split('T')[0];

    // Create per-employee journal entry
    const journalId = await postPayrollJournalEntry(
      connection,
      run.payroll_period_id,
      run.period_name,
      payDate,
      Number(run.gross_pay),
      Number(run.net_pay),
      Number(run.tax_deduction),
      Number(run.nssf_deduction),
      Number(run.nhif_deduction),
      Number(run.housing_levy_deduction),
      createdBy
    );

    await connection.query(
      'UPDATE payroll_runs SET status = ?, paid_date = NOW(), journal_entry_id = ? WHERE id = ?',
      ['paid', journalId, id]
    );

    await connection.commit();
    res.json({ success: true, message: 'Payroll run marked as paid', journal_entry_id: journalId });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error paying payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Close a payroll period — posts consolidated journal entry
// ─────────────────────────────────────────────────────────────────────────────
router.put('/periods/:id/close', authenticate, async (req, res): Promise<void> => {
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

    // Get totals from all runs in this period
    const [runsRows]: any = await connection.query(
      'SELECT * FROM payroll_runs WHERE payroll_period_id = ?', [periodId]
    );

    if (runsRows.length === 0) {
      await connection.rollback();
      res.status(400).json({ success: false, error: 'No payroll runs found for this period. Generate payroll first.' });
      return;
    }

    const totalGross = runsRows.reduce((s: number, r: any) => s + Number(r.gross_pay), 0);
    const totalNet = runsRows.reduce((s: number, r: any) => s + Number(r.net_pay), 0);
    const totalTax = runsRows.reduce((s: number, r: any) => s + Number(r.tax_deduction), 0);
    const totalNSSF = runsRows.reduce((s: number, r: any) => s + Number(r.nssf_deduction), 0);
    const totalNHIF = runsRows.reduce((s: number, r: any) => s + Number(r.nhif_deduction), 0);
    const totalHousingLevy = runsRows.reduce((s: number, r: any) => s + Number(r.housing_levy_deduction), 0);

    const payDate = period.pay_date || new Date().toISOString().split('T')[0];

    // Post consolidated journal entry for the whole period
    const journalId = await postPayrollJournalEntry(
      connection, periodId, period.period_name, payDate,
      totalGross, totalNet, totalTax, totalNSSF, totalNHIF, totalHousingLevy, createdBy
    );

    // Update period status and totals
    await connection.query(
      `UPDATE payroll_periods SET 
        status = 'closed',
        total_gross_pay = ?, total_net_pay = ?, total_tax = ?,
        total_nhif = ?, total_nssf = ?, total_housing_levy = ?
      WHERE id = ?`,
      [totalGross, totalNet, totalTax, totalNHIF, totalNSSF, totalHousingLevy, periodId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Payroll period closed and journal entry posted', journal_entry_id: journalId });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error closing payroll period:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Get payslip (single run with employee details)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/runs/:id/payslip', authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query(
      `SELECT 
        pr.*,
        e.first_name, e.last_name, e.email, e.position, e.department, e.code as employee_code,
        e.bank_name, e.bank_account, e.payment_method,
        e.nhif_number, e.nssf_number, e.tax_pin,
        pp.period_name, pp.start_date, pp.end_date, pp.pay_date
       FROM payroll_runs pr
       LEFT JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
       WHERE pr.id = ?`, [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }

    const row = rows[0];
    const payslip = {
      ...row,
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
        pay_date: row.pay_date,
      }
    };

    res.json({ success: true, data: payslip });
  } catch (error: any) {
    console.error('Error fetching payslip:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Summary stats for dashboard
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

export default router;
