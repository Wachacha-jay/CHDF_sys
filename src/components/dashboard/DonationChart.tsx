import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartData } from '../../services/dashboardService';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface DonationChartProps {
  data?: ChartData | null;
  title?: string;
}

const DonationChart: React.FC<DonationChartProps> = ({ data, title = "Donation Trends" }) => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'KES';
  const displayCurrency = (currency === 'KES' || currency === 'KSh') ? 'KSh' : currency;
  const currencySymbol = (currency === 'KES' || currency === 'KSh') ? 'KSh' : (currency === 'USD' ? '$' : currency);

  // Transform chart data for recharts
  const chartData = data?.labels.map((label, index) => ({
    name: label,
    amount: data.datasets[0]?.data[index] || 0
  })) || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-6">{title}</h3>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${currencySymbol}${value.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number) => [`${displayCurrency} ${value.toLocaleString()}`, 'Donations']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Gathering donation data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationChart;
