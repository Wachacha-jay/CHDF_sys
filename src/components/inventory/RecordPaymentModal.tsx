import React, { useState, useEffect } from 'react';
import type { Purchase, Account } from '../../types';
import { toast } from 'react-hot-toast';
import { SupplierService } from '../../services/supplierService';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { Building2, Info, Percent, ShieldCheck } from 'lucide-react';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Purchase;
  onPayment: () => void;
}

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({ open, onClose, invoice, onPayment }) => {
  const { currency } = useSettingsContext();
  const balanceDue = Math.max(0, Number(invoice?.total_amount || 0) - Number(invoice?.paid_amount || 0));
  
  const [amount, setAmount] = useState(balanceDue > 0 ? balanceDue.toFixed(2) : '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('bank');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [whtRate, setWhtRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      const due = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
      setAmount(due > 0 ? due.toFixed(2) : '');
      setDate(new Date().toISOString().split('T')[0]);
      
      // Default WHT rate from supplier if available, or default to 0
      const defaultWht = (invoice as any).supplier?.withholding_tax_rate ?? invoice.wht_rate ?? 0;
      setWhtRate(Number(defaultWht) || 0);

      AccountingService.getAccounts().then(accounts => {
        const flat = AccountingService.flattenAccounts(accounts);
        const payingAccs = flat.filter(a => 
          a.account_type === 'asset' && 
          (a.name.toLowerCase().includes('bank') || 
           a.name.toLowerCase().includes('cash') || 
           a.name.toLowerCase().includes('mpesa') ||
           a.code.startsWith('10') ||
           a.code.startsWith('11'))
        );
        setBankAccounts(payingAccs);
        if (payingAccs.length > 0) {
          setSelectedAccountId(payingAccs[0].id);
        }
      }).catch(err => {
        console.error('Error fetching accounts:', err);
      });
    }
  }, [open, invoice]);

  const grossAmount = Math.max(0, Number(amount) || 0);
  const calculatedWhtAmount = (grossAmount * (Number(whtRate) || 0)) / 100;
  const netDisbursement = Math.max(0, grossAmount - calculatedWhtAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grossAmount || grossAmount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (grossAmount > balanceDue + 0.01) {
      toast.error(`Cannot pay more than the balance due (${currency || 'KES'} ${balanceDue.toFixed(2)})`);
      return;
    }

    setLoading(true);
    try {
      const success = await SupplierService.recordPurchasePayment(
        invoice.id, 
        grossAmount, 
        method, 
        date, 
        selectedAccountId || undefined,
        Number(whtRate) || 0,
        calculatedWhtAmount
      );
      if (success) {
        toast.success('Payment recorded and posted to General Ledger');
        onPayment();
      } else {
        toast.error('Failed to record payment');
      }
    } catch (error) {
      toast.error('An error occurred while recording payment');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Record Invoice Payment</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Invoice #{invoice.purchase_number} {invoice.supplier?.name && `• ${invoice.supplier.name}`}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 font-medium block">Balance Due</span>
            <span className="text-base font-extrabold text-blue-600">
              {currency || 'KES'} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Informational Accounting & Department Badges */}
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex items-center text-slate-700 font-semibold mb-1">
            <Info className="w-3.5 h-3.5 text-blue-500 mr-1.5 flex-shrink-0" />
            <span>Accounting Context (Informational)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Department</span>
              <span className="font-medium text-slate-800 flex items-center mt-0.5">
                <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                {invoice.department?.name || 'General / Unallocated'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Expense Account</span>
              <span className="font-medium text-slate-800 truncate block mt-0.5">
                {invoice.expense_account 
                  ? `[${invoice.expense_account.code}] ${invoice.expense_account.name}`
                  : 'Default Inventory / Expense'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
            * Expense was recognized when the invoice was billed. This payment clears <strong>Accounts Payable (2100)</strong> against the selected Bank/Cash account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Gross Amount to Pay ({currency || 'KES'})</label>
              <input 
                type="number" 
                max={balanceDue.toFixed(2)}
                step="0.01" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                required 
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Payment Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Payment Method</label>
              <select 
                value={method} 
                onChange={e => setMethod(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="bank">Bank Transfer / Wire</option>
                <option value="mpesa">M-Pesa / Mobile Money</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Paid From (GL Credit)</label>
              <select 
                value={selectedAccountId} 
                onChange={e => setSelectedAccountId(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Withholding Tax (WHT) Section */}
          <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                <span>Withholding Tax (WHT)</span>
              </div>
              <span className="text-[11px] text-amber-700 font-medium">Default: 0.00%</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center pt-1">
              <div>
                <label className="block text-[11px] font-medium text-amber-800 mb-1">Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={whtRate}
                    onChange={e => setWhtRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full border border-amber-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-2 text-xs text-gray-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-amber-800 mb-1">WHT Deducted</label>
                <div className="px-2.5 py-1.5 bg-amber-100/70 border border-amber-300 rounded-lg text-sm font-bold text-amber-950 truncate">
                  {currency || 'KES'} {calculatedWhtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-800 mb-1">Net Disbursement</label>
                <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 truncate">
                  {currency || 'KES'} {netDisbursement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {whtRate > 0 ? (
              <p className="text-[11px] text-amber-800 flex items-center pt-1">
                <ShieldCheck className="w-3 h-3 mr-1 text-amber-600 flex-shrink-0" />
                Deduction of {currency || 'KES'} {calculatedWhtAmount.toFixed(2)} will credit <strong>WHT Payable (2150)</strong> for tax remittance.
              </p>
            ) : (
              <p className="text-[10px] text-gray-500 italic">
                WHT defaults to 0%. Enter a rate (e.g. 5% or 3%) if tax is being withheld at source for this supplier.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow transition-colors disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Record & Post Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal; 