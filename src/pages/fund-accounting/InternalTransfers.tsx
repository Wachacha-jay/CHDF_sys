import React, { useState, useEffect } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import { ArrowRightLeft, Plus, CheckCircle, Clock, XCircle, TrendingUp, Wallet, Calendar, Building2, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, InternalTransfer, Account } from '../../types';
import { useAuthContext } from '../../contexts/useAuthContext';

const InternalTransfers: React.FC = () => {
  const { user } = useAuthContext();
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<InternalTransfer>>({
    from_department_id: '',
    to_department_id: '',
    from_bank_account_id: '',
    to_bank_account_id: '',
    amount: 0,
    transfer_date: new Date().toISOString().split('T')[0],
    description: '',
    transfer_type: 'direct_transfer'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [tResponse, dList, rawAccounts] = await Promise.all([
        ApiService.get<InternalTransfer>('internal_transfers', {
          orderBy: { column: 'transfer_date', ascending: false }
        }),
        FundAccountingService.getDepartments(),
        AccountingService.getAccounts()
      ]);

      setTransfers(tResponse.success ? (tResponse.data || []) : []);
      setDepartments(dList || []);

      const flat = AccountingService.flattenAccounts(rawAccounts || []);
      const assets = flat.filter(a => a.account_type === 'asset' || a.code?.startsWith('1'));
      setBankAccounts(assets);
    } catch (err) {
      console.error('Failed to load transfers data:', err);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.from_department_id === formData.to_department_id) {
      toast.error('Source and destination departments must be different');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }

    const payload: Partial<InternalTransfer> = {
      ...formData,
      from_bank_account_id: formData.from_bank_account_id || undefined,
      to_bank_account_id: formData.to_bank_account_id || undefined
    };

    const result = await FundAccountingService.recordTransfer(payload);
    if (result) {
      toast.success('Transfer request submitted for approval');
      setShowModal(false);
      setFormData({
        from_department_id: '',
        to_department_id: '',
        from_bank_account_id: '',
        to_bank_account_id: '',
        amount: 0,
        transfer_date: new Date().toISOString().split('T')[0],
        description: '',
        transfer_type: 'direct_transfer'
      });
      loadData();
    } else {
      toast.error('Failed to submit transfer request. Please try again.');
    }
  };

  const handleApprove = async (id: string) => {
    const approverId = user?.id || 'system-admin';
    setActionLoadingId(id);
    try {
      const result = await FundAccountingService.approveTransfer(id, approverId);
      if (result.success) {
        toast.success('Transfer approved and posted to General Ledger');
        loadData();
      } else {
        toast.error(result.error || 'Approval failed. Please check the server logs.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error processing transfer approval');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this transfer request?')) return;
    setActionLoadingId(id);
    try {
      const res = await ApiService.update('internal_transfers', id, { status: 'rejected' });
      if (res.success) {
        toast.success('Transfer rejected');
        loadData();
      } else {
        toast.error('Failed to reject transfer');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error rejecting transfer');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full"><CheckCircle size={14} /> Approved</span>;
      case 'pending':
        return <span className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-full"><Clock size={14} /> Pending Approval</span>;
      case 'rejected':
        return <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-full"><XCircle size={14} /> Rejected</span>;
      default:
        return <span className="text-gray-500 font-medium text-xs capitalize">{status}</span>;
    }
  };

  const getBankName = (accountId?: string) => {
    if (!accountId) return null;
    const acc = bankAccounts.find(a => a.id === accountId);
    return acc ? `[${acc.code}] ${acc.name}` : null;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inter-departmental Transfers</h1>
          <p className="text-gray-500 mt-0.5">Manage departmental loans, repayments, and bank-to-bank transfers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 w-fit"
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
            {transfers.filter(t => t.status === 'approved' && t.transfer_type === 'internal_loan').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[950px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Date / Type</th>
                <th className="px-6 py-4 font-semibold">Source (Dept & Bank)</th>
                <th className="px-6 py-4 font-semibold">Destination (Dept & Bank)</th>
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
              ) : transfers.map(t => {
                const sourceBankName = getBankName(t.from_bank_account_id);
                const destBankName = getBankName(t.to_bank_account_id);

                return (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{new Date(t.transfer_date).toLocaleDateString()}</div>
                      <div className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">{(t.transfer_type || 'direct_transfer').replace(/_/g, ' ')}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400 max-w-xs truncate mt-0.5" title={t.description}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-semibold">{departments.find(d => d.id === t.from_department_id)?.name || 'Unknown Dept'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Landmark size={12} className="text-indigo-400 flex-shrink-0" />
                        <span>{sourceBankName || 'Default Operating Account'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-semibold">{departments.find(d => d.id === t.to_department_id)?.name || 'Unknown Dept'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Landmark size={12} className="text-emerald-400 flex-shrink-0" />
                        <span>{destBankName || 'Default Operating Account'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                      KES {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                    <td className="px-6 py-4 text-right">
                      {t.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(t.id)}
                            disabled={actionLoadingId === t.id}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {actionLoadingId === t.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(t.id)}
                            disabled={actionLoadingId === t.id}
                            className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-rose-100 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">New Transfer Request</h2>
                  <p className="text-xs text-gray-500">Specify departments and paying / receiving bank accounts</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Type</label>
                <select
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border"
                  value={formData.transfer_type}
                  onChange={e => setFormData({ ...formData, transfer_type: e.target.value as any })}
                >
                  <option value="direct_transfer">Direct Balance Transfer</option>
                  <option value="internal_loan">Internal Loan (Track Payable / Receivable)</option>
                  <option value="loan_repayment">Loan Repayment</option>
                </select>
              </div>

              {/* Department Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Department <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border font-medium"
                    value={formData.from_department_id}
                    onChange={e => setFormData({ ...formData, from_department_id: e.target.value })}
                  >
                    <option value="">Select Source Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination Department <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border font-medium"
                    value={formData.to_department_id}
                    onChange={e => setFormData({ ...formData, to_department_id: e.target.value })}
                  >
                    <option value="">Select Destination Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Bank Selection (From & To) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Landmark size={15} className="text-indigo-600" />
                      Paid From (Source Bank / Account)
                    </span>
                  </label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border text-sm font-medium"
                    value={formData.from_bank_account_id || ''}
                    onChange={e => setFormData({ ...formData, from_bank_account_id: e.target.value })}
                  >
                    <option value="">Default Operating Account</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.code}] {acc.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">Bank being debited/paid from</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Landmark size={15} className="text-emerald-600" />
                      Paid To (Destination Bank / Account)
                    </span>
                  </label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border text-sm font-medium"
                    value={formData.to_bank_account_id || ''}
                    onChange={e => setFormData({ ...formData, to_bank_account_id: e.target.value })}
                  >
                    <option value="">Default Operating Account</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.code}] {acc.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">Bank receiving the funds</span>
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) <span className="text-red-500">*</span></label>
                  <input
                    type="number" required min={1}
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 px-3 font-bold text-xl border"
                    placeholder="0.00"
                    value={formData.amount || ''}
                    onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date" required
                      className="w-full pl-9 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border"
                      value={formData.transfer_date}
                      onChange={e => setFormData({ ...formData, transfer_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason <span className="text-red-500">*</span></label>
                <textarea
                  required rows={2}
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 border p-2 text-sm"
                  placeholder="Reason for transfer or internal loan details..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  Submit Request
                </button>
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalTransfers;
