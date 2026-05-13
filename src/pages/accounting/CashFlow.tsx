import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Printer, 
  Download,
  Calendar,
  Filter,
  PlusCircle,
  MinusCircle
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadCashFlow();
  }, [dateRange]);

  const loadCashFlow = async () => {
    try {
      setLoading(true);
      
      const accounts = await AccountingService.getAccounts();
      const entries = await AccountingService.getJournalEntries({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        is_posted: true
      });

      // Calculate Opening Balance (Cash accounts only)
      const cashAccounts = flattenAccounts(accounts).filter(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'));
      const cashAccountIds = cashAccounts.map(a => a.id);
      
      let openingBalance = 0;
      for (const id of cashAccountIds) {
        openingBalance += await AccountingService.getAccountBalanceAsOf(id, dateRange.startDate);
      }

      // Simple classification logic
      const operating: { name: string; amount: number }[] = [];
      const investing: { name: string; amount: number }[] = [];
      const financing: { name: string; amount: number }[] = [];

      entries.forEach(entry => {
        const cashMovementLine = entry.lines?.find(l => cashAccountIds.includes(l.account_id));
        if (cashMovementLine) {
          const amount = (cashMovementLine.debit_amount || 0) - (cashMovementLine.credit_amount || 0);
          
          // Simplified: assume based on entry description or other account type
          const otherLines = entry.lines?.filter(l => !cashAccountIds.includes(l.account_id)) || [];
          const primaryAccount = otherLines[0]?.account;

          if (primaryAccount) {
            if (primaryAccount.account_type === 'revenue' || primaryAccount.account_type === 'expense') {
              operating.push({ name: entry.description, amount });
            } else if (primaryAccount.account_type === 'asset' && primaryAccount.account_subtype === 'fixed') {
              investing.push({ name: entry.description, amount });
            } else if (primaryAccount.account_type === 'liability' || primaryAccount.account_type === 'equity') {
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
    return `KSh ${new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
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
          <p className="text-sm text-gray-500">Track the movement of cash into and out of your business</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button 
            onClick={loadCashFlow}
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
          >
            <Filter className="w-3 h-3" /> Apply
          </button>
        </div>

        <div className="p-8 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 uppercase">{settings?.business_name || 'BIZMANAGER'}</h2>
            <p className="text-gray-600">STATEMENT OF CASH FLOWS</p>
            <p className="text-sm text-gray-500">For the period {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()}</p>
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
