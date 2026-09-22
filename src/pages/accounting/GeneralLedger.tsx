import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, Download, Plus, Printer, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { JournalEntry, Account } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import JournalEntryModal from '../../components/accounting/JournalEntryModal';

const GeneralLedger: React.FC = () => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Fetch accounts and all journal entries
      const [accountsData, entriesData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getJournalEntries()
      ]);

      const flatAccounts = AccountingService.flattenAccounts(accountsData || []);
      setAccounts(flatAccounts);
      setEntries(entriesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchTerm || 
      (entry.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.entry_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.reference || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAccount = !selectedAccount ||
      entry.lines?.some(line => line.account_id === selectedAccount);

    const entryDate = String(entry.entry_date || '').slice(0, 10);
    const matchesDateFrom = !dateFrom || entryDate >= dateFrom;
    const matchesDateTo = !dateTo || entryDate <= dateTo;

    return matchesSearch && matchesAccount && matchesDateFrom && matchesDateTo;
  });

  const totalDebits = filteredEntries.reduce((sum, entry) => {
    if (selectedAccount) {
      const lineDebits = entry.lines?.filter(l => l.account_id === selectedAccount).reduce((s, l) => s + Number(l.debit_amount || 0), 0) || 0;
      return sum + lineDebits;
    }
    return sum + Number(entry.total_debit || 0);
  }, 0);

  const totalCredits = filteredEntries.reduce((sum, entry) => {
    if (selectedAccount) {
      const lineCredits = entry.lines?.filter(l => l.account_id === selectedAccount).reduce((s, l) => s + Number(l.credit_amount || 0), 0) || 0;
      return sum + lineCredits;
    }
    return sum + Number(entry.total_credit || 0);
  }, 0);

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
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('No journal entries to export');
      return;
    }

    const rows: (string | number)[][] = [
      [`${businessName} - General Ledger Report`],
      [`Period: ${dateFrom || 'All'} to ${dateTo || 'All'}`],
      [`Currency: ${currency}`],
      [],
      ['Entry Number', 'Date', 'Reference', 'Entry Description', 'Account Code', 'Account Name', 'Line Memo', `Debit (${currency})`, `Credit (${currency})`, 'Status']
    ];

    filteredEntries.forEach(entry => {
      const dateStr = String(entry.entry_date || '').slice(0, 10);
      const status = entry.is_posted ? 'Posted' : 'Draft';
      const ref = `"${(entry.reference || '').replace(/"/g, '""')}"`;
      const desc = `"${(entry.description || '').replace(/"/g, '""')}"`;

      if (entry.lines && entry.lines.length > 0) {
        entry.lines.forEach(line => {
          const accCode = line.account?.code || '';
          const accName = `"${(line.account?.name || '').replace(/"/g, '""')}"`;
          const lineMemo = `"${(line.description || '').replace(/"/g, '""')}"`;
          rows.push([
            entry.entry_number,
            dateStr,
            ref,
            desc,
            accCode,
            accName,
            lineMemo,
            Number(line.debit_amount || 0).toFixed(2),
            Number(line.credit_amount || 0).toFixed(2),
            status
          ]);
        });
      } else {
        rows.push([
          entry.entry_number,
          dateStr,
          ref,
          desc,
          '',
          '',
          '',
          Number(entry.total_debit || 0).toFixed(2),
          Number(entry.total_credit || 0).toFixed(2),
          status
        ]);
      }
    });

    rows.push([]);
    rows.push(['TOTALS', '', '', '', '', '', '', totalDebits.toFixed(2), totalCredits.toFixed(2), '']);

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `General_Ledger_${dateFrom || 'start'}_to_${dateTo || 'end'}.csv`);
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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>General Ledger - ${businessName}</title>
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
          th.center, td.center { text-align: center; }
          td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 11px; }
          tr.entry-header { background: #f8fafc; font-weight: 600; }
          tr.line-item td { color: #475569; font-size: 10.5px; }
          tr.totals-row td { font-weight: 800; background: #0f172a; color: #fff; border-color: #0f172a; font-size: 12px; }
          .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>${businessName}</h1>
          <h2>GENERAL LEDGER REPORT</h2>
          <p>Period: <strong>${dateFrom || 'Beginning'}</strong> to <strong>${dateTo || 'Present'}</strong> &bull; Currency: <strong>${currency}</strong> &bull; Total Entries: <strong>${filteredEntries.length}</strong></p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Entry / Date</th>
              <th style="width: 15%;">Reference</th>
              <th style="width: 43%;">Account / Description</th>
              <th class="right" style="width: 15%;">Debit (${currency})</th>
              <th class="right" style="width: 15%;">Credit (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${filteredEntries.map(entry => {
              const entryDate = String(entry.entry_date || '').slice(0, 10);
              const headerRow = `
                <tr class="entry-header">
                  <td><strong>${entry.entry_number}</strong><br/><span style="color:#64748b; font-size:9.5px;">${entryDate}</span></td>
                  <td>${entry.reference || '—'}</td>
                  <td><strong>${entry.description || '—'}</strong></td>
                  <td class="right"><strong>${currency} ${Number(entry.total_debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                  <td class="right"><strong>${currency} ${Number(entry.total_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              `;
              const linesRows = (entry.lines || []).map(line => `
                <tr class="line-item">
                  <td></td>
                  <td></td>
                  <td style="padding-left: 20px;">
                    &bull; <strong>${line.account?.code || ''}</strong> - ${line.account?.name || ''}
                    ${line.description ? `<div style="font-size:9.5px; color:#64748b;">${line.description}</div>` : ''}
                  </td>
                  <td class="right">${Number(line.debit_amount || 0) > 0 ? `${currency} ${Number(line.debit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td class="right">${Number(line.credit_amount || 0) > 0 ? `${currency} ${Number(line.credit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                </tr>
              `).join('');
              return headerRow + linesRows;
            }).join('')}
            <tr class="totals-row">
              <td colspan="3">ANNUAL GRAND TOTALS (${filteredEntries.length} entries)</td>
              <td class="right">${currency} ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="right">${currency} ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <span>Prepared by: ${user?.name || user?.email || 'Authorized User'}</span>
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
            General Ledger
          </h1>
          <p className="text-gray-600 mt-1">View and export all financial journal entries for {businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center text-sm font-medium shadow-sm"
          >
            <Printer className="w-4 h-4 mr-2 text-gray-600" />
            Print / PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center text-sm font-medium shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium shadow-sm ml-2"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Entry
          </button>
        </div>
      </div>

      <JournalEntryModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          fetchData();
          setShowModal(false);
        }}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Entry #, description, ref..."
              />
            </div>
          </div>

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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

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

      {/* Summary */}
      <div className={`grid grid-cols-1 ${selectedAccount ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Entries</h3>
          <p className="text-2xl font-bold text-gray-900">{filteredEntries.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {selectedAccount ? 'Account Debits' : 'Total Debits'}
          </h3>
          <p className="text-2xl font-bold text-green-600">{currency} {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {selectedAccount ? 'Account Credits' : 'Total Credits'}
          </h3>
          <p className="text-2xl font-bold text-red-600">{currency} {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        {selectedAccount && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Net Position</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {currency} {Math.abs(totalDebits - totalCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-semibold ml-1.5 text-gray-500 uppercase">
                {totalDebits >= totalCredits ? 'DR' : 'CR'}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {entry.entry_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(entry.entry_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {currency} {entry.total_debit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {currency} {entry.total_credit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${entry.is_posted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {entry.is_posted ? 'Posted' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                  {/* Entry Lines */}
                  {entry.lines?.map((line) => (
                    <tr key={line.id} className="bg-gray-50">
                      <td className="px-6 py-2"></td>
                      <td className="px-6 py-2"></td>
                        <td className="px-6 py-2 text-sm text-gray-600 pl-8">
                        {line.account?.code} - {line.account?.name}
                        {line.description && (
                          <div className="text-xs text-gray-500 mt-1">{line.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-2"></td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-right text-gray-600">
                        {line.debit_amount > 0 ? `${currency} ${line.debit_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-right text-gray-600">
                        {line.credit_amount > 0 ? `${currency} ${line.credit_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-2"></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No journal entries found</h3>
            <p className="text-gray-500">Create your first journal entry to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralLedger;