import React from 'react';
import { DollarSign, CreditCard, FileText } from 'lucide-react';
import type { Customer } from '../../types';

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
  posMode?: 'retail' | 'ngo';
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
  posMode = 'retail'
}) => (
  <div className="space-y-6">
    {/* Identity Section */}
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                {posMode === 'ngo' ? 'Donor / Sponsor' : 'Customer Profile'}
            </label>
            {onAddCustomer && (
                <button 
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
          className="w-full bg-white dark:bg-slate-900 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm"
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
              placeholder="Walk-in (Optional)"
              className="w-full bg-white dark:bg-slate-900 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm"
            />
        )}
    </div>

    {/* Payment Method */}
    <div className="space-y-3">
      <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
        Payment Gateway
      </label>
      <div className="grid grid-cols-2 gap-3">
        {[
            { id: 'cash', label: 'Cash', icon: DollarSign, color: 'indigo' },
            { id: 'mpesa', label: 'M-Pesa', icon: CreditCard, color: 'emerald' },
            { id: 'card', label: 'Card', icon: CreditCard, color: 'purple' },
            { id: 'credit', label: 'Invoice', icon: FileText, color: 'orange' }
        ].map((method) => (
            <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${
                    paymentMethod === method.id
                        ? `border-${method.color}-500 bg-${method.color}-50 dark:bg-${method.color}-500/10 text-${method.color}-600 dark:text-${method.color}-400`
                        : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-400'
                }`}
            >
                <method.icon className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
            </button>
        ))}
      </div>
    </div>
    
    {/* Phone Number for M-Pesa */}
    {paymentMethod === 'mpesa' && (
      <div className="animate-in slide-in-from-top-2 duration-200">
        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">
          M-Pesa Recipient Phone
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="2547..."
          className="w-full bg-white dark:bg-slate-900 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all shadow-sm"
        />
      </div>
    )}
  </div>
);

export default PaymentForm;