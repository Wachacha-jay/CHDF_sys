import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../components/dashboard/StatsCard';
import SalesChart from '../components/dashboard/SalesChart';
import DonationChart from '../components/dashboard/DonationChart';
import { 
  DollarSign, 
  Package, 
  Users, 
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Heart,
  Baby
} from 'lucide-react';
import { DashboardService } from '../services';
import { ChartData, RecentActivity } from '../services/dashboardService';
import { DashboardStats } from '../types';
import { useSettingsContext } from '../contexts/SettingsContext';
import { toast } from 'react-hot-toast';


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesChartData, setSalesChartData] = useState<ChartData | null>(null);
  const [donationChartData, setDonationChartData] = useState<ChartData | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [statsData, chartData, dChartData, activityData] = await Promise.all([
        DashboardService.getDashboardStats(),
        DashboardService.getSalesChartData(7),
        DashboardService.getDonationChartData(30),
        DashboardService.getRecentActivity(10)
      ]);

      setStats(statsData);
      setSalesChartData(chartData);
      setDonationChartData(dChartData);
      setRecentActivity(activityData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    // FORCE KES/KSh for this organization as per user request to stop seeing USD
    return `KSh ${new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-KE').format(num);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Loading dashboard data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your business today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Today's Sales"
          value={stats ? formatCurrency(stats.todaySales) : '0'}
          icon={TrendingUp}
          color="green"
          onClick={() => navigate('/pos')}
        />
        <StatsCard
          title="Total Products"
          value={stats ? formatNumber(stats.totalProducts) : '0'}
          icon={Package}
          color="blue"
          onClick={() => navigate('/inventory')}
        />
        <StatsCard
          title="Active Customers"
          value={stats ? formatNumber(stats.totalCustomers) : '0'}
          icon={Users}
          color="purple"
          onClick={() => navigate('/customers')}
        />
        <StatsCard
          title="Low Stock Items"
          value={stats ? formatNumber(stats.lowStockItems) : '0'}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate('/inventory?lowStock=1')}
        />
      </div>

      {/* NGO Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Children"
          value={stats ? formatNumber(stats.totalChildren) : '0'}
          icon={Baby}
          color="indigo"
          onClick={() => navigate('/funds/children')}
        />
        <StatsCard
          title="Active Sponsorships"
          value={stats ? formatNumber(stats.activeSponsorships) : '0'}
          icon={Heart}
          color="pink"
          onClick={() => navigate('/funds/children')}
        />
        <StatsCard
          title="Monthly Donations"
          value={stats ? formatCurrency(stats.totalDonationsMonth) : '0'}
          icon={Heart}
          color="emerald"
          onClick={() => navigate('/funds/donations')}
        />
        <StatsCard
          title="Restricted Funds"
          value={stats ? formatCurrency(stats.restrictedFundBalance) : '0'}
          icon={Package}
          color="orange"
          onClick={() => navigate('/funds')}
        />
      </div>

      {/* Charts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SalesChart data={salesChartData} />
          <DonationChart data={donationChartData} />
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/pos')}
              className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center">
                <ShoppingCart className="w-5 h-5 text-blue-600 mr-3" />
                <span className="font-medium text-blue-900">New Sale</span>
              </div>
              <span className="text-blue-600 group-hover:translate-x-1 transition-transform">→</span>
            </button>
            
            <button 
              onClick={() => navigate('/inventory')}
              className="w-full flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center">
                <Package className="w-5 h-5 text-emerald-600 mr-3" />
                <span className="font-medium text-emerald-900">Add Product</span>
              </div>
              <span className="text-emerald-600 group-hover:translate-x-1 transition-transform">→</span>
            </button>
            
            <button 
              onClick={() => navigate('/customers')}
              className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center">
                <Users className="w-5 h-5 text-purple-600 mr-3" />
                <span className="font-medium text-purple-900">Manage Customers</span>
              </div>
              <span className="text-purple-600 group-hover:translate-x-1 transition-transform">→</span>
            </button>

            <button 
              onClick={() => navigate('/accounting/general-ledger')}
              className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-orange-600 mr-3" />
                <span className="font-medium text-orange-900">View Reports</span>
              </div>
              <span className="text-orange-600 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">
                    {activity.amount ? formatCurrency(activity.amount) : activity.entity_name}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(activity.timestamp).toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;