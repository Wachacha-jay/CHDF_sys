import { ApiService } from './api';
import { apiClient } from '../lib/api-client';
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
  /**
   * Helper to identify legacy internal transfer revenue (4900) and expense (5900) accounts
   * that were replaced by balance sheet equity/receivable/payable accounts and must be scrapped.
   */
  static isLegacyInternalTransferAccount(acc: { code?: string; name?: string; account_type?: string } | undefined | null): boolean {
    if (!acc) return false;
    const code = (acc.code || '').trim();
    const name = (acc.name || '').toLowerCase();
    const type = (acc.account_type || '').toLowerCase();
    if (code === '4900' || code === '5900') return true;
    if (name.includes('internal transfer in') || name.includes('internal transfer out')) return true;
    if (name.includes('internal transfer') && (type === 'revenue' || type === 'expense')) return true;
    return false;
  }

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
      const rawAccounts = response.data;
      const hasLegacyAccounts = rawAccounts.some(a => this.isLegacyInternalTransferAccount(a));
      if (hasLegacyAccounts) {
        // Proactively purge legacy accounts from the database in the background
        this.purgeLegacyTransferAccountsAndSyncPayroll().catch(() => {});
      }
      const cleanAccounts = rawAccounts.filter(a => !this.isLegacyInternalTransferAccount(a));
      return this.buildAccountTree(cleanAccounts);
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
    department_id?: string;
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
        entries = entries.filter(entry => String(entry.entry_date || '').slice(0, 10) >= filters.start_date!);
      }
      if (filters?.end_date) {
        entries = entries.filter(entry => String(entry.entry_date || '').slice(0, 10) <= filters.end_date!);
      }

      // Fetch lines for all entries
      const allLinesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines');
      const allAccountsResponse = await ApiService.get<Account>('accounts');
      
      const allLines = allLinesResponse.success ? (allLinesResponse.data || []) : [];
      const allAccounts = allAccountsResponse.success ? (allAccountsResponse.data || []) : [];
      const accountMap = new Map(allAccounts.map(a => [a.id, a]));

      // Clean lines and attach account, strictly scrapping legacy 4900 / 5900 internal transfer lines
      entries = entries
        .filter(entry => {
          const isLegacyRef = entry.entry_number?.startsWith('ITR-') || entry.reference?.startsWith('ITR-');
          const isLegacyDesc = (entry.description || '').toLowerCase().includes('internal transfer in') || 
                               (entry.description || '').toLowerCase().includes('internal transfer out');
          return !isLegacyRef && !isLegacyDesc;
        })
        .map(entry => {
          const lines = allLines
            .filter(l => l.journal_entry_id === entry.id)
            .map(l => ({
              ...l,
              account: accountMap.get(l.account_id)
            }))
            .filter(l => !this.isLegacyInternalTransferAccount(l.account));
          return { ...entry, lines };
        })
        .filter(entry => (entry.lines || []).length > 0);

      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        entries = entries.filter(entry => 
          entry.entry_number.toLowerCase().includes(searchTerm) ||
          entry.description.toLowerCase().includes(searchTerm) ||
          entry.reference?.toLowerCase().includes(searchTerm)
        );
      }

      // Apply department filter if specified
      if (filters?.department_id && filters.department_id !== 'all') {
        const targetDeptId = filters.department_id;
        entries = entries.filter(entry => 
          entry.lines?.some(l => l.department_id === targetDeptId)
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
      const entryNumber = await this.generateEntryNumber(entryData.entry_date);

      // Create journal entry (default to posted true)
      const entryResponse = await ApiService.create<JournalEntry>('journal_entries', {
        entry_number: entryNumber,
        entry_date: entryData.entry_date,
        description: entryData.description,
        reference: entryData.reference || null,
        total_debit: totalDebits,
        total_credit: totalCredits,
        is_posted: entryData.is_posted !== undefined ? entryData.is_posted : true,
        lines: entryData.lines
      });

      if (!entryResponse.success || !entryResponse.data) {
        throw new Error(entryResponse.error || 'Failed to create journal entry in backend database');
      }

      const entry = entryResponse.data;

      // If backend did not return lines, insert them individually as fallback
      if (!entry.lines || entry.lines.length === 0) {
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
      }

      const reFetched = await this.getJournalEntryById(entry.id);
      return reFetched || entry;
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      throw error;
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
    
    // Get all flat accounts
    const rootAccounts = await this.getAccounts({ is_active: true });
    const accounts = this.flattenAccounts(rootAccounts);
    
    // Get account balances as of the specified date (debits - credits)
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

    let totalRevenue = 0;
    let totalExpense = 0;

    // Process each account
    for (const account of accounts) {
      const balance = accountBalances.get(account.id) || 0; // debits - credits
      
      if (account.account_type === 'asset') {
        const isCurrent = account.account_subtype === 'current' || 
          account.code?.startsWith('10') || 
          account.code?.startsWith('11') || 
          /cash|bank|receivable|inventory|prepaid/i.test(account.name);
        
        if (balance !== 0) {
          const item = { name: account.name, amount: balance };
          if (isCurrent) {
            balanceSheet.assets.current_assets.push(item);
          } else {
            balanceSheet.assets.fixed_assets.push(item);
          }
          balanceSheet.assets.total_assets += balance;
        }
      } else if (account.account_type === 'liability') {
        const normalBalance = -balance; // credits - debits
        if (normalBalance !== 0) {
          const isCurrent = account.account_subtype === 'current' || 
            account.code?.startsWith('20') || 
            account.code?.startsWith('21') || 
            /payable|accrued|short|statutory|tax|nssf|nhif|shif/i.test(account.name);
          
          const item = { name: account.name, amount: normalBalance };
          if (isCurrent) {
            balanceSheet.liabilities.current_liabilities.push(item);
          } else {
            balanceSheet.liabilities.long_term_liabilities.push(item);
          }
          balanceSheet.liabilities.total_liabilities += normalBalance;
        }
      } else if (account.account_type === 'equity') {
        const normalBalance = -balance; // credits - debits
        if (normalBalance !== 0) {
          balanceSheet.equity.equity_accounts.push({
            name: account.name,
            amount: normalBalance
          });
          balanceSheet.equity.total_equity += normalBalance;
        }
      } else if (account.account_type === 'revenue' || account.code?.startsWith('4')) {
        totalRevenue += (-balance); // credits - debits
      } else if (account.account_type === 'expense' || account.code?.startsWith('5')) {
        totalExpense += balance; // debits - credits
      }
    }

    // Current period net income / surplus (Revenues - Expenses)
    const currentPeriodSurplus = totalRevenue - totalExpense;
    if (Math.abs(currentPeriodSurplus) > 0.001) {
      balanceSheet.equity.equity_accounts.push({
        name: 'Current Period Net Surplus / (Deficit)',
        amount: currentPeriodSurplus
      });
      balanceSheet.equity.total_equity += currentPeriodSurplus;
    }

    return balanceSheet;
  }

  // Trial Balance
  static async getTrialBalance(asOfDate?: string): Promise<TrialBalanceData[]> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const rootAccounts = await this.getAccounts({ is_active: true });
    const accounts = this.flattenAccounts(rootAccounts);
    const accountBalances = await this.getAccountBalances(date);

    const trialBalance: TrialBalanceData[] = [];

    for (const account of accounts) {
      const balance = accountBalances.get(account.id) || 0; // debits - credits
      
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
        account_id: accountId
      },
      orderBy: { column: 'created_at', ascending: true }
    });

    if (response.success && response.data) {
      const lines = response.data;
      // Fetch all journal entries to check dates
      const entries = await this.getJournalEntries();
      const entryMap = new Map(entries.map(e => [e.id, e]));
      
      const filtered = lines
        .filter(line => !line.is_reconciled || line.is_reconciled === 0 || (line.is_reconciled as any) === '0' || (line.is_reconciled as any) === false)
        .map(line => ({
          ...line,
          journal_entry: entryMap.get(line.journal_entry_id)
        })).filter(line => {
          if (!asOfDate) return true;
          const entry = entryMap.get(line.journal_entry_id);
          const lineDate = entry?.entry_date || (line.created_at ? line.created_at.split('T')[0] : '');
          return !lineDate || lineDate <= asOfDate;
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

  static async finalizeReconciliation(reconciliationId: string, lineIds: string[], finalDifference: number = 0): Promise<boolean> {
    try {
      await this.updateBankReconciliation(reconciliationId, { 
        status: 'completed',
        difference: finalDifference
      });
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
  private static async generateEntryNumber(entryDate?: string): Promise<string> {
    const ref = entryDate ? new Date(entryDate) : new Date();
    const year = ref.getFullYear();
    const month = String(ref.getMonth() + 1).padStart(2, '0');
    const prefix = `JE${year}${month}`;
    
    // Fetch all journal entries to check existing entry numbers
    const entries = await this.getJournalEntries();

    let maxSuffix = 0;
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        if (entry.entry_number && entry.entry_number.startsWith(prefix)) {
          const suffixStr = entry.entry_number.substring(prefix.length);
          const num = parseInt(suffixStr, 10);
          if (!isNaN(num) && num > maxSuffix) {
            maxSuffix = num;
          }
        }
      }
    }

    let nextNumber = maxSuffix + 1;
    let candidate = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    
    // If candidate still exists in entries, append timestamp fallback
    if (entries.some(e => e.entry_number === candidate)) {
      candidate = `${prefix}${Date.now().toString().slice(-6)}`;
    }

    return candidate;
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

  static flattenAccounts(accounts: Account[]): Account[] {
    const flat: Account[] = [];
    const recurse = (list: Account[]) => {
      for (const acc of list) {
        flat.push(acc);
        if (acc.children && acc.children.length > 0) {
          recurse(acc.children);
        }
      }
    };
    recurse(accounts || []);
    return flat;
  }

  /**
   * Resolves the department ID for a journal entry line using line attributes, sibling lines,
   * employee matches, or department textual references.
   */
  static resolveDepartmentForLine(
    line: JournalEntryLine,
    entry?: JournalEntry,
    employees: any[] = [],
    departments: any[] = []
  ): string | undefined {
    // 1. Direct line department_id
    if (line.department_id) return line.department_id;
    // 2. Department on sibling line in entry
    if (entry?.lines) {
      const siblingDeptId = entry.lines.find(l => l.department_id)?.department_id;
      if (siblingDeptId) return siblingDeptId;
    }
    // 3. Match from employee list for payroll entries
    const fullText = `${entry?.description || ''} ${line.description || ''} ${entry?.reference || ''}`.toLowerCase();
    for (const emp of employees) {
      const codeMatch = emp.code && fullText.includes(emp.code.toLowerCase());
      const nameMatch = emp.first_name && emp.last_name && 
        fullText.includes(`${emp.first_name.toLowerCase()} ${emp.last_name.toLowerCase()}`);
      if (codeMatch || nameMatch) {
        if (emp.department_id) return emp.department_id;
        if (emp.department) {
          const d = departments.find(dept => dept.name.toLowerCase() === emp.department?.toLowerCase());
          if (d) return d.id;
        }
      }
    }
    // 4. Department name mentioned in text
    for (const d of departments) {
      if (d.name && fullText.includes(d.name.toLowerCase())) {
        return d.id;
      }
    }
    return undefined;
  }

  /**
   * Checks if a line's resolved department matches the selected department filter.
   */
  static isDepartmentMatch(
    lineDeptId: string | undefined,
    selectedDeptId: string,
    departments: any[] = []
  ): boolean {
    if (!selectedDeptId || selectedDeptId === 'all') return true;
    if (!lineDeptId) return false;
    if (lineDeptId === selectedDeptId) return true;
    const selObj = departments.find(d => d.id === selectedDeptId);
    if (selObj && (selObj.name.toLowerCase() === lineDeptId.toLowerCase() || selObj.id === lineDeptId)) return true;
    return false;
  }

  /**
   * Triggers a comprehensive purge of legacy internal transfer accounts (4900, 5900)
   * and synchronizes payroll line department attribution across the database.
   */
  static async purgeLegacyTransferAccountsAndSyncPayroll(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. First attempt dedicated backend maintenance API
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/maintenance/cleanup-transfers-and-fix-payroll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const result = await res.json();
          return {
            success: true,
            message: result.message || 'Legacy accounts purged and payroll departments synchronized successfully.'
          };
        }
      } catch (backendErr) {
        console.warn('Backend maintenance endpoint unreachable, falling back to direct API cleanup:', backendErr);
      }

      // 2. Client-side fallback: delete legacy transfer lines, entries, and accounts via standard ApiService
      const accRes = await ApiService.get<Account>('accounts');
      const allAccs = accRes.success ? (accRes.data || []) : [];
      const legacyAccs = allAccs.filter(a => this.isLegacyInternalTransferAccount(a));

      if (legacyAccs.length > 0) {
        const legacyAccIds = new Set(legacyAccs.map(a => a.id));
        const linesRes = await ApiService.get<JournalEntryLine>('journal_entry_lines');
        const allLines = linesRes.success ? (linesRes.data || []) : [];
        const affectedEntryIds = new Set<string>();

        for (const line of allLines) {
          if (legacyAccIds.has(line.account_id)) {
            affectedEntryIds.add(line.journal_entry_id);
            await ApiService.delete('journal_entry_lines', line.id).catch(() => {});
          }
        }

        for (const entryId of affectedEntryIds) {
          await ApiService.delete('journal_entries', entryId).catch(() => {});
        }

        // Clean any residual ITR- entries
        const entriesRes = await ApiService.get<JournalEntry>('journal_entries');
        const allEntries = entriesRes.success ? (entriesRes.data || []) : [];
        for (const entry of allEntries) {
          if (entry.entry_number?.startsWith('ITR-') || entry.reference?.startsWith('ITR-')) {
            const childLines = allLines.filter(l => l.journal_entry_id === entry.id);
            for (const cl of childLines) {
              await ApiService.delete('journal_entry_lines', cl.id).catch(() => {});
            }
            await ApiService.delete('journal_entries', entry.id).catch(() => {});
          }
        }

        // Delete the legacy accounts
        for (const acc of legacyAccs) {
          await ApiService.delete('accounts', acc.id).catch(() => {});
        }
      }

      // 3. Fallback department synchronization for payroll lines
      try {
        const [empRes, deptRes, allLinesRes, allEntriesRes] = await Promise.all([
          ApiService.get<any>('employees'),
          ApiService.get<any>('departments'),
          ApiService.get<JournalEntryLine>('journal_entry_lines'),
          ApiService.get<JournalEntry>('journal_entries')
        ]);

        const employees = empRes.success ? (empRes.data || []) : [];
        const departments = deptRes.success ? (deptRes.data || []) : [];
        const lines = allLinesRes.success ? (allLinesRes.data || []) : [];
        const entries = allEntriesRes.success ? (allEntriesRes.data || []) : [];
        const entryMap = new Map(entries.map(e => [e.id, e]));

        for (const line of lines) {
          if (!line.department_id) {
            const entry = entryMap.get(line.journal_entry_id);
            const deptId = this.resolveDepartmentForLine(line, entry, employees, departments);
            if (deptId) {
              await ApiService.update('journal_entry_lines', line.id, { department_id: deptId }).catch(() => {});
            }
          }
        }
      } catch (backfillErr) {
        console.warn('Fallback department sync warning:', backfillErr);
      }

      return {
        success: true,
        message: 'Legacy internal transfer accounts purged and departments synchronized successfully.'
      };
    } catch (err: any) {
      console.error('Error in purgeLegacyTransferAccountsAndSyncPayroll:', err);
      return {
        success: false,
        message: err?.message || 'Purge and synchronization failed.'
      };
    }
  }
} 