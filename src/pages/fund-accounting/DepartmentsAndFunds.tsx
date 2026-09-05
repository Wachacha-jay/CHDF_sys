import React, { useState, useEffect } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { Building2, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, FundAccount, DonorCluster } from '../../types';
import { Users } from 'lucide-react';

type Tab = 'departments' | 'funds' | 'clusters';

const emptyDept = { name: '', description: '' };
const emptyFund = { name: '', code: '', description: '', restriction_type: 'unrestricted' as const };
const emptyCluster = { name: '', description: '' };

const DepartmentsAndFunds: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [clusters, setClusters] = useState<DonorCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; type: Tab } | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState<Partial<Department>>(emptyDept);
  const [fundForm, setFundForm] = useState<Partial<FundAccount>>(emptyFund);
  const [clusterForm, setClusterForm] = useState<Partial<DonorCluster>>(emptyCluster);

  const loadData = async () => {
    setLoading(true);
    const [dList, fList, cList] = await Promise.all([
      FundAccountingService.getDepartments(),
      FundAccountingService.getFundAccounts(),
      FundAccountingService.getDonorClusters()
    ]);
    setDepartments(dList);
    setFunds(fList);
    setClusters(cList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setDeptForm(emptyDept);
    setFundForm(emptyFund);
    setClusterForm(emptyCluster);
    setShowModal(true);
  };

  const openEdit = (item: Department | FundAccount | DonorCluster, type: Tab) => {
    setEditingId(item.id);
    if (type === 'departments') setDeptForm(item as Department);
    if (type === 'funds') setFundForm(item as FundAccount);
    if (type === 'clusters') setClusterForm(item as DonorCluster);
    setShowModal(true);
  };

  // ── Department Submit ──────────────────────────────────────────────────────
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    if (editingId) {
      ok = await FundAccountingService.updateDepartment(editingId, deptForm);
      if (ok) toast.success('Department updated');
    } else {
      const result = await FundAccountingService.createDepartment(deptForm);
      ok = !!result;
      if (ok) toast.success('Department created');
    }
    if (ok) { setShowModal(false); loadData(); }
    else toast.error('Failed to save department');
  };

  // ── Fund Account Submit ────────────────────────────────────────────────────
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    if (editingId) {
      ok = await FundAccountingService.updateFundAccount(editingId, fundForm);
      if (ok) toast.success('Fund account updated');
    } else {
      const result = await FundAccountingService.createFundAccount(fundForm);
      ok = !!result;
      if (ok) toast.success('Fund account created');
    }
    if (ok) { setShowModal(false); loadData(); }
    else toast.error('Failed to save fund account');
  };

  // ── Cluster Submit ─────────────────────────────────────────────────────────
  const handleClusterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    if (editingId) {
      ok = await FundAccountingService.updateDonorCluster(editingId, clusterForm);
      if (ok) toast.success('Donor cluster updated');
    } else {
      const result = await FundAccountingService.createDonorCluster(clusterForm);
      ok = !!result;
      if (ok) toast.success('Donor cluster created');
    }
    if (ok) { setShowModal(false); loadData(); }
    else toast.error('Failed to save cluster');
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    let ok = false;
    if (deleteConfirm.type === 'departments') ok = await FundAccountingService.deleteDepartment(deleteConfirm.id);
    if (deleteConfirm.type === 'funds') ok = await FundAccountingService.deleteFundAccount(deleteConfirm.id);
    if (deleteConfirm.type === 'clusters') ok = await FundAccountingService.deleteDonorCluster(deleteConfirm.id);
    if (ok) { toast.success('Deleted successfully'); setDeleteConfirm(null); loadData(); }
    else toast.error('Failed to delete');
  };

  const restrictionBadge = (type: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      unrestricted: { label: 'Unrestricted', cls: 'bg-emerald-100 text-emerald-700' },
      temporarily_restricted: { label: 'Temp. Restricted', cls: 'bg-amber-100 text-amber-700' },
      permanently_restricted: { label: 'Perm. Restricted', cls: 'bg-rose-100 text-rose-700' },
    };
    const { label, cls } = map[type] || { label: type, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
  };

  const actionBtns = (item: Department | FundAccount | DonorCluster, type: Tab) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => openEdit(item, type)}
        className="p-2 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
        title="Edit"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() => setDeleteConfirm({ id: item.id, name: item.name, type })}
        className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
        title="Delete"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  const modalTitle = () => {
    const action = editingId ? 'Edit' : 'Create';
    if (activeTab === 'departments') return `${action} Department`;
    if (activeTab === 'funds') return `${action} Fund Account`;
    return `${action} Donor Cluster`;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments &amp; Fund Accounts</h1>
          <p className="text-gray-500 mt-0.5">Manage cost centers, program funds, and donor clusters</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          {activeTab === 'departments' ? 'New Department' : activeTab === 'funds' ? 'New Fund Account' : 'New Donor Cluster'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-200 w-fit">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'departments' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Departments ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('funds')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'funds' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Fund Accounts ({funds.length})
        </button>
        <button
          onClick={() => setActiveTab('clusters')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'clusters' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Donor Clusters ({clusters.length})
        </button>
      </div>

      {/* ── DEPARTMENTS TABLE ─────────────────────────────────────────── */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[650px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-5"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  </tr>
                ))
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <Building2 className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="font-semibold text-gray-700">No departments yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first department to start tracking cost centers</p>
                  </td>
                </tr>
              ) : departments.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        {dept.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{dept.description || '—'}</td>
                  <td className="px-6 py-4">
                    {dept.is_active ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <CheckCircle size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-sm font-medium">
                        <XCircle size={14} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">{actionBtns(dept, 'departments')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── FUND ACCOUNTS TABLE ──────────────────────────────────────── */}
      {activeTab === 'funds' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[750px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Fund Name</th>
                <th className="px-6 py-4 font-semibold">Code</th>
                <th className="px-6 py-4 font-semibold">Restriction Type</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-5"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  </tr>
                ))
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="font-semibold text-gray-700">No fund accounts yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create a fund account to start tracking restricted and unrestricted donations</p>
                  </td>
                </tr>
              ) : funds.map(fund => (
                <tr key={fund.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">{fund.name}</td>
                  <td className="px-6 py-4 font-mono text-sm text-indigo-600">{fund.code}</td>
                  <td className="px-6 py-4">{restrictionBadge(fund.restriction_type)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{fund.description || '—'}</td>
                  <td className="px-6 py-4 text-right">{actionBtns(fund, 'funds')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── DONOR CLUSTERS TABLE ─────────────────────────────────────── */}
      {activeTab === 'clusters' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[650px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Cluster Name</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={3} className="px-6 py-5"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  </tr>
                ))
              ) : clusters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <Users className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="font-semibold text-gray-700">No donor clusters yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create a donor cluster to categorize your donors</p>
                  </td>
                </tr>
              ) : clusters.map(cluster => (
                <tr key={cluster.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                        {cluster.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900">{cluster.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cluster.description || '—'}</td>
                  <td className="px-6 py-4 text-right">{actionBtns(cluster, 'clusters')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/60">
              <h2 className="text-xl font-bold text-gray-900">{modalTitle()}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            {/* Departments Form */}
            {activeTab === 'departments' && (
              <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department Name <span className="text-red-500">*</span></label>
                  <input
                    type="text" required
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. Education Department"
                    value={deptForm.name || ''}
                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe the purpose and scope of this department..."
                    value={deptForm.description || ''}
                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
                {editingId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                      value={deptForm.is_active ? '1' : '0'}
                      onChange={e => setDeptForm({ ...deptForm, is_active: e.target.value === '1' })}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    {editingId ? 'Update Department' : 'Create Department'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Fund Accounts Form */}
            {activeTab === 'funds' && (
              <form onSubmit={handleFundSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fund Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Education Fund"
                      value={fundForm.name || ''}
                      onChange={e => setFundForm({ ...fundForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fund Code <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-mono focus:border-transparent"
                      placeholder="e.g. FUND-EDU"
                      value={fundForm.code || ''}
                      onChange={e => setFundForm({ ...fundForm, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Restriction Type <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    value={fundForm.restriction_type || 'unrestricted'}
                    onChange={e => setFundForm({ ...fundForm, restriction_type: e.target.value as any })}
                  >
                    <option value="unrestricted">Unrestricted — can be used for any purpose</option>
                    <option value="temporarily_restricted">Temporarily Restricted — specific purpose, limited time</option>
                    <option value="permanently_restricted">Permanently Restricted — principal must be maintained</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe the fund's purpose and any restrictions..."
                    value={fundForm.description || ''}
                    onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    {editingId ? 'Update Fund Account' : 'Create Fund Account'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Donor Clusters Form */}
            {activeTab === 'clusters' && (
              <form onSubmit={handleClusterSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cluster Name <span className="text-red-500">*</span></label>
                  <input
                    type="text" required
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. Individual Monthly Donors"
                    value={clusterForm.name || ''}
                    onChange={e => setClusterForm({ ...clusterForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe this donor cluster..."
                    value={clusterForm.description || ''}
                    onChange={e => setClusterForm({ ...clusterForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    {editingId ? 'Update Donor Cluster' : 'Create Donor Cluster'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete "{deleteConfirm.name}"?</h3>
            <p className="text-gray-500 text-sm mb-6">This will permanently remove this record. This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsAndFunds;
