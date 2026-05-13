import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  UserCheck,
  Truck,
  Settings,
  Shield,
  LogOut,
  Building2,
  BookOpen,
  BarChart3,
  Receipt,
  TrendingUp,
  ArrowRightLeft,
  ChevronDown,
  X,
  HeartHandshake,
  Heart,
  Baby
} from 'lucide-react';
import { useAuthContext } from '../../contexts/useAuthContext';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, logout } = useAuthContext();
  const { settings } = useSettingsContext();
  const [openMenus, setOpenMenus] = React.useState<string[]>([]);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Point of Sale', href: '/pos', icon: ShoppingCart },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Expenses', href: '/expenses', icon: DollarSign },
    { name: 'Invoices', href: '/invoices', icon: Receipt },
    { name: 'Sales Reports', href: '/reports/sales', icon: TrendingUp },
    {
      name: 'Accounting', href: '/accounting', icon: DollarSign, children: [
        { name: 'Dashboard', href: '/accounting', icon: LayoutDashboard },
        { name: 'General Ledger', href: '/accounting/general-ledger', icon: BookOpen },
        { name: 'Balance Sheet', href: '/accounting/balance-sheet', icon: BarChart3 },
        { name: 'Trial Balance', href: '/accounting/trial-balance', icon: Receipt },
        { name: 'Income Statement', href: '/accounting/income-statement', icon: TrendingUp },
        { name: 'Cash Flow', href: '/accounting/cash-flow', icon: ArrowRightLeft },
      ]
    },
    {
      name: 'Fund Accounting', href: '/funds', icon: HeartHandshake, children: [
        { name: 'Fund Dashboard', href: '/funds', icon: LayoutDashboard },
        { name: 'Child Support', href: '/funds/children', icon: Baby },
        { name: 'Donations', href: '/funds/donations', icon: Heart },
        { name: 'Internal Transfers', href: '/funds/transfers', icon: ArrowRightLeft },
        { name: 'NGO Billing', href: '/funds/billing', icon: Receipt },
        { name: 'Dept. & Funds Setup', href: '/funds/setup', icon: Building2 },
      ]
    },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Employees', href: '/employees', icon: UserCheck },
    { name: 'Suppliers', href: '/suppliers', icon: Truck },
    { name: 'User Management', href: '/users', icon: Shield, permission: 'user_management_manage' },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-full flex-col bg-slate-800 border-r border-slate-900 shadow-xl overflow-hidden">
      {/* Logo & Close Button */}
      <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-slate-900">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-100 tracking-tight">
            BIZMANAGER
          </span>
        </div>
        
        <button
          onClick={onClose}
          className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 lg:hidden transition-colors"
          aria-label="Close Sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          // Check for permission if item has one
          if (item.permission && user?.role !== 'Super Admin') {
            if (!user?.permissions?.includes(item.permission)) {
              return null;
            }
          }

          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus.includes(item.name);

          if (hasChildren) {
            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={`flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isOpen 
                      ? 'text-white bg-slate-700/50' 
                      : 'text-slate-200 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-3 h-5 w-5 ${isOpen ? 'text-indigo-400' : ''}`} />
                    {item.name}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 border-l border-slate-700 pl-2 mt-1 space-y-1">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.name}
                        to={child.href}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 ${isActive
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                          }`
                        }
                      >
                        <child.icon className="mr-3 h-4 w-4" />
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                  ? 'bg-indigo-700 text-white border-r-2 border-indigo-400 shadow-lg'
                  : 'text-slate-200 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <item.icon className={`mr-3 h-5 w-5 ${item.href === window.location.pathname ? 'text-indigo-400' : ''}`} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-900 p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-slate-200">
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">
              {user?.name || user?.email}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {user?.role || 'User'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-200 rounded-lg hover:bg-slate-700 hover:text-red-400 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;