import React, { useState, useEffect } from 'react';
import { X, Save, Info, Check, ShieldCheck } from 'lucide-react';
import type { PayrollSettings } from '../../types';

interface PayrollSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PayrollSettings | null;
  onSave: (settings: Partial<PayrollSettings>) => Promise<void>;
}

const PayrollSettingsModal: React.FC<PayrollSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<PayrollSettings>>({
    pay_period: 'monthly',
    pay_day: 25,
    overtime_rate: 1.5,
    holiday_pay_rate: 2.0,
    tax_deduction_rate: 30.0,
    nhif_rate: 2.5,
    nssf_rate: 6.0,
    housing_levy_rate: 1.5,
    sacco_welfare_rate: 0.0,
    sacco_welfare_amount: 0.0,
    tax_enabled: true,
    nhif_enabled: true,
    nssf_enabled: true,
    housing_levy_enabled: true,
    sacco_welfare_enabled: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        tax_enabled: settings.tax_enabled !== undefined ? Boolean(settings.tax_enabled) : true,
        nhif_enabled: settings.nhif_enabled !== undefined ? Boolean(settings.nhif_enabled) : true,
        nssf_enabled: settings.nssf_enabled !== undefined ? Boolean(settings.nssf_enabled) : true,
        housing_levy_enabled: settings.housing_levy_enabled !== undefined ? Boolean(settings.housing_levy_enabled) : true,
        sacco_welfare_enabled: settings.sacco_welfare_enabled !== undefined ? Boolean(settings.sacco_welfare_enabled) : false,
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving payroll settings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Payroll & Deduction Settings</h3>
            <p className="text-xs text-slate-400">Configure pay period rules, statutory deductions, and voluntary welfare</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
          {/* Informational Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex items-start space-x-3 text-xs text-blue-900">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-blue-950">Flexible & Non-Mandatory Deductions:</span>
              <p className="text-blue-800 leading-relaxed">
                All deductions are customizable. None of them are mandatory. You can toggle any deduction on or off, or set its rate to 0%. Disabled deductions will not be deducted when generating payroll.
              </p>
            </div>
          </div>

          {/* Pay Period & Pay Day */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Pay Period
              </label>
              <select
                value={formData.pay_period || 'monthly'}
                onChange={(e) => setFormData({ ...formData, pay_period: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Pay Day (Day of Month)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.pay_day || 25}
                onChange={(e) => setFormData({ ...formData, pay_day: parseInt(e.target.value) || 25 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="25"
              />
            </div>
          </div>

          {/* Multipliers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Overtime Multiplier (e.g., 1.5x)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={formData.overtime_rate || 1.5}
                onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Holiday Pay Multiplier (e.g., 2.0x)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={formData.holiday_pay_rate || 2.0}
                onChange={(e) => setFormData({ ...formData, holiday_pay_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Deductions Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>Payroll Deductions & Welfare Settings</span>
              <span className="text-xs font-normal text-slate-500">Toggle on/off or customize rates</span>
            </h4>

            <div className="grid grid-cols-1 gap-3">
              
              {/* PAYE Income Tax */}
              <div className={`p-3.5 rounded-lg border transition-all ${
                formData.tax_enabled ? 'bg-slate-50 border-slate-300' : 'bg-gray-100/60 border-gray-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.tax_enabled)}
                      onChange={(e) => setFormData({ ...formData, tax_enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      PAYE (Income Tax)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      GL: 2121
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-600">Rate (%):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={!formData.tax_enabled}
                      value={formData.tax_deduction_rate ?? 30}
                      onChange={(e) => setFormData({ ...formData, tax_deduction_rate: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2.5 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* NHIF / SHA */}
              <div className={`p-3.5 rounded-lg border transition-all ${
                formData.nhif_enabled ? 'bg-slate-50 border-slate-300' : 'bg-gray-100/60 border-gray-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.nhif_enabled)}
                      onChange={(e) => setFormData({ ...formData, nhif_enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      NHIF / SHA (Health Insurance)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      GL: 2123
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-600">Rate (%):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={!formData.nhif_enabled}
                      value={formData.nhif_rate ?? 2.5}
                      onChange={(e) => setFormData({ ...formData, nhif_rate: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2.5 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* NSSF */}
              <div className={`p-3.5 rounded-lg border transition-all ${
                formData.nssf_enabled ? 'bg-slate-50 border-slate-300' : 'bg-gray-100/60 border-gray-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.nssf_enabled)}
                      onChange={(e) => setFormData({ ...formData, nssf_enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      NSSF (Pension Fund)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      GL: 2122
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-600">Rate (%):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={!formData.nssf_enabled}
                      value={formData.nssf_rate ?? 6.0}
                      onChange={(e) => setFormData({ ...formData, nssf_rate: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2.5 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Housing Levy */}
              <div className={`p-3.5 rounded-lg border transition-all ${
                formData.housing_levy_enabled ? 'bg-slate-50 border-slate-300' : 'bg-gray-100/60 border-gray-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.housing_levy_enabled)}
                      onChange={(e) => setFormData({ ...formData, housing_levy_enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      Affordable Housing Levy
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      GL: 2124
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-600">Rate (%):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      disabled={!formData.housing_levy_enabled}
                      value={formData.housing_levy_rate ?? 1.5}
                      onChange={(e) => setFormData({ ...formData, housing_levy_rate: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2.5 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sacco / Welfare Deduction */}
              <div className={`p-3.5 rounded-lg border transition-all ${
                formData.sacco_welfare_enabled ? 'bg-indigo-50/70 border-indigo-300' : 'bg-gray-100/60 border-gray-200 opacity-70'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.sacco_welfare_enabled)}
                      onChange={(e) => setFormData({ ...formData, sacco_welfare_enabled: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-indigo-950">
                      Sacco & Staff Welfare Payment
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                      GL: 2126
                    </span>
                  </label>

                  <div className="flex items-center space-x-3 text-xs text-slate-700 pl-6 sm:pl-0">
                    <div className="flex items-center space-x-1.5">
                      <span>Rate (%):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        disabled={!formData.sacco_welfare_enabled}
                        value={formData.sacco_welfare_rate ?? 0}
                        onChange={(e) => setFormData({ ...formData, sacco_welfare_rate: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="0%"
                      />
                    </div>
                    <span className="text-slate-400">or</span>
                    <div className="flex items-center space-x-1.5">
                      <span>Fixed:</span>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        disabled={!formData.sacco_welfare_enabled}
                        value={formData.sacco_welfare_amount ?? 0}
                        onChange={(e) => setFormData({ ...formData, sacco_welfare_amount: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 pl-6">
                  Applies either a percentage of gross pay or a fixed monthly welfare contribution per employee.
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default PayrollSettingsModal;