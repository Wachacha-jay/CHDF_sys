import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Baby,
  Activity,
  Layers,
  FileCheck
} from 'lucide-react';
import { useAuthContext } from '../../contexts/useAuthContext';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface SidebarProps {
  onClose?: () => void;
}

interface NavChild {
  name: string;
  href: string;
  icon: any;
  permission?: string | string[];
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  permission?: string | string[];
  children?: NavChild[];
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, logout } = useAuthContext();
  const { settings } = useSettingsContext();
  const location = useLocation();
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

  const hasPermission = (permission?: string | string[]): boolean => {
    if (!permission) return true;
    if (user?.role === 'Super Admin') return true;
    const userPerms = user?.permissions || [];
    if (Array.isArray(permission)) {
      return permission.some(p => userPerms.includes(p));
    }
    return userPerms.includes(permission);
  };

  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard_view' },
    { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, permission: 'pos_view' },
    { name: 'Inventory', href: '/inventory', icon: Package, permission: ['inventory_view', 'inventory_manage'] },
    { name: 'Expenses', href: '/expenses', icon: DollarSign, permission: ['expenses_view', 'expenses_record', 'expenses_approve'] },
    { name: 'Invoices', href: '/invoices', icon: Receipt, permission: ['invoices_view', 'sales_view'] },
    { name: 'Sales Reports', href: '/reports/sales', icon: TrendingUp, permission: 'reports_view' },
    {
      name: 'Accounting', href: '/accounting', icon: DollarSign, children: [
        { name: 'Dashboard', href: '/accounting', icon: LayoutDashboard, permission: ['accounting_view', 'accounting_manage'] },
        { name: 'General Ledger', href: '/accounting/general-ledger', icon: BookOpen, permission: ['accounting_view', 'journal_entries_view'] },
        { name: 'Balance Sheet', href: '/accounting/balance-sheet', icon: BarChart3, permission: 'accounting_view' },
        { name: 'Trial Balance', href: '/accounting/trial-balance', icon: Receipt, permission: 'accounting_view' },
        { name: 'Income Statement', href: '/accounting/income-statement', icon: TrendingUp, permission: 'accounting_view' },
        { name: 'Cash Flow', href: '/accounting/cash-flow', icon: ArrowRightLeft, permission: 'accounting_view' },
        { name: 'Bank Reconciliation', href: '/accounting/bank-reconciliation', icon: Layers, permission: ['bank_reconciliation_view', 'bank_recon_view', 'bank_recon_manage'] },
      ]
    },
    {
      name: 'Fund Accounting', href: '/funds', icon: HeartHandshake, children: [
        { name: 'Fund Dashboard', href: '/funds', icon: LayoutDashboard, permission: ['fund_accounting_view', 'donations_view', 'child_support_view', 'fund_accounting_manage'] },
        { name: 'Child Support', href: '/funds/children', icon: Baby, permission: ['child_support_view', 'school_fees_view', 'children_manage'] },
        { name: 'Donations', href: '/funds/donations', icon: Heart, permission: ['donations_view', 'donations_record'] },
        { name: 'Internal Transfers', href: '/funds/transfers', icon: ArrowRightLeft, permission: ['fund_accounting_manage', 'transfers_view', 'transfers_create', 'transfers_approve'] },
        { name: 'NGO Billing', href: '/funds/billing', icon: Receipt, permission: ['fund_accounting_manage', 'sales_view', 'invoices_view'] },
        { name: 'Reports Workspace', href: '/funds/reports', icon: BookOpen, permission: ['fund_reports_view', 'fund_accounting_view', 'reports_view'] },
        { name: 'Dept. & Funds Setup', href: '/funds/setup', icon: Building2, permission: ['fund_accounting_manage', 'fund_setup_view', 'fund_setup_manage'] },
      ]
    },

    {
      name: 'CRM & Vendors', href: '/customers', icon: Users, children: [
        { name: 'Customers (AR)', href: '/customers', icon: Users, permission: ['customers_view', 'customers_manage'] },
        { name: 'Suppliers & Vendors (AP)', href: '/suppliers', icon: Truck, permission: ['suppliers_view', 'suppliers_manage', 'purchases_view'] },
      ]
    },
    { name: 'HR & Payroll', href: '/employees', icon: UserCheck, permission: ['employees_view', 'employees_manage', 'payroll_view'] },
    {
      name: 'Security & Logs', href: '/users', icon: Shield, children: [
        { name: 'User Management (RBAC)', href: '/users', icon: Shield, permission: 'user_management_manage' },
        { name: 'Audit Trail / Logs', href: '/audit-log', icon: Activity, permission: ['audit_logs_view', 'user_management_manage'] },
      ]
    },
    { name: 'Settings', href: '/settings', icon: Settings, permission: 'settings_manage' },
  ];

  // Auto-expand parent accordion when navigating to a child page
  useEffect(() => {
    navigation.forEach(item => {
      if (item.children?.some(child => location.pathname === child.href || (child.href !== '/' && location.pathname.startsWith(child.href)))) {
        setOpenMenus(prev => prev.includes(item.name) ? prev : [...prev, item.name]);
      }
    });
  }, [location.pathname]);

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
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            // Filter child links by user permissions
            const visibleChildren = item.children!.filter(child => hasPermission(child.permission));
            if (visibleChildren.length === 0) {
              return null;
            }

            const isOpen = openMenus.includes(item.name);

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
                    {visibleChildren.map((child) => (
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

          // Single navigation item check
          if (!hasPermission(item.permission)) {
            return null;
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
