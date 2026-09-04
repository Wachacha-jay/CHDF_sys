export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  role?: string;
  permissions?: string[];
  avatar?: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export type UserRoleName = 'Super Admin' | 'Admin' | 'Manager' | 'Cashier' | 'Accountant' | string;

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  business_website?: string;
  logo_url?: string;
  favicon_url?: string;
  default_currency: string;
  tax_rate: number;
  receipt_prefix: string;
  invoice_prefix: string;
  product_code_prefix: string;
  customer_code_prefix: string;
  supplier_code_prefix: string;
  employee_code_prefix: string;
  fiscal_year_start: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  code?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  children?: Category[];
  parent?: Category;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  unit_id?: string;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  maximum_stock?: number;
  barcode?: string;
  sku?: string;
  image_url?: string;
  is_active: boolean;
  is_service: boolean;
  tax_rate: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  subcategory?: Category;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_number?: string;
  credit_limit: number;
  payment_terms: number;
  is_active: boolean;
  total_orders?: number;
  total_spent?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  organization_name?: string;
  bank_name?: string;
  account_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_number?: string;
  payment_terms: number;
  is_active: boolean;
  total_orders?: number;
  total_purchases?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  user_id?: string;
  code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  department?: string;
  position?: string;
  designation_id?: string;
  salary?: number;
  hire_date?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  basic_salary?: number;
  bank_name?: string;
  bank_account?: string;
  nhif_number?: string;
  nssf_number?: string;
  tax_pin?: string;
  payment_method?: 'bank' | 'cash' | 'mpesa';
}

export interface AccountCategory {
  id: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  category_id?: string;
  account_subtype?: string;
  parent_id?: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  children?: Account[];
  parent?: Account;
  category?: AccountCategory;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  department_id?: string;
  child_id?: string;
  donor_id?: string;
  fund_id?: string;
  sponsor_id?: string;
  created_at: string;
  account?: Account;
  is_reconciled?: boolean;
  bank_reconciliation_id?: string;
}

export interface BankReconciliation {
  id: string;
  account_id: string;
  statement_date: string;
  statement_balance: number;
  ledger_balance: number;
  difference: number;
  status: 'draft' | 'completed';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface UnitOfMeasure {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Designation {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id: string;
  sale_number: string;
  sale_type?: 'standard' | 'school_fees' | 'child_support' | 'sponsorship';
  customer_id?: string;
  sale_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  payment_method?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: SaleItem[];
  department_id?: string;
  child_id?: string;
  donor_id?: string;
  fund_id?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  product?: Product;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id?: string;
  purchase_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  product?: Product;
}

export interface Expense {
  id: string;
  expense_number: string;
  account_id: string;
  supplier_id?: string;
  expense_date: string;
  amount: number;
  tax_amount: number;
  description: string;
  reference?: string;
  created_at: string;
  updated_at: string;
  department_id?: string;
  child_id?: string;
  donor_id?: string;
  fund_id?: string;
  account?: Account;
  payment_account?: Account;
  supplier?: Supplier;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  unit_cost?: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_by?: string;
  created_at: string;
  product?: Product;
}

export interface DashboardStats {
  totalSales: number;
  todaySales: number;
  totalProducts: number;
  lowStockItems: number;
  totalCustomers: number;
  totalEmployees: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  // NGO Metrics
  totalChildren: number;
  activeSponsorships: number;
  totalDonationsMonth: number;
  restrictedFundBalance: number;
}

export interface BalanceSheetData {
  assets: {
    current_assets: { name: string; amount: number }[];
    fixed_assets: { name: string; amount: number }[];
    total_assets: number;
  };
  liabilities: {
    current_liabilities: { name: string; amount: number }[];
    long_term_liabilities: { name: string; amount: number }[];
    total_liabilities: number;
  };
  equity: {
    equity_accounts: { name: string; amount: number }[];
    total_equity: number;
  };
}

export interface TrialBalanceData {
  account_code: string;
  account_name: string;
  debit_balance: number;
  credit_balance: number;
}

export interface PayrollSettings {
  id: string;
  business_id: string;
  pay_period: 'weekly' | 'bi-weekly' | 'monthly';
  pay_day: number;
  overtime_rate: number;
  holiday_pay_rate: number;
  tax_deduction_rate: number;
  nhif_rate: number;
  nssf_rate: number;
  housing_levy_rate: number;
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
  total_housing_levy: number;
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
  housing_levy_deduction: number;
  other_deductions: number;
  net_pay: number;
  notes?: string;
  status: 'draft' | 'approved' | 'paid';
  paid_date?: string;
  journal_entry_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  payroll_period?: PayrollPeriod;
  department_id?: string;
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
  total_housing_levy: number;
  total_overtime: number;
  total_holiday_pay: number;
  payroll_runs: PayrollRun[];
}

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

export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  class_name?: string;
  disability_type?: string;
  guardian_id?: string;
  status: 'active' | 'graduated' | 'inactive';
  enrollment_date: string;
  created_at: string;
  updated_at: string;
  guardian?: Guardian;
}

export interface DonorCluster {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Donor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  donor_type: 'individual' | 'corporate' | 'foundation';
  cluster_id?: string;
  cluster?: DonorCluster;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sponsor {
  id: string;
  donor_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  donor?: Donor;
}

export interface FundAccount {
  id: string;
  name: string;
  code: string;
  description?: string;
  restriction_type: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sponsorship {
  id: string;
  child_id: string;
  sponsor_id: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  status: 'active' | 'cancelled' | 'on_hold';
  created_at: string;
  updated_at: string;
  child?: Child;
  sponsor?: Sponsor;
}

export interface Donation {
  id: string;
  donor_id: string;
  fund_id?: string;
  amount: number;
  currency: string;
  donation_date: string;
  payment_method: string;
  reference_number?: string;
  is_anonymous: boolean;
  restricted_to_child_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  donor?: Donor;
  fund?: FundAccount;
  child?: Child;
}

export interface InternalTransfer {
  id: string;
  from_department_id: string;
  to_department_id: string;
  amount: number;
  transfer_date: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  from_department?: Department;
  to_department?: Department;
}

export interface FixedAsset {
  id: string;
  asset_name: string;
  description?: string;
  serial_number?: string;
  asset_type?: string;
  purchase_date: string;
  purchase_cost: number;
  current_value: number;
  salvage_value?: number;
  useful_life_years?: number;
  department_id?: string;
  status: 'Active' | 'Disposed' | 'Maintenance';
  created_at: string;
  updated_at: string;
  department?: Department;
}