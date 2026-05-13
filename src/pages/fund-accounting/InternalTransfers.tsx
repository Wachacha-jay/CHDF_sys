import React, { useState, useEffect } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { ArrowRightLeft, Plus, CheckCircle, Clock, XCircle, AlertCircle, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, InternalTransfer } from '../../types';
import { useAuthContext } from '../../contexts/useAuthContext';

const InternalTransfers: React.FC = () => {
  const { user } = useAuthContext();
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState<Partial<InternalTransfer>>({
    from_department_id: '',
    to_department_id: '',
    amount: 0,
    transfer_date: new Date().toISOString().split('T')[0],
    description: '',
    // @ts-ignore
    transfer_type: 'direct_transfer'
  });

  const loadData = async () => {
    setLoading(true);
    const [tList, dList] = await Promise.all([
      // Generic API fetch for internal_transfers
      fetch('/api/internal_transfers').then(res => res.json()).then(data => data.internal_transfers || []),
      FundAccountingService.getDepartments()
    ]);
    setTransfers(tList);
    setDepartments(dList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.from_department_id === formData.to_department_id) {
        toast.error('Source and destination departments must be different');
        return;
    }
    const result = await FundAccountingService.recordTransfer(formData);
    if (result) {
        toast.success('Transfer request submitted for approval');
        setShowModal(false);
        setFormData({
            from_department_id: '',
            to_department_id: '',
            amount: 0,
            transfer_date: new Date().toISOString().split('T')[0],
            description: '',
            // @ts-ignore
            transfer_type: 'direct_transfer'
        });
        loadData();
    }
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    const success = await FundAccountingService.approveTransfer(id, user.id);
    if (success) {
        toast.success('Transfer approved and posted to General Ledger');
        loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'approved': return <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle size={14}/> Approved</span>;
        case 'pending': return <span className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-1 rounded-full"><Clock size={14}/> Pending Approval</span>;
        case 'rejected': return <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded-full"><XCircle size={14}/> Rejected</span>;
        default: return status;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inter-departmental Transfers</h1>
          <p className="text-gray-500 mt-0.5">Manage internal loans, balance transfers, and repayments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus size={18} />
          New Transfer Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-indigo-50 text-indigo-600 w-fit rounded-xl mb-4">
                <ArrowRightLeft size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Pending Approvals</p>
            <p className="text-2xl font-bold text-gray-900">{transfers.filter(t => t.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-emerald-50 text-emerald-600 w-fit rounded-xl mb-4">
                <TrendingUp size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Total Internal Volume</p>
            <p className="text-2xl font-bold text-gray-900">KES {transfers.filter(t => t.status === 'approved').reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="p-3 bg-amber-50 text-amber-600 w-fit rounded-xl mb-4">
                <Wallet size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Active Internal Loans</p>
            <p className="text-2xl font-bold text-gray-900">
                {/* @ts-ignore */}
                {transfers.filter(t => t.status === 'approved' && t.transfer_type === 'internal_loan').length}
            </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Date / Type</th>
              <th className="px-6 py-4 font-semibold">Source Dept</th>
              <th className="px-6 py-4 font-semibold">Dest Dept</th>
              <th className="px-6 py-4 font-semibold">Amount</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 animate-pulse">Loading transfers...</td></tr>
            ) : transfers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-500 italic">No transfers recorded yet</td></tr>
            ) : transfers.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{new Date(t.transfer_date).toLocaleDateString()}</div>
                        {/* @ts-ignore */}
                        <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">{(t.transfer_type || 'direct_transfer').replace('_', ' ')}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{departments.find(d => d.id === t.from_department_id)?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{departments.find(d => d.id === t.to_department_id)?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">KES {Number(t.amount).toLocaleString()}</td>
                    <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                    <td className="px-6 py-4 text-right">
                        {t.status === 'pending' && (
                            <button 
                                onClick={() => handleApprove(t.id)}
                                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors"
                            >
                                Approve
                            </button>
                        )}
                    </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                    <h2 className="text-xl font-bold text-gray-900">New Transfer Request</h2>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Type</label>
                        <select 
                            className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            // @ts-ignore
                            value={formData.transfer_type}
                            onChange={e => setFormData({ ...formData, transfer_type: e.target.value as any })}
                        >
                            <option value="direct_transfer">Direct Balance Transfer</option>
                            <option value="internal_loan">Internal Loan (Track Payable/Receivable)</option>
                            <option value="loan_repayment">Loan Repayment</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source Dept.</label>
                            <select 
                                required
                                className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                value={formData.from_department_id}
                                onChange={e => setFormData({ ...formData, from_department_id: e.target.value })}
                            >
                                <option value="">Select Source</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Dept.</label>
                            <select 
                                required
                                className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                value={formData.to_department_id}
                                onChange={e => setFormData({ ...formData, to_department_id: e.target.value })}
                            >
                                <option value="">Select Dest</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                        <input 
                            type="number" required min={1}
                            className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-3 font-bold text-xl"
                            value={formData.amount || ''}
                            onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            required rows={2}
                            className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Reason for transfer or loan details..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Submit Request</button>
                        <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default InternalTransfers;
