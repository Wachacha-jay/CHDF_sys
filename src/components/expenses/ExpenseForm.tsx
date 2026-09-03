import React, { useState, useEffect } from 'react';
import { X, Save, Upload, DollarSign, Calendar, FileText, User } from 'lucide-react';
import type { Expense, Account, Supplier, AccountCategory } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { DimensionSelector } from '../fund-accounting/DimensionSelector';

interface ExpenseFormProps {
  expense: Expense | null;
  accounts: Account[];
  categories: AccountCategory[];
  suppliers: Supplier[];
  onSave: (expenseData: Partial<Expense>) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({
  expense,
  accounts,
  categories,
  suppliers,
  onSave,
  onClose,
  loading
}) => {
  const { settings } = useSettingsContext();
  const [formData, setFormData] = useState({
    expense_number: '',
    account_id: '',
    supplier_id: '',
    expense_date: '',
    amount: '',
    tax_amount: '',
    description: '',
    reference: '',
    receipt_url: '',
    payment_account_id: '',
    department_id: '',
    child_id: '',
    donor_id: '',
    fund_id: ''
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        expense_number: expense.expense_number || '',
        account_id: expense.account_id || '',
        supplier_id: expense.supplier_id || '',
        expense_date: expense.expense_date ? new Date(expense.expense_date).toISOString().split('T')[0] : '',
        amount: expense.amount?.toString() || '',
        tax_amount: expense.tax_amount?.toString() || '',
        description: expense.description || '',
        reference: expense.reference || '',
        receipt_url: expense.receipt_url || '',
        payment_account_id: expense.payment_account_id || '',
        department_id: expense.department_id || '',
        child_id: expense.child_id || '',
        donor_id: expense.donor_id || '',
        fund_id: expense.fund_id || ''
      });
    } else {
      // Generate new expense number
      const timestamp = new Date().getTime();
      // Try to find default cash account
      const cashAccount = accounts.find(a => a.code === '1000' || a.name.toLowerCase() === 'cash');
      
      setFormData({
        expense_number: `EXP-${timestamp}`,
        account_id: '',
        supplier_id: '',
        expense_date: new Date().toISOString().split('T')[0],
        amount: '',
        tax_amount: '',
        description: '',
        reference: '',
        receipt_url: '',
        payment_account_id: cashAccount?.id || '',
        department_id: '',
        child_id: '',
        donor_id: '',
        fund_id: ''
      });
    }
  }, [expense, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_id || !formData.amount || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    const expenseData: Partial<Expense> = {
      ...formData,
      supplier_id: formData.supplier_id || undefined,
      payment_account_id: formData.payment_account_id || undefined,
      department_id: formData.department_id || undefined,
      child_id: formData.child_id || undefined,
      donor_id: formData.donor_id || undefined,
      fund_id: formData.fund_id || undefined,
      amount: parseFloat(formData.amount) || 0,
      tax_amount: parseFloat(formData.tax_amount) || 0
    };

    await onSave(expenseData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // TODO: Implement file upload to cloud storage
      // For now, just store the filename
      setFormData({ ...formData, receipt_url: file.name });
    }
  };

  const calculateTotal = () => {
    const amount = parseFloat(formData.amount) || 0;
    const tax = parseFloat(formData.tax_amount) || 0;
    return amount + tax;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {expense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <p className="text-sm text-gray-600">
              {expense ? 'Update expense details' : 'Enter expense information'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Expense Number and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Number
              </label>
              <input
                type="text"
                value={formData.expense_number}
                onChange={(e) => setFormData({ ...formData, expense_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="EXP-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Account and Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Account *
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select an account</option>
                {categories.map((category) => {
                  const categoryAccounts = accounts.filter(a => a.category_id === category.id);
                  if (categoryAccounts.length === 0) return null;
                  return (
                    <optgroup key={category.id} label={category.name}>
                      {categoryAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          [{account.code}] {account.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                {/* Fallback for uncategorized accounts */}
                {accounts.some(a => !a.category_id && a.account_type === 'expense') && (
                  <optgroup label="Uncategorized">
                    {accounts.filter(a => !a.category_id && a.account_type === 'expense').map((account) => (
                      <option key={account.id} value={account.id}>
                        [{account.code}] {account.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paid From (Asset Account) *
              </label>
              <select
                value={formData.payment_account_id}
                onChange={(e) => setFormData({ ...formData, payment_account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select payment account</option>
                {accounts.filter(a => a.account_type === 'asset').map((account) => (
                  <option key={account.id} value={account.id}>
                    [{account.code}] {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Invoice number, receipt number, etc."
              />
            </div>
          </div>

          {/* Amount and Tax */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={`${settings?.default_currency || 'KES'} ${calculateTotal().toFixed(2)}`}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the expense..."
              required
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-2 pt-2">
            <label className="block text-sm font-semibold text-gray-700">Financial Dimensions (NGO/Fund Accounting)</label>
            <DimensionSelector 
              value={{
                department_id: formData.department_id,
                child_id: formData.child_id,
                donor_id: formData.donor_id,
                fund_id: formData.fund_id
              }}
              onChange={(dims) => setFormData({
                ...formData,
                department_id: dims.department_id || '',
                child_id: dims.child_id || '',
                donor_id: dims.donor_id || '',
                fund_id: dims.fund_id || ''
              })}
            />
          </div>


          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt/Invoice
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm text-gray-700">Upload File</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {formData.receipt_url && (
                <span className="text-sm text-gray-600">
                  {formData.receipt_url}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {expense ? 'Update' : 'Save'} Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm; 