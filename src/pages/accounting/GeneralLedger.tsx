import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Printer, 
  FileSpreadsheet, 
  RotateCcw,
  Building2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { FundAccountingService } from '../../services/fundAccountingService';
import { ApiService } from '../../services/api';
import { getReportWatermarkHtml, getReportPrintStyles } from '../../utils/reportPrintUtils';
import { JournalEntry, Account, Department, JournalEntryLine } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import JournalEntryModal from '../../components/accounting/JournalEntryModal';
import { usePagination } from '../../hooks/usePagination';
import DataTablePagination from '../../components/common/DataTablePagination';

const GeneralLedger: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);

  const businessName = settings?.business_name || 'Organization';
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') ? settings.default_currency : 'KES';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [accountsData, entriesData, deptsData, empsData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getJournalEntries(),
        FundAccountingService.getDepartments(),
        ApiService.get<any>('employees')
      ]);

      const flatAccounts = AccountingService.flattenAccounts(accountsData || [])
        .filter(acc => !AccountingService.isLegacyInternalTransferAccount(acc));

      setAccounts(flatAccounts);
      setEntries(entriesData || []);
      setDepartments(deptsData || []);
      setEmployees(empsData.success ? (empsData.data || []) : []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanLegacyTransfers = async () => {
    if (!window.confirm('Are you sure you want to permanently scrap legacy internal transfer accounts (4900, 5900) and sync all historical payroll lines to their departments? This action aligns your reports with IFRS standards.')) {
      return;
    }
    try {
      setCleaningUp(true);
      const res = await AccountingService.purgeLegacyTransferAccountsAndSyncPayroll();
      if (res.success) {
        toast.success(res.message);
        await fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute cleanup');
    } finally {
      setCleaningUp(false);
    }
  };

  const selectedAccountObj = accounts.find(a => a.id === selectedAccount);
  const selectedDeptObj = departments.find(d => d.id === selectedDepartment);
  const selectedDeptName = selectedDepartment === 'all' ? 'All Departments (Consolidated)' : (selectedDeptObj?.name || 'Department');

  // Account normal balance check:
  // Asset (1xxx) & Expense (5xxx): normal balance is Debit (DR)
  // Liability (2xxx), Equity (3xxx), Revenue (4xxx): normal balance is Credit (CR)
  const isDebitNormal = (acc?: Account) => {
    if (!acc) return true;
    const type = (acc.account_type || '').toLowerCase();
    const code = (acc.code || '').trim();
    if (type === 'asset' || type === 'expense' || code.startsWith('1') || code.startsWith('5')) {
      return true;
    }
    return false;
  };

  // Helper to resolve department for any line
  const getLineDeptId = (line: JournalEntryLine, entry: JournalEntry): string | undefined => {
    return AccountingService.resolveDepartmentForLine(line, entry, employees, departments);
  };

  const isLineInSelectedDept = (line: JournalEntryLine, entry: JournalEntry): boolean => {
    if (selectedDepartment === 'all') return true;
    const lineDeptId = getLineDeptId(line, entry);
    return AccountingService.isDepartmentMatch(lineDeptId, selectedDepartment, departments);
  };

  // Opening Balance calculation for selected account prior to dateFrom
  const calculateOpeningBalance = (): number => {
    if (!selectedAccount || !dateFrom) return 0;
    let balance = 0;
    const debitNormal = isDebitNormal(selectedAccountObj);

    entries.forEach(entry => {
      const entryDate = String(entry.entry_date || '').slice(0, 10);
      if (entryDate < dateFrom && entry.is_posted) {
        entry.lines?.forEach(line => {
          if (line.account_id === selectedAccount && isLineInSelectedDept(line, entry)) {
            const dr = Number(line.debit_amount || 0);
            const cr = Number(line.credit_amount || 0);
            if (debitNormal) {
              balance += (dr - cr);
            } else {
              balance += (cr - dr);
            }
          }
        });
      }
    });

    return balance;
  };

  const openingBalance = calculateOpeningBalance();

  // Filter entries for the report period and criteria
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchTerm || 
      (entry.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.entry_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.reference || '').toLowerCase().includes(searchTerm.toLowerCase());

    const entryDate = String(entry.entry_date || '').slice(0, 10);
    const matchesDateFrom = !dateFrom || entryDate >= dateFrom;
    const matchesDateTo = !dateTo || entryDate <= dateTo;

    // Must match account if account selected
    const matchesAccount = !selectedAccount ||
      entry.lines?.some(line => line.account_id === selectedAccount);

    // Must match department if department selected
    const matchesDepartment = selectedDepartment === 'all' ||
      entry.lines?.some(line => isLineInSelectedDept(line, entry));

    return matchesSearch && matchesAccount && matchesDateFrom && matchesDateTo && matchesDepartment;
  });

  // Calculate totals
  const totalDebits = filteredEntries.reduce((sum, entry) => {
    if (selectedAccount) {
      const lineDebits = entry.lines
        ?.filter(l => l.account_id === selectedAccount && isLineInSelectedDept(l, entry))
        .reduce((s, l) => s + Number(l.debit_amount || 0), 0) || 0;
      return sum + lineDebits;
    }
    const filteredLines = entry.lines?.filter(l => isLineInSelectedDept(l, entry)) || [];
    return sum + filteredLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
  }, 0);

  const totalCredits = filteredEntries.reduce((sum, entry) => {
    if (selectedAccount) {
      const lineCredits = entry.lines
        ?.filter(l => l.account_id === selectedAccount && isLineInSelectedDept(l, entry))
        .reduce((s, l) => s + Number(l.credit_amount || 0), 0) || 0;
      return sum + lineCredits;
    }
    const filteredLines = entry.lines?.filter(l => isLineInSelectedDept(l, entry)) || [];
    return sum + filteredLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
  }, 0);

  const debitNormal = isDebitNormal(selectedAccountObj);
  const closingBalance = selectedAccount 
    ? (debitNormal ? (openingBalance + totalDebits - totalCredits) : (openingBalance + totalCredits - totalDebits))
    : 0;

  const setDatePreset = (preset: 'this_month' | 'this_year' | 'last_30' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setDateFrom(start);
      setDateTo(todayStr);
    } else if (preset === 'this_year') {
      setDateFrom(`${today.getFullYear()}-01-01`);
      setDateTo(todayStr);
    } else if (preset === 'last_30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedAccount('');
    setSelectedDepartment('all');
    setDateFrom(`${currentYear}-01-01`);
    setDateTo(new Date().toISOString().split('T')[0]);
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('No journal entries to export');
      return;
    }

    const rows: (string | number)[][] = [
      [`${businessName} - General Ledger Report`],
      [`Department: ${selectedDeptName}`],
      [`Account: ${selectedAccountObj ? `${selectedAccountObj.code} - ${selectedAccountObj.name}` : 'All Accounts'}`],
      [`Period: ${dateFrom || 'Beginning'} to ${dateTo || 'Present'}`],
      [`Currency: ${currency}`],
      []
    ];

    if (selectedAccount) {
      rows.push(['OPENING BALANCE', '', '', '', '', '', '', '', (debitNormal ? (openingBalance >= 0 ? openingBalance.toFixed(2) : `(${Math.abs(openingBalance).toFixed(2)})`) : (openingBalance >= 0 ? openingBalance.toFixed(2) : `(${Math.abs(openingBalance).toFixed(2)})`))]);
      rows.push([]);
    }

    rows.push(['Entry Number', 'Date', 'Reference', 'Entry Description', 'Account Code', 'Account Name', 'Line Memo', 'Department', `Debit (${currency})`, `Credit (${currency})`, ...(selectedAccount ? [`Running Balance (${currency})`] : []), 'Status']);

    let currentRunning = openingBalance;

    // Sort entries chronologically for running balance
    const sortedEntries = [...filteredEntries].sort((a, b) => 
      String(a.entry_date || '').localeCompare(String(b.entry_date || ''))
    );

    sortedEntries.forEach(entry => {
      const dateStr = String(entry.entry_date || '').slice(0, 10);
      const status = entry.is_posted ? 'Posted' : 'Draft';
      const ref = `"${(entry.reference || '').replace(/"/g, '""')}"`;
      const desc = `"${(entry.description || '').replace(/"/g, '""')}"`;

      const validLines = (entry.lines || []).filter(line => {
        if (selectedAccount && line.account_id !== selectedAccount) return false;
        return isLineInSelectedDept(line, entry);
      });

      validLines.forEach(line => {
        const accCode = line.account?.code || '';
        const accName = `"${(line.account?.name || '').replace(/"/g, '""')}"`;
        const lineMemo = `"${(line.description || '').replace(/"/g, '""')}"`;
        const lineDeptId = getLineDeptId(line, entry);
        const deptName = departments.find(d => d.id === lineDeptId)?.name || 'General';

        const dr = Number(line.debit_amount || 0);
        const cr = Number(line.credit_amount || 0);

        if (selectedAccount) {
          if (debitNormal) {
            currentRunning += (dr - cr);
          } else {
            currentRunning += (cr - dr);
          }
        }

        rows.push([
          entry.entry_number,
          dateStr,
          ref,
          desc,
          accCode,
          accName,
          lineMemo,
          `"${deptName}"`,
          dr.toFixed(2),
          cr.toFixed(2),
          ...(selectedAccount ? [currentRunning.toFixed(2)] : []),
          status
        ]);
      });
    });

    rows.push([]);
    rows.push([
      'TOTALS / CLOSING', 
      '', '', '', '', '', '', '', 
      totalDebits.toFixed(2), 
      totalCredits.toFixed(2), 
      ...(selectedAccount ? [closingBalance.toFixed(2)] : []), 
      ''
    ]);

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `General_Ledger_${selectedDepartment !== 'all' ? selectedDeptName.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${dateFrom || 'start'}_to_${dateTo || 'end'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('General ledger exported to CSV');
  };

  const handlePrint = () => {
    if (filteredEntries.length === 0) {
      toast.error('No entries to print');
      return;
    }
    const logoHtml = settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height: 55px; margin-bottom: 8px; object-fit: contain;" />` : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    let runningBal = openingBalance;
    const sortedEntries = [...filteredEntries].sort((a, b) => 
      String(a.entry_date || '').localeCompare(String(b.entry_date || ''))
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>General Ledger - ${businessName}</title>
        <style>
          ${getReportPrintStyles('landscape')}
          .header { text-align: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; page-break-after: avoid; break-after: avoid; }
          .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
          .header h2 { margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #475569; }
          .header p { margin: 0; color: #64748b; font-size: 10.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; text-align: left; }
          th.right, td.right { text-align: right; }
          th.center, td.center { text-align: center; }
          td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 10.5px; }
          tr.entry-header { background: #f8fafc; font-weight: 600; }
          tr.line-item td { color: #475569; font-size: 10.5px; }
          tr.totals-row td { font-weight: 800; background: #0f172a; color: #fff; border-color: #0f172a; font-size: 11.5px; }
          .badge { display: inline-block; padding: 2px 5px; font-size: 9px; font-weight: 600; border-radius: 4px; background: #e2e8f0; color: #334155; }
          .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; page-break-inside: avoid; break-inside: avoid; }
        </style>
      </head>
      <body>
        ${getReportWatermarkHtml(settings?.logo_url, businessName)}
        <div class="report-document-body">
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>GENERAL LEDGER REPORT</h2>
          <p>
            Department: <strong>${selectedDeptName}</strong> &bull; 
            Account: <strong>${selectedAccountObj ? `${selectedAccountObj.code} - ${selectedAccountObj.name}` : 'All Accounts'}</strong><br/>
            Period: <strong>${dateFrom || 'Beginning'}</strong> to <strong>${dateTo || 'Present'}</strong> &bull; 
            Currency: <strong>${currency}</strong>
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Entry / Date</th>
              <th style="width: 14%;">Reference</th>
              <th style="width: 32%;">Account & Description</th>
              <th style="width: 12%;">Department</th>
              <th class="right" style="width: 15%;">Debit (${currency})</th>
              <th class="right" style="width: 15%;">Credit (${currency})</th>
              ${selectedAccount ? `<th class="right" style="width: 15%;">Balance (${currency})</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${selectedAccount ? `
              <tr style="background: #eef2ff; font-weight: 700;">
                <td colspan="4"><strong>OPENING BALANCE (As of ${dateFrom || 'Start'})</strong></td>
                <td class="right">—</td>
                <td class="right">—</td>
                <td class="right"><strong>${currency} ${openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            ` : ''}
            ${sortedEntries.map(entry => {
              const entryDate = String(entry.entry_date || '').slice(0, 10);
              const validLines = (entry.lines || []).filter(line => {
                if (selectedAccount && line.account_id !== selectedAccount) return false;
                return isLineInSelectedDept(line, entry);
              });

              if (validLines.length === 0) return '';

              return validLines.map(line => {
                const lineDeptId = getLineDeptId(line, entry);
                const deptName = departments.find(d => d.id === lineDeptId)?.name || 'General';
                const dr = Number(line.debit_amount || 0);
                const cr = Number(line.credit_amount || 0);

                if (selectedAccount) {
                  if (debitNormal) {
                    runningBal += (dr - cr);
                  } else {
                    runningBal += (cr - dr);
                  }
                }

                return `
                  <tr class="line-item">
                    <td><strong>${entry.entry_number}</strong><br/><span style="color:#64748b; font-size:9.5px;">${entryDate}</span></td>
                    <td>${entry.reference || '—'}</td>
                    <td>
                      <strong>${line.account?.code || ''}</strong> - ${line.account?.name || ''}
                      <div style="font-size:9.5px; color:#475569;">${line.description || entry.description || ''}</div>
                    </td>
                    <td><span class="badge">${deptName}</span></td>
                    <td class="right">${dr > 0 ? `${currency} ${dr.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td class="right">${cr > 0 ? `${currency} ${cr.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                    ${selectedAccount ? `<td class="right font-bold">${currency} ${runningBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>` : ''}
                  </tr>
                `;
              }).join('');
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="4">TOTALS / CLOSING BALANCE</td>
              <td class="right">${currency} ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${currency} ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              ${selectedAccount ? `<td class="right">${currency} ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>` : ''}
            </tr>
          </tfoot>
        </table>

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

  // Build sorted flat list of active lines with exact running balance for the UI table
  const allLedgerRows = useMemo(() => {
    const rows: {
      key: string;
      entry: JournalEntry;
      line: JournalEntryLine;
      entryDate: string;
      deptName: string;
      dr: number;
      cr: number;
      runningBalance: number;
    }[] = [];

    let runningBal = openingBalance;
    const sorted = [...filteredEntries].sort((a, b) => 
      String(a.entry_date || '').localeCompare(String(b.entry_date || ''))
    );

    sorted.forEach((entry) => {
      const entryDate = String(entry.entry_date || '').slice(0, 10);
      const validLines = (entry.lines || []).filter(line => {
        if (selectedAccount && line.account_id !== selectedAccount) return false;
        return isLineInSelectedDept(line, entry);
      });

      validLines.forEach((line) => {
        const lineDeptId = getLineDeptId(line, entry);
        const deptName = departments.find(d => d.id === lineDeptId)?.name || 'General';
        const dr = Number(line.debit_amount || 0);
        const cr = Number(line.credit_amount || 0);

        if (selectedAccount) {
          if (debitNormal) {
            runningBal += (dr - cr);
          } else {
            runningBal += (cr - dr);
          }
        }

        rows.push({
          key: `${entry.id}-${line.id}`,
          entry,
          line,
          entryDate,
          deptName,
          dr,
          cr,
          runningBalance: runningBal
        });
      });
    });

    return rows;
  }, [filteredEntries, openingBalance, selectedAccount, debitNormal, departments, selectedDepartment, employees]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedData: paginatedLedgerRows,
    goToPage,
    setPageSize
  } = usePagination({
    data: allLedgerRows,
    initialPageSize: 25,
    resetDependencies: [selectedAccount, selectedDepartment, dateFrom, dateTo, searchTerm]
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-500">
            Audit-grade double-entry general ledger with departmental running balances &bull; {businessName}
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
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Department Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-gray-500" /> Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="all">All Departments (Consolidated)</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Entry #, description, ref..."
              />
            </div>
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Date Presets & Reset */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 uppercase font-semibold mr-1">Presets:</span>
            <button
              onClick={() => setDatePreset('this_month')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => setDatePreset('this_year')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              This Year
            </button>
            <button
              onClick={() => setDatePreset('last_30')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDatePreset('all')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              All Records
            </button>
          </div>

          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            <RotateCcw className="w-3 h-3" /> Reset Filters
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className={`grid grid-cols-1 ${selectedAccount ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs uppercase font-semibold text-gray-500 mb-1">Total Entries</h3>
          <p className="text-2xl font-bold text-gray-900">{filteredEntries.length}</p>
          <span className="text-xs text-indigo-600 font-medium">{selectedDeptName}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs uppercase font-semibold text-gray-500 mb-1">
            {selectedAccount ? 'Account Period Debits' : 'Total Period Debits'}
          </h3>
          <p className="text-2xl font-bold text-green-600">{currency} {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <span className="text-xs text-gray-400">Total inflows / debits</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs uppercase font-semibold text-gray-500 mb-1">
            {selectedAccount ? 'Account Period Credits' : 'Total Period Credits'}
          </h3>
          <p className="text-2xl font-bold text-red-600">{currency} {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <span className="text-xs text-gray-400">Total outflows / credits</span>
        </div>
        {selectedAccount && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs uppercase font-semibold text-gray-500 mb-1">Closing Balance</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {currency} {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-semibold ml-1.5 text-gray-500 uppercase">
                {debitNormal ? (closingBalance >= 0 ? 'DR' : 'CR') : (closingBalance >= 0 ? 'CR' : 'DR')}
              </span>
            </p>
            <span className="text-xs text-gray-400">
              Opening: {currency} {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Journal Entries & General Ledger Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Entry / Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Account & Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Debit ({currency})
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Credit ({currency})
                </th>
                {selectedAccount && (
                  <th className="px-5 py-3 text-right text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                    Running Balance ({currency})
                  </th>
                )}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* If account selected, render Opening Balance row on Page 1 */}
              {selectedAccount && currentPage === 1 && (
                <tr className="bg-indigo-50/50 font-semibold border-b border-indigo-100">
                  <td className="px-5 py-3 text-sm text-indigo-900" colSpan={4}>
                    Opening Balance (As of {dateFrom || 'Start'})
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-400">—</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-400">—</td>
                  <td className="px-5 py-3 text-right text-sm text-indigo-900 font-bold">
                    {currency} {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-indigo-600 uppercase font-bold">
                    {debitNormal ? (openingBalance >= 0 ? 'DR' : 'CR') : (openingBalance >= 0 ? 'CR' : 'DR')}
                  </td>
                </tr>
              )}

              {/* If account selected and past Page 1, render carry-forward context */}
              {selectedAccount && currentPage > 1 && startIndex > 0 && (
                <tr className="bg-amber-50/60 font-medium border-b border-amber-200">
                  <td className="px-5 py-2.5 text-xs text-amber-900" colSpan={4}>
                    <span className="font-bold">Carried Forward from Page {currentPage - 1}:</span> Preceding balance
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-400">—</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-400">—</td>
                  <td className="px-5 py-2.5 text-right text-xs text-amber-900 font-bold">
                    {currency} {allLedgerRows[startIndex - 1]?.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-center text-[10px] text-amber-800 uppercase font-bold">
                    {debitNormal ? ((allLedgerRows[startIndex - 1]?.runningBalance || 0) >= 0 ? 'DR' : 'CR') : ((allLedgerRows[startIndex - 1]?.runningBalance || 0) >= 0 ? 'CR' : 'DR')}
                  </td>
                </tr>
              )}

              {paginatedLedgerRows.map((row) => {
                const { key, entry, line, entryDate, deptName, dr, cr, runningBalance } = row;
                return (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm">
                      <span className="font-semibold text-blue-600">{entry.entry_number}</span>
                      <div className="text-xs text-gray-500">{entryDate}</div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {entry.reference || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-900">
                      <div className="font-semibold text-gray-900">
                        <span className="text-gray-500 font-mono mr-1.5">{line.account?.code}</span>
                        {line.account?.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {line.description || entry.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {deptName}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-right font-medium text-green-700">
                      {dr > 0 ? `${currency} ${dr.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-right font-medium text-red-700">
                      {cr > 0 ? `${currency} ${cr.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    {selectedAccount && (
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-right font-bold text-indigo-700">
                        {currency} {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        entry.is_posted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {entry.is_posted ? 'Posted' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <tr>
                <td className="px-5 py-3 text-sm text-gray-900" colSpan={4}>
                  TOTALS / CLOSING SUMMARY
                </td>
                <td className="px-5 py-3 text-right text-sm text-green-700 font-extrabold">
                  {currency} {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right text-sm text-red-700 font-extrabold">
                  {currency} {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                {selectedAccount && (
                  <td className="px-5 py-3 text-right text-sm text-indigo-800 font-extrabold">
                    {currency} {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                )}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {allLedgerRows.length > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            itemLabel="transactions"
          />
        )}

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No journal entries found</h3>
            <p className="text-gray-500">Try adjusting your filters or department selection.</p>
          </div>
        )}
      </div>

      {showModal && (
        <JournalEntryModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            fetchData();
          }}
          onSuccess={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default GeneralLedger;