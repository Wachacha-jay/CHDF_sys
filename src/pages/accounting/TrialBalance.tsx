import React, { useState, useEffect } from 'react';
import { Download, Filter, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AccountingService } from '../../services/accountingService';
import type { Account, JournalEntry, AccountCategory } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface TrialBalanceEntry {
  account: Account;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

interface TrialBalanceData {
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  difference: number;
  asOfDate: string;
}

const TrialBalance: React.FC = () => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'USD';
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUnbalanced, setShowUnbalanced] = useState(false);

  useEffect(() => {
    loadTrialBalance();
  }, [asOfDate]);

  const loadTrialBalance = async () => {
    try {
      setLoading(true);
      
      // Get all accounts and categories
      const [accounts, categoriesData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories()
      ]);
      
      setCategories(categoriesData);

      // Get journal entries up to the selected date
      const journalEntries = await AccountingService.getJournalEntries({
        end_date: asOfDate,
        is_posted: true
      });

      // Calculate trial balance
      const trialBalanceData = calculateTrialBalance(accounts, journalEntries, asOfDate);
      setTrialBalance(trialBalanceData);
    } catch (error) {
      console.error('Error loading trial balance:', error);
      toast.error('Failed to load trial balance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTrialBalance = (
    accounts: Account[], 
    journalEntries: JournalEntry[], 
    asOfDate: string
  ): TrialBalanceData => {
    const accountBalances = new Map<string, { debits: number; credits: number }>();

    // Initialize all accounts with zero balances
    accounts.forEach(account => {
      accountBalances.set(account.id, { debits: 0, credits: 0 });
    });

    // Calculate balances from journal entries
    journalEntries.forEach(entry => {
      if (entry.lines) {
        entry.lines.forEach(line => {
          const current = accountBalances.get(line.account_id);
          if (current) {
            current.debits += Number(line.debit_amount || 0);
            current.credits += Number(line.credit_amount || 0);
          }
        });
      }
    });

    // Create trial balance entries
    const entries: TrialBalanceEntry[] = accounts.map(account => {
      const balance = accountBalances.get(account.id) || { debits: 0, credits: 0 };
      const netBalance = balance.debits - balance.credits;
      
      return {
        account,
        debitBalance: balance.debits,
        creditBalance: balance.credits,
        netBalance
      };
    });

    // Calculate totals
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debitBalance, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.creditBalance, 0);
    const difference = totalDebits - totalCredits;

    return {
      entries,
      totalDebits,
      totalCredits,
      difference,
      asOfDate
    };
  };

  const exportTrialBalance = () => {
    if (!trialBalance) return;

    const csvContent = [
      ['Account Code', 'Account Name', 'Account Type', 'Debit Balance', 'Credit Balance', 'Net Balance'],
      ...trialBalance.entries.map(entry => [
        entry.account.code,
        entry.account.name,
        entry.account.account_type,
        entry.debitBalance.toFixed(2),
        entry.creditBalance.toFixed(2),
        entry.netBalance.toFixed(2)
      ]),
      ['', '', 'TOTALS', trialBalance.totalDebits.toFixed(2), trialBalance.totalCredits.toFixed(2), trialBalance.difference.toFixed(2)]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${asOfDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Trial balance exported successfully');
  };

  const printTrialBalance = () => {
    if (!trialBalance) return;

    const currency = settings?.default_currency || 'USD';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trial Balance - ${asOfDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .date { text-align: center; margin-bottom: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals { font-weight: bold; background-color: #f8f9fa; }
            .difference { color: ${trialBalance.difference === 0 ? 'green' : 'red'}; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Trial Balance</h1>
            <p>As of ${new Date(asOfDate).toLocaleDateString()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account Name</th>
                <th>Account Type</th>
                <th>Debit Balance (${currency})</th>
                <th>Credit Balance (${currency})</th>
                <th>Net Balance (${currency})</th>
              </tr>
            </thead>
            <tbody>
              ${trialBalance.entries.map(entry => `
                <tr>
                  <td>${entry.account.code}</td>
                  <td>${entry.account.name}</td>
                  <td>${entry.account.account_type}</td>
                  <td>${currency} ${entry.debitBalance.toFixed(2)}</td>
                  <td>${currency} ${entry.creditBalance.toFixed(2)}</td>
                  <td>${currency} ${entry.netBalance.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="totals">
                <td colspan="3"><strong>TOTALS</strong></td>
                <td><strong>${currency} ${trialBalance.totalDebits.toFixed(2)}</strong></td>
                <td><strong>${currency} ${trialBalance.totalCredits.toFixed(2)}</strong></td>
                <td class="difference"><strong>${currency} ${trialBalance.difference.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div style="text-align: center; margin-top: 30px;">
            <p><strong>Difference:</strong> <span class="difference">${trialBalance.difference.toFixed(2)}</span></p>
            <p style="color: ${trialBalance.difference === 0 ? 'green' : 'red'};">
              ${trialBalance.difference === 0 ? '✓ Trial Balance is Balanced' : '✗ Trial Balance is Unbalanced'}
            </p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getAccountTypeColor = (accountType: string) => {
    switch (accountType) {
      case 'asset': return 'text-blue-600 bg-blue-50';
      case 'liability': return 'text-red-600 bg-red-50';
      case 'equity': return 'text-purple-600 bg-purple-50';
      case 'revenue': return 'text-green-600 bg-green-50';
      case 'expense': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredEntries = trialBalance?.entries.filter(entry => {
    if (showUnbalanced) {
      return entry.debitBalance !== entry.creditBalance;
    }
    return true;
  }) || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-gray-600">View account balances and verify accounting equation</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportTrialBalance}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={printTrialBalance}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Filter className="h-4 w-4 mr-2" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              As of Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showUnbalanced}
              onChange={(e) => setShowUnbalanced(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Show unbalanced accounts only</span>
          </label>
        </div>
      </div>

      {/* Trial Balance Summary */}
      {trialBalance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Debits</p>
                <p className="text-xl font-bold text-blue-600">
                  {currency} {trialBalance.totalDebits.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Credits</p>
                <p className="text-xl font-bold text-green-600">
                  {currency} {trialBalance.totalCredits.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Difference</p>
                <p className={`text-xl font-bold ${trialBalance.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {currency} {trialBalance.difference.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                trialBalance.difference === 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {trialBalance.difference === 0 ? (
                  <span className="text-green-600 text-lg">✓</span>
                ) : (
                  <span className="text-red-600 text-lg">✗</span>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`text-xl font-bold ${trialBalance.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trialBalance.difference === 0 ? 'Balanced' : 'Unbalanced'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trial Balance Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    Account Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map(category => {
                  const categoryEntries = filteredEntries.filter(e => e.account.category_id === category.id);
                  if (categoryEntries.length === 0) return null;

                  return (
                    <React.Fragment key={category.id}>
                      <tr className="bg-gray-50/50">
                        <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {category.name}
                        </td>
                      </tr>
                      {categoryEntries.map((entry) => (
                        <tr key={entry.account.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-l-4 border-blue-400">
                            {entry.account.code}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                            {entry.account.name}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(entry.account.account_type)}`}>
                              {entry.account.account_type}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                            {entry.debitBalance > 0 ? `${currency} ${entry.debitBalance.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                            {entry.creditBalance > 0 ? `${currency} ${entry.creditBalance.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                            <span className={`font-medium ${entry.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {currency} {entry.netBalance.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Uncategorized accounts */}
                {filteredEntries.some(e => !e.account.category_id) && (
                  <>
                    <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Uncategorized
                      </td>
                    </tr>
                    {filteredEntries.filter(e => !e.account.category_id).map((entry) => (
                      <tr key={entry.account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-l-4 border-gray-400">
                          {entry.account.code}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {entry.account.name}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(entry.account.account_type)}`}>
                            {entry.account.account_type}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {entry.debitBalance > 0 ? `${currency} ${entry.debitBalance.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {entry.creditBalance > 0 ? `${currency} ${entry.creditBalance.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                          <span className={`font-medium ${entry.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {currency} {entry.netBalance.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {trialBalance && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">
                      TOTALS
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                      {currency} {trialBalance.totalDebits.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                      {currency} {trialBalance.totalCredits.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right">
                      <span className={trialBalance.difference === 0 ? 'text-green-600' : 'text-red-600'}>
                        {currency} {trialBalance.difference.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        
        {!loading && filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trial balance data</h3>
            <p className="text-gray-500">No accounts or journal entries found for the selected date.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalance; 