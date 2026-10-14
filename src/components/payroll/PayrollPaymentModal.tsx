import React, { useState, useEffect } from 'react';
import { X, DollarSign, Building2, Calendar, FileText, CheckCircle, CreditCard, ShieldCheck, Plus, Trash2, AlertCircle, Scale } from 'lucide-react';
import type { PayrollRun, Account } from '../../types';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';

export interface PaymentLineItem {
  id: string;
  payment_account_id: string;
  amount: number | string;
  payment_date: string;
  payment_reference: string;
  notes?: string;
}

interface PayrollPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (runId: string, paymentData: {
    payment_account_id: string;
    payment_date: string;
    payment_reference: string;
    notes: string;
    lines?: Array<{
      payment_account_id: string;
      amount: number;
      payment_date: string;
      payment_reference: string;
      notes?: string;
    }>;
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
  const [paymentLines, setPaymentLines] = useState<PaymentLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (isOpen && run) {
      loadPayingAccounts();
      const today = new Date().toISOString().split('T')[0];
      setNotes(`Salary payment for ${run.employee?.first_name || ''} ${run.employee?.last_name || ''}`.trim());
      // Initialize with 1 payment line
      setPaymentLines([
        {
          id: `line-${Date.now()}-1`,
          payment_account_id: selectedAccountId || '',
          amount: Number(run.net_pay || 0),
          payment_date: today,
          payment_reference: `CHQ-${run.employee?.code || 'EMP'}-${new Date().getMonth() + 1}`,
          notes: ''
        }
      ]);
    }
  }, [isOpen, run]);

  const loadPayingAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const [allAccounts, categories] = await Promise.all([
        AccountingService.getAccounts(),
        AccountingService.getAccountCategories()
      ]);

      const flatList = AccountingService.flattenAccounts(allAccounts || []);
      const catMap = new Map((categories || []).map(c => [c.id, c]));

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

        if (bankKeywords.some(kw => name.includes(kw))) return true;
        if (code.startsWith('111') || code.startsWith('110') || code.startsWith('101') || code.startsWith('102')) return true;
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

      const allAssets = flatList.filter(isAssetAccount);
      const banks: Account[] = [];
      const others: Account[] = [];

      allAssets.forEach(a => {
        if (isBankOrCashAccount(a)) {
          banks.push(a);
        } else {
          others.push(a);
        }
      });

      banks.sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
      others.sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));

      setBankAccounts(banks);
      setOtherAssetAccounts(others);

      // Smart auto-selection
      let defaultSelection = null;
      if (run?.employee?.bank_name) {
        const empBankName = run.employee.bank_name.toLowerCase().trim();
        defaultSelection = banks.find(a => a.name.toLowerCase().includes(empBankName));
      }
      if (!defaultSelection && run?.employee?.payment_method?.toLowerCase().includes('mpesa')) {
        defaultSelection = banks.find(a => a.name.toLowerCase().includes('mpesa'));
      }
      if (!defaultSelection) {
        defaultSelection = banks.find(a => 
          a.code === '1111' || 
          a.name.toLowerCase().includes('operating') ||
          a.name.toLowerCase().includes('main')
        ) || banks[0] || others[0];
      }

      if (defaultSelection) {
        setSelectedAccountId(defaultSelection.id);
        setPaymentLines(prev => prev.map(line => ({
          ...line,
          payment_account_id: line.payment_account_id || defaultSelection.id
        })));
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

  const netPay = Number(run.net_pay || 0);
  const totalAllocated = paymentLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const diff = Number((netPay - totalAllocated).toFixed(2));
  const isBalanced = Math.abs(diff) < 0.05;

  // Change primary account
  const handlePrimaryAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    // If single line or lines missing account, default them
    setPaymentLines(prev => prev.map(line => ({
      ...line,
      payment_account_id: line.payment_account_id === selectedAccountId || !line.payment_account_id ? accId : line.payment_account_id
    })));
  };

  // Add an extra cheque / payment line
  const handleAddLine = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextIndex = paymentLines.length + 1;
    const remainingAmount = diff > 0 ? diff : 0;
    const newLine: PaymentLineItem = {
      id: `line-${Date.now()}-${nextIndex}`,
      payment_account_id: selectedAccountId || (bankAccounts[0]?.id || ''),
      amount: remainingAmount > 0 ? Number(remainingAmount.toFixed(2)) : '',
      payment_date: today,
      payment_reference: `CHQ-${run.employee?.code || 'EMP'}-0${nextIndex}`,
      notes: ''
    };
    setPaymentLines(prev => [...prev, newLine]);
  };

  // Remove a line
  const handleRemoveLine = (id: string) => {
    if (paymentLines.length <= 1) return;
    setPaymentLines(prev => prev.filter(l => l.id !== id));
  };

  // Update a field on a specific line
  const handleUpdateLine = (id: string, field: keyof PaymentLineItem, value: any) => {
    setPaymentLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      return { ...line, [field]: value };
    }));
  };

  // Quick auto-balance helper
  const handleAutoBalance = () => {
    if (paymentLines.length === 0) return;
    if (paymentLines.length === 1) {
      handleUpdateLine(paymentLines[0].id, 'amount', netPay);
    } else {
      const lastLine = paymentLines[paymentLines.length - 1];
      const otherTotal = paymentLines.slice(0, -1).reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const needed = Math.max(0, Number((netPay - otherTotal).toFixed(2)));
      handleUpdateLine(lastLine.id, 'amount', needed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      alert(`The total across payment lines (${currency} ${fmt(totalAllocated)}) must equal the Net Pay (${currency} ${fmt(netPay)}). Difference: ${currency} ${fmt(diff)}`);
      return;
    }

    for (let i = 0; i < paymentLines.length; i++) {
      const line = paymentLines[i];
      if (!line.payment_account_id) {
        alert(`Please select a paying bank/cash account for Cheque Line #${i + 1}`);
        return;
      }
      if (!line.payment_date) {
        alert(`Please select a disbursement date for Cheque Line #${i + 1}`);
        return;
      }
      if (Number(line.amount) <= 0) {
        alert(`Amount for Cheque Line #${i + 1} must be greater than zero`);
        return;
      }
    }

    setLoading(true);
    try {
      const primaryLine = paymentLines[0];
      const aggregatedRef = paymentLines.map(l => l.payment_reference.trim()).filter(Boolean).join(', ');

      const ok = await onConfirmPayment(run.id, {
        payment_account_id: primaryLine.payment_account_id || selectedAccountId,
        payment_date: primaryLine.payment_date,
        payment_reference: aggregatedRef,
        notes: notes.trim(),
        lines: paymentLines.map(l => ({
          payment_account_id: l.payment_account_id,
          amount: Number(l.amount),
          payment_date: l.payment_date,
          payment_reference: l.payment_reference.trim(),
          notes: l.notes?.trim() || ''
        }))
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
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-150 my-6">
        
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
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

          {/* Primary Paying Account Selection */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center">
                <Building2 className="h-4 w-4 mr-1.5 text-blue-600" />
                Primary Paying Account (Asset Account) <span className="text-red-500 ml-0.5">*</span>
              </span>
              {selectedAccount && (
                <span className="text-xs text-slate-500 font-normal">
                  Code: <strong className="text-slate-700">{selectedAccount.code}</strong>
                </span>
              )}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => handlePrimaryAccountChange(e.target.value)}
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
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CHEQUE / DISBURSEMENT LINES SECTION                               */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Disbursement & Cheque Lines ({paymentLines.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-blue-600" />
                Add Cheque / Payment Line
              </button>
            </div>

            {paymentLines.length > 1 && (
              <div className="text-xs text-slate-500">
                Split payment across different cheques, dates, or accounts. Each cheque will post its own balanced double-entry GL journal entry.
              </div>
            )}

            {/* List of lines */}
            <div className="space-y-3">
              {paymentLines.map((line, index) => (
                <div
                  key={line.id}
                  className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3 relative group transition-all hover:border-blue-300"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
                    <span className="font-bold text-slate-700 flex items-center">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[11px] mr-1.5">
                        {index + 1}
                      </span>
                      Cheque / Payment Line #{index + 1}
                    </span>
                    {paymentLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors inline-flex items-center text-xs"
                        title="Remove this cheque line"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Amount */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Amount ({currency}) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">
                          {currency}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={line.amount}
                          onChange={(e) => handleUpdateLine(line.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-12 pr-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Disbursement Date */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-blue-600" />
                        Disbursement Date <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={line.payment_date}
                        onChange={(e) => handleUpdateLine(line.id, 'payment_date', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      />
                    </div>

                    {/* Payment Reference / Cheque # */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 flex items-center">
                        <CreditCard className="h-3 w-3 mr-1 text-blue-600" />
                        Payment Ref / Cheque # <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., CHQ-10442, EFT-99"
                        value={line.payment_reference}
                        onChange={(e) => handleUpdateLine(line.id, 'payment_reference', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Paying Account for this line (if multi-line or user wants specific account) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 flex items-center">
                        <Building2 className="h-3 w-3 mr-1 text-slate-400" />
                        Paying Account for Line #{index + 1}
                      </label>
                      <select
                        value={line.payment_account_id}
                        onChange={(e) => handleUpdateLine(line.id, 'payment_account_id', e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Choose Account --</option>
                        {bankAccounts.length > 0 && (
                          <optgroup label="🏦 Bank & Cash Accounts">
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
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Line Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 1st installment, final payment"
                        value={line.notes || ''}
                        onChange={(e) => handleUpdateLine(line.id, 'notes', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reconciliation / Allocation Balance Bar */}
            <div className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isBalanced 
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900' 
                : 'bg-amber-50/90 border-amber-300 text-amber-900'
            }`}>
              <div className="flex items-center space-x-2">
                {isBalanced ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}
                <div>
                  <span className="font-bold">
                    {isBalanced ? 'Balanced Allocation:' : 'Reconciliation Required:'}
                  </span>{' '}
                  Allocated <strong className="font-extrabold">{currency} {fmt(totalAllocated)}</strong> of{' '}
                  <strong className="font-extrabold">{currency} {fmt(netPay)}</strong> Net Pay.
                </div>
              </div>

              {!isBalanced && (
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-amber-800">
                    Difference: {currency} {fmt(Math.abs(diff))} {diff > 0 ? '(Unallocated)' : '(Over-allocated)'}
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="px-2 py-0.5 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded border border-amber-300 transition-colors inline-flex items-center"
                  >
                    <Scale className="h-3 w-3 mr-1" />
                    Auto-Balance
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Payment Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800 flex items-center">
              <FileText className="h-4 w-4 mr-1.5 text-blue-600" />
              General Payment Remarks / Notes
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
                <li><strong>Disbursement:</strong> Debits Net Salary Payable (2125) and Credits Paying Account(s) for each cheque on its respective disbursement date.</li>
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
              disabled={loading || !isBalanced || paymentLines.length === 0}
              className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    {paymentLines.length > 1
                      ? `Confirm & Disburse (${paymentLines.length} Cheques)`
                      : 'Confirm & Disburse Payment'}
                  </span>
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
