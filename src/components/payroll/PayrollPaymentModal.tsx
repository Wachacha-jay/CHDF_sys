import React, { useState, useEffect } from 'react';
import { X, DollarSign, Building2, Calendar, FileText, CheckCircle, CreditCard, ShieldCheck } from 'lucide-react';
import type { PayrollRun, Account } from '../../types';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface PayrollPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (runId: string, paymentData: {
    payment_account_id: string;
    payment_date: string;
    payment_reference: string;
    notes: string;
  }) => Promise<boolean>;
  run: PayrollRun | null;
}

const PayrollPaymentModal: React.FC<PayrollPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirmPayment,
  run
}) => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'KES';

  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [otherAssetAccounts, setOtherAssetAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPayingAccounts();
      setPaymentDate(new Date().toISOString().split('T')[0]);
      if (run) {
        setReference(`EFT-${run.employee?.code || 'EMP'}-${new Date().getMonth() + 1}`);
        setNotes(`Salary payment for ${run.employee?.first_name} ${run.employee?.last_name}`);
      }
    }
  }, [isOpen, run]);

  const loadPayingAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const [allAccounts, categories] = await Promise.all([
        AccountingService.getAccounts(),
        AccountingService.getAccountCategories()
      ]);

      // Flatten the full account hierarchy so nested bank & cash sub-accounts are never lost
      const flatList = AccountingService.flattenAccounts(allAccounts || []);

      const catMap = new Map((categories || []).map(c => [c.id, c]));

      // Bank & cash keywords commonly used in Chart of Accounts
      const bankKeywords = [
        'bank', 'cash', 'mpesa', 'm-pesa', 'till', 'paybill', 'float', 'wallet',
        'checking', 'savings', 'equity', 'kcb', 'coop', 'co-op', 'absa', 'stanbic',
        'standard chartered', 'ncba', 'dtb', 'family', 'barclays', 'petty cash',
        'current a/c', 'current account', 'mobile money'
      ];

      const isBankOrCashAccount = (a: Account) => {
        const name = (a.name || '').toLowerCase();
        const code = (a.code || '');
        const cat = a.category_id ? catMap.get(a.category_id) : undefined;
        const catName = (cat?.name || '').toLowerCase();

        // Check if name contains any bank/cash keywords
        if (bankKeywords.some(kw => name.includes(kw))) return true;

        // Check if code matches standard liquid asset prefixes (111x, 110x, 101x, 102x)
        if (code.startsWith('111') || code.startsWith('110') || code.startsWith('101') || code.startsWith('102')) return true;

        // Check if category name suggests bank/cash
        if (catName.includes('cash') || catName.includes('bank') || catName.includes('liquid')) return true;

        return false;
      };

      const isAssetAccount = (a: Account) => {
        const type = (a.account_type || '').toLowerCase();
        const code = (a.code || '');
        const cat = a.category_id ? catMap.get(a.category_id) : undefined;

        if (type === 'asset') return true;
        if (code.startsWith('1')) return true;
        if (cat?.account_type?.toLowerCase() === 'asset') return true;
        if ((a as any).sub_category === 'cash_and_bank') return true;

        return isBankOrCashAccount(a);
      };

      // Filter all assets
      const allAssets = flatList.filter(isAssetAccount);

      // Separate into Bank & Cash accounts vs Other Asset accounts
      const banks: Account[] = [];
      const others: Account[] = [];

      allAssets.forEach(a => {
        if (isBankOrCashAccount(a)) {
          banks.push(a);
        } else {
          others.push(a);
        }
      });

      // Sort alphabetically by code or name
      banks.sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
      others.sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));

      setBankAccounts(banks);
      setOtherAssetAccounts(others);

      // Smart auto-selection:
      // 1. Try to match employee's designated bank name (e.g. 'Equity', 'KCB', 'Coop')
      let defaultSelection = null;
      if (run?.employee?.bank_name) {
        const empBankName = run.employee.bank_name.toLowerCase().trim();
        defaultSelection = banks.find(a => a.name.toLowerCase().includes(empBankName));
      }
      // 2. Try M-Pesa if employee method is mpesa
      if (!defaultSelection && run?.employee?.payment_method?.toLowerCase().includes('mpesa')) {
        defaultSelection = banks.find(a => a.name.toLowerCase().includes('mpesa'));
      }
      // 3. Fallback to default primary bank (code 1111, or 'operating', or first bank)
      if (!defaultSelection) {
        defaultSelection = banks.find(a => 
          a.code === '1111' || 
          a.name.toLowerCase().includes('operating') ||
          a.name.toLowerCase().includes('main')
        ) || banks[0] || others[0];
      }

      if (defaultSelection) {
        setSelectedAccountId(defaultSelection.id);
      }
    } catch (err) {
      console.error('Failed to load paying accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  if (!isOpen || !run) return null;

  const fmt = (n: number | string | undefined) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalDeductions = 
    Number(run.tax_deduction || 0) +
    Number(run.nhif_deduction || 0) +
    Number(run.nssf_deduction || 0) +
    Number(run.housing_levy_deduction || 0) +
    Number(run.sacco_welfare_deduction || 0) +
    Number(run.other_deductions || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      alert('Please select a paying bank or cash account');
      return;
    }

    setLoading(true);
    try {
      const ok = await onConfirmPayment(run.id, {
        payment_account_id: selectedAccountId,
        payment_date: paymentDate,
        payment_reference: reference,
        notes
      });
      if (ok) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const allAvailableAccounts = [...bankAccounts, ...otherAssetAccounts];
  const selectedAccount = allAvailableAccounts.find(a => a.id === selectedAccountId);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Process Salary Disbursement</h3>
              <p className="text-xs text-blue-100">Disburse individual employee net salary and post double-entry GL records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Employee & Payment Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Employee</div>
                <div className="text-base font-bold text-slate-900">
                  {run.employee?.first_name} {run.employee?.last_name}
                </div>
                <div className="text-xs text-slate-500">
                  Code: <span className="font-medium text-slate-700">{run.employee?.code || '—'}</span> · 
                  Dept: <span className="font-medium text-slate-700">{run.employee?.department || '—'}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Net Pay to Disburse</div>
                <div className="text-2xl font-extrabold text-emerald-600">
                  {currency} {fmt(run.net_pay)}
                </div>
              </div>
            </div>

            {/* Employee's Designated Bank / Method */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500">Method: </span>
                <span className="font-semibold text-slate-800 capitalize">
                  {run.employee?.payment_method || 'Bank Transfer'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Bank / Acc: </span>
                <span className="font-semibold text-slate-800">
                  {run.employee?.bank_name ? `${run.employee.bank_name} (${run.employee.bank_account || 'N/A'})` : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Gross Salary: </span>
                <span className="font-medium text-slate-700">{currency} {fmt(run.gross_pay)}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Deductions: </span>
                <span className="font-medium text-red-600">– {currency} {fmt(totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Paying Account Selection */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center">
                <Building2 className="h-4 w-4 mr-1.5 text-blue-600" />
                Paying Account (Asset Account) <span className="text-red-500 ml-0.5">*</span>
              </span>
              {selectedAccount && (
                <span className="text-xs text-slate-500 font-normal">
                  Code: <strong className="text-slate-700">{selectedAccount.code}</strong>
                </span>
              )}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              disabled={loadingAccounts}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              <option value="">-- Choose Paying Account (Bank / Cash / M-Pesa) --</option>
              {bankAccounts.length > 0 && (
                <optgroup label="🏦 Bank, Cash & Mobile Money Accounts">
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code || '—'}] {acc.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherAssetAccounts.length > 0 && (
                <optgroup label="📁 Other Asset Accounts">
                  {otherAssetAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code || '—'}] {acc.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Money will be credited (deducted) from this asset account.</span>
              <span className="text-blue-600 font-medium">
                {bankAccounts.length} bank/cash account(s) available
              </span>
            </div>
          </div>

          {/* Payment Date & Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800 flex items-center">
                <Calendar className="h-4 w-4 mr-1.5 text-blue-600" />
                Disbursement Date <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800 flex items-center">
                <CreditCard className="h-4 w-4 mr-1.5 text-blue-600" />
                Payment Reference / Cheque #
              </label>
              <input
                type="text"
                placeholder="e.g., EFT-2026-004, MPESA-QWE99, CHQ-104"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>

          {/* Payment Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800 flex items-center">
              <FileText className="h-4 w-4 mr-1.5 text-blue-600" />
              Payment Remarks / Notes
            </label>
            <input
              type="text"
              placeholder="Optional notes or disbursement details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>

          {/* Double Entry Notice */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-900 flex items-start space-x-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <span className="font-semibold text-blue-950">Automated Double-Entry Posting:</span>
              <ul className="list-disc list-inside text-blue-800 space-y-0.5">
                <li><strong>Accrual:</strong> Debits Salary Expense (5210), Credits Statutory Liabilities & Net Salary Payable (2125).</li>
                <li><strong>Disbursement:</strong> Debits Net Salary Payable (2125), Credits the chosen Paying Account.</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedAccountId}
              className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>Confirm & Disburse Payment</span>
                </div>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default PayrollPaymentModal;
