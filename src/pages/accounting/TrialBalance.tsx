import React, { useState, useEffect } from 'react';
import { Download, Filter, Calendar, TrendingUp, DollarSign, Printer, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AccountingService } from '../../services/accountingService';
import type { Account, JournalEntry, AccountCategory } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

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
  const { user } = useAuthContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') ? settings.default_currency : 'KES';
  const businessName = settings?.business_name || 'Organization';
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
      const [accountsTree, categoriesData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories()
      ]);
      
      const flatAccounts = AccountingService.flattenAccounts(accountsTree);
      setCategories(categoriesData);

      // Get all journal entries up to the selected date
      const journalEntries = await AccountingService.getJournalEntries({
        end_date: asOfDate,
        is_posted: true
      });

      // Calculate trial balance
      const trialBalanceData = calculateTrialBalance(flatAccounts, journalEntries, asOfDate);
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

    // Create trial balance entries adhering to standard closing Trial Balance rules
    const entries: TrialBalanceEntry[] = accounts.map(account => {
      const balance = accountBalances.get(account.id) || { debits: 0, credits: 0 };
      const net = balance.debits - balance.credits;
      
      // Net debit goes to Debit column; Net credit goes to Credit column
      const debitBalance = net > 0 ? net : 0;
      const creditBalance = net < 0 ? Math.abs(net) : 0;

      return {
        account,
        debitBalance,
        creditBalance,
        netBalance: net
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

  const filteredEntries = trialBalance?.entries.filter(entry => {
    if (showUnbalanced) {
      const isDebitNormal = entry.account.account_type === 'asset' || 
                            entry.account.account_type === 'expense' || 
                            entry.account.code?.startsWith('1') || 
                            entry.account.code?.startsWith('5');
      if (isDebitNormal) {
        return entry.netBalance < -0.01; // Abnormal credit balance
      } else {
        return entry.netBalance > 0.01;  // Abnormal debit balance
      }
    }
    return true;
  }) || [];

  const exportTrialBalance = () => {
    if (!trialBalance || filteredEntries.length === 0) {
      toast.error('No trial balance data to export');
      return;
    }

    const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debitBalance, 0);
    const totalCredits = filteredEntries.reduce((sum, e) => sum + e.creditBalance, 0);
    const diff = totalDebits - totalCredits;

    const rows: (string | number)[][] = [
      [`${businessName} - Trial Balance Report`],
      [`As of: ${asOfDate}`],
      [`Currency: ${currency}`],
      [],
      ['Account Code', 'Account Name', 'Account Type', `Debit Balance (${currency})`, `Credit Balance (${currency})`, `Net Balance (${currency})`],
      ...filteredEntries.map(entry => [
        entry.account.code,
        `"${entry.account.name.replace(/"/g, '""')}"`,
        entry.account.account_type,
        entry.debitBalance.toFixed(2),
        entry.creditBalance.toFixed(2),
        entry.netBalance.toFixed(2)
      ]),
      [],
      ['TOTALS', '', '', totalDebits.toFixed(2), totalCredits.toFixed(2), diff.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trial_Balance_As_Of_${asOfDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Trial balance exported to CSV');
  };

  const printTrialBalance = () => {
    if (!trialBalance || filteredEntries.length === 0) {
      toast.error('No data to print');
      return;
    }

    const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debitBalance, 0);
    const totalCredits = filteredEntries.reduce((sum, e) => sum + e.creditBalance, 0);
    const diff = totalDebits - totalCredits;
    const isBalanced = Math.abs(diff) < 0.01;
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trial Balance - ${businessName}</title>
          <style>
            @page { margin: 12mm; size: auto; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 11px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
            .header h2 { margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #475569; }
            .header p { margin: 0; color: #64748b; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; text-align: left; }
            th.right, td.right { text-align: right; }
            td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 11px; }
            tr.totals td { font-weight: 800; background: #0f172a; color: #fff; border-color: #0f172a; font-size: 11.5px; }
            .status-box { text-align: center; margin: 25px 0; padding: 12px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
            .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h1>${businessName}</h1>
            <h2>TRIAL BALANCE REPORT</h2>
            <p>As of: <strong>${new Date(asOfDate).toLocaleDateString()}</strong> &bull; Currency: <strong>${currency}</strong> &bull; Accounts: <strong>${filteredEntries.length}</strong></p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Account Code</th>
                <th style="width: 35%;">Account Name</th>
                <th style="width: 14%;">Account Type</th>
                <th class="right" style="width: 12%;">Debit (${currency})</th>
                <th class="right" style="width: 12%;">Credit (${currency})</th>
                <th class="right" style="width: 12%;">Net Balance (${currency})</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(entry => `
                <tr>
                  <td><strong>${entry.account.code}</strong></td>
                  <td>${entry.account.name}</td>
                  <td style="text-transform: capitalize;">${entry.account.account_type}</td>
                  <td class="right">${currency} ${entry.debitBalance.toFixed(2)}</td>
                  <td class="right">${currency} ${entry.creditBalance.toFixed(2)}</td>
                  <td class="right">${currency} ${entry.netBalance.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="totals">
                <td colspan="3">TOTALS</td>
                <td class="right">${currency} ${totalDebits.toFixed(2)}</td>
                <td class="right">${currency} ${totalCredits.toFixed(2)}</td>
                <td class="right">${currency} ${diff.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="status-box">
            <p><strong>Difference:</strong> ${currency} ${diff.toFixed(2)}</p>
            <p style="color: ${isBalanced ? '#15803d' : '#b91c1c'}; font-weight: 700; margin-top: 4px;">
              ${isBalanced ? '✓ Trial Balance is in Balance' : '✗ Trial Balance is Unbalanced'}
            </p>
          </div>

          <div class="footer">
            <span>Prepared by: ${user?.name || user?.email || 'Authorized User'}</span>
            <span>Printed on: ${new Date().toLocaleString()}</span>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
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

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-gray-600">View account balances and verify accounting equation for {businessName}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={printTrialBalance}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
          >
            <Printer className="h-4 w-4 mr-2 text-gray-600" />
            Print / PDF
          </button>
          <button
            onClick={exportTrialBalance}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
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