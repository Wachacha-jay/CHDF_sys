import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import { 
  ArrowRightLeft, Plus, CheckCircle, Clock, XCircle, TrendingUp, Wallet, 
  Calendar, Building2, Landmark, AlertCircle, Edit2, Trash2, Send, FileText, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, InternalTransfer, Account } from '../../types';
import { useAuthContext } from '../../contexts/useAuthContext';
import { BankBalanceOverview } from '../../components/fund-accounting/BankBalanceOverview';

const InternalTransfers: React.FC = () => {
  const { user } = useAuthContext();
  const location = useLocation();
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [bankBalances, setBankBalances] = useState<Array<{ account: Account; balance: number; currency: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'pending' | 'approved' | 'rejected'>('all');
  const [editingTransfer, setEditingTransfer] = useState<InternalTransfer | null>(null);

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
      const [tResponse, dList, rawAccounts, liveBankBalances] = await Promise.all([
        ApiService.get<InternalTransfer>('internal_transfers', {
          orderBy: { column: 'transfer_date', ascending: false }
        }),
        FundAccountingService.getDepartments(),
        AccountingService.getAccounts(),
        FundAccountingService.getBankAndCashBalances()
      ]);

      setTransfers(tResponse.success ? (tResponse.data || []) : []);
      setDepartments(dList || []);
      setBankBalances(liveBankBalances || []);

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

  useEffect(() => { 
    loadData(); 
  }, [refreshTrigger]);

  useEffect(() => {
    if (location.state?.preselectedSourceBankId) {
      setFormData(prev => ({ ...prev, from_bank_account_id: location.state.preselectedSourceBankId }));
      setShowModal(true);
    }
  }, [location.state]);

  const openCreateModal = () => {
    setEditingTransfer(null);
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
    setShowModal(true);
  };

  const openEditModal = (t: InternalTransfer) => {
    setEditingTransfer(t);
    setFormData({
      from_department_id: t.from_department_id,
      to_department_id: t.to_department_id,
      from_bank_account_id: t.from_bank_account_id || '',
      to_bank_account_id: t.to_bank_account_id || '',
      amount: Number(t.amount || 0),
      transfer_date: t.transfer_date ? new Date(t.transfer_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: t.description || '',
      transfer_type: t.transfer_type || 'direct_transfer'
    });
    setShowModal(true);
  };

  const handleSaveTransfer = async (statusToSave: 'draft' | 'pending') => {
    if (formData.from_department_id === formData.to_department_id) {
      toast.error('Source and destination departments must be different');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }
    if (!formData.from_department_id || !formData.to_department_id) {
      toast.error('Please select both source and destination departments');
      return;
    }

    const payload: Partial<InternalTransfer> = {
      ...formData,
      status: statusToSave,
      from_bank_account_id: formData.from_bank_account_id || undefined,
      to_bank_account_id: formData.to_bank_account_id || undefined
    };

    if (editingTransfer) {
      const result = await FundAccountingService.updateTransfer(editingTransfer.id, payload);
      if (result) {
        toast.success(statusToSave === 'draft' ? 'Draft transfer updated' : 'Transfer updated & submitted for approval');
        setShowModal(false);
        setEditingTransfer(null);
        loadData();
      } else {
        toast.error('Failed to update transfer');
      }
    } else {
      const result = await FundAccountingService.recordTransfer(payload);
      if (result) {
        toast.success(statusToSave === 'draft' ? 'Transfer saved as draft' : 'Transfer request submitted for approval');
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
        toast.error('Failed to save transfer request. Please try again.');
      }
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transfer request?')) return;
    setActionLoadingId(id);
    try {
      const success = await FundAccountingService.deleteTransfer(id);
      if (success) {
        toast.success('Transfer deleted');
        loadData();
      } else {
        toast.error('Failed to delete transfer');
      }
    } catch {
      toast.error('Error deleting transfer');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmitDraft = async (transfer: InternalTransfer) => {
    setActionLoadingId(transfer.id);
    try {
      const result = await FundAccountingService.updateTransfer(transfer.id, { status: 'pending' });
      if (result) {
        toast.success('Draft transfer submitted for approval');
        loadData();
      } else {
        toast.error('Failed to submit draft');
      }
    } catch {
      toast.error('Error submitting draft');
    } finally {
      setActionLoadingId(null);
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
      case 'draft':
        return <span className="flex items-center gap-1 text-slate-700 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200"><FileText size={13} /> Draft</span>;
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
          onClick={openCreateModal}
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

      {/* Live Bank Balances Overview: Treasury snapshot for transfers */}
      <BankBalanceOverview
        refreshTrigger={refreshTrigger}
        onInitiateTransfer={(sourceBankId) => {
          if (sourceBankId) {
            setFormData(prev => ({ ...prev, from_bank_account_id: sourceBankId }));
          }
          openCreateModal();
        }}
        showTransferAction={true}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Toolbar: Filter Tabs & Refresh */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-gray-200 overflow-x-auto max-w-full">
            {(['all', 'draft', 'pending', 'approved', 'rejected'] as const).map(s => {
              const count = s === 'all' ? transfers.length : transfers.filter(t => t.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filterStatus === s 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span className="capitalize">{s === 'all' ? 'All Transfers' : s}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filterStatus === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh transfers list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>

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
              ) : transfers.filter(t => filterStatus === 'all' || t.status === filterStatus).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-gray-400 italic">No transfers found for this filter</td></tr>
              ) : transfers
                .filter(t => filterStatus === 'all' || t.status === filterStatus)
                .map(t => {
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
                      {t.status === 'draft' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSubmitDraft(t)}
                            disabled={actionLoadingId === t.id}
                            title="Submit Draft for Approval"
                            className="flex items-center gap-1 bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>Submit</span>
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            title="Edit Draft"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransfer(t.id)}
                            disabled={actionLoadingId === t.id}
                            title="Delete Draft"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {t.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
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
                            className="bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-rose-100 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            title="Edit Request"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransfer(t.id)}
                            disabled={actionLoadingId === t.id}
                            title="Delete Request"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {t.status === 'rejected' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(t)}
                            title="Edit and Re-submit"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransfer(t.id)}
                            disabled={actionLoadingId === t.id}
                            title="Delete Rejected Transfer"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {t.status === 'approved' && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                          GL Posted ✓
                        </span>
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
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingTransfer ? 'Edit Transfer Request' : 'New Transfer Request'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingTransfer ? `Editing ${editingTransfer.status} transfer record` : 'Specify departments and paying / receiving bank accounts'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingTransfer(null); }} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveTransfer('pending'); }} className="p-6 space-y-4">
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
                      Paid From (Source Bank)
                    </span>
                  </label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border text-xs font-medium"
                    value={formData.from_bank_account_id || ''}
                    onChange={e => setFormData({ ...formData, from_bank_account_id: e.target.value })}
                  >
                    <option value="">Default Operating Account</option>
                    {bankAccounts.map(acc => {
                      const bInfo = bankBalances.find(b => b.account.id === acc.id);
                      const balStr = bInfo ? ` (Bal: KES ${bInfo.balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : '';
                      return (
                        <option key={acc.id} value={acc.id}>
                          [{acc.code}] {acc.name}{balStr}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const bInfo = bankBalances.find(b => b.account.id === formData.from_bank_account_id);
                    if (bInfo) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-lg mt-1.5">
                          <Wallet size={12} />
                          <span>Available: KES {bInfo.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    }
                    return <span className="text-[11px] text-gray-400 mt-0.5 block">Bank being credited (Outflow)</span>;
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Landmark size={15} className="text-emerald-600" />
                      Paid To (Destination Bank)
                    </span>
                  </label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border text-xs font-medium"
                    value={formData.to_bank_account_id || ''}
                    onChange={e => setFormData({ ...formData, to_bank_account_id: e.target.value })}
                  >
                    <option value="">Default Operating Account</option>
                    {bankAccounts.map(acc => {
                      const bInfo = bankBalances.find(b => b.account.id === acc.id);
                      const balStr = bInfo ? ` (Bal: KES ${bInfo.balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : '';
                      return (
                        <option key={acc.id} value={acc.id}>
                          [{acc.code}] {acc.name}{balStr}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const bInfo = bankBalances.find(b => b.account.id === formData.to_bank_account_id);
                    if (bInfo) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-lg mt-1.5">
                          <Landmark size={12} />
                          <span>Current Bal: KES {bInfo.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    }
                    return <span className="text-[11px] text-gray-400 mt-0.5 block">Bank receiving funds (Inflow)</span>;
                  })()}
                </div>
              </div>

              {/* Warning if transfer exceeds available balance */}
              {(() => {
                const sourceAcc = bankBalances.find(b => b.account.id === formData.from_bank_account_id);
                if (sourceAcc && Number(formData.amount || 0) > sourceAcc.balance && sourceAcc.balance > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Caution: Transfer amount exceeds available bank balance</span>
                        <p className="mt-0.5 text-amber-700">
                          Transfer amount (KES {Number(formData.amount).toLocaleString()}) exceeds the available balance in {sourceAcc.account.name} (KES {sourceAcc.balance.toLocaleString()}).
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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

              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleSaveTransfer('draft')}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <FileText size={16} />
                  <span>Save as Draft</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Send size={16} />
                  <span>{editingTransfer ? 'Update & Submit' : 'Submit for Approval'}</span>
                </button>
                <button
                  type="button" 
                  onClick={() => { setShowModal(false); setEditingTransfer(null); }}
                  className="px-5 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl text-sm"
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
