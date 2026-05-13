import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Scale, Search } from 'lucide-react';
import { ApiService } from '../../services/api';
import { UnitOfMeasure } from '../../types';
import toast from 'react-hot-toast';

const UnitsSettings: React.FC = () => {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get<UnitOfMeasure>('units_of_measure');
      if (response.success) {
        setUnits(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load units');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        await ApiService.update('units_of_measure', editingUnit.id, formData);
        toast.success('Unit updated');
      } else {
        await ApiService.create('units_of_measure', formData);
        toast.success('Unit created');
      }
      setShowModal(false);
      loadUnits();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this unit? Products using it might be affected.')) return;
    try {
      await ApiService.delete('units_of_measure', id);
      toast.success('Unit deleted');
      loadUnits();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const openModal = (unit?: UnitOfMeasure) => {
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        name: unit.name,
        symbol: unit.symbol,
        description: unit.description || '',
        is_active: unit.is_active
      });
    } else {
      setEditingUnit(null);
      setFormData({ name: '', symbol: '', description: '', is_active: true });
    }
    setShowModal(true);
  };

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Units of Measurement</h3>
          <p className="text-sm text-gray-500">Manage how your product quantities are measured</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Unit
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search units..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Symbol</th>
                <th className="px-6 py-3 text-left font-semibold">Description</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400">Loading units...</td></tr>
              ) : filteredUnits.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400">No units found</td></tr>
              ) : filteredUnits.map(unit => (
                <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{unit.name}</td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600 uppercase tracking-wider">{unit.symbol}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{unit.description}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openModal(unit)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(unit.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center">
              <Scale className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="text-xl font-bold">{editingUnit ? 'Edit Unit' : 'New Unit'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Unit Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Kilograms"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Symbol</label>
                  <input
                    required
                    type="text"
                    value={formData.symbol}
                    onChange={e => setFormData({...formData, symbol: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    placeholder="e.g. KG"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Optional details..."
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold"
                >
                  {editingUnit ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitsSettings;
