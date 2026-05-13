import React from 'react';
import { DollarSign, Users, Calendar, TrendingUp, FileText, Settings } from 'lucide-react';
import type { PayrollPeriod, PayrollRun } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface PayrollDashboardProps {
  currentPeriod: PayrollPeriod | null;
  payrollRuns: PayrollRun[];
  onGeneratePayroll: () => void;
  onOpenSettings: () => void;
  onViewReports: () => void;
}

const PayrollDashboard: React.FC<PayrollDashboardProps> = ({
  currentPeriod,
  payrollRuns,
  onGeneratePayroll,
  onOpenSettings,
  onViewReports
}) => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'KES';

  const totalEmployees = payrollRuns.length;
  const totalGrossPay = payrollRuns.reduce((sum, run) => sum + Number(run.gross_pay || 0), 0);
  const totalNetPay = payrollRuns.reduce((sum, run) => sum + Number(run.net_pay || 0), 0);
  const totalTax = payrollRuns.reduce((sum, run) => sum + Number(run.tax_deduction || 0), 0);
  const pendingRuns = payrollRuns.filter(run => run.status === 'draft').length;
  const approvedRuns = payrollRuns.filter(run => run.status === 'approved').length;
  const paidRuns = payrollRuns.filter(run => run.status === 'paid').length;

  const fmt = (val: number) => val.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const stats = [
    {
      title: 'Total Employees',
      value: totalEmployees,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Gross Pay',
      value: `${currency} ${fmt(totalGrossPay)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Net Pay',
      value: `${currency} ${fmt(totalNetPay)}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Tax',
      value: `${currency} ${fmt(totalTax)}`,
      icon: FileText,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  const statusStats = [
    { label: 'Draft', count: pendingRuns, color: 'bg-gray-400', iconColor: 'text-gray-600' },
    { label: 'Approved', count: approvedRuns, color: 'bg-amber-400', iconColor: 'text-amber-600' },
    { label: 'Paid', count: paidRuns, color: 'bg-green-400', iconColor: 'text-green-600' }
  ];

  return (
    <div className="space-y-6">
      {/* Current Period Info */}
      {currentPeriod && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Active Payroll Period</h3>
                <p className="text-blue-100 font-medium">
                  {currentPeriod.period_name} · {new Date(currentPeriod.start_date).toLocaleDateString()} - {new Date(currentPeriod.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/30">
                {currentPeriod.status}
              </span>
              <p className="text-xs text-blue-200 mt-2 font-medium">Pay Date: {new Date(currentPeriod.pay_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={onGeneratePayroll}
          disabled={!currentPeriod}
          className="group flex flex-col items-start p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all disabled:opacity-50"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-gray-900 group-hover:text-blue-600">Generate Payroll</h3>
          <p className="text-sm text-gray-500 mt-1">Initialize runs for active employees</p>
        </button>

        <button
          onClick={onOpenSettings}
          className="group flex flex-col items-start p-5 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">
            <Settings className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-gray-900 group-hover:text-indigo-600">Payroll Settings</h3>
          <p className="text-sm text-gray-500 mt-1">Deduction rates & tax configs</p>
        </button>

        <button
          onClick={onViewReports}
          className="group flex flex-col items-start p-5 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-4">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-gray-900 group-hover:text-emerald-600">Payroll Reports</h3>
          <p className="text-sm text-gray-500 mt-1">Detailed period cost breakdown</p>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.title}</p>
              <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Run Status Pills */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-wrap items-center justify-around gap-8">
        {statusStats.map((status, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className={`relative w-14 h-14 rounded-full ${status.color}/10 flex items-center justify-center`}>
              <div className={`absolute inset-0 rounded-full border-4 border-t-transparent ${status.color}/20 animate-[spin_3s_linear_infinite]`}></div>
              <span className={`text-xl font-black ${status.iconColor}`}>{status.count}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{status.label}</p>
              <p className="text-xs text-gray-500">Employee Runs</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PayrollDashboard;