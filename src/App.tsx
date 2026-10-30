import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './contexts/useAuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import LoginForm from './components/auth/LoginForm';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import GeneralLedger from './pages/accounting/GeneralLedger';
import BalanceSheet from './pages/accounting/BalanceSheet';
import TrialBalance from './pages/accounting/TrialBalance';
import AccountingDashboard from './pages/accounting/AccountingDashboard';
import AccountCategories from './pages/accounting/AccountCategories';
import ChartOfAccounts from './pages/accounting/ChartOfAccounts';
import PointOfSale from './pages/PointOfSale';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Suppliers from './pages/Suppliers';
import Invoice from './pages/Invoice';
import Expenses from './pages/Expenses';
import AddStockPage from './pages/inventory/AddStockPage';
import InvoiceList from './pages/InvoiceList';
import PurchaseInvoiceDetail from './pages/PurchaseInvoiceDetail';
import SalesReports from './pages/SalesReports';
import UserManagement from './pages/UserManagement';
import AuditLog from './pages/AuditLog';

import BankReconciliation from './pages/accounting/BankReconciliation';
import IncomeStatement from './pages/accounting/IncomeStatement';
import CashFlow from './pages/accounting/CashFlow';
import FixedAssets from './pages/accounting/FixedAssets';

import FundDashboard from './pages/fund-accounting/FundDashboard';
import ChildManagement from './pages/fund-accounting/ChildManagement';
import Donations from './pages/fund-accounting/Donations';
import DepartmentsAndFunds from './pages/fund-accounting/DepartmentsAndFunds';
import InternalTransfers from './pages/fund-accounting/InternalTransfers';
import NGOBilling from './pages/fund-accounting/NGOBilling';
import FundReports from './pages/fund-accounting/FundReports';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProtectedRouteProps {
  permission?: string | string[];
  element: React.ReactElement;
  moduleName?: string;
}

const AccessDenied: React.FC<{ moduleName?: string }> = ({ moduleName }) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800">Access Restricted</h2>
      <p className="text-slate-500 mt-2 max-w-md text-sm leading-relaxed">
        Your user account does not have permission to access {moduleName ? `the ${moduleName}` : 'this'} module. 
        Please contact your system administrator if you require access.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </Link>
    </div>
  );
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permission, element, moduleName }) => {
  const { user } = useAuthContext();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin has unrestricted access
  if (user.role === 'Super Admin') {
    return element;
  }

  if (permission) {
    const userPerms = user.permissions || [];
    const hasPrivilege = Array.isArray(permission)
      ? permission.some(p => userPerms.includes(p))
      : userPerms.includes(permission);

    if (!hasPrivilege) {
      return <AccessDenied moduleName={moduleName} />;
    }
  }

  return element;
};

const DashboardRoute: React.FC = () => {
  const { user } = useAuthContext();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'Super Admin') return <Dashboard />;

  const perms = user.permissions || [];
  if (perms.includes('dashboard_view')) {
    return <Dashboard />;
  }

  // Smooth enterprise role redirection: seamlessly direct the user to their granted module
  if (perms.includes('pos_view')) return <Navigate to="/pos" replace />;
  if (perms.includes('accounting_view') || perms.includes('accounting_manage')) return <Navigate to="/accounting" replace />;
  if (perms.includes('fund_accounting_view') || perms.includes('donations_view') || perms.includes('child_support_view')) return <Navigate to="/funds" replace />;
  if (perms.includes('invoices_view') || perms.includes('sales_view')) return <Navigate to="/invoices" replace />;
  if (perms.includes('inventory_view')) return <Navigate to="/inventory" replace />;
  if (perms.includes('expenses_view')) return <Navigate to="/expenses" replace />;
  if (perms.includes('employees_view')) return <Navigate to="/employees" replace />;
  if (perms.includes('customers_view')) return <Navigate to="/customers" replace />;
  if (perms.includes('suppliers_view')) return <Navigate to="/suppliers" replace />;
  if (perms.includes('reports_view')) return <Navigate to="/reports/sales" replace />;
  if (perms.includes('user_management_manage')) return <Navigate to="/users" replace />;
  if (perms.includes('audit_logs_view')) return <Navigate to="/audit-log" replace />;
  if (perms.includes('settings_manage')) return <Navigate to="/settings" replace />;

  return <AccessDenied moduleName="Dashboard" />;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuthContext();

  if (user) {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/settings" element={<ProtectedRoute permission="settings_manage" moduleName="Settings" element={<Settings />} />} />
          <Route path="/accounting/general-ledger" element={<ProtectedRoute permission={['accounting_view', 'journal_entries_view']} moduleName="General Ledger" element={<GeneralLedger />} />} />
          <Route path="/accounting/balance-sheet" element={<ProtectedRoute permission="accounting_view" moduleName="Balance Sheet" element={<BalanceSheet />} />} />
          <Route path="/accounting/trial-balance" element={<ProtectedRoute permission="accounting_view" moduleName="Trial Balance" element={<TrialBalance />} />} />
          <Route path="/accounting/categories" element={<ProtectedRoute permission="accounting_view" moduleName="Account Categories" element={<AccountCategories />} />} />
          <Route path="/accounting/chart-of-accounts" element={<ProtectedRoute permission={['accounting_view', 'chart_of_accounts_view', 'chart_of_accounts_manage']} moduleName="Chart of Accounts" element={<ChartOfAccounts />} />} />
          <Route path="/accounting/bank-reconciliation" element={<ProtectedRoute permission={['bank_reconciliation_view', 'bank_recon_view', 'bank_recon_manage', 'accounting_view']} moduleName="Bank Reconciliation" element={<BankReconciliation />} />} />
          <Route path="/accounting/income-statement" element={<ProtectedRoute permission="accounting_view" moduleName="Income Statement" element={<IncomeStatement />} />} />
          <Route path="/accounting/cash-flow" element={<ProtectedRoute permission="accounting_view" moduleName="Cash Flow" element={<CashFlow />} />} />
          <Route path="/pos" element={<ProtectedRoute permission="pos_view" moduleName="Point of Sale" element={<PointOfSale />} />} />
          <Route path="/inventory" element={<ProtectedRoute permission={['inventory_view', 'inventory_manage']} moduleName="Inventory" element={<Inventory />} />} />
          <Route path="/inventory/add-stock" element={<ProtectedRoute permission={['inventory_create', 'inventory_edit', 'inventory_manage']} moduleName="Add Stock" element={<AddStockPage />} />} />
          <Route path="/expenses" element={<ProtectedRoute permission={['expenses_view', 'expenses_record', 'expenses_approve']} moduleName="Expenses" element={<Expenses />} />} />
          <Route path="/invoices" element={<ProtectedRoute permission={['invoices_view', 'sales_view', 'purchases_view']} moduleName="Invoices" element={<InvoiceList />} />} />
          <Route path="/accounting" element={<ProtectedRoute permission={['accounting_view', 'accounting_manage']} moduleName="Accounting Dashboard" element={<AccountingDashboard />} />} />
          <Route path="/accounting/fixed-assets" element={<ProtectedRoute permission={['accounting_view', 'fixed_assets_view', 'fixed_assets_manage']} moduleName="Fixed Assets" element={<FixedAssets />} />} />
          <Route path="/customers" element={<ProtectedRoute permission={['customers_view', 'customers_manage']} moduleName="Customers" element={<Customers />} />} />
          <Route path="/employees" element={<ProtectedRoute permission={['employees_view', 'employees_manage']} moduleName="Employees" element={<Employees />} />} />
          <Route path="/suppliers" element={<ProtectedRoute permission={['suppliers_view', 'suppliers_manage']} moduleName="Suppliers" element={<Suppliers />} />} />
          <Route path="/invoice/:id" element={<ProtectedRoute permission={['invoices_view', 'sales_view']} moduleName="Invoice" element={<Invoice />} />} />
          <Route path="/invoice" element={<ProtectedRoute permission={['invoices_view', 'sales_view']} moduleName="Invoice" element={<Invoice />} />} />
          <Route path="/purchase-invoice/:id" element={<ProtectedRoute permission={['invoices_view', 'purchases_view']} moduleName="Purchase Invoice" element={<PurchaseInvoiceDetail />} />} />
          <Route path="/purchases/:id" element={<ProtectedRoute permission={['invoices_view', 'purchases_view']} moduleName="Purchase Invoice" element={<PurchaseInvoiceDetail />} />} />
          <Route path="/reports/sales" element={<ProtectedRoute permission="reports_view" moduleName="Sales Reports" element={<SalesReports />} />} />
          <Route path="/users" element={<ProtectedRoute permission="user_management_manage" moduleName="User Management" element={<UserManagement />} />} />
          <Route path="/audit-log" element={<ProtectedRoute permission={['audit_logs_view', 'user_management_manage']} moduleName="Audit Log" element={<AuditLog />} />} />
          
          {/* Fund Accounting & Child Support */}
          <Route path="/funds" element={<ProtectedRoute permission={['fund_accounting_view', 'donations_view', 'child_support_view', 'fund_accounting_manage']} moduleName="Fund Dashboard" element={<FundDashboard />} />} />
          <Route path="/funds/children" element={<ProtectedRoute permission={['child_support_view', 'school_fees_view', 'children_manage']} moduleName="Child Support & School Fees" element={<ChildManagement />} />} />
          <Route path="/funds/donations" element={<ProtectedRoute permission={['donations_view', 'donations_record', 'fund_accounting_view']} moduleName="Donations" element={<Donations />} />} />
          <Route path="/funds/setup" element={<ProtectedRoute permission={['fund_accounting_manage', 'fund_setup_view', 'fund_setup_manage']} moduleName="Dept. & Funds Setup" element={<DepartmentsAndFunds />} />} />
          <Route path="/funds/transfers" element={<ProtectedRoute permission={['fund_accounting_manage', 'transfers_view', 'transfers_create', 'transfers_approve']} moduleName="Internal Transfers" element={<InternalTransfers />} />} />
          <Route path="/funds/billing" element={<ProtectedRoute permission={['fund_accounting_manage', 'sales_view', 'invoices_view']} moduleName="NGO Billing" element={<NGOBilling />} />} />
          <Route path="/funds/reports" element={<ProtectedRoute permission={['fund_reports_view', 'fund_accounting_view', 'reports_view']} moduleName="Fund Reports" element={<FundReports />} />} />
          <Route path="/fund-accounting/donations" element={<Navigate to="/funds/donations" replace />} />
          <Route path="/fund-accounting/*" element={<Navigate to="/funds" replace />} />

        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#fff',
                borderRadius: '0.75rem',
                border: '1px solid #334155'
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <AppRoutes />
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
