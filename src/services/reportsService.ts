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
    distributionSalesCount: number;
    distributionTotalValuation: number;
}

export class ReportsService {
    /**
     * Get daily sales report for a date range (Commercial sales only)
     */
    static async getDailySalesReport(startDate: string, endDate: string): Promise<DailySalesData[]> {
        try {
            const response = await ApiService.get<Sale>('sales', {
                filters: {
                    sale_date_gte: startDate,
                    sale_date_lte: endDate
                },
                orderBy: { column: 'sale_date', ascending: false }
            });

            if (!response.success || !response.data) {
                return [];
            }

            // Exclude in-kind distributions to ensure pure commercial sales
            const sales = response.data.filter(sale => {
                const saleDate = sale.sale_date;
                const inRange = (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
                const isCommercial = sale.sale_type !== 'donation_distribution' && sale.payment_method !== 'in_kind_distribution';
                return inRange && isCommercial;
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
     * Get sales breakdown by payment method (Commercial sales only)
     */
    static async getSalesByPaymentMethod(startDate: string, endDate: string): Promise<PaymentMethodBreakdown[]> {
        try {
            const response = await ApiService.get<Sale>('sales', {
                filters: {
                    sale_date_gte: startDate,
                    sale_date_lte: endDate
                },
                orderBy: { column: 'sale_date', ascending: false }
            });

            if (!response.success || !response.data) {
                return [];
            }

            // Filter commercial sales within date range
            const sales = response.data.filter(sale => {
                const saleDate = sale.sale_date;
                const inRange = (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
                const isCommercial = sale.sale_type !== 'donation_distribution' && sale.payment_method !== 'in_kind_distribution';
                return inRange && isCommercial;
            });

            // Group by payment method
            const methodMap = new Map<string, Sale[]>();
            sales.forEach(sale => {
                let method = (sale.payment_method || 'cash').toLowerCase();
                if (!methodMap.has(method)) {
                    methodMap.set(method, []);
                }
                methodMap.get(method)!.push(sale);
            });

            const totalRevenue = sales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);

            // Format human-readable method name
            const formatMethodName = (raw: string) => {
                switch (raw) {
                    case 'cash': return 'Cash';
                    case 'mobile_money': return 'M-Pesa / Mobile Money';
                    case 'card': return 'Credit / Debit Card';
                    case 'credit': return 'Credit / Invoice';
                    case 'bank_transfer': return 'Bank Transfer';
                    default: return raw.replace(/_/g, ' ').toUpperCase();
                }
            };

            // Calculate breakdown
            const breakdown: PaymentMethodBreakdown[] = [];
            methodMap.forEach((methodSales, method) => {
                const total = methodSales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
                const count = methodSales.length;
                const percentage = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;

                breakdown.push({
                    method: formatMethodName(method),
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
            const [dailySales, paymentBreakdown, allSalesResp] = await Promise.all([
                this.getDailySalesReport(startDate, endDate),
                this.getSalesByPaymentMethod(startDate, endDate),
                ApiService.get<Sale>('sales', {
                    filters: {
                        sale_date_gte: startDate,
                        sale_date_lte: endDate
                    }
                })
            ]);

            const totalSales = dailySales.reduce((sum, day) => sum + day.salesCount, 0);
            const totalRevenue = dailySales.reduce((sum, day) => sum + day.totalRevenue, 0);
            const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

            // Calculate distribution summary
            let distributionSalesCount = 0;
            let distributionTotalValuation = 0;

            if (allSalesResp.success && allSalesResp.data) {
                allSalesResp.data.forEach(sale => {
                    const isDist = sale.sale_type === 'donation_distribution' || sale.payment_method === 'in_kind_distribution';
                    if (isDist) {
                        distributionSalesCount += 1;
                        distributionTotalValuation += Number(sale.total_amount || 0);
                    }
                });
            }

            return {
                dailySales,
                paymentBreakdown,
                totalSales,
                totalRevenue,
                averageOrderValue,
                distributionSalesCount,
                distributionTotalValuation
            };
        } catch (error) {
            console.error('Error fetching sales report data:', error);
            return {
                dailySales: [],
                paymentBreakdown: [],
                totalSales: 0,
                totalRevenue: 0,
                averageOrderValue: 0,
                distributionSalesCount: 0,
                distributionTotalValuation: 0
            };
        }
    }

    /**
     * Export sales data to CSV with safe typecasting and summary line
     */
    static exportSalesToCSV(sales: Sale[], filename: string = 'sales_report.csv'): void {
        if (!sales || sales.length === 0) {
            return;
        }

        // CSV headers
        const headers = [
            'Sale Number',
            'Date',
            'Sale Type',
            'Customer / Beneficiary',
            'Payment Method',
            'Items Count',
            'Subtotal (KES)',
            'Tax (KES)',
            'Discount (KES)',
            'Total (KES)',
            'Paid (KES)',
            'Payment Status'
        ];

        let totalSubtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        let totalSum = 0;
        let totalPaid = 0;

        // Convert sales to CSV rows safely (MySQL2 DECIMAL returns strings)
        const rows = sales.map(sale => {
            const isDist = sale.sale_type === 'donation_distribution' || sale.payment_method === 'in_kind_distribution';
            const saleTypeLabel = isDist 
                ? 'In-Kind Distribution' 
                : (sale.sale_type ? sale.sale_type.replace(/_/g, ' ').toUpperCase() : 'COMMERCIAL SALE');
            
            const customerLabel = sale.customer?.name || (isDist ? 'Internal Beneficiary / Department' : 'Walk-in Customer');
            
            const subtotal = Number(sale.subtotal || 0);
            const tax = Number(sale.tax_amount || 0);
            const discount = Number(sale.discount_amount || 0);
            const total = Number(sale.total_amount || 0);
            const paid = Number(sale.paid_amount || 0);
            const itemsCount = sale.items_count !== undefined ? sale.items_count : (sale.items?.length || 1);

            totalSubtotal += subtotal;
            totalTax += tax;
            totalDiscount += discount;
            totalSum += total;
            totalPaid += paid;

            const paymentMethodLabel = sale.payment_method 
                ? sale.payment_method.replace(/_/g, ' ').toUpperCase() 
                : 'CASH';

            return [
                sale.sale_number,
                sale.sale_date,
                saleTypeLabel,
                customerLabel,
                paymentMethodLabel,
                itemsCount,
                subtotal.toFixed(2),
                tax.toFixed(2),
                discount.toFixed(2),
                total.toFixed(2),
                paid.toFixed(2),
                (sale.payment_status || 'paid').toUpperCase()
            ];
        });

        // Add summary totals row
        rows.push([
            'TOTALS',
            '',
            '',
            '',
            '',
            '',
            totalSubtotal.toFixed(2),
            totalTax.toFixed(2),
            totalDiscount.toFixed(2),
            totalSum.toFixed(2),
            totalPaid.toFixed(2),
            ''
        ]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create blob and trigger download
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
