import React, { useState, useEffect } from 'react';
import type { Purchase, Account } from '../../types';
import { toast } from 'react-hot-toast';
import { SupplierService } from '../../services/supplierService';
import { AccountingService } from '../../services/accountingService';
import { useSettingsContext } from '../../contexts/SettingsContext';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const due = Math.max(0, Number(invoice?.total_amount || 0) - Number(invoice?.paid_amount || 0));
      setAmount(due > 0 ? due.toFixed(2) : '');
      setDate(new Date().toISOString().split('T')[0]);

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
        if (payingAccs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(payingAccs[0].id);
        }
      }).catch(err => {
        console.error('Error fetching accounts:', err);
      });
    }
  }, [open, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (payAmt > balanceDue + 0.01) {
      toast.error(`Cannot pay more than the balance due (${currency || 'KES'} ${balanceDue.toFixed(2)})`);
      return;
    }

    setLoading(true);
    try {
      const success = await SupplierService.recordPurchasePayment(
        invoice.id, 
        payAmt, 
        method, 
        date, 
        selectedAccountId || undefined
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Record Invoice Payment</h2>
            <p className="text-xs text-gray-500 font-mono">Invoice #{invoice.purchase_number}</p>
          </div>
          <span className="text-sm font-bold text-gray-600">
            Due: {currency || 'KES'} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Payment Amount</label>
            <input 
              type="number" 
              max={balanceDue.toFixed(2)}
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              className="w-full border rounded-lg px-3 py-2 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
              required 
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Payment Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              required 
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Payment Method</label>
            <select 
              value={method} 
              onChange={e => setMethod(e.target.value)} 
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="bank">Bank Transfer / Wire</option>
              <option value="mpesa">M-Pesa / Mobile Money</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          {bankAccounts.length > 0 && (
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Paid From Account (GL Credit)</label>
              <select 
                value={selectedAccountId} 
                onChange={e => setSelectedAccountId(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md transition-colors disabled:opacity-50" 
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