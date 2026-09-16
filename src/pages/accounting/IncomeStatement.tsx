import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  Printer, 
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';
import toast from 'react-hot-toast';

interface IncomeStatementData {
  revenue: { name: string; amount: number }[];
  totalRevenue: number;
  costOfGoodsSold: { name: string; amount: number }[];
  totalCOGS: number;
  grossProfit: number;
  operatingExpenses: { name: string; amount: number }[];
  totalExpenses: number;
  netIncome: number;
}

const IncomeStatement: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = settings?.default_currency || 'KES';
  const businessName = settings?.business_name || 'Organization';
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadIncomeStatement();
  }, [dateRange]);

  const loadIncomeStatement = async () => {
    try {
      setLoading(true);
      // Fetch accounts and entries (include all journal entries)
      const accounts = await AccountingService.getAccounts();
      const entries = await AccountingService.getJournalEntries({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      });

      // Simple aggregation logic
      const balances = new Map<string, number>();
      entries.forEach(entry => {
        entry.lines?.forEach(line => {
          const current = balances.get(line.account_id) || 0;
          balances.set(line.account_id, current + Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
        });
      });

      const revenue: { name: string; amount: number }[] = [];
      const costOfGoodsSold: { name: string; amount: number }[] = [];
      const operatingExpenses: { name: string; amount: number }[] = [];

      // Flatten account tree for easier processing
      const flattenAccounts = (accs: any[]): any[] => {
        return accs.reduce((flat, acc) => {
          return flat.concat(acc, acc.children ? flattenAccounts(acc.children) : []);
        }, []);
      };

      const allAccounts = flattenAccounts(accounts);

      allAccounts.forEach(acc => {
        const balance = balances.get(acc.id) || 0;
        if (acc.account_type === 'revenue' && balance !== 0) {
          revenue.push({ name: acc.name, amount: Math.abs(balance) });
        } else if (acc.account_type === 'expense') {
          if (acc.name.toLowerCase().includes('cost of goods')) {
            costOfGoodsSold.push({ name: acc.name, amount: Math.abs(balance) });
          } else if (balance !== 0) {
            operatingExpenses.push({ name: acc.name, amount: Math.abs(balance) });
          }
        }
      });

      const totalRevenue = revenue.reduce((sum, item) => sum + item.amount, 0);
      const totalCOGS = costOfGoodsSold.reduce((sum, item) => sum + item.amount, 0);
      const grossProfit = totalRevenue - totalCOGS;
      const totalExpenses = operatingExpenses.reduce((sum, item) => sum + item.amount, 0);
      const netIncome = grossProfit - totalExpenses;

      setData({
        revenue,
        totalRevenue,
        costOfGoodsSold,
        totalCOGS,
        grossProfit,
        operatingExpenses,
        totalExpenses,
        netIncome
      });
    } catch (error) {
      console.error('Error loading income statement:', error);
      toast.error('Failed to load income statement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const setDatePreset = (preset: 'this_month' | 'this_year' | 'last_30' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setDateRange({ startDate: start, endDate: todayStr });
    } else if (preset === 'this_year') {
      setDateRange({ startDate: `${today.getFullYear()}-01-01`, endDate: todayStr });
    } else if (preset === 'last_30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateRange({ startDate: d.toISOString().split('T')[0], endDate: todayStr });
    } else if (preset === 'all') {
      setDateRange({ startDate: '2020-01-01', endDate: todayStr });
    }
  };

  const handleExportCSV = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }
    const rows = [
      [`${businessName} - Income Statement`],
      [`Period: ${dateRange.startDate} to ${dateRange.endDate}`],
      [`Currency: ${currency}`],
      [],
      ['Category', 'Account', `Amount (${currency})`],
      ['REVENUE', '', ''],
      ...data.revenue.map(r => ['Revenue', `"${r.name.replace(/"/g, '""')}"`, r.amount.toFixed(2)]),
      ['Total Revenue', '', data.totalRevenue.toFixed(2)],
      [],
      ['COST OF GOODS SOLD', '', ''],
      ...data.costOfGoodsSold.map(c => ['Cost of Goods Sold', `"${c.name.replace(/"/g, '""')}"`, c.amount.toFixed(2)]),
      ['Total Cost of Goods Sold', '', data.totalCOGS.toFixed(2)],
      [],
      ['GROSS PROFIT', '', data.grossProfit.toFixed(2)],
      [],
      ['OPERATING EXPENSES', '', ''],
      ...data.operatingExpenses.map(e => ['Operating Expenses', `"${e.name.replace(/"/g, '""')}"`, e.amount.toFixed(2)]),
      ['Total Operating Expenses', '', data.totalExpenses.toFixed(2)],
      [],
      ['NET INCOME', '', data.netIncome.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Income_Statement_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Income statement exported to CSV');
  };

  const handlePrint = () => {
    if (!data) return;
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Income Statement - ${businessName}</title>
        <style>
          @page { margin: 15mm; size: auto; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .header h2 { margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #475569; letter-spacing: 1px; }
          .header p { margin: 0; color: #64748b; font-size: 12px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px; color: #0f172a; }
          .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .row-total { display: flex; justify-content: space-between; padding: 6px 0; font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 4px; font-size: 13px; }
          .highlight-box { display: flex; justify-content: space-between; padding: 10px 14px; font-weight: 800; font-size: 15px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin: 15px 0; background-color: #f8fafc; }
          .net-income-box { display: flex; justify-content: space-between; padding: 12px 14px; font-weight: 800; font-size: 17px; border-top: 3px double #0f172a; border-bottom: 3px double #0f172a; margin: 20px 0; background-color: #f1f5f9; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>INCOME STATEMENT</h2>
          <p>For the period: <strong>${new Date(dateRange.startDate).toLocaleDateString()}</strong> to <strong>${new Date(dateRange.endDate).toLocaleDateString()}</strong> &bull; Currency: <strong>${currency}</strong></p>
        </div>

        <div class="section">
          <div class="section-title">Revenue</div>
          ${data.revenue.length === 0 ? '<div class="row" style="color: #94a3b8; font-style: italic;">No revenue recorded for this period</div>' : data.revenue.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span>${currency} ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Total Revenue</span>
            <span>${currency} ${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Cost of Goods Sold</div>
          ${data.costOfGoodsSold.length === 0 ? '<div class="row" style="color: #94a3b8; font-style: italic;">No COGS recorded for this period</div>' : data.costOfGoodsSold.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span>(${currency} ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Total Cost of Goods Sold</span>
            <span>(${currency} ${data.totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
          </div>
        </div>

        <div class="highlight-box">
          <span>GROSS PROFIT</span>
          <span>${currency} ${data.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div class="section">
          <div class="section-title">Operating Expenses</div>
          ${data.operatingExpenses.length === 0 ? '<div class="row" style="color: #94a3b8; font-style: italic;">No operating expenses recorded for this period</div>' : data.operatingExpenses.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span>${currency} ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Total Operating Expenses</span>
            <span>${currency} ${data.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div class="net-income-box">
          <span>NET INCOME</span>
          <span style="color: ${data.netIncome >= 0 ? '#15803d' : '#b91c1c'};">
            ${currency} ${data.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div class="footer">
          <span>Prepared by: ${user?.name || user?.email || 'System User'}</span>
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income Statement</h1>
          <p className="text-sm text-gray-500">Profit and Loss report for {businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-gray-600" /> Print / PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              onClick={loadIncomeStatement}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg text-sm hover:bg-indigo-100 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" /> Apply
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 uppercase font-semibold mr-1">Presets:</span>
            <button
              onClick={() => setDatePreset('this_month')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => setDatePreset('this_year')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              This Year
            </button>
            <button
              onClick={() => setDatePreset('last_30')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDatePreset('all')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              All Records
            </button>
          </div>
        </div>

        <div className="p-8 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            {settings?.logo_url && (
              <img src={settings.logo_url} alt={businessName} className="h-14 mx-auto mb-2 object-contain" />
            )}
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{businessName}</h2>
            <p className="text-gray-600 font-semibold mt-1">INCOME STATEMENT</p>
            <p className="text-xs text-gray-500 mt-0.5">For the period {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()} &bull; Currency: {currency}</p>
          </div>

          <div className="space-y-8">
            {/* Revenue */}
            <div>
              <h3 className="font-bold text-gray-900 border-b border-gray-900 mb-2">REVENUE</h3>
              {data?.revenue.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-sm">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                <span>Total Revenue</span>
                <span>{formatCurrency(data?.totalRevenue || 0)}</span>
              </div>
            </div>

            {/* COGS */}
            <div>
              <h3 className="font-bold text-gray-900 border-b border-gray-900 mb-2">COST OF GOODS SOLD</h3>
              {data?.costOfGoodsSold.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-sm">
                  <span>{item.name}</span>
                  <span>({formatCurrency(item.amount)})</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                <span>Total Cost of Goods Sold</span>
                <span>({formatCurrency(data?.totalCOGS || 0)})</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between py-3 font-bold text-lg border-y-2 border-gray-900">
              <span>GROSS PROFIT</span>
              <span>{formatCurrency(data?.grossProfit || 0)}</span>
            </div>

            {/* Operating Expenses */}
            <div>
              <h3 className="font-bold text-gray-900 border-b border-gray-900 mb-2">OPERATING EXPENSES</h3>
              {data?.operatingExpenses.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-sm">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                <span>Total Operating Expenses</span>
                <span>{formatCurrency(data?.totalExpenses || 0)}</span>
              </div>
            </div>

            {/* Net Income */}
            <div className="flex justify-between py-4 font-bold text-xl border-y-4 border-double border-gray-900 bg-gray-50 px-4">
              <span>NET INCOME</span>
              <span className={data?.netIncome && data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(data?.netIncome || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeStatement;
