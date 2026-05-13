import React from 'react';
import { DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface ExpenseStatsProps {
  totalExpenses: number;
  pendingExpenses: number;
  approvedExpenses: number;
  totalCount: number;
}

const ExpenseStats: React.FC<ExpenseStatsProps> = ({
  totalExpenses,
  pendingExpenses,
  approvedExpenses,
  totalCount
}) => {
  const { settings } = useSettingsContext();
  const stats = [
    {
      title: 'Total Expenses',
      value: `${settings?.default_currency || 'KSh'} ${totalExpenses.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Count',
      value: totalCount.toString(),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Pending',
      value: pendingExpenses.toString(),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Approved',
      value: approvedExpenses.toString(),
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExpenseStats; 