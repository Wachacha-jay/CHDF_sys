import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { BalanceSheetData, Account, AccountCategory, JournalEntry } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

const BalanceSheet: React.FC = () => {
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = settings?.default_currency || 'KES';
  const businessName = settings?.business_name || 'Organization';

  const formatCurrency = (value: number) => {
    return `${currency} ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  useEffect(() => {
    fetchBalanceSheetData();
  }, [asOfDate]);

  const fetchBalanceSheetData = async () => {
    try {
      setLoading(true);

      // Fetch accounts, categories, and journal entries (including all entries)
      const [accounts, categories, journalEntries] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories(),
        AccountingService.getJournalEntries({ end_date: asOfDate })
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

  const handleExportCSV = () => {
    if (!balanceSheetData) {
      toast.error('No balance sheet data to export');
      return;
    }

    const currentAssetsTotal = balanceSheetData.assets.current_assets.reduce((sum, a) => sum + a.amount, 0);
    const fixedAssetsTotal = balanceSheetData.assets.fixed_assets.reduce((sum, a) => sum + a.amount, 0);
    const currentLiabTotal = balanceSheetData.liabilities.current_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const longTermLiabTotal = balanceSheetData.liabilities.long_term_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const totalLiabAndEquity = balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity;

    const rows = [
      [`${businessName} - Balance Sheet`],
      [`As of: ${asOfDate}`],
      [`Currency: ${currency}`],
      [],
      ['Classification', 'Account Name', `Amount (${currency})`],
      ['ASSETS', '', ''],
      ['Current Assets', '', ''],
      ...balanceSheetData.assets.current_assets.map(a => ['Current Asset', `"${a.name.replace(/"/g, '""')}"`, a.amount.toFixed(2)]),
      ['Total Current Assets', '', currentAssetsTotal.toFixed(2)],
      [],
      ['Fixed Assets', '', ''],
      ...balanceSheetData.assets.fixed_assets.map(a => ['Fixed Asset', `"${a.name.replace(/"/g, '""')}"`, a.amount.toFixed(2)]),
      ['Total Fixed Assets', '', fixedAssetsTotal.toFixed(2)],
      [],
      ['TOTAL ASSETS', '', balanceSheetData.assets.total_assets.toFixed(2)],
      [],
      ['LIABILITIES & EQUITY', '', ''],
      ['Current Liabilities', '', ''],
      ...balanceSheetData.liabilities.current_liabilities.map(l => ['Current Liability', `"${l.name.replace(/"/g, '""')}"`, l.amount.toFixed(2)]),
      ['Total Current Liabilities', '', currentLiabTotal.toFixed(2)],
      [],
      ['Long-term Liabilities', '', ''],
      ...balanceSheetData.liabilities.long_term_liabilities.map(l => ['Long-term Liability', `"${l.name.replace(/"/g, '""')}"`, l.amount.toFixed(2)]),
      ['Total Long-term Liabilities', '', longTermLiabTotal.toFixed(2)],
      [],
      ['TOTAL LIABILITIES', '', balanceSheetData.liabilities.total_liabilities.toFixed(2)],
      [],
      ['Equity', '', ''],
      ...balanceSheetData.equity.equity_accounts.map(e => ['Equity', `"${e.name.replace(/"/g, '""')}"`, e.amount.toFixed(2)]),
      ['TOTAL EQUITY', '', balanceSheetData.equity.total_equity.toFixed(2)],
      [],
      ['TOTAL LIABILITIES & EQUITY', '', totalLiabAndEquity.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Balance_Sheet_As_Of_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Balance sheet exported to CSV');
  };

  const handlePrint = () => {
    if (!balanceSheetData) return;
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const currentAssetsTotal = balanceSheetData.assets.current_assets.reduce((sum, a) => sum + a.amount, 0);
    const fixedAssetsTotal = balanceSheetData.assets.fixed_assets.reduce((sum, a) => sum + a.amount, 0);
    const currentLiabTotal = balanceSheetData.liabilities.current_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const longTermLiabTotal = balanceSheetData.liabilities.long_term_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const totalLiabAndEquity = balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity;
    const isBalanced = Math.abs(balanceSheetData.assets.total_assets - totalLiabAndEquity) < 0.01;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Balance Sheet - ${businessName}</title>
        <style>
          @page { margin: 15mm; size: auto; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 12px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
          .header h2 { margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #475569; }
          .header p { margin: 0; color: #64748b; font-size: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .col-title { font-size: 14px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 12px; }
          .sub-section { margin-bottom: 16px; }
          .sub-title { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          .row { display: flex; justify-content: space-between; padding: 3px 0 3px 10px; font-size: 12px; }
          .subtotal-row { display: flex; justify-content: space-between; padding: 5px 0 5px 10px; font-weight: 600; border-top: 1px solid #cbd5e1; margin-top: 4px; font-size: 12px; }
          .total-box { display: flex; justify-content: space-between; padding: 10px; font-weight: 800; font-size: 14px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin-top: 15px; background: #f8fafc; }
          .balance-check { margin-top: 30px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>BALANCE SHEET</h2>
          <p>As of: <strong>${format(new Date(asOfDate), 'MMMM dd, yyyy')}</strong> &bull; Currency: <strong>${currency}</strong></p>
        </div>

        <div class="grid">
          <!-- Assets -->
          <div>
            <div class="col-title">Assets</div>
            
            <div class="sub-section">
              <div class="sub-title">Current Assets</div>
              ${balanceSheetData.assets.current_assets.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.assets.current_assets.map(a => `
                <div class="row">
                  <span>${a.name}</span>
                  <span>${formatCurrency(a.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Current Assets</span>
                <span>${formatCurrency(currentAssetsTotal)}</span>
              </div>
            </div>

            <div class="sub-section">
              <div class="sub-title">Fixed Assets</div>
              ${balanceSheetData.assets.fixed_assets.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.assets.fixed_assets.map(a => `
                <div class="row">
                  <span>${a.name}</span>
                  <span>${formatCurrency(a.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Fixed Assets</span>
                <span>${formatCurrency(fixedAssetsTotal)}</span>
              </div>
            </div>

            <div class="total-box">
              <span>TOTAL ASSETS</span>
              <span>${formatCurrency(balanceSheetData.assets.total_assets)}</span>
            </div>
          </div>

          <!-- Liabilities & Equity -->
          <div>
            <div class="col-title">Liabilities &amp; Equity</div>

            <div class="sub-section">
              <div class="sub-title">Current Liabilities</div>
              ${balanceSheetData.liabilities.current_liabilities.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.liabilities.current_liabilities.map(l => `
                <div class="row">
                  <span>${l.name}</span>
                  <span>${formatCurrency(l.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Current Liabilities</span>
                <span>${formatCurrency(currentLiabTotal)}</span>
              </div>
            </div>

            <div class="sub-section">
              <div class="sub-title">Long-term Liabilities</div>
              ${balanceSheetData.liabilities.long_term_liabilities.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.liabilities.long_term_liabilities.map(l => `
                <div class="row">
                  <span>${l.name}</span>
                  <span>${formatCurrency(l.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Long-term Liabilities</span>
                <span>${formatCurrency(longTermLiabTotal)}</span>
              </div>
            </div>

            <div class="subtotal-row" style="border-top: 1.5px solid #0f172a; margin-top: 8px; font-weight: 700;">
              <span>TOTAL LIABILITIES</span>
              <span>${formatCurrency(balanceSheetData.liabilities.total_liabilities)}</span>
            </div>

            <div class="sub-section" style="margin-top: 16px;">
              <div class="sub-title">Equity</div>
              ${balanceSheetData.equity.equity_accounts.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.equity.equity_accounts.map(e => `
                <div class="row">
                  <span>${e.name}</span>
                  <span>${formatCurrency(e.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>TOTAL EQUITY</span>
                <span>${formatCurrency(balanceSheetData.equity.total_equity)}</span>
              </div>
            </div>

            <div class="total-box">
              <span>TOTAL LIABILITIES &amp; EQUITY</span>
              <span>${formatCurrency(totalLiabAndEquity)}</span>
            </div>
          </div>
        </div>

        <div class="balance-check">
          <span>Accounting Equation Verification:</span>
          <span style="color: ${isBalanced ? '#15803d' : '#b91c1c'};">
            ${isBalanced ? '✓ Assets Equal Liabilities + Equity (Balanced)' : '✗ Out of Balance'}
          </span>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-indigo-600" />
            Balance Sheet
          </h1>
          <p className="text-gray-600 mt-1">Financial position for {businessName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none"
            />
          </div>
          <button 
            onClick={handlePrint}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center text-sm font-medium shadow-sm"
          >
            <Printer className="w-4 h-4 mr-2 text-gray-600" />
            Print / PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center text-sm font-medium shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {balanceSheetData && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-8">
              {settings?.logo_url && (
                <img src={settings.logo_url} alt={businessName} className="h-14 mx-auto mb-2 object-contain" />
              )}
              <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{businessName}</h2>
              <p className="text-gray-600 font-semibold mt-1">BALANCE SHEET</p>
              <p className="text-xs text-gray-500 mt-0.5">As of {format(new Date(asOfDate), 'MMMM dd, yyyy')} &bull; Currency: {currency}</p>
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