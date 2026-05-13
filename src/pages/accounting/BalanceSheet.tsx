import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download } from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { BalanceSheetData, Account, AccountCategory, JournalEntry } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useSettingsContext } from '../../contexts/SettingsContext';

const BalanceSheet: React.FC = () => {
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { settings } = useSettingsContext();

  const formatCurrency = (value: number) => {
    if (settings?.default_currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: settings.default_currency }).format(value);
      } catch (e) {
        // Fallback if currency code is invalid or Intl fails
        return value.toLocaleString();
      }
    }
    return value.toLocaleString();
  };

  useEffect(() => {
    fetchBalanceSheetData();
  }, [asOfDate]);

  const fetchBalanceSheetData = async () => {
    try {
      setLoading(true);

      // Fetch accounts and categories
      const [accounts, categories, journalEntries] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories(),
        AccountingService.getJournalEntries({ end_date: asOfDate, is_posted: true })
      ]);

      // Calculate account balances from journal entries
      const accountBalances = new Map<string, number>();
      journalEntries.forEach(entry => {
        if (entry.lines) {
          entry.lines.forEach(line => {
            const current = accountBalances.get(line.account_id) || 0;
            accountBalances.set(line.account_id, current + Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
          });
        }
      });

      const getCategoryGroup = (type: string, catNames: string[]) => {
        return categories
          .filter(c => c.account_type === type && catNames.some(name => c.name.toLowerCase().includes(name.toLowerCase())))
          .flatMap(c => accounts.filter(a => a.category_id === c.id))
          .map(a => ({
            name: a.name,
            amount: Math.abs(accountBalances.get(a.id) || 0)
          }))
          .filter(a => a.amount !== 0);
      };

      const getRemainingForType = (type: string, excludedIds: string[]) => {
        return accounts
          .filter(a => a.account_type === type && !excludedIds.includes(a.id))
          .map(a => ({
            name: a.name,
            amount: Math.abs(accountBalances.get(a.id) || 0)
          }))
          .filter(a => a.amount !== 0);
      };

      const currentAssets = getCategoryGroup('asset', ['current', 'cash', 'receivable', 'bank', 'inventory']);
      const currentAssetIds = accounts.filter(a => a.account_type === 'asset' && a.category_id && categories.some(c => c.id === a.category_id && ['current', 'cash', 'receivable', 'bank', 'inventory'].some(n => c.name.toLowerCase().includes(n)))).map(a => a.id);
      const fixedAssets = getRemainingForType('asset', currentAssetIds);

      const currentLiabilities = getCategoryGroup('liability', ['current', 'payable', 'accrued', 'payroll', 'tax', 'nssf', 'nhif', 'shif', 'levy']);
      const currentLiabIds = accounts.filter(a => a.account_type === 'liability' && a.category_id && categories.some(c => c.id === a.category_id && ['current', 'payable', 'accrued', 'payroll', 'tax', 'nssf', 'nhif', 'shif', 'levy'].some(n => c.name.toLowerCase().includes(n)))).map(a => a.id);
      const longTermLiabilities = getRemainingForType('liability', currentLiabIds);

      const equityAccounts = accounts
        .filter(account => account.account_type === 'equity')
        .map(account => ({
          name: account.name,
          amount: accountBalances.get(account.id) || 0
        }));

      const totalAssets = [...currentAssets, ...fixedAssets].reduce((sum, item) => sum + item.amount, 0);
      const totalLiabilities = [...currentLiabilities, ...longTermLiabilities].reduce((sum, item) => sum + item.amount, 0);
      const totalEquity = equityAccounts.reduce((sum, item) => sum + item.amount, 0);

      setBalanceSheetData({
        assets: {
          current_assets: currentAssets,
          fixed_assets: fixedAssets,
          total_assets: totalAssets
        },
        liabilities: {
          current_liabilities: currentLiabilities,
          long_term_liabilities: longTermLiabilities,
          total_liabilities: totalLiabilities
        },
        equity: {
          equity_accounts: equityAccounts,
          total_equity: totalEquity
        }
      });

    } catch (error: any) {
      console.error('Error fetching balance sheet data:', error);
      toast.error('Failed to load balance sheet data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2" />
            Balance Sheet
          </h1>
          <p className="text-gray-600 mt-1">Financial position as of {format(new Date(asOfDate), 'MMMM dd, yyyy')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {balanceSheetData && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-900">Balance Sheet</h2>
              <p className="text-gray-600">As of {format(new Date(asOfDate), 'MMMM dd, yyyy')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Assets */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  ASSETS
                </h3>

                {/* Current Assets */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Current Assets</h4>
                  <div className="space-y-2 ml-4">
                    {balanceSheetData.assets.current_assets.map((asset, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-700">{asset.name}</span>
                        <span className="font-medium">{formatCurrency(asset.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                      <span>Total Current Assets</span>
                      <span>{formatCurrency(balanceSheetData.assets.current_assets.reduce((sum, asset) => sum + asset.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                {/* Fixed Assets */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Fixed Assets</h4>
                  <div className="space-y-2 ml-4">
                    {balanceSheetData.assets.fixed_assets.map((asset, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-700">{asset.name}</span>
                        <span className="font-medium">{formatCurrency(asset.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                      <span>Total Fixed Assets</span>
                      <span>{formatCurrency(balanceSheetData.assets.fixed_assets.reduce((sum, asset) => sum + asset.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-3">
                  <span>TOTAL ASSETS</span>
                  <span>{formatCurrency(balanceSheetData.assets.total_assets)}</span>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  LIABILITIES & EQUITY
                </h3>

                {/* Current Liabilities */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Current Liabilities</h4>
                  <div className="space-y-2 ml-4">
                    {balanceSheetData.liabilities.current_liabilities.map((liability, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-700">{liability.name}</span>
                        <span className="font-medium">{formatCurrency(liability.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                      <span>Total Current Liabilities</span>
                      <span>{formatCurrency(balanceSheetData.liabilities.current_liabilities.reduce((sum, liability) => sum + liability.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                {/* Long-term Liabilities */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Long-term Liabilities</h4>
                  <div className="space-y-2 ml-4">
                    {balanceSheetData.liabilities.long_term_liabilities.map((liability, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-700">{liability.name}</span>
                        <span className="font-medium">{formatCurrency(liability.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                      <span>Total Long-term Liabilities</span>
                      <span>{formatCurrency(balanceSheetData.liabilities.long_term_liabilities.reduce((sum, liability) => sum + liability.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between font-medium border-t border-gray-200 pt-2 mb-6">
                  <span>TOTAL LIABILITIES</span>
                  <span>{formatCurrency(balanceSheetData.liabilities.total_liabilities)}</span>
                </div>

                {/* Equity */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Equity</h4>
                  <div className="space-y-2 ml-4">
                    {balanceSheetData.equity.equity_accounts.map((equity, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-700">{equity.name}</span>
                        <span className="font-medium">{formatCurrency(equity.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                      <span>TOTAL EQUITY</span>
                      <span>{formatCurrency(balanceSheetData.equity.total_equity)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-3">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>{formatCurrency(balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity)}</span>
                </div>
              </div>
            </div>

            {/* Balance Check */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Balance Check:</span>
                <span className={`font-bold ${Math.abs(balanceSheetData.assets.total_assets - (balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity)) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                  }`}>
                  {Math.abs(balanceSheetData.assets.total_assets - (balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity)) < 0.01
                    ? 'Balanced ✓'
                    : 'Not Balanced ✗'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceSheet;