import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, Download, TrendingUp, DollarSign, ShoppingCart, 
    CreditCard, Search, RefreshCw, Package, Gift, CheckCircle, 
    Clock, AlertCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ReportsService, DailySalesData, PaymentMethodBreakdown } from '../services/reportsService';
import { SalesService } from '../services/salesService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import { Sale, BusinessSettings } from '../types';

type QuickFilter = 'today' | 'week' | 'month' | 'year' | 'custom';
type TabType = 'commercial' | 'distribution' | 'all';

const SalesReports: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('commercial');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentMethodBreakdown[]>([]);
    const [totalSales, setTotalSales] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [averageOrderValue, setAverageOrderValue] = useState(0);
    const [distributionCount, setDistributionCount] = useState(0);
    const [distributionValuation, setDistributionValuation] = useState(0);

    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

    const currency = useMemo(() => {
        const c = businessSettings?.default_currency;
        return (!c || c === 'USD') ? 'KES' : c;
    }, [businessSettings]);

    const fmtCurrency = (n: number | string) => {
        return `${currency} ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            const [reportData, sales] = await Promise.all([
                ReportsService.getSalesReportData(startDate, endDate),
                SalesService.getSales({
                    start_date: startDate,
                    end_date: endDate
                })
            ]);

            if (reportData) {
                setDailySales(reportData.dailySales || []);
                setPaymentBreakdown(reportData.paymentBreakdown || []);
                setTotalSales(reportData.totalSales || 0);
                setTotalRevenue(reportData.totalRevenue || 0);
                setAverageOrderValue(reportData.averageOrderValue || 0);
                setDistributionCount(reportData.distributionSalesCount || 0);
                setDistributionValuation(reportData.distributionTotalValuation || 0);
            }

            setAllSales(Array.isArray(sales) ? sales : []);
        } catch (error) {
            console.error('Error loading report data:', error);
            toast.error('Failed to load sales report');
        } finally {
            setLoading(false);
        }
    };

    // Filter sales according to active tab and search input
    const displayedSales = useMemo(() => {
        let list = allSales;

        if (activeTab === 'commercial') {
            list = list.filter(s => s.sale_type !== 'donation_distribution' && s.payment_method !== 'in_kind_distribution');
        } else if (activeTab === 'distribution') {
            list = list.filter(s => s.sale_type === 'donation_distribution' || s.payment_method === 'in_kind_distribution');
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(s => 
                (s.sale_number && s.sale_number.toLowerCase().includes(term)) ||
                (s.customer?.name && s.customer.name.toLowerCase().includes(term)) ||
                (s.payment_method && s.payment_method.toLowerCase().includes(term)) ||
                (s.notes && s.notes.toLowerCase().includes(term))
            );
        }

        return list;
    }, [allSales, activeTab, searchTerm]);

    const handleExport = () => {
        if (displayedSales.length === 0) {
            toast.error('No sales data to export in the selected view');
            return;
        }

        const tabSuffix = activeTab === 'commercial' ? 'commercial' : (activeTab === 'distribution' ? 'distribution' : 'all');
        const filename = `sales_report_${tabSuffix}_${startDate}_to_${endDate}.csv`;
        ReportsService.exportSalesToCSV(displayedSales, filename);
        toast.success(`Exported ${displayedSales.length} records successfully`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Reports &amp; Analytics</h1>
                    <p className="text-gray-500 text-sm mt-1">Track POS commercial sales, in-kind distributions, and download financial reports</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadReportData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={displayedSales.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV ({displayedSales.length})
                    </button>
                </div>
            </div>

            {/* View Mode Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('commercial')}
                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'commercial'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <ShoppingCart className="h-4 w-4" />
                    Commercial Sales (POS &amp; Invoices)
                    <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                        {totalSales}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('distribution')}
                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'distribution'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Gift className="h-4 w-4" />
                    In-Kind Distributions
                    <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800">
                        {distributionCount}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'all'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Package className="h-4 w-4" />
                    All Activity
                    <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {allSales.length}
                    </span>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Quick Filters */}
                    <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Period</span>
                        <div className="flex flex-wrap gap-2">
                            {(['today', 'week', 'month', 'year', 'custom'] as QuickFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => applyQuickFilter(filter)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                        quickFilter === filter
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range Inputs */}
                    {quickFilter === 'custom' && (
                        <div className="flex items-center gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Search in Transactions */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by sale number, customer name, notes, or payment method..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Key Performance Indicators */}
            {activeTab === 'commercial' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Orders</p>
                            <p className="text-3xl font-black text-gray-900 mt-1">{totalSales}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Commercial sales in period</p>
                        </div>
                        <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <ShoppingCart className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commercial Revenue</p>
                            <p className="text-3xl font-black text-emerald-600 mt-1">{fmtCurrency(totalRevenue)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Gross sales before expenses</p>
                        </div>
                        <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Order Value</p>
                            <p className="text-3xl font-black text-purple-600 mt-1">{fmtCurrency(averageOrderValue)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Revenue per commercial ticket</p>
                        </div>
                        <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            ) : activeTab === 'distribution' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Distributions</p>
                            <p className="text-3xl font-black text-emerald-700 mt-1">{distributionCount}</p>
                            <p className="text-xs text-gray-400 mt-0.5">In-kind donation vouchers issued</p>
                        </div>
                        <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Gift className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Goods Valued</p>
                            <p className="text-3xl font-black text-teal-600 mt-1">{fmtCurrency(distributionValuation)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Fair market valuation of aid delivered</p>
                        </div>
                        <div className="h-12 w-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Transactions</p>
                            <p className="text-3xl font-black text-gray-900 mt-1">{allSales.length}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Commercial + in-kind distributions</p>
                        </div>
                        <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Package className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commercial Revenue</p>
                            <p className="text-3xl font-black text-emerald-600 mt-1">{fmtCurrency(totalRevenue)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{totalSales} paid &amp; credit sales</p>
                        </div>
                        <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">In-Kind Valuation</p>
                            <p className="text-3xl font-black text-teal-600 mt-1">{fmtCurrency(distributionValuation)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{distributionCount} distributions</p>
                        </div>
                        <div className="h-12 w-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                            <Gift className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Sales Transactions Table (Essential for verifying POS commercial sales) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">
                            {activeTab === 'commercial' ? 'Commercial Sales Transactions' : 
                             activeTab === 'distribution' ? 'In-Kind Distribution Transactions' : 
                             'All Sales & Distributions'}
                        </h2>
                        <p className="text-xs text-gray-500">
                            Showing {displayedSales.length} transaction(s) recorded in the selected period
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : displayedSales.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <h3 className="text-base font-semibold text-gray-700">No transactions found</h3>
                        <p className="text-sm text-gray-400 mt-1">Transactions recorded in POS or Invoicing will show here immediately.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Sale / Dist #</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Customer / Beneficiary</th>
                                    <th className="py-3 px-4">Method</th>
                                    <th className="py-3 px-4 text-center">Items</th>
                                    <th className="py-3 px-4 text-right">Subtotal</th>
                                    <th className="py-3 px-4 text-right">Tax</th>
                                    <th className="py-3 px-4 text-right">Total</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {displayedSales.map((sale) => {
                                    const isDist = sale.sale_type === 'donation_distribution' || sale.payment_method === 'in_kind_distribution';
                                    const customerName = sale.customer?.name || (isDist ? 'Internal Beneficiary' : 'Walk-in Customer');
                                    const itemsCount = sale.items_count !== undefined ? sale.items_count : (sale.items?.length || '—');

                                    return (
                                        <tr key={sale.id} className="hover:bg-gray-50/70 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-gray-900 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    {isDist ? (
                                                        <Gift className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <ShoppingCart className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                    )}
                                                    <span>{sale.sale_number}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                                                {sale.sale_date}
                                            </td>
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-gray-900 text-sm">{customerName}</p>
                                                {sale.notes && (
                                                    <p className="text-xs text-gray-400 truncate max-w-xs">{sale.notes}</p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                                                <span className="capitalize">
                                                    {isDist ? 'Distribution' : (sale.payment_method || 'Cash').replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center text-xs font-semibold text-gray-700">
                                                {itemsCount}
                                            </td>
                                            <td className="py-3 px-4 text-right text-xs text-gray-700 font-mono">
                                                {fmtCurrency(sale.subtotal)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-xs text-gray-500 font-mono">
                                                {fmtCurrency(sale.tax_amount)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-sm text-gray-900 font-mono">
                                                {fmtCurrency(sale.total_amount)}
                                            </td>
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    sale.payment_status === 'paid'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : sale.payment_status === 'pending'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {sale.payment_status === 'paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                                                    {sale.payment_status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                                    {(sale.payment_status || 'paid').toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Daily Breakdown & Payment Methods (Visible on Commercial or All tabs) */}
            {activeTab !== 'distribution' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Daily Sales Table */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            Daily Commercial Sales
                        </h2>
                        {dailySales.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                                            <th className="py-2.5 px-3">Date</th>
                                            <th className="py-2.5 px-3 text-right">Orders</th>
                                            <th className="py-2.5 px-3 text-right">Revenue</th>
                                            <th className="py-2.5 px-3 text-right">Avg / Order</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {dailySales.map((day, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="py-2.5 px-3 text-xs font-medium text-gray-900">
                                                    {day.date}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-900 text-right font-semibold">
                                                    {day.salesCount}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-emerald-700 font-bold text-right font-mono">
                                                    {fmtCurrency(day.totalRevenue)}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-600 text-right font-mono">
                                                    {fmtCurrency(day.averageOrderValue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-6 text-center">No daily sales for this period</p>
                        )}
                    </div>

                    {/* Payment Method Breakdown */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-indigo-600" />
                            Payment Method Breakdown
                        </h2>
                        {paymentBreakdown.length > 0 ? (
                            <div className="space-y-4">
                                {paymentBreakdown.map((method, index) => (
                                    <div key={index} className="border-b border-gray-100 pb-3.5 last:border-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-gray-400" />
                                                <span className="text-sm font-semibold text-gray-900">{method.method}</span>
                                            </div>
                                            <span className="text-xs font-bold text-gray-600">{method.count} orders</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-500 font-mono">{fmtCurrency(method.total)}</span>
                                            <span className="font-bold text-blue-600">{Number(method.percentage || 0).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, Math.max(0, method.percentage))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-6 text-center">No payment data for this period</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesReports;
