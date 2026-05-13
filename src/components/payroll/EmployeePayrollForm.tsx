import React, { useState, useEffect } from 'react';
import { Save, User, PiggyBank, CreditCard, Smartphone } from 'lucide-react';
import type { Employee } from '../../types';

interface EmployeePayrollFormProps {
  employee: Employee | null;
  onSave: (employeeId: string, payrollData: Partial<Employee>) => Promise<boolean>;
  onClose: () => void;
}

const EmployeePayrollForm: React.FC<EmployeePayrollFormProps> = ({
  employee,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    basic_salary: '',
    bank_name: '',
    bank_account: '',
    nhif_number: '',
    nssf_number: '',
    tax_pin: '',
    payment_method: 'bank' as 'bank' | 'cash' | 'mpesa'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        basic_salary: employee.basic_salary?.toString() || '',
        bank_name: employee.bank_name || '',
        bank_account: employee.bank_account || '',
        nhif_number: employee.nhif_number || '',
        nssf_number: employee.nssf_number || '',
        tax_pin: employee.tax_pin || '',
        payment_method: employee.payment_method || 'bank'
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    try {
      const success = await onSave(employee.id, {
        ...formData,
        basic_salary: parseFloat(formData.basic_salary) || 0
      });
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving employee payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <User className="h-6 w-6 text-blue-600 mr-3" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">Payroll Information</h3>
          <p className="text-sm text-gray-600">
            {employee.first_name} {employee.last_name} - {employee.code}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Salary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Basic Salary (Monthly)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.basic_salary}
              onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'bank', label: 'Bank Transfer', icon: PiggyBank },
              { value: 'mpesa', label: 'M-Pesa', icon: Smartphone },
              { value: 'cash', label: 'Cash', icon: CreditCard }
            ].map((method) => (
              <label
                key={method.value}
                className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.payment_method === method.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={method.value}
                  checked={formData.payment_method === method.value}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="sr-only"
                />
                <div className="text-center">
                  <method.icon className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                  <span className="text-sm font-medium">{method.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Bank Information */}
        {formData.payment_method === 'bank' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Equity Bank"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Account Number
              </label>
              <input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Account number"
              />
            </div>
          </div>
        )}

        {/* Tax and Insurance Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax PIN
            </label>
            <input
              type="text"
              value={formData.tax_pin}
              onChange={(e) => setFormData({ ...formData, tax_pin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tax PIN"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NHIF Number
            </label>
            <input
              type="text"
              value={formData.nhif_number}
              onChange={(e) => setFormData({ ...formData, nhif_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="NHIF number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NSSF Number
            </label>
            <input
              type="text"
              value={formData.nssf_number}
              onChange={(e) => setFormData({ ...formData, nssf_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="NSSF number"
            />
          </div>
        </div>

        {/* Action Buttons */}
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
            Save Payroll Info
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeePayrollForm; 