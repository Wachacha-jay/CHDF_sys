import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, PackageSearch, Building2, Cpu, Wrench, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FixedAssetService } from '../../services/fixedAssetService';
import { ApiService } from '../../services/api';
import type { FixedAsset, Department } from '../../types';

const ASSET_TYPES = [
  'Equipment & Machinery',
  'Furniture & Fixtures',
  'Buildings & Infrastructure',
  'Computer & Technology',
  'Vehicles',
  'Other',
];

const emptyForm = {
  asset_name: '',
  description: '',
  serial_number: '',
  asset_type: 'Equipment & Machinery',
  purchase_date: new Date().toISOString().split('T')[0],
  purchase_cost: '',
  current_value: '',
  salvage_value: '',
  useful_life_years: '5',
  department_id: '',
  status: 'Active' as const,
};

const FixedAssets: React.FC = () => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAsset) {
      setFormData({
        asset_name: selectedAsset.asset_name,
        description: selectedAsset.description || '',
        serial_number: selectedAsset.serial_number || '',
        asset_type: selectedAsset.asset_type || 'Equipment & Machinery',
        purchase_date: selectedAsset.purchase_date.split('T')[0],
        purchase_cost: String(selectedAsset.purchase_cost),
        current_value: String(selectedAsset.current_value),
        salvage_value: String(selectedAsset.salvage_value || 0),
        useful_life_years: String(selectedAsset.useful_life_years || 5),
        department_id: selectedAsset.department_id || '',
        status: selectedAsset.status,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [selectedAsset, showModal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsData, deptsRes] = await Promise.all([
        FixedAssetService.getAll(),
        ApiService.get<Department>('departments', { filters: { is_active: true } })
      ]);
      setAssets(assetsData);
      if (deptsRes.success && deptsRes.data) setDepartments(deptsRes.data);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setSelectedAsset(null); setShowModal(true); };
  const openEdit = (asset: FixedAsset) => { setSelectedAsset(asset); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.asset_name || !formData.purchase_date || !formData.purchase_cost) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        purchase_cost: parseFloat(formData.purchase_cost) || 0,
        current_value: parseFloat(formData.current_value || formData.purchase_cost) || 0,
        salvage_value: parseFloat(formData.salvage_value) || 0,
        useful_life_years: parseInt(formData.useful_life_years) || 5,
        department_id: formData.department_id || null,
        serial_number: formData.serial_number || null,
        description: formData.description || null,
      };

      let result;
      if (selectedAsset) {
        result = await FixedAssetService.update(selectedAsset.id, payload);
        if (result) toast.success('Asset updated successfully');
      } else {
        result = await FixedAssetService.create(payload);
        if (result) toast.success('Asset added successfully');
      }

      if (result) {
        setShowModal(false);
        loadData();
      } else {
        toast.error('Failed to save asset');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await FixedAssetService.delete(id);
    if (ok) {
      toast.success('Asset deleted');
      setDeleteConfirm(null);
      loadData();
    } else {
      toast.error('Failed to delete asset');
    }
  };

  const filtered = assets.filter(a => {
    const matchSearch = a.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.serial_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalValue = filtered.reduce((sum, a) => sum + Number(a.current_value), 0);
  const totalCost = filtered.reduce((sum, a) => sum + Number(a.purchase_cost), 0);

  const getStatusBadge = (status: string) => {
    if (status === 'Active') return <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full"><CheckCircle size={12}/> Active</span>;
    if (status === 'Maintenance') return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full"><Wrench size={12}/> Maintenance</span>;
    return <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">Disposed</span>;
  };

  const getTypeIcon = (type?: string) => {
    if (!type) return <PackageSearch size={16} className="text-gray-400" />;
    if (type.includes('Computer')) return <Cpu size={16} className="text-blue-500"/>;
    if (type.includes('Building')) return <Building2 size={16} className="text-indigo-500"/>;
    if (type.includes('Equipment')) return <Wrench size={16} className="text-orange-500"/>;
    return <PackageSearch size={16} className="text-gray-400" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Asset Register</h1>
          <p className="text-sm text-gray-500 mt-1">Track all NGO assets, equipment, and donations in one place</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add Asset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Original Cost</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">KES {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Current Value</p>
          <p className="text-2xl font-bold text-green-600 mt-1">KES {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm items-center">
        <input
          type="text"
          placeholder="Search by name or serial number..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 border"
        />
        <div className="flex gap-2">
          {['All', 'Active', 'Maintenance', 'Disposed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filterStatus === s ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost (KES)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Value (KES)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-gray-400">
                    <PackageSearch size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="font-medium text-gray-500">No assets found</p>
                    <p className="text-sm">Click "Add Asset" to register your first fixed asset</p>
                  </td>
                </tr>
              ) : filtered.map(asset => (
                <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{asset.asset_name}</div>
                    {asset.serial_number && <div className="text-xs text-gray-400">S/N: {asset.serial_number}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      {getTypeIcon(asset.asset_type)}
                      {asset.asset_type || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {departments.find(d => d.id === asset.department_id)?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(asset.purchase_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{Number(asset.purchase_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-700 text-right">{Number(asset.current_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">{getStatusBadge(asset.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(asset)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => setDeleteConfirm(asset.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{selectedAsset ? 'Edit Asset' : 'Register New Asset'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.asset_name} onChange={e => setFormData({ ...formData, asset_name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="e.g. Samsung Washing Machine" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                  <select value={formData.asset_type} onChange={e => setFormData({ ...formData, asset_type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500">
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number (Optional)</label>
                  <input type="text" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="e.g. SN-12345" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase / Donation Date <span className="text-red-500">*</span></label>
                  <input type="date" required value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500">
                    <option value="">— Not Assigned —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase / Market Value (KES) <span className="text-red-500">*</span></label>
                  <input type="number" required min="0" step="0.01" value={formData.purchase_cost} onChange={e => setFormData({ ...formData, purchase_cost: e.target.value, current_value: formData.current_value || e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Value (KES)</label>
                  <input type="number" min="0" step="0.01" value={formData.current_value} onChange={e => setFormData({ ...formData, current_value: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salvage Value (KES)</label>
                  <input type="number" min="0" step="0.01" value={formData.salvage_value} onChange={e => setFormData({ ...formData, salvage_value: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Useful Life (Years)</label>
                  <input type="number" min="1" value={formData.useful_life_years} onChange={e => setFormData({ ...formData, useful_life_years: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500">
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="Additional notes about this asset..." />
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>
              <button onClick={handleSubmit as any} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm disabled:opacity-60">
                {saving ? 'Saving...' : selectedAsset ? 'Update Asset' : 'Register Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Asset?</h3>
            <p className="text-gray-500 text-sm mb-6">This will permanently remove this asset from the register. This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssets;
