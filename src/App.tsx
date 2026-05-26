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

import BankReconciliation from './pages/accounting/BankReconciliation';
import IncomeStatement from './pages/accounting/IncomeStatement';
import CashFlow from './pages/accounting/CashFlow';

import FundDashboard from './pages/fund-accounting/FundDashboard';
import ChildManagement from './pages/fund-accounting/ChildManagement';
import Donations from './pages/fund-accounting/Donations';
import DepartmentsAndFunds from './pages/fund-accounting/DepartmentsAndFunds';
import InternalTransfers from './pages/fund-accounting/InternalTransfers';
import NGOBilling from './pages/fund-accounting/NGOBilling';
import FundReports from './pages/fund-accounting/FundReports';



const AppRoutes: React.FC = () => {
  const { user } = useAuthContext();

  if (user) {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/accounting/general-ledger" element={<GeneralLedger />} />
          <Route path="/accounting/balance-sheet" element={<BalanceSheet />} />
          <Route path="/accounting/trial-balance" element={<TrialBalance />} />
          <Route path="/accounting/categories" element={<AccountCategories />} />
          <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/accounting/bank-reconciliation" element={<BankReconciliation />} />
          <Route path="/accounting/income-statement" element={<IncomeStatement />} />
          <Route path="/accounting/cash-flow" element={<CashFlow />} />
          <Route path="/pos" element={<PointOfSale />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/add-stock" element={<AddStockPage />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/accounting" element={<AccountingDashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/invoice/:id" element={<Invoice />} />
          <Route path="/invoice" element={<Invoice />} />
          <Route path="/purchase-invoice/:id" element={<PurchaseInvoiceDetail />} />
          <Route path="/reports/sales" element={<SalesReports />} />
          <Route path="/users" element={<UserManagement />} />
          
          {/* Fund Accounting & Child Support */}
          <Route path="/funds" element={<FundDashboard />} />
          <Route path="/funds/children" element={<ChildManagement />} />
          <Route path="/funds/donations" element={<Donations />} />
          <Route path="/funds/setup" element={<DepartmentsAndFunds />} />
          <Route path="/funds/transfers" element={<InternalTransfers />} />
          <Route path="/funds/billing" element={<NGOBilling />} />
          <Route path="/funds/reports" element={<FundReports />} />

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
                background: '#363636',
                color: '#fff',
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