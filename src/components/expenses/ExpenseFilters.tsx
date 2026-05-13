import React from 'react';
import { Filter, Calendar, DollarSign, Building2, Wallet, Users, Heart } from 'lucide-react';
import type { Account, Supplier, Department, FundAccount, Child, Donor } from '../../types';

interface ExpenseFiltersProps {
  filters: {
    startDate: string;
    endDate: string;
    accountId: string;
    supplierId: string;
    minAmount: string;
    maxAmount: string;
    isApproved: string;
    department_id: string;
    fund_id: string;
    child_id: string;
    donor_id: string;
  };
  onFiltersChange: (filters: any) => void;
  accounts: Account[];
  suppliers: Supplier[];
  departments: Department[];
  funds: FundAccount[];
  children: Child[];
  donors: Donor[];
}

const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  onFiltersChange,
  accounts,
  suppliers,
  departments,
  funds,
  children,
  donors
}) => {
  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      startDate: '',
      endDate: '',
      accountId: '',
      supplierId: '',
      minAmount: '',
      maxAmount: '',
      isApproved: '',
      department_id: '',
      fund_id: '',
      child_id: '',
      donor_id: ''
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Filter size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Advanced Reporting Filters</h3>
            <p className="text-xs text-gray-500">Drill down into your NGO expenses by fund, department, or project</p>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          Clear All Filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
        {/* Date Range */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Date Range</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <span className="text-gray-300">-</span>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Financial Dimensions */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Department</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filters.department_id}
              onChange={(e) => handleFilterChange('department_id', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Restricted Fund</label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filters.fund_id}
              onChange={(e) => handleFilterChange('fund_id', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Beneficiary / Child</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filters.child_id}
              onChange={(e) => handleFilterChange('child_id', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Beneficiaries</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filters */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Expense Account</label>
          <select
            value={filters.accountId}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Accounts</option>
            {accounts.filter(a => a.account_type === 'expense').map((a) => (
              <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Donor Source</label>
          <div className="relative">
            <Heart className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filters.donor_id}
              onChange={(e) => handleFilterChange('donor_id', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Donors</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Amount Range</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="number"
                placeholder="Min"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="relative flex-1">
              <input
                type="number"
                placeholder="Max"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Verification Status</label>
          <select
            value={filters.isApproved}
            onChange={(e) => handleFilterChange('isApproved', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="true">Approved & Posted</option>
            <option value="false">Pending Verification</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ExpenseFilters;
 