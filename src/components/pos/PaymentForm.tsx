import React from 'react';
import { DollarSign, CreditCard, FileText, Building2, AlertCircle } from 'lucide-react';
import type { Customer, Account } from '../../types';

export type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'credit';

interface PaymentFormProps {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  customerId: string;
  setCustomerId: (id: string) => void;
  customers: Customer[];
  onAddCustomer?: () => void;
  posMode?: 'retail' | 'ngo' | 'distribution';
  paymentAccountId?: string;
  setPaymentAccountId?: (id: string) => void;
  bankAccounts?: Account[];
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  paymentMethod,
  setPaymentMethod,
  customerName,
  setCustomerName,
  phoneNumber,
  setPhoneNumber,
  customerId,
  setCustomerId,
  customers,
  onAddCustomer,
  posMode = 'retail',
  paymentAccountId = '',
  setPaymentAccountId,
  bankAccounts = []
}) => (
  <div className="space-y-5">
    {/* Identity Section */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
          {posMode === 'ngo' ? 'Donor / Sponsor' : 'Customer Profile'}
          {paymentMethod === 'credit' && <span className="text-rose-500 font-bold">* Required for Credit</span>}
        </label>
        {onAddCustomer && (
          <button 
            type="button"
            onClick={onAddCustomer}
            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest"
          >
            + Add New
          </button>
        )}
      </div>
      
      <select
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className={`w-full bg-white dark:bg-slate-900 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm ${
          paymentMethod === 'credit' && !customerId 
            ? 'border-2 border-amber-400 ring-2 ring-amber-100 dark:ring-amber-900/30' 
            : 'border border-gray-200 dark:border-slate-800'
        }`}
      >
        <option value="">{posMode === 'ngo' ? '-- Select Donor --' : '-- Select Customer --'}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {(!customerId && paymentMethod !== 'credit') && (
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Walk-in Customer (Optional)"
          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold py-2.5 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm"
        />
      )}
    </div>

    {/* Payment Method / Gateway */}
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
        Payment Mode
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { id: 'cash', label: 'Cash', icon: DollarSign, color: 'indigo' },
          { id: 'mpesa', label: 'M-Pesa', icon: CreditCard, color: 'emerald' },
          { id: 'card', label: 'Card', icon: CreditCard, color: 'purple' },
          { id: 'credit', label: 'On Credit', icon: FileText, color: 'amber' }
        ].map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => setPaymentMethod(method.id as PaymentMethod)}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all gap-1 ${
              paymentMethod === method.id
                ? `border-${method.color}-500 bg-${method.color}-50 dark:bg-${method.color}-500/10 text-${method.color}-600 dark:text-${method.color}-400 font-bold shadow-xs`
                : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-400 hover:text-gray-600 hover:border-gray-200'
            }`}
          >
            <method.icon className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">{method.label}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Credit Sale Banner */}
    {paymentMethod === 'credit' && (
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-1.5 animate-in fade-in duration-200">
        <div className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-amber-600" />
          <span>Sale On Credit (Invoicing)</span>
        </div>
        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
          An invoice will be generated and posted to Accounts Receivable (1120). You can record subsequent payments via the Invoicing module.
        </p>
        {!customerId && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Customer selection is required for credit sales.</span>
          </div>
        )}
      </div>
    )}

    {/* Receiving Bank / Cash Account Selection (for non-credit sales) */}
    {paymentMethod !== 'credit' && setPaymentAccountId && bankAccounts.length > 0 && (
      <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
        <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Receiving Bank / Cash Account *
        </label>
        <select
          value={paymentAccountId}
          onChange={(e) => setPaymentAccountId(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-xs"
        >
          <option value="">-- Default / Select Receiving Account --</option>
          {bankAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.code} - {acc.name}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-400">
          Payment will be debited to this account in the General Ledger.
        </p>
      </div>
    )}
    
    {/* Phone Number for M-Pesa */}
    {paymentMethod === 'mpesa' && (
      <div className="animate-in slide-in-from-top-2 duration-200 space-y-1">
        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">
          M-Pesa Recipient Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="2547..."
          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold py-2.5 px-4 focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all shadow-sm"
        />
      </div>
    )}
  </div>
);

export default PaymentForm;