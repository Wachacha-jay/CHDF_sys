import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { DashboardService } from '../../services/dashboardService';

// Mock the DashboardService
vi.mock('../../services/dashboardService', () => ({
  DashboardService: {
    getDashboardStats: vi.fn(),
    getSalesChartData: vi.fn(),
    getRecentActivity: vi.fn()
  }
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn()
  }
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    // Mock services to return promises that don't resolve immediately
    vi.mocked(DashboardService.getDashboardStats).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(DashboardService.getSalesChartData).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(DashboardService.getRecentActivity).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithRouter(<Dashboard />);

    expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-skeleton')).toHaveLength(4);
  });

  it('should render dashboard with real data', async () => {
    const mockStats = {
      totalSales: 100,
      todaySales: 10,
      totalProducts: 50,
      lowStockItems: 5,
      totalCustomers: 20,
      totalEmployees: 15,
      monthlyRevenue: 50000,
      monthlyExpenses: 20000,
      totalAssets: 100000,
      totalLiabilities: 30000,
      totalEquity: 70000
    };

    const mockChartData = {
      labels: ['Mon', 'Tue', 'Wed'],
      datasets: [{
        label: 'Daily Sales',
        data: [1000, 1500, 800],
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2
      }]
    };

    const mockActivity = [
      {
        id: '1',
        type: 'sale' as const,
        action: 'New sale completed',
        amount: 1500,
        entity_name: 'John Doe',
        timestamp: '2024-01-15T10:00:00Z',
        user_name: 'System'
      }
    ];

    vi.mocked(DashboardService.getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue(mockChartData);
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue(mockActivity);

    renderWithRouter(<Dashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Check that stats are displayed
    expect(screen.getByText('KSh 10')).toBeInTheDocument(); // Today's sales
    expect(screen.getByText('50')).toBeInTheDocument(); // Total products
    expect(screen.getByText('20')).toBeInTheDocument(); // Total customers
    expect(screen.getByText('5')).toBeInTheDocument(); // Low stock items

    // Check that recent activity is displayed
    expect(screen.getByText('New sale completed')).toBeInTheDocument();
    expect(screen.getByText('KSh 1,500')).toBeInTheDocument();
  });

  it('should handle service errors gracefully', async () => {
    vi.mocked(DashboardService.getDashboardStats).mockRejectedValue(
      new Error('Failed to load stats')
    );
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue({
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    });
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue([]);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Should show default values when stats fail to load
    expect(screen.getByText('KSh 0')).toBeInTheDocument(); // Today's sales
    expect(screen.getByText('0')).toBeInTheDocument(); // Total products
  });

  it('should display no recent activity when empty', async () => {
    vi.mocked(DashboardService.getDashboardStats).mockResolvedValue({
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
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue({
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    });
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue([]);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  it('should format currency correctly', async () => {
    const mockStats = {
      totalSales: 100,
      todaySales: 1234567,
      totalProducts: 50,
      lowStockItems: 5,
      totalCustomers: 20,
      totalEmployees: 15,
      monthlyRevenue: 50000,
      monthlyExpenses: 20000,
      totalAssets: 100000,
      totalLiabilities: 30000,
      totalEquity: 70000
    };

    vi.mocked(DashboardService.getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue({
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    });
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue([]);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('KSh 1,234,567')).toBeInTheDocument();
    });
  });

  it('should format numbers correctly', async () => {
    const mockStats = {
      totalSales: 100,
      todaySales: 10,
      totalProducts: 1234567,
      lowStockItems: 5,
      totalCustomers: 20,
      totalEmployees: 15,
      monthlyRevenue: 50000,
      monthlyExpenses: 20000,
      totalAssets: 100000,
      totalLiabilities: 30000,
      totalEquity: 70000
    };

    vi.mocked(DashboardService.getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue({
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    });
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue([]);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });
  });

  it('should display quick actions with correct navigation', async () => {
    vi.mocked(DashboardService.getDashboardStats).mockResolvedValue({
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
    vi.mocked(DashboardService.getSalesChartData).mockResolvedValue({
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 2
      }]
    });
    vi.mocked(DashboardService.getRecentActivity).mockResolvedValue([]);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('New Sale')).toBeInTheDocument();
      expect(screen.getByText('Add Product')).toBeInTheDocument();
      expect(screen.getByText('New Customer')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });
  });
}); 