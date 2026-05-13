export interface PayrollSettings {
  id: string;
  business_id: string;
  pay_period: 'weekly' | 'bi-weekly' | 'monthly';
  pay_day: number; // Day of month/week for payment
  overtime_rate: number; // Multiplier for overtime (e.g., 1.5)
  holiday_pay_rate: number; // Multiplier for holiday pay
  tax_deduction_rate: number; // Percentage for tax deductions
  nhif_rate: number; // NHIF contribution rate
  nssf_rate: number; // NSSF contribution rate
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
  status: 'open' | 'processing' | 'closed';
  total_gross_pay: number;
  total_net_pay: number;
  total_tax: number;
  total_nhif: number;
  total_nssf: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollRun {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  overtime_hours: number;
  overtime_pay: number;
  holiday_hours: number;
  holiday_pay: number;
  allowances: number;
  bonuses: number;
  gross_pay: number;
  tax_deduction: number;
  nhif_deduction: number;
  nssf_deduction: number;
  other_deductions: number;
  net_pay: number;
  notes?: string;
  status: 'draft' | 'approved' | 'paid';
  paid_date?: string;
  journal_entry_id?: string; // Link to accounting
  created_by?: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  payroll_period?: PayrollPeriod;
}

export interface PayrollDeduction {
  id: string;
  payroll_run_id: string;
  deduction_type: 'loan' | 'advance' | 'insurance' | 'other';
  description: string;
  amount: number;
  created_at: string;
}

export interface PayrollAllowance {
  id: string;
  payroll_run_id: string;
  allowance_type: 'housing' | 'transport' | 'meal' | 'other';
  description: string;
  amount: number;
  created_at: string;
}

export interface PayrollReport {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  total_employees: number;
  total_gross_pay: number;
  total_net_pay: number;
  total_tax: number;
  total_nhif: number;
  total_nssf: number;
  total_overtime: number;
  total_holiday_pay: number;
  payroll_runs: PayrollRun[];
}

// Extended Employee interface for payroll
export interface EmployeePayrollInfo {
  id: string;
  employee_id: string;
  basic_salary: number;
  bank_name?: string;
  bank_account?: string;
  nhif_number?: string;
  nssf_number?: string;
  tax_pin?: string;
  payment_method: 'bank' | 'cash' | 'mpesa';
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

// Payroll Journal Entry types for accounting integration
export interface PayrollJournalEntry {
  id: string;
  payroll_period_id: string;
  entry_date: string;
  description: string;
  total_amount: number;
  status: 'draft' | 'posted';
  created_by?: string;
  created_at: string;
  updated_at: string;
  lines: PayrollJournalLine[];
}

export interface PayrollJournalLine {
  id: string;
  payroll_journal_id: string;
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  created_at: string;
  account?: Account;
} 