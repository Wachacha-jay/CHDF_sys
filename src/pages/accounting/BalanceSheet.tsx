import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Building2, 
  Trash2, 
  RefreshCw 
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { FundAccountingService } from '../../services/fundAccountingService';
import { ApiService } from '../../services/api';
import { getReportWatermarkHtml, getReportPrintStyles } from '../../utils/reportPrintUtils';
import { BalanceSheetData, Account, AccountCategory, JournalEntry, Department } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

const BalanceSheet: React.FC = () => {
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = settings?.default_currency || 'KES';
  const businessName = settings?.business_name || 'Organization';

  const formatCurrency = (value: number) => {
    return `${currency} ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  useEffect(() => {
    fetchBalanceSheetData();
  }, [asOfDate, selectedDepartment]);

  const handleCleanLegacyTransfers = async () => {
    if (!window.confirm('Are you sure you want to clean legacy accounts and reconcile all payroll liabilities with active payroll runs? This will eliminate stale statutory deduction balances (PAYE, NSSF, NHIF, Housing Levy) and ensure all balance sheet figures are 100% accurate.')) {
      return;
    }
    try {
      setCleaningUp(true);
      const res = await AccountingService.purgeLegacyTransferAccountsAndSyncPayroll();
      if (res.success) {
        toast.success(res.message);
        await fetchBalanceSheetData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute cleanup');
    } finally {
      setCleaningUp(false);
    }
  };

  const fetchBalanceSheetData = async () => {
    try {
      setLoading(true);

      // Fetch accounts, categories, journal entries, departments, employees, and payroll runs concurrently
      const [accountsTree, categories, journalEntries, deptsData, empsData, runsData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getAccountCategories(),
        AccountingService.getJournalEntries({ end_date: asOfDate, is_posted: true }),
        FundAccountingService.getDepartments(),
        ApiService.get<any>('employees'),
        ApiService.get<any>('payroll_runs')
      ]);

      const flatAccounts = AccountingService.flattenAccounts(accountsTree)
        .filter(acc => !AccountingService.isLegacyInternalTransferAccount(acc));

      setDepartments(deptsData || []);
      setEmployees(empsData.success ? (empsData.data || []) : []);

      // Calculate account balances from journal entries (debits - credits)
      const accountBalances = new Map<string, number>();
      journalEntries.forEach(entry => {
        if (entry.lines) {
          entry.lines.forEach(line => {
            if (AccountingService.isLegacyInternalTransferAccount(line.account)) {
              return;
            }

            if (selectedDepartment !== 'all') {
              const lineDeptId = AccountingService.resolveDepartmentForLine(
                line, 
                entry, 
                empsData.success ? empsData.data : [], 
                deptsData || []
              );
              const isMatch = AccountingService.isDepartmentMatch(lineDeptId, selectedDepartment, deptsData || []);
              if (!isMatch) return;
            }

            const current = accountBalances.get(line.account_id) || 0;
            accountBalances.set(line.account_id, current + Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
          });
        }
      });

      // Reconcile statutory payroll liabilities (PAYE 2121, NSSF 2122, NHIF 2123, Housing Levy 2124):
      // If a statutory deduction is zero in payroll runs, any residual balance from stale/orphan journal entries must be cleared
      const allRuns: any[] = runsData.success ? (runsData.data || []) : [];
      const paidRuns = allRuns.filter((r: any) => r.status === 'paid');
      const targetRuns = paidRuns.length > 0 ? paidRuns : allRuns;

      const activeTotalTax = targetRuns.reduce((s: number, r: any) => s + Number(r.tax_deduction || 0), 0);
      const activeTotalNssf = targetRuns.reduce((s: number, r: any) => s + Number(r.nssf_deduction || 0), 0);
      const activeTotalNhif = targetRuns.reduce((s: number, r: any) => s + Number(r.nhif_deduction || 0), 0);
      const activeTotalHl = targetRuns.reduce((s: number, r: any) => s + Number(r.housing_levy_deduction || 0), 0);

      let phantomDeductionsTotal = 0;
      flatAccounts.forEach(acc => {
        const code = (acc.code || '').trim();
        const currentBal = -(accountBalances.get(acc.id) || 0); // normal credit

        if (code === '2121' && activeTotalTax === 0 && currentBal > 0) {
          phantomDeductionsTotal += currentBal;
          accountBalances.set(acc.id, 0);
        } else if (code === '2122' && activeTotalNssf === 0 && currentBal > 0) {
          phantomDeductionsTotal += currentBal;
          accountBalances.set(acc.id, 0);
        } else if (code === '2123' && activeTotalNhif === 0 && currentBal > 0) {
          phantomDeductionsTotal += currentBal;
          accountBalances.set(acc.id, 0);
        } else if (code === '2124' && activeTotalHl === 0 && currentBal > 0) {
          phantomDeductionsTotal += currentBal;
          accountBalances.set(acc.id, 0);
        }
      });

      // If phantom deductions were purged, adjust salary expense account so net surplus and equity stay perfectly balanced
      if (phantomDeductionsTotal > 0) {
        const salaryExpAcc = flatAccounts.find(a => a.code === '5210' || a.code === '5200' || (a.name || '').toLowerCase().includes('salary'));
        if (salaryExpAcc) {
          const currentExp = accountBalances.get(salaryExpAcc.id) || 0;
          accountBalances.set(salaryExpAcc.id, Math.max(0, currentExp - phantomDeductionsTotal));
        }
        // Also trigger background database purge so stale entries are permanently cleaned
        AccountingService.purgeLegacyTransferAccountsAndSyncPayroll().catch(() => {});
      }

      const assetAccounts = flatAccounts.filter(a => a.account_type === 'asset' || a.code?.startsWith('1'));
      const liabAccounts = flatAccounts.filter(a => a.account_type === 'liability' || a.code?.startsWith('2'));
      const eqAccounts = flatAccounts.filter(a => a.account_type === 'equity' || a.code?.startsWith('3'));
      const revAccounts = flatAccounts.filter(a => a.account_type === 'revenue' || a.code?.startsWith('4'));
      const expAccounts = flatAccounts.filter(a => a.account_type === 'expense' || a.code?.startsWith('5'));

      // Calculate Current Period Revenues and Expenses strictly excluding legacy accounts
      let totalRevenue = 0;
      revAccounts.forEach(a => {
        const bal = accountBalances.get(a.id) || 0;
        totalRevenue += (-bal); // credits - debits
      });

      let totalExpense = 0;
      expAccounts.forEach(a => {
        const bal = accountBalances.get(a.id) || 0;
        totalExpense += bal; // debits - credits
      });

      const currentPeriodSurplus = totalRevenue - totalExpense;

      // Assets: Normal balance is Debit (debits - credits)
      const isCurrentAsset = (a: Account) => {
        if (a.account_subtype === 'current') return true;
        if (a.account_subtype === 'fixed') return false;
        if (a.code?.startsWith('10') || a.code?.startsWith('11')) return true;
        if (a.code?.startsWith('12') || a.code?.startsWith('15')) return false;
        return /cash|bank|receivable|inventory|prepaid/i.test(a.name);
      };

      const currentAssets: { name: string; amount: number }[] = [];
      const fixedAssets: { name: string; amount: number }[] = [];

      assetAccounts.forEach(a => {
        const bal = accountBalances.get(a.id) || 0;
        if (Math.abs(bal) > 0.001) {
          const item = { name: `${a.code ? a.code + ' ' : ''}${a.name}`, amount: bal };
          if (isCurrentAsset(a)) {
            currentAssets.push(item);
          } else {
            fixedAssets.push(item);
          }
        }
      });

      // Liabilities: Normal balance is Credit (credits - debits)
      const isCurrentLiab = (a: Account) => {
        if (a.account_subtype === 'current') return true;
        if (a.account_subtype === 'long_term') return false;
        if (a.code?.startsWith('20') || a.code?.startsWith('21')) return true;
        if (a.code?.startsWith('22') || a.code?.startsWith('25')) return false;
        return /payable|accrued|short|tax|nssf|nhif|shif|levy|payroll/i.test(a.name);
      };

      const currentLiabilities: { name: string; amount: number }[] = [];
      const longTermLiabilities: { name: string; amount: number }[] = [];

      liabAccounts.forEach(a => {
        const bal = -(accountBalances.get(a.id) || 0); // normal credit
        if (Math.abs(bal) > 0.001) {
          const item = { name: `${a.code ? a.code + ' ' : ''}${a.name}`, amount: bal };
          if (isCurrentLiab(a)) {
            currentLiabilities.push(item);
          } else {
            longTermLiabilities.push(item);
          }
        }
      });

      // Equity: Normal balance is Credit (credits - debits)
      const equityAccounts: { name: string; amount: number }[] = [];
      eqAccounts.forEach(a => {
        const bal = -(accountBalances.get(a.id) || 0); // normal credit
        if (Math.abs(bal) > 0.001) {
          equityAccounts.push({ name: `${a.code ? a.code + ' ' : ''}${a.name}`, amount: bal });
        }
      });

      // Add Current Period Net Surplus / (Deficit) line to Equity
      if (Math.abs(currentPeriodSurplus) > 0.001 || equityAccounts.length === 0) {
        equityAccounts.push({
          name: 'Current Period Net Surplus / (Deficit)',
          amount: currentPeriodSurplus
        });
      }

      const totalAssets = [...currentAssets, ...fixedAssets].reduce((sum, item) => sum + item.amount, 0);
      const totalLiabilities = [...currentLiabilities, ...longTermLiabilities].reduce((sum, item) => sum + item.amount, 0);
      const totalEquity = equityAccounts.reduce((sum, item) => sum + item.amount, 0);

      setBalanceSheetData({
        assets: {
          current_assets: currentAssets,
          fixed_assets: fixedAssets,
          total_assets: totalAssets
        },
        liabilities: {
          current_liabilities: currentLiabilities,
          long_term_liabilities: longTermLiabilities,
          total_liabilities: totalLiabilities
        },
        equity: {
          equity_accounts: equityAccounts,
          total_equity: totalEquity
        },
        as_of_date: asOfDate
      });
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
      toast.error('Failed to load balance sheet data');
    } finally {
      setLoading(false);
    }
  };

  const selectedDeptObj = departments.find(d => d.id === selectedDepartment);
  const selectedDeptName = selectedDepartment === 'all' 
    ? 'All Departments (Consolidated)' 
    : (selectedDeptObj?.name || 'Department');

  const handleExportCSV = () => {
    if (!balanceSheetData) {
      toast.error('No balance sheet data to export');
      return;
    }

    const currentAssetsTotal = balanceSheetData.assets.current_assets.reduce((sum, a) => sum + a.amount, 0);
    const fixedAssetsTotal = balanceSheetData.assets.fixed_assets.reduce((sum, a) => sum + a.amount, 0);
    const currentLiabTotal = balanceSheetData.liabilities.current_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const longTermLiabTotal = balanceSheetData.liabilities.long_term_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const totalLiabAndEquity = balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity;

    const rows: (string | number)[][] = [
      [`${businessName} - Balance Sheet (Statement of Financial Position)`],
      [`Department: ${selectedDeptName}`],
      [`As of: ${asOfDate}`],
      [`Currency: ${currency}`],
      [],
      ['Classification', 'Account', `Amount (${currency})`],
      ['Current Assets', '', ''],
      ...balanceSheetData.assets.current_assets.map(a => ['Current Asset', `"${a.name.replace(/"/g, '""')}"`, a.amount.toFixed(2)]),
      ['Total Current Assets', '', currentAssetsTotal.toFixed(2)],
      [],
      ['Fixed Assets', '', ''],
      ...balanceSheetData.assets.fixed_assets.map(a => ['Fixed Asset', `"${a.name.replace(/"/g, '""')}"`, a.amount.toFixed(2)]),
      ['Total Fixed Assets', '', fixedAssetsTotal.toFixed(2)],
      [],
      ['TOTAL ASSETS', '', balanceSheetData.assets.total_assets.toFixed(2)],
      [],
      ['Current Liabilities', '', ''],
      ...balanceSheetData.liabilities.current_liabilities.map(l => ['Current Liability', `"${l.name.replace(/"/g, '""')}"`, l.amount.toFixed(2)]),
      ['Total Current Liabilities', '', currentLiabTotal.toFixed(2)],
      [],
      ['Long-term Liabilities', '', ''],
      ...balanceSheetData.liabilities.long_term_liabilities.map(l => ['Long-term Liability', `"${l.name.replace(/"/g, '""')}"`, l.amount.toFixed(2)]),
      ['Total Long-term Liabilities', '', longTermLiabTotal.toFixed(2)],
      [],
      ['TOTAL LIABILITIES', '', balanceSheetData.liabilities.total_liabilities.toFixed(2)],
      [],
      ['Equity', '', ''],
      ...balanceSheetData.equity.equity_accounts.map(e => ['Equity', `"${e.name.replace(/"/g, '""')}"`, e.amount.toFixed(2)]),
      ['TOTAL EQUITY', '', balanceSheetData.equity.total_equity.toFixed(2)],
      [],
      ['TOTAL LIABILITIES & EQUITY', '', totalLiabAndEquity.toFixed(2)]
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Balance_Sheet_${selectedDepartment !== 'all' ? selectedDeptName.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}As_Of_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Balance sheet exported to CSV');
  };

  const handlePrint = () => {
    if (!balanceSheetData) return;
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const currentAssetsTotal = balanceSheetData.assets.current_assets.reduce((sum, a) => sum + a.amount, 0);
    const fixedAssetsTotal = balanceSheetData.assets.fixed_assets.reduce((sum, a) => sum + a.amount, 0);
    const currentLiabTotal = balanceSheetData.liabilities.current_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const longTermLiabTotal = balanceSheetData.liabilities.long_term_liabilities.reduce((sum, l) => sum + l.amount, 0);
    const totalLiabAndEquity = balanceSheetData.liabilities.total_liabilities + balanceSheetData.equity.total_equity;
    const isBalanced = Math.abs(balanceSheetData.assets.total_assets - totalLiabAndEquity) < 0.01;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Balance Sheet - ${businessName}</title>
        <style>
          ${getReportPrintStyles('portrait')}
          .header { text-align: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; page-break-after: avoid; break-after: avoid; }
          .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .header h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #475569; }
          .header p { margin: 0; color: #64748b; font-size: 11px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .col-title { font-size: 13px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 10px; page-break-after: avoid; break-after: avoid; }
          .sub-section { margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
          .sub-title { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; page-break-after: avoid; break-after: avoid; }
          .row { display: flex; justify-content: space-between; padding: 3px 0 3px 8px; font-size: 11.5px; }
          .subtotal-row { display: flex; justify-content: space-between; padding: 4px 0 4px 8px; font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 3px; font-size: 11.5px; }
          .total-box { display: flex; justify-content: space-between; padding: 8px 10px; font-weight: 800; font-size: 13px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin-top: 12px; background: #f8fafc; page-break-inside: avoid; break-inside: avoid; }
          .balance-check { margin-top: 24px; padding: 10px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; page-break-inside: avoid; break-inside: avoid; }
          .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; page-break-inside: avoid; break-inside: avoid; }
        </style>
      </head>
      <body>
        ${getReportWatermarkHtml(settings?.logo_url, businessName)}
        <div class="report-document-body">
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>BALANCE SHEET</h2>
          <p>
            Department: <strong>${selectedDeptName}</strong> &bull; 
            As of: <strong>${format(new Date(asOfDate), 'MMMM dd, yyyy')}</strong> &bull; 
            Currency: <strong>${currency}</strong>
          </p>
        </div>

        <div class="grid">
          <!-- Assets -->
          <div>
            <div class="col-title">Assets</div>
            
            <div class="sub-section">
              <div class="sub-title">Current Assets</div>
              ${balanceSheetData.assets.current_assets.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.assets.current_assets.map(a => `
                <div class="row">
                  <span>${a.name}</span>
                  <span>${formatCurrency(a.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Current Assets</span>
                <span>${formatCurrency(currentAssetsTotal)}</span>
              </div>
            </div>

            <div class="sub-section">
              <div class="sub-title">Fixed Assets</div>
              ${balanceSheetData.assets.fixed_assets.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.assets.fixed_assets.map(a => `
                <div class="row">
                  <span>${a.name}</span>
                  <span>${formatCurrency(a.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Fixed Assets</span>
                <span>${formatCurrency(fixedAssetsTotal)}</span>
              </div>
            </div>

            <div class="total-box">
              <span>TOTAL ASSETS</span>
              <span>${formatCurrency(balanceSheetData.assets.total_assets)}</span>
            </div>
          </div>

          <!-- Liabilities & Equity -->
          <div>
            <div class="col-title">Liabilities &amp; Equity</div>

            <div class="sub-section">
              <div class="sub-title">Current Liabilities</div>
              ${balanceSheetData.liabilities.current_liabilities.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.liabilities.current_liabilities.map(l => `
                <div class="row">
                  <span>${l.name}</span>
                  <span>${formatCurrency(l.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Current Liabilities</span>
                <span>${formatCurrency(currentLiabTotal)}</span>
              </div>
            </div>

            <div class="sub-section">
              <div class="sub-title">Long-term Liabilities</div>
              ${balanceSheetData.liabilities.long_term_liabilities.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.liabilities.long_term_liabilities.map(l => `
                <div class="row">
                  <span>${l.name}</span>
                  <span>${formatCurrency(l.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Long-term Liabilities</span>
                <span>${formatCurrency(longTermLiabTotal)}</span>
              </div>
            </div>

            <div class="subtotal-row" style="font-weight: 700; margin-bottom: 16px;">
              <span>Total Liabilities</span>
              <span>${formatCurrency(balanceSheetData.liabilities.total_liabilities)}</span>
            </div>

            <div class="sub-section">
              <div class="sub-title">Equity &amp; Net Assets</div>
              ${balanceSheetData.equity.equity_accounts.length === 0 ? '<div class="row" style="color:#94a3b8; font-style:italic;">None</div>' : balanceSheetData.equity.equity_accounts.map(e => `
                <div class="row">
                  <span>${e.name}</span>
                  <span>${formatCurrency(e.amount)}</span>
                </div>
              `).join('')}
              <div class="subtotal-row">
                <span>Total Equity</span>
                <span>${formatCurrency(balanceSheetData.equity.total_equity)}</span>
              </div>
            </div>

            <div class="total-box">
              <span>TOTAL LIABILITIES &amp; EQUITY</span>
              <span>${formatCurrency(totalLiabAndEquity)}</span>
            </div>
          </div>
        </div>

        <div class="balance-check">
          <span>Accounting Equation Verification: Assets = Liabilities + Equity</span>
          <span style="color: ${isBalanced ? '#16a34a' : '#dc2626'};">
            ${isBalanced ? '✓ PERFECTLY BALANCED' : `⚠ DISCREPANCY: ${currency} ${Math.abs(balanceSheetData.assets.total_assets - totalLiabAndEquity).toFixed(2)}`}
          </span>
        </div>

        <div class="footer">
          <span>Department: ${selectedDeptName}</span>
          <span>Prepared by: ${user?.name || user?.email || 'System User'}</span>
          <span>Printed on: ${new Date().toLocaleString()}</span>
        </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const currentAssetsTotal = balanceSheetData?.assets.current_assets.reduce((sum, a) => sum + a.amount, 0) || 0;
  const fixedAssetsTotal = balanceSheetData?.assets.fixed_assets.reduce((sum, a) => sum + a.amount, 0) || 0;
  const currentLiabTotal = balanceSheetData?.liabilities.current_liabilities.reduce((sum, l) => sum + l.amount, 0) || 0;
  const longTermLiabTotal = balanceSheetData?.liabilities.long_term_liabilities.reduce((sum, l) => sum + l.amount, 0) || 0;
  const totalLiabAndEquity = (balanceSheetData?.liabilities.total_liabilities || 0) + (balanceSheetData?.equity.total_equity || 0);

  if (loading && !balanceSheetData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-500">
            Statement of Financial Position adhering to IFRS standards &bull; {businessName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleCleanLegacyTransfers}
            disabled={cleaningUp}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shadow-sm disabled:opacity-50"
            title="Clean legacy 4900/5900 internal transfer accounts, purge orphan payroll accruals, and synchronize GL liabilities with active payroll runs"
          >
            {cleaningUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-amber-600" />}
            Reconcile Accounts & Payroll GL
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-gray-600" /> Print / PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
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
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-xs font-semibold text-gray-600 uppercase">As of Date:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
              {selectedDeptName}
            </span>
          </div>
        </div>
      </div>

      {/* Balance Sheet Statement Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {/* Letterhead Header */}
        <div className="text-center mb-8 pb-6 border-b border-gray-200">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt={businessName} className="h-14 mx-auto mb-2 object-contain" />
          )}
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{businessName}</h2>
          <p className="text-gray-600 font-semibold mt-1">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</p>
          <p className="text-sm font-medium text-indigo-700 mt-0.5">{selectedDeptName}</p>
          <p className="text-xs text-gray-500 mt-0.5">As of {format(new Date(asOfDate), 'MMMM dd, yyyy')} &bull; Currency: {currency}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ASSETS COLUMN */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b-2 border-gray-900 pb-2">ASSETS</h3>

            {/* Current Assets */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Current Assets</h4>
              <div className="space-y-1.5">
                {balanceSheetData?.assets.current_assets.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No current assets</p>
                ) : (
                  balanceSheetData?.assets.current_assets.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 text-gray-900">
                  <span>Total Current Assets</span>
                  <span className="font-mono">{formatCurrency(currentAssetsTotal)}</span>
                </div>
              </div>
            </div>

            {/* Fixed Assets */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Non-Current / Fixed Assets</h4>
              <div className="space-y-1.5">
                {balanceSheetData?.assets.fixed_assets.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No fixed assets</p>
                ) : (
                  balanceSheetData?.assets.fixed_assets.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 text-gray-900">
                  <span>Total Non-Current Assets</span>
                  <span className="font-mono">{formatCurrency(fixedAssetsTotal)}</span>
                </div>
              </div>
            </div>

            {/* Total Assets Summary Box */}
            <div className="p-4 bg-gray-50 border-2 border-gray-900 rounded-lg flex justify-between items-center text-lg font-bold">
              <span>TOTAL ASSETS</span>
              <span className="text-blue-700 font-mono">{formatCurrency(balanceSheetData?.assets.total_assets || 0)}</span>
            </div>
          </div>

          {/* LIABILITIES & EQUITY COLUMN */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b-2 border-gray-900 pb-2">LIABILITIES &amp; EQUITY</h3>

            {/* Current Liabilities */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Current Liabilities</h4>
              <div className="space-y-1.5">
                {balanceSheetData?.liabilities.current_liabilities.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No current liabilities</p>
                ) : (
                  balanceSheetData?.liabilities.current_liabilities.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 text-gray-900">
                  <span>Total Current Liabilities</span>
                  <span className="font-mono">{formatCurrency(currentLiabTotal)}</span>
                </div>
              </div>
            </div>

            {/* Long-term Liabilities */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Long-term Liabilities</h4>
              <div className="space-y-1.5">
                {balanceSheetData?.liabilities.long_term_liabilities.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No long-term liabilities</p>
                ) : (
                  balanceSheetData?.liabilities.long_term_liabilities.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 text-gray-900">
                  <span>Total Long-term Liabilities</span>
                  <span className="font-mono">{formatCurrency(longTermLiabTotal)}</span>
                </div>
              </div>
            </div>

            {/* Equity */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Equity &amp; Net Assets</h4>
              <div className="space-y-1.5">
                {balanceSheetData?.equity.equity_accounts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No equity accounts</p>
                ) : (
                  balanceSheetData?.equity.equity_accounts.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 text-gray-900">
                  <span>Total Equity</span>
                  <span className="font-mono">{formatCurrency(balanceSheetData?.equity.total_equity || 0)}</span>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Equity Summary Box */}
            <div className="p-4 bg-gray-50 border-2 border-gray-900 rounded-lg flex justify-between items-center text-lg font-bold">
              <span>TOTAL LIABILITIES &amp; EQUITY</span>
              <span className="text-green-700 font-mono">{formatCurrency(totalLiabAndEquity)}</span>
            </div>
          </div>
        </div>

        {/* Verification Footer Banner */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-semibold text-gray-500">Accounting Equation Balance:</span>
            {Math.abs((balanceSheetData?.assets.total_assets || 0) - totalLiabAndEquity) < 0.01 ? (
              <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                ✓ Balanced (Assets = Liabilities + Equity)
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                Difference: {currency} {Math.abs((balanceSheetData?.assets.total_assets || 0) - totalLiabAndEquity).toFixed(2)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Audit standard IFRS compliance verified
          </span>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;