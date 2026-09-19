import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Minus, DollarSign, Calculator } from 'lucide-react';
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
  const currency = settings?.default_currency || 'KES';

  const [formData, setFormData] = useState({
    basic_salary: 0,
    overtime_hours: 0,
    holiday_hours: 0,
    allowances: 0,
    bonuses: 0,
    tax_deduction: 0,
    nhif_deduction: 0,
    nssf_deduction: 0,
    housing_levy_deduction: 0,
    sacco_welfare_deduction: 0,
    other_deductions: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (run) {
      setFormData({
        basic_salary: Number(run.basic_salary) || 0,
        overtime_hours: Number(run.overtime_hours) || 0,
        holiday_hours: Number(run.holiday_hours) || 0,
        allowances: Number(run.allowances) || 0,
        bonuses: Number(run.bonuses) || 0,
        tax_deduction: Number(run.tax_deduction) || 0,
        nhif_deduction: Number(run.nhif_deduction) || 0,
        nssf_deduction: Number(run.nssf_deduction) || 0,
        housing_levy_deduction: Number(run.housing_levy_deduction) || 0,
        sacco_welfare_deduction: Number(run.sacco_welfare_deduction) || 0,
        other_deductions: Number(run.other_deductions) || 0,
        notes: run.notes || ''
      });
    }
  }, [run]);

  if (!isOpen || !run) return null;

  const basicSalary = Number(formData.basic_salary) || 0;
  const hourlyRate = basicSalary / 160;
  const overtimePay = formData.overtime_hours * hourlyRate * (Number(settings?.overtime_rate) || 1.5);
  const holidayPay = formData.holiday_hours * hourlyRate * (Number(settings?.holiday_pay_rate) || 2.0);
  const calculatedGross = basicSalary + overtimePay + holidayPay + formData.allowances + formData.bonuses;

  const totalDeductions = 
    formData.tax_deduction +
    formData.nhif_deduction +
    formData.nssf_deduction +
    formData.housing_levy_deduction +
    formData.sacco_welfare_deduction +
    formData.other_deductions;

  const calculatedNet = calculatedGross - totalDeductions;

  const fmt = (n: number) =>
    n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleRecalculateDeductions = () => {
    if (!settings) return;
    const taxRate = settings.tax_enabled ? (Number(settings.tax_deduction_rate) || 0) : 0;
    const nhifRate = settings.nhif_enabled ? (Number(settings.nhif_rate) || 0) : 0;
    const nssfRate = settings.nssf_enabled ? (Number(settings.nssf_rate) || 0) : 0;
    const hlRate = settings.housing_levy_enabled ? (Number(settings.housing_levy_rate) || 0) : 0;
    const saccoAmt = settings.sacco_welfare_enabled 
      ? (Number(settings.sacco_welfare_amount) > 0 ? Number(settings.sacco_welfare_amount) : (calculatedGross * (Number(settings.sacco_welfare_rate) || 0)) / 100)
      : 0;

    setFormData(prev => ({
      ...prev,
      tax_deduction: Number(((calculatedGross * taxRate) / 100).toFixed(2)),
      nhif_deduction: Number(((calculatedGross * nhifRate) / 100).toFixed(2)),
      nssf_deduction: Number(((calculatedGross * nssfRate) / 100).toFixed(2)),
      housing_levy_deduction: Number(((calculatedGross * hlRate) / 100).toFixed(2)),
      sacco_welfare_deduction: Number(saccoAmt.toFixed(2))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        basic_salary: basicSalary,
        overtime_pay: overtimePay,
        holiday_pay: holidayPay,
        gross_pay: calculatedGross,
        net_pay: calculatedNet
      });
      onClose();
    } catch (error) {
      console.error('Error saving payroll run adjustments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Edit Salary Details & Deductions</h3>
            <p className="text-xs text-slate-400">
              {run.employee?.first_name} {run.employee?.last_name} ({run.employee?.code || 'EMP'}) · Dept: {run.employee?.department || 'General'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Summary Live Calculation Box */}
          <div className="grid grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Basic Salary</div>
              <div className="text-sm font-bold text-slate-800">{currency} {fmt(basicSalary)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Gross Pay</div>
              <div className="text-sm font-bold text-blue-700">{currency} {fmt(calculatedGross)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Deductions</div>
              <div className="text-sm font-bold text-red-600">– {currency} {fmt(totalDeductions)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Net Take-Home</div>
              <div className="text-base font-black text-emerald-600">{currency} {fmt(calculatedNet)}</div>
            </div>
          </div>

          {/* Basic Salary & Additional Earnings */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Salary & Earnings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center">
                  <DollarSign className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Basic Salary ({currency}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.basic_salary}
                  onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm font-black text-slate-900 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center">
                  <Plus className="h-3 w-3 mr-1 text-green-600" /> Allowances ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.allowances}
                  onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center">
                  <Plus className="h-3 w-3 mr-1 text-green-600" /> Bonuses ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.bonuses}
                  onChange={(e) => setFormData({ ...formData, bonuses: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Overtime & Holiday Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hours & Overtime</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Overtime Hours ({settings?.overtime_rate || 1.5}x multiplier)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.overtime_hours}
                  onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                {overtimePay > 0 && (
                  <p className="text-[11px] text-blue-600 mt-1 font-semibold">
                    +{currency} {fmt(overtimePay)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Holiday Hours ({settings?.holiday_pay_rate || 2.0}x multiplier)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.holiday_hours}
                  onChange={(e) => setFormData({ ...formData, holiday_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                {holidayPay > 0 && (
                  <p className="text-[11px] text-blue-600 mt-1 font-semibold">
                    +{currency} {fmt(holidayPay)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Deductions: All editable, with Auto-Calculate button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <Minus className="h-3.5 w-3.5 mr-1 text-red-600" />
                Customizable Deductions ({currency})
              </h4>
              <button
                type="button"
                onClick={handleRecalculateDeductions}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-blue-50 px-2 py-1 rounded-md"
                title="Automatically calculate PAYE, NSSF, NHIF, Housing Levy based on settings rates"
              >
                <Calculator className="h-3.5 w-3.5" />
                Auto-Calculate from Rates
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  PAYE (Income Tax)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tax_deduction}
                  onChange={(e) => setFormData({ ...formData, tax_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NHIF / SHA
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.nhif_deduction}
                  onChange={(e) => setFormData({ ...formData, nhif_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NSSF
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.nssf_deduction}
                  onChange={(e) => setFormData({ ...formData, nssf_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Housing Levy
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.housing_levy_deduction}
                  onChange={(e) => setFormData({ ...formData, housing_levy_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  Sacco & Welfare Payment
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sacco_welfare_deduction}
                  onChange={(e) => setFormData({ ...formData, sacco_welfare_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-indigo-50/40 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Other Deductions
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.other_deductions}
                  onChange={(e) => setFormData({ ...formData, other_deductions: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Adjustment Notes / Remarks
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="e.g. Adjusted basic salary for annual merit increment and updated Sacco deduction"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Salary Adjustments'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default PayrollRunModal;
