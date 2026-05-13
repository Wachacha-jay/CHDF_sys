import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, DollarSign, FileText, Folder } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import ExpenseForm from '../components/expenses/ExpenseForm';
import ExpenseStats from '../components/expenses/ExpenseStats';
import ExpenseFilters from '../components/expenses/ExpenseFilters';
import { AccountingService } from '../services/accountingService';
import { FundAccountingService } from '../services/fundAccountingService';
import { useAuthContext } from '../contexts/useAuthContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { Expense, Account, Supplier, AccountCategory, Department, FundAccount, Child, Donor } from '../types';

const Expenses: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: '',
    supplierId: '',
    minAmount: '',
    maxAmount: '',
    isApproved: '',
    department_id: '',
    fund_id: '',
    child_id: '',
    donor_id: ''
  });

  useEffect(() => {
    loadExpenses();
    loadAccounts();
    loadCategories();
    loadSuppliers();
    loadNGODimensions();
  }, []);

  const loadNGODimensions = async () => {
    const [dList, fList, cList, donorList] = await Promise.all([
      FundAccountingService.getDepartments(),
      FundAccountingService.getFundAccounts(),
      FundAccountingService.getChildren(),
      FundAccountingService.getDonors()
    ]);
    setDepartments(dList);
    setFunds(fList);
    setChildren(cList);
    setDonors(donorList);
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const [expenseRes, accountRes, supplierRes] = await Promise.all([
        ApiService.get<Expense>('expenses'),
        ApiService.get<Account>('accounts'),
        ApiService.get<Supplier>('suppliers')
      ]);

      if (expenseRes.success && expenseRes.data) {
        const expenseList = expenseRes.data;
        const accountMap = new Map((accountRes.data || []).map(a => [a.id, a]));
        const supplierMap = new Map((supplierRes.data || []).map(s => [s.id, s]));

        const detailedExpenses = expenseList.map(exp => ({
          ...exp,
          account: accountMap.get(exp.account_id),
          payment_account: accountMap.get(exp.payment_account_id || ''),
          supplier: supplierMap.get(exp.supplier_id)
        }));

        setExpenses(detailedExpenses);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await ApiService.get<Account>('accounts', {
        filters: { is_active: true }
      });
      if (response.success && response.data) {
        setAccounts(response.data);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await AccountingService.getAccountCategories({ account_type: 'expense' });
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await ApiService.get<Supplier>('suppliers', {
        filters: { is_active: true }
      });
      if (response.success && response.data) {
        setSuppliers(response.data);
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const handleSaveExpense = async (expenseData: Partial<Expense>) => {
    try {
      setLoading(true);
      let response;
      
      if (selectedExpense) {
        response = await ApiService.update('expenses', selectedExpense.id, expenseData);
      } else {
        response = await ApiService.create<Expense>('expenses', expenseData);
      }

      if (response.success) {
        toast.success(selectedExpense ? 'Expense updated successfully' : 'Expense added successfully');
        setShowForm(false);
        setSelectedExpense(null);
        loadExpenses();
      } else {
        toast.error(response.error || 'Failed to save expense');
      }
    } catch (error) {
      toast.error('Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const response = await ApiService.delete('expenses', expenseId);
      if (response.success) {
        toast.success('Expense deleted successfully');
        loadExpenses();
      } else {
        toast.error(response.error || 'Failed to delete expense');
      }
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      setLoading(true);
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return;

      // 1. Fund Validation (Fundamental to Fund Accounting)
      if (expense.fund_id) {
        const currentBalance = await FundAccountingService.getFundBalance(expense.fund_id);
        if (currentBalance < Number(expense.amount)) {
          const fundName = funds.find(f => f.id === expense.fund_id)?.name || 'selected fund';
          toast.error(`Insufficient Funds: ${fundName} balance is KES ${currentBalance.toLocaleString()}, but expense is KES ${Number(expense.amount).toLocaleString()}`);
          return;
        }
      }

      // 2. Create Journal Entry (Professional Double Entry)
      const journalEntry = await AccountingService.createJournalEntry({
        entry_date: new Date(expense.expense_date).toISOString().split('T')[0],
        description: `Expense Approval: ${expense.expense_number} - ${expense.description}`,
        reference: expense.reference || expense.expense_number,
        is_posted: true,
        lines: [
          {
            account_id: expense.account_id,
            description: expense.description,
            debit_amount: Number(expense.amount),
            credit_amount: 0,
            department_id: expense.department_id || undefined,
            child_id: expense.child_id || undefined,
            donor_id: expense.donor_id || undefined,
            fund_id: expense.fund_id || undefined
          },
          {
            account_id: expense.payment_account_id || 'DEFAULT_CASH_ACCOUNT_ID',
            description: `Payment for ${expense.expense_number}`,
            debit_amount: 0,
            credit_amount: Number(expense.amount),
            department_id: expense.department_id || undefined,
            child_id: expense.child_id || undefined,
            donor_id: expense.donor_id || undefined,
            fund_id: expense.fund_id || undefined
          }
        ]
      });

      if (!journalEntry) {
        toast.error('G/L Posting Failed: Please verify accounts are valid');
        return;
      }

      // 3. Update Expense Status
      const response = await ApiService.update('expenses', expenseId, { 
        is_approved: true,
        approved_by: user?.id 
      });

      if (response.success) {
        toast.success('Expense Approved: Posted to Ledger & Fund dimensions updated');
        loadExpenses();
      } else {
        toast.error(response.error || 'Failed to update expense status');
      }
    } catch (error) {
      console.error('Error in approval workflow:', error);
      toast.error('Financial approval workflow error');
    } finally {
      setLoading(false);
    }
  };

  const getExpenseStatus = (isApproved: boolean) => {
    return isApproved 
      ? { color: 'text-green-600', bg: 'bg-green-50', text: 'Approved' }
      : { color: 'text-yellow-600', bg: 'bg-yellow-50', text: 'Pending' };
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filters.startDate && new Date(expense.expense_date) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(expense.expense_date) > new Date(filters.endDate)) return false;
    if (filters.accountId && expense.account_id !== filters.accountId) return false;
    if (filters.supplierId && expense.supplier_id !== filters.supplierId) return false;
    if (filters.minAmount && expense.amount < parseFloat(filters.minAmount)) return false;
    if (filters.maxAmount && expense.amount > parseFloat(filters.maxAmount)) return false;
    if (filters.isApproved !== '' && expense.is_approved !== (filters.isApproved === 'true')) return false;
    if (filters.department_id && expense.department_id !== filters.department_id) return false;
    if (filters.fund_id && expense.fund_id !== filters.fund_id) return false;
    if (filters.child_id && expense.child_id !== filters.child_id) return false;
    if (filters.donor_id && expense.donor_id !== filters.donor_id) return false;
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const pendingExpenses = filteredExpenses.filter(expense => !expense.is_approved).length;
  const approvedExpenses = filteredExpenses.filter(expense => expense.is_approved).length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-gray-600">Track and manage your business expenses</p>
        </div>
        <button
          onClick={() => {
            setSelectedExpense(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </button>
      </div>

      {/* Expense Statistics */}
      <ExpenseStats
        totalExpenses={totalExpenses}
        pendingExpenses={pendingExpenses}
        approvedExpenses={approvedExpenses}
        totalCount={filteredExpenses.length}
      />

      {/* Filters */}
      <ExpenseFilters
        filters={filters}
        onFiltersChange={setFilters}
        accounts={accounts}
        suppliers={suppliers}
        departments={departments}
        funds={funds}
        children={children}
        donors={donors}
      />

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expense
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocation (Fund/Dept)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => {
                  const status = getExpenseStatus(expense.is_approved);
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {expense.expense_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {expense.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Folder className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {expense.account?.name || 'No account'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.payment_account?.name || 'Cash'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.supplier?.name || 'No supplier'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {expense.fund_id && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-tighter">
                              {funds.find(f => f.id === expense.fund_id)?.name || 'Restricted Fund'}
                            </span>
                          )}
                          {expense.department_id && (
                            <div className="text-[10px] text-indigo-600 font-medium">
                              Dept: {departments.find(d => d.id === expense.department_id)?.name || 'Cost Center'}
                            </div>
                          )}
                          {!expense.fund_id && !expense.department_id && <span className="text-gray-300 text-xs italic">Unallocated</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {settings?.default_currency || 'KES'} {(Number(expense.amount) || 0).toLocaleString()}
                        </div>
                        {(expense.tax_amount > 0) && (
                          <div className="text-xs text-gray-500">
                            Tax: {settings?.default_currency || 'KES'} {(Number(expense.tax_amount) || 0).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(expense.expense_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {!expense.is_approved && (
                            <button
                              onClick={() => handleApproveExpense(expense.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedExpense(expense);
                              setShowForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {!loading && filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
            <p className="text-gray-500">Get started by adding your first expense.</p>
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <ExpenseForm
          expense={selectedExpense}
          accounts={accounts}
          categories={categories}
          suppliers={suppliers}
          onSave={handleSaveExpense}
          onClose={() => {
            setShowForm(false);
            setSelectedExpense(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
};

export default Expenses; 