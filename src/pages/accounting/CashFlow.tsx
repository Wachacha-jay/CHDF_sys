import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Printer, 
  Download,
  Calendar,
  Filter,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';
import toast from 'react-hot-toast';

interface CashFlowData {
  operating: { name: string; amount: number }[];
  totalOperating: number;
  investing: { name: string; amount: number }[];
  totalInvesting: number;
  financing: { name: string; amount: number }[];
  totalFinancing: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

const CashFlow: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = settings?.default_currency || 'KES';
  const businessName = settings?.business_name || 'Organization';
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadCashFlow();
  }, [dateRange]);

  const loadCashFlow = async () => {
    try {
      setLoading(true);
      
      const accounts = await AccountingService.getAccounts();
      const flatAccounts = flattenAccounts(accounts);
      const entries = await AccountingService.getJournalEntries({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        is_posted: true
      });

      // Calculate Opening Balance (Cash and Bank accounts only)
      const cashAccounts = flatAccounts.filter(a => 
        a.account_type === 'asset' && 
        (a.code?.startsWith('10') || a.code?.startsWith('11') || /cash|bank|mpesa|equity|kcb|coop/i.test(a.name))
      );
      const cashAccountIds = cashAccounts.map(a => a.id);
      
      let openingBalance = 0;
      for (const id of cashAccountIds) {
        openingBalance += await AccountingService.getAccountBalanceAsOf(id, dateRange.startDate);
      }

      // Classification logic
      const operating: { name: string; amount: number }[] = [];
      const investing: { name: string; amount: number }[] = [];
      const financing: { name: string; amount: number }[] = [];

      entries.forEach(entry => {
        const cashMovementLine = entry.lines?.find(l => cashAccountIds.includes(l.account_id));
        if (cashMovementLine) {
          const amount = (cashMovementLine.debit_amount || 0) - (cashMovementLine.credit_amount || 0);
          
          const otherLines = entry.lines?.filter(l => !cashAccountIds.includes(l.account_id)) || [];
          const primaryAccount = otherLines[0]?.account;

          if (primaryAccount) {
            const isFixedAsset = primaryAccount.account_subtype === 'fixed' || 
              primaryAccount.code?.startsWith('12') || 
              primaryAccount.code?.startsWith('15') || 
              /equipment|machinery|vehicle|building|infrastructure|furniture|computer/i.test(primaryAccount.name);

            if (isFixedAsset) {
              investing.push({ name: entry.description, amount });
            } else if (primaryAccount.account_type === 'revenue' || primaryAccount.account_type === 'expense' || primaryAccount.code?.startsWith('4') || primaryAccount.code?.startsWith('5')) {
              operating.push({ name: entry.description, amount });
            } else if (primaryAccount.account_type === 'liability' || primaryAccount.account_type === 'equity' || primaryAccount.code?.startsWith('2') || primaryAccount.code?.startsWith('3')) {
              financing.push({ name: entry.description, amount });
            } else {
              operating.push({ name: entry.description, amount });
            }
          }
        }
      });

      const totalOperating = operating.reduce((sum, item) => sum + item.amount, 0);
      const totalInvesting = investing.reduce((sum, item) => sum + item.amount, 0);
      const totalFinancing = financing.reduce((sum, item) => sum + item.amount, 0);
      const netCashFlow = totalOperating + totalInvesting + totalFinancing;

      setData({
        operating,
        totalOperating,
        investing,
        totalInvesting,
        financing,
        totalFinancing,
        netCashFlow,
        openingBalance,
        closingBalance: openingBalance + netCashFlow
      });
    } catch (error) {
      console.error('Error loading cash flow:', error);
      toast.error('Failed to load cash flow statement');
    } finally {
      setLoading(false);
    }
  };

  const flattenAccounts = (accs: any[]): any[] => {
    return accs.reduce((flat, acc) => {
      return flat.concat(acc, acc.children ? flattenAccounts(acc.children) : []);
    }, []);
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
      toast.error('No cash flow data to export');
      return;
    }

    const rows = [
      [`${businessName} - Statement of Cash Flows`],
      [`Period: ${dateRange.startDate} to ${dateRange.endDate}`],
      [`Currency: ${currency}`],
      [],
      ['Activity Category', 'Item Description', `Amount (${currency})`],
      ['Beginning Cash Balance', '', data.openingBalance.toFixed(2)],
      [],
      ['OPERATING ACTIVITIES', '', ''],
      ...data.operating.map(o => ['Operating', `"${o.name.replace(/"/g, '""')}"`, o.amount.toFixed(2)]),
      ['Net Cash from Operating Activities', '', data.totalOperating.toFixed(2)],
      [],
      ['INVESTING ACTIVITIES', '', ''],
      ...data.investing.map(i => ['Investing', `"${i.name.replace(/"/g, '""')}"`, i.amount.toFixed(2)]),
      ['Net Cash from Investing Activities', '', data.totalInvesting.toFixed(2)],
      [],
      ['FINANCING ACTIVITIES', '', ''],
      ...data.financing.map(f => ['Financing', `"${f.name.replace(/"/g, '""')}"`, f.amount.toFixed(2)]),
      ['Net Cash from Financing Activities', '', data.totalFinancing.toFixed(2)],
      [],
      ['Net Increase/Decrease in Cash', '', data.netCashFlow.toFixed(2)],
      ['Ending Cash Balance', '', data.closingBalance.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cash_Flow_Statement_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Cash flow statement exported to CSV');
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
        <title>Statement of Cash Flows - ${businessName}</title>
        <style>
          @page { margin: 15mm; size: auto; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
          .header h2 { margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #475569; }
          .header p { margin: 0; color: #64748b; font-size: 12px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px; color: #0f172a; }
          .row { display: flex; justify-content: space-between; padding: 5px 0 5px 12px; font-size: 13px; }
          .row-total { display: flex; justify-content: space-between; padding: 6px 0 6px 12px; font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 4px; font-size: 13px; }
          .highlight-box { display: flex; justify-content: space-between; padding: 10px 14px; font-weight: 800; font-size: 14px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin: 15px 0; background-color: #f8fafc; }
          .net-box { display: flex; justify-content: space-between; padding: 12px 14px; font-weight: 800; font-size: 16px; border-top: 3px double #0f172a; border-bottom: 3px double #0f172a; margin: 20px 0; background-color: #f1f5f9; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>STATEMENT OF CASH FLOWS</h2>
          <p>For the period: <strong>${new Date(dateRange.startDate).toLocaleDateString()}</strong> to <strong>${new Date(dateRange.endDate).toLocaleDateString()}</strong> &bull; Currency: <strong>${currency}</strong></p>
        </div>

        <div class="highlight-box">
          <span>Beginning Cash Balance</span>
          <span>${formatCurrency(data.openingBalance)}</span>
        </div>

        <div class="section">
          <div class="section-title">Operating Activities</div>
          ${data.operating.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">No operating movements</div>' : data.operating.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span style="color: ${item.amount >= 0 ? '#15803d' : '#b91c1c'};">${formatCurrency(item.amount)}</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Net Cash from Operating Activities</span>
            <span>${formatCurrency(data.totalOperating)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Investing Activities</div>
          ${data.investing.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">No investing movements</div>' : data.investing.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span style="color: ${item.amount >= 0 ? '#15803d' : '#b91c1c'};">${formatCurrency(item.amount)}</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Net Cash from Investing Activities</span>
            <span>${formatCurrency(data.totalInvesting)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Financing Activities</div>
          ${data.financing.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">No financing movements</div>' : data.financing.map(item => `
            <div class="row">
              <span>${item.name}</span>
              <span style="color: ${item.amount >= 0 ? '#15803d' : '#b91c1c'};">${formatCurrency(item.amount)}</span>
            </div>
          `).join('')}
          <div class="row-total">
            <span>Net Cash from Financing Activities</span>
            <span>${formatCurrency(data.totalFinancing)}</span>
          </div>
        </div>

        <div class="highlight-box">
          <span>Net Increase/Decrease in Cash</span>
          <span>${formatCurrency(data.netCashFlow)}</span>
        </div>

        <div class="net-box">
          <span>Ending Cash Balance</span>
          <span style="color: #4338ca;">
            ${formatCurrency(data.closingBalance)}
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
          <h1 className="text-2xl font-bold text-gray-900">Statement of Cash Flows</h1>
          <p className="text-sm text-gray-500">Track the movement of cash for {businessName}</p>
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
              onClick={loadCashFlow}
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
            <p className="text-gray-600 font-semibold mt-1">STATEMENT OF CASH FLOWS</p>
            <p className="text-xs text-gray-500 mt-0.5">For the period {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()} &bull; Currency: {currency}</p>
          </div>

          <div className="space-y-8">
            {/* Opening Balance */}
            <div className="flex justify-between py-2 border-b-2 border-gray-900 font-bold bg-gray-50 px-2">
              <span>Beginning Cash Balance</span>
              <span>{formatCurrency(data?.openingBalance || 0)}</span>
            </div>

            {/* Operating Activities */}
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                <PlusCircle className="w-4 h-4 text-green-600" /> OPERATING ACTIVITIES
              </h3>
              <div className="ml-6 space-y-1">
                {data?.operating.length === 0 && <p className="text-sm text-gray-400 italic">No movement recorded</p>}
                {data?.operating.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-sm">
                    <span>{item.name}</span>
                    <span className={item.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {item.amount >= 0 ? '' : '-'}{formatCurrency(Math.abs(item.amount))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                  <span>Net Cash from Operating Activities</span>
                  <span>{formatCurrency(data?.totalOperating || 0)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" /> INVESTING ACTIVITIES
              </h3>
              <div className="ml-6 space-y-1">
                {data?.investing.length === 0 && <p className="text-sm text-gray-400 italic">No movement recorded</p>}
                {data?.investing.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-sm">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                  <span>Net Cash from Investing Activities</span>
                  <span>{formatCurrency(data?.totalInvesting || 0)}</span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                <MinusCircle className="w-4 h-4 text-orange-600" /> FINANCING ACTIVITIES
              </h3>
              <div className="ml-6 space-y-1">
                {data?.financing.length === 0 && <p className="text-sm text-gray-400 italic">No movement recorded</p>}
                {data?.financing.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-sm">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold border-t border-gray-300 mt-2">
                  <span>Net Cash from Financing Activities</span>
                  <span>{formatCurrency(data?.totalFinancing || 0)}</span>
                </div>
              </div>
            </div>

            {/* Net Increase/Decrease */}
            <div className="flex justify-between py-3 font-bold border-t-2 border-gray-900">
              <span>Net Increase/Decrease in Cash</span>
              <span>{formatCurrency(data?.netCashFlow || 0)}</span>
            </div>

            {/* Closing Balance */}
            <div className="flex justify-between py-4 font-bold text-xl border-y-4 border-double border-gray-900 bg-gray-50 px-4 mt-4">
              <span>Ending Cash Balance</span>
              <span className="text-indigo-700">
                {formatCurrency(data?.closingBalance || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashFlow;
