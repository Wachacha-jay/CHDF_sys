import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, Download, Plus } from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { JournalEntry, Account } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import JournalEntryModal from '../../components/accounting/JournalEntryModal';

const GeneralLedger: React.FC = () => {
  const { settings } = useSettingsContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch accounts and journal entries via AccountingService
      const [accountsData, entriesData] = await Promise.all([
        AccountingService.getAccounts({ is_active: true }),
        AccountingService.getJournalEntries({ is_posted: true })
      ]);

      setAccounts(accountsData || []);
      setEntries(entriesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAccount = !selectedAccount ||
      entry.lines?.some(line => line.account_id === selectedAccount);

    const matchesDateFrom = !dateFrom || entry.entry_date >= dateFrom;
    const matchesDateTo = !dateTo || entry.entry_date <= dateTo;

    return matchesSearch && matchesAccount && matchesDateFrom && matchesDateTo;
  });

  const currency = settings?.default_currency || 'USD';
  const totalDebits = filteredEntries.reduce((sum, entry) => sum + entry.total_debit, 0);
  const totalCredits = filteredEntries.reduce((sum, entry) => sum + entry.total_credit, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-6 h-6 mr-2" />
            General Ledger
          </h1>
          <p className="text-gray-600 mt-1">View and manage all journal entries</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </button>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search entries..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Entries</h3>
          <p className="text-2xl font-bold text-gray-900">{filteredEntries.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Debits</h3>
          <p className="text-2xl font-bold text-green-600">{currency} {totalDebits.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Credits</h3>
          <p className="text-2xl font-bold text-red-600">{currency} {totalCredits.toLocaleString()}</p>
        </div>
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