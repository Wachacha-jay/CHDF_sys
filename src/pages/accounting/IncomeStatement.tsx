import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  Printer, 
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadIncomeStatement();
  }, [dateRange]);

  const loadIncomeStatement = async () => {
    try {
      setLoading(true);
      // Logic to fetch and aggregate accounts for income statement
      const accounts = await AccountingService.getAccounts();
      const entries = await AccountingService.getJournalEntries({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        is_posted: true
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
          <h1 className="text-2xl font-bold text-gray-900">Income Statement</h1>
          <p className="text-sm text-gray-500">Profit and Loss report for the selected period</p>
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
            onClick={loadIncomeStatement}
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
          >
            <Filter className="w-3 h-3" /> Apply
          </button>
        </div>

        <div className="p-8 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 uppercase">{settings?.business_name || 'BIZMANAGER'}</h2>
            <p className="text-gray-600">INCOME STATEMENT</p>
            <p className="text-sm text-gray-500">For the period {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()}</p>
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
