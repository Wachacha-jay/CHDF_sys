import type { PayrollRun, PayrollPeriod, PayrollJournalEntry, PayrollJournalLine, Account } from '../types';

export interface PayrollJournalData {
  payroll_expense_account: string;
  payroll_liability_account: string;
  tax_payable_account: string;
  nhif_payable_account: string;
  nssf_payable_account: string;
  bank_account: string;
}

export class PayrollAccountingUtils {
  /**
   * Create journal entry for payroll processing
   */
  static createPayrollJournalEntry(
    payrollRuns: PayrollRun[],
    period: PayrollPeriod,
    accounts: PayrollJournalData
  ): PayrollJournalEntry {
    const totalGrossPay = payrollRuns.reduce((sum, run) => sum + run.gross_pay, 0);
    const totalTax = payrollRuns.reduce((sum, run) => sum + run.tax_deduction, 0);
    const totalNHIF = payrollRuns.reduce((sum, run) => sum + run.nhif_deduction, 0);
    const totalNSSF = payrollRuns.reduce((sum, run) => sum + run.nssf_deduction, 0);
    const totalNetPay = payrollRuns.reduce((sum, run) => sum + run.net_pay, 0);

    const lines: PayrollJournalLine[] = [];

    // Debit: Payroll Expense (Gross Pay)
    lines.push({
      id: '',
      payroll_journal_id: '',
      account_id: accounts.payroll_expense_account,
      description: `Payroll expense for ${period.period_name}`,
      debit_amount: totalGrossPay,
      credit_amount: 0,
      created_at: new Date().toISOString()
    });

    // Credit: Payroll Liability (Net Pay)
    lines.push({
      id: '',
      payroll_journal_id: '',
      account_id: accounts.payroll_liability_account,
      description: `Net pay liability for ${period.period_name}`,
      debit_amount: 0,
      credit_amount: totalNetPay,
      created_at: new Date().toISOString()
    });

    // Credit: Tax Payable
    if (totalTax > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.tax_payable_account,
        description: `Tax payable for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalTax,
        created_at: new Date().toISOString()
      });
    }

    // Credit: NHIF Payable
    if (totalNHIF > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.nhif_payable_account,
        description: `NHIF payable for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalNHIF,
        created_at: new Date().toISOString()
      });
    }

    // Credit: NSSF Payable
    if (totalNSSF > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.nssf_payable_account,
        description: `NSSF payable for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalNSSF,
        created_at: new Date().toISOString()
      });
    }

    return {
      id: '',
      payroll_period_id: period.id,
      entry_date: period.pay_date,
      description: `Payroll journal entry for ${period.period_name}`,
      total_amount: totalGrossPay,
      status: 'draft',
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lines
    };
  }

  /**
   * Create journal entry for payroll payment
   */
  static createPayrollPaymentJournalEntry(
    payrollRuns: PayrollRun[],
    period: PayrollPeriod,
    accounts: PayrollJournalData
  ): PayrollJournalEntry {
    const totalNetPay = payrollRuns.reduce((sum, run) => sum + run.net_pay, 0);

    const lines: PayrollJournalLine[] = [];

    // Debit: Payroll Liability
    lines.push({
      id: '',
      payroll_journal_id: '',
      account_id: accounts.payroll_liability_account,
      description: `Payroll payment for ${period.period_name}`,
      debit_amount: totalNetPay,
      credit_amount: 0,
      created_at: new Date().toISOString()
    });

    // Credit: Bank Account
    lines.push({
      id: '',
      payroll_journal_id: '',
      account_id: accounts.bank_account,
      description: `Payroll payment for ${period.period_name}`,
      debit_amount: 0,
      credit_amount: totalNetPay,
      created_at: new Date().toISOString()
    });

    return {
      id: '',
      payroll_period_id: period.id,
      entry_date: period.pay_date,
      description: `Payroll payment for ${period.period_name}`,
      total_amount: totalNetPay,
      status: 'draft',
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lines
    };
  }

  /**
   * Create journal entry for tax payments
   */
  static createTaxPaymentJournalEntry(
    period: PayrollPeriod,
    accounts: PayrollJournalData,
    taxAmount: number,
    nhifAmount: number,
    nssfAmount: number
  ): PayrollJournalEntry {
    const totalPayments = taxAmount + nhifAmount + nssfAmount;
    const lines: PayrollJournalLine[] = [];

    // Debit: Tax Payable
    if (taxAmount > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.tax_payable_account,
        description: `Tax payment for ${period.period_name}`,
        debit_amount: taxAmount,
        credit_amount: 0,
        created_at: new Date().toISOString()
      });
    }

    // Debit: NHIF Payable
    if (nhifAmount > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.nhif_payable_account,
        description: `NHIF payment for ${period.period_name}`,
        debit_amount: nhifAmount,
        credit_amount: 0,
        created_at: new Date().toISOString()
      });
    }

    // Debit: NSSF Payable
    if (nssfAmount > 0) {
      lines.push({
        id: '',
        payroll_journal_id: '',
        account_id: accounts.nssf_payable_account,
        description: `NSSF payment for ${period.period_name}`,
        debit_amount: nssfAmount,
        credit_amount: 0,
        created_at: new Date().toISOString()
      });
    }

    // Credit: Bank Account
    lines.push({
      id: '',
      payroll_journal_id: '',
      account_id: accounts.bank_account,
      description: `Tax and insurance payments for ${period.period_name}`,
      debit_amount: 0,
      credit_amount: totalPayments,
      created_at: new Date().toISOString()
    });

    return {
      id: '',
      payroll_period_id: period.id,
      entry_date: period.pay_date,
      description: `Tax and insurance payments for ${period.period_name}`,
      total_amount: totalPayments,
      status: 'draft',
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lines
    };
  }

  /**
   * Validate journal entry balance
   */
  static validateJournalEntry(entry: PayrollJournalEntry): boolean {
    const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit_amount, 0);
    const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit_amount, 0);
    
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for small rounding differences
  }

  /**
   * Get default payroll accounts (these would typically come from settings)
   */
  static getDefaultPayrollAccounts(): PayrollJournalData {
    return {
      payroll_expense_account: 'payroll-expense',
      payroll_liability_account: 'payroll-liability',
      tax_payable_account: 'tax-payable',
      nhif_payable_account: 'nhif-payable',
      nssf_payable_account: 'nssf-payable',
      bank_account: 'bank-account'
    };
  }

  /**
   * Calculate payroll summary for reporting
   */
  static calculatePayrollSummary(payrollRuns: PayrollRun[]) {
    return {
      totalEmployees: payrollRuns.length,
      totalGrossPay: payrollRuns.reduce((sum, run) => sum + run.gross_pay, 0),
      totalNetPay: payrollRuns.reduce((sum, run) => sum + run.net_pay, 0),
      totalTax: payrollRuns.reduce((sum, run) => sum + run.tax_deduction, 0),
      totalNHIF: payrollRuns.reduce((sum, run) => sum + run.nhif_deduction, 0),
      totalNSSF: payrollRuns.reduce((sum, run) => sum + run.nssf_deduction, 0),
      totalOvertime: payrollRuns.reduce((sum, run) => sum + run.overtime_pay, 0),
      totalHolidayPay: payrollRuns.reduce((sum, run) => sum + run.holiday_pay, 0),
      totalAllowances: payrollRuns.reduce((sum, run) => sum + run.allowances, 0),
      totalBonuses: payrollRuns.reduce((sum, run) => sum + run.bonuses, 0),
      totalOtherDeductions: payrollRuns.reduce((sum, run) => sum + run.other_deductions, 0)
    };
  }
} 