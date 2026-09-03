import React, { useState, useEffect } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { Building2, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, FundAccount, DonorCluster } from '../../types';
import { Users } from 'lucide-react';

type Tab = 'departments' | 'funds' | 'clusters';

const DepartmentsAndFunds: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [clusters, setClusters] = useState<DonorCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [deptForm, setDeptForm] = useState<Partial<Department>>({ name: '', description: '' });
  const [fundForm, setFundForm] = useState<Partial<FundAccount>>({
    name: '', code: '', description: '', restriction_type: 'unrestricted'
  });
  const [clusterForm, setClusterForm] = useState<Partial<DonorCluster>>({ name: '', description: '' });

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

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await FundAccountingService.createDepartment(deptForm);
    if (result) {
      toast.success('Department created successfully');
      setShowModal(false);
      setDeptForm({ name: '', description: '' });
      loadData();
    } else {
      toast.error('Failed to create department');
    }
  };

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await FundAccountingService.createFundAccount(fundForm);
    if (result) {
      toast.success('Fund Account created successfully');
      setShowModal(false);
      setFundForm({ name: '', code: '', description: '', restriction_type: 'unrestricted' });
      loadData();
    } else {
      toast.error('Failed to create fund account');
    }
  };

  const handleClusterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await FundAccountingService.createDonorCluster(clusterForm);
    if (result) {
      toast.success('Donor Cluster created successfully');
      setShowModal(false);
      setClusterForm({ name: '', description: '' });
      loadData();
    } else {
      toast.error('Failed to create donor cluster');
    }
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

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments & Fund Accounts</h1>
          <p className="text-gray-500 mt-0.5">Manage cost centers, program funds, and donor clusters</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
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
                    <td colSpan={4} className="px-6 py-5">
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    </td>
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
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fund Accounts Tab */}
      {activeTab === 'funds' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
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
                    <td colSpan={5} className="px-6 py-5">
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    </td>
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
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Donor Clusters Tab */}
      {activeTab === 'clusters' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
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
                    <td colSpan={3} className="px-6 py-5">
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    </td>
                  </tr>
                ))
              ) : clusters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <p className="font-semibold text-gray-700">No donor clusters yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create a donor cluster to categorize your donors</p>
                  </td>
                </tr>
              ) : clusters.map(cluster => (
                <tr key={cluster.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">{cluster.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cluster.description || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/60">
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === 'departments' ? 'Create Department' : 'Create Fund Account'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            {activeTab === 'departments' ? (
              <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department Name <span className="text-red-500">*</span></label>
                  <input
                    type="text" required
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Education Department"
                    value={deptForm.name}
                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe the purpose and scope of this department..."
                    value={deptForm.description || ''}
                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    Create Department
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">
                    Cancel
                  </button>
                </div>
              </form>
            ) : activeTab === 'funds' ? (
              <form onSubmit={handleFundSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fund Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. Education Fund"
                      value={fundForm.name}
                      onChange={e => setFundForm({ ...fundForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fund Code <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                      placeholder="e.g. FUND-EDU"
                      value={fundForm.code}
                      onChange={e => setFundForm({ ...fundForm, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Restriction Type <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    value={fundForm.restriction_type}
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
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe the fund's purpose and any restrictions..."
                    value={fundForm.description || ''}
                    onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    Create Fund Account
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleClusterSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cluster Name <span className="text-red-500">*</span></label>
                  <input
                    type="text" required
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Individual Monthly Donors"
                    value={clusterForm.name}
                    onChange={e => setClusterForm({ ...clusterForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe this donor cluster..."
                    value={clusterForm.description || ''}
                    onChange={e => setClusterForm({ ...clusterForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                    Create Donor Cluster
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
    </div>
  );
};

export default DepartmentsAndFunds;
