import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartData } from '../../services/dashboardService';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface SalesChartProps {
  data?: ChartData | null;
}

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'KES';
  const displayCurrency = (currency === 'KES' || currency === 'KSh') ? 'KSh' : currency;

  // Transform chart data for recharts
  const chartData = data?.labels.map((label, index) => ({
    name: label,
    sales: data.datasets[0]?.data[index] || 0
  })) || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Sales Trend</h3>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number) => [`${displayCurrency} ${value.toLocaleString()}`, 'Sales']}
              />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#2563eb" 
                strokeWidth={3}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No sales data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesChart;