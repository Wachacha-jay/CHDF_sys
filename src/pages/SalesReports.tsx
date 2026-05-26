import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, ShoppingCart, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ReportsService, DailySalesData, PaymentMethodBreakdown } from '../services/reportsService';
import { SalesService } from '../services/salesService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import { Sale, BusinessSettings } from '../types';

type QuickFilter = 'today' | 'week' | 'month' | 'year' | 'custom';

const SalesReports: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentMethodBreakdown[]>([]);
    const [totalSales, setTotalSales] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [averageOrderValue, setAverageOrderValue] = useState(0);
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

    const getCurrency = () => {
        const c = businessSettings?.default_currency;
        return (!c || c === 'USD') ? 'KES' : c;
    };

    useEffect(() => {
        // Set initial date range based on quick filter
        applyQuickFilter('month');
        // Load business settings
        BusinessSettingsService.getSettings().then(setBusinessSettings);
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            loadReportData();
        }
    }, [startDate, endDate]);

    const applyQuickFilter = (filter: QuickFilter) => {
        setQuickFilter(filter);
        const presets = ReportsService.getDateRangePresets();

        if (filter !== 'custom') {
            const range = presets[filter];
            setStartDate(range.startDate);
            setEndDate(range.endDate);
        }
    };

    const loadReportData = async () => {
        try {
            setLoading(true);
            const reportData = await ReportsService.getSalesReportData(startDate, endDate);

            if (reportData) {
                setDailySales(reportData.dailySales || []);
                setPaymentBreakdown(reportData.paymentBreakdown || []);
                setTotalSales(reportData.totalSales || 0);
                setTotalRevenue(reportData.totalRevenue || 0);
                setAverageOrderValue(reportData.averageOrderValue || 0);
            }

            // Load all sales for export
            const sales = await SalesService.getSales({
                start_date: startDate,
                end_date: endDate
            });
            setAllSales(Array.isArray(sales) ? sales : []);
        } catch (error) {
            console.error('Error loading report data:', error);
            toast.error('Failed to load sales report');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (allSales.length === 0) {
            toast.error('No sales data to export');
            return;
        }

        const filename = `sales_report_${startDate}_to_${endDate}.csv`;
        ReportsService.exportSalesToCSV(allSales, filename);
        toast.success('Sales report exported successfully');
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Reports</h1>
                <p className="text-gray-600">Analyze your sales performance and trends</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    {/* Quick Filters */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quick Filters</label>
                        <div className="flex flex-wrap gap-2">
                            {(['today', 'week', 'month', 'year', 'custom'] as QuickFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => applyQuickFilter(filter)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${quickFilter === filter
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range */}
                    {quickFilter === 'custom' && (
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={allSales.length === 0}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Sales</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{totalSales}</p>
                        </div>
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <ShoppingCart className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{getCurrency()} {Number(totalRevenue || 0).toFixed(2)}</p>
                        </div>
                        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{getCurrency()} {Number(averageOrderValue || 0).toFixed(2)}</p>
                        </div>
                        <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Sales Table */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Daily Sales</h2>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                    ) : dailySales.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Sales</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Avg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailySales.map((day, index) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-900">
                                                {new Date(day.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">{day.salesCount}</td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                                                {getCurrency()} {Number(day.totalRevenue || 0).toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 text-right">
                                                {getCurrency()} {Number(day.averageOrderValue || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>No sales data for selected period</p>
                        </div>
                    )}
                </div>

                {/* Payment Method Breakdown */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h2>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                    ) : paymentBreakdown.length > 0 ? (
                        <div className="space-y-4">
                            {paymentBreakdown.map((method, index) => (
                                <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center">
                                            <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                                            <span className="font-medium text-gray-900">{method.method}</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-600">{method.count} sales</span>
                                    </div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-600">{getCurrency()} {Number(method.total || 0).toFixed(2)}</span>
                                        <span className="text-sm font-medium text-blue-600">{Number(method.percentage || 0).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${method.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <CreditCard className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>No payment data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesReports;
