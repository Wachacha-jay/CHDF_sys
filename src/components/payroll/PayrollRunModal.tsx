import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Minus } from 'lucide-react';
import type { PayrollRun } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface PayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (run: Partial<PayrollRun>) => Promise<void>;
  run: PayrollRun | null;
}

const PayrollRunModal: React.FC<PayrollRunModalProps> = ({
  isOpen,
  onClose,
  onSave,
  run
}) => {
  const { settings } = useSettingsContext();
  const [formData, setFormData] = useState<Partial<PayrollRun>>({
    overtime_hours: 0,
    holiday_hours: 0,
    allowances: 0,
    bonuses: 0,
    other_deductions: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (run) {
      setFormData({
        overtime_hours: run.overtime_hours || 0,
        holiday_hours: run.holiday_hours || 0,
        allowances: run.allowances || 0,
        bonuses: run.bonuses || 0,
        other_deductions: run.other_deductions || 0,
        notes: run.notes || ''
      });
    }
  }, [run]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving payroll run:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !run) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Adjust Payroll Run</h3>
            <p className="text-sm text-gray-600">
              {run.employee?.first_name} {run.employee?.last_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overtime Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.overtime_hours}
                onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Holiday Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.holiday_hours}
                onChange={(e) => setFormData({ ...formData, holiday_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <Plus className="h-3 w-3 mr-1 text-green-600" /> Additional Allowances
              </label>
              <input
                type="number"
                min="0"
                value={formData.allowances}
                onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <Plus className="h-3 w-3 mr-1 text-green-600" /> Bonuses
              </label>
              <input
                type="number"
                min="0"
                value={formData.bonuses}
                onChange={(e) => setFormData({ ...formData, bonuses: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Minus className="h-3 w-3 mr-1 text-red-600" /> Other Deductions
            </label>
            <input
              type="number"
              min="0"
              value={formData.other_deductions}
              onChange={(e) => setFormData({ ...formData, other_deductions: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Reason for adjustments..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Adjustments
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayrollRunModal;
