import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  ChevronRight, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  Save, 
  X,
  History,
  Info,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { AccountingService } from '../../services/accountingService';
import { Account, BankReconciliation as BankReconciliationType, JournalEntryLine } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const BankReconciliation: React.FC = () => {
  const [reconciliations, setReconciliations] = useState<BankReconciliationType[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState(0);
  const [ledgerBalance, setLedgerBalance] = useState(0);
  const [unreconciledLines, setUnreconciledLines] = useState<JournalEntryLine[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [currentReconciliation, setCurrentReconciliation] = useState<BankReconciliationType | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'deposits' | 'payments'>('all');

  const formatCurrency = (amount: number) => {
    return `KSh ${new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [recs, allAccounts] = await Promise.all([
        AccountingService.getBankReconciliations(),
        AccountingService.getAccounts()
      ]);
      setReconciliations(recs);
      
      // Filter for bank and cash accounts (usually Assets -> Current Assets -> Cash/Bank)
      const flat = (accs: Account[]): Account[] => {
        let result: Account[] = [];
        accs.forEach(acc => {
          result.push(acc);
          if (acc.children) result = result.concat(flat(acc.children));
        });
        return result;
      };
      
      const bankAccs = flat(allAccounts).filter(acc => 
        acc.account_type === 'asset' && 
        (acc.name.toLowerCase().includes('bank') || acc.name.toLowerCase().includes('cash'))
      );
      setBankAccounts(bankAccs);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startNewReconciliation = () => {
    setSelectedAccountId('');
    setStatementBalance(0);
    setLedgerBalance(0);
    setUnreconciledLines([]);
    setSelectedLines(new Set());
    setStep(1);
    setShowWizard(true);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const balance = await AccountingService.getAccountBalanceAsOf(selectedAccountId, statementDate);
      const lines = await AccountingService.getUnreconciledLines(selectedAccountId, statementDate);
      
      setLedgerBalance(balance);
      setUnreconciledLines(lines);
      
      // Create draft reconciliation in backend
      const draft = await AccountingService.createBankReconciliation({
        account_id: selectedAccountId,
        statement_date: statementDate,
        statement_balance: statementBalance,
        ledger_balance: balance,
        difference: statementBalance - balance,
        status: 'draft'
      });
      
      if (draft) {
        setCurrentReconciliation(draft);
        setStep(2);
      }
    } catch (error) {
      toast.error('Failed to initialize reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const toggleLine = (id: string) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLines(newSelected);
  };

  const calculateTotals = () => {
    let clearedDeposits = 0;
    let clearedPayments = 0;
    
    unreconciledLines.forEach(line => {
      if (selectedLines.has(line.id)) {
        if (line.debit_amount > 0) clearedDeposits += line.debit_amount;
        if (line.credit_amount > 0) clearedPayments += line.credit_amount;
      }
    });
    
    // Adjusted balance = Statement Balance - Uncleared Deposits + Uncleared Payments
    // But usually we compare: Statement Balance vs Book Balance (Ledger Balance)
    // Book Balance as of Date + Cleared items? No.
    // Reconciliation is: Statement Balance - Cleared Items = Adjusted Balance should equal Ledger Balance?
    // Let's use simpler: Total Cleared = Deposits - Payments.
    // Book Balance + Cleared = Adjusted? No.
    
    // Accounting Rule:
    // Adjusted Bank Balance = Statement Balance + Deposits in Transit - Outstanding Checks
    // Adjusted Book Balance = Book Balance + Bank Interest/Collections - Bank Fees/NSF Checks
    
    // In our case, we are matching what's in the book against the statement.
    // So "Difference" = Statement Balance - (Ledger Balance + Adjusted Cleared)
    
    const clearedAmount = clearedDeposits - clearedPayments;
    const currentDifference = statementBalance - (ledgerBalance + clearedAmount);
    
    return {
      clearedDeposits,
      clearedPayments,
      clearedAmount,
      difference: currentDifference
    };
  };

  const { clearedDeposits, clearedPayments, difference } = calculateTotals();

  const handleFinalize = async () => {
    if (Math.abs(difference) > 0.01) {
      if (!window.confirm(`There is a difference of ${difference}. Are you sure you want to finalize this reconciliation?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      if (currentReconciliation) {
        await AccountingService.finalizeReconciliation(currentReconciliation.id, Array.from(selectedLines));
        toast.success('Reconciliation completed successfully');
        setShowWizard(false);
        loadInitialData();
      }
    } catch (error) {
      toast.error('Failed to finalize reconciliation');
    } finally {
      setLoading(false);
    }
  };

  if (showWizard) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button 
            onClick={() => setShowWizard(false)}
            className="p-2 hover:bg-gray-100 rounded-full mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">New Bank Reconciliation</h1>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center space-x-4 bg-white/50 backdrop-blur-sm px-8 py-3 rounded-2xl border border-white shadow-sm">
            <div className={`flex items-center ${step >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-2 ${step >= 1 ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}>1</div>
              <span className="font-semibold text-sm">Setup</span>
            </div>
            <div className="w-8 h-px bg-gray-200"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-2 ${step >= 2 ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}>2</div>
              <span className="font-semibold text-sm">Match</span>
            </div>
            <div className="w-8 h-px bg-gray-200"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-2 ${step >= 3 ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}>3</div>
              <span className="font-semibold text-sm">Review</span>
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-green-600" />
                Select Account & Statement Details
              </h2>
              <form onSubmit={handleStep1Submit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Account</label>
                  <select 
                    required
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  >
                    <option value="">Select a bank account</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Statement Ending Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        required
                        type="date"
                        value={statementDate}
                        onChange={(e) => setStatementDate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Statement Ending Balance</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={statementBalance}
                        onChange={(e) => setStatementBalance(Number(e.target.value))}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl flex items-start">
                  <Info className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    This will load all transactions up to the statement date that haven't been reconciled yet.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? 'Initializing...' : 'Continue to Matching'}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Reconciliation Summary Cards - Auditor Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 group hover:border-emerald-200 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bank Statement</p>
                  <Building2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(statementBalance)}</p>
                <div className="mt-2 h-1 w-12 bg-emerald-500 rounded-full"></div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Book Balance</p>
                  <History className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(ledgerBalance)}</p>
                <div className="mt-2 h-1 w-12 bg-blue-500 rounded-full"></div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 group hover:border-indigo-200 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cleared Net</p>
                  <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                </div>
                <p className={`text-2xl font-black ${(clearedDeposits - clearedPayments) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(clearedDeposits - clearedPayments)}
                </p>
                <div className={`mt-2 h-1 w-12 rounded-full ${(clearedDeposits - clearedPayments) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              </div>

              <div className={`p-6 rounded-3xl border-2 transition-all duration-500 ${Math.abs(difference) < 0.01 
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-600 shadow-xl shadow-emerald-100 text-white' 
                : 'bg-white border-orange-200 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs font-bold uppercase tracking-widest ${Math.abs(difference) < 0.01 ? 'text-white/70' : 'text-orange-500'}`}>Discrepancy</p>
                  {Math.abs(difference) < 0.01 
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <AlertCircle className="w-5 h-5 text-orange-500 animate-pulse" />
                  }
                </div>
                <p className="text-2xl font-black">{formatCurrency(difference)}</p>
                <div className={`mt-2 h-1 w-12 rounded-full ${Math.abs(difference) < 0.01 ? 'bg-white/50' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-gray-200">
                  {(['all', 'deposits', 'payments'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterType === type ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">In: {formatCurrency(clearedDeposits)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Out: {formatCurrency(clearedPayments)}</span>
                    </div>
                  </div>
                  <div className="h-6 w-px bg-gray-200"></div>
                  <button 
                    onClick={() => {
                        if (selectedLines.size === unreconciledLines.length) setSelectedLines(new Set());
                        else setSelectedLines(new Set(unreconciledLines.map(l => l.id)));
                    }}
                    className="text-emerald-600 hover:text-emerald-700 text-xs font-black uppercase tracking-widest"
                  >
                    {selectedLines.size === unreconciledLines.length ? 'Clear Selection' : 'Match All'}
                  </button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr className="text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-3 text-left">Matched</th>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Reference</th>
                      <th className="px-6 py-3 text-left">Description</th>
                      <th className="px-6 py-3 text-right">Debit</th>
                      <th className="px-6 py-3 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {unreconciledLines
                      .filter(line => {
                        if (filterType === 'deposits') return line.debit_amount > 0;
                        if (filterType === 'payments') return line.credit_amount > 0;
                        return true;
                      })
                      .length === 0 ? (
                        <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">No unreconciled transactions found for this view</td></tr>
                    ) : unreconciledLines
                      .filter(line => {
                        if (filterType === 'deposits') return line.debit_amount > 0;
                        if (filterType === 'payments') return line.credit_amount > 0;
                        return true;
                      })
                      .map(line => (
                      <tr 
                        key={line.id} 
                        onClick={() => toggleLine(line.id)}
                        className={`cursor-pointer transition-all hover:bg-emerald-50/30 ${selectedLines.has(line.id) ? 'bg-emerald-50/50' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${selectedLines.has(line.id) ? 'bg-emerald-600 border-emerald-600 shadow-sm' : 'bg-white border-gray-300'}`}>
                            {selectedLines.has(line.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-600">
                          {line.created_at ? format(new Date(line.created_at), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{(line as any).journal_entry?.entry_number || '-'}</td>
                        <td className="px-6 py-4 text-gray-700 font-medium">{line.description || (line as any).journal_entry?.description}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-rose-500">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 bg-gray-50 flex justify-between items-center">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all"
                >
                  Back
                </button>
                <div className="flex space-x-4">
                    <button 
                        onClick={() => handleFinalize()}
                        className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Finalize Reconciliation
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">BANK <span className="text-green-600">RECONCILIATION</span></h1>
          <p className="text-gray-500 font-medium">Manage and reconcile your bank accounts with Ledger</p>
        </div>
        <button
          onClick={startNewReconciliation}
          className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 flex items-center transition-all shadow-xl shadow-green-100 active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Reconciliation
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mr-5">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Completed</p>
            <p className="text-3xl font-black text-gray-900">{reconciliations.filter(r => r.status === 'completed').length}</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center">
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mr-5">
            <Clock className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Drafts</p>
            <p className="text-3xl font-black text-gray-900">{reconciliations.filter(r => r.status === 'draft').length}</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-8 rounded-3xl shadow-xl flex items-center text-white">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mr-5">
            <History className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Last Reconciliation</p>
            <p className="text-xl font-bold">
              {reconciliations.length > 0 
                ? format(new Date(reconciliations[0].statement_date), 'MMM dd, yyyy')
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="flex items-center">
            <History className="w-5 h-5 text-gray-400 mr-2" />
            <span className="font-bold text-gray-700">Reconciliation History</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter by account..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-widest font-black">
              <tr>
                <th className="px-8 py-4 text-left">Statement Date</th>
                <th className="px-8 py-4 text-left">Account</th>
                <th className="px-8 py-4 text-right">Statement Balance</th>
                <th className="px-8 py-4 text-right">Ledger Balance</th>
                <th className="px-8 py-4 text-right">Difference</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="p-20 text-center text-gray-400">Loading reconciliations...</td></tr>
              ) : reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Info className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-medium">No bank reconciliations found</p>
                        <button onClick={startNewReconciliation} className="mt-4 text-green-600 font-bold hover:underline">Start your first reconciliation</button>
                    </div>
                  </td>
                </tr>
              ) : reconciliations.map(rec => {
                const account = bankAccounts.find(a => a.id === rec.account_id);
                return (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5 font-bold text-gray-700">
                      {format(new Date(rec.statement_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{account?.name || 'Unknown Account'}</span>
                        <span className="text-xs text-gray-400 font-mono">{account?.code}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-gray-900">{rec.statement_balance.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-medium text-gray-500">{rec.ledger_balance.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-bold">
                      <span className={rec.difference === 0 ? 'text-green-600' : 'text-orange-500'}>
                        {rec.difference.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        rec.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                        <button className="p-2 text-gray-400 hover:text-green-600 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BankReconciliation;
