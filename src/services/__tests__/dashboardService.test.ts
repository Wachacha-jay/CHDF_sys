import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../dashboardService';
import { ApiService } from '../api';

// Mock ApiService
vi.mock('../api', () => ({
  ApiService: {
    get: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
    deleteFile: vi.fn()
  }
}));

// Mock other services
vi.mock('../salesService', () => ({
  SalesService: {
    getSales: vi.fn(),
    getSalesStats: vi.fn()
  }
}));

vi.mock('../productService', () => ({
  ProductService: {
    getProducts: vi.fn(),
    getProductStats: vi.fn()
  }
}));

vi.mock('../employeeService', () => ({
  EmployeeService: {
    getEmployees: vi.fn(),
    getEmployeeStats: vi.fn()
  }
}));

vi.mock('../supplierService', () => ({
  SupplierService: {
    getSuppliers: vi.fn(),
    getSupplierStats: vi.fn()
  }
}));

vi.mock('../accountingService', () => ({
  AccountingService: {
    getAccounts: vi.fn(),
    getBalanceSheet: vi.fn()
  }
}));

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics successfully', async () => {
      // Mock service responses
      const mockSalesStats = {
        totalSales: 100,
        todaySales: 10,
        totalRevenue: 50000
      };

      const mockProductStats = {
        totalProducts: 50,
        lowStockProducts: 5
      };

      const mockEmployeeStats = {
        totalEmployees: 20
      };

      const mockSupplierStats = {
        totalSuppliers: 15
      };

      const mockBalanceSheet = {
        assets: { total_assets: 100000 },
        liabilities: { total_liabilities: 30000 },
        equity: { total_equity: 70000 }
      };

      const mockCustomers = [{ id: '1' }, { id: '2' }];

      // Setup mocks
      vi.mocked(ApiService.get).mockResolvedValue({
        success: true,
        data: mockCustomers,
        error: null
      });

      const { SalesService } = await import('../salesService');
      const { ProductService } = await import('../productService');
      const { EmployeeService } = await import('../employeeService');
      const { SupplierService } = await import('../supplierService');
      const { AccountingService } = await import('../accountingService');

      vi.mocked(SalesService.getSalesStats).mockResolvedValue(mockSalesStats);
      vi.mocked(ProductService.getProductStats).mockResolvedValue(mockProductStats);
      vi.mocked(EmployeeService.getEmployeeStats).mockResolvedValue(mockEmployeeStats);
      vi.mocked(SupplierService.getSupplierStats).mockResolvedValue(mockSupplierStats);
      vi.mocked(AccountingService.getBalanceSheet).mockResolvedValue(mockBalanceSheet);

      const result = await DashboardService.getDashboardStats();

      expect(result).toEqual({
        totalSales: 100,
        todaySales: 10,
        totalProducts: 50,
        lowStockItems: 5,
        totalCustomers: 2,
        totalEmployees: 20,
        monthlyRevenue: 50000,
        monthlyExpenses: 0,
        totalAssets: 100000,
        totalLiabilities: 30000,
        totalEquity: 70000
      });
    });

    it('should return default stats on error', async () => {
      // Mock service to throw error
      const { SalesService } = await import('../salesService');
      vi.mocked(SalesService.getSalesStats).mockRejectedValue(new Error('Test error'));

      const result = await DashboardService.getDashboardStats();

      expect(result).toEqual({
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
        totalEquity: 0
      });
    });
  });

  describe('getSalesChartData', () => {
    it('should return chart data for sales', async () => {
      const mockSales = [
        { sale_date: '2024-01-15', total_amount: 1000 },
        { sale_date: '2024-01-16', total_amount: 1500 },
        { sale_date: '2024-01-17', total_amount: 800 }
      ];

      const { SalesService } = await import('../salesService');
      vi.mocked(SalesService.getSales).mockResolvedValue(mockSales);

      const result = await DashboardService.getSalesChartData(3);

      expect(result.labels).toHaveLength(3);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('Daily Sales');
      expect(result.datasets[0].data).toHaveLength(3);
    });

    it('should return default chart data on error', async () => {
      const { SalesService } = await import('../salesService');
      vi.mocked(SalesService.getSales).mockRejectedValue(new Error('Test error'));

      const result = await DashboardService.getSalesChartData(7);

      expect(result.labels).toEqual([]);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('No Data');
    });
  });

  describe('getRevenueExpensesChart', () => {
    it('should return revenue vs expenses chart data', async () => {
      const mockSales = [
        { sale_date: '2024-01', total_amount: 10000 },
        { sale_date: '2024-02', total_amount: 12000 }
      ];

      const { SalesService } = await import('../salesService');
      vi.mocked(SalesService.getSales).mockResolvedValue(mockSales);

      const result = await DashboardService.getRevenueExpensesChart(2);

      expect(result.labels).toHaveLength(2);
      expect(result.datasets).toHaveLength(2);
      expect(result.datasets[0].label).toBe('Revenue');
      expect(result.datasets[1].label).toBe('Expenses');
    });
  });

  describe('getProductCategoryChart', () => {
    it('should return product category distribution chart', async () => {
      const mockProducts = [
        { category: { name: 'Electronics' } },
        { category: { name: 'Electronics' } },
        { category: { name: 'Clothing' } }
      ];

      const mockCategories = [
        { name: 'Electronics' },
        { name: 'Clothing' }
      ];

      const { ProductService } = await import('../productService');
      vi.mocked(ProductService.getProducts).mockResolvedValue(mockProducts);
      vi.mocked(ProductService.getCategories).mockResolvedValue(mockCategories);

      const result = await DashboardService.getProductCategoryChart();

      expect(result.labels).toEqual(['Electronics', 'Clothing']);
      expect(result.datasets[0].data).toEqual([2, 1]);
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity data', async () => {
      const mockSales = [
        {
          id: '1',
          total_amount: 1000,
          customer: { name: 'John Doe' },
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      const mockPurchases = [
        {
          id: '2',
          total_amount: 2000,
          supplier: { name: 'Supplier Co' },
          created_at: '2024-01-15T09:00:00Z'
        }
      ];

      const { SalesService } = await import('../salesService');
      const { SupplierService } = await import('../supplierService');

      vi.mocked(SalesService.getSales).mockResolvedValue(mockSales);
      vi.mocked(SupplierService.getPurchases).mockResolvedValue(mockPurchases);

      const result = await DashboardService.getRecentActivity(5);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('sale');
      expect(result[1].type).toBe('purchase');
    });
  });

  describe('getQuickActions', () => {
    it('should return quick actions array', async () => {
      const result = await DashboardService.getQuickActions();

      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('new-sale');
      expect(result[1].id).toBe('add-product');
      expect(result[2].id).toBe('new-customer');
      expect(result[3].id).toBe('view-reports');
    });
  });
}); 