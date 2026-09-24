import React, { useState } from 'react';
import { Plus, Calendar, DollarSign, Users, CheckCircle, Clock, XCircle, Edit2, Trash2, RefreshCw } from 'lucide-react';
import type { PayrollPeriod } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface PayrollPeriodsProps {
  periods: PayrollPeriod[];
  onCreatePeriod: (period: Partial<PayrollPeriod>) => Promise<PayrollPeriod | null>;
  onUpdatePeriod?: (periodId: string, data: Partial<PayrollPeriod>) => Promise<PayrollPeriod | null>;
  onDeletePeriod?: (periodId: string) => Promise<boolean>;
  onRefreshPeriod?: (periodId: string) => Promise<PayrollPeriod | null>;
  onClosePeriod: (periodId: string) => Promise<void>;
  onSelectPeriod: (period: PayrollPeriod) => void;
  selectedPeriod?: PayrollPeriod | null;
}

const PayrollPeriods: React.FC<PayrollPeriodsProps> = ({
  periods,
  onCreatePeriod,
  onUpdatePeriod,
  onDeletePeriod,
  onRefreshPeriod,
  onClosePeriod,
  onSelectPeriod,
  selectedPeriod
}) => {
  const { currency } = useSettingsContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PayrollPeriod | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    pay_date: ''
  });

  const [editFormData, setEditFormData] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    pay_date: '',
    status: 'open' as 'open' | 'processing' | 'closed'
  });

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPeriod = await onCreatePeriod({
      ...formData,
      status: 'open',
      total_gross_pay: 0,
      total_net_pay: 0,
      total_tax: 0,
      total_nhif: 0,
      total_nssf: 0,
      total_housing_levy: 0
    });
    if (newPeriod) {
      setShowCreateModal(false);
      setFormData({ period_name: '', start_date: '', end_date: '', pay_date: '' });
    }
  };

  const openEditModal = (period: PayrollPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPeriod(period);
    setEditFormData({
      period_name: period.period_name,
      start_date: period.start_date ? new Date(period.start_date).toISOString().split('T')[0] : '',
      end_date: period.end_date ? new Date(period.end_date).toISOString().split('T')[0] : '',
      pay_date: period.pay_date ? new Date(period.pay_date).toISOString().split('T')[0] : '',
      status: period.status
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod || !onUpdatePeriod) return;
    setActionLoading(true);
    try {
      await onUpdatePeriod(editingPeriod.id, editFormData);
      setEditingPeriod(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (period: PayrollPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeletePeriod) return;
    if (!window.confirm(`Are you sure you want to delete pay period "${period.period_name}"? All associated payroll runs and records for this period will also be deleted.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await onDeletePeriod(period.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async (period: PayrollPeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRefreshPeriod) return;
    setRefreshingId(period.id);
    try {
      await onRefreshPeriod(period.id);
    } finally {
      setRefreshingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-50 text-blue-700';
      case 'processing':
        return 'bg-yellow-50 text-yellow-700';
      case 'closed':
        return 'bg-green-50 text-green-700';
      default:
        return 'bg-red-50 text-red-700';
    }
  };

  const curr = currency || 'KES';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payroll Periods</h2>
          <p className="text-gray-600 text-sm">Manage payroll periods, refresh run summaries, and track processing</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Period
        </button>
      </div>

      {/* Periods List */}
      <div className="space-y-4">
        {periods.map((period) => (
          <div
            key={period.id}
            className={`border rounded-xl p-4 cursor-pointer transition-all ${
              selectedPeriod?.id === period.id
                ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
            }`}
            onClick={() => onSelectPeriod(period)}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900">{period.period_name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(period.status)}`}>
                    {getStatusIcon(period.status)}
                    <span className="ml-1 capitalize">{period.status}</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-500">Period:</span> {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Pay Date:</span> {new Date(period.pay_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-emerald-600" />
                      <span className="font-semibold text-gray-800">Gross: {curr} {Number(period.total_gross_pay || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1 text-blue-600" />
                      <span className="font-semibold text-gray-800">Net: {curr} {Number(period.total_net_pay || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                {/* Refresh Totals */}
                {onRefreshPeriod && (
                  <button
                    onClick={(e) => handleRefresh(period, e)}
                    disabled={refreshingId === period.id}
                    title="Refresh and recalculate period totals from runs"
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingId === period.id ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                )}

                {/* Edit Period */}
                {onUpdatePeriod && (
                  <button
                    onClick={(e) => openEditModal(period, e)}
                    title="Edit period details"
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}

                {/* Delete Period */}
                {onDeletePeriod && (
                  <button
                    onClick={(e) => handleDelete(period, e)}
                    title="Delete period"
                    className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Close Period */}
                {(period.status === 'open' || period.status === 'processing') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (period.status === 'open') {
                        if (!confirm('Are you sure you want to close this period? This will post a journal entry.')) return;
                      }
                      onClosePeriod(period.id);
                    }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                      period.status === 'processing'
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {period.status === 'processing' ? '✓ Close & Post Journal' : 'Close Period'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {periods.length === 0 && (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll periods</h3>
            <p className="text-gray-500">Create your first payroll period to get started.</p>
          </div>
        )}
      </div>

      {/* Create Period Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-xl bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Payroll Period</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.period_name}
                  onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g., January 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.pay_date}
                  onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm"
                >
                  Create Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Period Modal */}
      {editingPeriod && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-xl bg-white">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Payroll Period</h3>
                <p className="text-xs text-gray-500">Modify period parameters and workflow state</p>
              </div>
              <button
                onClick={() => setEditingPeriod(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.period_name}
                  onChange={(e) => setEditFormData({ ...editFormData, period_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.start_date}
                    onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.end_date}
                    onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pay Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.pay_date}
                    onChange={(e) => setEditFormData({ ...editFormData, pay_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="processing">Processing</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingPeriod(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPeriods; 