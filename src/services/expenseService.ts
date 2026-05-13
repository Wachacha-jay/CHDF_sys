import { ApiService } from './api';
import type { Expense } from '../types';
import { DoubleEntryService } from './doubleEntryService';

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  supplierId?: string;
  minAmount?: number;
  maxAmount?: number;
  isApproved?: boolean;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  averageAmount: number;
  monthlyTotal: number;
}

export class ExpenseService {
  // Get all expenses with optional filters
  static async getExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
    // MOCK DATA for UI testing
    return [
      {
        id: 'exp-1',
        description: 'Office Rent',
        amount: 30000,
        tax_amount: 0,
        account_id: 'acc-1',
        supplier_id: undefined,
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expense_date: '2024-06-01',
        category: 'Rent',
        reference: 'INV-1001',
        notes: 'Paid for June',
        attachment_url: undefined
      },
      {
        id: 'exp-2',
        description: 'Internet Subscription',
        amount: 5000,
        tax_amount: 0,
        account_id: 'acc-2',
        supplier_id: undefined,
        is_approved: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expense_date: '2024-06-03',
        category: 'Utilities',
        reference: 'INV-1002',
        notes: 'Monthly internet',
        attachment_url: undefined
      }
    ];
  }

  // Get a single expense by ID
  static async getExpense(id: string): Promise<Expense | null> {
    try {
      const response = await ApiService.get<Expense>(`expenses/${id}`);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching expense:', error);
      return null;
    }
  }

  // Create a new expense
  static async createExpense(expense: Partial<Expense>): Promise<Expense | null> {
    try {
      const response = await ApiService.post<Expense>('expenses', expense);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error creating expense:', error);
      return null;
    }
  }

  // Update an existing expense
  static async updateExpense(id: string, expense: Partial<Expense>): Promise<boolean> {
    try {
      const response = await ApiService.put(`expenses/${id}`, expense);
      return response.success;
    } catch (error) {
      console.error('Error updating expense:', error);
      return false;
    }
  }

  // Delete an expense
  static async deleteExpense(id: string): Promise<boolean> {
    try {
      const response = await ApiService.delete('expenses', id);
      return response.success;
    } catch (error) {
      console.error('Error deleting expense:', error);
      return false;
    }
  }

  // Approve an expense
  static async approveExpense(id: string): Promise<boolean> {
    try {
      const response = await ApiService.put(`expenses/${id}/approve`);
      if (response.success) {
        const expense = await this.getExpense(id);
        if (expense) {
          await DoubleEntryService.postExpense(expense);
        }
      }
      return response.success;
    } catch (error) {
      console.error('Error approving expense:', error);
      return false;
    }
  }

  // Get expense statistics
  static async getExpenseStats(filters?: ExpenseFilters): Promise<ExpenseStats> {
    try {
      const params = filters ? { filters } : {};
      const response = await ApiService.get<ExpenseStats>('expenses/stats', params);
      return response.success ? response.data : {
        totalExpenses: 0,
        totalCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        averageAmount: 0,
        monthlyTotal: 0
      };
    } catch (error) {
      console.error('Error fetching expense stats:', error);
      return {
        totalExpenses: 0,
        totalCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        averageAmount: 0,
        monthlyTotal: 0
      };
    }
  }

  // Get expenses by account
  static async getExpensesByAccount(accountId: string): Promise<Expense[]> {
    try {
      const response = await ApiService.get<Expense>('expenses', {
        filters: { account_id: accountId }
      });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching expenses by account:', error);
      return [];
    }
  }

  // Get expenses by supplier
  static async getExpensesBySupplier(supplierId: string): Promise<Expense[]> {
    try {
      const response = await ApiService.get<Expense>('expenses', {
        filters: { supplier_id: supplierId }
      });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching expenses by supplier:', error);
      return [];
    }
  }

  // Get expenses by date range
  static async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    try {
      const response = await ApiService.get<Expense>('expenses', {
        filters: { 
          start_date: startDate,
          end_date: endDate
        }
      });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching expenses by date range:', error);
      return [];
    }
  }

  // Get pending expenses
  static async getPendingExpenses(): Promise<Expense[]> {
    try {
      const response = await ApiService.get<Expense>('expenses', {
        filters: { is_approved: false }
      });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching pending expenses:', error);
      return [];
    }
  }

  // Get approved expenses
  static async getApprovedExpenses(): Promise<Expense[]> {
    try {
      const response = await ApiService.get<Expense>('expenses', {
        filters: { is_approved: true }
      });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching approved expenses:', error);
      return [];
    }
  }

  // Calculate expense totals
  static calculateExpenseTotals(expenses: Expense[]) {
    return {
      totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      totalTax: expenses.reduce((sum, expense) => sum + expense.tax_amount, 0),
      totalWithTax: expenses.reduce((sum, expense) => sum + expense.amount + expense.tax_amount, 0),
      count: expenses.length,
      pendingCount: expenses.filter(expense => !expense.is_approved).length,
      approvedCount: expenses.filter(expense => expense.is_approved).length
    };
  }

  // Generate expense number
  static generateExpenseNumber(): string {
    const timestamp = new Date().getTime();
    return `EXP-${timestamp}`;
  }

  // Validate expense data
  static validateExpense(expense: Partial<Expense>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!expense.expense_number) {
      errors.push('Expense number is required');
    }

    if (!expense.account_id) {
      errors.push('Account is required');
    }

    if (!expense.amount || expense.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!expense.description) {
      errors.push('Description is required');
    }

    if (!expense.expense_date) {
      errors.push('Expense date is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 