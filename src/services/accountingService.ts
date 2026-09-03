import { ApiService } from './api';
import { Account, AccountCategory, JournalEntry, JournalEntryLine, BalanceSheetData, TrialBalanceData } from '../types';

export interface JournalEntryData {
  entry_date: string;
  description: string;
  reference?: string;
  lines: Array<{
    account_id: string;
    description?: string;
    debit_amount?: number;
    credit_amount?: number;
    department_id?: string;
    child_id?: string;
    donor_id?: string;
    fund_id?: string;
    sponsor_id?: string;
  }>;
}

export interface AccountFilters {
  account_type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_active?: boolean;
  parent_id?: string;
}

export const DEFAULT_ACCOUNT_CATEGORIES: AccountCategory[] = [
  // Assets
  { id: 'cat-asset-1', name: 'Current Assets', account_type: 'asset', description: 'Cash, Bank, AR, Inventory', created_at: '', updated_at: '' },
  { id: 'cat-asset-2', name: 'Fixed Assets', account_type: 'asset', description: 'Equipment, Vehicles, Furniture', created_at: '', updated_at: '' },
  { id: 'cat-asset-3', name: 'Intangible Assets', account_type: 'asset', description: 'Software, Patents, Goodwill', created_at: '', updated_at: '' },
  
  // Liabilities
  { id: 'cat-liab-1', name: 'Current Liabilities', account_type: 'liability', description: 'Accounts Payable, Short-term Loans', created_at: '', updated_at: '' },
  { id: 'cat-liab-2', name: 'Long-term Liabilities', account_type: 'liability', description: 'Long-term Loans, Mortgages', created_at: '', updated_at: '' },
  { id: 'cat-liab-3', name: 'Statutory & Tax Liabilities', account_type: 'liability', description: 'PAYE, NSSF, NHIF/SHIF, Housing Levy', created_at: '', updated_at: '' },

  // Equity
  { id: 'cat-equity-1', name: 'Owner\'s Equity', account_type: 'equity', description: 'Capital and Owner Funds', created_at: '', updated_at: '' },
  { id: 'cat-equity-2', name: 'Retained Earnings', account_type: 'equity', description: 'Accumulated Profits/Losses', created_at: '', updated_at: '' },
  { id: 'cat-equity-3', name: 'Reserves & Net Assets', account_type: 'equity', description: 'Restricted & Unrestricted Net Assets', created_at: '', updated_at: '' },

  // Revenue
  { id: 'cat-rev-1', name: 'Sales Revenue', account_type: 'revenue', description: 'Income from primary sales', created_at: '', updated_at: '' },
  { id: 'cat-rev-2', name: 'Donations & Grants', account_type: 'revenue', description: 'NGO donations, sponsorships, grants', created_at: '', updated_at: '' },
  { id: 'cat-rev-3', name: 'Other Income', account_type: 'revenue', description: 'Secondary or non-operating income', created_at: '', updated_at: '' },

  // Expenses
  { id: 'cat-exp-1', name: 'Operating Expenses', account_type: 'expense', description: 'Rent, Utilities, Office Supplies', created_at: '', updated_at: '' },
  { id: 'cat-exp-2', name: 'Cost of Goods Sold', account_type: 'expense', description: 'Direct inventory/COGS costs', created_at: '', updated_at: '' },
  { id: 'cat-exp-3', name: 'Payroll & Salaries', account_type: 'expense', description: 'Basic salaries, wages, allowances', created_at: '', updated_at: '' },
  { id: 'cat-exp-4', name: 'Program Expenses', account_type: 'expense', description: 'Education, health, social welfare programs', created_at: '', updated_at: '' },
];

export class AccountingService {
  // Account operations
  static async getAccounts(filters?: AccountFilters): Promise<Account[]> {
    let apiFilters: Record<string, any> = {};
    
    if (filters?.account_type) apiFilters.account_type = filters.account_type;
    if (filters?.is_active !== undefined) apiFilters.is_active = filters.is_active;
    if (filters?.parent_id) apiFilters.parent_id = filters.parent_id;

    const response = await ApiService.get<Account>('accounts', {
      filters: apiFilters,
      orderBy: { column: 'code', ascending: true }
    });

    if (response.success && response.data) {
      return this.buildAccountTree(response.data);
    }

    return [];
  }

  static async getAccountById(id: string): Promise<Account | null> {
    const response = await ApiService.getById<Account>('accounts', id);
    return response.success ? response.data : null;
  }

  static async createAccount(account: Partial<Account>): Promise<Account | null> {
    const response = await ApiService.create<Account>('accounts', account);
    return response.success ? response.data : null;
  }

  static async updateAccount(id: string, account: Partial<Account>): Promise<Account | null> {
    const response = await ApiService.update<Account>('accounts', id, {
      ...account,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteAccount(id: string): Promise<boolean> {
    const response = await ApiService.delete('accounts', id);
    return response.success;
  }

  // Account Category operations
  static async getAccountCategories(filters?: { account_type?: string }): Promise<AccountCategory[]> {
    try {
      const response = await ApiService.get<AccountCategory>('account_categories', {
        filters,
        orderBy: { column: 'name', ascending: true }
      });
      if (response.success && response.data && response.data.length > 0) {
        return response.data;
      }
    } catch (error) {
      console.warn('Failed to fetch account categories from API, using defaults:', error);
    }

    // Fallback to default categories if API response is empty or fails
    if (filters?.account_type) {
      return DEFAULT_ACCOUNT_CATEGORIES.filter(c => c.account_type.toLowerCase() === filters.account_type?.toLowerCase());
    }
    return DEFAULT_ACCOUNT_CATEGORIES;
  }

  static async createAccountCategory(category: Partial<AccountCategory>): Promise<AccountCategory | null> {
    const response = await ApiService.create<AccountCategory>('account_categories', category);
    return response.success ? response.data : null;
  }

  static async updateAccountCategory(id: string, category: Partial<AccountCategory>): Promise<AccountCategory | null> {
    const response = await ApiService.update<AccountCategory>('account_categories', id, {
      ...category,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteAccountCategory(id: string): Promise<boolean> {
    const response = await ApiService.delete('account_categories', id);
    return response.success;
  }

  // Journal Entry operations
  static async getJournalEntries(filters?: {
    start_date?: string;
    end_date?: string;
    is_posted?: boolean;
    search?: string;
  }, options?: {
    limit?: number;
    offset?: number;
  }): Promise<JournalEntry[]> {
    let apiFilters: Record<string, any> = {};
    if (filters?.is_posted !== undefined) apiFilters.is_posted = filters.is_posted;

    const response = await ApiService.get<JournalEntry>('journal_entries', {
      filters: apiFilters,
      orderBy: { column: 'entry_date', ascending: false },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let entries = response.data;
      
      // Apply date filters
      if (filters?.start_date) {
        entries = entries.filter(entry => entry.entry_date >= filters.start_date!);
      }
      if (filters?.end_date) {
        entries = entries.filter(entry => entry.entry_date <= filters.end_date!);
      }

      // Fetch lines for all entries
      const allLinesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines');
      const allAccountsResponse = await ApiService.get<Account>('accounts');
      
      const allLines = allLinesResponse.success ? (allLinesResponse.data || []) : [];
      const allAccounts = allAccountsResponse.success ? (allAccountsResponse.data || []) : [];
      const accountMap = new Map(allAccounts.map(a => [a.id, a]));

      entries = entries.map(entry => {
        const lines = allLines
          .filter(l => l.journal_entry_id === entry.id)
          .map(l => ({
            ...l,
            account: accountMap.get(l.account_id)
          }));
        return { ...entry, lines };
      });

      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        entries = entries.filter(entry => 
          entry.entry_number.toLowerCase().includes(searchTerm) ||
          entry.description.toLowerCase().includes(searchTerm) ||
          entry.reference?.toLowerCase().includes(searchTerm)
        );
      }

      return entries;
    }

    return [];
  }

  static async getJournalEntryById(id: string): Promise<JournalEntry | null> {
    const response = await ApiService.getById<JournalEntry>('journal_entries', id);
    if (response.success && response.data) {
      const entry = response.data;
      const linesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines', {
        filters: { journal_entry_id: id }
      });
      
      const lines = linesResponse.success ? (linesResponse.data || []) : [];
      
      // Attach accounts to lines
      for (const line of lines) {
        line.account = await this.getAccountById(line.account_id) || undefined;
      }
      
      return { ...entry, lines };
    }
    return null;
  }

  static async createJournalEntry(entryData: JournalEntryData & { is_posted?: boolean }): Promise<JournalEntry | null> {
    try {
      // Validate entry (debits must equal credits)
      const totalDebits = entryData.lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
      const totalCredits = entryData.lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Journal entry must balance: total debits must equal total credits');
      }

      // Generate entry number
      const entryNumber = await this.generateEntryNumber();

      // Create journal entry (allow caller to request posted state)
      const entryResponse = await ApiService.create<JournalEntry>('journal_entries', {
        entry_number: entryNumber,
        entry_date: entryData.entry_date,
        description: entryData.description,
        reference: entryData.reference,
        total_debit: totalDebits,
        total_credit: totalCredits,
        is_posted: entryData.is_posted ? true : false
      });

      if (!entryResponse.success || !entryResponse.data) {
        throw new Error('Failed to create journal entry');
      }

      const entry = entryResponse.data;

      // Create journal entry lines
      for (const line of entryData.lines) {
        await ApiService.create<JournalEntryLine>('journal_entry_lines', {
          journal_entry_id: entry.id,
          account_id: line.account_id,
          description: line.description,
          debit_amount: Number(line.debit_amount || 0),
          credit_amount: Number(line.credit_amount || 0),
          department_id: line.department_id,
          child_id: line.child_id,
          donor_id: line.donor_id,
          fund_id: line.fund_id,
          sponsor_id: line.sponsor_id
        });
      }

      return await this.getJournalEntryById(entry.id);
    } catch (error) {
      console.error('Error creating journal entry:', error);
      return null;
    }
  }

  static async updateJournalEntry(id: string, entryData: Partial<JournalEntry>): Promise<JournalEntry | null> {
    const response = await ApiService.update<JournalEntry>('journal_entries', id, {
      ...entryData,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteJournalEntry(id: string): Promise<boolean> {
    const response = await ApiService.delete('journal_entries', id);
    return response.success;
  }

  static async postJournalEntry(id: string): Promise<boolean> {
    const entry = await this.getJournalEntryById(id);
    if (!entry || entry.is_posted) return false;

    const updateResponse = await this.updateJournalEntry(id, { is_posted: true });
    return !!updateResponse;
  }

  // Balance Sheet
  static async getBalanceSheet(asOfDate?: string): Promise<BalanceSheetData> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    
    // Get all accounts
    const accounts = await this.getAccounts({ is_active: true });
    
    // Get account balances as of the specified date
    const accountBalances = await this.getAccountBalances(date);

    const balanceSheet: BalanceSheetData = {
      assets: {
        current_assets: [],
        fixed_assets: [],
        total_assets: 0
      },
      liabilities: {
        current_liabilities: [],
        long_term_liabilities: [],
        total_liabilities: 0
      },
      equity: {
        equity_accounts: [],
        total_equity: 0
      }
    };

    // Process each account
    for (const account of accounts) {
      const balance = accountBalances.get(account.id) || 0;
      
      if (account.account_type === 'asset') {
        if (account.account_subtype === 'current') {
          balanceSheet.assets.current_assets.push({
            name: account.name,
            amount: Math.abs(balance)
          });
        } else {
          balanceSheet.assets.fixed_assets.push({
            name: account.name,
            amount: Math.abs(balance)
          });
        }
        balanceSheet.assets.total_assets += Math.abs(balance);
      } else if (account.account_type === 'liability') {
        if (account.account_subtype === 'current') {
          balanceSheet.liabilities.current_liabilities.push({
            name: account.name,
            amount: Math.abs(balance)
          });
        } else {
          balanceSheet.liabilities.long_term_liabilities.push({
            name: account.name,
            amount: Math.abs(balance)
          });
        }
        balanceSheet.liabilities.total_liabilities += Math.abs(balance);
      } else if (account.account_type === 'equity') {
        balanceSheet.equity.equity_accounts.push({
          name: account.name,
          amount: Math.abs(balance)
        });
        balanceSheet.equity.total_equity += Math.abs(balance);
      }
    }

    return balanceSheet;
  }

  // Trial Balance
  static async getTrialBalance(asOfDate?: string): Promise<TrialBalanceData[]> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const accounts = await this.getAccounts({ is_active: true });
    const accountBalances = await this.getAccountBalances(date);

    const trialBalance: TrialBalanceData[] = [];

    for (const account of accounts) {
      const balance = accountBalances.get(account.id) || 0;
      
      trialBalance.push({
        account_code: account.code,
        account_name: account.name,
        debit_balance: balance > 0 ? balance : 0,
        credit_balance: balance < 0 ? Math.abs(balance) : 0
      });
    }

    return trialBalance.sort((a, b) => a.account_code.localeCompare(b.account_code));
  }

  // Initialize default chart of accounts
  static async initializeDefaultAccounts(): Promise<boolean> {
    try {
      const defaultAccounts = [
        // Assets
        { code: '1000', name: 'Cash', account_type: 'asset' as const, account_subtype: 'current' as const },
        { code: '1100', name: 'Accounts Receivable', account_type: 'asset' as const, account_subtype: 'current' as const },
        { code: '1200', name: 'Inventory', account_type: 'asset' as const, account_subtype: 'current' as const },
        { code: '1300', name: 'Prepaid Expenses', account_type: 'asset' as const, account_subtype: 'current' as const },
        { code: '1500', name: 'Equipment', account_type: 'asset' as const, account_subtype: 'fixed' as const },
        { code: '1600', name: 'Accumulated Depreciation', account_type: 'asset' as const, account_subtype: 'fixed' as const },
        
        // Liabilities
        { code: '2000', name: 'Accounts Payable', account_type: 'liability' as const, account_subtype: 'current' as const },
        { code: '2100', name: 'Accrued Expenses', account_type: 'liability' as const, account_subtype: 'current' as const },
        { code: '2200', name: 'Notes Payable', account_type: 'liability' as const, account_subtype: 'long_term' as const },
        
        // Equity
        { code: '3000', name: 'Owner\'s Equity', account_type: 'equity' as const },
        { code: '3100', name: 'Retained Earnings', account_type: 'equity' as const },
        
        // Revenue
        { code: '4000', name: 'Sales Revenue', account_type: 'revenue' as const },
        { code: '4100', name: 'Other Income', account_type: 'revenue' as const },
        
        // Expenses
        { code: '5000', name: 'Cost of Goods Sold', account_type: 'expense' as const },
        { code: '5100', name: 'Operating Expenses', account_type: 'expense' as const },
        { code: '5200', name: 'Depreciation Expense', account_type: 'expense' as const },
        { code: '5300', name: 'Interest Expense', account_type: 'expense' as const }
      ];

      for (const account of defaultAccounts) {
        await this.createAccount(account);
      }

      return true;
    } catch (error) {
      console.error('Error initializing default accounts:', error);
      return false;
    }
  }

  // Bank Reconciliation operations
  static async getBankReconciliations(): Promise<BankReconciliation[]> {
    const response = await ApiService.get<BankReconciliation>('bank_reconciliations', {
      orderBy: { column: 'statement_date', ascending: false }
    });
    return response.success ? (response.data || []) : [];
  }

  static async getBankReconciliationById(id: string): Promise<BankReconciliation | null> {
    const response = await ApiService.getById<BankReconciliation>('bank_reconciliations', id);
    return response.success ? response.data : null;
  }

  static async createBankReconciliation(data: Partial<BankReconciliation>): Promise<BankReconciliation | null> {
    const response = await ApiService.create<BankReconciliation>('bank_reconciliations', data);
    return response.success ? response.data : null;
  }

  static async updateBankReconciliation(id: string, data: Partial<BankReconciliation>): Promise<BankReconciliation | null> {
    const response = await ApiService.update<BankReconciliation>('bank_reconciliations', id, {
      ...data,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteBankReconciliation(id: string): Promise<boolean> {
    const response = await ApiService.delete('bank_reconciliations', id);
    return response.success;
  }

  static async getUnreconciledLines(accountId: string, asOfDate?: string): Promise<JournalEntryLine[]> {
    const response = await ApiService.get<JournalEntryLine>('journal_entry_lines', {
      filters: { 
        account_id: accountId,
        is_reconciled: 0
      },
      orderBy: { column: 'created_at', ascending: true }
    });

    if (response.success && response.data) {
      let lines = response.data;
      // Fetch all journal entries to check dates (not ideal but works with generic CRUD)
      const entries = await this.getJournalEntries();
      const entryMap = new Map(entries.map(e => [e.id, e]));
      
      const filtered = lines.map(line => ({
        ...line,
        journal_entry: entryMap.get(line.journal_entry_id)
      })).filter(line => {
        if (!asOfDate) return true;
        const entry = entryMap.get(line.journal_entry_id);
        return entry && entry.entry_date <= asOfDate;
      });

      return filtered;
    }
    return [];
  }

  static async getAccountBalanceAsOf(accountId: string, asOfDate: string): Promise<number> {
    const entries = await this.getJournalEntries({
      end_date: asOfDate,
      is_posted: true
    });

    let balance = 0;
    for (const entry of entries) {
      if (entry.lines) {
        for (const line of entry.lines) {
          if (line.account_id === accountId) {
            balance += (line.debit_amount || 0) - (line.credit_amount || 0);
          }
        }
      }
    }
    return balance;
  }

  static async finalizeReconciliation(reconciliationId: string, lineIds: string[]): Promise<boolean> {
    try {
      await this.updateBankReconciliation(reconciliationId, { status: 'completed' });
      for (const id of lineIds) {
        await ApiService.update('journal_entry_lines', id, {
          is_reconciled: true,
          bank_reconciliation_id: reconciliationId
        });
      }
      return true;
    } catch (error) {
      console.error('Error finalizing reconciliation:', error);
      return false;
    }
  }

  // Helper methods
  private static async generateEntryNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    
    // Get the last entry number for today
    const entries = await this.getJournalEntries({
      start_date: today.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0]
    });

    const todayEntries = entries.filter(entry => 
      entry.entry_number.startsWith(`JE${year}${month}`)
    );

    const nextNumber = todayEntries.length + 1;
    return `JE${year}${month}${String(nextNumber).padStart(4, '0')}`;
  }

  private static async getAccountBalances(asOfDate: string): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    
    // Get all posted journal entries up to the specified date
    const entries = await this.getJournalEntries({
      end_date: asOfDate,
      is_posted: true
    });

    // Calculate balances
    for (const entry of entries) {
      if (entry.lines) {
        for (const line of entry.lines) {
          const currentBalance = balances.get(line.account_id) || 0;
          const newBalance = currentBalance + Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
          balances.set(line.account_id, newBalance);
        }
      }
    }

    return balances;
  }

  private static buildAccountTree(accounts: Account[]): Account[] {
    const accountMap = new Map<string, Account>();
    const rootAccounts: Account[] = [];

    // Create a map of all accounts
    accounts.forEach(account => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    // Build the tree structure
    accounts.forEach(account => {
      const accountWithChildren = accountMap.get(account.id)!;
      
      if (account.parent_id) {
        const parent = accountMap.get(account.parent_id);
        if (parent) {
          parent.children!.push(accountWithChildren);
        }
      } else {
        rootAccounts.push(accountWithChildren);
      }
    });

    return rootAccounts;
  }
} 