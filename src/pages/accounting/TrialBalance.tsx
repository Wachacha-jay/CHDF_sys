import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Filter, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Printer, 
  FileSpreadsheet,
  Building2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AccountingService } from '../../services/accountingService';
import { FundAccountingService } from '../../services/fundAccountingService';
import { ApiService } from '../../services/api';
import type { Account, JournalEntry, AccountCategory, Department } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

interface TrialBalanceEntry {
  account: Account;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

interface TrialBalanceData {
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  difference: number;
  asOfDate: string;
}

const TrialBalance: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') ? settings.default_currency : 'KES';
  const businessName = settings?.business_name || 'Organization';

  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUnbalanced, setShowUnbalanced] = useState(false);
  const [hideZeroBalances, setHideZeroBalances] = useState(true);

  useEffect(() => {
    loadTrialBalance();
  }, [asOfDate, selectedDepartment]);

  const handleCleanLegacyTransfers = async () => {
    if (!window.confirm('Are you sure you want to permanently scrap legacy internal transfer accounts (4900, 5900) and sync all historical payroll lines to their departments? This action aligns your reports with IFRS standards.')) {
      return;
    }
    try {
      setCleaningUp(true);
      const res = await AccountingService.purgeLegacyTransferAccountsAndSyncPayroll();
      if (res.success) {
        toast.success(res.message);
        await loadTrialBalance();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute cleanup');
    } finally {
      setCleaningUp(false);
    }
  };

  const loadTrialBalance = async () => {
    try {
      setLoading(true);
      
      const [accountsTree, categoriesData, journalEntries, deptsData, empsData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories(),
        AccountingService.getJournalEntries({
          end_date: asOfDate,
          is_posted: true
        }),
        FundAccountingService.getDepartments(),
        ApiService.get<any>('employees')
      ]);
      
      const flatAccounts = AccountingService.flattenAccounts(accountsTree)
        .filter(acc => !AccountingService.isLegacyInternalTransferAccount(acc));

      setCategories(categoriesData || []);
      setDepartments(deptsData || []);
      setEmployees(empsData.success ? (empsData.data || []) : []);

      // Calculate trial balance adhering to departmental filtering
      const trialBalanceData = calculateTrialBalance(
        flatAccounts, 
        journalEntries, 
        asOfDate, 
        selectedDepartment, 
        deptsData || [], 
        empsData.success ? (empsData.data || []) : []
      );
      setTrialBalance(trialBalanceData);
    } catch (error) {
      console.error('Error loading trial balance:', error);
      toast.error('Failed to load trial balance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTrialBalance = (
    accounts: Account[], 
    journalEntries: JournalEntry[], 
    asOfDate: string,
    deptFilter: string,
    depts: Department[],
    emps: any[]
  ): TrialBalanceData => {
    const accountBalances = new Map<string, { debits: number; credits: number }>();

    // Initialize all accounts with zero balances
    accounts.forEach(account => {
      accountBalances.set(account.id, { debits: 0, credits: 0 });
    });

    // Calculate balances from journal entries
    journalEntries.forEach(entry => {
      if (entry.lines) {
        entry.lines.forEach(line => {
          if (AccountingService.isLegacyInternalTransferAccount(line.account)) {
            return;
          }

          if (deptFilter !== 'all') {
            const lineDeptId = AccountingService.resolveDepartmentForLine(line, entry, emps, depts);
            const isMatch = AccountingService.isDepartmentMatch(lineDeptId, deptFilter, depts);
            if (!isMatch) return;
          }

          const current = accountBalances.get(line.account_id);
          if (current) {
            current.debits += Number(line.debit_amount || 0);
            current.credits += Number(line.credit_amount || 0);
          }
        });
      }
    });

    // Create trial balance entries adhering to standard closing Trial Balance rules:
    // Net Debit balance goes to Debit column; Net Credit balance goes to Credit column
    const entries: TrialBalanceEntry[] = accounts.map(account => {
      const balance = accountBalances.get(account.id) || { debits: 0, credits: 0 };
      const net = balance.debits - balance.credits;
      
      const debitBalance = net > 0 ? net : 0;
      const creditBalance = net < 0 ? Math.abs(net) : 0;

      return {
        account,
        debitBalance,
        creditBalance,
        netBalance: net
      };
    });

    // Calculate totals across all entries
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debitBalance, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.creditBalance, 0);
    const difference = Math.abs(totalDebits - totalCredits);

    return {
      entries,
      totalDebits,
      totalCredits,
      difference,
      asOfDate
    };
  };

  const selectedDeptObj = departments.find(d => d.id === selectedDepartment);
  const selectedDeptName = selectedDepartment === 'all' 
    ? 'All Departments (Consolidated)' 
    : (selectedDeptObj?.name || 'Department');

  const filteredEntries = trialBalance?.entries.filter(entry => {
    // Hide zero balances if toggled
    if (hideZeroBalances && Math.abs(entry.debitBalance) < 0.001 && Math.abs(entry.creditBalance) < 0.001) {
      return false;
    }

    if (showUnbalanced) {
      const isDebitNormal = entry.account.account_type === 'asset' || 
                            entry.account.account_type === 'expense' || 
                            entry.account.code?.startsWith('1') || 
                            entry.account.code?.startsWith('5');
      if (isDebitNormal) {
        return entry.netBalance < -0.01; // Abnormal credit balance
      } else {
        return entry.netBalance > 0.01;  // Abnormal debit balance
      }
    }
    return true;
  }) || [];

  const exportTrialBalance = () => {
    if (!trialBalance || filteredEntries.length === 0) {
      toast.error('No trial balance data to export');
      return;
    }

    const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debitBalance, 0);
    const totalCredits = filteredEntries.reduce((sum, e) => sum + e.creditBalance, 0);
    const diff = Math.abs(totalDebits - totalCredits);

    const rows: (string | number)[][] = [
      [`${businessName} - Trial Balance Report`],
      [`Department: ${selectedDeptName}`],
      [`As of: ${asOfDate}`],
      [`Currency: ${currency}`],
      [],
      ['Account Code', 'Account Name', 'Account Type', `Debit Balance (${currency})`, `Credit Balance (${currency})`, `Net Balance (${currency})`],
      ...filteredEntries.map(entry => [
        entry.account.code,
        `"${entry.account.name.replace(/"/g, '""')}"`,
        entry.account.account_type,
        entry.debitBalance.toFixed(2),
        entry.creditBalance.toFixed(2),
        entry.netBalance.toFixed(2)
      ]),
      [],
      ['TOTALS', '', '', totalDebits.toFixed(2), totalCredits.toFixed(2), diff.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trial_Balance_${selectedDepartment !== 'all' ? selectedDeptName.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}As_Of_${asOfDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Trial balance exported to CSV');
  };

  const printTrialBalance = () => {
    if (!trialBalance || filteredEntries.length === 0) {
      toast.error('No data to print');
      return;
    }

    const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debitBalance, 0);
    const totalCredits = filteredEntries.reduce((sum, e) => sum + e.creditBalance, 0);
    const diff = Math.abs(totalDebits - totalCredits);
    const isBalanced = diff < 0.01;
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trial Balance - ${businessName}</title>
          <style>
            @page { margin: 12mm; size: auto; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 11px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
            .header h2 { margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #475569; }
            .header p { margin: 0; color: #64748b; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; text-align: left; }
            th.right, td.right { text-align: right; }
            td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 11px; }
            tr.totals td { font-weight: 800; background: #0f172a; color: #fff; border-color: #0f172a; font-size: 11.5px; }
            .status-box { text-align: center; margin: 25px 0; padding: 12px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
            .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h1>${businessName}</h1>
            <h2>TRIAL BALANCE REPORT</h2>
            <p>
              Department: <strong>${selectedDeptName}</strong> &bull; 
              As of: <strong>${new Date(asOfDate).toLocaleDateString()}</strong> &bull; 
              Currency: <strong>${currency}</strong> &bull; 
              Active Accounts: <strong>${filteredEntries.length}</strong>
            </p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Account Code</th>
                <th style="width: 35%;">Account Name</th>
                <th style="width: 14%;">Account Type</th>
                <th class="right" style="width: 12%;">Debit (${currency})</th>
                <th class="right" style="width: 12%;">Credit (${currency})</th>
                <th class="right" style="width: 12%;">Net Balance (${currency})</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(entry => `
                <tr>
                  <td><strong>${entry.account.code}</strong></td>
                  <td>${entry.account.name}</td>
                  <td style="text-transform: capitalize;">${entry.account.account_type}</td>
                  <td class="right">${entry.debitBalance > 0 ? `${currency} ${entry.debitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td class="right">${entry.creditBalance > 0 ? `${currency} ${entry.creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td class="right">${currency} ${entry.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="totals">
                <td colspan="3">TOTALS</td>
                <td class="right">${currency} ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="right">${currency} ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="right">${currency} ${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="status-box">
            <p><strong>Status:</strong> ${isBalanced ? 'BALANCED (Debits Equal Credits)' : 'UNBALANCED'}</p>
            <p><strong>Difference:</strong> ${currency} ${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>

          <div class="footer">
            <span>Department: ${selectedDeptName}</span>
            <span>Prepared by: ${user?.name || user?.email || 'System User'}</span>
            <span>Printed on: ${new Date().toLocaleString()}</span>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-sm text-gray-500">
            Audit-grade double-entry closing verification &bull; {businessName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleCleanLegacyTransfers}
            disabled={cleaningUp}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shadow-sm disabled:opacity-50"
            title="Clean legacy 4900/5900 internal transfer accounts and synchronize department attribution"
          >
            {cleaningUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-amber-600" />}
            Scrap Legacy Accounts & Sync Depts
          </button>
          <button
            onClick={printTrialBalance}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
          >
            <Printer className="h-4 w-4 mr-2 text-gray-600" />
            Print / PDF
          </button>
          <button
            onClick={exportTrialBalance}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Department Filter */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
              <Building2 className="w-4 h-4 text-gray-500" />
              <label className="text-xs font-medium text-gray-600">Department:</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-800 outline-none cursor-pointer"
              >
                <option value="all">All Departments (Consolidated)</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* As of Date */}
            <div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Hide Zero Balances Toggle */}
            <label className="flex items-center cursor-pointer text-xs font-semibold text-gray-700 select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="mr-2 rounded text-indigo-600 focus:ring-indigo-500"
              />
              Hide Zero Balances
            </label>

            {/* Abnormal / Unbalanced filter */}
            <label className="flex items-center cursor-pointer text-xs font-semibold text-gray-700 select-none">
              <input
                type="checkbox"
                checked={showUnbalanced}
                onChange={(e) => setShowUnbalanced(e.target.checked)}
                className="mr-2 rounded text-red-600 focus:ring-red-500"
              />
              Show Abnormal Balances Only
            </label>
          </div>
        </div>
      </div>

      {/* Trial Balance KPI Cards */}
      {trialBalance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-xs uppercase font-semibold text-gray-500">Total Debits</p>
                <p className="text-xl font-bold text-blue-600">
                  {currency} {trialBalance.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-xs uppercase font-semibold text-gray-500">Total Credits</p>
                <p className="text-xl font-bold text-green-600">
                  {currency} {trialBalance.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-xs uppercase font-semibold text-gray-500">Difference</p>
                <p className={`text-xl font-bold ${trialBalance.difference < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {currency} {trialBalance.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                trialBalance.difference < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {trialBalance.difference < 0.01 ? '✓' : '✗'}
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-gray-500">Audit Status</p>
                <p className={`text-xl font-bold ${trialBalance.difference < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {trialBalance.difference < 0.01 ? 'Balanced' : 'Unbalanced'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trial Balance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Debit Balance ({currency})
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Credit Balance ({currency})
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Net Balance ({currency})
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map(category => {
                  const categoryEntries = filteredEntries.filter(e => e.account.category_id === category.id);
                  if (categoryEntries.length === 0) return null;

                  return (
                    <React.Fragment key={category.id}>
                      <tr className="bg-gray-50/70">
                        <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                          {category.name}
                        </td>
                      </tr>
                      {categoryEntries.map((entry) => (
                        <tr key={entry.account.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-mono font-medium text-gray-900">
                            {entry.account.code}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900">
                            {entry.account.name}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 capitalize">
                            {entry.account.account_type}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-medium text-blue-700">
                            {entry.debitBalance > 0 ? entry.debitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-medium text-green-700">
                            {entry.creditBalance > 0 ? entry.creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-bold text-gray-900">
                            {entry.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Accounts without categories */}
                {(() => {
                  const uncategorized = filteredEntries.filter(e => !e.account.category_id || !categories.some(c => c.id === e.account.category_id));
                  if (uncategorized.length === 0) return null;

                  return (
                    <>
                      <tr className="bg-gray-50/70">
                        <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Other Accounts
                        </td>
                      </tr>
                      {uncategorized.map((entry) => (
                        <tr key={entry.account.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-mono font-medium text-gray-900">
                            {entry.account.code}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900">
                            {entry.account.name}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 capitalize">
                            {entry.account.account_type}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-medium text-blue-700">
                            {entry.debitBalance > 0 ? entry.debitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-medium text-green-700">
                            {entry.creditBalance > 0 ? entry.creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-bold text-gray-900">
                            {entry.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })()}
              </tbody>
              <tfoot className="bg-gray-100 font-extrabold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm text-gray-900 uppercase">
                    Total Trial Balance
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-blue-800 font-black">
                    {currency} {trialBalance ? trialBalance.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-800 font-black">
                    {currency} {trialBalance ? trialBalance.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-purple-900 font-black">
                    {currency} {trialBalance ? trialBalance.difference.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {filteredEntries.length === 0 && !loading && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trial balance accounts to show</h3>
            <p className="text-gray-500">Uncheck 'Hide Zero Balances' or choose a different department or date.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalance;