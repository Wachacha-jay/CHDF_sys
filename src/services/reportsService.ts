import { ApiService } from './api';
import { Sale } from '../types';

export interface DailySalesData {
    date: string;
    salesCount: number;
    totalRevenue: number;
    averageOrderValue: number;
}

export interface PaymentMethodBreakdown {
    method: string;
    count: number;
    total: number;
    percentage: number;
}

export interface SalesReportData {
    dailySales: DailySalesData[];
    paymentBreakdown: PaymentMethodBreakdown[];
    totalSales: number;
    totalRevenue: number;
    averageOrderValue: number;
}

export class ReportsService {
    /**
     * Get daily sales report for a date range
     */
    static async getDailySalesReport(startDate: string, endDate: string): Promise<DailySalesData[]> {
        try {
            const response = await ApiService.get<Sale>('sales', {
                filters: {},
                orderBy: { column: 'sale_date', ascending: false }
            });

            if (!response.success || !response.data) {
                return [];
            }

            // Filter by date range
            const sales = response.data.filter(sale => {
                const saleDate = sale.sale_date;
                return saleDate >= startDate && saleDate <= endDate;
            });

            // Group by date
            const dailyMap = new Map<string, Sale[]>();
            sales.forEach(sale => {
                const date = sale.sale_date;
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, []);
                }
                dailyMap.get(date)!.push(sale);
            });

            // Calculate daily stats
            const dailySales: DailySalesData[] = [];
            dailyMap.forEach((daySales, date) => {
                const totalRevenue = daySales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
                const salesCount = daySales.length;
                const averageOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0;

                dailySales.push({
                    date,
                    salesCount,
                    totalRevenue,
                    averageOrderValue
                });
            });

            // Sort by date descending
            return dailySales.sort((a, b) => b.date.localeCompare(a.date));
        } catch (error) {
            console.error('Error fetching daily sales report:', error);
            return [];
        }
    }

    /**
     * Get sales breakdown by payment method
     */
    static async getSalesByPaymentMethod(startDate: string, endDate: string): Promise<PaymentMethodBreakdown[]> {
        try {
            const response = await ApiService.get<Sale>('sales', {
                filters: {},
                orderBy: { column: 'sale_date', ascending: false }
            });

            if (!response.success || !response.data) {
                return [];
            }

            // Filter by date range
            const sales = response.data.filter(sale => {
                const saleDate = sale.sale_date;
                return saleDate >= startDate && saleDate <= endDate;
            });

            // Group by payment method
            const methodMap = new Map<string, Sale[]>();
            sales.forEach(sale => {
                const method = sale.payment_method || 'cash';
                if (!methodMap.has(method)) {
                    methodMap.set(method, []);
                }
                methodMap.get(method)!.push(sale);
            });

            const totalRevenue = sales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);

            // Calculate breakdown
            const breakdown: PaymentMethodBreakdown[] = [];
            methodMap.forEach((methodSales, method) => {
                const total = methodSales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
                const count = methodSales.length;
                const percentage = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;

                breakdown.push({
                    method: method.toUpperCase(),
                    count,
                    total,
                    percentage
                });
            });

            // Sort by total descending
            return breakdown.sort((a, b) => b.total - a.total);
        } catch (error) {
            console.error('Error fetching payment method breakdown:', error);
            return [];
        }
    }

    /**
     * Get comprehensive sales report data
     */
    static async getSalesReportData(startDate: string, endDate: string): Promise<SalesReportData> {
        try {
            const [dailySales, paymentBreakdown] = await Promise.all([
                this.getDailySalesReport(startDate, endDate),
                this.getSalesByPaymentMethod(startDate, endDate)
            ]);

            const totalSales = dailySales.reduce((sum, day) => sum + day.salesCount, 0);
            const totalRevenue = dailySales.reduce((sum, day) => sum + day.totalRevenue, 0);
            const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

            return {
                dailySales,
                paymentBreakdown,
                totalSales,
                totalRevenue,
                averageOrderValue
            };
        } catch (error) {
            console.error('Error fetching sales report data:', error);
            return {
                dailySales: [],
                paymentBreakdown: [],
                totalSales: 0,
                totalRevenue: 0,
                averageOrderValue: 0
            };
        }
    }

    /**
     * Export sales data to CSV
     */
    static exportSalesToCSV(sales: Sale[], filename: string = 'sales_report.csv'): void {
        if (sales.length === 0) {
            return;
        }

        // CSV headers
        const headers = [
            'Sale Number',
            'Date',
            'Customer',
            'Payment Method',
            'Subtotal',
            'Tax',
            'Discount',
            'Total',
            'Paid Amount',
            'Payment Status'
        ];

        // Convert sales to CSV rows
        const rows = sales.map(sale => [
            sale.sale_number,
            sale.sale_date,
            sale.customer?.name || 'Walk-in Customer',
            sale.payment_method || 'cash',
            sale.subtotal.toFixed(2),
            sale.tax_amount.toFixed(2),
            sale.discount_amount.toFixed(2),
            sale.total_amount.toFixed(2),
            sale.paid_amount.toFixed(2),
            sale.payment_status
        ]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Get quick date range presets
     */
    static getDateRangePresets(): Record<string, { startDate: string; endDate: string }> {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        const monthAgoStr = monthAgo.toISOString().split('T')[0];

        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearStartStr = yearStart.toISOString().split('T')[0];

        return {
            today: { startDate: todayStr, endDate: todayStr },
            week: { startDate: weekAgoStr, endDate: todayStr },
            month: { startDate: monthAgoStr, endDate: todayStr },
            year: { startDate: yearStartStr, endDate: todayStr }
        };
    }
}
