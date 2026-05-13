import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  DollarSign, 
  Calculator,
  PieChart,
  List,
  FolderTree,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { DashboardService } from '../../services/dashboardService';
import type { DashboardStats } from '../../types';


const AccountingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings: businessSettings } = useSettingsContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccountingStats();
  }, []);

  const loadAccountingStats = async () => {
    try {
      setLoading(true);
      const dashboardStats = await DashboardService.getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading accounting stats:', error);
      toast.error('Failed to load accounting statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = businessSettings?.default_currency || 'KES';
    const isoCurrency = (currency === 'KSh' || currency === 'KSH') ? 'KES' : currency;
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: isoCurrency.length === 3 ? isoCurrency : 'KES'
      }).format(amount);
    } catch (e) {
      return `${currency} ${Number(amount).toLocaleString()}`;
    }
  };

  const accountingModules = [
    {
      title: 'General Ledger',
      description: 'View and manage all journal entries and account transactions',
      icon: BookOpen,
      color: 'blue',
      path: '/accounting/general-ledger'
    },
    {
      title: 'Trial Balance',
      description: 'Verify account balances and ensure accounting equation',
      icon: Calculator,
      color: 'green',
      path: '/accounting/trial-balance'
    },
    {
      title: 'Account Categories',
      description: 'Define and manage accounting groupings (Payroll, Operating, etc.)',
      icon: FolderTree,
      color: 'indigo',
      path: '/accounting/categories'
    },
    {
      title: 'Chart of Accounts',
      description: 'Manage your business accounts and their categories',
      icon: List,
      color: 'green',
      path: '/accounting/chart-of-accounts'
    },
    {
      title: 'Balance Sheet',
      description: 'View assets, liabilities, and equity position',
      icon: BarChart3,
      color: 'purple',
      path: '/accounting/balance-sheet'
    },
    {
      title: 'Income Statement',
      description: 'View revenue, expenses, and profit/loss',
      icon: TrendingUp,
      color: 'orange',
      path: '/accounting/income-statement'
    },
    {
      title: 'Cash Flow',
      description: 'Track cash inflows and outflows',
      icon: DollarSign,
      color: 'emerald',
      path: '/accounting/cash-flow'
    },
    {
      title: 'Sales Reports',
      description: 'Analyze your sales performance and trends',
      icon: TrendingUp,
      color: 'indigo',
      path: '/reports/sales'
    },
    {
      title: 'Bank Reconciliation',
      description: 'Match bank statements with your internal records',
      icon: CheckCircle2,
      color: 'emerald',
      path: '/accounting/bank-reconciliation'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-50 text-blue-600 hover:bg-blue-100';
      case 'green': return 'bg-green-50 text-green-600 hover:bg-green-100';
      case 'purple': return 'bg-purple-50 text-purple-600 hover:bg-purple-100';
      case 'orange': return 'bg-orange-50 text-orange-600 hover:bg-orange-100';
      case 'emerald': return 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100';
      case 'indigo': return 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100';
      default: return 'bg-gray-50 text-gray-600 hover:bg-gray-100';
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounting Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of financial data and accounting tools</p>
      </div>

      {/* Financial Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Assets</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(stats.totalAssets)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Receipt className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Liabilities</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(stats.totalLiabilities)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <PieChart className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Equity</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(stats.totalEquity)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/accounting/general-ledger')}
            className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
          >
            <BookOpen className="h-6 w-6 text-blue-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-blue-900">New Journal Entry</p>
              <p className="text-sm text-blue-700">Record transactions</p>
            </div>
            <span className="text-blue-600 group-hover:translate-x-1 transition-transform ml-auto">→</span>
          </button>
          
          <button
            onClick={() => navigate('/accounting/trial-balance')}
            className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
          >
            <Calculator className="h-6 w-6 text-green-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-green-900">View Trial Balance</p>
              <p className="text-sm text-green-700">Check account balances</p>
            </div>
            <span className="text-green-600 group-hover:translate-x-1 transition-transform ml-auto">→</span>
          </button>
          
          <button
            onClick={() => navigate('/accounting/balance-sheet')}
            className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
          >
            <BarChart3 className="h-6 w-6 text-purple-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-purple-900">Balance Sheet</p>
              <p className="text-sm text-purple-700">View financial position</p>
            </div>
            <span className="text-purple-600 group-hover:translate-x-1 transition-transform ml-auto">→</span>
          </button>

          <button
            onClick={() => navigate('/accounting/bank-reconciliation')}
            className="flex items-center p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors group"
          >
            <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-emerald-900">Bank Reconciliation</p>
              <p className="text-sm text-emerald-700">Reconcile accounts</p>
            </div>
            <span className="text-emerald-600 group-hover:translate-x-1 transition-transform ml-auto">→</span>
          </button>
        </div>
      </div>

      {/* Accounting Modules */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accounting Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountingModules.map((module) => (
            <button
              key={module.title}
              onClick={() => navigate(module.path)}
              className={`flex items-center p-4 rounded-lg transition-colors group ${getColorClasses(module.color)}`}
            >
              <module.icon className="h-6 w-6 mr-3" />
              <div className="text-left flex-1">
                <p className="font-medium">{module.title}</p>
                <p className="text-sm opacity-80">{module.description}</p>
              </div>
              <span className="opacity-60 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Accounting Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No recent accounting activity</p>
          <p className="text-sm">Start by creating journal entries</p>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard; 