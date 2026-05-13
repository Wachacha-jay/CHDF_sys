import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'pink' | 'orange' | 'emerald';
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon: Icon, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  const iconBgClasses = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    pink: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };

  return (
    <div
      className={`card p-6 group hover:border-gray-300 dark:hover:border-slate-700 transition-all${onClick ? ' cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white truncate">{value}</p>
          {change && (
            <div className="flex items-center mt-3">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                  change.trend === 'up'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600'
                }`}
              >
                {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Trend</span>
            </div>
          )}
        </div>
        <div className={`p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 ${iconBgClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;