import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BookOpen, Search, Info } from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { Account, AccountCategory } from '../../types';
import toast from 'react-hot-toast';

const ChartOfAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'expense' as Account['account_type'],
    category_id: '',
    parent_id: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsData, categoriesData] = await Promise.all([
        AccountingService.getAccounts(),
        AccountingService.getAccountCategories()
      ]);
      setAccounts(flatAccounts(accountsData));
      setCategories(categoriesData);
    } catch (error) {
      toast.error('Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  const flatAccounts = (accs: Account[]): Account[] => {
    let result: Account[] = [];
    accs.forEach(acc => {
      result.push(acc);
      if (acc.children && acc.children.length > 0) {
        result = result.concat(flatAccounts(acc.children));
      }
    });
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await AccountingService.updateAccount(editingAccount.id, formData);
        toast.success('Account updated');
      } else {
        await AccountingService.createAccount(formData);
        toast.success('Account created');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account? This will fail if there are transactions associated with it.')) return;
    try {
      await AccountingService.deleteAccount(id);
      toast.success('Account deleted');
      loadData();
    } catch (error) {
      toast.error('Cannot delete account with existing transactions');
    }
  };

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        category_id: account.category_id || '',
        parent_id: account.parent_id || '',
        is_active: account.is_active
      });
    } else {
      setEditingAccount(null);
      setFormData({ code: '', name: '', account_type: 'expense', category_id: '', parent_id: '', is_active: true });
    }
    setShowModal(true);
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.account_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 border-b-2 border-green-500 pb-1">Chart of Accounts</h1>
          <p className="text-gray-600">Complete list of all accounts used by your business</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts by name, code or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 transition-all outline-none"
            />
          </div>
          <div className="flex items-center text-sm text-gray-500 italic">
            <Info className="w-4 h-4 mr-1 text-blue-400" />
            Accounts are automatically grouped by category in reports
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Code</th>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Type</th>
                <th className="px-6 py-3 text-left font-semibold">Category</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">Loading chart of accounts...</td></tr>
              ) : filteredAccounts.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">No accounts found</td></tr>
              ) : filteredAccounts.map(account => {
                const category = categories.find(c => c.id === account.category_id);
                return (
                  <tr key={account.id} className="hover:bg-green-50/20 transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold text-gray-700">{account.code}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{account.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        account.account_type === 'expense' ? 'bg-orange-50 text-orange-600' :
                        account.account_type === 'revenue' ? 'bg-green-50 text-green-600' :
                        account.account_type === 'asset' ? 'bg-blue-50 text-blue-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {account.account_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {category ? (
                        <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs">{category.name}</span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button onClick={() => openModal(account)} className="p-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!account.is_system && (
                        <button onClick={() => handleDelete(account.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center">
              <BookOpen className="w-5 h-5 text-green-600 mr-2" />
              <h2 className="text-xl font-bold">{editingAccount ? 'Edit Account' : 'New Account'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Account Code</label>
                  <input
                    required
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono"
                    placeholder="e.g. 5001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Account Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g. Office Rent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.account_type}
                    onChange={e => setFormData({...formData, account_type: e.target.value as any, category_id: ''})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category (Optional)</label>
                  <select
                    value={formData.category_id}
                    onChange={e => setFormData({...formData, category_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">Select Category</option>
                    {(() => {
                      const typeCats = categories.filter(
                        c => c.account_type && c.account_type.toLowerCase() === formData.account_type.toLowerCase()
                      );
                      const listToDisplay = typeCats.length > 0 ? typeCats : categories;
                      return listToDisplay.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} {typeCats.length === 0 && cat.account_type ? `(${cat.account_type})` : ''}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Parent Account (Optional)</label>
                <select
                  value={formData.parent_id}
                  onChange={e => setFormData({...formData, parent_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">No Parent</option>
                  {accounts.filter(a => a.id !== editingAccount?.id && a.account_type === formData.account_type).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Account is Active</label>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold shadow-lg shadow-green-100"
                >
                  {editingAccount ? 'Update' : 'Create'} Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
