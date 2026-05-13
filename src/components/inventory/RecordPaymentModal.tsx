import React, { useState } from 'react';
import type { Purchase } from '../../types';
import { toast } from 'react-hot-toast';
import { SupplierService } from '../../services/supplierService';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Purchase;
  onPayment: () => void;
}

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({ open, onClose, invoice, onPayment }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('bank');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (Number(amount) > (invoice.total_amount - invoice.paid_amount)) {
      toast.error('Cannot pay more than the balance due');
      return;
    }

    setLoading(true);
    try {
      const success = await SupplierService.recordPurchasePayment(invoice.id, Number(amount), method, date);
      if (success) {
        toast.success('Payment recorded successfully');
        onPayment();
      } else {
        toast.error('Failed to record payment');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Record Payment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Amount</label>
            <input 
              type="number" 
              max={(invoice.total_amount - invoice.paid_amount).toFixed(2)}
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              className="w-full border rounded px-3 py-2" 
              required 
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block mb-1 font-medium">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>{loading ? 'Saving...' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal; 