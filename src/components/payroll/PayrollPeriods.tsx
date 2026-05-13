import React, { useState } from 'react';
import { Plus, Calendar, DollarSign, Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { PayrollPeriod } from '../../types';

interface PayrollPeriodsProps {
  periods: PayrollPeriod[];
  onCreatePeriod: (period: Partial<PayrollPeriod>) => Promise<PayrollPeriod | null>;
  onClosePeriod: (periodId: string) => Promise<void>;
  onSelectPeriod: (period: PayrollPeriod) => void;
  selectedPeriod?: PayrollPeriod | null;
}

const PayrollPeriods: React.FC<PayrollPeriodsProps> = ({
  periods,
  onCreatePeriod,
  onClosePeriod,
  onSelectPeriod,
  selectedPeriod
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    pay_date: ''
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payroll Periods</h2>
          <p className="text-gray-600">Manage payroll periods and processing</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
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
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedPeriod?.id === period.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onSelectPeriod(period)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900">{period.period_name}</h3>
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(period.status)}`}>
                    {getStatusIcon(period.status)}
                    <span className="ml-1 capitalize">{period.status}</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Period:</span> {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Pay Date:</span> {new Date(period.pay_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span>Gross: ${period.total_gross_pay.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>Net: ${period.total_net_pay.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {(period.status === 'open' || period.status === 'processing') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (period.status === 'open') {
                      if (!confirm('Are you sure you want to close this period? This will post a journal entry.')) return;
                    }
                    onClosePeriod(period.id);
                  }}
                  className={`text-sm font-medium ${
                    period.status === 'processing'
                      ? 'bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700'
                      : 'text-red-600 hover:text-red-800'
                  }`}
                >
                  {period.status === 'processing' ? '✓ Close & Post Journal' : 'Close Period'}
                </button>
              )}
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create Payroll Period</h3>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., January 2024"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Period
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