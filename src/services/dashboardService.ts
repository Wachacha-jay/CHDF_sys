import { ApiService } from './api';
import { DashboardStats, BalanceSheetData } from '../types';
import { SalesService } from './salesService';
import { ProductService } from './productService';
import { EmployeeService } from './employeeService';
import { SupplierService } from './supplierService';
import { AccountingService } from './accountingService';
import { FundAccountingService } from './fundAccountingService';

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }>;
}

export interface RecentActivity {
  id: string;
  type: 'sale' | 'purchase' | 'product' | 'customer' | 'supplier' | 'employee' | 'payment';
  action: string;
  amount?: number;
  entity_name?: string;
  timestamp: string;
  user_name?: string;
}

export class DashboardService {
  // Dashboard statistics
  static async getDashboardStats(): Promise<DashboardStats> {
    const stats = this.getDefaultStats();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      const startOfMonth = firstDayOfMonth.toISOString().split('T')[0];

      // Fetch Sales
      try {
        const sales = await SalesService.getSales();
        const salesList = sales || [];
        stats.totalSales = salesList.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        stats.todaySales = salesList
          .filter(s => s.sale_date === today)
          .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        stats.monthlyRevenue = salesList
          .filter(s => s.sale_date >= startOfMonth)
          .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
      } catch (e) {
        console.error('Error fetching sales stats:', e);
      }

      // Fetch NGO Metrics
      try {
        const [children, sponsorships, donations, fundBalances] = await Promise.all([
          FundAccountingService.getChildren(),
          FundAccountingService.getSponsorships(),
          ApiService.get('donations', { filters: { donation_date_gte: startOfMonth } }),
          FundAccountingService.getFundBalances()
        ]);
        
        stats.totalChildren = children.length;
        stats.activeSponsorships = sponsorships.filter(s => s.status === 'active').length;
        
        const donationList = donations.success ? (donations.data || []) : [];
        stats.totalDonationsMonth = donationList.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
        
        // Sum restricted fund balances
        let restrictedTotal = 0;
        fundBalances.forEach((balance, fundId) => {
           restrictedTotal += balance;
        });
        stats.restrictedFundBalance = restrictedTotal;
      } catch (e) {
        console.error('Error fetching NGO stats:', e);
      }

      // Fetch Products
      try {
        const products = await ProductService.getProducts();
        const productList = products || [];
        stats.totalProducts = productList.length;
        stats.lowStockItems = productList.filter(p => p.current_stock <= (p.safety_stock || 10)).length;
      } catch (e) {
        console.error('Error fetching product stats:', e);
      }

      // Fetch Customers
      try {
        const customers = await ApiService.get('customers', { filters: { is_active: true } });
        stats.totalCustomers = customers.success ? (customers.data?.length || 0) : 0;
      } catch (e) {
        console.error('Error fetching customer stats:', e);
      }

      // Fetch Expenses
      try {
        const expenses = await ApiService.get('expenses', { 
          filters: { 
            expense_date_gte: startOfMonth 
          } 
        });
        const expenseList = expenses.success ? (expenses.data || []) : [];
        stats.monthlyExpenses = expenseList.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      } catch (e) {
        console.error('Error fetching expense stats:', e);
      }

      // Fetch Balance Sheet
      try {
        const balanceSheet = await AccountingService.getBalanceSheet();
        stats.totalAssets = balanceSheet.assets.total_assets;
        stats.totalLiabilities = balanceSheet.liabilities.total_liabilities;
        stats.totalEquity = balanceSheet.equity.total_equity;
      } catch (e) {
        console.error('Error fetching balance sheet stats:', e);
      }

      return stats;
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      return stats;
    }
  }

  // Donation chart data
  static async getDonationChartData(days: number = 30): Promise<ChartData> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      
      const donationsResponse = await ApiService.get('donations', {
        filters: {
          donation_date_gte: startDate.toISOString().split('T')[0],
          donation_date_lte: endDate.toISOString().split('T')[0]
        }
      });

      const donations = donationsResponse.success ? (donationsResponse.data || []) : [];
      const dailyData = new Map<string, number>();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData.set(dayLabel, 0);
      }

      donations.forEach((d: any) => {
        const date = new Date(d.donation_date);
        const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const currentTotal = dailyData.get(dayLabel) || 0;
        dailyData.set(dayLabel, currentTotal + Number(d.amount));
      });

      return {
        labels: Array.from(dailyData.keys()),
        datasets: [
          {
            label: 'Donations',
            data: Array.from(dailyData.values()),
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 2
          }
        ]
      };
    } catch (error) {
      console.error('Error getting donation chart data:', error);
      return this.getDefaultChartData();
    }
  }

  // Sales chart data
  static async getSalesChartData(days: number = 7): Promise<ChartData> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      
      const sales = await SalesService.getSales({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });

      const dailyData = new Map<string, number>();
      
      // Initialize map with all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        dailyData.set(dayLabel, 0);
      }

      // Sum sales by day
      sales.forEach(sale => {
        const date = new Date(sale.sale_date);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        const currentTotal = dailyData.get(dayLabel) || 0;
        dailyData.set(dayLabel, currentTotal + sale.total_amount);
      });

      return {
        labels: Array.from(dailyData.keys()),
        datasets: [
          {
            label: 'Daily Sales',
            data: Array.from(dailyData.values()),
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2
          }
        ]
      };
    } catch (error) {
      console.error('Error getting sales chart data:', error);
      return this.getDefaultChartData();
    }
  }

  // Revenue vs Expenses chart
  static async getRevenueExpensesChart(months: number = 12): Promise<ChartData> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const sales = await SalesService.getSales({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });

      // Group by month
      const monthlyData = new Map<string, { revenue: number; expenses: number }>();
      
      for (let i = 0; i < months; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        const monthKey = date.toISOString().slice(0, 7);
        monthlyData.set(monthKey, { revenue: 0, expenses: 0 });
      }

      // Calculate revenue
      sales.forEach(sale => {
        const monthKey = sale.sale_date.slice(0, 7);
        const current = monthlyData.get(monthKey);
        if (current) {
          current.revenue += Number(sale.total_amount || 0);
        }
      });

      // Calculate expenses (simplified - you might want to get actual expense data)
      const expenses = await this.getMonthlyExpenses();
      const avgMonthlyExpense = expenses / months;
      
      monthlyData.forEach((data, monthKey) => {
        data.expenses = avgMonthlyExpense;
      });

      const labels = Array.from(monthlyData.keys()).map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      });

      const revenueData = Array.from(monthlyData.values()).map(d => d.revenue);
      const expensesData = Array.from(monthlyData.values()).map(d => d.expenses);

      return {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueData,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 2
          },
          {
            label: 'Expenses',
            data: expensesData,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2
          }
        ]
      };
    } catch (error) {
      console.error('Error getting revenue expenses chart data:', error);
      return this.getDefaultChartData();
    }
  }

  // Product category distribution chart
  static async getProductCategoryChart(): Promise<ChartData> {
    try {
      const products = await ProductService.getProducts();
      const categories = await ProductService.getCategories();

      const categoryCounts = new Map<string, number>();
      categories.forEach(category => {
        categoryCounts.set(category.name, 0);
      });

      products.forEach(product => {
        if (product.category) {
          const currentCount = categoryCounts.get(product.category.name) || 0;
          categoryCounts.set(product.category.name, currentCount + 1);
        }
      });

      const labels = Array.from(categoryCounts.keys());
      const data = Array.from(categoryCounts.values());

      const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ];

      return {
        labels,
        datasets: [{
          label: 'Products by Category',
          data,
          backgroundColor: colors.slice(0, labels.length) as string[],
          borderWidth: 1
        }]
      };
    } catch (error) {
      console.error('Error getting product category chart data:', error);
      return this.getDefaultChartData();
    }
  }

  // Recent activity
  static async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];

      // Get recent sales
      const recentSales = await SalesService.getSales({}, { limit: 5 });
      recentSales.forEach(sale => {
        activities.push({
          id: sale.id,
          type: 'sale',
          action: 'New sale completed',
          amount: sale.total_amount,
          entity_name: sale.customer?.name,
          timestamp: sale.created_at,
          user_name: 'System'
        });
      });

      // Get recent purchases
      const recentPurchases = await SupplierService.getPurchases({}, { limit: 5 });
      recentPurchases.forEach(purchase => {
        activities.push({
          id: purchase.id,
          type: 'purchase',
          action: 'Purchase order created',
          amount: purchase.total_amount,
          entity_name: purchase.supplier?.name,
          timestamp: purchase.created_at,
          user_name: 'System'
        });
      });

      // Sort by timestamp and limit
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  // Quick actions
  static async getQuickActions(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    action: string;
    color: string;
  }>> {
    return [
      {
        id: 'new-sale',
        title: 'New Sale',
        description: 'Create a new sales transaction',
        icon: 'ShoppingCart',
        action: '/pos',
        color: 'blue'
      },
      {
        id: 'add-product',
        title: 'Add Product',
        description: 'Add a new product to inventory',
        icon: 'Package',
        action: '/inventory',
        color: 'emerald'
      },
      {
        id: 'new-customer',
        title: 'New Customer',
        description: 'Add a new customer',
        icon: 'Users',
        action: '/customers',
        color: 'purple'
      },
      {
        id: 'view-reports',
        title: 'View Reports',
        description: 'Access business reports',
        icon: 'BarChart3',
        action: '/accounting',
        color: 'orange'
      }
    ];
  }

  // Helper methods
  private static async getCustomerCount(): Promise<number> {
    try {
      const response = await ApiService.get('customers', {
        filters: { is_active: true }
      });
      return response.success ? (response.data?.length || 0) : 0;
    } catch (error) {
      console.error('Error getting customer count:', error);
      return 0;
    }
  }

  private static async getMonthlyExpenses(): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      
      const response = await ApiService.get('expenses', {
        filters: {
          expense_date_gte: startDate.toISOString().split('T')[0]
        }
      });

      if (response.success && response.data) {
        return response.data.reduce((sum: number, expense: any) => sum + (Number(expense.amount) || 0), 0);
      }

      return 0;
    } catch (error) {
      console.error('Error getting monthly expenses:', error);
      return 0;
    }
  }

  private static getDefaultStats(): DashboardStats {
    return {
      totalSales: 0,
      todaySales: 0,
      totalProducts: 0,
      lowStockItems: 0,
      totalCustomers: 0,
      totalEmployees: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalChildren: 0,
      activeSponsorships: 0,
      totalDonationsMonth: 0,
      restrictedFundBalance: 0
    };
  }

  private static getDefaultChartData(): ChartData {
    return {
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    };
  }
} 